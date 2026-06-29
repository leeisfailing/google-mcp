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

// Service module imports
import * as formsService from './services/forms.js';
import * as sheetsService from './services/sheets.js';
import * as driveService from './services/drive.js';
import * as calendarService from './services/calendar.js';
import * as docsService from './services/docs.js';
import * as slidesService from './services/slides.js';
import * as classroomService from './services/classroom.js';
import * as meetService from './services/meet.js';
import * as labelsService from './services/labels.js';
import * as gmailService from './services/gmail.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const SCOPES = [
  // Forms
  'https://www.googleapis.com/auth/forms',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  // Drive
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.labels',
  'https://www.googleapis.com/auth/drive.labels.readonly',
  // Sheets
  'https://www.googleapis.com/auth/spreadsheets',
  // Docs
  'https://www.googleapis.com/auth/documents',
  // Calendar
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  // Slides
  'https://www.googleapis.com/auth/presentations',
  // Classroom
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.guardianlinks.students.readonly',
  // Meet
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  // Gmail
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
];

// ---------------------------------------------------------------------------
// Service module type
// ---------------------------------------------------------------------------
interface ServiceModule {
  getTools(): Array<{
    name: string;
    description: string;
    inputSchema: any;
  }>;
  executeTool(name: string, args: any, oauth2Client: any): Promise<any>;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

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

function saveTokens(tokens: {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
}) {
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
    console.error(
      `Could not open browser automatically. Please visit:\n${url}`
    );
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
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      REDIRECT_URI
    );
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) throw new Error('No URL in request');
        const parsedUrl = new URL(
          req.url,
          `http://${req.headers.host || 'localhost'}`
        );
        const code = parsedUrl.searchParams.get('code');

        if (code) {
          const { tokens } = await oauth2Client.getToken(code as string);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
          });
          res.end(
            '<html><body><h1>Authentication Successful!</h1><p>You can close this tab and the terminal. The server will work automatically from now on.</p></body></html>'
          );

          if (tokens.refresh_token) {
            saveTokens(tokens);
            console.error('\n=== SUCCESS ===');
            console.error('Refresh token saved to token.json');
            console.error(
              'You can close this terminal. The server will work automatically from now on.'
            );
            console.error('================\n');
            server.close();
            resolve(tokens.refresh_token);
          } else {
            saveTokens(tokens);
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
            });
            res.end(
              '<html><body><h1>Partial Success</h1><p>No refresh token received. You may need to re-authorize.</p></body></html>'
            );
            server.close();
            resolve(tokens.access_token || '');
          }
        } else {
          res.writeHead(400, {
            'Content-Type': 'text/html; charset=utf-8',
          });
          res.end(
            '<html><body><h1>Error: No auth code received</h1></body></html>'
          );
        }
      } catch (e: any) {
        res.writeHead(500, {
          'Content-Type': 'text/html; charset=utf-8',
        });
        res.end(
          `<html><body><h1>Error</h1><p>${e.message?.replace(/</g, '&lt;')}</p></body></html>`
        );
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

// ---------------------------------------------------------------------------
// GoogleMCPServer
// ---------------------------------------------------------------------------

const { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } =
  loadCredentials();

class GoogleMCPServer {
  private server: Server;
  private oauth2Client: any;

  // Google API service clients
  private forms: any;
  private sheets: any;
  private drive: any;
  private calendar: any;
  private docs: any;
  private slides: any;
  private classroom: any;

  // Service modules for tool dispatch
  private services: ServiceModule[] = [];

  // Tool name -> service module lookup
  private toolRegistry: Map<
    string,
    ServiceModule
  > = new Map();

  // Re-auth tracking
  private reauthAttempts = 0;
  private static readonly MAX_REAUTH_ATTEMPTS = 3;

  constructor(refreshToken: string) {
    // MCP Server
    this.server = new Server(
      {
        name: 'google-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET
    );
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Persist refreshed tokens
    this.oauth2Client.on('tokens', (tokens: any) => {
      try {
        saveTokens(tokens);
      } catch (e) {
        console.error('Failed to save tokens:', e);
      }
    });

    // Initialise all Google API service clients
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

    this.calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });

    this.docs = google.docs({
      version: 'v1',
      auth: this.oauth2Client,
    });

    this.slides = google.slides({
      version: 'v1',
      auth: this.oauth2Client,
    });

    this.classroom = google.classroom({
      version: 'v1',
      auth: this.oauth2Client,
    });

    // Register service modules
    this.services = [
      formsService,
      sheetsService,
      driveService,
      calendarService,
      docsService,
      slidesService,
      classroomService,
      meetService,
      labelsService,
      gmailService,
    ];

    // Build the tool -> service registry
    this.buildToolRegistry();

    // Wire up MCP handlers
    this.setupToolHandlers();

    // Error / shutdown handling
    this.server.onerror = (error: Error) =>
      console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  // ---------------------------------------------------------------------------
  // Tool registry
  // ---------------------------------------------------------------------------

  private buildToolRegistry() {
    this.toolRegistry.clear();
    for (const service of this.services) {
      for (const tool of service.getTools()) {
        this.toolRegistry.set(tool.name, service);
      }
    }
    console.error(
      `Registered ${this.toolRegistry.size} tools from ${this.services.length} service modules`
    );
  }

  // ---------------------------------------------------------------------------
  // MCP handlers
  // ---------------------------------------------------------------------------

  private setupToolHandlers() {
    // ListTools -- merge all tool definitions from every service
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = this.services.flatMap((s) => s.getTools());
      return { tools: allTools };
    });

    // CallTool -- dispatch to the correct service
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: any) => {
        try {
          return await this.executeTool(
            request.params.name,
            request.params.arguments
          );
        } catch (error: any) {
          // ----- Re-auth on invalid / expired grant -----
          if (
            error.message?.includes('invalid_grant') ||
            error.message?.includes('Token has been expired or revoked')
          ) {
            if (
              this.reauthAttempts >=
              GoogleMCPServer.MAX_REAUTH_ATTEMPTS
            ) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Re-authentication failed after ${GoogleMCPServer.MAX_REAUTH_ATTEMPTS} attempts. Please delete token.json manually and restart the server.`,
                  },
                ],
                isError: true,
              };
            }
            this.reauthAttempts++;
            console.error(
              `Refresh token invalid. Starting re-authentication (attempt ${this.reauthAttempts}/${GoogleMCPServer.MAX_REAUTH_ATTEMPTS})...`
            );
            try {
              deleteTokens();
              const newToken = await authenticate(true);
              this.reauthAttempts = 0;
              this.oauth2Client.setCredentials({
                refresh_token: newToken,
              });
              return await this.executeTool(
                request.params.name,
                request.params.arguments
              );
            } catch (reauthError: any) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Re-authentication failed: ${reauthError.message}`,
                  },
                ],
                isError: true,
              };
            }
          }

          // ----- Known MCP errors -----
          if (error instanceof McpError) {
            return {
              content: [
                { type: 'text', text: `Error: ${error.message}` },
              ],
              isError: true,
            };
          }

          // ----- Catch-all -----
          console.error('Error in tool execution:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error.message || 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Tool execution
  // ---------------------------------------------------------------------------

  private async executeTool(name: string, args: any) {
    // Normalize: accept `title` as alias for `questionTitle` on question tools
    if (
      args?.title &&
      !args.questionTitle &&
      name.startsWith('add_') &&
      name !== 'add_page_break' &&
      name !== 'add_section_header' &&
      name !== 'add_title_description' &&
      name !== 'add_image' &&
      name !== 'add_video'
    ) {
      args = { ...args, questionTitle: args.title };
    }
    const service = this.toolRegistry.get(name);
    if (!service) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
    }
    return await service.executeTool(name, args, this.oauth2Client);
  }

  // ---------------------------------------------------------------------------
  // Run
  // ---------------------------------------------------------------------------

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google MCP server running on stdio');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  try {
    if (!checkScopesValid()) {
      console.error(
        'Token scopes are outdated. Starting re-authentication...'
      );
      deleteTokens();
    }
    const token = await authenticate();
    const server = new GoogleMCPServer(token);
    await server.run();
  } catch (err) {
    console.error('Authentication failed:', err);
    process.exit(1);
  }
})();
