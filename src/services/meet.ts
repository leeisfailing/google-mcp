/**
 * Google Meet MCP Service Module
 *
 * Provides tools for managing Google Meet conferences, including:
 * - Creating and managing meeting spaces
 * - Listing meetings via Calendar API integration
 * - Managing meeting recordings and transcripts
 * - Creating calendar events with Meet links
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
// Constants
// ---------------------------------------------------------------------------

const MEET_BASE_URL = 'https://meet.googleapis.com/v2';
const MEET_SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): never {
  throw new McpError(ErrorCode.InternalError, message);
}

/**
 * Thin wrapper around oauth2Client.request for Meet REST API calls.
 * Automatically adds the API key header when no access token is present
 * (though in practice we always use OAuth for Meet).
 */
async function meetRequest(
  oauth2Client: any,
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT',
  path: string,
  body?: Record<string, unknown>,
) {
  try {
    const res = await oauth2Client.request({
      method,
      url: `${MEET_BASE_URL}${path}`,
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    return res.data;
  } catch (err: any) {
    const status = err.code || err.response?.status || 'unknown';
    const detail = err.errors?.[0]?.message || err.message || String(err);
    fail(`Meet API error (${status}): ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

const tools: ToolDefinition[] = [
  // ---- Conference (Meet) Operations ----
  {
    name: 'create_meeting_space',
    description:
      'Create a new Google Meet conference space. Returns the meeting URI, meeting ID, and configuration. Optionally set accessType (OPEN, TRUSTED, RESTRICTED).',
    inputSchema: {
      type: 'object',
      properties: {
        accessType: {
          type: 'string',
          enum: ['OPEN', 'TRUSTED', 'RESTRICTED'],
          description:
            'Access type for the meeting. OPEN = anyone can join, TRUSTED = only signed-in users, RESTRICTED = only invited users. Default: OPEN.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_meeting_space',
    description: 'Get details of an existing Google Meet conference by its conference ID.',
    inputSchema: {
      type: 'object',
      properties: {
        conferenceId: {
          type: 'string',
          description: 'The conference ID (the part after meet.google.com/ in the URL).',
        },
      },
      required: ['conferenceId'],
    },
  },
  {
    name: 'list_meetings',
    description:
      'List recent Google Meet conferences by scanning Calendar events. Uses the Calendar API to find events with conferenceData that contain a Google Meet conference.',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: {
          type: 'string',
          description:
            'Start of the time range (ISO 8601, e.g. 2026-06-01T00:00:00Z). Defaults to 7 days ago.',
        },
        timeMax: {
          type: 'string',
          description:
            'End of the time range (ISO 8601, e.g. 2026-06-30T23:59:59Z). Defaults to now.',
        },
        calendarId: {
          type: 'string',
          description: 'Calendar ID to search. Defaults to "primary".',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default 25, max 250).',
        },
      },
      required: [],
    },
  },
  {
    name: 'delete_meeting_space',
    description:
      'Delete (end) a Google Meet conference. You must be the meeting organizer/host to do this.',
    inputSchema: {
      type: 'object',
      properties: {
        conferenceId: {
          type: 'string',
          description: 'The conference ID to delete/end.',
        },
      },
      required: ['conferenceId'],
    },
  },
  {
    name: 'get_meeting_participants',
    description:
      'List participants currently in a Google Meet conference. Note: this endpoint may require beta API access.',
    inputSchema: {
      type: 'object',
      properties: {
        conferenceId: {
          type: 'string',
          description: 'The conference ID to get participants for.',
        },
      },
      required: ['conferenceId'],
    },
  },

  // ---- Conference Record Operations ----
  {
    name: 'list_meeting_records',
    description:
      'List meeting records (recordings, transcripts metadata) for the authenticated user. These records represent past meetings that had recording or transcription enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: {
          type: 'number',
          description: 'Number of records to return per page (default 10, max 100).',
        },
        pageToken: {
          type: 'string',
          description: 'Page token for pagination from a previous list call.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_meeting_record',
    description: 'Get a specific meeting record by its name (resource ID).',
    inputSchema: {
      type: 'object',
      properties: {
        recordName: {
          type: 'string',
          description:
            'The meeting record name, e.g. "conferenceRecords/abcd1234".',
        },
      },
      required: ['recordName'],
    },
  },
  {
    name: 'get_meeting_recording',
    description: 'Get recording information for a specific meeting record.',
    inputSchema: {
      type: 'object',
      properties: {
        recordingName: {
          type: 'string',
          description:
            'The recording resource name, e.g. "conferenceRecords/abcd1234/recordings/efgh5678".',
        },
      },
      required: ['recordingName'],
    },
  },
  {
    name: 'get_meeting_transcript',
    description: 'Get transcript information for a specific meeting record.',
    inputSchema: {
      type: 'object',
      properties: {
        transcriptName: {
          type: 'string',
          description:
            'The transcript resource name, e.g. "conferenceRecords/abcd1234/transcripts/efgh5678".',
        },
      },
      required: ['transcriptName'],
    },
  },

  // ---- Convenience Tools (Calendar + Meet) ----
  {
    name: 'create_meeting_event',
    description:
      'Create a Calendar event with an auto-generated Google Meet conference link. Returns the event details along with the meeting URI.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Event title/summary.',
        },
        description: {
          type: 'string',
          description: 'Event description (optional).',
        },
        startTime: {
          type: 'string',
          description:
            'Event start time in ISO 8601 format, e.g. "2026-06-15T10:00:00" or "2026-06-15T10:00:00+05:30".',
        },
        endTime: {
          type: 'string',
          description: 'Event end time in ISO 8601 format.',
        },
        timeZone: {
          type: 'string',
          description:
            'IANA time zone for the event, e.g. "America/New_York", "Asia/Kolkata". Defaults to "UTC".',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of attendee email addresses (optional).',
        },
        calendarId: {
          type: 'string',
          description: 'Calendar ID to create the event on. Defaults to "primary".',
        },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
  },
  {
    name: 'get_meeting_from_event',
    description:
      'Extract the Google Meet conference details from an existing Calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The Calendar event ID.',
        },
        calendarId: {
          type: 'string',
          description: 'Calendar ID. Defaults to "primary".',
        },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'update_meeting_access',
    description:
      'Update the access settings of a Google Meet conference (e.g. change from OPEN to RESTRICTED).',
    inputSchema: {
      type: 'object',
      properties: {
        conferenceId: {
          type: 'string',
          description: 'The conference ID to update.',
        },
        accessType: {
          type: 'string',
          enum: ['OPEN', 'TRUSTED', 'RESTRICTED'],
          description: 'The new access type for the meeting.',
        },
      },
      required: ['conferenceId', 'accessType'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function createMeetingSpace(args: any, oauth2Client: any) {
  const body: Record<string, unknown> = {};
  if (args.accessType) {
    body.config = { accessType: args.accessType };
  }
  const data = await meetRequest(oauth2Client, 'POST', '/conferences', body);
  return ok(data);
}

async function getMeetingSpace(args: any, oauth2Client: any) {
  if (!args.conferenceId) fail('conferenceId is required');
  const data = await meetRequest(oauth2Client, 'GET', `/conferences/${encodeURIComponent(args.conferenceId)}`);
  return ok(data);
}

async function listMeetings(args: any, oauth2Client: any) {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const timeMin = args.timeMin || sevenDaysAgo.toISOString();
  const timeMax = args.timeMax || now.toISOString();
  const calendarId = args.calendarId || 'primary';
  const maxResults = Math.min(args.maxResults || 25, 250);

  let pageToken: string | undefined;
  const allMeetings: any[] = [];

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults: Math.min(maxResults - allMeetings.length, 250),
      pageToken,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items || [];
    for (const event of events) {
      const conf = event.conferenceData;
      if (conf && conf.conferenceId) {
        allMeetings.push({
          eventId: event.id,
          summary: event.summary,
          description: event.description || '',
          startTime: event.start?.dateTime || event.start?.date,
          endTime: event.end?.dateTime || event.end?.date,
          organizer: event.organizer,
          attendees: (event.attendees || []).map((a: any) => ({
            email: a.email,
            displayName: a.displayName,
            responseStatus: a.responseStatus,
          })),
          conference: {
            conferenceId: conf.conferenceId,
            conferenceSolution: conf.conferenceSolution?.name,
            entryPoints: conf.entryPoints,
            meetingUri: conf.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri
              || conf.entryPoints?.[0]?.uri
              || '',
          },
          status: event.status,
          htmlLink: event.htmlLink,
        });
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && allMeetings.length < maxResults);

  return ok({
    total: allMeetings.length,
    timeRange: { timeMin, timeMax },
    calendarId,
    meetings: allMeetings.slice(0, maxResults),
  });
}

async function deleteMeetingSpace(args: any, oauth2Client: any) {
  if (!args.conferenceId) fail('conferenceId is required');
  await meetRequest(oauth2Client, 'DELETE', `/conferences/${encodeURIComponent(args.conferenceId)}`);
  return ok({ success: true, message: `Conference ${args.conferenceId} has been ended/deleted.` });
}

async function getMeetingParticipants(args: any, oauth2Client: any) {
  if (!args.conferenceId) fail('conferenceId is required');
  const data = await meetRequest(
    oauth2Client,
    'GET',
    `/conferences/${encodeURIComponent(args.conferenceId)}/participants`,
  );
  return ok(data);
}

async function listMeetingRecords(args: any, oauth2Client: any) {
  const pageSize = Math.min(args.pageSize || 10, 100);
  let url = `/conferenceRecords?pageSize=${pageSize}`;
  if (args.pageToken) {
    url += `&pageToken=${encodeURIComponent(args.pageToken)}`;
  }
  const data = await meetRequest(oauth2Client, 'GET', url);
  return ok(data);
}

async function getMeetingRecord(args: any, oauth2Client: any) {
  if (!args.recordName) fail('recordName is required');
  // recordName may already include the prefix, normalise
  const name = args.recordName.startsWith('conferenceRecords/')
    ? args.recordName
    : `conferenceRecords/${args.recordName}`;
  const data = await meetRequest(oauth2Client, 'GET', `/${name}`);
  return ok(data);
}

async function getMeetingRecording(args: any, oauth2Client: any) {
  if (!args.recordingName) fail('recordingName is required');
  const name = args.recordingName.startsWith('conferenceRecords/')
    ? args.recordingName
    : `conferenceRecords/${args.recordingName}`;
  const data = await meetRequest(oauth2Client, 'GET', `/${name}`);
  return ok(data);
}

async function getMeetingTranscript(args: any, oauth2Client: any) {
  if (!args.transcriptName) fail('transcriptName is required');
  const name = args.transcriptName.startsWith('conferenceRecords/')
    ? args.transcriptName
    : `conferenceRecords/${args.transcriptName}`;
  const data = await meetRequest(oauth2Client, 'GET', `/${name}`);
  return ok(data);
}

async function createMeetingEvent(args: any, oauth2Client: any) {
  if (!args.summary) fail('summary is required');
  if (!args.startTime) fail('startTime is required');
  if (!args.endTime) fail('endTime is required');

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const timeZone = args.timeZone || 'UTC';
  const calendarId = args.calendarId || 'primary';

  const eventBody: Record<string, any> = {
    summary: args.summary,
    description: args.description || '',
    start: {
      dateTime: args.startTime,
      timeZone,
    },
    end: {
      dateTime: args.endTime,
      timeZone,
    },
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  if (Array.isArray(args.attendees) && args.attendees.length > 0) {
    eventBody.attendees = args.attendees.map((email: string) => ({ email }));
  }

  const res = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
    conferenceDataVersion: 1,
  });

  const event = res.data;
  const conf = event.conferenceData;

  return ok({
    eventId: event.id,
    summary: event.summary,
    description: event.description,
    startTime: event.start?.dateTime || event.start?.date,
    endTime: event.end?.dateTime || event.end?.date,
    timeZone,
    organizer: event.organizer,
    attendees: (event.attendees || []).map((a: any) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
    })),
    conference: {
      conferenceId: conf?.conferenceId,
      conferenceSolution: conf?.conferenceSolution?.name,
      entryPoints: conf?.entryPoints,
      meetingUri:
        conf?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
        conf?.entryPoints?.[0]?.uri ||
        '',
    },
    htmlLink: event.htmlLink,
  });
}

async function getMeetingFromEvent(args: any, oauth2Client: any) {
  if (!args.eventId) fail('eventId is required');
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const calendarId = args.calendarId || 'primary';

  const res = await calendar.events.get({ calendarId, eventId: args.eventId });
  const event = res.data;
  const conf = event.conferenceData;

  if (!conf || !conf.conferenceId) {
    fail('This calendar event does not have an associated Google Meet conference.');
  }

  return ok({
    eventId: event.id,
    summary: event.summary,
    description: event.description,
    startTime: event.start?.dateTime || event.start?.date,
    endTime: event.end?.dateTime || event.end?.date,
    conference: {
      conferenceId: conf.conferenceId,
      conferenceSolution: conf.conferenceSolution?.name,
      entryPoints: conf.entryPoints,
      meetingUri:
        conf.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
        conf.entryPoints?.[0]?.uri ||
        '',
      signature: conf.signature,
    },
  });
}

async function updateMeetingAccess(args: any, oauth2Client: any) {
  if (!args.conferenceId) fail('conferenceId is required');
  if (!args.accessType) fail('accessType is required');

  const body = {
    config: {
      accessType: args.accessType,
    },
  };

  const data = await meetRequest(
    oauth2Client,
    'PATCH',
    `/conferences/${encodeURIComponent(args.conferenceId)}`,
    body,
  );
  return ok(data);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const handlerMap: Record<string, (args: any, oauth2Client: any) => Promise<any>> = {
  create_meeting_space: createMeetingSpace,
  get_meeting_space: getMeetingSpace,
  list_meetings: listMeetings,
  delete_meeting_space: deleteMeetingSpace,
  get_meeting_participants: getMeetingParticipants,
  list_meeting_records: listMeetingRecords,
  get_meeting_record: getMeetingRecord,
  get_meeting_recording: getMeetingRecording,
  get_meeting_transcript: getMeetingTranscript,
  create_meeting_event: createMeetingEvent,
  get_meeting_from_event: getMeetingFromEvent,
  update_meeting_access: updateMeetingAccess,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getTools(): ToolDefinition[] {
  return tools;
}

export async function executeTool(
  name: string,
  args: any,
  oauth2Client: any,
): Promise<any> {
  const handler = handlerMap[name];
  if (!handler) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown Meet tool: ${name}`);
  }

  try {
    return await handler(args, oauth2Client);
  } catch (error: any) {
    // Re-throw McpError as-is
    if (error instanceof McpError) throw error;

    // Wrap Google API errors
    if (error.code || error.response?.status) {
      const status = error.code || error.response?.status;
      const message =
        error.errors?.[0]?.message || error.message || 'Unknown API error';
      throw new McpError(ErrorCode.InternalError, `Meet API error (${status}): ${message}`);
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Failed to execute ${name}: ${error.message || String(error)}`,
    );
  }
}
