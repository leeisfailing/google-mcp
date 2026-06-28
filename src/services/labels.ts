import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

interface RequestAdapter {
  request(opts: { url: string; method: string; data?: any; params?: any; headers?: Record<string, string> }): Promise<any>;
}

// ---------------------------------------------------------------------------
// Drive Labels REST API v2 helpers
// ---------------------------------------------------------------------------

const LABELS_BASE = 'https://drivelabels.googleapis.com/v2';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

async function labelsGet(client: RequestAdapter, path: string, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return client.request({ url: `${LABELS_BASE}${path}${qs}`, method: 'GET' });
}

async function labelsPost(client: RequestAdapter, path: string, data?: any, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return client.request({ url: `${LABELS_BASE}${path}${qs}`, method: 'POST', data });
}

async function labelsPatch(client: RequestAdapter, path: string, data?: any, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return client.request({ url: `${LABELS_BASE}${path}${qs}`, method: 'PATCH', data });
}

async function labelsDelete(client: RequestAdapter, path: string) {
  return client.request({ url: `${LABELS_BASE}${path}`, method: 'DELETE' });
}

async function drivePost(client: RequestAdapter, path: string, data?: any) {
  return client.request({ url: `${DRIVE_BASE}${path}`, method: 'POST', data });
}

async function driveGet(client: RequestAdapter, path: string, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return client.request({ url: `${DRIVE_BASE}${path}${qs}`, method: 'GET' });
}

function ok(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function requireParam(args: Record<string, any>, key: string): string {
  const val = args[key];
  if (val === undefined || val === null || val === '') {
    throw new McpError(ErrorCode.InvalidParams, `${key} is required`);
  }
  return String(val);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const tools: ToolDefinition[] = [
  // ── Label Management ──────────────────────────────────────────────────────
  {
    name: 'list_drive_labels',
    description: 'List all Drive labels in the domain. Supports filtering by visibility and published status.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Filter expression, e.g. "labelType = ADMIN" or "published = true"',
        },
        visibility: {
          type: 'string',
          description: 'Visibility filter: ADMIN, MANAGER, READER',
        },
        publishedOnly: {
          type: 'boolean',
          description: 'If true, only return published labels',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default 100)',
        },
        pageToken: {
          type: 'string',
          description: 'Page token for pagination',
        },
      },
    },
  },
  {
    name: 'get_drive_label',
    description: 'Get detailed information about a specific Drive label including its fields and properties.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        view: { type: 'string', description: 'View: ADMIN, MANAGER, or READER' },
      },
      required: ['labelId'],
    },
  },
  {
    name: 'create_drive_label',
    description: 'Create a new Drive label. Can create ADMIN or USER type labels with optional initial fields.',
    inputSchema: {
      type: 'object',
      properties: {
        labelType: {
          type: 'string',
          enum: ['ADMIN', 'USER'],
          description: 'Label type: ADMIN (domain-wide) or USER (personal)',
        },
        title: { type: 'string', description: 'Display name of the label' },
        description: { type: 'string', description: 'Description of the label' },
        fields: {
          type: 'array',
          description: 'Optional array of field definitions to create with the label',
          items: {
            type: 'object',
            properties: {
              fieldType: {
                type: 'string',
                enum: ['TEXT', 'INTEGER', 'SELECTION', 'DATE', 'USER', 'EMAIL'],
                description: 'Type of the field',
              },
              title: { type: 'string', description: 'Field title' },
              required: { type: 'boolean', description: 'Whether the field is required' },
              properties: { type: 'object', description: 'Field-type-specific properties' },
            },
          },
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_drive_label',
    description: 'Update a Drive label\'s title, description, or state (ENABLED/DISABLED).',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID to update' },
        title: { type: 'string', description: 'New title (optional)' },
        description: { type: 'string', description: 'New description (optional)' },
        state: {
          type: 'string',
          enum: ['ENABLED', 'DISABLED'],
          description: 'New state for the label',
        },
        updateMask: {
          type: 'string',
          description: 'Comma-separated list of fields to update, e.g. "title,description"',
        },
      },
      required: ['labelId'],
    },
  },
  {
    name: 'delete_drive_label',
    description: 'Delete a custom Drive label. The label must be disabled before deletion.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID to delete' },
      },
      required: ['labelId'],
    },
  },
  {
    name: 'disable_drive_label',
    description: 'Disable a Drive label. Disabled labels cannot be applied to new files and become read-only on existing files.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID to disable' },
      },
      required: ['labelId'],
    },
  },
  {
    name: 'enable_drive_label',
    description: 'Enable a Drive label so it can be applied to files.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID to enable' },
      },
      required: ['labelId'],
    },
  },

  // ── Label Field Management ────────────────────────────────────────────────
  {
    name: 'add_label_field',
    description: 'Add a new field to a Drive label definition. Fields define what data a label can hold.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID to add the field to' },
        fieldType: {
          type: 'string',
          enum: ['TEXT', 'INTEGER', 'SELECTION', 'DATE', 'USER', 'EMAIL'],
          description: 'Type of the field',
        },
        title: { type: 'string', description: 'Field display title' },
        required: { type: 'boolean', description: 'Whether this field is required when applying the label' },
        properties: {
          type: 'object',
          description: 'Field-type properties. For SELECTION: { options: [{ id, shortValue, longValue }] }',
        },
      },
      required: ['labelId', 'fieldType', 'title'],
    },
  },
  {
    name: 'update_label_field',
    description: 'Update properties of an existing field on a Drive label.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        fieldId: { type: 'string', description: 'Field ID to update' },
        title: { type: 'string', description: 'New field title (optional)' },
        required: { type: 'boolean', description: 'Whether the field is required (optional)' },
        properties: { type: 'object', description: 'Updated field properties (optional)' },
        updateMask: {
          type: 'string',
          description: 'Comma-separated list of fields to update',
        },
      },
      required: ['labelId', 'fieldId'],
    },
  },
  {
    name: 'delete_label_field',
    description: 'Remove a field from a Drive label definition.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        fieldId: { type: 'string', description: 'Field ID to delete' },
      },
      required: ['labelId', 'fieldId'],
    },
  },

  // ── Label Selection Options ───────────────────────────────────────────────
  {
    name: 'add_label_field_option',
    description: 'Add a selection option to a SELECTION-type field on a label.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        fieldId: { type: 'string', description: 'SELECTION field ID' },
        optionId: { type: 'string', description: 'Unique ID for the new option' },
        shortValue: { type: 'string', description: 'Short display value for the option' },
        longValue: { type: 'string', description: 'Long description for the option' },
        properties: { type: 'object', description: 'Additional option properties (e.g. colors)' },
      },
      required: ['labelId', 'fieldId', 'optionId', 'shortValue'],
    },
  },
  {
    name: 'update_label_field_option',
    description: 'Update a selection option\'s title or properties within a SELECTION field.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        fieldId: { type: 'string', description: 'SELECTION field ID' },
        optionId: { type: 'string', description: 'Option ID to update' },
        shortValue: { type: 'string', description: 'New short display value' },
        longValue: { type: 'string', description: 'New long description' },
        properties: { type: 'object', description: 'Updated option properties' },
        updateMask: { type: 'string', description: 'Comma-separated fields to update' },
      },
      required: ['labelId', 'fieldId', 'optionId'],
    },
  },
  {
    name: 'delete_label_field_option',
    description: 'Delete a selection option from a SELECTION-type field.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        fieldId: { type: 'string', description: 'SELECTION field ID' },
        optionId: { type: 'string', description: 'Option ID to delete' },
      },
      required: ['labelId', 'fieldId', 'optionId'],
    },
  },
  {
    name: 'reorder_label_field_options',
    description: 'Reorder the options within a SELECTION-type field. Provide the complete list of option IDs in the desired order.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        fieldId: { type: 'string', description: 'SELECTION field ID' },
        optionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ordered list of all option IDs',
        },
      },
      required: ['labelId', 'fieldId', 'optionIds'],
    },
  },

  // ── Applying Labels to Files ──────────────────────────────────────────────
  {
    name: 'apply_label_to_file',
    description: 'Apply a Drive label (with field values) to a file. Supports all field types: TEXT, INTEGER, SELECTION, DATE, USER, EMAIL.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        labelId: { type: 'string', description: 'Label ID to apply' },
        fieldValues: {
          type: 'object',
          description: 'Mapping of field IDs to their values. TEXT: string, INTEGER: number, SELECTION: { selectionIds: [id] }, DATE: { date: { year, month, day } }, USER/EMAIL: { userEmails: [email] }',
        },
      },
      required: ['fileId', 'labelId'],
    },
  },
  {
    name: 'remove_label_from_file',
    description: 'Remove a Drive label from a file.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        labelId: { type: 'string', description: 'Label ID to remove' },
      },
      required: ['fileId', 'labelId'],
    },
  },
  {
    name: 'update_label_values_on_file',
    description: 'Update the field values of an already-applied label on a file.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        labelId: { type: 'string', description: 'Label ID whose values to update' },
        fieldValues: {
          type: 'object',
          description: 'Mapping of field IDs to new values',
        },
      },
      required: ['fileId', 'labelId', 'fieldValues'],
    },
  },
  {
    name: 'list_file_labels',
    description: 'List all Drive labels applied to a file with their current field values.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'get_file_label',
    description: 'Get details of a specific label applied to a file.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        labelId: { type: 'string', description: 'Label ID to retrieve' },
      },
      required: ['fileId', 'labelId'],
    },
  },

  // ── Label Revision Operations ─────────────────────────────────────────────
  {
    name: 'list_label_revisions',
    description: 'List all revisions of a Drive label definition.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        maxResults: { type: 'number', description: 'Maximum number of revisions to return' },
        pageToken: { type: 'string', description: 'Page token for pagination' },
      },
      required: ['labelId'],
    },
  },
  {
    name: 'get_label_revision',
    description: 'Get a specific revision of a Drive label definition.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        revisionId: { type: 'string', description: 'Revision ID' },
      },
      required: ['labelId', 'revisionId'],
    },
  },
  {
    name: 'disable_label_revision',
    description: 'Disable a specific revision of a Drive label, making it read-only on files.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        revisionId: { type: 'string', description: 'Revision ID to disable' },
      },
      required: ['labelId', 'revisionId'],
    },
  },

  // ── Label Permissions ─────────────────────────────────────────────────────
  {
    name: 'get_label_permissions',
    description: 'Get the permission policy for a Drive label (who can read, use, or manage it).',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
      },
      required: ['labelId'],
    },
  },
  {
    name: 'update_label_permissions',
    description: 'Update the permission policy for a Drive label (who can use or manage it).',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID' },
        permissions: {
          type: 'array',
          description: 'Array of permission entries',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['READER', 'WRITER'], description: 'Permission role' },
              groupEmail: { type: 'string', description: 'Group email for group-based permissions' },
              email: { type: 'string', description: 'User email for user-based permissions' },
              domain: { type: 'string', description: 'Domain for domain-wide permissions' },
              roleSet: { type: 'string', description: 'Predefined role set' },
              teamDriveId: { type: 'string', description: 'Shared Drive ID for drive-based permissions' },
            },
          },
        },
      },
      required: ['labelId'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

function buildFieldValues(raw: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!raw) return undefined;
  const result: Record<string, any> = {};
  for (const [fieldId, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;

    // If it's already a properly structured object (has selectionIds, date, userEmails, etc.)
    if (typeof value === 'object' && !Array.isArray(value)) {
      result[fieldId] = value;
      continue;
    }

    // Plain string -> TEXT
    if (typeof value === 'string') {
      result[fieldId] = { text: value };
      continue;
    }

    // Plain number -> INTEGER
    if (typeof value === 'number') {
      result[fieldId] = { integerValue: value };
      continue;
    }

    // Array -> assume selection IDs
    if (Array.isArray(value)) {
      result[fieldId] = { selectionIds: value };
      continue;
    }

    result[fieldId] = value;
  }
  return result;
}

async function handleListDriveLabels(client: RequestAdapter, args: any) {
  const params: Record<string, string> = {};
  if (args.filter) params.filter = args.filter;
  if (args.visibility) params.visibility = args.visibility;
  if (args.publishedOnly) params.publishedOnly = 'true';
  if (args.maxResults) params.pageSize = String(args.maxResults);
  if (args.pageToken) params.pageToken = args.pageToken;

  const res = await labelsGet(client, '/labels', Object.keys(params).length ? params : undefined);
  return ok(res.data);
}

async function handleGetDriveLabel(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const params: Record<string, string> = {};
  if (args.view) params.view = args.view;

  const res = await labelsGet(client, `/labels/${labelId}`, Object.keys(params).length ? params : undefined);
  return ok(res.data);
}

async function handleCreateDriveLabel(client: RequestAdapter, args: any) {
  const body: any = {};
  if (args.labelType) body.labelType = args.labelType;
  if (args.title) body.title = args.title;
  if (args.description) body.description = args.description;
  if (args.fields && args.fields.length > 0) {
    body.fields = args.fields.map((f: any) => {
      const field: any = { fieldType: f.fieldType, title: f.title };
      if (f.required !== undefined) field.required = f.required;
      if (f.properties) field.properties = f.properties;
      return field;
    });
  }

  const res = await labelsPost(client, '/labels', body);
  return ok(res.data);
}

async function handleUpdateDriveLabel(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const body: any = {};
  if (args.title !== undefined) body.title = args.title;
  if (args.description !== undefined) body.description = args.description;
  if (args.state !== undefined) body.state = args.state;

  const params: Record<string, string> = {};
  if (args.updateMask) params.updateMask = args.updateMask;

  const res = await labelsPatch(client, `/labels/${labelId}`, body, Object.keys(params).length ? params : undefined);
  return ok(res.data);
}

async function handleDeleteDriveLabel(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  await labelsDelete(client, `/labels/${labelId}`);
  return ok({ success: true, message: `Label ${labelId} deleted` });
}

async function handleDisableDriveLabel(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const res = await labelsPatch(client, `/labels/${labelId}`, { state: 'DISABLED' }, { updateMask: 'state' });
  return ok(res.data);
}

async function handleEnableDriveLabel(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const res = await labelsPatch(client, `/labels/${labelId}`, { state: 'ENABLED' }, { updateMask: 'state' });
  return ok(res.data);
}

// ── Field management ──────────────────────────────────────────────────────

async function handleAddLabelField(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const body: any = {
    fieldType: args.fieldType,
    title: args.title,
  };
  if (args.required !== undefined) body.required = args.required;
  if (args.properties) body.properties = args.properties;

  const res = await labelsPost(client, `/labels/${labelId}/fields`, body);
  return ok(res.data);
}

async function handleUpdateLabelField(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const fieldId = requireParam(args, 'fieldId');
  const body: any = {};
  if (args.title !== undefined) body.title = args.title;
  if (args.required !== undefined) body.required = args.required;
  if (args.properties) body.properties = args.properties;

  const params: Record<string, string> = {};
  if (args.updateMask) params.updateMask = args.updateMask;

  const res = await labelsPatch(client, `/labels/${labelId}/fields/${fieldId}`, body, Object.keys(params).length ? params : undefined);
  return ok(res.data);
}

async function handleDeleteLabelField(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const fieldId = requireParam(args, 'fieldId');
  await labelsDelete(client, `/labels/${labelId}/fields/${fieldId}`);
  return ok({ success: true, message: `Field ${fieldId} deleted from label ${labelId}` });
}

// ── Selection options ─────────────────────────────────────────────────────

async function handleAddLabelFieldOption(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const fieldId = requireParam(args, 'fieldId');
  const body: any = {
    optionId: args.optionId,
    shortValue: args.shortValue,
  };
  if (args.longValue !== undefined) body.longValue = args.longValue;
  if (args.properties) body.properties = args.properties;

  const res = await labelsPost(client, `/labels/${labelId}/fields/${fieldId}/options`, body);
  return ok(res.data);
}

async function handleUpdateLabelFieldOption(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const fieldId = requireParam(args, 'fieldId');
  const optionId = requireParam(args, 'optionId');
  const body: any = {};
  if (args.shortValue !== undefined) body.shortValue = args.shortValue;
  if (args.longValue !== undefined) body.longValue = args.longValue;
  if (args.properties) body.properties = args.properties;

  const params: Record<string, string> = {};
  if (args.updateMask) params.updateMask = args.updateMask;

  const res = await labelsPatch(client, `/labels/${labelId}/fields/${fieldId}/options/${optionId}`, body, Object.keys(params).length ? params : undefined);
  return ok(res.data);
}

async function handleDeleteLabelFieldOption(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const fieldId = requireParam(args, 'fieldId');
  const optionId = requireParam(args, 'optionId');
  await labelsDelete(client, `/labels/${labelId}/fields/${fieldId}/options/${optionId}`);
  return ok({ success: true, message: `Option ${optionId} deleted from field ${fieldId}` });
}

async function handleReorderLabelFieldOptions(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const fieldId = requireParam(args, 'fieldId');
  const optionIds: string[] = args.optionIds;
  if (!Array.isArray(optionIds) || optionIds.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, 'optionIds must be a non-empty array');
  }

  // The API expects a PATCH with the options in the desired order
  const body = {
    options: optionIds.map((id) => ({ optionId: id })),
  };

  const res = await labelsPatch(client, `/labels/${labelId}/fields/${fieldId}`, body, { updateMask: 'selectionOptions' });
  return ok(res.data);
}

// ── Applying labels to files ──────────────────────────────────────────────

async function handleApplyLabelToFile(client: RequestAdapter, args: any) {
  const fileId = requireParam(args, 'fileId');
  const labelId = requireParam(args, 'labelId');
  const fieldValues = buildFieldValues(args.fieldValues);

  const body: any = {
    modifyLabelRequests: [
      {
        addLabel: {
          labelId,
        },
      },
    ],
  };

  if (fieldValues) {
    body.modifyLabelRequests[0].addLabel.fieldValues = fieldValues;
  }

  const res = await drivePost(client, `/files/${fileId}/modifyLabels`, body);
  return ok(res.data);
}

async function handleRemoveLabelFromFile(client: RequestAdapter, args: any) {
  const fileId = requireParam(args, 'fileId');
  const labelId = requireParam(args, 'labelId');

  const body = {
    modifyLabelRequests: [
      {
        removeLabel: {
          labelId,
        },
      },
    ],
  };

  const res = await drivePost(client, `/files/${fileId}/modifyLabels`, body);
  return ok(res.data);
}

async function handleUpdateLabelValuesOnFile(client: RequestAdapter, args: any) {
  const fileId = requireParam(args, 'fileId');
  const labelId = requireParam(args, 'labelId');
  const fieldValues = buildFieldValues(args.fieldValues);

  if (!fieldValues) {
    throw new McpError(ErrorCode.InvalidParams, 'fieldValues must be provided');
  }

  const body = {
    modifyLabelRequests: [
      {
        updateFieldValues: {
          labelId,
          fieldValues,
        },
      },
    ],
  };

  const res = await drivePost(client, `/files/${fileId}/modifyLabels`, body);
  return ok(res.data);
}

async function handleListFileLabels(client: RequestAdapter, args: any) {
  const fileId = requireParam(args, 'fileId');
  const res = await driveGet(client, `/files/${fileId}/labels`);
  return ok(res.data);
}

async function handleGetFileLabel(client: RequestAdapter, args: any) {
  const fileId = requireParam(args, 'fileId');
  const labelId = requireParam(args, 'labelId');
  const res = await driveGet(client, `/files/${fileId}/labels/${labelId}`);
  return ok(res.data);
}

// ── Label revisions ───────────────────────────────────────────────────────

async function handleListLabelRevisions(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const params: Record<string, string> = {};
  if (args.maxResults) params.pageSize = String(args.maxResults);
  if (args.pageToken) params.pageToken = args.pageToken;

  const res = await labelsGet(client, `/labels/${labelId}/revisions`, Object.keys(params).length ? params : undefined);
  return ok(res.data);
}

async function handleGetLabelRevision(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const revisionId = requireParam(args, 'revisionId');
  const res = await labelsGet(client, `/labels/${labelId}/revisions/${revisionId}`);
  return ok(res.data);
}

async function handleDisableLabelRevision(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const revisionId = requireParam(args, 'revisionId');
  const res = await labelsPatch(client, `/labels/${labelId}/revisions/${revisionId}`, { state: 'DISABLED' });
  return ok(res.data);
}

// ── Label permissions ─────────────────────────────────────────────────────

async function handleGetLabelPermissions(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const res = await labelsGet(client, `/labels/${labelId}/permissions`);
  return ok(res.data);
}

async function handleUpdateLabelPermissions(client: RequestAdapter, args: any) {
  const labelId = requireParam(args, 'labelId');
  const body: any = {};
  if (args.permissions) {
    body.permissions = args.permissions;
  }

  const res = await labelsPost(client, `/labels/${labelId}:setPermissions`, body);
  return ok(res.data);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const handlers: Record<string, (client: RequestAdapter, args: any) => Promise<any>> = {
  list_drive_labels: handleListDriveLabels,
  get_drive_label: handleGetDriveLabel,
  create_drive_label: handleCreateDriveLabel,
  update_drive_label: handleUpdateDriveLabel,
  delete_drive_label: handleDeleteDriveLabel,
  disable_drive_label: handleDisableDriveLabel,
  enable_drive_label: handleEnableDriveLabel,
  add_label_field: handleAddLabelField,
  update_label_field: handleUpdateLabelField,
  delete_label_field: handleDeleteLabelField,
  add_label_field_option: handleAddLabelFieldOption,
  update_label_field_option: handleUpdateLabelFieldOption,
  delete_label_field_option: handleDeleteLabelFieldOption,
  reorder_label_field_options: handleReorderLabelFieldOptions,
  apply_label_to_file: handleApplyLabelToFile,
  remove_label_from_file: handleRemoveLabelFromFile,
  update_label_values_on_file: handleUpdateLabelValuesOnFile,
  list_file_labels: handleListFileLabels,
  get_file_label: handleGetFileLabel,
  list_label_revisions: handleListLabelRevisions,
  get_label_revision: handleGetLabelRevision,
  disable_label_revision: handleDisableLabelRevision,
  get_label_permissions: handleGetLabelPermissions,
  update_label_permissions: handleUpdateLabelPermissions,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getTools(): ToolDefinition[] {
  return tools;
}

export async function executeTool(name: string, args: any, oauth2Client: RequestAdapter): Promise<any> {
  const handler = handlers[name];
  if (!handler) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
  return handler(oauth2Client, args || {});
}
