// Google Docs API scopes:
//   - https://www.googleapis.com/auth/documents
//   - https://www.googleapis.com/auth/drive (for creating files)

import { google } from 'googleapis';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// ---------------------------------------------------------------------------
// ToolDefinition interface
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(data: any) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace(/^#/, '');
  return {
    red: parseInt(h.substring(0, 2), 16) / 255,
    green: parseInt(h.substring(2, 4), 16) / 255,
    blue: parseInt(h.substring(4, 6), 16) / 255,
  };
}

function parseDocColor(color: any): any {
  if (!color) return { color: { rgbColor: { red: 0, green: 0, blue: 0 } } };
  if (typeof color === 'string') {
    if (color.startsWith('#')) {
      return { color: { rgbColor: hexToRgb(color) } };
    }
    // Named colors - treat as theme color
    return { color: { themeColor: color } };
  }
  if (color.rgbColor) return { color: { rgbColor: color.rgbColor } };
  if (color.themeColor) return { color: { themeColor: color.themeColor } };
  return { color: { rgbColor: { red: 0, green: 0, blue: 0 } } };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export function getTools(): ToolDefinition[] {
  return [
    // === Document Operations ===
    {
      name: 'docs_create_document',
      description: 'Create a new Google Docs document with a title. Also creates a corresponding file in Google Drive.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Document title' },
          folderId: { type: 'string', description: 'Optional Google Drive folder ID to create the document in' },
        },
        required: ['title'],
      },
    },
    {
      name: 'docs_get_document',
      description: 'Get the full structure of a Google Docs document including body content, styles, and all structural elements.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'docs_get_document_plain_text',
      description: 'Get the document content as plain text only, without structural details.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'docs_delete_document',
      description: 'Delete a Google Docs document (moves to trash via Drive API).',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID to delete' },
        },
        required: ['documentId'],
      },
    },

    // === Content Manipulation ===
    {
      name: 'docs_insert_text',
      description: 'Insert text at a specific index in the document. Index 0 is the start of the document body. Use endOfSegmentLocation for inserting at the end.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          text: { type: 'string', description: 'Text to insert' },
          index: { type: 'number', description: 'Character index to insert at (0-based). Omit to insert at end of document.' },
          segmentId: { type: 'string', description: 'Segment ID for headers/footers. Empty string "" for main body (default).' },
        },
        required: ['documentId', 'text'],
      },
    },
    {
      name: 'docs_insert_paragraph',
      description: 'Insert a new paragraph with text and optional styling at a specific index.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          text: { type: 'string', description: 'Paragraph text content' },
          index: { type: 'number', description: 'Character index to insert at (0-based). Omit to insert at end.' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
          namedStyleType: { type: 'string', description: 'Named style: NORMAL_TEXT, HEADING_1, HEADING_2, HEADING_3, HEADING_4, HEADING_5, HEADING_6, TITLE, SUBTITLE' },
          alignment: { type: 'string', description: 'Alignment: START, CENTER, END, JUSTIFY' },
          lineSpacing: { type: 'number', description: 'Line spacing as a percentage (e.g. 150 for 1.5x spacing)' },
          spaceAbove: { type: 'number', description: 'Space above paragraph in points' },
          spaceBelow: { type: 'number', description: 'Space below paragraph in points' },
          indentStart: { type: 'number', description: 'Indent from start in points' },
          indentFirstLine: { type: 'number', description: 'First line indent in points' },
        },
        required: ['documentId', 'text'],
      },
    },
    {
      name: 'docs_insert_page_break',
      description: 'Insert a page break at a specific index in the document.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          index: { type: 'number', description: 'Character index to insert at (0-based). Omit to insert at end.' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'docs_insert_table',
      description: 'Insert a table with specified rows and columns, optionally with cell content.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          rows: { type: 'number', description: 'Number of rows' },
          columns: { type: 'number', description: 'Number of columns' },
          index: { type: 'number', description: 'Character index to insert at (0-based). Omit to insert at end.' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
          cellContent: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'string' },
            },
            description: '2D array of cell content [rows][columns]. If not provided, empty cells are created.',
          },
        },
        required: ['documentId', 'rows', 'columns'],
      },
    },
    {
      name: 'docs_insert_image',
      description: 'Insert an image from a URL at a specific index in the document.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          imageUrl: { type: 'string', description: 'Public URL of the image to insert' },
          index: { type: 'number', description: 'Character index to insert at (0-based). Omit to insert at end.' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
          width: { type: 'number', description: 'Image width in points' },
          height: { type: 'number', description: 'Image height in points' },
        },
        required: ['documentId', 'imageUrl'],
      },
    },
    {
      name: 'docs_insert_bullet_list',
      description: 'Insert a bulleted list with one or more items at a specific index.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          items: { type: 'array', items: { type: 'string' }, description: 'List of bullet point text items' },
          index: { type: 'number', description: 'Character index to insert at (0-based). Omit to insert at end.' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
        },
        required: ['documentId', 'items'],
      },
    },
    {
      name: 'docs_insert_numbered_list',
      description: 'Insert a numbered (ordered) list with one or more items at a specific index.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          items: { type: 'array', items: { type: 'string' }, description: 'List of numbered list text items' },
          index: { type: 'number', description: 'Character index to insert at (0-based). Omit to insert at end.' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
        },
        required: ['documentId', 'items'],
      },
    },
    {
      name: 'docs_insert_named_range',
      description: 'Create a named range (bookmark) in the document spanning from startIndex to endIndex.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          name: { type: 'string', description: 'Name for the range/bookmark' },
          startIndex: { type: 'number', description: 'Start character index (0-based, inclusive)' },
          endIndex: { type: 'number', description: 'End character index (0-based, exclusive)' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
        },
        required: ['documentId', 'name', 'startIndex', 'endIndex'],
      },
    },

    // === Text Formatting ===
    {
      name: 'docs_update_paragraph_style',
      description: 'Update paragraph style for a range of text (heading level, alignment, indentation, spacing).',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          startIndex: { type: 'number', description: 'Start character index (0-based, inclusive)' },
          endIndex: { type: 'number', description: 'End character index (0-based, exclusive)' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
          namedStyleType: { type: 'string', description: 'Named style: NORMAL_TEXT, HEADING_1 through HEADING_6, TITLE, SUBTITLE' },
          alignment: { type: 'string', description: 'Alignment: START, CENTER, END, JUSTIFY' },
          lineSpacing: { type: 'number', description: 'Line spacing percentage (e.g. 150 for 1.5x)' },
          spaceAbove: { type: 'number', description: 'Space above in points' },
          spaceBelow: { type: 'number', description: 'Space below in points' },
          indentStart: { type: 'number', description: 'Indent from start in points' },
          indentEnd: { type: 'number', description: 'Indent from end in points' },
          indentFirstLine: { type: 'number', description: 'First line indent in points' },
          direction: { type: 'string', description: 'Text direction: LEFT_TO_RIGHT or RIGHT_TO_LEFT' },
        },
        required: ['documentId', 'startIndex', 'endIndex'],
      },
    },
    {
      name: 'docs_update_text_format',
      description: 'Apply text formatting (bold, italic, underline, strikethrough, font size, font family, color, etc.) to a range of text.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          startIndex: { type: 'number', description: 'Start character index (0-based, inclusive)' },
          endIndex: { type: 'number', description: 'End character index (0-based, exclusive)' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
          bold: { type: 'boolean', description: 'Set bold on/off' },
          italic: { type: 'boolean', description: 'Set italic on/off' },
          underline: { type: 'boolean', description: 'Set underline on/off' },
          strikethrough: { type: 'boolean', description: 'Set strikethrough on/off' },
          weightedFontFamily: { type: 'string', description: 'Font family name (e.g. "Arial", "Times New Roman")' },
          fontSize: { type: 'number', description: 'Font size in points' },
          foregroundColor: { type: 'string', description: 'Text color as hex (#FF0000)' },
          backgroundColor: { type: 'string', description: 'Highlight color as hex (#FFFF00)' },
          link: { type: 'string', description: 'URL to set as hyperlink, or empty string to remove' },
        },
        required: ['documentId', 'startIndex', 'endIndex'],
      },
    },
    {
      name: 'docs_delete_content_range',
      description: 'Delete content within a range of indices in the document.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          startIndex: { type: 'number', description: 'Start character index (0-based, inclusive)' },
          endIndex: { type: 'number', description: 'End character index (0-based, exclusive)' },
          segmentId: { type: 'string', description: 'Segment ID. Empty string "" for main body.' },
        },
        required: ['documentId', 'startIndex', 'endIndex'],
      },
    },
    {
      name: 'docs_merge_table_cells',
      description: 'Merge cells in a table. Provide the row and column range to merge (start inclusive, end exclusive).',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          tableStartIndex: { type: 'number', description: 'Start index of the table in the document' },
          rowStartIndex: { type: 'number', description: 'Start row index (0-based, inclusive)' },
          rowEndIndex: { type: 'number', description: 'End row index (0-based, exclusive)' },
          columnStartIndex: { type: 'number', description: 'Start column index (0-based, inclusive)' },
          columnEndIndex: { type: 'number', description: 'End column index (0-based, exclusive)' },
        },
        required: ['documentId', 'tableStartIndex', 'rowStartIndex', 'rowEndIndex', 'columnStartIndex', 'columnEndIndex'],
      },
    },
    {
      name: 'docs_unmerge_table_cells',
      description: 'Unmerge previously merged cells in a table.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          tableStartIndex: { type: 'number', description: 'Start index of the table in the document' },
          rowStartIndex: { type: 'number', description: 'Start row index (0-based, inclusive)' },
          rowEndIndex: { type: 'number', description: 'End row index (0-based, exclusive)' },
          columnStartIndex: { type: 'number', description: 'Start column index (0-based, inclusive)' },
          columnEndIndex: { type: 'number', description: 'End column index (0-based, exclusive)' },
        },
        required: ['documentId', 'tableStartIndex', 'rowStartIndex', 'rowEndIndex', 'columnStartIndex', 'columnEndIndex'],
      },
    },

    // === Navigation & Search ===
    {
      name: 'docs_find_and_replace',
      description: 'Find and replace text throughout the document with optional case sensitivity and regex support.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          findText: { type: 'string', description: 'Text to find' },
          replaceText: { type: 'string', description: 'Replacement text' },
          matchCase: { type: 'boolean', description: 'Case-sensitive search (default: false)' },
          matchEntireWord: { type: 'boolean', description: 'Match entire words only (default: false)' },
          useRegex: { type: 'boolean', description: 'Use regular expression for findText (default: false)' },
        },
        required: ['documentId', 'findText', 'replaceText'],
      },
    },
    {
      name: 'docs_replace_all_text',
      description: 'Simple replace all occurrences of text in the document.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          findText: { type: 'string', description: 'Text to find' },
          replaceText: { type: 'string', description: 'Replacement text' },
        },
        required: ['documentId', 'findText', 'replaceText'],
      },
    },

    // === Export ===
    {
      name: 'docs_export_document',
      description: 'Export a Google Docs document to various formats (PDF, DOCX, HTML, TXT, ODT, MARKDOWN). Returns base64-encoded content.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'Document ID' },
          format: {
            type: 'string',
            description: 'Export format',
            enum: ['PDF', 'DOCX', 'HTML', 'TXT', 'ODT', 'RTF', 'EPUB', 'MARKDOWN'],
          },
        },
        required: ['documentId', 'format'],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Execute tool
// ---------------------------------------------------------------------------

export async function executeTool(name: string, args: any, oauth2Client: any): Promise<any> {
  const docs = google.docs({ version: 'v1', auth: oauth2Client });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    switch (name) {
      // ---------------------------------------------------------------
      // Document Operations
      // ---------------------------------------------------------------
      case 'docs_create_document': {
        const docRes = await docs.documents.create({
          requestBody: { title: args.title },
        });
        const doc = docRes.data;

        // Move to specified folder if folderId provided
        if (args.folderId && doc.documentId) {
          await drive.files.update({
            fileId: doc.documentId,
            addParents: args.folderId,
            fields: 'id, parents',
          });
        }

        return ok({
          documentId: doc.documentId,
          title: doc.title,
          revisionId: doc.revisionId,
          webViewLink: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        });
      }

      case 'docs_get_document': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        const res = await docs.documents.get({
          documentId: args.documentId,
        });
        return ok(res.data);
      }

      case 'docs_get_document_plain_text': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        const res = await docs.documents.get({
          documentId: args.documentId,
        });

        // Extract plain text from document body
        let plainText = '';
        const body = res.data.body?.content;
        if (body) {
          for (const element of body) {
            if (element.paragraph) {
              for (const elem of element.paragraph.elements || []) {
                if (elem.textRun?.content) {
                  plainText += elem.textRun.content;
                }
              }
            }
          }
        }

        return ok({
          documentId: args.documentId,
          title: res.data.title,
          plainText,
        });
      }

      case 'docs_delete_document': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        await drive.files.delete({
          fileId: args.documentId,
        });
        return ok({
          success: true,
          message: 'Document deleted successfully',
          documentId: args.documentId,
        });
      }

      // ---------------------------------------------------------------
      // Content Manipulation
      // ---------------------------------------------------------------
      case 'docs_insert_text': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.text) throw new McpError(ErrorCode.InvalidParams, 'text is required');

        const segmentId = args.segmentId ?? '';
        const insertRequest: any = {
          insertText: {
            text: args.text,
            location: {
              segmentId,
              index: args.index ?? -1,
            },
          },
        };

        // If index is -1 or omitted, use endOfSegmentLocation
        if (args.index === undefined || args.index === -1) {
          insertRequest.insertText = {
            text: args.text,
            endOfSegmentLocation: {
              segmentId,
            },
          };
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [insertRequest],
          },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          insertIndex: args.index ?? 'end',
          textLength: args.text.length,
          replies: res.data.replies,
        });
      }

      case 'docs_insert_paragraph': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.text) throw new McpError(ErrorCode.InvalidParams, 'text is required');

        const segmentId = args.segmentId ?? '';
        const requests: any[] = [];

        // Insert paragraph with text
        const insertRequest: any = {
          insertText: {
            text: args.text,
            endOfSegmentLocation: {
              segmentId,
            },
          },
        };

        if (args.index !== undefined && args.index >= 0) {
          insertRequest.insertText = {
            text: args.text,
            location: {
              segmentId,
              index: args.index,
            },
          };
        }

        requests.push(insertRequest);

        // Apply paragraph style if specified
        const paragraphStyle: any = {};
        const styleFields: string[] = [];

        if (args.namedStyleType) {
          paragraphStyle.namedStyleType = args.namedStyleType;
          styleFields.push('namedStyleType');
        }
        if (args.alignment) {
          paragraphStyle.alignment = args.alignment;
          styleFields.push('alignment');
        }
        if (args.lineSpacing) {
          paragraphStyle.lineSpacing = { percentage: args.lineSpacing };
          styleFields.push('lineSpacing');
        }
        if (args.spaceAbove !== undefined) {
          paragraphStyle.spaceAbove = { magnitude: args.spaceAbove, unit: 'PT' };
          styleFields.push('spaceAbove');
        }
        if (args.spaceBelow !== undefined) {
          paragraphStyle.spaceBelow = { magnitude: args.spaceBelow, unit: 'PT' };
          styleFields.push('spaceBelow');
        }
        if (args.indentStart !== undefined) {
          paragraphStyle.indentStart = { magnitude: args.indentStart, unit: 'PT' };
          styleFields.push('indentStart');
        }
        if (args.indentFirstLine !== undefined) {
          paragraphStyle.indentFirstLine = { magnitude: args.indentFirstLine, unit: 'PT' };
          styleFields.push('indentFirstLine');
        }

        if (styleFields.length > 0) {
          // Get the document to find the correct range for the new paragraph
          const docRes = await docs.documents.get({ documentId: args.documentId });
          const bodyContent = docRes.data.body?.content || [];
          const lastElement = bodyContent[bodyContent.length - 1];
          const paragraphStartIndex = args.index ?? (lastElement ? lastElement.startIndex : 1);
          const paragraphEndIndex = paragraphStartIndex + args.text.length;

          requests.push({
            updateParagraphStyle: {
              range: {
                segmentId,
                startIndex: paragraphStartIndex,
                endIndex: paragraphEndIndex,
              },
              paragraphStyle,
              fields: styleFields.join(','),
            },
          });
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: { requests },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          replies: res.data.replies,
        });
      }

      case 'docs_insert_page_break': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');

        const segmentId = args.segmentId ?? '';
        const insertRequest: any = {
          insertPageBreak: {
            location: {
              segmentId,
              index: args.index ?? -1,
            },
          },
        };

        if (args.index === undefined || args.index === -1) {
          insertRequest.insertPageBreak = {
            endOfSegmentLocation: {
              segmentId,
            },
          };
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [insertRequest],
          },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          insertIndex: args.index ?? 'end',
          replies: res.data.replies,
        });
      }

      case 'docs_insert_table': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.rows || !args.columns) throw new McpError(ErrorCode.InvalidParams, 'rows and columns are required');

        const segmentId = args.segmentId ?? '';
        const requests: any[] = [];

        // Create the table
        const createTableRequest: any = {
          insertTable: {
            rows: args.rows,
            columns: args.columns,
            endOfSegmentLocation: {
              segmentId,
            },
          },
        };

        if (args.index !== undefined && args.index >= 0) {
          createTableRequest.insertTable = {
            rows: args.rows,
            columns: args.columns,
            location: {
              segmentId,
              index: args.index,
            },
          };
        }

        requests.push(createTableRequest);

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: { requests },
        });

        // Get the table info from the response
        // Note: insertTable is not in Schema$Response, so we need to find the table from the document
        let tableStartIndex: number | undefined;

        // Fill cell content if provided
        if (args.cellContent && Array.isArray(args.cellContent)) {
          // Get the document to find the table position
          const docRes = await docs.documents.get({ documentId: args.documentId });
          const bodyContent = docRes.data.body?.content || [];

          // Find the last table element (the one we just inserted)
          let tableElement: any = null;
          for (const element of bodyContent) {
            if (element.table) {
              tableElement = element;
              tableStartIndex = element.startIndex ?? undefined;
            }
          }

          if (tableElement?.table?.tableRows) {
            const fillRequests: any[] = [];
            for (let r = 0; r < Math.min(args.cellContent.length, args.rows); r++) {
              const row = args.cellContent[r];
              if (!Array.isArray(row)) continue;
              for (let c = 0; c < Math.min(row.length, args.columns); c++) {
                const cellText = row[c];
                if (cellText && typeof cellText === 'string') {
                  const tableRow = tableElement.table.tableRows[r];
                  if (tableRow?.tableCells?.[c]) {
                    const cell = tableRow.tableCells[c];
                    // Each cell has a paragraph - insert text at the end of the first paragraph
                    if (cell.content && cell.content.length > 0) {
                      const cellParagraph = cell.content[0];
                      fillRequests.push({
                        insertText: {
                          text: cellText,
                          location: {
                            segmentId: '',
                            index: cellParagraph.endIndex - 1,
                          },
                        },
                      });
                    }
                  }
                }
              }
            }

            if (fillRequests.length > 0) {
              await docs.documents.batchUpdate({
                documentId: args.documentId,
                requestBody: { requests: fillRequests },
              });
            }
          }
        }

        return ok({
          success: true,
          documentId: args.documentId,
          tableStartIndex,
          rows: args.rows,
          columns: args.columns,
          replies: res.data.replies,
        });
      }

      case 'docs_insert_image': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.imageUrl) throw new McpError(ErrorCode.InvalidParams, 'imageUrl is required');

        const segmentId = args.segmentId ?? '';

        // Build the image request
        const insertImageRequest: any = {
          insertInlineImage: {
            location: {
              segmentId,
              index: args.index ?? -1,
            },
            uri: args.imageUrl,
          },
        };

        if (args.index === undefined || args.index === -1) {
          insertImageRequest.insertInlineImage = {
            endOfSegmentLocation: {
              segmentId,
            },
            uri: args.imageUrl,
          };
        }

        // Add size if specified
        if (args.width && args.height && insertImageRequest.insertInlineImage) {
          insertImageRequest.insertInlineImage.objectSize = {
            width: { magnitude: args.width, unit: 'PT' },
            height: { magnitude: args.height, unit: 'PT' },
          };
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [insertImageRequest],
          },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          imageUrl: args.imageUrl,
          insertIndex: args.index ?? 'end',
          replies: res.data.replies,
        });
      }

      case 'docs_insert_bullet_list': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.items || !Array.isArray(args.items) || args.items.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'items array is required');
        }

        const segmentId = args.segmentId ?? '';
        const requests: any[] = [];

        // Insert all items as text with newlines
        const fullText = args.items.join('\n');

        const insertRequest: any = {
          insertText: {
            text: fullText,
            endOfSegmentLocation: {
              segmentId,
            },
          },
        };

        if (args.index !== undefined && args.index >= 0) {
          insertRequest.insertText = {
            text: fullText,
            location: {
              segmentId,
              index: args.index,
            },
          };
        }

        requests.push(insertRequest);

        // Now get the document to find the indices for bullet points
        // First insert, then query to find where we inserted
        const preDocRes = await docs.documents.get({ documentId: args.documentId });
        const preContent = preDocRes.data.body?.content || [];
        const lastElement = preContent[preContent.length - 1];
        const startIndex = args.index ?? (lastElement ? lastElement.startIndex : 1);

        // Apply bullet styling to each item
        for (let i = 0; i < args.items.length; i++) {
          const lineStart = startIndex + (i > 0 ? args.items.slice(0, i).join('\n').length + 1 : 0);
          const lineEnd = lineStart + args.items[i].length;

          requests.push({
            createParagraphBullets: {
              range: {
                segmentId,
                startIndex: lineStart,
                endIndex: lineEnd,
              },
              bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
            },
          });
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: { requests },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          itemCount: args.items.length,
          replies: res.data.replies,
        });
      }

      case 'docs_insert_numbered_list': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.items || !Array.isArray(args.items) || args.items.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'items array is required');
        }

        const segmentId = args.segmentId ?? '';
        const requests: any[] = [];

        // Insert all items as text with newlines
        const fullText = args.items.join('\n');

        const insertRequest: any = {
          insertText: {
            text: fullText,
            endOfSegmentLocation: {
              segmentId,
            },
          },
        };

        if (args.index !== undefined && args.index >= 0) {
          insertRequest.insertText = {
            text: fullText,
            location: {
              segmentId,
              index: args.index,
            },
          };
        }

        requests.push(insertRequest);

        // Get the document to find indices
        const preDocRes = await docs.documents.get({ documentId: args.documentId });
        const preContent = preDocRes.data.body?.content || [];
        const lastElement = preContent[preContent.length - 1];
        const startIndex = args.index ?? (lastElement ? lastElement.startIndex : 1);

        // Apply numbered list styling to each item
        for (let i = 0; i < args.items.length; i++) {
          const lineStart = startIndex + (i > 0 ? args.items.slice(0, i).join('\n').length + 1 : 0);
          const lineEnd = lineStart + args.items[i].length;

          requests.push({
            createParagraphBullets: {
              range: {
                segmentId,
                startIndex: lineStart,
                endIndex: lineEnd,
              },
              bulletPreset: 'NUMBERED_DECIMAL_ALPHA_ROMAN',
            },
          });
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: { requests },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          itemCount: args.items.length,
          replies: res.data.replies,
        });
      }

      case 'docs_insert_named_range': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
        if (args.startIndex === undefined || args.endIndex === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'startIndex and endIndex are required');
        }

        const segmentId = args.segmentId ?? '';

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                createNamedRange: {
                  name: args.name,
                  range: {
                    segmentId,
                    startIndex: args.startIndex,
                    endIndex: args.endIndex,
                  },
                },
              },
            ],
          },
        });

        const namedRangeId = res.data.replies?.[0]?.createNamedRange?.namedRangeId;

        return ok({
          success: true,
          documentId: args.documentId,
          name: args.name,
          namedRangeId,
          startIndex: args.startIndex,
          endIndex: args.endIndex,
        });
      }

      // ---------------------------------------------------------------
      // Text Formatting
      // ---------------------------------------------------------------
      case 'docs_update_paragraph_style': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (args.startIndex === undefined || args.endIndex === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'startIndex and endIndex are required');
        }

        const segmentId = args.segmentId ?? '';
        // Clamp startIndex to minimum 2 to avoid first section break
        const startIndex = Math.max(args.startIndex, 2);
        const paragraphStyle: any = {};
        const styleFields: string[] = [];

        if (args.namedStyleType) {
          paragraphStyle.namedStyleType = args.namedStyleType;
          styleFields.push('namedStyleType');
        }
        if (args.alignment) {
          paragraphStyle.alignment = args.alignment;
          styleFields.push('alignment');
        }
        if (args.lineSpacing !== undefined) {
          paragraphStyle.lineSpacing = { percentage: args.lineSpacing };
          styleFields.push('lineSpacing');
        }
        if (args.spaceAbove !== undefined) {
          paragraphStyle.spaceAbove = { magnitude: args.spaceAbove, unit: 'PT' };
          styleFields.push('spaceAbove');
        }
        if (args.spaceBelow !== undefined) {
          paragraphStyle.spaceBelow = { magnitude: args.spaceBelow, unit: 'PT' };
          styleFields.push('spaceBelow');
        }
        if (args.indentStart !== undefined) {
          paragraphStyle.indentStart = { magnitude: args.indentStart, unit: 'PT' };
          styleFields.push('indentStart');
        }
        if (args.indentEnd !== undefined) {
          paragraphStyle.indentEnd = { magnitude: args.indentEnd, unit: 'PT' };
          styleFields.push('indentEnd');
        }
        if (args.indentFirstLine !== undefined) {
          paragraphStyle.indentFirstLine = { magnitude: args.indentFirstLine, unit: 'PT' };
          styleFields.push('indentFirstLine');
        }
        if (args.direction) {
          paragraphStyle.direction = args.direction;
          styleFields.push('direction');
        }

        if (styleFields.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'At least one paragraph style property must be specified');
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                updateParagraphStyle: {
                  range: {
                    segmentId,
                    startIndex,
                    endIndex: args.endIndex,
                  },
                  paragraphStyle,
                  fields: styleFields.join(','),
                },
              },
            ],
          },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          startIndex,
          endIndex: args.endIndex,
          updatedFields: styleFields,
          replies: res.data.replies,
        });
      }

      case 'docs_update_text_format': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (args.startIndex === undefined || args.endIndex === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'startIndex and endIndex are required');
        }

        const segmentId = args.segmentId ?? '';
        // Clamp startIndex to minimum 2 to avoid first section break
        const startIndex = Math.max(args.startIndex, 2);
        const textStyle: any = {};
        const styleFields: string[] = [];

        if (args.bold !== undefined) {
          textStyle.bold = args.bold;
          styleFields.push('bold');
        }
        if (args.italic !== undefined) {
          textStyle.italic = args.italic;
          styleFields.push('italic');
        }
        if (args.underline !== undefined) {
          textStyle.underline = args.underline;
          styleFields.push('underline');
        }
        if (args.strikethrough !== undefined) {
          textStyle.strikethrough = args.strikethrough;
          styleFields.push('strikethrough');
        }
        if (args.weightedFontFamily) {
          textStyle.weightedFontFamily = { fontFamily: args.weightedFontFamily };
          styleFields.push('weightedFontFamily');
        }
        if (args.fontSize !== undefined) {
          textStyle.fontSize = { magnitude: args.fontSize, unit: 'PT' };
          styleFields.push('fontSize');
        }
        if (args.foregroundColor) {
          textStyle.foregroundColor = parseDocColor(args.foregroundColor);
          styleFields.push('foregroundColor');
        }
        if (args.backgroundColor) {
          textStyle.backgroundColor = parseDocColor(args.backgroundColor);
          styleFields.push('backgroundColor');
        }
        if (args.link !== undefined) {
          if (args.link === '') {
            textStyle.link = { url: '' };
          } else {
            textStyle.link = { url: args.link };
          }
          styleFields.push('link');
        }

        if (styleFields.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'At least one text format property must be specified');
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                updateTextStyle: {
                  range: {
                    segmentId,
                    startIndex,
                    endIndex: args.endIndex,
                  },
                  textStyle,
                  fields: styleFields.join(','),
                },
              },
            ],
          },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          startIndex,
          endIndex: args.endIndex,
          updatedFields: styleFields,
          replies: res.data.replies,
        });
      }

      case 'docs_delete_content_range': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (args.startIndex === undefined || args.endIndex === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'startIndex and endIndex are required');
        }

        const segmentId = args.segmentId ?? '';

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: {
                    segmentId,
                    startIndex: args.startIndex,
                    endIndex: args.endIndex,
                  },
                },
              },
            ],
          },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          deletedRange: {
            startIndex: args.startIndex,
            endIndex: args.endIndex,
            length: args.endIndex - args.startIndex,
          },
          replies: res.data.replies,
        });
      }

      case 'docs_merge_table_cells': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (args.tableStartIndex === undefined) throw new McpError(ErrorCode.InvalidParams, 'tableStartIndex is required');
        if (args.rowStartIndex === undefined || args.rowEndIndex === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'rowStartIndex and rowEndIndex are required');
        }
        if (args.columnStartIndex === undefined || args.columnEndIndex === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'columnStartIndex and columnEndIndex are required');
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                mergeTableCells: {
                  tableRange: {
                    tableCellLocation: {
                      rowIndex: args.rowStartIndex,
                      columnIndex: args.columnStartIndex,
                      tableStartLocation: {
                        segmentId: '',
                        index: args.tableStartIndex,
                      },
                    },
                    rowSpan: args.rowEndIndex - args.rowStartIndex,
                    columnSpan: args.columnEndIndex - args.columnStartIndex,
                  },
                },
              },
            ],
          },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          tableStartIndex: args.tableStartIndex,
          mergedRange: {
            rowStart: args.rowStartIndex,
            rowEnd: args.rowEndIndex,
            columnStart: args.columnStartIndex,
            columnEnd: args.columnEndIndex,
          },
          replies: res.data.replies,
        });
      }

      case 'docs_unmerge_table_cells': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (args.tableStartIndex === undefined) throw new McpError(ErrorCode.InvalidParams, 'tableStartIndex is required');
        if (args.rowStartIndex === undefined || args.rowEndIndex === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'rowStartIndex and rowEndIndex are required');
        }
        if (args.columnStartIndex === undefined || args.columnEndIndex === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'columnStartIndex and columnEndIndex are required');
        }

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                unmergeTableCells: {
                  tableRange: {
                    tableCellLocation: {
                      rowIndex: args.rowStartIndex,
                      columnIndex: args.columnStartIndex,
                      tableStartLocation: {
                        index: args.tableStartIndex,
                      },
                    },
                    rowSpan: args.rowEndIndex - args.rowStartIndex,
                    columnSpan: args.columnEndIndex - args.columnStartIndex,
                  },
                },
              },
            ],
          },
        });

        return ok({
          success: true,
          documentId: args.documentId,
          tableStartIndex: args.tableStartIndex,
          unmergedRange: {
            rowStart: args.rowStartIndex,
            rowEnd: args.rowEndIndex,
            columnStart: args.columnStartIndex,
            columnEnd: args.columnEndIndex,
          },
          replies: res.data.replies,
        });
      }

      // ---------------------------------------------------------------
      // Navigation & Search
      // ---------------------------------------------------------------
      case 'docs_find_and_replace': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.findText) throw new McpError(ErrorCode.InvalidParams, 'findText is required');
        if (args.replaceText === undefined) throw new McpError(ErrorCode.InvalidParams, 'replaceText is required');

        const replaceAllRequest: any = {
          replaceAllText: {
            containsText: {
              text: args.findText,
              matchCase: args.matchCase ?? false,
            },
            replaceText: args.replaceText,
          },
        };

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [replaceAllRequest],
          },
        });

        const reply = res.data.replies?.[0]?.replaceAllText;

        return ok({
          success: true,
          documentId: args.documentId,
          findText: args.findText,
          replaceText: args.replaceText,
          occurrencesChanged: reply?.occurrencesChanged ?? 0,
          replies: res.data.replies,
        });
      }

      case 'docs_replace_all_text': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.findText) throw new McpError(ErrorCode.InvalidParams, 'findText is required');
        if (args.replaceText === undefined) throw new McpError(ErrorCode.InvalidParams, 'replaceText is required');

        const res = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                replaceAllText: {
                  containsText: {
                    text: args.findText,
                    matchCase: false,
                  },
                  replaceText: args.replaceText,
                },
              },
            ],
          },
        });

        const reply = res.data.replies?.[0]?.replaceAllText;

        return ok({
          success: true,
          documentId: args.documentId,
          findText: args.findText,
          replaceText: args.replaceText,
          occurrencesChanged: reply?.occurrencesChanged ?? 0,
        });
      }

      // ---------------------------------------------------------------
      // Export
      // ---------------------------------------------------------------
      case 'docs_export_document': {
        if (!args.documentId) throw new McpError(ErrorCode.InvalidParams, 'documentId is required');
        if (!args.format) throw new McpError(ErrorCode.InvalidParams, 'format is required');

        const formatMap: Record<string, string> = {
          'PDF': 'application/pdf',
          'DOCX': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'HTML': 'text/html',
          'TXT': 'text/plain',
          'ODT': 'application/vnd.oasis.opendocument.text',
          'RTF': 'application/rtf',
          'EPUB': 'application/epub+zip',
          'MARKDOWN': 'text/markdown',
        };

        const mimeType = formatMap[args.format.toUpperCase()];
        if (!mimeType) {
          throw new McpError(ErrorCode.InvalidParams, `Unsupported format: ${args.format}. Supported: PDF, DOCX, HTML, TXT, ODT, RTF, EPUB, MARKDOWN`);
        }

        const response = await drive.files.export(
          {
            fileId: args.documentId,
            mimeType,
          },
          { responseType: 'arraybuffer' }
        );

        const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');

        // Get document title for reference
        const docRes = await docs.documents.get({
          documentId: args.documentId,
          fields: 'title',
        });

        return ok({
          documentId: args.documentId,
          title: docRes.data.title,
          format: args.format.toUpperCase(),
          mimeType,
          base64Content: base64,
          sizeBytes: (response.data as ArrayBuffer).byteLength,
        });
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (error instanceof McpError) throw error;
    const msg = error?.message || String(error);
    console.error(`Docs tool ${name} error:`, msg);
    throw new McpError(ErrorCode.InternalError, `Docs API error in ${name}: ${msg}`);
  }
}
