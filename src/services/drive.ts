// Google Drive API scopes:
//   - https://www.googleapis.com/auth/drive
//   - https://www.googleapis.com/auth/drive.file

import { Readable } from 'stream';
import { google } from 'googleapis';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

function ok(data: any) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function getTools(): ToolDefinition[] {
  return [
    // --- File Operations ---
    {
      name: 'list_drive_files',
      description: 'List files in Google Drive with optional query, pagination, and field filtering. Supports full Drive query syntax (e.g. "name contains \'report\'", "mimeType=\'image/png\'", "modifiedTime > \'2024-01-01\'").',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Drive query string (e.g. "name contains \'report\'"). Omit to list all files.' },
          fields: { type: 'string', description: 'Comma-separated fields to return (default: "files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink)").' },
          orderBy: { type: 'string', description: 'Sort order (e.g. "name", "modifiedTime desc", "createdTime desc").' },
          pageSize: { type: 'number', description: 'Number of results per page (1-1000, default 20).' },
          pageToken: { type: 'string', description: 'Page token for pagination.' },
          spaces: { type: 'string', description: 'Comma-separated spaces to search (default: "drive").' },
          includeItemsFromAllDrives: { type: 'boolean', description: 'Include items from shared drives (default: true).' },
          supportsAllDrives: { type: 'boolean', description: 'Whether the request supports shared drives (default: true).' },
        },
      },
    },
    {
      name: 'get_drive_file',
      description: 'Get detailed metadata for a single file by ID, including name, MIME type, size, timestamps, parents, permissions, and more.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          fields: { type: 'string', description: 'Fields to return (default: all). Use Drive field mask syntax.' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'create_drive_file',
      description: 'Create or upload a file to Google Drive. Supply base64-encoded content or leave empty to create an empty file.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'File name.' },
          mimeType: { type: 'string', description: 'MIME type (e.g. "application/pdf", "text/plain").' },
          parents: { type: 'array', items: { type: 'string' }, description: 'Parent folder IDs (default: root).' },
          content: { type: 'string', description: 'Base64-encoded file content.' },
          description: { type: 'string', description: 'File description.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'update_drive_file',
      description: 'Update file metadata (name, description, parents, MIME type) for an existing file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          name: { type: 'string', description: 'New file name.' },
          description: { type: 'string', description: 'New description.' },
          mimeType: { type: 'string', description: 'New MIME type.' },
          addParents: { type: 'array', items: { type: 'string' }, description: 'Parent folder IDs to add.' },
          removeParents: { type: 'array', items: { type: 'string' }, description: 'Parent folder IDs to remove.' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'delete_drive_file',
      description: 'Delete a file permanently or move it to trash.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          permanent: { type: 'boolean', description: 'If true, delete permanently. If false, move to trash (default: false).' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'copy_drive_file',
      description: 'Copy a file to a new location with optional new name and parents.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'Source file ID.' },
          name: { type: 'string', description: 'New name for the copy.' },
          parents: { type: 'array', items: { type: 'string' }, description: 'Destination parent folder IDs.' },
          description: { type: 'string', description: 'Description for the copy.' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'download_drive_file',
      description: 'Get download URL and base64 content for a file. For Google Workspace files, use export_drive_file instead.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          mimeType: { type: 'string', description: 'Optional MIME type override for the download.' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'search_drive_files',
      description: 'Search Google Drive using full query syntax. Supports the complete Drive query language including operators like "contains", "has", "in", date comparisons, and more.',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Full Drive query (e.g. "name contains \'report\' and mimeType=\'application/pdf\' and modifiedTime > \'2024-01-01\'").' },
          fields: { type: 'string', description: 'Fields to return.' },
          orderBy: { type: 'string', description: 'Sort order.' },
          pageSize: { type: 'number', description: 'Number of results (1-1000).' },
          pageToken: { type: 'string', description: 'Page token for pagination.' },
        },
        required: ['q'],
      },
    },

    // --- Folder Operations ---
    {
      name: 'create_drive_folder',
      description: 'Create a new folder in Google Drive.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Folder name.' },
          parents: { type: 'array', items: { type: 'string' }, description: 'Parent folder IDs (default: root).' },
        },
        required: ['name'],
      },
    },
    {
      name: 'list_drive_folder_contents',
      description: 'List all files and subfolders within a specific folder.',
      inputSchema: {
        type: 'object',
        properties: {
          folderId: { type: 'string', description: 'Folder ID.' },
          pageSize: { type: 'number', description: 'Number of results per page (1-1000, default 100).' },
          pageToken: { type: 'string', description: 'Page token for pagination.' },
          orderBy: { type: 'string', description: 'Sort order.' },
          fields: { type: 'string', description: 'Fields to return.' },
        },
        required: ['folderId'],
      },
    },
    {
      name: 'move_drive_file',
      description: 'Move a file to a different parent folder.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID to move.' },
          addParents: { type: 'array', items: { type: 'string' }, description: 'Destination parent folder IDs.' },
          removeParents: { type: 'array', items: { type: 'string' }, description: 'Current parent folder IDs to remove.' },
        },
        required: ['fileId', 'addParents', 'removeParents'],
      },
    },

    // --- Permission Operations ---
    {
      name: 'add_drive_permission',
      description: 'Add a permission to a file. Supports user, group, domain, and anyone (link sharing) permission types.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          type: { type: 'string', description: 'Permission type.', enum: ['user', 'group', 'domain', 'anyone'] },
          role: { type: 'string', description: 'Permission role.', enum: ['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'] },
          emailAddress: { type: 'string', description: 'Email address (required for user/group types).' },
          domain: { type: 'string', description: 'Domain name (required for domain type).' },
          allowFileDiscovery: { type: 'boolean', description: 'Whether the permission is discoverable (default: false).' },
          sendNotificationEmail: { type: 'boolean', description: 'Send notification email (default: true).' },
          emailMessage: { type: 'string', description: 'Message to include in notification email.' },
        },
        required: ['fileId', 'type', 'role'],
      },
    },
    {
      name: 'list_drive_permissions',
      description: 'List all permissions for a file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          fields: { type: 'string', description: 'Fields to return (default: "permissions(id, type, role, emailAddress, displayName, domain)").' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'update_drive_permission',
      description: 'Update a permission role for a file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          permissionId: { type: 'string', description: 'Permission ID.' },
          role: { type: 'string', description: 'New role.', enum: ['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'] },
          type: { type: 'string', description: 'Permission type (required for transfers).' },
          transferOwnership: { type: 'boolean', description: 'Transfer ownership (required when changing to owner).' },
        },
        required: ['fileId', 'permissionId', 'role'],
      },
    },
    {
      name: 'remove_drive_permission',
      description: 'Remove a permission from a file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          permissionId: { type: 'string', description: 'Permission ID to remove.' },
        },
        required: ['fileId', 'permissionId'],
      },
    },
    {
      name: 'share_drive_file',
      description: 'Quick-share a file with an email address. Convenience wrapper around add_drive_permission for common sharing.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          emailAddress: { type: 'string', description: 'Email to share with.' },
          role: { type: 'string', description: 'Role (default: reader).', enum: ['reader', 'writer', 'commenter'] },
          type: { type: 'string', description: 'Permission type (default: user).', enum: ['user', 'group'] },
          sendNotificationEmail: { type: 'boolean', description: 'Send email notification (default: true).' },
          emailMessage: { type: 'string', description: 'Custom message for the notification.' },
        },
        required: ['fileId', 'emailAddress'],
      },
    },

    // --- Comment Operations ---
    {
      name: 'add_drive_comment',
      description: 'Add a comment to a file. Works with Google Docs, Sheets, Slides, and PDFs.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          content: { type: 'string', description: 'Comment text content.' },
          anchor: { type: 'string', description: 'Optional anchor ID to attach the comment to a specific element.' },
        },
        required: ['fileId', 'content'],
      },
    },
    {
      name: 'list_drive_comments',
      description: 'List all comments on a file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          pageSize: { type: 'number', description: 'Number of results (1-100, default 20).' },
          pageToken: { type: 'string', description: 'Page token.' },
          includeDeleted: { type: 'boolean', description: 'Include deleted comments (default: false).' },
          fields: { type: 'string', description: 'Fields to return.' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'resolve_drive_comment',
      description: 'Mark a comment as resolved (or unresolved).',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          commentId: { type: 'string', description: 'Comment ID.' },
          resolved: { type: 'boolean', description: 'Mark as resolved (true) or unresolved (false) (default: true).' },
        },
        required: ['fileId', 'commentId'],
      },
    },

    // --- Revision Operations ---
    {
      name: 'list_drive_revisions',
      description: 'List all revisions of a file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          fields: { type: 'string', description: 'Fields to return.' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'get_drive_revision',
      description: 'Get details about a specific revision of a file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          revisionId: { type: 'string', description: 'Revision ID.' },
        },
        required: ['fileId', 'revisionId'],
      },
    },
    {
      name: 'delete_drive_revision',
      description: 'Delete a specific revision of a file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          revisionId: { type: 'string', description: 'Revision ID to delete.' },
        },
        required: ['fileId', 'revisionId'],
      },
    },

    // --- Star & Label Operations ---
    {
      name: 'star_drive_file',
      description: 'Star or unstar a file in Google Drive.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          starred: { type: 'boolean', description: 'Set to true to star, false to unstar (default: true).' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'set_drive_file_properties',
      description: 'Set custom app properties on a file (key-value metadata for your app).',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          properties: { type: 'object', description: 'Key-value pairs to set as appProperties. Set a value to null to remove it.', additionalProperties: { type: 'string' } },
        },
        required: ['fileId', 'properties'],
      },
    },

    // --- Shared Drives (Team Drives) ---
    {
      name: 'list_shared_drives',
      description: 'List all shared drives (Team Drives) accessible to the user.',
      inputSchema: {
        type: 'object',
        properties: {
          pageSize: { type: 'number', description: 'Results per page (1-100, default 10).' },
          pageToken: { type: 'string', description: 'Page token.' },
          fields: { type: 'string', description: 'Fields to return.' },
        },
      },
    },
    {
      name: 'get_shared_drive',
      description: 'Get details about a specific shared drive.',
      inputSchema: {
        type: 'object',
        properties: {
          driveId: { type: 'string', description: 'Shared drive ID.' },
        },
        required: ['driveId'],
      },
    },
    {
      name: 'create_shared_drive',
      description: 'Create a new shared drive.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Shared drive name.' },
          requestId: { type: 'string', description: 'Optional request ID for idempotency (UUID recommended).' },
        },
        required: ['name'],
      },
    },
    {
      name: 'delete_shared_drive',
      description: 'Delete a shared drive. This is irreversible.',
      inputSchema: {
        type: 'object',
        properties: {
          driveId: { type: 'string', description: 'Shared drive ID.' },
        },
        required: ['driveId'],
      },
    },

    // --- About & Storage ---
    {
      name: 'get_drive_about',
      description: 'Get storage quota, user info, and total space used for the authenticated account.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // --- Shortcuts ---
    {
      name: 'create_drive_shortcut',
      description: 'Create a shortcut to another file or folder.',
      inputSchema: {
        type: 'object',
        properties: {
          targetFileId: { type: 'string', description: 'ID of the file/folder to shortcut to.' },
          name: { type: 'string', description: 'Shortcut name (default: target file name).' },
          parents: { type: 'array', items: { type: 'string' }, description: 'Parent folder IDs (default: root).' },
        },
        required: ['targetFileId'],
      },
    },
    {
      name: 'get_drive_shortcut_target',
      description: 'Get the target of a shortcut file.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'Shortcut file ID.' },
        },
        required: ['fileId'],
      },
    },

    // --- Export ---
    {
      name: 'export_drive_file',
      description: 'Export a Google Workspace file to a specified MIME type (e.g. PDF, DOCX, XLSX, CSV, TXT, HTML). Only works with Google Workspace files.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID.' },
          mimeType: { type: 'string', description: 'Export MIME type (e.g. "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document").' },
        },
        required: ['fileId', 'mimeType'],
      },
    },

    // --- Batch Operations ---
    {
      name: 'batch_update_drive_files',
      description: 'Batch update metadata (name, description, starred, etc.) for multiple files at once.',
      inputSchema: {
        type: 'object',
        properties: {
          fileIds: { type: 'array', items: { type: 'string' }, description: 'File IDs to update.' },
          name: { type: 'string', description: 'New name for all files.' },
          description: { type: 'string', description: 'New description for all files.' },
          starred: { type: 'boolean', description: 'Set starred state for all files.' },
        },
        required: ['fileIds'],
      },
    },
  ];
}

export async function executeTool(name: string, args: any, oauth2Client: any): Promise<any> {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    switch (name) {
      // === File Operations ===
      case 'list_drive_files': {
        const q = args.query || undefined;
        const fields = args.fields || 'files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink), nextPageToken';
        const res = await drive.files.list({
          q,
          fields,
          orderBy: args.orderBy || 'modifiedTime desc',
          pageSize: args.pageSize || 20,
          pageToken: args.pageToken || undefined,
          spaces: args.spaces || 'drive',
          includeItemsFromAllDrives: args.includeItemsFromAllDrives !== false,
          supportsAllDrives: args.supportsAllDrives !== false,
        });
        return ok({
          files: res.data.files || [],
          nextPageToken: res.data.nextPageToken || null,
          incompleteSearch: res.data.incompleteSearch || false,
        });
      }

      case 'get_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        const fields = args.fields || undefined;
        const res = await drive.files.get({
          fileId: args.fileId,
          fields,
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      case 'create_drive_file': {
        if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
        const metadata: any = { name: args.name };
        if (args.mimeType) metadata.mimeType = args.mimeType;
        if (args.parents) metadata.parents = args.parents;
        if (args.description) metadata.description = args.description;

        if (args.content) {
          const buf = Buffer.from(args.content, 'base64');
          const res = await drive.files.create({
            requestBody: metadata,
            media: {
              mimeType: args.mimeType || 'application/octet-stream',
              body: Readable.from(buf),
            },
            fields: 'id, name, mimeType, size, createdTime, webViewLink',
            supportsAllDrives: true,
          });
          return ok(res.data);
        }
        const res = await drive.files.create({
          requestBody: metadata,
          fields: 'id, name, mimeType, size, createdTime, webViewLink',
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      case 'update_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        const metadata: any = {};
        const updateFields: string[] = [];
        if (args.name !== undefined) { metadata.name = args.name; updateFields.push('name'); }
        if (args.description !== undefined) { metadata.description = args.description; updateFields.push('description'); }
        if (args.mimeType !== undefined) { metadata.mimeType = args.mimeType; updateFields.push('mimeType'); }

        const updateOpts: any = {
          fileId: args.fileId,
          requestBody: metadata,
          supportsAllDrives: true,
        };
        if (updateFields.length > 0) {
          updateOpts.fields = 'id, name, description, mimeType, modifiedTime';
        }
        if (args.addParents) updateOpts.addParents = (args.addParents as string[]).join(',');
        if (args.removeParents) updateOpts.removeParents = (args.removeParents as string[]).join(',');

        const res = await drive.files.update(updateOpts);
        return ok(res.data);
      }

      case 'delete_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (args.permanent) {
          await drive.files.delete({ fileId: args.fileId, supportsAllDrives: true });
        } else {
          await drive.files.delete({ fileId: args.fileId, supportsAllDrives: true });
        }
        return ok({ success: true, message: args.permanent ? 'File permanently deleted' : 'File moved to trash', fileId: args.fileId });
      }

      case 'copy_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        const metadata: any = {};
        if (args.name) metadata.name = args.name;
        if (args.parents) metadata.parents = args.parents;
        if (args.description) metadata.description = args.description;

        const res = await drive.files.copy({
          fileId: args.fileId,
          requestBody: metadata,
          fields: 'id, name, mimeType, size, createdTime, webViewLink',
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      case 'download_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        const fileRes = await drive.files.get({
          fileId: args.fileId,
          fields: 'id, name, mimeType, size',
          supportsAllDrives: true,
        });
        const file = fileRes.data;
        if (!file.mimeType?.startsWith('application/vnd.google-apps.')) {
          const dlRes = await drive.files.get({
            fileId: args.fileId,
            alt: 'media',
            supportsAllDrives: true,
          });
          const chunks: Buffer[] = [];
          for await (const chunk of dlRes.data as any) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const buf = Buffer.concat(chunks);
          return ok({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            base64Content: buf.toString('base64'),
          });
        }
        return ok({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          note: 'This is a Google Workspace file. Use export_drive_file to download as PDF, DOCX, etc.',
        });
      }

      case 'search_drive_files': {
        if (!args.q) throw new McpError(ErrorCode.InvalidParams, 'q (query) is required');
        const res = await drive.files.list({
          q: args.q,
          fields: args.fields || 'files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink), nextPageToken',
          orderBy: args.orderBy || undefined,
          pageSize: args.pageSize || 20,
          pageToken: args.pageToken || undefined,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        });
        return ok({
          files: res.data.files || [],
          nextPageToken: res.data.nextPageToken || null,
          incompleteSearch: res.data.incompleteSearch || false,
        });
      }

      // === Folder Operations ===
      case 'create_drive_folder': {
        if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
        const metadata: any = {
          name: args.name,
          mimeType: 'application/vnd.google-apps.folder',
        };
        if (args.parents) metadata.parents = args.parents;

        const res = await drive.files.create({
          requestBody: metadata,
          fields: 'id, name, mimeType, createdTime, webViewLink',
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      case 'list_drive_folder_contents': {
        if (!args.folderId) throw new McpError(ErrorCode.InvalidParams, 'folderId is required');
        const q = `'${args.folderId}' in parents and trashed=false`;
        const res = await drive.files.list({
          q,
          fields: args.fields || 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink), nextPageToken',
          orderBy: args.orderBy || 'name',
          pageSize: args.pageSize || 100,
          pageToken: args.pageToken || undefined,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        });
        return ok({
          folderId: args.folderId,
          files: res.data.files || [],
          nextPageToken: res.data.nextPageToken || null,
        });
      }

      case 'move_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.addParents || !args.removeParents) throw new McpError(ErrorCode.InvalidParams, 'addParents and removeParents are required');
        const res = await drive.files.update({
          fileId: args.fileId,
          addParents: (args.addParents as string[]).join(','),
          removeParents: (args.removeParents as string[]).join(','),
          fields: 'id, name, parents',
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      // === Permission Operations ===
      case 'add_drive_permission': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.type) throw new McpError(ErrorCode.InvalidParams, 'type is required');
        if (!args.role) throw new McpError(ErrorCode.InvalidParams, 'role is required');
        if ((args.type === 'user' || args.type === 'group') && !args.emailAddress) {
          throw new McpError(ErrorCode.InvalidParams, 'emailAddress is required for user/group types');
        }
        if (args.type === 'domain' && !args.domain) {
          throw new McpError(ErrorCode.InvalidParams, 'domain is required for domain type');
        }

        const body: any = { type: args.type, role: args.role };
        if (args.emailAddress) body.emailAddress = args.emailAddress;
        if (args.domain) body.domain = args.domain;
        if (args.allowFileDiscovery !== undefined) body.allowFileDiscovery = args.allowFileDiscovery;

        const res = await drive.permissions.create({
          fileId: args.fileId,
          requestBody: body,
          sendNotificationEmail: args.sendNotificationEmail !== false,
          emailMessage: args.emailMessage || undefined,
          fields: 'id, type, role, emailAddress, displayName, domain',
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      case 'list_drive_permissions': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        const res = await drive.permissions.list({
          fileId: args.fileId,
          fields: args.fields || 'permissions(id, type, role, emailAddress, displayName, domain, deleted)',
          supportsAllDrives: true,
        });
        return ok({ permissions: res.data.permissions || [] });
      }

      case 'update_drive_permission': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.permissionId) throw new McpError(ErrorCode.InvalidParams, 'permissionId is required');
        if (!args.role) throw new McpError(ErrorCode.InvalidParams, 'role is required');

        const body: any = { role: args.role };
        if (args.transferOwnership) body.transferOwnership = true;

        await drive.permissions.update({
          fileId: args.fileId,
          permissionId: args.permissionId,
          requestBody: body,
          supportsAllDrives: true,
        });
        return ok({ success: true, message: 'Permission updated', fileId: args.fileId, permissionId: args.permissionId, role: args.role });
      }

      case 'remove_drive_permission': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.permissionId) throw new McpError(ErrorCode.InvalidParams, 'permissionId is required');

        await drive.permissions.delete({
          fileId: args.fileId,
          permissionId: args.permissionId,
          supportsAllDrives: true,
        });
        return ok({ success: true, message: 'Permission removed', fileId: args.fileId, permissionId: args.permissionId });
      }

      case 'share_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.emailAddress) throw new McpError(ErrorCode.InvalidParams, 'emailAddress is required');

        const role = args.role || 'reader';
        const type = args.type || 'user';
        const body: any = { type, role, emailAddress: args.emailAddress };

        const res = await drive.permissions.create({
          fileId: args.fileId,
          requestBody: body,
          sendNotificationEmail: args.sendNotificationEmail !== false,
          emailMessage: args.emailMessage || undefined,
          fields: 'id, type, role, emailAddress, displayName',
          supportsAllDrives: true,
        });
        return ok({
          success: true,
          permissionId: res.data.id,
          type: res.data.type,
          role: res.data.role,
          emailAddress: res.data.emailAddress,
          displayName: res.data.displayName,
          fileId: args.fileId,
        });
      }

      // === Comment Operations ===
      case 'add_drive_comment': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.content) throw new McpError(ErrorCode.InvalidParams, 'content is required');

        const body: any = { content: args.content };
        if (args.anchor) body.anchor = args.anchor;

        const res = await drive.comments.create({
          fileId: args.fileId,
          requestBody: body,
          fields: 'id, content, author, createdTime, modifiedTime',
        });
        return ok(res.data);
      }

      case 'list_drive_comments': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');

        const res = await drive.comments.list({
          fileId: args.fileId,
          pageSize: args.pageSize || 20,
          pageToken: args.pageToken || undefined,
          includeDeleted: args.includeDeleted || false,
          fields: args.fields || 'comments(id, content, author, createdTime, modifiedTime, resolved, deleted), nextPageToken',
        });
        return ok({
          comments: res.data.comments || [],
          nextPageToken: res.data.nextPageToken || null,
        });
      }

      case 'resolve_drive_comment': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.commentId) throw new McpError(ErrorCode.InvalidParams, 'commentId is required');

        // First get the existing comment content (required by the API)
        const existing = await drive.comments.get({
          fileId: args.fileId,
          commentId: args.commentId,
          fields: 'id, content',
        });
        const resolved = args.resolved !== false;
        const res = await drive.comments.update({
          fileId: args.fileId,
          commentId: args.commentId,
          requestBody: { resolved, content: existing.data.content || '' },
          fields: 'id, content, resolved',
        });
        return ok(res.data);
      }

      // === Revision Operations ===
      case 'list_drive_revisions': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');

        const res = await drive.revisions.list({
          fileId: args.fileId,
        });
        return ok({ revisions: res.data.revisions || [] });
      }

      case 'get_drive_revision': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.revisionId) throw new McpError(ErrorCode.InvalidParams, 'revisionId is required');

        const res = await drive.revisions.get({
          fileId: args.fileId,
          revisionId: args.revisionId,
        });
        return ok(res.data);
      }

      case 'delete_drive_revision': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.revisionId) throw new McpError(ErrorCode.InvalidParams, 'revisionId is required');

        await drive.revisions.delete({
          fileId: args.fileId,
          revisionId: args.revisionId,
        });
        return ok({ success: true, message: 'Revision deleted', fileId: args.fileId, revisionId: args.revisionId });
      }

      // === Star & Label Operations ===
      case 'star_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');

        const starred = args.starred !== false;
        const res = await drive.files.update({
          fileId: args.fileId,
          requestBody: { starred },
          fields: 'id, name, starred',
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      case 'set_drive_file_properties': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.properties || typeof args.properties !== 'object') {
          throw new McpError(ErrorCode.InvalidParams, 'properties object is required');
        }

        const res = await drive.files.update({
          fileId: args.fileId,
          requestBody: { appProperties: args.properties },
          fields: 'id, name, appProperties',
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      // === Shared Drives ===
      case 'list_shared_drives': {
        const res = await drive.drives.list({
          pageSize: args.pageSize || 10,
          pageToken: args.pageToken || undefined,
          fields: args.fields || 'drives(id, name, createdTime, kind), nextPageToken',
        });
        return ok({
          drives: res.data.drives || [],
          nextPageToken: res.data.nextPageToken || null,
        });
      }

      case 'get_shared_drive': {
        if (!args.driveId) throw new McpError(ErrorCode.InvalidParams, 'driveId is required');

        const res = await drive.drives.get({ driveId: args.driveId });
        return ok(res.data);
      }

      case 'create_shared_drive': {
        if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');

        const requestId = args.requestId || crypto.randomUUID();
        const res = await drive.drives.create({
          requestId,
          requestBody: { name: args.name },
        });
        return ok(res.data);
      }

      case 'delete_shared_drive': {
        if (!args.driveId) throw new McpError(ErrorCode.InvalidParams, 'driveId is required');

        await drive.drives.delete({ driveId: args.driveId });
        return ok({ success: true, message: 'Shared drive deleted', driveId: args.driveId });
      }

      // === About & Storage ===
      case 'get_drive_about': {
        const res = await drive.about.get({
          fields: 'user, storageQuota, appInstalled',
        });
        return ok(res.data);
      }

      // === Shortcuts ===
      case 'create_drive_shortcut': {
        if (!args.targetFileId) throw new McpError(ErrorCode.InvalidParams, 'targetFileId is required');

        const metadata: any = {
          name: args.name || undefined,
          mimeType: 'application/vnd.google-apps.shortcut',
          shortcutDetails: { targetId: args.targetFileId },
        };
        if (args.parents) metadata.parents = args.parents;

        const res = await drive.files.create({
          requestBody: metadata,
          fields: 'id, name, mimeType, shortcutDetails, createdTime',
          supportsAllDrives: true,
        });
        return ok(res.data);
      }

      case 'get_drive_shortcut_target': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');

        const res = await drive.files.get({
          fileId: args.fileId,
          fields: 'id, name, shortcutDetails(targetId, targetMimeType)',
          supportsAllDrives: true,
        });
        const shortcut = res.data;
        if (!shortcut.shortcutDetails) {
          throw new McpError(ErrorCode.InvalidParams, 'File is not a shortcut');
        }
        const targetRes = await drive.files.get({
          fileId: shortcut.shortcutDetails.targetId!,
          supportsAllDrives: true,
        });
        return ok({
          shortcut: { id: shortcut.id, name: shortcut.name },
          target: targetRes.data,
        });
      }

      // === Export ===
      case 'export_drive_file': {
        if (!args.fileId) throw new McpError(ErrorCode.InvalidParams, 'fileId is required');
        if (!args.mimeType) throw new McpError(ErrorCode.InvalidParams, 'mimeType is required');

        const res = await drive.files.export({
          fileId: args.fileId,
          mimeType: args.mimeType,
        });
        const chunks: Buffer[] = [];
        for await (const chunk of res.data as any) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const buf = Buffer.concat(chunks);
        const fileRes = await drive.files.get({
          fileId: args.fileId,
          fields: 'id, name, mimeType',
          supportsAllDrives: true,
        });
        return ok({
          id: fileRes.data.id,
          name: fileRes.data.name,
          originalMimeType: fileRes.data.mimeType,
          exportedMimeType: args.mimeType,
          base64Content: buf.toString('base64'),
          size: buf.length,
        });
      }

      // === Batch Operations ===
      case 'batch_update_drive_files': {
        if (!args.fileIds || !Array.isArray(args.fileIds) || args.fileIds.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'fileIds array is required and must not be empty');
        }
        if (!args.name && !args.description && args.starred === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'At least one of name, description, or starred must be provided');
        }

        const metadata: any = {};
        if (args.name !== undefined) metadata.name = args.name;
        if (args.description !== undefined) metadata.description = args.description;
        if (args.starred !== undefined) metadata.starred = args.starred;

        const results = await Promise.allSettled(
          args.fileIds.map(async (fileId: string) => {
            const res = await drive.files.update({
              fileId,
              requestBody: metadata,
              fields: 'id, name, description, starred, modifiedTime',
              supportsAllDrives: true,
            });
            return { fileId, success: true, data: res.data };
          })
        );

        const succeeded = results
          .map((r, i) => (r.status === 'fulfilled' ? r.value : { fileId: args.fileIds[i], success: false, error: (r as any).reason?.message }))
          .filter((r: any) => r.success);
        const failed = results
          .map((r, i) => (r.status === 'fulfilled' ? null : { fileId: args.fileIds[i], error: (r as any).reason?.message }))
          .filter(Boolean);

        return ok({
          total: args.fileIds.length,
          succeeded: succeeded.length,
          failed: failed.length,
          succeededFiles: succeeded,
          failedFiles: failed,
        });
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (error instanceof McpError) throw error;
    const msg = error?.message || String(error);
    console.error(`Drive tool ${name} error:`, msg);
    throw new McpError(ErrorCode.InternalError, `Drive API error in ${name}: ${msg}`);
  }
}
