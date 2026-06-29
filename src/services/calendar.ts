// Google Calendar API module for MCP server
// Required OAuth2 scopes:
//   - https://www.googleapis.com/auth/calendar
//   - https://www.googleapis.com/auth/calendar.events
//   - https://www.googleapis.com/auth/calendar.readonly

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function getCalendar(oauth2Client: any) {
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

function rfc3339(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  // If it already looks like RFC3339, pass through
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})/.test(dateStr)) return dateStr;
  // Try to parse and convert
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new McpError(ErrorCode.InvalidParams, `Invalid date: ${dateStr}`);
  return d.toISOString();
}

// ─── Tool definitions ────────────────────────────────────────────────────────

export function getTools(): ToolDefinition[] {
  return [
    // ── Calendar Management ──────────────────────────────────────────────────
    {
      name: 'list_calendars',
      description: 'List all calendars accessible to the authenticated user (primary and secondary).',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_calendar',
      description: 'Get detailed information about a specific calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (use "primary" for the primary calendar)',
          },
        },
        required: ['calendarId'],
      },
    },
    {
      name: 'create_calendar',
      description: 'Create a new secondary calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Calendar title/name',
          },
          description: {
            type: 'string',
            description: 'Calendar description',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone for the calendar (e.g. "America/New_York")',
          },
        },
        required: ['summary'],
      },
    },
    {
      name: 'update_calendar',
      description: 'Update calendar summary and/or description.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID',
          },
          summary: {
            type: 'string',
            description: 'New calendar name',
          },
          description: {
            type: 'string',
            description: 'New calendar description',
          },
        },
        required: ['calendarId'],
      },
    },
    {
      name: 'delete_calendar',
      description: 'Delete a secondary calendar. The primary calendar cannot be deleted.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID to delete',
          },
        },
        required: ['calendarId'],
      },
    },
    {
      name: 'get_calendar_colors',
      description: 'Get the list of available color definitions for calendar and event colors.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_calendar_settings',
      description: "Get the authenticated user's calendar settings.",
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // ── Event Operations ─────────────────────────────────────────────────────
    {
      name: 'list_events',
      description: 'List events from a calendar within an optional time range.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          timeMin: {
            type: 'string',
            description: 'Start of time range (RFC3339 or ISO date string). Default: now.',
          },
          timeMax: {
            type: 'string',
            description: 'End of time range (RFC3339 or ISO date string). Default: 7 days from now.',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of events to return (1-2500, default 100)',
          },
          query: {
            type: 'string',
            description: 'Free text search query to filter events',
          },
          singleEvents: {
            type: 'boolean',
            description: 'Whether to expand recurring events into individual instances (default true)',
          },
          orderBy: {
            type: 'string',
            description: 'Order of events: "startTime" or "updated" (default "startTime")',
          },
          syncToken: {
            type: 'string',
            description: 'Sync token for incremental sync',
          },
          pageToken: {
            type: 'string',
            description: 'Page token for pagination',
          },
        },
      },
    },
    {
      name: 'get_event',
      description: 'Get detailed information about a specific event.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          eventId: {
            type: 'string',
            description: 'Event ID',
          },
        },
        required: ['eventId'],
      },
    },
    {
      name: 'create_event',
      description: 'Create a new event on a calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          summary: {
            type: 'string',
            description: 'Event title',
          },
          description: {
            type: 'string',
            description: 'Event description',
          },
          location: {
            type: 'string',
            description: 'Event location',
          },
          startDateTime: {
            type: 'string',
            description: 'Start date/time (RFC3339). For all-day events, use startDate instead.',
          },
          endDateTime: {
            type: 'string',
            description: 'End date/time (RFC3339). For all-day events, use endDate instead.',
          },
          startDate: {
            type: 'string',
            description: 'Start date for all-day events (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'End date for all-day events (YYYY-MM-DD)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone for the event (e.g. "America/New_York")',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of attendee email addresses',
          },
          recurrence: {
            type: 'array',
            items: { type: 'string' },
            description: 'RRULE strings for recurring events (e.g. ["RRULE:FREQ=WEEKLY;COUNT=5"])',
          },
          useDefaultReminders: {
            type: 'boolean',
            description: 'Whether to use the calendar default reminders',
          },
          reminders: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                method: { type: 'string', description: '"email" or "popup"' },
                minutes: { type: 'number', description: 'Minutes before event' },
              },
            },
            description: 'Custom reminder overrides',
          },
          createGoogleMeetLink: {
            type: 'boolean',
            description: 'Generate a Google Meet conference link',
          },
          transparency: {
            type: 'string',
            description: '"transparent" (free) or "opaque" (busy, default)',
          },
          visibility: {
            type: 'string',
            description: '"default", "public", or "private"',
          },
          colorId: {
            type: 'string',
            description: 'Event color ID (from get_event_colors)',
          },
          sendNotifications: {
            type: 'boolean',
            description: 'Send notification emails to attendees (default true)',
          },
          attachments: {
            type: 'array',
            items: { type: 'string' },
            description: 'Google Drive file IDs to attach',
          },
        },
        required: ['summary'],
      },
    },
    {
      name: 'update_event',
      description: 'Update properties of an existing event.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          eventId: {
            type: 'string',
            description: 'Event ID to update',
          },
          summary: {
            type: 'string',
            description: 'New event title',
          },
          description: {
            type: 'string',
            description: 'New event description',
          },
          location: {
            type: 'string',
            description: 'New event location',
          },
          startDateTime: {
            type: 'string',
            description: 'New start date/time (RFC3339)',
          },
          endDateTime: {
            type: 'string',
            description: 'New end date/time (RFC3339)',
          },
          startDate: {
            type: 'string',
            description: 'New start date for all-day events (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'New end date for all-day events (YYYY-MM-DD)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone for the event',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'New list of attendee email addresses',
          },
          recurrence: {
            type: 'array',
            items: { type: 'string' },
            description: 'New RRULE strings for recurring events',
          },
          useDefaultReminders: {
            type: 'boolean',
            description: 'Whether to use the calendar default reminders',
          },
          reminders: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                method: { type: 'string', description: '"email" or "popup"' },
                minutes: { type: 'number', description: 'Minutes before event' },
              },
            },
            description: 'Custom reminder overrides',
          },
          transparency: {
            type: 'string',
            description: '"transparent" (free) or "opaque" (busy)',
          },
          visibility: {
            type: 'string',
            description: '"default", "public", or "private"',
          },
          colorId: {
            type: 'string',
            description: 'Event color ID',
          },
          sendNotifications: {
            type: 'boolean',
            description: 'Send notification emails to attendees',
          },
        },
        required: ['eventId'],
      },
    },
    {
      name: 'delete_event',
      description: 'Delete an event from a calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          eventId: {
            type: 'string',
            description: 'Event ID to delete',
          },
          sendNotifications: {
            type: 'boolean',
            description: 'Send cancellation emails to attendees (default true)',
          },
        },
        required: ['eventId'],
      },
    },
    {
      name: 'quick_add_event',
      description: 'Create an event from natural language text (e.g. "Lunch with Bob tomorrow at noon").',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          text: {
            type: 'string',
            description: 'Natural language description of the event',
          },
          sendNotifications: {
            type: 'boolean',
            description: 'Send notification emails to attendees (default true)',
          },
        },
        required: ['text'],
      },
    },
    {
      name: 'move_event',
      description: 'Move an event from one calendar to another.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Source calendar ID (default "primary")',
          },
          eventId: {
            type: 'string',
            description: 'Event ID to move',
          },
          destination: {
            type: 'string',
            description: 'Destination calendar ID',
          },
          sendNotifications: {
            type: 'boolean',
            description: 'Send notification emails (default true)',
          },
        },
        required: ['eventId', 'destination'],
      },
    },
    {
      name: 'watch_events',
      description: 'Set up a push notification channel for event changes on a calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          webhookUrl: {
            type: 'string',
            description: 'URL where push notifications should be sent',
          },
          token: {
            type: 'string',
            description: 'Arbitrary token to identify this channel in callbacks',
          },
          ttl: {
            type: 'number',
            description: 'Time-to-live in seconds (default 604800 = 7 days)',
          },
        },
        required: ['webhookUrl'],
      },
    },

    // ── Recurring Event Operations ───────────────────────────────────────────
    {
      name: 'update_recurring_event_instance',
      description: 'Update a single instance of a recurring event without affecting other instances.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          eventId: {
            type: 'string',
            description: 'Recurring event ID',
          },
          instanceDate: {
            type: 'string',
            description: 'The original start date/time of the instance to update (RFC3339)',
          },
          summary: {
            type: 'string',
            description: 'New event title',
          },
          description: {
            type: 'string',
            description: 'New event description',
          },
          location: {
            type: 'string',
            description: 'New event location',
          },
          startDateTime: {
            type: 'string',
            description: 'New start date/time (RFC3339)',
          },
          endDateTime: {
            type: 'string',
            description: 'New end date/time (RFC3339)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone for the event',
          },
          sendNotifications: {
            type: 'boolean',
            description: 'Send notification emails to attendees',
          },
        },
        required: ['eventId', 'instanceDate'],
      },
    },
    {
      name: 'delete_recurring_event_instance',
      description: 'Delete a single instance of a recurring event without affecting other instances.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          eventId: {
            type: 'string',
            description: 'Recurring event ID',
          },
          instanceDate: {
            type: 'string',
            description: 'The original start date/time of the instance to delete (RFC3339)',
          },
          sendNotifications: {
            type: 'boolean',
            description: 'Send cancellation emails to attendees',
          },
        },
        required: ['eventId', 'instanceDate'],
      },
    },

    // ── Free/Busy ────────────────────────────────────────────────────────────
    {
      name: 'get_freebusy',
      description: 'Query free/busy information for one or more calendars within a time range.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of calendar IDs to query',
          },
          timeMin: {
            type: 'string',
            description: 'Start of time range (RFC3339, required)',
          },
          timeMax: {
            type: 'string',
            description: 'End of time range (RFC3339, required)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone for the query (default UTC)',
          },
        },
        required: ['timeMin', 'timeMax'],
      },
    },
    {
      name: 'get_calendar_list_freebusy',
      description: 'Get free/busy information for all calendars in the user\'s calendar list.',
      inputSchema: {
        type: 'object',
        properties: {
          timeMin: {
            type: 'string',
            description: 'Start of time range (RFC3339, required)',
          },
          timeMax: {
            type: 'string',
            description: 'End of time range (RFC3339, required)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone for the query (default UTC)',
          },
        },
        required: ['timeMin', 'timeMax'],
      },
    },

    // ── Color Operations ─────────────────────────────────────────────────────
    {
      name: 'get_event_colors',
      description: 'Get available event color definitions (ID -> name and palette).',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // ── Watch Operations ─────────────────────────────────────────────────────
    {
      name: 'watch_calendar_list',
      description: 'Set up a push notification channel for changes to the user\'s calendar list.',
      inputSchema: {
        type: 'object',
        properties: {
          webhookUrl: {
            type: 'string',
            description: 'URL where push notifications should be sent',
          },
          token: {
            type: 'string',
            description: 'Arbitrary token to identify this channel in callbacks',
          },
          ttl: {
            type: 'number',
            description: 'Time-to-live in seconds (default 604800 = 7 days)',
          },
        },
        required: ['webhookUrl'],
      },
    },
    {
      name: 'stop_channel',
      description: 'Stop an active push notification channel.',
      inputSchema: {
        type: 'object',
        properties: {
          channelId: {
            type: 'string',
            description: 'The channel ID to stop',
          },
          resourceId: {
            type: 'string',
            description: 'The resource ID for the channel',
          },
        },
        required: ['channelId', 'resourceId'],
      },
    },

    // ── ACL (Access Control) ─────────────────────────────────────────────────
    {
      name: 'list_calendar_acl',
      description: 'List ACL (access control) rules for a calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
        },
      },
    },
    {
      name: 'add_calendar_acl',
      description: 'Add an ACL rule to a calendar to grant access to other users/domains.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          scopeType: {
            type: 'string',
            description: 'Scope type: "user", "group", "domain", or "default"',
          },
          scopeValue: {
            type: 'string',
            description: 'Scope value (email for user/group, domain name for domain, omit for default)',
          },
          role: {
            type: 'string',
            description: 'Role: "none", "freeBusyReader", "reader", "writer", or "owner"',
          },
        },
        required: ['scopeType', 'role'],
      },
    },
    {
      name: 'delete_calendar_acl',
      description: 'Delete an ACL rule from a calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          ruleId: {
            type: 'string',
            description: 'ACL rule ID to delete',
          },
        },
        required: ['ruleId'],
      },
    },

    // ── Imports ──────────────────────────────────────────────────────────────
    {
      name: 'import_event',
      description: 'Import an event into a calendar from an ICS format string.',
      inputSchema: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            description: 'Calendar ID (default "primary")',
          },
          icsData: {
            type: 'string',
            description: 'Complete iCalendar (ICS) data for the event',
          },
          sendNotifications: {
            type: 'boolean',
            description: 'Send notification emails to attendees (default true)',
          },
        },
        required: ['icsData'],
      },
    },
  ];
}

// ─── Execute ─────────────────────────────────────────────────────────────────

export async function executeTool(name: string, args: any, oauth2Client: any): Promise<any> {
  const cal = getCalendar(oauth2Client);

  switch (name) {
    // ── Calendar Management ────────────────────────────────────────────────

    case 'list_calendars': {
      const res = await cal.calendarList.list();
      return ok({ calendars: res.data.items || [] });
    }

    case 'get_calendar': {
      const id = args.calendarId || 'primary';
      const res = await cal.calendars.get({ calendarId: id });
      return ok(res.data);
    }

    case 'create_calendar': {
      if (!args.summary) throw new McpError(ErrorCode.InvalidParams, 'summary is required');
      const body: any = { summary: args.summary };
      if (args.description) body.description = args.description;
      if (args.timeZone) body.timeZone = args.timeZone;
      const res = await cal.calendars.insert({ requestBody: body });
      return ok(res.data);
    }

    case 'update_calendar': {
      const id = args.calendarId || 'primary';
      const body: any = {};
      const updateMask: string[] = [];
      if (args.summary !== undefined) { body.summary = args.summary; updateMask.push('summary'); }
      if (args.description !== undefined) { body.description = args.description; updateMask.push('description'); }
      if (updateMask.length === 0) throw new McpError(ErrorCode.InvalidParams, 'At least one field to update is required');
      const res = await cal.calendars.patch({
        calendarId: id,
        requestBody: body,
      });
      return ok(res.data);
    }

    case 'delete_calendar': {
      const id = args.calendarId || 'primary';
      await cal.calendars.delete({ calendarId: id });
      return ok({ message: `Calendar ${id} deleted successfully` });
    }

    case 'get_calendar_colors': {
      const res = await cal.colors.get();
      return ok({ calendar: res.data.calendar || {}, event: res.data.event || {} });
    }

    case 'get_calendar_settings': {
      const res = await cal.settings.list();
      return ok({ settings: res.data.items || [] });
    }

    // ── Event Operations ───────────────────────────────────────────────────

    case 'list_events': {
      const id = args.calendarId || 'primary';
      const now = new Date().toISOString();
      const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const params: any = {
        calendarId: id,
        timeMin: args.timeMin ? rfc3339(args.timeMin) : now,
        timeMax: args.timeMax ? rfc3339(args.timeMax) : weekLater,
        maxResults: Math.min(Math.max(args.maxResults || 100, 1), 2500),
        singleEvents: args.singleEvents !== undefined ? args.singleEvents : true,
        orderBy: args.orderBy || 'startTime',
      };
      if (args.query) params.q = args.query;
      if (args.syncToken) params.syncToken = args.syncToken;
      if (args.pageToken) params.pageToken = args.pageToken;

      const res = await cal.events.list(params);
      return ok({
        events: res.data.items || [],
        nextPageToken: res.data.nextPageToken || null,
        nextSyncToken: res.data.nextSyncToken || null,
      });
    }

    case 'get_event': {
      const id = args.calendarId || 'primary';
      if (!args.eventId) throw new McpError(ErrorCode.InvalidParams, 'eventId is required');
      const res = await cal.events.get({ calendarId: id, eventId: args.eventId });
      return ok(res.data);
    }

    case 'create_event': {
      if (!args.summary) throw new McpError(ErrorCode.InvalidParams, 'summary is required');

      const eventBody: any = { summary: args.summary };
      if (args.description) eventBody.description = args.description;
      if (args.location) eventBody.location = args.location;

      // Time handling: support both date-time and all-day events
      if (args.startDate || args.endDate) {
        // All-day event
        eventBody.start = { date: args.startDate || args.startDateTime?.slice(0, 10) };
        eventBody.end = { date: args.endDate || args.endDateTime?.slice(0, 10) };
      } else if (args.startDateTime || args.endDateTime) {
        eventBody.start = { dateTime: rfc3339(args.startDateTime), timeZone: args.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone };
        eventBody.end = { dateTime: rfc3339(args.endDateTime), timeZone: args.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone };
      }

      if (args.attendees && args.attendees.length > 0) {
        eventBody.attendees = args.attendees.map((email: string) => ({ email }));
      }

      if (args.recurrence) {
        eventBody.recurrence = args.recurrence;
      }

      // Reminders
      if (args.reminders && args.reminders.length > 0) {
        eventBody.reminders = {
          useDefault: false,
          overrides: args.reminders.map((r: any) => ({
            method: r.method,
            minutes: r.minutes,
          })),
        };
      } else if (args.useDefaultReminders !== undefined) {
        eventBody.reminders = { useDefault: args.useDefaultReminders };
      }

      // Conference data (Google Meet)
      let conferenceDataVersion = 0;
      if (args.createGoogleMeetLink) {
        eventBody.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
        conferenceDataVersion = 1;
      }

      if (args.transparency) eventBody.transparency = args.transparency;
      if (args.visibility) eventBody.visibility = args.visibility;
      if (args.colorId) eventBody.colorId = args.colorId;

      if (args.attachments && args.attachments.length > 0) {
        eventBody.attachments = args.attachments.map((fileId: string) => ({ fileId }));
      }

      const sendUpdates = args.sendNotifications !== false ? 'all' : 'none';

      const res = await cal.events.insert({
        calendarId: args.calendarId || 'primary',
        requestBody: eventBody,
        conferenceDataVersion,
        sendUpdates,
      });

      return ok(res.data);
    }

    case 'update_event': {
      if (!args.eventId) throw new McpError(ErrorCode.InvalidParams, 'eventId is required');
      const id = args.calendarId || 'primary';

      const eventBody: any = {};
      if (args.summary !== undefined) eventBody.summary = args.summary;
      if (args.description !== undefined) eventBody.description = args.description;
      if (args.location !== undefined) eventBody.location = args.location;

      // Time handling
      if (args.startDate || args.endDate) {
        if (args.startDate) eventBody.start = { date: args.startDate };
        if (args.endDate) eventBody.end = { date: args.endDate };
      } else if (args.startDateTime || args.endDateTime) {
        if (args.startDateTime) eventBody.start = { dateTime: rfc3339(args.startDateTime), timeZone: args.timeZone };
        if (args.endDateTime) eventBody.end = { dateTime: rfc3339(args.endDateTime), timeZone: args.timeZone };
      }

      if (args.attendees) {
        eventBody.attendees = args.attendees.map((email: string) => ({ email }));
      }

      if (args.recurrence !== undefined) {
        eventBody.recurrence = args.recurrence;
      }

      if (args.reminders && args.reminders.length > 0) {
        eventBody.reminders = {
          useDefault: false,
          overrides: args.reminders.map((r: any) => ({
            method: r.method,
            minutes: r.minutes,
          })),
        };
      } else if (args.useDefaultReminders !== undefined) {
        eventBody.reminders = { useDefault: args.useDefaultReminders };
      }

      if (args.transparency) eventBody.transparency = args.transparency;
      if (args.visibility) eventBody.visibility = args.visibility;
      if (args.colorId) eventBody.colorId = args.colorId;

      const sendUpdates = args.sendNotifications !== false ? 'all' : 'none';

      const res = await cal.events.patch({
        calendarId: id,
        eventId: args.eventId,
        requestBody: eventBody,
        sendUpdates,
      });

      return ok(res.data);
    }

    case 'delete_event': {
      if (!args.eventId) throw new McpError(ErrorCode.InvalidParams, 'eventId is required');
      const id = args.calendarId || 'primary';
      const sendUpdates = args.sendNotifications !== false ? 'all' : 'none';

      await cal.events.delete({
        calendarId: id,
        eventId: args.eventId,
        sendUpdates,
      });

      return ok({ message: `Event ${args.eventId} deleted successfully` });
    }

    case 'quick_add_event': {
      if (!args.text) throw new McpError(ErrorCode.InvalidParams, 'text is required');
      const id = args.calendarId || 'primary';
      const sendUpdates = args.sendNotifications !== false ? 'all' : 'none';

      const res = await cal.events.quickAdd({
        calendarId: id,
        text: args.text,
        sendUpdates,
      });

      return ok(res.data);
    }

    case 'move_event': {
      if (!args.eventId) throw new McpError(ErrorCode.InvalidParams, 'eventId is required');
      if (!args.destination) throw new McpError(ErrorCode.InvalidParams, 'destination calendar ID is required');
      const id = args.calendarId || 'primary';
      const sendUpdates = args.sendNotifications !== false ? 'all' : 'none';

      const res = await cal.events.move({
        calendarId: id,
        eventId: args.eventId,
        destination: args.destination,
        sendUpdates,
      });

      return ok(res.data);
    }

    case 'watch_events': {
      if (!args.webhookUrl) throw new McpError(ErrorCode.InvalidParams, 'webhookUrl is required');
      const id = args.calendarId || 'primary';
      const channelId = `cal-events-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const res = await cal.events.watch({
        calendarId: id,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: args.webhookUrl,
          token: args.token,
          params: {
            ttl: String(args.ttl || 604800),
          },
        },
      });

      return ok({
        channelId: res.data.id,
        resourceId: res.data.resourceId,
        resourceUri: res.data.resourceUri,
        expiration: res.data.expiration,
      });
    }

    // ── Recurring Event Operations ─────────────────────────────────────────

    case 'update_recurring_event_instance': {
      if (!args.eventId) throw new McpError(ErrorCode.InvalidParams, 'eventId is required');
      if (!args.instanceDate) throw new McpError(ErrorCode.InvalidParams, 'instanceDate is required');
      const id = args.calendarId || 'primary';

      // Get instances of the recurring event to find the specific instance
      const instances = await cal.events.instances({
        calendarId: id,
        eventId: args.eventId,
      });

      // Find the specific instance by matching instanceDate with date tolerance
      const target = new Date(args.instanceDate).getTime();
      const instance = (instances.data.items || []).find((item: any) => {
        const itemStart = item.start?.dateTime || item.start?.date;
        if (!itemStart) return false;
        const itemTime = new Date(itemStart).getTime();
        // Allow 60s tolerance for timezone/format differences
        return Math.abs(itemTime - target) < 60000;
      });
      if (!instance) throw new McpError(ErrorCode.MethodNotFound, 'Could not find event instance matching instanceDate');

      const eventBody: any = {};
      if (args.summary !== undefined) eventBody.summary = args.summary;
      if (args.description !== undefined) eventBody.description = args.description;
      if (args.location !== undefined) eventBody.location = args.location;

      if (args.startDateTime) eventBody.start = { dateTime: rfc3339(args.startDateTime), timeZone: args.timeZone };
      if (args.endDateTime) eventBody.end = { dateTime: rfc3339(args.endDateTime), timeZone: args.timeZone };

      const sendUpdates = args.sendNotifications !== false ? 'all' : 'none';

      const res = await cal.events.patch({
        calendarId: id,
        eventId: (instance.id ?? '') as string,
        requestBody: eventBody,
        sendUpdates,
      });

      return ok(res.data);
    }

    case 'delete_recurring_event_instance': {
      if (!args.eventId) throw new McpError(ErrorCode.InvalidParams, 'eventId is required');
      if (!args.instanceDate) throw new McpError(ErrorCode.InvalidParams, 'instanceDate is required');
      const id = args.calendarId || 'primary';
      const sendUpdates = args.sendNotifications !== false ? 'all' : 'none';

      // Get instances of the recurring event to find the specific instance
      const instances = await cal.events.instances({
        calendarId: id,
        eventId: args.eventId,
      });

      // Find the specific instance by matching instanceDate with date tolerance
      const target = new Date(args.instanceDate).getTime();
      const instance = (instances.data.items || []).find((item: any) => {
        const itemStart = item.start?.dateTime || item.start?.date;
        if (!itemStart) return false;
        const itemTime = new Date(itemStart).getTime();
        return Math.abs(itemTime - target) < 60000;
      });
      if (!instance) throw new McpError(ErrorCode.MethodNotFound, 'Could not find event instance matching instanceDate');

      await cal.events.delete({
        calendarId: id,
        eventId: (instance.id ?? '') as string,
        sendUpdates,
      });

      return ok({ message: `Recurring event instance ${instance.id} deleted successfully` });
    }

    // ── Free/Busy ──────────────────────────────────────────────────────────

    case 'get_freebusy': {
      if (!args.timeMin) throw new McpError(ErrorCode.InvalidParams, 'timeMin is required');
      if (!args.timeMax) throw new McpError(ErrorCode.InvalidParams, 'timeMax is required');

      const items = (args.calendarIds || []).map((cid: string) => ({ id: cid }));

      const res = await cal.freebusy.query({
        requestBody: {
          timeMin: rfc3339(args.timeMin),
          timeMax: rfc3339(args.timeMax),
          timeZone: args.timeZone || 'UTC',
          items,
        },
      });

      return ok({ calendars: res.data.calendars || {} });
    }

    case 'get_calendar_list_freebusy': {
      if (!args.timeMin) throw new McpError(ErrorCode.InvalidParams, 'timeMin is required');
      if (!args.timeMax) throw new McpError(ErrorCode.InvalidParams, 'timeMax is required');

      // Fetch all calendars in the user's list
      const listRes = await cal.calendarList.list();
      const calendars = listRes.data.items || [];
      const items = calendars.map((c: any) => ({ id: c.id }));

      const res = await cal.freebusy.query({
        requestBody: {
          timeMin: rfc3339(args.timeMin),
          timeMax: rfc3339(args.timeMax),
          timeZone: args.timeZone || 'UTC',
          items,
        },
      });

      return ok({ calendars: res.data.calendars || {} });
    }

    // ── Color Operations ───────────────────────────────────────────────────

    case 'get_event_colors': {
      const res = await cal.colors.get();
      return ok({ event: res.data.event || {} });
    }

    // ── Watch Operations ───────────────────────────────────────────────────

    case 'watch_calendar_list': {
      if (!args.webhookUrl) throw new McpError(ErrorCode.InvalidParams, 'webhookUrl is required');
      const channelId = `cal-list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const res = await cal.calendarList.watch({
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: args.webhookUrl,
          token: args.token,
          params: {
            ttl: String(args.ttl || 604800),
          },
        },
      });

      return ok({
        channelId: res.data.id,
        resourceId: res.data.resourceId,
        resourceUri: res.data.resourceUri,
        expiration: res.data.expiration,
      });
    }

    case 'stop_channel': {
      if (!args.channelId) throw new McpError(ErrorCode.InvalidParams, 'channelId is required');
      if (!args.resourceId) throw new McpError(ErrorCode.InvalidParams, 'resourceId is required');

      await cal.channels.stop({
        requestBody: {
          id: args.channelId,
          resourceId: args.resourceId,
        },
      });

      return ok({ message: 'Channel stopped successfully' });
    }

    // ── ACL (Access Control) ───────────────────────────────────────────────

    case 'list_calendar_acl': {
      const id = args.calendarId || 'primary';
      const res = await cal.acl.list({ calendarId: id });
      return ok({ rules: res.data.items || [] });
    }

    case 'add_calendar_acl': {
      const id = args.calendarId || 'primary';
      if (!args.scopeType) throw new McpError(ErrorCode.InvalidParams, 'scopeType is required');
      if (!args.role) throw new McpError(ErrorCode.InvalidParams, 'role is required');

      // Prevent self-referencing rules (Google rejects them with a confusing error)
      if (args.scopeType === 'user' && args.scopeValue) {
        try {
          const me = await cal.calendarList.get({ calendarId: 'primary' });
          const myEmail = me.data.id;
          if (myEmail && args.scopeValue.toLowerCase() === myEmail.toLowerCase()) {
            throw new McpError(ErrorCode.InvalidParams, 'Cannot add ACL rule for your own email. The owner always has full access.');
          }
        } catch (e: any) {
          if (e instanceof McpError) throw e;
          // Ignore — proceed without the check
        }
      }

      const scope: any = { type: args.scopeType };
      if (args.scopeValue) scope.value = args.scopeValue;

      try {
        const res = await cal.acl.insert({
          calendarId: id,
          requestBody: {
            scope,
            role: args.role,
          },
          sendNotifications: args.sendNotifications !== false,
        });

        return ok(res.data);
      } catch (err: any) {
        if (err?.code === 403 || err?.message?.includes('Cannot modify')) {
          throw new McpError(ErrorCode.InvalidParams, `Cannot add ACL rule for ${args.scopeType}:${args.scopeValue || '*'} with role ${args.role}. You may not have permission to share this calendar, or you cannot change your own access level.`);
        }
        throw err;
      }
    }

    case 'delete_calendar_acl': {
      const id = args.calendarId || 'primary';
      if (!args.ruleId) throw new McpError(ErrorCode.InvalidParams, 'ruleId is required');

      await cal.acl.delete({
        calendarId: id,
        ruleId: args.ruleId,
      });

      return ok({ message: `ACL rule ${args.ruleId} deleted successfully` });
    }

    // ── Imports ────────────────────────────────────────────────────────────

    case 'import_event': {
      const id = args.calendarId || 'primary';

      // Support two modes: raw ICS data, or structured params
      if (args.icsData) {
        // Parse ICS data into a Calendar API Event resource
        const ics = args.icsData;
        const getField = (name: string): string => {
          // Handle folded lines (continuation lines start with space/tab)
          const unfolded = ics.replace(/\r?\n[ \t]/g, '');
          const match = unfolded.match(new RegExp(`^${name}[^:]*:(.+)$`, 'm'));
          return match ? match[1].trim() : '';
        };

        const parseICSDate = (val: string): any => {
          if (!val) return undefined;
          // Format: 20260630T120000Z or 20260630T120000
          const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
          if (m) {
            const isUTC = m[7] === 'Z';
            const dt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${isUTC ? 'Z' : ''}`;
            return { dateTime: dt, timeZone: isUTC ? 'UTC' : (args.timeZone || 'UTC') };
          }
          // All-day date: 20260630
          const dm = val.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (dm) return { date: `${dm[1]}-${dm[2]}-${dm[3]}` };
          return undefined;
        };

        const resource: any = {};
        const uid = getField('UID');
        if (uid) resource.iCalUID = uid;

        const summary = getField('SUMMARY');
        if (summary) resource.summary = summary;

        const description = getField('DESCRIPTION');
        if (description) resource.description = description.replace(/\\n/g, '\n').replace(/\\,/g, ',');

        const location = getField('LOCATION');
        if (location) resource.location = location;

        const dtstart = getField('DTSTART');
        if (dtstart) resource.start = parseICSDate(dtstart);

        const dtend = getField('DTEND');
        if (dtend) resource.end = parseICSDate(dtend);
        else if (resource.start) {
          // For all-day events, default end is next day
          resource.end = resource.start;
        }

        if (!resource.summary) throw new McpError(ErrorCode.InvalidParams, 'ICS data must contain a SUMMARY field');
        if (!resource.start) throw new McpError(ErrorCode.InvalidParams, 'ICS data must contain a DTSTART field');

        const res = await cal.events.import({
          calendarId: id,
          requestBody: resource,
        });
        return ok(res.data);
      }

      // Fallback: structured params
      if (!args.summary) throw new McpError(ErrorCode.InvalidParams, 'summary (or icsData) is required');
      if (!args.startDateTime) throw new McpError(ErrorCode.InvalidParams, 'startDateTime is required');
      if (!args.endDateTime) throw new McpError(ErrorCode.InvalidParams, 'endDateTime is required');

      const resource: any = {
        iCalUID: `${Date.now()}-${Math.random().toString(36).slice(2)}@google-mcp`,
        summary: args.summary,
        start: { dateTime: rfc3339(args.startDateTime), timeZone: args.timeZone || 'UTC' },
        end: { dateTime: rfc3339(args.endDateTime), timeZone: args.timeZone || 'UTC' },
      };
      if (args.description) resource.description = args.description;
      if (args.location) resource.location = args.location;

      const res2 = await cal.events.import({
        calendarId: id,
        requestBody: resource,
      });

      return ok(res2.data);
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown calendar tool: ${name}`);
  }
}
