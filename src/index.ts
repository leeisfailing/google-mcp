#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const SCOPES = [
  'https://www.googleapis.com/auth/forms',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

function loadCredentials(): { clientId: string; clientSecret: string } {
  const credentialsPath = path.join(PROJECT_ROOT, 'key.json');
  if (fs.existsSync(credentialsPath)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      const key = credentials.installed || credentials.web;
      if (key && key.client_id && key.client_secret) {
        return { clientId: key.client_id, clientSecret: key.client_secret };
      }
    } catch (e) {
      console.error('Failed to parse key.json:', e);
    }
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('No key.json found. Please place one in the project root.');
    process.exit(1);
  }
  return { clientId, clientSecret };
}

function loadRefreshToken(): string | null {
  const tokenPath = path.join(PROJECT_ROOT, 'token.json');
  if (fs.existsSync(tokenPath)) {
    try {
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      if (token.refresh_token) return token.refresh_token;
    } catch (e) {
      console.error('Failed to parse token.json:', e);
    }
  }
  return process.env.GOOGLE_REFRESH_TOKEN || null;
}

function saveTokens(tokens: { refresh_token?: string | null; access_token?: string | null; expiry_date?: number | null; scope?: string | null }) {
  const tokenPath = path.join(PROJECT_ROOT, 'token.json');
  const existing = loadFullTokens();
  const merged = { ...existing, ...tokens };
  fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
}

function loadFullTokens(): Record<string, any> {
  const tokenPath = path.join(PROJECT_ROOT, 'token.json');
  if (fs.existsSync(tokenPath)) {
    try {
      return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    } catch (e) {
      console.error('Failed to parse token.json:', e);
    }
  }
  return {};
}

function deleteTokens() {
  const tokenPath = path.join(PROJECT_ROOT, 'token.json');
  if (fs.existsSync(tokenPath)) {
    try {
      fs.unlinkSync(tokenPath);
    } catch (e) {
      console.error('Failed to delete token.json:', e);
    }
  }
}

function checkScopesValid(): boolean {
  const fullTokens = loadFullTokens();
  if (!fullTokens.scope) return false;
  const tokenScopes = fullTokens.scope.split(/\s+/);
  return SCOPES.every((required) => tokenScopes.includes(required));
}

async function openBrowser(url: string) {
  try {
    const open = (await import('open')).default;
    await open(url, { wait: false });
  } catch {
    console.error(`Could not open browser automatically. Please visit:\n${url}`);
  }
}

async function authenticate(forceReauth = false): Promise<string> {
  const { clientId, clientSecret } = loadCredentials();
  if (!forceReauth) {
    const existing = loadRefreshToken();
    if (existing) return existing;
  }

  console.error('Starting browser authentication...');

  return new Promise<string>((resolve, reject) => {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) throw new Error('No URL in request');
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const code = parsedUrl.searchParams.get('code');

        if (code) {
          const { tokens } = await oauth2Client.getToken(code as string);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><h1>Authentication Successful!</h1><p>You can close this tab and the terminal. The server will work automatically from now on.</p></body></html>');

          if (tokens.refresh_token) {
            saveTokens(tokens);
            console.error('\n=== SUCCESS ===');
            console.error('Refresh token saved to token.json');
            console.error('You can close this terminal. The server will work automatically from now on.');
            console.error('================\n');
            server.close();
            resolve(tokens.refresh_token);
          } else {
            saveTokens(tokens);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<html><body><h1>Partial Success</h1><p>No refresh token received. You may need to re-authorize.</p></body></html>');
            server.close();
            resolve(tokens.access_token || '');
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><h1>Error: No auth code received</h1></body></html>');
        }
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body><h1>Error</h1><p>${e.message?.replace(/</g, '&lt;')}</p></body></html>`);
        server.close();
        reject(e);
      }
    }).listen(3000, () => {
      console.error('Opening browser for authentication...');
      openBrowser(authorizeUrl);
    });

    server.on('error', reject);

    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

const { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } = loadCredentials();

class GoogleFormsServer {
  private server: Server;
  private oauth2Client: any;
  private forms: any;
  private sheets: any;
  private drive: any;
  private reauthAttempts = 0;
  private static readonly MAX_REAUTH_ATTEMPTS = 3;

  constructor(refreshToken: string) {
    this.server = new Server(
      {
        name: 'google-forms-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    this.oauth2Client.on('tokens', (tokens: any) => {
      try {
        saveTokens(tokens);
      } catch (e) {
        console.error('Failed to save tokens:', e);
      }
    });

    this.forms = google.forms({
      version: 'v1',
      auth: this.oauth2Client,
    });

    this.sheets = google.sheets({
      version: 'v4',
      auth: this.oauth2Client,
    });

    this.drive = google.drive({
      version: 'v3',
      auth: this.oauth2Client,
    });

    this.setupToolHandlers();

    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async executeTool(name: string, args: any) {
    switch (name) {
      case 'create_form':
        return await this.createForm(args);
      case 'copy_form':
        return await this.copyForm(args);
      case 'delete_form':
        return await this.deleteForm(args);
      case 'get_form':
        return await this.getForm(args);
      case 'get_form_metadata':
        return await this.getFormMetadata(args);
      case 'update_form_settings':
        return await this.updateFormSettings(args);
      case 'set_publish_settings':
        return await this.setPublishSettings(args);
      case 'set_form_description':
        return await this.setFormDescription(args);
      case 'add_text_question':
        return await this.addTextQuestion(args);
      case 'add_paragraph_question':
        return await this.addParagraphQuestion(args);
      case 'add_multiple_choice_question':
        return await this.addMultipleChoiceQuestion(args);
      case 'add_checkbox_question':
        return await this.addCheckboxQuestion(args);
      case 'add_dropdown_question':
        return await this.addDropdownQuestion(args);
      case 'add_linear_scale_question':
        return await this.addLinearScaleQuestion(args);
      case 'add_date_question':
        return await this.addDateQuestion(args);
      case 'add_time_question':
        return await this.addTimeQuestion(args);
      case 'add_rating_question':
        return await this.addRatingQuestion(args);
      case 'add_file_upload_question':
        return await this.addFileUploadQuestion(args);
      case 'add_choice_grid':
        return await this.addChoiceGrid(args);
      case 'add_page_break':
        return await this.addPageBreak(args);
      case 'add_section_header':
        return await this.addSectionHeader(args);
      case 'add_title_description':
        return await this.addTitleDescription(args);
      case 'add_image':
        return await this.addImage(args);
      case 'add_video':
        return await this.addVideo(args);
      case 'reorder_items':
        return await this.reorderItems(args);
      case 'update_question':
        return await this.updateQuestion(args);
      case 'delete_question':
        return await this.deleteQuestion(args);
      case 'set_question_grading':
        return await this.setQuestionGrading(args);
      case 'get_form_items':
        return await this.getFormItems(args);
      case 'get_form_responses':
        return await this.getFormResponses(args);
      case 'get_responses_sheet':
        return await this.getResponsesSheet(args);
      case 'list_forms':
        return await this.listForms(args);
      case 'get_form_responses_analytics':
        return await this.getFormResponsesAnalytics(args);
      case 'share_form':
        return await this.shareForm(args);
      // Spreadsheet Management
      case 'create_spreadsheet':
        return await this.createSpreadsheet(args);
      case 'delete_spreadsheet':
        return await this.deleteSpreadsheet(args);
      case 'get_spreadsheet':
        return await this.getSpreadsheet(args);
      case 'list_spreadsheets':
        return await this.listSpreadsheets(args);
      // Sheet/Tab Management
      case 'add_sheet':
        return await this.addSheet(args);
      case 'delete_sheet':
        return await this.deleteSheet(args);
      case 'rename_sheet':
        return await this.renameSheet(args);
      case 'list_sheets':
        return await this.listSheets(args);
      // Cell/Range Operations
      case 'read_range':
        return await this.readRange(args);
      case 'write_range':
        return await this.writeRange(args);
      case 'append_rows':
        return await this.appendRows(args);
      case 'clear_range':
        return await this.clearRange(args);
      // Formatting
      case 'format_cells':
        return await this.formatCells(args);
      case 'merge_cells':
        return await this.mergeCells(args);
      case 'run_formula':
        return await this.runFormula(args);
      case 'filter_sheet':
        return await this.filterSheet(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_form',
          description: 'Create a new Google Form',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Form title',
              },
              description: {
                type: 'string',
                description: 'Form description (optional)',
              },
            },
            required: ['title'],
          },
        },
        {
          name: 'copy_form',
          description: 'Create a copy of an existing form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID to copy',
              },
              newTitle: {
                type: 'string',
                description: 'New form title (optional)',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'delete_form',
          description: 'Delete a Google Form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID to delete',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'get_form',
          description: 'Get form details',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'get_form_metadata',
          description: 'Get form metadata including response count and settings',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'update_form_settings',
          description: 'Update form settings (quiz mode, collect emails, description, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              title: {
                type: 'string',
                description: 'New form title (optional)',
              },
              description: {
                type: 'string',
                description: 'New form description (optional)',
              },
              isQuiz: {
                type: 'boolean',
                description: 'Enable quiz mode (optional)',
              },
              collectEmails: {
                type: 'boolean',
                description: 'Collect email addresses (optional)',
              },
              quizSettings: {
                type: 'object',
                properties: {
                  isQuiz: {
                    type: 'boolean',
                    description: 'Enable quiz mode',
                  },
                },
                description: 'Quiz configuration (optional)',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'set_publish_settings',
          description: 'Set publish settings for a form (publish/unpublish, accept/reject responses)',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              isPublished: {
                type: 'boolean',
                description: 'Whether the form is published and visible to others (optional, default true)',
              },
              isAcceptingResponses: {
                type: 'boolean',
                description: 'Whether the form accepts responses (optional, defaults to isPublished value)',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'set_form_description',
          description: 'Set or update the form description',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              description: {
                type: 'string',
                description: 'New form description',
              },
            },
            required: ['formId', 'description'],
          },
        },
        {
          name: 'add_text_question',
          description: 'Add a short text question to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle'],
          },
        },
        {
          name: 'add_paragraph_question',
          description: 'Add a long text (paragraph) question to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle'],
          },
        },
        {
          name: 'add_multiple_choice_question',
          description: 'Add a multiple choice question to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              options: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of choices',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle', 'options'],
          },
        },
        {
          name: 'add_checkbox_question',
          description: 'Add a checkbox question (multiple selections allowed) to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              options: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of checkbox options',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle', 'options'],
          },
        },
        {
          name: 'add_dropdown_question',
          description: 'Add a dropdown question to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              options: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of dropdown options',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle', 'options'],
          },
        },
        {
          name: 'add_linear_scale_question',
          description: 'Add a linear scale question to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              low: {
                type: 'number',
                description: 'Low value (e.g. 1, must be between 0 and 10)',
              },
              high: {
                type: 'number',
                description: 'High value (e.g. 5, must be between 0 and 10)',
              },
              lowLabel: {
                type: 'string',
                description: 'Label for low value (optional)',
              },
              highLabel: {
                type: 'string',
                description: 'Label for high value (optional)',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle', 'low', 'high'],
          },
        },
        {
          name: 'add_date_question',
          description: 'Add a date question to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              includeTime: {
                type: 'boolean',
                description: 'Whether to include time (optional, default is false)',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle'],
          },
        },
        {
          name: 'add_time_question',
          description: 'Add a time question to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              duration: {
                type: 'boolean',
                description: 'Whether this is a duration (optional, default is false)',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle'],
          },
        },
        {
          name: 'add_rating_question',
          description: 'Add a rating question (star, heart, or thumbs up rating) to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              iconType: {
                type: 'string',
                description: 'Icon type: STAR, HEART, or THUMB_UP (optional, default STAR)',
                enum: ['STAR', 'HEART', 'THUMB_UP'],
              },
              ratingScaleLevel: {
                type: 'integer',
                description: 'Scale level from 3 to 10 (optional, default 5)',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle'],
          },
        },
        {
          name: 'add_file_upload_question',
          description: 'Add a file upload question to the form. NOTE: The Google Forms API does not support creating file upload questions programmatically. This tool returns manual instructions for adding the question via the Google Forms UI.',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              types: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Allowed file types (optional, default: PDF, DOCUMENT, SPREADSHEET, PRESENTATION, IMAGE, VIDEO, AUDIO)',
              },
              maxSize: {
                type: 'number',
                description: 'Max file size in MB (optional, default 10)',
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle'],
          },
        },
        {
          name: 'add_choice_grid',
          description: 'Add a multiple choice grid question (rows x columns) to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              questionTitle: {
                type: 'string',
                description: 'Question title',
              },
              rows: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Row labels (string array)',
              },
              columns: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Column labels (string array)',
              },
              type: {
                type: 'string',
                description: 'Grid type: RADIO or CHECKBOX (optional, default RADIO)',
                enum: ['RADIO', 'CHECKBOX'],
              },
              required: {
                type: 'boolean',
                description: 'Whether required (optional, default is false)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this question to (optional, 1-indexed). If omitted, appends to the last section. Use get_form_items to see section boundaries.',
              },
            },
            required: ['formId', 'questionTitle', 'rows', 'columns'],
          },
        },
        {
          name: 'add_page_break',
          description: 'Add a section break (page break) to the form. This creates a new section. Use the section parameter on question tools to control which section questions go in.',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              title: {
                type: 'string',
                description: 'Page break title (optional)',
              },
              description: {
                type: 'string',
                description: 'Page break description (optional)',
              },
              section: {
                type: 'integer',
                description: 'Section number to insert this page break at (optional, 1-indexed). If omitted, appends to the end. A page break creates a new section boundary.',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'add_section_header',
          description: 'Add a description/text block within the current section. This does NOT create a new section - use add_page_break to create a section boundary.',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              title: {
                type: 'string',
                description: 'Section header title (optional)',
              },
              description: {
                type: 'string',
                description: 'Section description text (optional)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this to (optional, 1-indexed). If omitted, appends to the last section.',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'add_title_description',
          description: 'Add a title and description section to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              title: {
                type: 'string',
                description: 'Title text',
              },
              description: {
                type: 'string',
                description: 'Description text (optional)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this to (optional, 1-indexed). If omitted, appends to the last section.',
              },
            },
            required: ['formId', 'title'],
          },
        },
        {
          name: 'add_image',
          description: 'Add an image to the form. The URL must be a direct link to a publicly accessible image file (JPEG, PNG, or GIF). Works with GitHub raw URLs, Google Drive public links, Imgur direct links, etc. Does NOT work with Wikipedia/Wikimedia or pages that require authentication.',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              title: {
                type: 'string',
                description: 'Image title shown above the image (optional)',
              },
              imageUrl: {
                type: 'string',
                description: 'Direct URL to the image file (must end in .jpg, .png, .gif or be a direct image endpoint)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this image to (optional, 1-indexed). If omitted, appends to the last section.',
              },
            },
            required: ['formId', 'imageUrl'],
          },
        },
        {
          name: 'add_video',
          description: 'Add a YouTube video to the form',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              title: {
                type: 'string',
                description: 'Video title (optional)',
              },
              videoUrl: {
                type: 'string',
                description: 'YouTube video URL',
              },
              caption: {
                type: 'string',
                description: 'Video caption (optional, stored locally only - Google Forms API does not support captions)',
              },
              section: {
                type: 'integer',
                description: 'Section number to add this video to (optional, 1-indexed). If omitted, appends to the last section.',
              },
            },
            required: ['formId', 'videoUrl'],
          },
        },
        {
          name: 'reorder_items',
          description: 'Reorder items in the form by moving an item to a new position',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              itemId: {
                type: 'string',
                description: 'Item ID to move (use get_form_items to find)',
              },
              newIndex: {
                type: 'integer',
                description: 'New position index (0-based)',
              },
            },
            required: ['formId', 'itemId', 'newIndex'],
          },
        },
        {
          name: 'update_question',
          description: 'Update an existing question title, required status, or choices (for multiple choice, checkbox, dropdown questions)',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              itemId: {
                type: 'string',
                description: 'Item ID of the question to update (use get_form_items to find)',
              },
              newTitle: {
                type: 'string',
                description: 'New question title (optional)',
              },
              required: {
                type: 'boolean',
                description: 'New required status (optional)',
              },
              choices: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'New choices for choice questions (optional)',
              },
            },
            required: ['formId', 'itemId'],
          },
        },
        {
          name: 'delete_question',
          description: 'Delete a question from the form by item ID',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              itemId: {
                type: 'string',
                description: 'Item ID of the question to delete (use get_form_items to find)',
              },
            },
            required: ['formId', 'itemId'],
          },
        },
        {
          name: 'set_question_grading',
          description: 'Set correct answers and point values for quiz questions',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
              itemId: {
                type: 'string',
                description: 'Item ID of the question (use get_form_items to find)',
              },
              points: {
                type: 'integer',
                description: 'Point value for the question (must be a non-negative integer)',
              },
              correctAnswers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    value: {
                      type: 'string',
                      description: 'The correct answer value (must match an option value exactly)',
                    },
                  },
                },
                description: 'Array of correct answers (for multiple choice, checkbox, dropdown)',
              },
              feedbackCorrect: {
                type: 'string',
                description: 'Feedback for correct answer (optional). For choice questions this is whenRight feedback; for short answer this becomes generalFeedback.',
              },
              feedbackIncorrect: {
                type: 'string',
                description: 'Feedback for incorrect answer (optional, choice questions only). Ignored for short answer questions.',
              },
            },
            required: ['formId', 'itemId', 'points'],
          },
        },
        {
          name: 'get_form_items',
          description: 'Get all items (questions) in a form with their item IDs',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'get_form_responses',
          description: 'Get form responses',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'get_responses_sheet',
          description: 'Read form responses from the linked Google Sheet and return as formatted data',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'list_forms',
          description: 'List all Google Forms you have access to. Returns form IDs, titles, creation dates, and response counts.',
          inputSchema: {
            type: 'object',
            properties: {
              maxResults: {
                type: 'integer',
                description: 'Maximum number of forms to return (optional, default 20, max 100)',
              },
              query: {
                type: 'string',
                description: 'Search query to filter forms by title (optional)',
              },
            },
          },
        },
        {
          name: 'get_form_responses_analytics',
          description: 'Get all form responses with full structured data for analysis. Returns each respondent answers mapped to question titles, scores, and correct/incorrect status. Use this to answer questions like "list lowest to highest score", "who got question X wrong", "what were all the answers for question Y".',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID',
              },
            },
            required: ['formId'],
          },
        },
        {
          name: 'share_form',
          description: 'Share a Google Form with specific people via email. Grants them access to view or edit the form.',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'Form ID to share',
              },
              emailAddresses: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of email addresses to share with',
              },
              role: {
                type: 'string',
                description: 'Permission role: reader (view only), writer (can edit), or commenter (optional, default reader)',
                enum: ['reader', 'writer', 'commenter'],
              },
              sendEmail: {
                type: 'boolean',
                description: 'Whether to send a notification email (optional, default true)',
              },
              message: {
                type: 'string',
                description: 'Custom message to include in the notification email (optional)',
              },
            },
            required: ['formId', 'emailAddresses'],
          },
        },
        // --- Google Sheets Tools ---
        {
          name: 'create_spreadsheet',
          description: 'Create a new Google Spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Spreadsheet title' },
              sheetName: { type: 'string', description: 'Name of the initial sheet/tab (default: Sheet1)' },
              folderId: { type: 'string', description: 'Google Drive folder ID to create it in (optional)' },
            },
            required: ['title'],
          },
        },
        {
          name: 'delete_spreadsheet',
          description: 'Delete a Google Spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID to delete' },
            },
            required: ['spreadsheetId'],
          },
        },
        {
          name: 'get_spreadsheet',
          description: 'Get spreadsheet metadata including sheet/tab list',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
            },
            required: ['spreadsheetId'],
          },
        },
        {
          name: 'list_spreadsheets',
          description: 'List Google Spreadsheets accessible to the user',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search term to filter by name (optional)' },
              maxResults: { type: 'number', description: 'Max results to return (default 20, max 100)' },
            },
          },
        },
        {
          name: 'add_sheet',
          description: 'Add a new sheet/tab to a spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              title: { type: 'string', description: 'Title for the new sheet/tab' },
            },
            required: ['spreadsheetId', 'title'],
          },
        },
        {
          name: 'delete_sheet',
          description: 'Delete a sheet/tab from a spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              sheetId: { type: 'number', description: 'Numeric sheet ID (use list_sheets to find it)' },
            },
            required: ['spreadsheetId', 'sheetId'],
          },
        },
        {
          name: 'rename_sheet',
          description: 'Rename a sheet/tab in a spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              sheetId: { type: 'number', description: 'Numeric sheet ID' },
              newTitle: { type: 'string', description: 'New title for the sheet/tab' },
            },
            required: ['spreadsheetId', 'sheetId', 'newTitle'],
          },
        },
        {
          name: 'list_sheets',
          description: 'List all sheets/tabs in a spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
            },
            required: ['spreadsheetId'],
          },
        },
        {
          name: 'read_range',
          description: 'Read cell values from a range using A1 notation (e.g. "Sheet1!A1:D10")',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              range: { type: 'string', description: 'A1 notation range (e.g. "Sheet1!A1:D10")' },
              valueRenderOption: { type: 'string', description: 'How to render values: FORMATTED_VALUE, UNFORMATTED_VALUE, or FORMULA (default: FORMATTED_VALUE)', enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'] },
            },
            required: ['spreadsheetId', 'range'],
          },
        },
        {
          name: 'write_range',
          description: 'Write values to a range (overwrites existing data)',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              range: { type: 'string', description: 'A1 notation range (e.g. "Sheet1!A1:C3")' },
              values: { type: 'array', items: { type: 'array', items: {} }, description: '2D array of values, e.g. [["A1","B1","C1"],["A2","B2","C2"]]' },
              valueInputOption: { type: 'string', description: 'RAW or USER_ENTERED (default: USER_ENTERED)', enum: ['RAW', 'USER_ENTERED'] },
            },
            required: ['spreadsheetId', 'range', 'values'],
          },
        },
        {
          name: 'append_rows',
          description: 'Append rows to the end of a range in a spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              range: { type: 'string', description: 'A1 notation range to search for a table (e.g. "Sheet1!A:D")' },
              values: { type: 'array', items: { type: 'array', items: {} }, description: '2D array of rows to append' },
              valueInputOption: { type: 'string', description: 'RAW or USER_ENTERED (default: USER_ENTERED)', enum: ['RAW', 'USER_ENTERED'] },
              insertDataOption: { type: 'string', description: 'INSERT_ROWS or OVERWRITE (default: INSERT_ROWS)', enum: ['INSERT_ROWS', 'OVERWRITE'] },
            },
            required: ['spreadsheetId', 'range', 'values'],
          },
        },
        {
          name: 'clear_range',
          description: 'Clear values in a range (keeps formatting)',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              range: { type: 'string', description: 'A1 notation range' },
            },
            required: ['spreadsheetId', 'range'],
          },
        },
        {
          name: 'format_cells',
          description: 'Apply formatting to a range of cells (bold, colors, alignment, font)',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              sheetId: { type: 'number', description: 'Numeric sheet ID' },
              startRow: { type: 'number', description: 'Start row (1-indexed)' },
              endRow: { type: 'number', description: 'End row (1-indexed, inclusive)' },
              startColumn: { type: 'number', description: 'Start column (1-indexed)' },
              endColumn: { type: 'number', description: 'End column (1-indexed, inclusive)' },
              bold: { type: 'boolean', description: 'Bold text' },
              fontSize: { type: 'number', description: 'Font size in points' },
              fontFamily: { type: 'string', description: 'Font family name' },
              foregroundColor: { type: 'string', description: 'Text color as hex (e.g. "#FF0000")' },
              backgroundColor: { type: 'string', description: 'Background color as hex (e.g. "#FFFF00")' },
              horizontalAlignment: { type: 'string', description: 'LEFT, CENTER, or RIGHT', enum: ['LEFT', 'CENTER', 'RIGHT'] },
              wrapStrategy: { type: 'string', description: 'OVERFLOW, WRAP, or CLIP', enum: ['OVERFLOW', 'WRAP', 'CLIP'] },
            },
            required: ['spreadsheetId', 'sheetId', 'startRow', 'endRow', 'startColumn', 'endColumn'],
          },
        },
        {
          name: 'merge_cells',
          description: 'Merge a range of cells',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              sheetId: { type: 'number', description: 'Numeric sheet ID' },
              startRow: { type: 'number', description: 'Start row (1-indexed)' },
              endRow: { type: 'number', description: 'End row (1-indexed, inclusive)' },
              startColumn: { type: 'number', description: 'Start column (1-indexed)' },
              endColumn: { type: 'number', description: 'End column (1-indexed, inclusive)' },
              mergeType: { type: 'string', description: 'MERGE_ALL, MERGE_COLUMNS, or MERGE_ROWS (default: MERGE_ALL)', enum: ['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS'] },
            },
            required: ['spreadsheetId', 'sheetId', 'startRow', 'endRow', 'startColumn', 'endColumn'],
          },
        },
        // --- Formula & Query Tools ---
        {
          name: 'run_formula',
          description: 'Write a Google Sheets formula to a helper cell, execute it, and return the computed results. Useful for FILTER, QUERY, VLOOKUP, SUMIF, etc. Example: =FILTER(A:C, B:B="submitted", C:C>=TODAY()-7)',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              range: { type: 'string', description: 'Cell to write the formula to, e.g. "Sheet1!Z1" (use a far-away column to avoid overwriting data)' },
              formula: { type: 'string', description: 'The Google Sheets formula including the = sign, e.g. "=FILTER(A:C, B:B=\\"submitted\\", C:C>=TODAY()-7)"' },
            },
            required: ['spreadsheetId', 'range', 'formula'],
          },
        },
        {
          name: 'filter_sheet',
          description: 'Filter spreadsheet rows by conditions and return matching data. Builds FILTER/QUERY formulas behind the scenes. Example: filter by submission status "submitted" and date within last 7 days.',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              sheetName: { type: 'string', description: 'Sheet name (default: first sheet)' },
              dataRange: { type: 'string', description: 'A1 notation range for the data, e.g. "A1:F100". If omitted, uses entire sheet.' },
              filters: {
                type: 'array',
                description: 'Array of filter conditions to apply',
                items: {
                  type: 'object',
                  properties: {
                    column: { type: 'number', description: 'Column number (1-indexed, A=1, B=2, etc.)' },
                    condition: { type: 'string', description: 'Condition type: "equals", "contains", "not_equals", "greater_than", "less_than", "is_empty", "not_empty", "starts_with", "ends_with"' },
                    value: { type: 'string', description: 'Value to compare against' },
                  },
                  required: ['column', 'condition', 'value'],
                },
              },
            },
            required: ['spreadsheetId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      try {
        return await this.executeTool(request.params.name, request.params.arguments);
      } catch (error: any) {
        if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired or revoked')) {
          if (this.reauthAttempts >= GoogleFormsServer.MAX_REAUTH_ATTEMPTS) {
            return {
              content: [{ type: 'text', text: `Re-authentication failed after ${GoogleFormsServer.MAX_REAUTH_ATTEMPTS} attempts. Please delete token.json manually and restart the server.` }],
              isError: true,
            };
          }
          this.reauthAttempts++;
          console.error(`Refresh token invalid. Starting re-authentication (attempt ${this.reauthAttempts}/${GoogleFormsServer.MAX_REAUTH_ATTEMPTS})...`);
          try {
            deleteTokens();
            const newToken = await authenticate(true);
            this.reauthAttempts = 0;
            this.oauth2Client.setCredentials({ refresh_token: newToken });
            return await this.executeTool(request.params.name, request.params.arguments);
          } catch (reauthError: any) {
            return {
              content: [{ type: 'text', text: `Re-authentication failed: ${reauthError.message}` }],
              isError: true,
            };
          }
        }
        if (error instanceof McpError) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
        console.error('Error in tool execution:', error);
        return {
          content: [{ type: 'text', text: `Error: ${error.message || 'Unknown error'}` }],
          isError: true,
        };
      }
    });
  }

  private sanitizeOptions(options: any[]): { value: string }[] {
    return options
      .filter((option): option is string => typeof option === 'string')
      .map((option: string) => ({
        value: option.replace(/[\r\n]+/g, ' ').trim(),
      }))
      .filter((opt) => opt.value.length > 0);
  }

  private getInsertIndex(formItems: any[], section?: number): number {
    if (!section || section < 1) {
      return formItems.length;
    }

    let sectionCount = 1;

    for (let i = 0; i < formItems.length; i++) {
      if (formItems[i].pageBreakItem) {
        if (section === sectionCount) {
          return i;
        }
        sectionCount++;
      }
    }

    if (section > sectionCount) {
      return formItems.length;
    }

    return formItems.length;
  }

  private async createForm(args: any) {
    if (!args.title) {
      throw new McpError(ErrorCode.InvalidParams, 'Title is required');
    }

    const form: any = {
      info: {
        title: args.title,
        documentTitle: args.title,
      },
    };

    try {
      const response = await this.forms.forms.create({
        requestBody: form,
      });

      const formId = response.data.formId;
      const responderUri = response.data.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`;

      let descriptionSet = false;
      if (args.description) {
        try {
          await this.forms.forms.batchUpdate({
            formId: formId,
            requestBody: {
              requests: [
                {
                  updateFormInfo: {
                    info: {
                      description: args.description,
                    },
                    updateMask: 'description',
                  },
                },
              ],
            },
          });
          descriptionSet = true;
        } catch (descError: any) {
          console.error('Failed to set form description:', descError);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                formId,
                title: args.title,
                description: descriptionSet ? args.description : '',
                responderUri,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error creating form:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to create form: ${error.message}`);
    }
  }

  private async addTextQuestion(args: any) {
    if (!args.formId || !args.questionTitle) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    textQuestion: {},
                  },
                },
              },
              location: {
                index: insertIndex,
              },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Text question added successfully',
                questionTitle: args.questionTitle,
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding text question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add text question: ${error.message}`);
    }
  }

  private async addParagraphQuestion(args: any) {
    if (!args.formId || !args.questionTitle) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    textQuestion: {
                      paragraph: true,
                    },
                  },
                },
              },
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Paragraph question added successfully',
                questionTitle: args.questionTitle,
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding paragraph question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add paragraph question: ${error.message}`);
    }
  }

  private async addMultipleChoiceQuestion(args: any) {
    if (!args.formId || !args.questionTitle || !args.options || !Array.isArray(args.options)) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, and options array are required');
    }

    if (args.options.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'Options array must not be empty');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const choices = this.sanitizeOptions(args.options);

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    choiceQuestion: {
                      type: 'RADIO',
                      options: choices,
                    },
                  },
                },
              },
              location: {
                index: insertIndex,
              },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Multiple choice question added successfully',
                questionTitle: args.questionTitle,
                options: args.options,
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding multiple choice question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add multiple choice question: ${error.message}`);
    }
  }

  private async addCheckboxQuestion(args: any) {
    if (!args.formId || !args.questionTitle || !args.options || !Array.isArray(args.options)) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, and options array are required');
    }

    if (args.options.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'Options array must not be empty');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const choices = this.sanitizeOptions(args.options);

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    choiceQuestion: {
                      type: 'CHECKBOX',
                      options: choices,
                    },
                  },
                },
              },
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Checkbox question added successfully',
                questionTitle: args.questionTitle,
                options: args.options,
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding checkbox question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add checkbox question: ${error.message}`);
    }
  }

  private async addDropdownQuestion(args: any) {
    if (!args.formId || !args.questionTitle || !args.options || !Array.isArray(args.options)) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, and options array are required');
    }

    if (args.options.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'Options array must not be empty');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const choices = this.sanitizeOptions(args.options);

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    choiceQuestion: {
                      type: 'DROP_DOWN',
                      options: choices,
                    },
                  },
                },
              },
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Dropdown question added successfully',
                questionTitle: args.questionTitle,
                options: args.options,
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding dropdown question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add dropdown question: ${error.message}`);
    }
  }

  private async addLinearScaleQuestion(args: any) {
    if (!args.formId || !args.questionTitle || args.low === undefined || args.high === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, low, and high values are required');
    }

    if (!Number.isInteger(args.low) || !Number.isInteger(args.high) || args.low < 0 || args.low > 10 || args.high < 0 || args.high > 10) {
      throw new McpError(ErrorCode.InvalidParams, 'Low and high must be integers between 0 and 10');
    }

    if (args.low >= args.high) {
      throw new McpError(ErrorCode.InvalidParams, 'Low value must be less than high value');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const scaleConfig: any = {
        low: args.low,
        high: args.high,
      };

      if (args.lowLabel) scaleConfig.lowLabel = args.lowLabel;
      if (args.highLabel) scaleConfig.highLabel = args.highLabel;

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    scaleQuestion: scaleConfig,
                  },
                },
              },
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Linear scale question added successfully',
                questionTitle: args.questionTitle,
                low: args.low,
                high: args.high,
                lowLabel: args.lowLabel || '',
                highLabel: args.highLabel || '',
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding linear scale question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add linear scale question: ${error.message}`);
    }
  }

  private async addDateQuestion(args: any) {
    if (!args.formId || !args.questionTitle) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    dateQuestion: {
                      includeTime: args.includeTime || false,
                    },
                  },
                },
              },
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Date question added successfully',
                questionTitle: args.questionTitle,
                includeTime: args.includeTime || false,
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding date question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add date question: ${error.message}`);
    }
  }

  private async addTimeQuestion(args: any) {
    if (!args.formId || !args.questionTitle) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    timeQuestion: {
                      duration: args.duration || false,
                    },
                  },
                },
              },
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Time question added successfully',
                questionTitle: args.questionTitle,
                duration: args.duration || false,
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding time question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add time question: ${error.message}`);
    }
  }

  private async addRatingQuestion(args: any) {
    if (!args.formId || !args.questionTitle) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
    }

    if (args.ratingScaleLevel !== undefined && (!Number.isInteger(args.ratingScaleLevel) || args.ratingScaleLevel < 3 || args.ratingScaleLevel > 10)) {
      throw new McpError(ErrorCode.InvalidParams, 'ratingScaleLevel must be an integer between 3 and 10');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const ratingConfig: any = {
        ratingScaleLevel: args.ratingScaleLevel || 5,
        iconType: args.iconType || 'STAR',
      };

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    ratingQuestion: ratingConfig,
                  },
                },
              },
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Rating question added successfully',
                questionTitle: args.questionTitle,
                iconType: args.iconType || 'STAR',
                ratingScaleLevel: args.ratingScaleLevel || 5,
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding rating question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add rating question: ${error.message}`);
    }
  }

  private async addFileUploadQuestion(args: any) {
    if (!args.formId || !args.questionTitle) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
    }

    // The Google Forms API does not support creating file upload questions programmatically.
    // Return instructions for manual creation.
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              message: 'The Google Forms API does not support creating file upload questions programmatically.',
              instructions: `To add a file upload question manually:
1. Open your form at https://docs.google.com/forms/d/${args.formId}/edit
2. Click the "+" button to add a new item
3. Select "File upload" from the question type dropdown
4. Set the question title to: ${args.questionTitle}
5. Configure accepted file types and max size`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async addChoiceGrid(args: any) {
    if (!args.formId || !args.questionTitle || !args.rows || !args.columns) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, rows, and columns are required');
    }

    if (!Array.isArray(args.rows) || args.rows.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'Rows must be a non-empty array of strings');
    }

    if (!Array.isArray(args.columns) || args.columns.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'Columns must be a non-empty array of strings');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const columnOptions = this.sanitizeOptions(args.columns);

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionGroupItem: {
                  grid: {
                    columns: {
                      type: args.type || 'RADIO',
                      options: columnOptions,
                    },
                  },
                  questions: args.rows.map((row: string) => ({
                    rowQuestion: { title: row },
                    required: args.required || false,
                  })),
                },
              },
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Choice grid added successfully',
                questionTitle: args.questionTitle,
                rows: args.rows,
                columns: args.columns,
                type: args.type || 'RADIO',
                required: args.required || false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding choice grid:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add choice grid: ${error.message}`);
    }
  }

  private async getForm(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const response = await this.forms.forms.get({
        formId: args.formId,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error getting form:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get form: ${error.message}`);
    }
  }

  private async getFormMetadata(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const response = await this.forms.forms.get({
        formId: args.formId,
      });

      const form = response.data;
      const metadata: any = {
        formId: form.formId,
        responderUri: form.responderUri,
        info: form.info,
        settings: form.settings,
        items: form.items ? form.items.length : 0,
        revisionId: form.revisionId,
      };

      try {
        let responseCount = 0;
        let pageToken: string | undefined;
        do {
          const responses = await this.forms.forms.responses.list({
            formId: args.formId,
            pageSize: 5000,
            pageToken,
          });
          responseCount += (responses.data.responses || []).length;
          pageToken = responses.data.nextPageToken ?? undefined;
        } while (pageToken);
        metadata.responseCount = responseCount;
      } catch (e) {
        metadata.responseCount = null;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(metadata, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error getting form metadata:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get form metadata: ${error.message}`);
    }
  }

  private async updateFormSettings(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const requests: any[] = [];

      if (args.title || args.description) {
        const infoUpdate: any = { updateFormInfo: { info: {}, updateMask: '' } };
        const masks: string[] = [];
        if (args.title) {
          infoUpdate.updateFormInfo.info.title = args.title;
          masks.push('title');
        }
        if (args.description) {
          infoUpdate.updateFormInfo.info.description = args.description;
          masks.push('description');
        }
        infoUpdate.updateFormInfo.updateMask = masks.join(',');
        requests.push(infoUpdate);
      }

      if (args.quizSettings || args.isQuiz !== undefined || args.collectEmails !== undefined) {
        const settings: any = {};
        const masks: string[] = [];
        if (args.quizSettings) {
          settings.quizSettings = { isQuiz: !!args.quizSettings.isQuiz };
          masks.push('quizSettings.isQuiz');
        } else if (args.isQuiz !== undefined) {
          settings.quizSettings = { isQuiz: args.isQuiz };
          masks.push('quizSettings.isQuiz');
        }
        if (args.collectEmails !== undefined) {
          settings.emailCollectionType = args.collectEmails ? 'VERIFIED' : 'DO_NOT_COLLECT';
          masks.push('emailCollectionType');
        }
        requests.push({
          updateSettings: {
            settings,
            updateMask: masks.join(','),
          },
        });
      }

      if (requests.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'No settings to update');
      }

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: { requests },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Form settings updated successfully',
                updatedSettings: {
                  title: args.title,
                  description: args.description,
                  isQuiz: args.isQuiz,
                  quizSettings: args.quizSettings,
                  collectEmails: args.collectEmails,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error updating form settings:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to update form settings: ${error.message}`);
    }
  }

  private async setPublishSettings(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const isPublished = args.isPublished !== undefined ? args.isPublished : true;
      const isAcceptingResponses = args.isAcceptingResponses !== undefined ? args.isAcceptingResponses : isPublished;

      await this.forms.forms.setPublishSettings({
        formId: args.formId,
        requestBody: {
          publishSettings: {
            publishState: {
              isPublished,
              isAcceptingResponses,
            },
          },
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Publish settings updated successfully',
                isPublished,
                isAcceptingResponses,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error setting publish settings:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to set publish settings: ${error.message}`);
    }
  }

  private async setFormDescription(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    if (args.description === undefined || args.description === null) {
      throw new McpError(ErrorCode.InvalidParams, 'Description is required');
    }

    try {
      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: {
          requests: [
            {
              updateFormInfo: {
                info: {
                  description: args.description,
                },
                updateMask: 'description',
              },
            },
          ],
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Form description updated successfully',
                description: args.description,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error setting form description:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to set form description: ${error.message}`);
    }
  }

  private async addPageBreak(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const pageBreakItem: any = {
        pageBreakItem: {},
      };

      if (args.title || args.description) {
        pageBreakItem.title = args.title || '';
        if (args.description) {
          pageBreakItem.description = args.description;
        }
      }

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: pageBreakItem,
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Page break added successfully',
                title: args.title || '',
                description: args.description || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding page break:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add page break: ${error.message}`);
    }
  }

  private async addSectionHeader(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    if (!args.title && !args.description) {
      throw new McpError(ErrorCode.InvalidParams, 'At least a title or description is required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const textItem: any = {
        textItem: {},
      };

      if (args.title) {
        textItem.title = args.title;
      }

      if (args.description) {
        textItem.description = args.description;
      }

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: textItem,
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Section header added successfully',
                title: args.title || '',
                description: args.description || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding section header:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add section header: ${error.message}`);
    }
  }

  private async addTitleDescription(args: any) {
    if (!args.formId || !args.title) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and title are required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const textItem: any = {
        textItem: {},
        title: args.title,
      };

      if (args.description) {
        textItem.description = args.description;
      }

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: textItem,
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Title and description added successfully',
                title: args.title,
                description: args.description || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding title and description:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add title and description: ${error.message}`);
    }
  }

  private async addImage(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    if (!args.imageUrl) {
      throw new McpError(ErrorCode.InvalidParams, 'imageUrl is required. To add an image manually, open your form at https://docs.google.com/forms/d/' + args.formId + '/edit');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      const image: any = {
        sourceUri: args.imageUrl,
      };

      const imageItem: any = {
        imageItem: {
          image,
        },
      };

      if (args.title) {
        imageItem.title = args.title;
      }

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: imageItem,
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Image added successfully',
                title: args.title || '',
                imageUrl: args.imageUrl,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding image:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add image: ${error.message}`);
    }
  }

  private async addVideo(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    if (!args.videoUrl) {
      throw new McpError(ErrorCode.InvalidParams, 'videoUrl is required. To add a video manually, open your form at https://docs.google.com/forms/d/' + args.formId + '/edit');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const formItems = form.data.items || [];
      const insertIndex = this.getInsertIndex(formItems, args.section);

      let videoId = '';
      const youtubeRegex =
        /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/(?:shorts|live)\/)([a-zA-Z0-9_-]{11})/;
      const match = args.videoUrl.match(youtubeRegex);
      if (match) {
        videoId = match[1];
      } else {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid YouTube URL');
      }

      const videoItem: any = {
        videoItem: {
          video: {
            youtubeUri: `https://www.youtube.com/watch?v=${videoId}`,
          },
        },
      };

      if (args.title) {
        videoItem.title = args.title;
      }

      if (args.caption) {
        videoItem.videoItem.caption = args.caption;
      }

      const updateRequest = {
        requests: [
          {
            createItem: {
              item: videoItem,
              location: { index: insertIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Video added successfully',
                title: args.title || '',
                videoUrl: args.videoUrl,
                videoId,
                caption: args.caption || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding video:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add video: ${error.message}`);
    }
  }

  private async reorderItems(args: any) {
    if (!args.formId || !args.itemId || args.newIndex === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and new index are required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const items = form.data.items || [];
      const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);

      if (itemIndex === -1) {
        throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);
      }

      if (args.newIndex < 0 || args.newIndex >= items.length || !Number.isInteger(args.newIndex)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `newIndex must be between 0 and ${items.length - 1}`
        );
      }

      const updateRequest = {
        requests: [
          {
            moveItem: {
              originalLocation: { index: itemIndex },
              newLocation: { index: args.newIndex },
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Item reordered successfully',
                itemId: args.itemId,
                fromIndex: itemIndex,
                toIndex: args.newIndex,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error reordering items:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to reorder items: ${error.message}`);
    }
  }

  private async updateQuestion(args: any) {
    if (!args.formId || !args.itemId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and item ID are required');
    }

    if (args.choices !== undefined && !Array.isArray(args.choices)) {
      throw new McpError(ErrorCode.InvalidParams, 'Choices must be an array of strings');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const items = form.data.items || [];
      const item = items.find((i: any) => i.itemId === args.itemId);

      if (!item) {
        throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);
      }

      const updateItem: any = { ...item };

      if (args.newTitle) {
        updateItem.title = args.newTitle;
      }

      const masks: string[] = [];

      if (args.newTitle) {
        masks.push('title');
      }

      if (item.questionItem && item.questionItem.question) {
        const question = { ...item.questionItem.question };

        if (args.required !== undefined) {
          question.required = args.required;
          masks.push('questionItem.question.required');
        }

        if (Array.isArray(args.choices) && question.choiceQuestion) {
          const choiceQuestion = { ...question.choiceQuestion };
          choiceQuestion.options = this.sanitizeOptions(args.choices);
          question.choiceQuestion = choiceQuestion;
          masks.push('questionItem.question.choiceQuestion.options');
        }

        updateItem.questionItem = { question };
      }

      if (masks.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'No fields to update');
      }

      const updateRequest = {
        requests: [
          {
            updateItem: {
              item: updateItem,
              location: {
                index: items.indexOf(item),
              },
              updateMask: masks.join(','),
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Question updated successfully',
                itemId: args.itemId,
                newTitle: args.newTitle,
                required: args.required,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error updating question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to update question: ${error.message}`);
    }
  }

  private async deleteQuestion(args: any) {
    if (!args.formId || !args.itemId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and item ID are required');
    }

    try {
      // Re-fetch form to get current item indices (indices shift after prior deletions)
      const form = await this.forms.forms.get({ formId: args.formId });
      const items = form.data.items || [];
      const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);

      if (itemIndex === -1) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Item with ID "${args.itemId}" not found in form. Use get_form_items to see valid item IDs.`
        );
      }

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: {
          requests: [
            {
              deleteItem: {
                location: {
                  index: itemIndex,
                },
              },
            },
          ],
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Question deleted successfully',
                itemId: args.itemId,
                deletedIndex: itemIndex,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error deleting question:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to delete question: ${error.message}`);
    }
  }

  private async setQuestionGrading(args: any) {
    if (!args.formId || !args.itemId || args.points === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and points are required');
    }

    if (!Number.isInteger(args.points) || args.points < 0) {
      throw new McpError(ErrorCode.InvalidParams, 'Points must be a non-negative integer');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });

      const isQuiz = form.data.settings?.quizSettings?.isQuiz === true;
      if (!isQuiz) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Form must have quiz mode enabled to set grading. Use update_form_settings with isQuiz: true first.'
        );
      }

      const items = form.data.items || [];
      const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);

      if (itemIndex === -1) {
        throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);
      }

      const item = items[itemIndex];
      if (!item.questionItem || !item.questionItem.question) {
        throw new McpError(ErrorCode.InvalidParams, `Item ${args.itemId} is not a question`);
      }

      const question = item.questionItem.question;
      const isChoiceQuestion = !!question.choiceQuestion;
      const isShortAnswer = !!question.textQuestion && !question.textQuestion.paragraph;
      const isParagraph = !!question.textQuestion && question.textQuestion.paragraph;

      if (!isChoiceQuestion && !isShortAnswer) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'This question type does not support grading. Only SHORT_ANSWER, RADIO, CHECKBOX, and DROPDOWN questions can be graded.'
        );
      }

      const grading: any = {
        pointValue: args.points,
      };

      if (args.correctAnswers && Array.isArray(args.correctAnswers)) {
        if (isParagraph) {
          throw new McpError(ErrorCode.InvalidParams, 'Paragraph questions do not support correctAnswers. Use generalFeedback instead.');
        }
        grading.correctAnswers = {
          answers: args.correctAnswers.map((a: any) => ({ value: a.value })),
        };
      }

      if (args.feedbackCorrect || args.feedbackIncorrect) {
        if (isShortAnswer) {
          grading.generalFeedback = {
            text: args.feedbackCorrect || args.feedbackIncorrect || '',
          };
        } else {
          if (args.feedbackCorrect) {
            grading.whenRight = { text: args.feedbackCorrect };
          }
          if (args.feedbackIncorrect) {
            grading.whenWrong = { text: args.feedbackIncorrect };
          }
        }
      }

      question.grading = grading;

      const updateRequest = {
        requests: [
          {
            updateItem: {
              item: {
                itemId: args.itemId,
                title: item.title,
                questionItem: { question },
              },
              location: { index: itemIndex },
              updateMask: 'questionItem.question.grading',
            },
          },
        ],
      };

      await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Question grading set successfully',
                itemId: args.itemId,
                points: args.points,
                correctAnswers: args.correctAnswers?.map((a: any) => a.value) || [],
                feedbackCorrect: args.feedbackCorrect || '',
                feedbackIncorrect: args.feedbackIncorrect || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error setting question grading:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to set question grading: ${error.message}`);
    }
  }

  private async getFormItems(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const response = await this.forms.forms.get({
        formId: args.formId,
      });

      const rawItems = response.data.items || [];
      let sectionNumber = 1;
      const sections: any[] = [{ section: 1, startIndex: 0 }];

      const items = rawItems.map((item: any, index: number) => {
        if (item.pageBreakItem) {
          sectionNumber++;
          sections.push({ section: sectionNumber, startIndex: index });
        }

        const result: any = {
          index,
          itemId: item.itemId,
          title: item.title,
          type: 'unknown',
          section: sectionNumber,
        };

        if (item.questionItem && item.questionItem.question) {
          const question = item.questionItem.question;
          if (question.textQuestion) {
            result.type = question.textQuestion.paragraph ? 'paragraph' : 'text';
          } else if (question.choiceQuestion) {
            result.type =
              question.choiceQuestion.type === 'RADIO'
                ? 'multiple_choice'
                : question.choiceQuestion.type === 'CHECKBOX'
                ? 'checkbox'
                : question.choiceQuestion.type === 'DROP_DOWN'
                ? 'dropdown'
                : question.choiceQuestion.type;
            if (question.choiceQuestion.options) {
              result.options = question.choiceQuestion.options.map((opt: any) => opt.value);
            }
          } else if (question.scaleQuestion) {
            result.type = 'linear_scale';
            result.scale = {
              low: question.scaleQuestion.low,
              high: question.scaleQuestion.high,
              lowLabel: question.scaleQuestion.lowLabel || '',
              highLabel: question.scaleQuestion.highLabel || '',
            };
          } else if (question.dateQuestion) {
            result.type = 'date';
            result.includeTime = question.dateQuestion.includeTime || false;
          } else if (question.timeQuestion) {
            result.type = 'time';
            result.duration = question.timeQuestion.duration || false;
          } else if (question.ratingQuestion) {
            result.type = 'rating';
            result.rating = {
              iconType: question.ratingQuestion.iconType || 'STAR',
              scaleLevel: question.ratingQuestion.ratingScaleLevel || 5,
            };
          } else if (question.fileUploadQuestion) {
            result.type = 'file_upload';
            result.fileUpload = {
              types: question.fileUploadQuestion.types || [],
              maxFileSize: question.fileUploadQuestion.maxFileSize || '10485760',
              maxFiles: question.fileUploadQuestion.maxFiles || 1,
            };
          }
          result.required = question.required || false;
          if (question.grading) {
            result.points = question.grading.pointValue;
            if (question.grading.correctAnswers) {
              result.correctAnswers =
                question.grading.correctAnswers.answers?.map((a: any) => a.value) || [];
            }
          }
        } else if (item.questionGroupItem) {
          result.type = 'question_group';
          if (item.questionGroupItem.grid) {
            result.gridType = item.questionGroupItem.grid.columns?.type || 'RADIO';
            result.columns =
              item.questionGroupItem.grid.columns?.options?.map((opt: any) => opt.value) || [];
            result.rows =
              item.questionGroupItem.questions?.map((q: any) => q.rowQuestion?.title) || [];
          }
        } else if (item.pageBreakItem) {
          result.type = 'page_break';
        } else if (item.textItem) {
          result.type = 'description';
          result.text = item.description || '';
        } else if (item.imageItem) {
          result.type = 'image';
          result.imageUrl = item.imageItem.image?.sourceUri || '';
        } else if (item.videoItem) {
          result.type = 'video';
          result.videoUrl = item.videoItem.video?.youtubeUri || '';
        }

        return result;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ totalSections: sectionNumber, sections, items }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error getting form items:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get form items: ${error.message}`);
    }
  }

  private async getFormResponses(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      let allResponses: any[] = [];
      let pageToken: string | undefined;
      do {
        const response = await this.forms.forms.responses.list({
          formId: args.formId,
          pageSize: 5000,
          pageToken,
        });
        allResponses = allResponses.concat(response.data.responses || []);
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ responses: allResponses, totalResponses: allResponses.length }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error getting form responses:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get form responses: ${error.message}`);
    }
  }

  private async getResponsesSheet(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const form = await this.forms.forms.get({ formId: args.formId });
      const linkedSheetId = form.data.linkedSheetId;

      if (!linkedSheetId) {
        return {
          content: [
            {
              type: 'text',
              text: 'No linked sheet found. Open the form responses tab in Google Forms and click "Link to Sheets" to create one.',
            },
          ],
        };
      }

      const sheetResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: linkedSheetId,
      });

      const values = sheetResponse.data.values || [];
      if (values.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  spreadsheetId: linkedSheetId,
                  headers: [],
                  responses: [],
                  message: 'No responses yet.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const headers = values[0];
      const rows = values.slice(1);

      const responses = rows.map((row: any[]) => {
        const rowObj: any = {};
        headers.forEach((header: string, i: number) => {
          rowObj[header] = row[i] || '';
        });
        return rowObj;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                spreadsheetId: linkedSheetId,
                headers,
                responses,
                totalResponses: responses.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error getting responses sheet:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get responses sheet: ${error.message}`);
    }
  }

  private async copyForm(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const formResponse = await this.forms.forms.get({ formId: args.formId });
      const form = formResponse.data;

      const newTitle = args.newTitle || `${form.info?.title || 'Untitled Form'} (Copy)`;
      const newForm: any = {
        info: {
          title: newTitle,
          documentTitle: newTitle,
          description: form.info?.description || '',
        },
      };

      const createResponse = await this.forms.forms.create({
        requestBody: newForm,
      });

      const newFormId = createResponse.data.formId;

      if (form.settings) {
        try {
          const settingsKeys = Object.keys(form.settings).filter(
            (k) => form.settings[k] !== null && form.settings[k] !== undefined
          );
          if (settingsKeys.length > 0) {
            const filteredSettings: any = {};
            settingsKeys.forEach((k) => { filteredSettings[k] = form.settings[k]; });
            await this.forms.forms.batchUpdate({
              formId: newFormId,
              requestBody: {
                requests: [
                  {
                    updateSettings: {
                      settings: filteredSettings,
                      updateMask: settingsKeys.join(','),
                    },
                  },
                ],
              },
            });
          }
        } catch (e) {
          console.error('Failed to copy form settings:', e);
        }
      }

      if (form.items && form.items.length > 0) {
        const createItemRequests = form.items.map((item: any, index: number) => {
          const { itemId, ...itemWithoutId } = item;
          if (itemWithoutId.questionItem?.question?.questionId) {
            delete itemWithoutId.questionItem.question.questionId;
          }
          return {
            createItem: {
              item: itemWithoutId,
              location: { index },
            },
          };
        });

        for (let i = 0; i < createItemRequests.length; i += 50) {
          const batch = createItemRequests.slice(i, i + 50);
          await this.forms.forms.batchUpdate({
            formId: newFormId,
            requestBody: { requests: batch },
          });
        }
      }

      const responderUri = `https://docs.google.com/forms/d/${newFormId}/viewform`;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Form copied successfully',
                originalFormId: args.formId,
                newFormId,
                title: newTitle,
                responderUri,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error copying form:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to copy form: ${error.message}`);
    }
  }

  private async deleteForm(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      await this.drive.files.delete({
        fileId: args.formId,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Form deleted successfully',
                formId: args.formId,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error deleting form:', error);
      const errorMessage = error.message || 'Unknown error';
      if (
        errorMessage.includes('drive') ||
        errorMessage.includes('Drive') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('disabled')
      ) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to delete form: Google Drive API is not enabled. Please enable the Google Drive API in your Google Cloud project console at https://console.cloud.google.com/apis/library/drive.googleapis.com`
        );
      }
      throw new McpError(ErrorCode.InternalError, `Failed to delete form: ${errorMessage}`);
    }
  }

  private async listForms(args: any) {
    try {
      const maxResults = Math.min(args.maxResults || 20, 100);
      let query = "mimeType='application/vnd.google-apps.form' and trashed=false";
      if (args.query) {
        const safeQuery = args.query.replace(/['"\\()]/g, '');
        query += ` and name contains '${safeQuery}'`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: maxResults,
      });

      const forms = (response.data.files || []).map((f: any) => ({
        formId: f.id,
        title: f.name,
        created: f.createdTime,
        modified: f.modifiedTime,
        editUrl: f.webViewLink,
      }));

      if (forms.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ message: 'No forms found', forms: [] }, null, 2) }],
        };
      }

      // Get response counts for each form (batched to avoid rate limits)
      const formsWithCounts: any[] = [];
      for (let i = 0; i < forms.length; i += 5) {
        const batch = forms.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (f: any) => {
            let count = 0;
            let pageToken: string | undefined;
            do {
              const responses = await this.forms.forms.responses.list({
                formId: f.formId,
                pageSize: 5000,
                pageToken,
              });
              count += (responses.data.responses || []).length;
              pageToken = responses.data.nextPageToken ?? undefined;
            } while (pageToken);
            return { ...f, responseCount: count };
          })
        );
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            formsWithCounts.push(r.value);
          } else {
            formsWithCounts.push({ ...batch[idx], responseCount: null });
          }
        });
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ total: formsWithCounts.length, forms: formsWithCounts }, null, 2) }],
      };
    } catch (error: any) {
      console.error('Error listing forms:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to list forms: ${error.message}`);
    }
  }

  private async getFormResponsesAnalytics(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      // Get form structure for question metadata
      const formResponse = await this.forms.forms.get({ formId: args.formId });
      const form = formResponse.data;
      const items = form.items || [];

      // Build question map: itemId -> question info
      const questionMap: Record<string, any> = {};
      items.forEach((item: any, index: number) => {
        if (item.questionItem?.question) {
          const q = item.questionItem.question;
          const info: any = {
            index,
            itemId: item.itemId,
            title: item.title || `Question ${index + 1}`,
            type: 'unknown',
          };

          if (q.textQuestion) {
            info.type = q.textQuestion.paragraph ? 'paragraph' : 'text';
          } else if (q.choiceQuestion) {
            info.type = q.choiceQuestion.type === 'RADIO' ? 'multiple_choice' :
                        q.choiceQuestion.type === 'CHECKBOX' ? 'checkbox' :
                        q.choiceQuestion.type === 'DROP_DOWN' ? 'dropdown' : q.choiceQuestion.type;
            info.options = q.choiceQuestion.options?.map((o: any) => o.value) || [];
          } else if (q.scaleQuestion) {
            info.type = 'linear_scale';
            info.low = q.scaleQuestion.low;
            info.high = q.scaleQuestion.high;
          } else if (q.dateQuestion) {
            info.type = 'date';
          } else if (q.timeQuestion) {
            info.type = 'time';
          } else if (q.ratingQuestion) {
            info.type = 'rating';
          } else if (q.fileUploadQuestion) {
            info.type = 'file_upload';
          }

          if (q.grading) {
            info.isGraded = true;
            info.points = q.grading.pointValue;
            info.correctAnswers = q.grading.correctAnswers?.answers?.map((a: any) => a.value) || [];
          }

          questionMap[item.itemId] = info;
        }
      });

      // Get all responses with pagination
      let rawResponses: any[] = [];
      let pageToken: string | undefined;
      do {
        const page = await this.forms.forms.responses.list({
          formId: args.formId,
          pageSize: 5000,
          pageToken,
        });
        rawResponses = rawResponses.concat(page.data.responses || []);
        pageToken = page.data.nextPageToken ?? undefined;
      } while (pageToken);

      // Also try to get data from linked sheet
      let sheetData: any[][] | null = null;
      if (form.linkedSheetId) {
        try {
          const sheetResp = await this.sheets.spreadsheets.values.get({
            spreadsheetId: form.linkedSheetId,
          });
          sheetData = sheetResp.data.values || null;
        } catch {
          // Sheet not accessible, continue with API data
        }
      }

      // Process responses into structured format
      const questionIds = Object.keys(questionMap);
      const processedResponses = rawResponses.map((response: any) => {
        const respondent: any = {
          responseId: response.responseId,
          submittedAt: response.createTime,
          lastSubmittedAt: response.lastSubmittedTime,
          answers: {},
        };

        // Map answers to question titles
        if (response.answers) {
          for (const [qId, answer] of Object.entries(response.answers)) {
            const qInfo = questionMap[qId];
            if (qInfo) {
              const answerData: any = {
                questionTitle: qInfo.title,
                questionType: qInfo.type,
                questionIndex: qInfo.index,
              };

              const a = answer as any;
              if (a.textAnswers?.answers) {
                answerData.values = a.textAnswers.answers.map((ans: any) => ans.value);
              }
              if (a.grade) {
                answerData.points = a.grade.score;
                answerData.maxPoints = a.grade.maxPoints;
                answerData.isCorrect = a.grade.correct;
              }

              respondent.answers[qInfo.title] = answerData;
            }
          }
        }

        // Extract respondent email if collected
        if (response.respondentEmail) {
          respondent.email = response.respondentEmail;
        }

        return respondent;
      });

      // Build analytics summary
      const summary: any = {
        formId: args.formId,
        title: form.info?.title || 'Untitled',
        totalResponses: processedResponses.length,
        questions: Object.values(questionMap),
        responses: processedResponses,
      };

      // If we have sheet data, include raw rows for additional analysis
      if (sheetData && sheetData.length > 0) {
        summary.sheetHeaders = sheetData[0];
        summary.sheetRows = sheetData.slice(1).map((row: any[]) => {
          const obj: Record<string, any> = {};
          sheetData![0].forEach((header: string, i: number) => {
            obj[header] = row[i] || '';
          });
          return obj;
        });
      }

      // Calculate scores for graded forms
      const gradedResponses = processedResponses.filter((r: any) =>
        Object.values(r.answers).some((a: any) => (a as any).points !== undefined)
      );

      if (gradedResponses.length > 0) {
        const scores = gradedResponses.map((r: any) => {
          let totalScore = 0;
          let totalMax = 0;
          const questionScores: any[] = [];

          for (const [title, answer] of Object.entries(r.answers)) {
            const a = answer as any;
            if (a.points !== undefined) {
              totalScore += a.points;
              totalMax += a.maxPoints || 0;
              questionScores.push({
                question: title,
                score: a.points,
                maxScore: a.maxPoints,
                isCorrect: a.isCorrect,
              });
            }
          }

          return {
            responseId: r.responseId,
            email: r.email,
            submittedAt: r.submittedAt,
            totalScore,
            totalMax,
            percentage: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
            questionScores,
          };
        }).sort((a: any, b: any) => a.totalScore - b.totalScore);

        summary.scoreboard = scores;
        summary.statistics = {
          averageScore: Math.round(scores.reduce((s: number, r: any) => s + r.totalScore, 0) / scores.length),
          highestScore: scores[scores.length - 1]?.totalScore || 0,
          lowestScore: scores[0]?.totalScore || 0,
          averagePercentage: Math.round(scores.reduce((s: number, r: any) => s + r.percentage, 0) / scores.length),
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    } catch (error: any) {
      console.error('Error getting form responses analytics:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get form responses analytics: ${error.message}`);
    }
  }

  private async shareForm(args: any) {
    if (!args.formId || !args.emailAddresses || !Array.isArray(args.emailAddresses) || args.emailAddresses.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID and at least one email address are required');
    }

    try {
      const role = args.role || 'reader';
      const sendEmail = args.sendEmail !== undefined ? args.sendEmail : true;

      const results = await Promise.all(
        args.emailAddresses.map(async (email: string) => {
          try {
            const permission = await this.drive.permissions.create({
              fileId: args.formId,
              requestBody: {
                type: 'user',
                role,
                emailAddress: email,
              },
              sendNotificationEmail: sendEmail,
              emailMessage: args.message || undefined,
              fields: 'id, type, role, emailAddress',
            });
            return { email, success: true, permissionId: permission.data.id };
          } catch (e: any) {
            return { email, success: false, error: e.message };
          }
        })
      );

      const succeeded = results.filter((r: any) => r.success);
      const failed = results.filter((r: any) => !r.success);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: failed.length === 0,
                message: `Shared with ${succeeded.length} of ${args.emailAddresses.length} users`,
                role,
                sentEmailNotifications: sendEmail,
                succeeded: succeeded.map((r: any) => r.email),
                failed: failed.map((r: any) => ({ email: r.email, error: r.error })),
                formUrl: `https://docs.google.com/forms/d/${args.formId}/edit`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error sharing form:', error);
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('disabled') || errorMessage.includes('permission')) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to share form: Google Drive API is not enabled. Please enable it at https://console.cloud.google.com/apis/library/drive.googleapis.com`
        );
      }
      throw new McpError(ErrorCode.InternalError, `Failed to share form: ${errorMessage}`);
    }
  }

  // --- Google Sheets Methods ---

  private async createSpreadsheet(args: any) {
    if (!args.title) {
      throw new McpError(ErrorCode.InvalidParams, 'Title is required');
    }
    try {
      const requestBody: any = {
        properties: { title: args.title },
      };
      if (args.sheetName) {
        requestBody.sheets = [{ properties: { title: args.sheetName } }];
      }
      const response = await this.sheets.spreadsheets.create({ requestBody });
      const spreadsheet = response.data;

      if (args.folderId) {
        await this.drive.files.update({
          fileId: spreadsheet.spreadsheetId,
          addParents: args.folderId,
          removeParents: 'root',
          fields: 'id, parents',
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            spreadsheetId: spreadsheet.spreadsheetId,
            spreadsheetUrl: spreadsheet.spreadsheetUrl,
            title: spreadsheet.properties?.title,
            sheets: spreadsheet.sheets?.map((s: any) => ({
              sheetId: s.properties?.sheetId,
              title: s.properties?.title,
            })),
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error creating spreadsheet:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to create spreadsheet: ${error.message}`);
    }
  }

  private async deleteSpreadsheet(args: any) {
    if (!args.spreadsheetId) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID is required');
    }
    try {
      await this.drive.files.delete({ fileId: args.spreadsheetId });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Spreadsheet deleted successfully',
            spreadsheetId: args.spreadsheetId,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error deleting spreadsheet:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to delete spreadsheet: ${error.message}`);
    }
  }

  private async getSpreadsheet(args: any) {
    if (!args.spreadsheetId) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID is required');
    }
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: args.spreadsheetId,
        fields: 'spreadsheetId,spreadsheetUrl,properties.title,properties.locale,properties.timeZone,sheets.properties',
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error getting spreadsheet:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to get spreadsheet: ${error.message}`);
    }
  }

  private async listSpreadsheets(args: any) {
    try {
      const maxResults = Math.min(args.maxResults || 20, 100);
      let query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
      if (args.query) {
        const safeQuery = args.query.replace(/['"\\()]/g, '');
        query += ` and name contains '${safeQuery}'`;
      }
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: maxResults,
      });
      const spreadsheets = (response.data.files || []).map((f: any) => ({
        spreadsheetId: f.id,
        title: f.name,
        created: f.createdTime,
        modified: f.modifiedTime,
        url: f.webViewLink,
      }));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ spreadsheets, total: spreadsheets.length }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error listing spreadsheets:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to list spreadsheets: ${error.message}`);
    }
  }

  private async addSheet(args: any) {
    if (!args.spreadsheetId || !args.title) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID and title are required');
    }
    try {
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: args.spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: args.title } } }],
        },
      });
      const props = response.data.replies[0].addSheet.properties;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            sheetId: props.sheetId,
            title: props.title,
            index: props.index,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error adding sheet:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to add sheet: ${error.message}`);
    }
  }

  private async deleteSheet(args: any) {
    if (!args.spreadsheetId || args.sheetId === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID and sheet ID are required');
    }
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: args.spreadsheetId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId: args.sheetId } }],
        },
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Sheet deleted successfully',
            spreadsheetId: args.spreadsheetId,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error deleting sheet:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to delete sheet: ${error.message}`);
    }
  }

  private async renameSheet(args: any) {
    if (!args.spreadsheetId || args.sheetId === undefined || !args.newTitle) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID, sheet ID, and new title are required');
    }
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: args.spreadsheetId,
        requestBody: {
          requests: [{ updateSheet: { properties: { sheetId: args.sheetId, title: args.newTitle } } }],
        },
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Sheet renamed to "${args.newTitle}"`,
            spreadsheetId: args.spreadsheetId,
            sheetId: args.sheetId,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error renaming sheet:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to rename sheet: ${error.message}`);
    }
  }

  private async listSheets(args: any) {
    if (!args.spreadsheetId) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID is required');
    }
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: args.spreadsheetId,
        fields: 'sheets.properties',
      });
      const sheets = (response.data.sheets || []).map((s: any) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title,
        index: s.properties?.index,
        sheetType: s.properties?.sheetType,
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount,
      }));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ sheets, totalSheets: sheets.length }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error listing sheets:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to list sheets: ${error.message}`);
    }
  }

  private async readRange(args: any) {
    if (!args.spreadsheetId || !args.range) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID and range are required');
    }
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueRenderOption: args.valueRenderOption || 'FORMATTED_VALUE',
      });
      const values = response.data.values || [];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            range: response.data.range,
            values,
            rowCount: values.length,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error reading range:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to read range: ${error.message}`);
    }
  }

  private async writeRange(args: any) {
    if (!args.spreadsheetId || !args.range || !args.values) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID, range, and values are required');
    }
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueInputOption: args.valueInputOption || 'USER_ENTERED',
        requestBody: { values: args.values },
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            updatedRange: response.data.updatedRange,
            updatedRows: response.data.updatedRows,
            updatedColumns: response.data.updatedColumns,
            updatedCells: response.data.updatedCells,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error writing range:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to write range: ${error.message}`);
    }
  }

  private async appendRows(args: any) {
    if (!args.spreadsheetId || !args.range || !args.values) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID, range, and values are required');
    }
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueInputOption: args.valueInputOption || 'USER_ENTERED',
        insertDataOption: args.insertDataOption || 'INSERT_ROWS',
        requestBody: { values: args.values },
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            updatedRange: response.data.updates?.updatedRange,
            updatedRows: response.data.updates?.updatedRows,
            updatedCells: response.data.updates?.updatedCells,
            tableRange: response.data.tableRange,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error appending rows:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to append rows: ${error.message}`);
    }
  }

  private async clearRange(args: any) {
    if (!args.spreadsheetId || !args.range) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID and range are required');
    }
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Cleared range ${args.range}`,
            spreadsheetId: args.spreadsheetId,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error clearing range:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to clear range: ${error.message}`);
    }
  }

  private parseColor(hex: string): { red: number; green: number; blue: number } {
    const h = hex.replace('#', '');
    return {
      red: parseInt(h.substring(0, 2), 16) / 255,
      green: parseInt(h.substring(2, 4), 16) / 255,
      blue: parseInt(h.substring(4, 6), 16) / 255,
    };
  }

  private async formatCells(args: any) {
    if (!args.spreadsheetId || args.sheetId === undefined || !args.startRow || !args.endRow || !args.startColumn || !args.endColumn) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID, sheetId, startRow, endRow, startColumn, and endColumn are required');
    }
    try {
      const userEnteredFormat: any = {};
      const fields: string[] = [];

      if (args.bold !== undefined || args.fontSize || args.fontFamily || args.foregroundColor) {
        const textFormat: any = {};
        if (args.bold !== undefined) textFormat.bold = args.bold;
        if (args.fontSize) textFormat.fontSize = args.fontSize;
        if (args.fontFamily) textFormat.fontFamily = args.fontFamily;
        if (args.foregroundColor) textFormat.foregroundColor = this.parseColor(args.foregroundColor);
        userEnteredFormat.textFormat = textFormat;
        fields.push('textFormat');
      }
      if (args.backgroundColor) {
        userEnteredFormat.backgroundColor = this.parseColor(args.backgroundColor);
        fields.push('backgroundColor');
      }
      if (args.horizontalAlignment) {
        userEnteredFormat.horizontalAlignment = args.horizontalAlignment;
        fields.push('horizontalAlignment');
      }
      if (args.wrapStrategy) {
        userEnteredFormat.wrapStrategy = args.wrapStrategy;
        fields.push('wrapStrategy');
      }

      if (fields.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'At least one formatting option is required (bold, fontSize, fontFamily, foregroundColor, backgroundColor, horizontalAlignment, wrapStrategy)');
      }

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: args.spreadsheetId,
        requestBody: {
          requests: [{
            repeatCell: {
              range: {
                sheetId: args.sheetId,
                startRowIndex: args.startRow - 1,
                endRowIndex: args.endRow,
                startColumnIndex: args.startColumn - 1,
                endColumnIndex: args.endColumn,
              },
              cell: { userEnteredFormat },
              fields: fields.join(','),
            },
          }],
        },
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Cells formatted successfully',
            spreadsheetId: args.spreadsheetId,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error formatting cells:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to format cells: ${error.message}`);
    }
  }

  private async mergeCells(args: any) {
    if (!args.spreadsheetId || args.sheetId === undefined || !args.startRow || !args.endRow || !args.startColumn || !args.endColumn) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID, sheetId, startRow, endRow, startColumn, and endColumn are required');
    }
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: args.spreadsheetId,
        requestBody: {
          requests: [{
            mergeCells: {
              range: {
                sheetId: args.sheetId,
                startRowIndex: args.startRow - 1,
                endRowIndex: args.endRow,
                startColumnIndex: args.startColumn - 1,
                endColumnIndex: args.endColumn,
              },
              mergeType: args.mergeType || 'MERGE_ALL',
            },
          }],
        },
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Cells merged (${args.mergeType || 'MERGE_ALL'})`,
            spreadsheetId: args.spreadsheetId,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error merging cells:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to merge cells: ${error.message}`);
    }
  }

  private async runFormula(args: any) {
    if (!args.spreadsheetId || !args.range || !args.formula) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID, range, and formula are required');
    }
    try {
      // Write the formula to the helper cell
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[args.formula]] },
      });

      // Read back the computed result from that cell
      const result = await this.sheets.spreadsheets.values.get({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const values = result.data.values || [];

      // Now read the full results — formula might spill into adjacent cells
      // Parse the target cell to determine the full spill range
      const sheetMatch = args.range.match(/^([A-Za-z0-9_]+)!/);
      const cellMatch = args.range.match(/!([A-Z]+)(\d+)$/i);
      if (!cellMatch) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              formula: args.formula,
              result: values,
              rowCount: values.length,
            }, null, 2),
          }],
        };
      }

      const startCol = cellMatch[1].toUpperCase();
      const startRow = parseInt(cellMatch[2]);
      const sheetPrefix = sheetMatch ? sheetMatch[1] + '!' : '';

      // Try reading a large range to capture spill results (max 100 rows x 26 cols)
      const spillRange = `${sheetPrefix}${startCol}${startRow}:${startCol}200`;
      try {
        const spillResult = await this.sheets.spreadsheets.values.get({
          spreadsheetId: args.spreadsheetId,
          range: spillRange,
          valueRenderOption: 'FORMATTED_VALUE',
        });
        const spillValues = (spillResult.data.values || []).filter((row: any[]) => row.some((cell: any) => cell !== ''));

        if (spillValues.length > 0) {
          // Clean up the helper cell after reading
          try {
            await this.sheets.spreadsheets.values.clear({
              spreadsheetId: args.spreadsheetId,
              range: args.range,
            });
          } catch { /* ignore cleanup errors */ }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                formula: args.formula,
                values: spillValues,
                rowCount: spillValues.length,
                columnCount: spillValues[0]?.length || 0,
              }, null, 2),
            }],
          };
        }
      } catch { /* spill range read failed, fall through to single cell result */ }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            formula: args.formula,
            result: values,
            rowCount: values.length,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      console.error('Error running formula:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to run formula: ${error.message}`);
    }
  }

  private async filterSheet(args: any) {
    if (!args.spreadsheetId) {
      throw new McpError(ErrorCode.InvalidParams, 'Spreadsheet ID is required');
    }
    try {
      // Determine the data range — if not specified, read everything first
      let dataRange = args.dataRange;
      let sheetName = args.sheetName || '';
      let allValues: any[][] = [];

      if (!dataRange) {
        // Read the entire sheet to determine dimensions
        const readResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: args.spreadsheetId,
          range: sheetName ? `${sheetName}!A:ZZ` : 'A:ZZ',
          valueRenderOption: 'FORMATTED_VALUE',
        });
        allValues = readResponse.data.values || [];
        if (allValues.length === 0) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ message: 'Sheet is empty', values: [] }, null, 2) }],
          };
        }
        dataRange = `A1:ZZ${allValues.length}`;
      }

      // Build the FILTER formula from conditions
      if (!args.filters || !Array.isArray(args.filters) || args.filters.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'At least one filter condition is required');
      }

      // Determine the full data range (with headers in row 1)
      // Use data starting from row 2 if we have headers
      const rangePrefix = sheetName ? `${sheetName}!` : '';

      // Build column references — determine how many columns the data has
      const numCols = allValues.length > 0 ? Math.max(...allValues.map((r: any[]) => r.length)) : 26;
      const lastCol = String.fromCharCode(64 + Math.min(numCols, 26)); // A-Z

      // Build FILTER conditions
      const filterConditions: string[] = [];
      for (const filter of args.filters) {
        const colLetter = String.fromCharCode(64 + filter.column);
        const colRef = `${colLetter}2:${colLetter}`;
        const val = filter.value.replace(/"/g, '\\"');

        switch (filter.condition) {
          case 'equals':
            filterConditions.push(`${colRef}="${val}"`);
            break;
          case 'not_equals':
            filterConditions.push(`${colRef}<>"${val}"`);
            break;
          case 'contains':
            filterConditions.push(`REGEXMATCH(${colRef}, "${val}")`);
            break;
          case 'starts_with':
            filterConditions.push(`REGEXMATCH(${colRef}, "^${val}")`);
            break;
          case 'ends_with':
            filterConditions.push(`REGEXMATCH(${colRef}, "${val}$")`);
            break;
          case 'greater_than':
            filterConditions.push(`${colRef}>${val}`);
            break;
          case 'less_than':
            filterConditions.push(`${colRef}<${val}`);
            break;
          case 'is_empty':
            filterConditions.push(`${colRef}=""`);
            break;
          case 'not_empty':
            filterConditions.push(`${colRef}<>""`);
            break;
          default:
            throw new McpError(ErrorCode.InvalidParams, `Unknown condition type: ${filter.condition}. Valid types: equals, contains, not_equals, greater_than, less_than, is_empty, not_empty, starts_with, ends_with`);
        }
      }

      const dataStartRange = `${rangePrefix}A1:${lastCol}`;
      const filterFormula = `=FILTER(${dataStartRange}, ${filterConditions.join(', ')})`;

      // Use a helper cell in a far-away column to avoid overwriting data
      const helperCell = `${rangePrefix}AA1`;

      // Write and execute formula
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: args.spreadsheetId,
        range: helperCell,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[filterFormula]] },
      });

      // Read the results (spill range)
      const resultRange = `${rangePrefix}AA1:AZ200`;
      const result = await this.sheets.spreadsheets.values.get({
        spreadsheetId: args.spreadsheetId,
        range: resultRange,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      const resultValues = (result.data.values || []).filter((row: any[]) => row.some((cell: any) => cell !== ''));

      // Clean up helper cell
      try {
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId: args.spreadsheetId,
          range: helperCell,
        });
      } catch { /* ignore cleanup errors */ }

      // Also read headers if we have data
      let headers: string[] = [];
      if (allValues.length > 0) {
        headers = allValues[0].map((h: any) => String(h || ''));
      } else if (resultValues.length > 0) {
        // Read the header row from the original data range
        try {
          const headerResult = await this.sheets.spreadsheets.values.get({
            spreadsheetId: args.spreadsheetId,
            range: `${rangePrefix}A1:${lastCol}1`,
            valueRenderOption: 'FORMATTED_VALUE',
          });
          headers = (headerResult.data.values?.[0] || []).map((h: any) => String(h || ''));
        } catch { /* ignore */ }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            formula: filterFormula,
            headers,
            values: resultValues,
            matchCount: resultValues.length,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      if (error instanceof McpError) throw error;
      console.error('Error filtering sheet:', error);
      throw new McpError(ErrorCode.InternalError, `Failed to filter sheet: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Forms MCP server running on stdio');
  }
}

(async () => {
  try {
    if (!checkScopesValid()) {
      console.error('Token scopes are outdated. Starting re-authentication...');
      deleteTokens();
    }
    const token = await authenticate();
    const server = new GoogleFormsServer(token);
    await server.run();
  } catch (err) {
    console.error('Authentication failed:', err);
    process.exit(1);
  }
})();
