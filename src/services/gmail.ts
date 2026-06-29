/**
 * Google Gmail MCP Service Module
 *
 * Provides tools for managing Gmail:
 * - Messages: list, get, send, reply, forward, trash, untrash, delete, modify
 * - Drafts: list, get, create, update, delete, send
 * - Labels: list, get, create, update, delete
 * - Threads: list, get, trash, untrash, delete, modify
 * - Attachments: download
 * - Filters: list, create, delete
 * - Settings: auto-reply
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';

// ---------------------------------------------------------------------------
// Types
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
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function gmail(oauth2Client: any) {
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// (validation done inline in each handler)

// Decode base64url to string
function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

// Encode string to base64url
function encodeB64Url(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export function getTools(): ToolDefinition[] {
  return [
    // ── Messages ────────────────────────────────────────────────────────────
    {
      name: 'list_messages',
      description: 'List messages in a Gmail mailbox with optional query, label IDs, and pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          labelIds: { type: 'array', items: { type: 'string' }, description: 'Filter by label IDs (e.g. ["INBOX"], ["UNREAD"])' },
          q: { type: 'string', description: 'Gmail search query (e.g. "from:foo@example.com", "subject:hello", "is:unread")' },
          maxResults: { type: 'number', description: 'Max results per page (1-500, default 100)' },
          pageToken: { type: 'string', description: 'Page token for next page' },
          includeSpamTrash: { type: 'boolean', description: 'Include spam and trash (default: false)' },
          fields: { type: 'string', description: 'Fields to return (default: "messages(id,threadId,labelIds,snapshot.snippet)")' },
        },
      },
    },
    {
      name: 'get_message',
      description: 'Get a specific Gmail message by ID. Returns full message headers, body, and metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID' },
          format: { type: 'string', description: 'Format: full, metadata, minimal, raw (default: full)' },
          metadataHeaders: { type: 'array', items: { type: 'string' }, description: 'Specific headers to return (e.g. ["From","To","Subject"])' },
        },
        required: ['messageId'],
      },
    },
    {
      name: 'get_message_raw',
      description: 'Get raw MIME content of a Gmail message. Returns base64url-encoded raw message.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID' },
        },
        required: ['messageId'],
      },
    },
    {
      name: 'send_message',
      description: 'Send an email message. Provide raw MIME message or structured fields.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          to: { type: 'string', description: 'Recipient email address(es), comma-separated' },
          cc: { type: 'string', description: 'CC email address(es), comma-separated' },
          bcc: { type: 'string', description: 'BCC email address(es), comma-separated' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body (plain text or HTML)' },
          mimeType: { type: 'string', description: 'Body MIME type (default: "text/plain")' },
          inReplyTo: { type: 'string', description: 'Message ID to reply to' },
          threadId: { type: 'string', description: 'Thread ID to add this message to' },
          labelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to apply (e.g. ["INBOX"])' },
          rawMime: { type: 'string', description: 'Full raw MIME message (base64url-encoded). Overrides structured fields.' },
          attachments: { type: 'array', items: { type: 'object', description: '{filename, mimeType, data (base64url)}' }, description: 'File attachments' },
        },
        required: ['to', 'subject'],
      },
    },
    {
      name: 'reply_to_message',
      description: 'Reply to a Gmail message. Automatically sets In-Reply-To, References, and subject with "Re:" prefix.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID to reply to' },
          body: { type: 'string', description: 'Reply body' },
          mimeType: { type: 'string', description: 'Body MIME type (default: "text/plain")' },
          replyAll: { type: 'boolean', description: 'Reply to all recipients (default: false)' },
          attachments: { type: 'array', items: { type: 'object', description: '{filename, mimeType, data (base64url)}' }, description: 'File attachments' },
        },
        required: ['messageId', 'body'],
      },
    },
    {
      name: 'forward_message',
      description: 'Forward a Gmail message to new recipients.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID to forward' },
          to: { type: 'string', description: 'Forward recipients, comma-separated' },
          body: { type: 'string', description: 'Optional text to prepend' },
        },
        required: ['messageId', 'to'],
      },
    },
    {
      name: 'trash_message',
      description: 'Move a message to trash.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID' },
        },
        required: ['messageId'],
      },
    },
    {
      name: 'untrash_message',
      description: 'Remove a message from trash.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID' },
        },
        required: ['messageId'],
      },
    },
    {
      name: 'delete_message',
      description: 'Permanently delete a message (bypasses trash). Cannot be undone.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID' },
        },
        required: ['messageId'],
      },
    },
    {
      name: 'modify_message',
      description: 'Add or remove labels from a message.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID' },
          addLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to add (e.g. ["UNREAD"])' },
          removeLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to remove (e.g. ["UNREAD"])' },
        },
        required: ['messageId'],
      },
    },
    {
      name: 'batch_modify_messages',
      description: 'Add or remove labels from multiple messages at once.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageIds: { type: 'array', items: { type: 'string' }, description: 'Message IDs to modify' },
          addLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to add' },
          removeLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to remove' },
        },
        required: ['messageIds'],
      },
    },
    {
      name: 'batch_delete_messages',
      description: 'Permanently delete multiple messages (bypasses trash). Cannot be undone.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageIds: { type: 'array', items: { type: 'string' }, description: 'Message IDs to delete' },
        },
        required: ['messageIds'],
      },
    },

    // ── Drafts ──────────────────────────────────────────────────────────────
    {
      name: 'list_drafts',
      description: 'List drafts in a Gmail mailbox.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          maxResults: { type: 'number', description: 'Max results (default 100)' },
          pageToken: { type: 'string', description: 'Page token for next page' },
        },
      },
    },
    {
      name: 'get_draft',
      description: 'Get a specific draft by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          draftId: { type: 'string', description: 'Draft ID' },
          format: { type: 'string', description: 'Format: full, metadata, minimal, raw (default: full)' },
        },
        required: ['draftId'],
      },
    },
    {
      name: 'create_draft',
      description: 'Create a new draft email. Provide structured fields or raw MIME.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          to: { type: 'string', description: 'Recipient email address(es)' },
          cc: { type: 'string', description: 'CC email address(es)' },
          bcc: { type: 'string', description: 'BCC email address(es)' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' },
          mimeType: { type: 'string', description: 'Body MIME type (default: "text/plain")' },
          inReplyTo: { type: 'string', description: 'Message ID this draft replies to' },
          threadId: { type: 'string', description: 'Thread ID' },
          rawMime: { type: 'string', description: 'Full raw MIME (base64url). Overrides structured fields.' },
        },
      },
    },
    {
      name: 'update_draft',
      description: 'Update an existing draft. Replace the entire draft content.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          draftId: { type: 'string', description: 'Draft ID' },
          to: { type: 'string', description: 'Recipient email address(es)' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' },
          mimeType: { type: 'string', description: 'Body MIME type (default: "text/plain")' },
          rawMime: { type: 'string', description: 'Full raw MIME (base64url). Overrides structured fields.' },
        },
        required: ['draftId'],
      },
    },
    {
      name: 'delete_draft',
      description: 'Delete a draft.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          draftId: { type: 'string', description: 'Draft ID' },
        },
        required: ['draftId'],
      },
    },
    {
      name: 'send_draft',
      description: 'Send an existing draft. Removes the draft after sending.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          draftId: { type: 'string', description: 'Draft ID' },
        },
        required: ['draftId'],
      },
    },

    // ── Labels ──────────────────────────────────────────────────────────────
    {
      name: 'list_labels',
      description: 'List all Gmail labels.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
        },
      },
    },
    {
      name: 'get_label',
      description: 'Get a specific label by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          labelId: { type: 'string', description: 'Label ID' },
        },
        required: ['labelId'],
      },
    },
    {
      name: 'create_label',
      description: 'Create a new Gmail label.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          name: { type: 'string', description: 'Label name (supports "/" for nesting, e.g. "Projects/Work")' },
          color: { type: 'string', description: 'Label color as hex (e.g. "#0000FF")' },
          visibility: { type: 'string', description: 'Visibility: "show" or "hide" (default: "show")' },
        },
        required: ['name'],
      },
    },
    {
      name: 'update_label',
      description: 'Update a Gmail label name or visibility.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          labelId: { type: 'string', description: 'Label ID' },
          name: { type: 'string', description: 'New label name' },
          color: { type: 'string', description: 'New label color as hex' },
          visibility: { type: 'string', description: 'New visibility: "show" or "hide"' },
        },
        required: ['labelId'],
      },
    },
    {
      name: 'delete_label',
      description: 'Delete a Gmail label. Messages are not deleted.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          labelId: { type: 'string', description: 'Label ID' },
        },
        required: ['labelId'],
      },
    },

    // ── Threads ─────────────────────────────────────────────────────────────
    {
      name: 'list_threads',
      description: 'List Gmail threads with optional query and pagination.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          labelIds: { type: 'array', items: { type: 'string' }, description: 'Filter by label IDs' },
          q: { type: 'string', description: 'Gmail search query' },
          maxResults: { type: 'number', description: 'Max results (default 100)' },
          pageToken: { type: 'string', description: 'Page token' },
          includeSpamTrash: { type: 'boolean', description: 'Include spam and trash' },
        },
      },
    },
    {
      name: 'get_thread',
      description: 'Get a specific Gmail thread with all its messages.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          threadId: { type: 'string', description: 'Thread ID' },
          format: { type: 'string', description: 'Format: full, metadata, minimal, raw (default: full)' },
          metadataHeaders: { type: 'array', items: { type: 'string' }, description: 'Specific headers' },
        },
        required: ['threadId'],
      },
    },
    {
      name: 'trash_thread',
      description: 'Move a thread to trash.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          threadId: { type: 'string', description: 'Thread ID' },
        },
        required: ['threadId'],
      },
    },
    {
      name: 'untrash_thread',
      description: 'Remove a thread from trash.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          threadId: { type: 'string', description: 'Thread ID' },
        },
        required: ['threadId'],
      },
    },
    {
      name: 'delete_thread',
      description: 'Permanently delete a thread and all its messages. Cannot be undone.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          threadId: { type: 'string', description: 'Thread ID' },
        },
        required: ['threadId'],
      },
    },
    {
      name: 'modify_thread',
      description: 'Add or remove labels from a thread (affects all messages in thread).',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          threadId: { type: 'string', description: 'Thread ID' },
          addLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to add' },
          removeLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to remove' },
        },
        required: ['threadId'],
      },
    },

    // ── Attachments ─────────────────────────────────────────────────────────
    {
      name: 'get_attachment',
      description: 'Download a message attachment by attachment ID. Returns base64url-encoded data.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          messageId: { type: 'string', description: 'Message ID' },
          attachmentId: { type: 'string', description: 'Attachment ID' },
        },
        required: ['messageId', 'attachmentId'],
      },
    },

    // ── Filters ─────────────────────────────────────────────────────────────
    {
      name: 'list_filters',
      description: 'List Gmail mail filters.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
        },
      },
    },
    {
      name: 'create_filter',
      description: 'Create a Gmail mail filter to auto-label, archive, star, mark as read, forward, or delete incoming messages.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          from: { type: 'string', description: 'Match sender email' },
          to: { type: 'string', description: 'Match recipient email' },
          subject: { type: 'string', description: 'Match subject' },
          query: { type: 'string', description: 'Match Gmail search query' },
          hasAttachment: { type: 'boolean', description: 'Match messages with attachments' },
          excludeChats: { type: 'boolean', description: 'Exclude chat messages' },
          size: { type: 'number', description: 'Match message size in bytes' },
          sizeComparison: { type: 'string', description: 'Size comparison: "ltr" (less than) or "gtr" (greater than)' },
          addLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to add to matching messages' },
          removeLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to remove from matching messages' },
          forward: { type: 'string', description: 'Forward matching messages to this address' },
          markAsRead: { type: 'boolean', description: 'Mark matching messages as read' },
          star: { type: 'boolean', description: 'Star matching messages' },
          archive: { type: 'boolean', description: 'Archive matching messages (remove from INBOX)' },
          neverSpam: { type: 'boolean', description: 'Never mark as spam' },
          neverImportant: { type: 'boolean', description: 'Never mark as important' },
          trash: { type: 'boolean', description: 'Send matching messages to trash' },
        },
      },
    },
    {
      name: 'delete_filter',
      description: 'Delete a Gmail mail filter.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          filterId: { type: 'string', description: 'Filter ID' },
        },
        required: ['filterId'],
      },
    },

    // ── Settings ────────────────────────────────────────────────────────────
    {
      name: 'get_auto_reply',
      description: 'Get auto-reply (vacation responder) settings.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
        },
      },
    },
    {
      name: 'set_auto_reply',
      description: 'Enable or disable auto-reply (vacation responder).',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID or "me" (default: "me")' },
          enabled: { type: 'boolean', description: 'Enable or disable auto-reply' },
          subject: { type: 'string', description: 'Auto-reply subject' },
          body: { type: 'string', description: 'Auto-reply body text' },
          startDateTime: { type: 'string', description: 'Start date/time (RFC3339)' },
          endDateTime: { type: 'string', description: 'End date/time (RFC3339)' },
          restrictToContacts: { type: 'boolean', description: 'Only reply to contacts (default: false)' },
          restrictToDomain: { type: 'boolean', description: 'Only reply to same domain (default: false)' },
        },
        required: ['enabled'],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

export async function executeTool(name: string, args: any, oauth2Client: any): Promise<any> {
  const g = gmail(oauth2Client);
  const userId = args.userId || 'me';

  switch (name) {
    // ── Messages ────────────────────────────────────────────────────────────

    case 'list_messages': {
      const params: any = { userId };
      if (args.labelIds) params.labelIds = args.labelIds;
      if (args.q) params.q = args.q;
      if (args.maxResults) params.maxResults = args.maxResults;
      if (args.pageToken) params.pageToken = args.pageToken;
      if (args.includeSpamTrash) params.includeSpamTrash = args.includeSpamTrash;
      params.fields = args.fields || 'messages(id,threadId,labelIds,snapshot.snippet),nextPageToken,resultSizeEstimate';
      const res = await g.users.messages.list(params);
      return ok(res.data);
    }

    case 'get_message': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      const params: any = { userId, id: args.messageId };
      if (args.format) params.format = args.format;
      if (args.metadataHeaders) params.metadataHeaders = args.metadataHeaders;
      const res = await g.users.messages.get(params);
      return ok(res.data);
    }

    case 'get_message_raw': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      const res = await g.users.messages.get({ userId, id: args.messageId, format: 'raw' });
      return ok({ id: res.data.id, threadId: res.data.threadId, raw: res.data.raw });
    }

    case 'send_message': {
      let rawMessage: string;

      if (args.rawMime) {
        rawMessage = args.rawMime;
      } else {
        if (!args.to) throw new McpError(ErrorCode.InvalidParams, 'to is required');
        if (!args.subject) throw new McpError(ErrorCode.InvalidParams, 'subject is required');

        const headers: string[] = [
          `To: ${args.to}`,
          `Subject: ${args.subject}`,
        ];
        if (args.cc) headers.push(`Cc: ${args.cc}`);
        if (args.bcc) headers.push(`Bcc: ${args.bcc}`);
        if (args.inReplyTo) headers.push(`In-Reply-To: ${args.inReplyTo}`);
        if (args.inReplyTo) headers.push(`References: <${args.inReplyTo}>`);

        const mimeType = args.mimeType || 'text/plain';
        const contentType = mimeType.includes('html') ? 'text/html' : 'text/plain';

        // Build MIME message
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let mime = headers.join('\r\n') + '\r\n';
        mime += `MIME-Version: 1.0\r\n`;
        mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
        mime += `--${boundary}\r\n`;
        mime += `Content-Type: ${contentType}; charset="UTF-8"\r\n\r\n`;
        mime += args.body || '';
        mime += '\r\n';

        // Add attachments
        if (args.attachments && args.attachments.length > 0) {
          for (const att of args.attachments) {
            mime += `--${boundary}\r\n`;
            mime += `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"\r\n`;
            mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
            mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
            mime += att.data;
            mime += '\r\n';
          }
        }

        mime += `--${boundary}--\r\n`;
        rawMessage = encodeB64Url(mime);
      }

      const params: any = {
        userId,
        requestBody: { raw: rawMessage },
      };
      if (args.threadId) params.requestBody.threadId = args.threadId;
      if (args.labelIds) params.requestBody.labelIds = args.labelIds;

      const res = await g.users.messages.send(params);
      return ok({ id: res.data.id, threadId: res.data.threadId, labelIds: res.data.labelIds });
    }

    case 'reply_to_message': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      if (!args.body) throw new McpError(ErrorCode.InvalidParams, 'body is required');

      // Get original message for headers
      const orig = await g.users.messages.get({ userId, id: args.messageId, format: 'metadata', metadataHeaders: ['From', 'To', 'Cc', 'Subject'] });
      const headers = orig.data.payload?.headers || [];
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const cc = headers.find((h: any) => h.name === 'Cc')?.value || '';
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

      // Build reply addresses
      const myEmail = from; // The sender of original is us
      let replyTo: string;
      if (args.replyAll) {
        const allRecipients = [from, to, cc].filter(Boolean).join(', ');
        replyTo = allRecipients;
      } else {
        replyTo = from;
      }

      const mimeType = args.mimeType || 'text/plain';
      const contentType = mimeType.includes('html') ? 'text/html' : 'text/plain';
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
      let mime = `To: ${replyTo}\r\n`;
      mime += `Subject: ${replySubject}\r\n`;
      mime += `In-Reply-To: <${args.messageId}>\r\n`;
      mime += `References: <${args.messageId}>\r\n`;
      mime += `MIME-Version: 1.0\r\n`;
      mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      mime += `--${boundary}\r\n`;
      mime += `Content-Type: ${contentType}; charset="UTF-8"\r\n\r\n`;
      mime += args.body;
      mime += '\r\n';

      if (args.attachments && args.attachments.length > 0) {
        for (const att of args.attachments) {
          mime += `--${boundary}\r\n`;
          mime += `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"\r\n`;
          mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
          mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
          mime += att.data;
          mime += '\r\n';
        }
      }

      mime += `--${boundary}--\r\n`;
      const rawMessage = encodeB64Url(mime);

      const res = await g.users.messages.send({
        userId,
        requestBody: {
          raw: rawMessage,
          threadId: orig.data.threadId,
        },
      });
      return ok({ id: res.data.id, threadId: res.data.threadId });
    }

    case 'forward_message': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      if (!args.to) throw new McpError(ErrorCode.InvalidParams, 'to is required');

      // Get original message raw
      const orig = await g.users.messages.get({ userId, id: args.messageId, format: 'raw' });
      const rawContent = decodeB64Url(orig.data.raw || '');

      // Parse headers from original
      const subjectMatch = rawContent.match(/^Subject:\s*(.+)$/m);
      const subject = subjectMatch ? `Fwd: ${subjectMatch[1]}` : 'Fwd: (no subject)';

      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      let mime = `To: ${args.to}\r\n`;
      mime += `Subject: ${subject}\r\n`;
      mime += `MIME-Version: 1.0\r\n`;
      mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      if (args.body) {
        mime += `--${boundary}\r\n`;
        mime += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
        mime += args.body + '\r\n\r\n';
      }
      mime += `--${boundary}\r\n`;
      mime += `Content-Type: message/rfc822\r\n`;
      mime += `Content-Disposition: inline; filename="forwarded.eml"\r\n\r\n`;
      mime += rawContent;
      mime += '\r\n';
      mime += `--${boundary}--\r\n`;

      const rawMessage = encodeB64Url(mime);
      const res = await g.users.messages.send({
        userId,
        requestBody: { raw: rawMessage },
      });
      return ok({ id: res.data.id, threadId: res.data.threadId });
    }

    case 'trash_message': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      const res = await g.users.messages.trash({ userId, id: args.messageId });
      return ok({ success: true, message: 'Message moved to trash', id: res.data.id, labelIds: res.data.labelIds });
    }

    case 'untrash_message': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      const res = await g.users.messages.untrash({ userId, id: args.messageId });
      return ok({ success: true, message: 'Message removed from trash', id: res.data.id, labelIds: res.data.labelIds });
    }

    case 'delete_message': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      await g.users.messages.delete({ userId, id: args.messageId });
      return ok({ success: true, message: 'Message permanently deleted', id: args.messageId });
    }

    case 'modify_message': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      if (!args.addLabelIds && !args.removeLabelIds) {
        throw new McpError(ErrorCode.InvalidParams, 'addLabelIds or removeLabelIds is required');
      }
      const res = await g.users.messages.modify({
        userId,
        id: args.messageId,
        requestBody: {
          addLabelIds: args.addLabelIds || [],
          removeLabelIds: args.removeLabelIds || [],
        },
      });
      return ok({ id: res.data.id, threadId: res.data.threadId, labelIds: res.data.labelIds });
    }

    case 'batch_modify_messages': {
      if (!args.messageIds || !Array.isArray(args.messageIds) || args.messageIds.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'messageIds array is required');
      }
      await g.users.messages.batchModify({
        userId,
        requestBody: {
          ids: args.messageIds,
          addLabelIds: args.addLabelIds || [],
          removeLabelIds: args.removeLabelIds || [],
        },
      });
      return ok({ success: true, message: `${args.messageIds.length} messages modified` });
    }

    case 'batch_delete_messages': {
      if (!args.messageIds || !Array.isArray(args.messageIds) || args.messageIds.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'messageIds array is required');
      }
      await g.users.messages.batchDelete({
        userId,
        requestBody: { ids: args.messageIds },
      });
      return ok({ success: true, message: `${args.messageIds.length} messages permanently deleted` });
    }

    // ── Drafts ──────────────────────────────────────────────────────────────

    case 'list_drafts': {
      const params: any = { userId };
      if (args.maxResults) params.maxResults = args.maxResults;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await g.users.drafts.list(params);
      return ok(res.data);
    }

    case 'get_draft': {
      if (!args.draftId) throw new McpError(ErrorCode.InvalidParams, 'draftId is required');
      const params: any = { userId, id: args.draftId };
      if (args.format) params.format = args.format;
      const res = await g.users.drafts.get(params);
      return ok(res.data);
    }

    case 'create_draft': {
      let rawMessage: string;

      if (args.rawMime) {
        rawMessage = args.rawMime;
      } else {
        const headers: string[] = [];
        if (args.to) headers.push(`To: ${args.to}`);
        if (args.cc) headers.push(`Cc: ${args.cc}`);
        if (args.bcc) headers.push(`Bcc: ${args.bcc}`);
        if (args.subject) headers.push(`Subject: ${args.subject}`);
        if (args.inReplyTo) {
          headers.push(`In-Reply-To: <${args.inReplyTo}>`);
          headers.push(`References: <${args.inReplyTo}>`);
        }

        const mimeType = args.mimeType || 'text/plain';
        const contentType = mimeType.includes('html') ? 'text/html' : 'text/plain';

        let mime = headers.join('\r\n') + '\r\n';
        mime += `MIME-Version: 1.0\r\n`;
        mime += `Content-Type: ${contentType}; charset="UTF-8"\r\n\r\n`;
        mime += args.body || '';

        rawMessage = encodeB64Url(mime);
      }

      const requestBody: any = { message: { raw: rawMessage } };
      if (args.threadId) requestBody.message.threadId = args.threadId;

      const res = await g.users.drafts.create({
        userId,
        requestBody,
      });
      return ok({ id: res.data.id, message: res.data.message });
    }

    case 'update_draft': {
      if (!args.draftId) throw new McpError(ErrorCode.InvalidParams, 'draftId is required');

      let rawMessage: string;

      if (args.rawMime) {
        rawMessage = args.rawMime;
      } else {
        const headers: string[] = [];
        if (args.to) headers.push(`To: ${args.to}`);
        if (args.subject) headers.push(`Subject: ${args.subject}`);

        const mimeType = args.mimeType || 'text/plain';
        const contentType = mimeType.includes('html') ? 'text/html' : 'text/plain';

        let mime = headers.join('\r\n') + '\r\n';
        mime += `MIME-Version: 1.0\r\n`;
        mime += `Content-Type: ${contentType}; charset="UTF-8"\r\n\r\n`;
        mime += args.body || '';

        rawMessage = encodeB64Url(mime);
      }

      const res = await g.users.drafts.update({
        userId,
        id: args.draftId,
        requestBody: { message: { raw: rawMessage } },
      });
      return ok({ id: res.data.id, message: res.data.message });
    }

    case 'delete_draft': {
      if (!args.draftId) throw new McpError(ErrorCode.InvalidParams, 'draftId is required');
      await g.users.drafts.delete({ userId, id: args.draftId });
      return ok({ success: true, message: 'Draft deleted', id: args.draftId });
    }

    case 'send_draft': {
      if (!args.draftId) throw new McpError(ErrorCode.InvalidParams, 'draftId is required');
      const res = await g.users.drafts.send({
        userId,
        requestBody: { id: args.draftId },
      });
      return ok({ id: res.data.id, threadId: res.data.threadId, labelIds: res.data.labelIds });
    }

    // ── Labels ──────────────────────────────────────────────────────────────

    case 'list_labels': {
      const res = await g.users.labels.list({ userId });
      return ok({ labels: res.data.labels || [] });
    }

    case 'get_label': {
      if (!args.labelId) throw new McpError(ErrorCode.InvalidParams, 'labelId is required');
      const res = await g.users.labels.get({ userId, id: args.labelId });
      return ok(res.data);
    }

    case 'create_label': {
      if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
      const label: any = { name: args.name };
      if (args.color) {
        const h = args.color.replace('#', '');
        label.color = { textColor: `#${h}`, backgroundColor: `#${h}` };
      }
      if (args.visibility) label.labelListVisibility = args.visibility === 'hide' ? 'labelHide' : 'labelShow';
      const res = await g.users.labels.create({
        userId,
        requestBody: label,
      });
      return ok(res.data);
    }

    case 'update_label': {
      if (!args.labelId) throw new McpError(ErrorCode.InvalidParams, 'labelId is required');
      const update: any = {};
      if (args.name) update.name = args.name;
      if (args.color) {
        const h = args.color.replace('#', '');
        update.color = { textColor: `#${h}`, backgroundColor: `#${h}` };
      }
      if (args.visibility) update.labelListVisibility = args.visibility === 'hide' ? 'labelHide' : 'labelShow';
      const res = await g.users.labels.update({
        userId,
        id: args.labelId,
        requestBody: update,
      });
      return ok(res.data);
    }

    case 'delete_label': {
      if (!args.labelId) throw new McpError(ErrorCode.InvalidParams, 'labelId is required');
      await g.users.labels.delete({ userId, id: args.labelId });
      return ok({ success: true, message: 'Label deleted', id: args.labelId });
    }

    // ── Threads ─────────────────────────────────────────────────────────────

    case 'list_threads': {
      const params: any = { userId };
      if (args.labelIds) params.labelIds = args.labelIds;
      if (args.q) params.q = args.q;
      if (args.maxResults) params.maxResults = args.maxResults;
      if (args.pageToken) params.pageToken = args.pageToken;
      if (args.includeSpamTrash) params.includeSpamTrash = args.includeSpamTrash;
      const res = await g.users.threads.list(params);
      return ok(res.data);
    }

    case 'get_thread': {
      if (!args.threadId) throw new McpError(ErrorCode.InvalidParams, 'threadId is required');
      const params: any = { userId, id: args.threadId };
      if (args.format) params.format = args.format;
      if (args.metadataHeaders) params.metadataHeaders = args.metadataHeaders;
      const res = await g.users.threads.get(params);
      return ok(res.data);
    }

    case 'trash_thread': {
      if (!args.threadId) throw new McpError(ErrorCode.InvalidParams, 'threadId is required');
      const res = await g.users.threads.trash({ userId, id: args.threadId });
      return ok({ success: true, message: 'Thread moved to trash', id: (res.data as any).id, labels: (res.data as any).labels || [] });
    }

    case 'untrash_thread': {
      if (!args.threadId) throw new McpError(ErrorCode.InvalidParams, 'threadId is required');
      const res = await g.users.threads.untrash({ userId, id: args.threadId });
      return ok({ success: true, message: 'Thread removed from trash', id: (res.data as any).id, labels: (res.data as any).labels || [] });
    }

    case 'delete_thread': {
      if (!args.threadId) throw new McpError(ErrorCode.InvalidParams, 'threadId is required');
      await g.users.threads.delete({ userId, id: args.threadId });
      return ok({ success: true, message: 'Thread permanently deleted', id: args.threadId });
    }

    case 'modify_thread': {
      if (!args.threadId) throw new McpError(ErrorCode.InvalidParams, 'threadId is required');
      if (!args.addLabelIds && !args.removeLabelIds) {
        throw new McpError(ErrorCode.InvalidParams, 'addLabelIds or removeLabelIds is required');
      }
      const res = await g.users.threads.modify({
        userId,
        id: args.threadId,
        requestBody: {
          addLabelIds: args.addLabelIds || [],
          removeLabelIds: args.removeLabelIds || [],
        },
      });
      return ok({ id: (res.data as any).id, labels: (res.data as any).labels || [] });
    }

    // ── Attachments ─────────────────────────────────────────────────────────

    case 'get_attachment': {
      if (!args.messageId) throw new McpError(ErrorCode.InvalidParams, 'messageId is required');
      if (!args.attachmentId) throw new McpError(ErrorCode.InvalidParams, 'attachmentId is required');
      const res = await g.users.messages.attachments.get({
        userId,
        messageId: args.messageId,
        id: args.attachmentId,
      });
      return ok({
        attachmentId: res.data.attachmentId,
        data: res.data.data,
        size: res.data.size,
        mimeType: (res.data as any).mimeType,
      });
    }

    // ── Filters ─────────────────────────────────────────────────────────────

    case 'list_filters': {
      const res = await g.users.settings.filters.list({ userId });
      return ok({ filters: res.data.filter || [] });
    }

    case 'create_filter': {
      const criteria: any = {};
      if (args.from) criteria.from = args.from;
      if (args.to) criteria.to = args.to;
      if (args.subject) criteria.subject = args.subject;
      if (args.query) criteria.query = args.query;
      if (args.hasAttachment !== undefined) criteria.hasAttachment = args.hasAttachment;
      if (args.excludeChats !== undefined) criteria.excludeChats = args.excludeChats;
      if (args.size !== undefined) criteria.size = args.size;
      if (args.sizeComparison) criteria.sizeComparison = args.sizeComparison;

      const action: any = {};
      if (args.addLabelIds) action.addLabelIds = args.addLabelIds;
      if (args.removeLabelIds) action.removeLabelIds = args.removeLabelIds;
      if (args.forward) action.forward = args.forward;
      if (args.markAsRead !== undefined) action.markAsRead = args.markAsRead;
      if (args.star !== undefined) action.star = args.star;
      if (args.archive !== undefined) action.archive = args.archive;
      if (args.neverSpam !== undefined) action.neverSpam = args.neverSpam;
      if (args.neverImportant !== undefined) action.neverImportant = args.neverImportant;
      if (args.trash !== undefined) action.trash = args.trash;

      const res = await g.users.settings.filters.create({
        userId,
        requestBody: { criteria, action },
      });
      return ok({ id: res.data.id, criteria: res.data.criteria, action: res.data.action });
    }

    case 'delete_filter': {
      if (!args.filterId) throw new McpError(ErrorCode.InvalidParams, 'filterId is required');
      await g.users.settings.filters.delete({ userId, id: args.filterId });
      return ok({ success: true, message: 'Filter deleted', id: args.filterId });
    }

    // ── Settings ────────────────────────────────────────────────────────────

    case 'get_auto_reply': {
      const res = await (g.users.settings as any).getAutoReplyingRule({ userId });
      return ok(res.data);
    }

    case 'set_auto_reply': {
      if (args.enabled === undefined) throw new McpError(ErrorCode.InvalidParams, 'enabled is required');
      const rule: any = {
        enableAutoReply: args.enabled,
      };
      if (args.subject !== undefined) rule.responseSubject = args.subject;
      if (args.body !== undefined) rule.responseBodyPlainText = args.body;
      if (args.startDateTime) rule.startTime = args.startDateTime;
      if (args.endDateTime) rule.endTime = args.endDateTime;
      if (args.restrictToContacts !== undefined) rule.restrictToContacts = args.restrictToContacts;
      if (args.restrictToDomain !== undefined) rule.restrictToDomain = args.restrictToDomain;

      const res = await (g.users.settings as any).updateAutoReplyingRule({
        userId,
        requestBody: rule,
      });
      return ok(res.data);
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}
