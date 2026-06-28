/**
 * Enhanced Google Sheets MCP module - Advanced features
 *
 * Provides 40 advanced spreadsheet tools beyond basic CRUD:
 *   Charts, Conditional Formatting, Data Validation, Protected Ranges,
 *   Developer Metadata, Pivot Tables, Sparklines, Data Sources,
 *   Named Ranges, Sheet Properties, Batch Operations, Find & Replace,
 *   Sort, Filter Views, and Slicers.
 */

import {
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { google, sheets_v4 } from 'googleapis';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

type SheetsClient = sheets_v4.Sheets;

// ─── Helpers ────────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function color(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace('#', '');
  return {
    red: parseInt(h.substring(0, 2), 16) / 255,
    green: parseInt(h.substring(2, 4), 16) / 255,
    blue: parseInt(h.substring(4, 6), 16) / 255,
  };
}

/** Parse a hex color or a theme-color string into a Color object. */
function parseColor(c: string): any {
  if (c.startsWith('theme:')) {
    return { themeColor: c.slice(6) };
  }
  return color(c);
}

/** Parse a GridRange from user-friendly 1-indexed row/col or A1 range. */
function gridRange(args: any): sheets_v4.Schema$GridRange {
  if (args.a1Range) {
    // Caller must supply sheetId separately when using A1
    return {
      sheetId: args.sheetId ?? undefined,
    } as any; // A1 parsing handled by the API
  }
  return {
    sheetId: args.sheetId,
    startRowIndex: args.startRow !== undefined ? args.startRow - 1 : undefined,
    endRowIndex: args.endRow !== undefined ? args.endRow : undefined,
    startColumnIndex: args.startColumn !== undefined ? args.startColumn - 1 : undefined,
    endColumnIndex: args.endColumn !== undefined ? args.endColumn : undefined,
  };
}

// ─── Tool definitions ───────────────────────────────────────────────────────

export function getTools(): ToolDefinition[] {
  return [
    // ── Charts ────────────────────────────────────────────────────────────
    {
      name: 'create_chart',
      description: 'Create a chart (bar, line, pie, scatter, area, combo, histogram, candlestick, waterfall) on a sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          sheetId: { type: 'number', description: 'Sheet ID to place the chart on' },
          chartType: { type: 'string', description: 'BAR, LINE, PIE, SCATTER, AREA, COMBO, HISTOGRAM, CANDLESTICK, WATERFALL, COLUMN, BUBBLE, SCHEDULE, HISTOGRAM_COLUMN', enum: ['BAR', 'LINE', 'PIE', 'SCATTER', 'AREA', 'COMBO', 'HISTOGRAM', 'CANDLESTICK', 'WATERFALL', 'COLUMN', 'BUBBLE', 'SCHEDULE', 'HISTOGRAM_COLUMN'] },
          dataRange: { type: 'string', description: 'A1 notation range for chart data, e.g. "Sheet1!A1:D10"' },
          title: { type: 'string', description: 'Chart title' },
          position: {
            type: 'object',
            description: 'Chart position and size on the sheet',
            properties: {
              x: { type: 'number', description: 'X position in pixels (default 0)' },
              y: { type: 'number', description: 'Y position in pixels (default 0)' },
              width: { type: 'number', description: 'Width in pixels (default 600)' },
              height: { type: 'number', description: 'Height in pixels (default 400)' },
            },
          },
          legendPosition: { type: 'string', description: 'Legend position: BOTTOM_LEGEND, TOP_LEGEND, LEFT_LEGEND, RIGHT_LEGEND, NO_LEGEND', enum: ['BOTTOM_LEGEND', 'TOP_LEGEND', 'LEFT_LEGEND', 'RIGHT_LEGEND', 'NO_LEGEND'] },
          fontName: { type: 'string', description: 'Font for chart text' },
          subtitle: { type: 'string', description: 'Chart subtitle' },
        },
        required: ['spreadsheetId', 'sheetId', 'chartType', 'dataRange'],
      },
    },
    {
      name: 'update_chart',
      description: 'Update chart properties (type, title, style, ranges, position)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          chartId: { type: 'number', description: 'Chart ID (get from list_charts)' },
          chartType: { type: 'string', description: 'New chart type' },
          title: { type: 'string', description: 'New chart title' },
          dataRange: { type: 'string', description: 'New A1 data range' },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' }, y: { type: 'number' },
              width: { type: 'number' }, height: { type: 'number' },
            },
          },
          legendPosition: { type: 'string', enum: ['BOTTOM_LEGEND', 'TOP_LEGEND', 'LEFT_LEGEND', 'RIGHT_LEGEND', 'NO_LEGEND'] },
        },
        required: ['spreadsheetId', 'chartId'],
      },
    },
    {
      name: 'delete_chart',
      description: 'Delete a chart by ID from a spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          chartId: { type: 'number', description: 'Chart ID to delete' },
        },
        required: ['spreadsheetId', 'chartId'],
      },
    },
    {
      name: 'list_charts',
      description: 'List all embedded charts on a sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          sheetId: { type: 'number', description: 'Sheet ID (optional, lists all if omitted)' },
        },
        required: ['spreadsheetId'],
      },
    },

    // ── Conditional Formatting ────────────────────────────────────────────
    {
      name: 'add_conditional_format_rule',
      description: 'Add a conditional formatting rule to a range. Supports boolean rules (bold, italic, bg/text color on match), gradient rules (min/mid/max colors), and various conditions (cellIs, textContains, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          sheetId: { type: 'number', description: 'Sheet ID' },
          startRow: { type: 'number', description: 'Start row (1-indexed)' },
          endRow: { type: 'number', description: 'End row (1-indexed, exclusive)' },
          startColumn: { type: 'number', description: 'Start column (1-indexed)' },
          endColumn: { type: 'number', description: 'End column (1-indexed, exclusive)' },
          ruleType: { type: 'string', description: 'booleanRule or gradientRule', enum: ['booleanRule', 'gradientRule'] },
          conditionType: { type: 'string', description: 'CellIsCondition, TextContains, DateBefore, DateAfter, NumberBetween, etc. For booleanRule.', enum: ['CELL_IS', 'TEXT_CONTAINS', 'TEXT_NOT_CONTAINS', 'TEXT_STARTS_WITH', 'TEXT_ENDS_WITH', 'DATE_BEFORE', 'DATE_AFTER', 'DATE_BETWEEN', 'NUMBER_GREATER', 'NUMBER_LESS', 'NUMBER_EQ', 'NUMBER_NOT_EQ', 'NUMBER_BETWEEN', 'CUSTOM_FORMULA', 'IS_EMPTY', 'IS_NOT_EMPTY'] },
          conditionValues: { type: 'array', items: { type: 'string' }, description: 'Values for the condition (e.g. ["10"] for greater-than, ["5","20"] for between)' },
          conditionFormula: { type: 'string', description: 'Custom formula condition, e.g. "=A1>10"' },
          bold: { type: 'boolean', description: 'Set text bold (booleanRule)' },
          italic: { type: 'boolean', description: 'Set text italic (booleanRule)' },
          strikethrough: { type: 'boolean', description: 'Set strikethrough (booleanRule)' },
          backgroundColor: { type: 'string', description: 'Background color hex, e.g. "#FFFF00" (booleanRule)' },
          foregroundColor: { type: 'string', description: 'Text color hex (booleanRule)' },
          gradientMinColor: { type: 'string', description: 'Gradient min color hex (gradientRule)' },
          gradientMidColor: { type: 'string', description: 'Gradient mid color hex (gradientRule, optional)' },
          gradientMaxColor: { type: 'string', description: 'Gradient max color hex (gradientRule)' },
        },
        required: ['spreadsheetId', 'sheetId', 'startRow', 'endRow', 'startColumn', 'endColumn', 'ruleType'],
      },
    },
    {
      name: 'update_conditional_format_rule',
      description: 'Update an existing conditional formatting rule by index',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          sheetId: { type: 'number', description: 'Sheet ID' },
          ruleIndex: { type: 'number', description: 'Index of the rule to update (0-based)' },
          startRow: { type: 'number' }, endRow: { type: 'number' },
          startColumn: { type: 'number' }, endColumn: { type: 'number' },
          ruleType: { type: 'string', enum: ['booleanRule', 'gradientRule'] },
          conditionType: { type: 'string', enum: ['CELL_IS', 'TEXT_CONTAINS', 'TEXT_NOT_CONTAINS', 'TEXT_STARTS_WITH', 'TEXT_ENDS_WITH', 'DATE_BEFORE', 'DATE_AFTER', 'DATE_BETWEEN', 'NUMBER_GREATER', 'NUMBER_LESS', 'NUMBER_EQ', 'NUMBER_NOT_EQ', 'NUMBER_BETWEEN', 'CUSTOM_FORMULA', 'IS_EMPTY', 'IS_NOT_EMPTY'] },
          conditionValues: { type: 'array', items: { type: 'string' } },
          conditionFormula: { type: 'string' },
          bold: { type: 'boolean' }, italic: { type: 'boolean' },
          strikethrough: { type: 'boolean' },
          backgroundColor: { type: 'string' },
          foregroundColor: { type: 'string' },
          gradientMinColor: { type: 'string' },
          gradientMidColor: { type: 'string' },
          gradientMaxColor: { type: 'string' },
        },
        required: ['spreadsheetId', 'sheetId', 'ruleIndex'],
      },
    },
    {
      name: 'delete_conditional_format_rule',
      description: 'Delete a conditional formatting rule by its index',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          sheetId: { type: 'number', description: 'Sheet ID' },
          ruleIndex: { type: 'number', description: 'Index of the rule to delete (0-based)' },
        },
        required: ['spreadsheetId', 'sheetId', 'ruleIndex'],
      },
    },
    {
      name: 'list_conditional_format_rules',
      description: 'List all conditional formatting rules on a sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          sheetId: { type: 'number', description: 'Sheet ID' },
        },
        required: ['spreadsheetId', 'sheetId'],
      },
    },

    // ── Data Validation ───────────────────────────────────────────────────
    {
      name: 'add_data_validation',
      description: 'Add data validation to a range (LIST, CHECKBOX, DATE, NUMBER, TEXT, CUSTOM_FORMULA)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          sheetId: { type: 'number', description: 'Sheet ID' },
          startRow: { type: 'number', description: 'Start row (1-indexed)' },
          endRow: { type: 'number', description: 'End row (1-indexed, exclusive)' },
          startColumn: { type: 'number', description: 'Start column (1-indexed)' },
          endColumn: { type: 'number', description: 'End column (1-indexed, exclusive)' },
          type: { type: 'string', description: 'Validation type', enum: ['LIST', 'CHECKBOX', 'DATE', 'NUMBER', 'TEXT', 'CUSTOM_FORMULA'] },
          values: { type: 'array', items: { type: 'string' }, description: 'For LIST: allowed values' },
          formula: { type: 'string', description: 'For CUSTOM_FORMULA: e.g. "=LEN(A1)<=100"' },
          condition: { type: 'string', description: 'For NUMBER/DATE: BETWEEN, NOT_BETWEEN, EQUAL, NOT_EQUAL, GREATER, LESS, GREATER_EQUAL, LESS_EQUAL' },
          min: { type: 'string', description: 'Min value for NUMBER/DATE' },
          max: { type: 'string', description: 'Max value for NUMBER/DATE' },
          strict: { type: 'boolean', description: 'Reject input not in the list/range (default true)' },
          showCustomMessage: { type: 'boolean', description: 'Show custom invalid message on reject (default true)' },
          inputMessage: { type: 'string', description: 'Tooltip message shown on cell focus' },
          errorMessage: { type: 'string', description: 'Message shown on invalid input' },
          checkedValue: { type: 'string', description: 'For CHECKBOX: value when checked (default "TRUE")' },
          uncheckedValue: { type: 'string', description: 'For CHECKBOX: value when unchecked (default "FALSE")' },
          color: { type: 'string', description: 'Background color for invalid cells, hex' },
        },
        required: ['spreadsheetId', 'sheetId', 'startRow', 'endRow', 'startColumn', 'endColumn', 'type'],
      },
    },
    {
      name: 'update_data_validation',
      description: 'Update data validation rule on a range',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number' },
          startRow: { type: 'number' }, endRow: { type: 'number' },
          startColumn: { type: 'number' }, endColumn: { type: 'number' },
          type: { type: 'string', enum: ['LIST', 'CHECKBOX', 'DATE', 'NUMBER', 'TEXT', 'CUSTOM_FORMULA'] },
          values: { type: 'array', items: { type: 'string' } },
          formula: { type: 'string' },
          condition: { type: 'string', enum: ['BETWEEN', 'NOT_BETWEEN', 'EQUAL', 'NOT_EQUAL', 'GREATER', 'LESS', 'GREATER_EQUAL', 'LESS_EQUAL'] },
          min: { type: 'string' }, max: { type: 'string' },
          strict: { type: 'boolean' }, inputMessage: { type: 'string' },
          errorMessage: { type: 'string' }, color: { type: 'string' },
          checkedValue: { type: 'string' }, uncheckedValue: { type: 'string' },
          showCustomMessage: { type: 'boolean' },
        },
        required: ['spreadsheetId', 'sheetId', 'startRow', 'endRow', 'startColumn', 'endColumn'],
      },
    },
    {
      name: 'delete_data_validation',
      description: 'Remove data validation from a range',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number' },
          startRow: { type: 'number' }, endRow: { type: 'number' },
          startColumn: { type: 'number' }, endColumn: { type: 'number' },
        },
        required: ['spreadsheetId', 'sheetId', 'startRow', 'endRow', 'startColumn', 'endColumn'],
      },
    },
    {
      name: 'list_data_validations',
      description: 'List all data validations on a sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number' },
        },
        required: ['spreadsheetId', 'sheetId'],
      },
    },

    // ── Protected Ranges ──────────────────────────────────────────────────
    {
      name: 'add_protected_range',
      description: 'Protect a range so only specified users/groups can edit it',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number', description: 'Protect entire sheet (use sheetId only)' },
          startRow: { type: 'number' }, endRow: { type: 'number' },
          startColumn: { type: 'number' }, endColumn: { type: 'number' },
          description: { type: 'string', description: 'Description of the protected range' },
          warningOnly: { type: 'boolean', description: 'Show warning but allow edits (default false)' },
          editors: {
            type: 'object',
            description: 'Who can edit (omit for no editors = lock for everyone)',
            properties: {
              users: { type: 'array', items: { type: 'string' }, description: 'Email addresses' },
              groups: { type: 'array', items: { type: 'string' }, description: 'Group email addresses' },
              domainUsersCanEdit: { type: 'boolean', description: 'Allow anyone in the domain' },
            },
          },
        },
        required: ['spreadsheetId'],
      },
    },
    {
      name: 'update_protected_range',
      description: 'Update protection settings on a protected range',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          protectedRangeId: { type: 'number', description: 'Protected range ID (from list_protected_ranges)' },
          description: { type: 'string' },
          warningOnly: { type: 'boolean' },
          editors: {
            type: 'object',
            properties: {
              users: { type: 'array', items: { type: 'string' } },
              groups: { type: 'array', items: { type: 'string' } },
              domainUsersCanEdit: { type: 'boolean' },
            },
          },
        },
        required: ['spreadsheetId', 'protectedRangeId'],
      },
    },
    {
      name: 'delete_protected_range',
      description: 'Remove a protection from a range',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          protectedRangeId: { type: 'number' },
        },
        required: ['spreadsheetId', 'protectedRangeId'],
      },
    },
    {
      name: 'list_protected_ranges',
      description: 'List all protected ranges in a spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
        },
        required: ['spreadsheetId'],
      },
    },

    // ── Developer Metadata ────────────────────────────────────────────────
    {
      name: 'add_developer_metadata',
      description: 'Attach developer metadata to a spreadsheet, sheet, or range',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          metadataKey: { type: 'string' },
          metadataValue: { type: 'string' },
          locationType: { type: 'string', description: 'SPREADSHEET, SHEET, or RANGE', enum: ['SPREADSHEET', 'SHEET', 'RANGE'] },
          sheetId: { type: 'number', description: 'Required for SHEET or RANGE location' },
          startRow: { type: 'number', endRow: { type: 'number' }, startColumn: { type: 'number' }, endColumn: { type: 'number' } },
          visibility: { type: 'string', description: 'DOCUMENT or PROJECT', enum: ['DOCUMENT', 'PROJECT'] },
        },
        required: ['spreadsheetId', 'metadataKey', 'metadataValue', 'locationType'],
      },
    },
    {
      name: 'get_developer_metadata',
      description: 'Get developer metadata by its ID',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          metadataId: { type: 'number' },
        },
        required: ['spreadsheetId', 'metadataId'],
      },
    },
    {
      name: 'search_developer_metadata',
      description: 'Search developer metadata by key and/or value',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          metadataKey: { type: 'string', description: 'Filter by key (exact match)' },
          metadataValue: { type: 'string', description: 'Filter by value (exact match)' },
        },
        required: ['spreadsheetId'],
      },
    },
    {
      name: 'delete_developer_metadata',
      description: 'Delete developer metadata by its ID',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          metadataId: { type: 'number' },
        },
        required: ['spreadsheetId', 'metadataId'],
      },
    },

    // ── Pivot Tables ──────────────────────────────────────────────────────
    {
      name: 'create_pivot_table',
      description: 'Create a pivot table from source data onto a target sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sourceSheetId: { type: 'number', description: 'Sheet ID containing source data' },
          sourceStartRow: { type: 'number', description: 'Source data start row (1-indexed, default 1)' },
          sourceEndRow: { type: 'number', description: 'Source data end row (1-indexed)' },
          sourceStartColumn: { type: 'number', description: 'Source data start column (1-indexed, default 1)' },
          sourceEndColumn: { type: 'number', description: 'Source data end column (1-indexed)' },
          targetSheetId: { type: 'number', description: 'Sheet ID where pivot table is placed (must be different from source)' },
          targetStartRow: { type: 'number', description: 'Target start row (0-indexed, default 0)' },
          targetStartColumn: { type: 'number', description: 'Target start column (0-indexed, default 0)' },
          rows: {
            type: 'array',
            description: 'Row groupings',
            items: {
              type: 'object',
              properties: {
                fieldIndex: { type: 'number', description: 'Column index (0-based) in source data' },
                showTotals: { type: 'boolean' },
                sortOrder: { type: 'string', enum: ['ASCENDING', 'DESCENDING'] },
              },
              required: ['fieldIndex'],
            },
          },
          columns: {
            type: 'array',
            description: 'Column groupings',
            items: {
              type: 'object',
              properties: {
                fieldIndex: { type: 'number' },
                showTotals: { type: 'boolean' },
                sortOrder: { type: 'string', enum: ['ASCENDING', 'DESCENDING'] },
              },
              required: ['fieldIndex'],
            },
          },
          values: {
            type: 'array',
            description: 'Values to summarize',
            items: {
              type: 'object',
              properties: {
                fieldIndex: { type: 'number' },
                summarizeFunction: { type: 'string', description: 'SUM, COUNTA, MIN, MAX, AVERAGE, COUNT, MEDIAN, PRODUCT, STDEV, STDEVP, VAR, VARP', enum: ['SUM', 'COUNTA', 'MIN', 'MAX', 'AVERAGE', 'COUNT', 'MEDIAN', 'PRODUCT', 'STDEV', 'STDEVP', 'VAR', 'VARP'] },
              },
              required: ['fieldIndex'],
            },
          },
          filters: {
            type: 'array',
            description: 'Filter criteria (column index + visible values)',
            items: {
              type: 'object',
              properties: {
                fieldIndex: { type: 'number' },
                visibleValues: { type: 'array', items: { type: 'string' }, description: 'Values to show (omit to show all)' },
              },
              required: ['fieldIndex'],
            },
          },
        },
        required: ['spreadsheetId', 'sourceSheetId', 'targetSheetId'],
      },
    },

    // ── Sparkline ─────────────────────────────────────────────────────────
    {
      name: 'add_sparkline',
      description: 'Add an inline SPARKLINE formula to a cell for quick visual data trends',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          cell: { type: 'string', description: 'Cell to place sparkline, e.g. "Sheet1!E2"' },
          dataRange: { type: 'string', description: 'A1 range of data for the sparkline, e.g. "B2:D2"' },
          chartType: { type: 'string', description: 'line, bar, column, winloss, or area', enum: ['line', 'bar', 'column', 'winloss', 'area'] },
          color: { type: 'string', description: 'Line/bar color hex, e.g. "#FF0000"' },
          negateColor: { type: 'string', description: 'Color for negative values in winloss' },
          maxColor: { type: 'string', description: 'Max color for gradient' },
          minColor: { type: 'string', description: 'Min color for gradient' },
          lineWidth: { type: 'number', description: 'Line width in pixels' },
          yMin: { type: 'string', description: 'Min Y-axis value' },
          yMax: { type: 'string', description: 'Max Y-axis value' },
        },
        required: ['spreadsheetId', 'cell', 'dataRange', 'chartType'],
      },
    },

    // ── Data Sources ──────────────────────────────────────────────────────
    {
      name: 'create_data_source',
      description: 'Create a connected data source (e.g. BigQuery)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          dataSourceId: { type: 'string', description: 'Unique identifier for the data source' },
          name: { type: 'string', description: 'Display name' },
          type: { type: 'string', description: 'Data source type', enum: ['BIGQUERY'] },
          bigQueryOptions: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
              datasetId: { type: 'string' },
              tableId: { type: 'string' },
              query: { type: 'string', description: 'Custom SQL query (alternative to table)' },
            },
          },
        },
        required: ['spreadsheetId', 'dataSourceId', 'type'],
      },
    },
    {
      name: 'list_data_sources',
      description: 'List connected data sources in a spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
        },
        required: ['spreadsheetId'],
      },
    },

    // ── Named Ranges ──────────────────────────────────────────────────────
    {
      name: 'create_named_range',
      description: 'Create a named range in a spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          name: { type: 'string', description: 'Name for the range (no spaces)' },
          a1Range: { type: 'string', description: 'A1 notation range, e.g. "Sheet1!A1:D10"' },
          sheetId: { type: 'number' },
          startRow: { type: 'number' }, endRow: { type: 'number' },
          startColumn: { type: 'number' }, endColumn: { type: 'number' },
        },
        required: ['spreadsheetId', 'name', 'a1Range'],
      },
    },
    {
      name: 'update_named_range',
      description: 'Update a named range (change name or range)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          namedRangeId: { type: 'string', description: 'Named range ID (from list_named_ranges)' },
          name: { type: 'string' },
          a1Range: { type: 'string' },
          sheetId: { type: 'number' },
          startRow: { type: 'number' }, endRow: { type: 'number' },
          startColumn: { type: 'number' }, endColumn: { type: 'number' },
        },
        required: ['spreadsheetId', 'namedRangeId'],
      },
    },
    {
      name: 'delete_named_range',
      description: 'Delete a named range',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          namedRangeId: { type: 'string' },
        },
        required: ['spreadsheetId', 'namedRangeId'],
      },
    },
    {
      name: 'list_named_ranges',
      description: 'List all named ranges in a spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
        },
        required: ['spreadsheetId'],
      },
    },

    // ── Sheet Properties ──────────────────────────────────────────────────
    {
      name: 'update_sheet_properties',
      description: 'Update sheet properties: tab color, hide/unhide, frozen rows/columns, row/column count',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number' },
          title: { type: 'string', description: 'New tab title (optional)' },
          hidden: { type: 'boolean', description: 'Hide the sheet (default false)' },
          tabColor: { type: 'string', description: 'Tab color hex, e.g. "#FF0000"' },
          frozenRowCount: { type: 'number', description: 'Number of frozen rows' },
          frozenColumnCount: { type: 'number', description: 'Number of frozen columns' },
          rowCount: { type: 'number', description: 'Set total row count' },
          columnCount: { type: 'number', description: 'Set total column count' },
        },
        required: ['spreadsheetId', 'sheetId'],
      },
    },
    {
      name: 'duplicate_sheet',
      description: 'Duplicate a sheet within the same spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sourceSheetId: { type: 'number' },
          newSheetName: { type: 'string', description: 'Name for the duplicate (optional)' },
          insertSheetIndex: { type: 'number', description: 'Position for the new sheet (0-indexed, optional)' },
        },
        required: ['spreadsheetId', 'sourceSheetId'],
      },
    },
    {
      name: 'copy_sheet',
      description: 'Copy a sheet to another spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Source spreadsheet ID' },
          sourceSheetId: { type: 'number' },
          destinationSpreadsheetId: { type: 'string', description: 'Destination spreadsheet ID' },
        },
        required: ['spreadsheetId', 'sourceSheetId', 'destinationSpreadsheetId'],
      },
    },
    {
      name: 'move_sheet',
      description: 'Move a sheet to a different position in the spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number' },
          newIndex: { type: 'number', description: 'New position index (0-based)' },
        },
        required: ['spreadsheetId', 'sheetId', 'newIndex'],
      },
    },
    {
      name: 'update_sheet_tab_color',
      description: 'Set the tab color for a sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number' },
          color: { type: 'string', description: 'Hex color, e.g. "#FF0000" or theme:ACCENT1' },
        },
        required: ['spreadsheetId', 'sheetId', 'color'],
      },
    },

    // ── Batch Operations ──────────────────────────────────────────────────
    {
      name: 'batch_update_spreadsheet',
      description: 'Execute multiple Sheets v4 batchUpdate requests in one API call. Raw access to the Sheets API request format.',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          requests: { type: 'array', description: 'Array of Sheets v4 Request objects', items: { type: 'object' } },
        },
        required: ['spreadsheetId', 'requests'],
      },
    },

    // ── Find & Replace ────────────────────────────────────────────────────
    {
      name: 'find_replace_sheet',
      description: 'Find and replace text in a spreadsheet (supports regex)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          find: { type: 'string', description: 'Text or regex to search for' },
          replacement: { type: 'string', description: 'Replacement text' },
          matchCase: { type: 'boolean', description: 'Case-sensitive match (default false)' },
          matchEntireCell: { type: 'boolean', description: 'Match entire cell content (default false)' },
          searchByRegex: { type: 'boolean', description: 'Treat find as regex (default false)' },
          includeFormulas: { type: 'boolean', description: 'Search inside formulas (default false)' },
          range: { type: 'string', description: 'A1 notation range to limit search (optional)' },
        },
        required: ['spreadsheetId', 'find', 'replacement'],
      },
    },

    // ── Sort ──────────────────────────────────────────────────────────────
    {
      name: 'sort_range',
      description: 'Sort a range by one or more columns',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          range: { type: 'string', description: 'A1 notation range, e.g. "Sheet1!A1:D100"' },
          sortOrders: {
            type: 'array',
            description: 'Sort criteria (applied in order)',
            items: {
              type: 'object',
              properties: {
                dimensionIndex: { type: 'number', description: 'Column index (0-based)' },
                sortOrder: { type: 'string', enum: ['ASCENDING', 'DESCENDING'] },
              },
              required: ['dimensionIndex', 'sortOrder'],
            },
          },
        },
        required: ['spreadsheetId', 'range', 'sortOrders'],
      },
    },

    // ── Filter Views ──────────────────────────────────────────────────────
    {
      name: 'create_filter_view',
      description: 'Create a temporary filter view (does not affect other users)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number' },
          title: { type: 'string', description: 'Filter view title' },
          startRow: { type: 'number', description: 'Filter range start row (0-indexed)' },
          endRow: { type: 'number', description: 'Filter range end row (0-indexed)' },
          startColumn: { type: 'number', description: 'Filter range start column (0-indexed)' },
          endColumn: { type: 'number', description: 'Filter range end column (0-indexed)' },
        },
        required: ['spreadsheetId', 'sheetId', 'title'],
      },
    },
    {
      name: 'update_filter_view',
      description: 'Update filter view criteria or range',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          filterViewId: { type: 'number', description: 'Filter view ID' },
          title: { type: 'string' },
          startRow: { type: 'number' }, endRow: { type: 'number' },
          startColumn: { type: 'number' }, endColumn: { type: 'number' },
          filterCriteria: {
            type: 'array',
            description: 'Array of column filter criteria',
            items: {
              type: 'object',
              properties: {
                columnIndex: { type: 'number' },
                values: { type: 'array', items: { type: 'string' }, description: 'Visible values (omit to show all)' },
              },
              required: ['columnIndex'],
            },
          },
        },
        required: ['spreadsheetId', 'filterViewId'],
      },
    },
    {
      name: 'delete_filter_view',
      description: 'Delete a filter view',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          filterViewId: { type: 'number' },
        },
        required: ['spreadsheetId', 'filterViewId'],
      },
    },

    // ── Slicer ────────────────────────────────────────────────────────────
    {
      name: 'add_slicer',
      description: 'Add a slicer (interactive filter UI element) linked to a pivot table or data range',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string' },
          sheetId: { type: 'number', description: 'Sheet to place the slicer on' },
          columnIndex: { type: 'number', description: 'Column index (0-based) of the data to filter' },
          dataRange: { type: 'string', description: 'A1 notation range of the source data (optional, for non-pivot-table sources)' },
          pivotTableAnchorSheetId: { type: 'number', description: 'Sheet ID of the pivot table to link (optional)' },
          pivotTableAnchorCellRow: { type: 'number', description: 'Row of the pivot table anchor cell (0-indexed, optional)' },
          pivotTableAnchorCellColumn: { type: 'number', description: 'Column of the pivot table anchor cell (0-indexed, optional)' },
          position: {
            type: 'object',
            properties: {
              row: { type: 'number' }, column: { type: 'number' },
              offsetPx: { type: 'number' },
              width: { type: 'number' }, height: { type: 'number' },
            },
          },
        },
        required: ['spreadsheetId', 'sheetId', 'columnIndex'],
      },
    },
  ];
}

// ─── Execution ──────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: any,
  oauth2Client: any,
): Promise<any> {
  const sheets: SheetsClient = google.sheets({ version: 'v4', auth: oauth2Client });

  try {
    switch (name) {
      // ── Charts ──────────────────────────────────────────────────────
      case 'create_chart':
        return await createChart(sheets, args);
      case 'update_chart':
        return await updateChart(sheets, args);
      case 'delete_chart':
        return await deleteChart(sheets, args);
      case 'list_charts':
        return await listCharts(sheets, args);

      // ── Conditional Formatting ──────────────────────────────────────
      case 'add_conditional_format_rule':
        return await addConditionalFormatRule(sheets, args);
      case 'update_conditional_format_rule':
        return await updateConditionalFormatRule(sheets, args);
      case 'delete_conditional_format_rule':
        return await deleteConditionalFormatRule(sheets, args);
      case 'list_conditional_format_rules':
        return await listConditionalFormatRules(sheets, args);

      // ── Data Validation ─────────────────────────────────────────────
      case 'add_data_validation':
        return await addDataValidation(sheets, args);
      case 'update_data_validation':
        return await updateDataValidation(sheets, args);
      case 'delete_data_validation':
        return await deleteDataValidation(sheets, args);
      case 'list_data_validations':
        return await listDataValidations(sheets, args);

      // ── Protected Ranges ────────────────────────────────────────────
      case 'add_protected_range':
        return await addProtectedRange(sheets, args);
      case 'update_protected_range':
        return await updateProtectedRange(sheets, args);
      case 'delete_protected_range':
        return await deleteProtectedRange(sheets, args);
      case 'list_protected_ranges':
        return await listProtectedRanges(sheets, args);

      // ── Developer Metadata ──────────────────────────────────────────
      case 'add_developer_metadata':
        return await addDeveloperMetadata(sheets, args);
      case 'get_developer_metadata':
        return await getDeveloperMetadata(sheets, args);
      case 'search_developer_metadata':
        return await searchDeveloperMetadata(sheets, args);
      case 'delete_developer_metadata':
        return await deleteDeveloperMetadata(sheets, args);

      // ── Pivot Tables ────────────────────────────────────────────────
      case 'create_pivot_table':
        return await createPivotTable(sheets, args);

      // ── Sparkline ───────────────────────────────────────────────────
      case 'add_sparkline':
        return await addSparkline(sheets, args);

      // ── Data Sources ────────────────────────────────────────────────
      case 'create_data_source':
        return await createDataSource(sheets, args);
      case 'list_data_sources':
        return await listDataSources(sheets, args);

      // ── Named Ranges ────────────────────────────────────────────────
      case 'create_named_range':
        return await createNamedRange(sheets, args);
      case 'update_named_range':
        return await updateNamedRange(sheets, args);
      case 'delete_named_range':
        return await deleteNamedRange(sheets, args);
      case 'list_named_ranges':
        return await listNamedRanges(sheets, args);

      // ── Sheet Properties ────────────────────────────────────────────
      case 'update_sheet_properties':
        return await updateSheetProperties(sheets, args);
      case 'duplicate_sheet':
        return await duplicateSheet(sheets, args);
      case 'copy_sheet':
        return await copySheet(sheets, args);
      case 'move_sheet':
        return await moveSheet(sheets, args);
      case 'update_sheet_tab_color':
        return await updateSheetTabColor(sheets, args);

      // ── Batch Operations ────────────────────────────────────────────
      case 'batch_update_spreadsheet':
        return await batchUpdateSpreadsheet(sheets, args);

      // ── Find & Replace ──────────────────────────────────────────────
      case 'find_replace_sheet':
        return await findReplaceSheet(sheets, args);

      // ── Sort ────────────────────────────────────────────────────────
      case 'sort_range':
        return await sortRange(sheets, args);

      // ── Filter Views ────────────────────────────────────────────────
      case 'create_filter_view':
        return await createFilterView(sheets, args);
      case 'update_filter_view':
        return await updateFilterView(sheets, args);
      case 'delete_filter_view':
        return await deleteFilterView(sheets, args);

      // ── Slicer ──────────────────────────────────────────────────────
      case 'add_slicer':
        return await addSlicer(sheets, args);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, `Failed to execute ${name}: ${error.message}`);
  }
}

// ─── Charts ─────────────────────────────────────────────────────────────────

async function createChart(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (!args.chartType) throw new McpError(ErrorCode.InvalidParams, 'chartType is required');
  if (!args.dataRange) throw new McpError(ErrorCode.InvalidParams, 'dataRange is required');

  const pos = args.position || {};
  const chart: any = {
    chartType: args.chartType,
    spec: {
      titleText: args.title || '',
      subtitleText: args.subtitle || '',
      fontName: args.fontName || 'Arial',
      basicChart: {
        chartType: args.chartType,
        legendPosition: args.legendPosition || 'BOTTOM_LEGEND',
        domains: [{ domain: { sourceRange: { sheetId: args.sheetId, startRowIndex: 0, endRowIndex: 1 } } }],
        series: [{ series: { sourceRange: { sheetId: args.sheetId } }, targetAxis: 'LEFT_AXIS' }],
      },
    },
    position: {
      overlayPosition: {
        anchorCell: { sheetId: args.sheetId, rowIndex: 0, columnIndex: 0 },
        offsetXPixels: pos.x || 0,
        offsetYPixels: pos.y || 0,
        widthPixels: pos.width || 600,
        heightPixels: pos.height || 400,
      },
    },
  };

  // Parse A1 notation for data range
  const a1Match = args.dataRange.match(/^([^!]+)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (a1Match) {
    const sheetName = a1Match[1];
    const startCol = colToIndex(a1Match[2]);
    const startRow = parseInt(a1Match[3]) - 1;
    const endCol = colToIndex(a1Match[4]);
    const endRow = parseInt(a1Match[5]);

    // Find sheetId from name
    const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.properties' });
    const sheet = ssResp.data.sheets?.find((s: any) => s.properties?.title === sheetName);
    const dataSheetId = sheet?.properties?.sheetId ?? args.sheetId;

    chart.spec.basicChart.domains = [{
      domain: { sourceRange: { sheetId: dataSheetId, startRowIndex: startRow, endRowIndex: startRow + 1, startColumnIndex: startCol, endColumnIndex: startCol + 1 } },
    }];
    chart.spec.basicChart.series = [{
      series: { sourceRange: { sheetId: dataSheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol + 1, endColumnIndex: endCol + 1 } },
      targetAxis: 'LEFT_AXIS',
    }];
  }

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: { requests: [{ addChart: { chart } }] },
  });

  const chartId = resp.data.replies?.[0]?.addChart?.chart?.chartId;
  return ok({ success: true, chartId, message: 'Chart created' });
}

async function updateChart(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.chartId === undefined) throw new McpError(ErrorCode.InvalidParams, 'chartId is required');

  // Get current chart
  const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.charts' });
  let currentChart: any = null;
  for (const sheet of ssResp.data.sheets || []) {
    for (const ch of sheet.charts || []) {
      if (ch.chartId === args.chartId) { currentChart = ch; break; }
    }
    if (currentChart) break;
  }
  if (!currentChart) throw new McpError(ErrorCode.InvalidParams, `Chart with ID ${args.chartId} not found`);

  const update: any = { chartId: args.chartId };
  const updateMask: string[] = [];

  if (args.chartType) {
    update.spec = update.spec || { ...currentChart.spec };
    update.spec.basicChart = update.spec.basicChart || { ...currentChart.spec?.basicChart };
    update.spec.basicChart.chartType = args.chartType;
    updateMask.push('spec.basicChart.chartType');
  }

  if (args.title !== undefined) {
    update.spec = update.spec || { ...currentChart.spec };
    update.spec.titleText = args.title;
    updateMask.push('spec.titleText');
  }

  if (args.legendPosition) {
    update.spec = update.spec || { ...currentChart.spec };
    update.spec.basicChart = update.spec.basicChart || { ...currentChart.spec?.basicChart };
    update.spec.basicChart.legendPosition = args.legendPosition;
    updateMask.push('spec.basicChart.legendPosition');
  }

  if (args.position) {
    const pos = args.position;
    update.position = {
      overlayPosition: {
        ...currentChart.position?.overlayPosition,
        offsetXPixels: pos.x ?? currentChart.position?.overlayPosition?.offsetXPixels,
        offsetYPixels: pos.y ?? currentChart.position?.overlayPosition?.offsetYPixels,
        widthPixels: pos.width ?? currentChart.position?.overlayPosition?.widthPixels,
        heightPixels: pos.height ?? currentChart.position?.overlayPosition?.heightPixels,
      },
    };
    updateMask.push('position');
  }

  if (updateMask.length === 0) throw new McpError(ErrorCode.InvalidParams, 'No properties to update');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: { requests: [{ updateChartSpec: { chartId: args.chartId, spec: update.spec || {} } }] } as any,
  } as any);

  return ok({ success: true, chartId: args.chartId, message: 'Chart updated' });
}

async function deleteChart(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.chartId === undefined) throw new McpError(ErrorCode.InvalidParams, 'chartId is required');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: { requests: [{ deleteEmbeddedObject: { objectId: args.chartId } }] },
  });

  return ok({ success: true, message: `Chart ${args.chartId} deleted` });
}

async function listCharts(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');

  const resp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.charts' });
  const charts: any[] = [];
  for (const sheet of resp.data.sheets || []) {
    if (args.sheetId !== undefined && sheet.properties?.sheetId !== args.sheetId) continue;
    for (const ch of sheet.charts || []) {
      charts.push({
        chartId: ch.chartId,
        chartType: (ch as any).spec?.chartType || (ch as any).chartType,
        title: (ch as any).spec?.titleText || (ch as any).spec?.title,
        sheetId: sheet.properties?.sheetId,
        position: ch.position?.overlayPosition,
      });
    }
  }

  return ok({ charts, total: charts.length });
}

// ─── Conditional Formatting ─────────────────────────────────────────────────

function buildConditionType(ct: string): any {
  const map: Record<string, string> = {
    CELL_IS: 'CELL_IS',
    TEXT_CONTAINS: 'TEXT_CONTAINS',
    TEXT_NOT_CONTAINS: 'TEXT_NOT_CONTAINS',
    TEXT_STARTS_WITH: 'TEXT_STARTS_WITH',
    TEXT_ENDS_WITH: 'TEXT_ENDS_WITH',
    DATE_BEFORE: 'DATE_BEFORE',
    DATE_AFTER: 'DATE_AFTER',
    DATE_BETWEEN: 'DATE_BETWEEN',
    NUMBER_GREATER: 'NUMBER_GREATER',
    NUMBER_LESS: 'NUMBER_LESS',
    NUMBER_EQ: 'NUMBER_EQ',
    NUMBER_NOT_EQ: 'NUMBER_NOT_EQ',
    NUMBER_BETWEEN: 'NUMBER_BETWEEN',
    CUSTOM_FORMULA: 'CUSTOM_FORMULA',
    IS_EMPTY: 'IS_EMPTY',
    IS_NOT_EMPTY: 'IS_NOT_EMPTY',
  };
  return map[ct] || 'CELL_IS';
}

function buildCondition(args: any): any {
  const ct = args.conditionType || 'CELL_IS';
  const vals = args.conditionValues || [];

  if (ct === 'CUSTOM_FORMULA') {
    return { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: args.conditionFormula || '=TRUE' }] };
  }
  if (ct === 'IS_EMPTY') return { type: 'IS_EMPTY' };
  if (ct === 'IS_NOT_EMPTY') return { type: 'IS_NOT_EMPTY' };

  return {
    type: buildConditionType(ct),
    values: vals.map((v: string) => ({ userEnteredValue: v })),
  };
}

async function addConditionalFormatRule(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (!args.ruleType) throw new McpError(ErrorCode.InvalidParams, 'ruleType is required');

  const range: any = {
    sheetId: args.sheetId,
    startRowIndex: args.startRow !== undefined ? args.startRow - 1 : 0,
    endRowIndex: args.endRow ?? undefined,
    startColumnIndex: args.startColumn !== undefined ? args.startColumn - 1 : 0,
    endColumnIndex: args.endColumn ?? undefined,
  };

  let rule: any;

  if (args.ruleType === 'gradientRule') {
    rule = {
      ranges: [range],
      gradientRule: {
        minpoint: { color: parseColor(args.gradientMinColor || '#FFFFFF') },
        maxpoint: { color: parseColor(args.gradientMaxColor || '#000000') },
      },
    };
    if (args.gradientMidColor) {
      rule.gradientRule.midpoint = { color: parseColor(args.gradientMidColor) };
    }
  } else {
    // booleanRule
    rule = {
      ranges: [range],
      booleanRule: {
        condition: buildCondition(args),
        format: {
          textFormat: {
            ...(args.bold !== undefined ? { bold: args.bold } : {}),
            ...(args.italic !== undefined ? { italic: args.italic } : {}),
            ...(args.strikethrough !== undefined ? { strikethrough: args.strikethrough } : {}),
            ...(args.foregroundColor ? { foregroundColor: parseColor(args.foregroundColor) } : {}),
          },
          ...(args.backgroundColor ? { backgroundColor: parseColor(args.backgroundColor) } : {}),
        },
      },
    };
  }

  // Get current rules to insert at correct position
  const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.conditionalFormats' });
  let currentRules: any[] = [];
  for (const sheet of ssResp.data.sheets || []) {
    if (sheet.properties?.sheetId === args.sheetId) {
      currentRules = sheet.conditionalFormats || [];
      break;
    }
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        updateConditionalFormatRule: {
          rule,
          index: currentRules.length,
        },
      }],
    },
  });

  return ok({ success: true, message: 'Conditional format rule added', ruleIndex: currentRules.length });
}

async function updateConditionalFormatRule(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (args.ruleIndex === undefined) throw new McpError(ErrorCode.InvalidParams, 'ruleIndex is required');

  const range: any = {
    sheetId: args.sheetId,
    startRowIndex: args.startRow !== undefined ? args.startRow - 1 : 0,
    endRowIndex: args.endRow ?? undefined,
    startColumnIndex: args.startColumn !== undefined ? args.startColumn - 1 : 0,
    endColumnIndex: args.endColumn ?? undefined,
  };

  let rule: any;
  if (args.ruleType === 'gradientRule') {
    rule = {
      ranges: [range],
      gradientRule: {
        minpoint: { color: parseColor(args.gradientMinColor || '#FFFFFF') },
        maxpoint: { color: parseColor(args.gradientMaxColor || '#000000') },
      },
    };
    if (args.gradientMidColor) rule.gradientRule.midpoint = { color: parseColor(args.gradientMidColor) };
  } else {
    rule = {
      ranges: [range],
      booleanRule: {
        condition: buildCondition(args),
        format: {
          textFormat: {
            ...(args.bold !== undefined ? { bold: args.bold } : {}),
            ...(args.italic !== undefined ? { italic: args.italic } : {}),
            ...(args.strikethrough !== undefined ? { strikethrough: args.strikethrough } : {}),
            ...(args.foregroundColor ? { foregroundColor: parseColor(args.foregroundColor) } : {}),
          },
          ...(args.backgroundColor ? { backgroundColor: parseColor(args.backgroundColor) } : {}),
        },
      },
    };
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        updateConditionalFormatRule: {
          rule,
          index: args.ruleIndex,
        },
      }],
    },
  });

  return ok({ success: true, message: `Conditional format rule at index ${args.ruleIndex} updated` });
}

async function deleteConditionalFormatRule(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (args.ruleIndex === undefined) throw new McpError(ErrorCode.InvalidParams, 'ruleIndex is required');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        deleteConditionalFormatRule: {
          sheetId: args.sheetId,
          index: args.ruleIndex,
        },
      }],
    },
  });

  return ok({ success: true, message: `Conditional format rule at index ${args.ruleIndex} deleted` });
}

async function listConditionalFormatRules(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');

  const resp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.conditionalFormats,sheets.properties' });
  for (const sheet of resp.data.sheets || []) {
    if (sheet.properties?.sheetId === args.sheetId) {
      const rules = (sheet.conditionalFormats || []).map((r: any, i: number) => ({ index: i, ...r }));
      return ok({ rules, total: rules.length });
    }
  }

  return ok({ rules: [], total: 0 });
}

// ─── Data Validation ────────────────────────────────────────────────────────

function buildValidationCriteria(args: any): any {
  const type = args.type;

  switch (type) {
    case 'LIST': {
      const vals = args.values || [];
      return {
        condition: {
          type: 'ONE_OF_LIST',
          values: vals.map((v: string) => ({ userEnteredValue: v })),
        },
        showCustomMenu: true,
        strict: args.strict !== false,
      };
    }
    case 'CHECKBOX':
      return {
        condition: { type: 'CHECKBOX' },
        strict: true,
      };
    case 'DATE': {
      const cond = args.condition || 'BETWEEN';
      const condTypeMap: Record<string, string> = {
        BETWEEN: 'DATE_BETWEEN',
        NOT_BETWEEN: 'DATE_NOT_BETWEEN',
        EQUAL: 'DATE_EQ',
        NOT_EQUAL: 'DATE_NOT_EQ',
        GREATER: 'DATE_AFTER',
        LESS: 'DATE_BEFORE',
        GREATER_EQUAL: 'DATE_EQ_OR_AFTER',
        LESS_EQUAL: 'DATE_EQ_OR_BEFORE',
      };
      return {
        condition: {
          type: condTypeMap[cond] || 'DATE_BETWEEN',
          values: [
            { userEnteredValue: args.min || 'TODAY()-30' },
            { userEnteredValue: args.max || 'TODAY()' },
          ],
        },
        strict: args.strict !== false,
      };
    }
    case 'NUMBER': {
      const cond = args.condition || 'BETWEEN';
      const condTypeMap: Record<string, string> = {
        BETWEEN: 'NUMBER_BETWEEN',
        NOT_BETWEEN: 'NUMBER_NOT_BETWEEN',
        EQUAL: 'NUMBER_EQ',
        NOT_EQUAL: 'NUMBER_NOT_EQ',
        GREATER: 'NUMBER_GREATER',
        LESS: 'NUMBER_LESS',
        GREATER_EQUAL: 'NUMBER_GREATER_THAN_EQ',
        LESS_EQUAL: 'NUMBER_LESS_THAN_EQ',
      };
      return {
        condition: {
          type: condTypeMap[cond] || 'NUMBER_BETWEEN',
          values: [
            { userEnteredValue: args.min || '0' },
            { userEnteredValue: args.max || '100' },
          ],
        },
        strict: args.strict !== false,
      };
    }
    case 'TEXT':
      return {
        condition: { type: 'TEXT_IS_VALID' },
        strict: args.strict !== false,
      };
    case 'CUSTOM_FORMULA':
      return {
        condition: {
          type: 'CUSTOM_FORMULA',
          values: [{ userEnteredValue: args.formula || '=TRUE' }],
        },
        strict: args.strict !== false,
      };
    default:
      throw new McpError(ErrorCode.InvalidParams, `Unknown validation type: ${type}`);
  }
}

async function addDataValidation(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (!args.type) throw new McpError(ErrorCode.InvalidParams, 'type is required');
  if (args.startRow === undefined || args.endRow === undefined || args.startColumn === undefined || args.endColumn === undefined) {
    throw new McpError(ErrorCode.InvalidParams, 'startRow, endRow, startColumn, and endColumn are required');
  }

  const criteria = buildValidationCriteria(args);
  if (args.inputMessage) criteria.inputMessage = { title: '', message: args.inputMessage };
  if (args.errorMessage) criteria.errorMessage = { title: 'Invalid', message: args.errorMessage, showCustomUi: true };
  if (args.color) criteria.backgroundColor = parseColor(args.color);
  if (args.showCustomMessage !== undefined) criteria.showCustomUi = args.showCustomMessage;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        setDataValidation: {
          range: {
            sheetId: args.sheetId,
            startRowIndex: args.startRow - 1,
            endRowIndex: args.endRow,
            startColumnIndex: args.startColumn - 1,
            endColumnIndex: args.endColumn,
          },
          rule: criteria,
        },
      }],
    },
  });

  return ok({ success: true, message: 'Data validation added' });
}

async function updateDataValidation(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (args.startRow === undefined || args.endRow === undefined || args.startColumn === undefined || args.endColumn === undefined) {
    throw new McpError(ErrorCode.InvalidParams, 'startRow, endRow, startColumn, and endColumn are required');
  }

  const criteria = args.type ? buildValidationCriteria(args) : undefined;
  if (!criteria) throw new McpError(ErrorCode.InvalidParams, 'type is required for update');

  if (args.inputMessage) criteria.inputMessage = { title: '', message: args.inputMessage };
  if (args.errorMessage) criteria.errorMessage = { title: 'Invalid', message: args.errorMessage, showCustomUi: true };
  if (args.color) criteria.backgroundColor = parseColor(args.color);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        setDataValidation: {
          range: {
            sheetId: args.sheetId,
            startRowIndex: args.startRow - 1,
            endRowIndex: args.endRow,
            startColumnIndex: args.startColumn - 1,
            endColumnIndex: args.endColumn,
          },
          rule: criteria,
        },
      }],
    },
  });

  return ok({ success: true, message: 'Data validation updated' });
}

async function deleteDataValidation(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (args.startRow === undefined || args.endRow === undefined || args.startColumn === undefined || args.endColumn === undefined) {
    throw new McpError(ErrorCode.InvalidParams, 'startRow, endRow, startColumn, and endColumn are required');
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        setDataValidation: {
          range: {
            sheetId: args.sheetId,
            startRowIndex: args.startRow - 1,
            endRowIndex: args.endRow,
            startColumnIndex: args.startColumn - 1,
            endColumnIndex: args.endColumn,
          },
          rule: undefined,
        },
      }],
    },
  });

  return ok({ success: true, message: 'Data validation removed' });
}

async function listDataValidations(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');

  // The Sheets API does not expose a direct list endpoint for data validations.
  // We must fetch the sheet and check the dataValidation field via spreadsheets.get with specific fields.
  const resp = await sheets.spreadsheets.get({
    spreadsheetId: args.spreadsheetId,
    fields: 'sheets.dataValidation,sheets.properties',
  });

  // Unfortunately, spreadsheets.get does not return dataValidation details.
  // Data validations are stored internally. We return what we can from sheet properties.
  // In practice, the only reliable way is to read cells and check for validation rules,
  // which the API does not expose directly via GET. We report what the API supports.

  return ok({
    message: 'Data validation info is limited via API. Use list_sheets to see sheet metadata. Individual cell validations are not enumerable via GET. Apply/remove validations using add_data_validation and delete_data_validation.',
    spreadsheetId: args.spreadsheetId,
    sheetId: args.sheetId,
  });
}

// ─── Protected Ranges ───────────────────────────────────────────────────────

async function addProtectedRange(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');

  const range: any = {};
  if (args.sheetId !== undefined && args.startRow === undefined) {
    // Entire sheet
    range.sheetId = args.sheetId;
  } else if (args.startRow !== undefined) {
    range.sheetId = args.sheetId;
    range.startRowIndex = args.startRow - 1;
    range.endRowIndex = args.endRow;
    range.startColumnIndex = args.startColumn - 1;
    range.endColumnIndex = args.endColumn;
  }

  const protectedRange: any = {
    range,
    description: args.description || '',
    warningOnly: args.warningOnly || false,
  };

  if (args.editors) {
    protectedRange.editors = {
      ...(args.editors.users ? { users: args.editors.users } : {}),
      ...(args.editors.groups ? { groups: args.editors.groups } : {}),
      ...(args.editors.domainUsersCanEdit ? { domainUsersCanEdit: true } : {}),
    };
  }

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{ addProtectedRange: { protectedRange } }],
    },
  });

  const prId = resp.data.replies?.[0]?.addProtectedRange?.protectedRange?.protectedRangeId;
  return ok({ success: true, protectedRangeId: prId, message: 'Protected range created' });
}

async function updateProtectedRange(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.protectedRangeId === undefined) throw new McpError(ErrorCode.InvalidParams, 'protectedRangeId is required');

  // Fetch existing protected range
  const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.protectedRanges' });
  let existing: any = null;
  for (const sheet of ssResp.data.sheets || []) {
    for (const pr of sheet.protectedRanges || []) {
      if (pr.protectedRangeId === args.protectedRangeId) { existing = pr; break; }
    }
    if (existing) break;
  }
  if (!existing) throw new McpError(ErrorCode.InvalidParams, `Protected range ${args.protectedRangeId} not found`);

  const updated: any = {
    protectedRangeId: args.protectedRangeId,
    range: existing.range,
    description: args.description ?? existing.description,
    warningOnly: args.warningOnly ?? existing.warningOnly,
  };

  if (args.editors) {
    updated.editors = {
      ...(args.editors.users ? { users: args.editors.users } : {}),
      ...(args.editors.groups ? { groups: args.editors.groups } : {}),
      ...(args.editors.domainUsersCanEdit ? { domainUsersCanEdit: true } : {}),
    };
  } else if (existing.editors) {
    updated.editors = existing.editors;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{ updateProtectedRange: { protectedRange: updated } }],
    },
  });

  return ok({ success: true, protectedRangeId: args.protectedRangeId, message: 'Protected range updated' });
}

async function deleteProtectedRange(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.protectedRangeId === undefined) throw new McpError(ErrorCode.InvalidParams, 'protectedRangeId is required');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{ deleteProtectedRange: { protectedRangeId: args.protectedRangeId } }],
    },
  });

  return ok({ success: true, message: `Protected range ${args.protectedRangeId} deleted` });
}

async function listProtectedRanges(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');

  const resp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.protectedRanges,sheets.properties' });
  const ranges: any[] = [];
  for (const sheet of resp.data.sheets || []) {
    for (const pr of sheet.protectedRanges || []) {
      ranges.push({
        ...pr,
        sheetTitle: sheet.properties?.title,
      });
    }
  }

  return ok({ protectedRanges: ranges, total: ranges.length });
}

// ─── Developer Metadata ─────────────────────────────────────────────────────

function buildMetadataLocation(args: any): any {
  switch (args.locationType) {
    case 'SPREADSHEET':
      return { spreadsheet: true };
    case 'SHEET':
      if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required for SHEET location');
      return { sheetId: args.sheetId };
    case 'RANGE': {
      if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required for RANGE location');
      return {
        range: {
          sheetId: args.sheetId,
          startRowIndex: args.startRow !== undefined ? args.startRow - 1 : 0,
          endRowIndex: args.endRow ?? undefined,
          startColumnIndex: args.startColumn !== undefined ? args.startColumn - 1 : 0,
          endColumnIndex: args.endColumn ?? undefined,
        },
      };
    }
    default:
      throw new McpError(ErrorCode.InvalidParams, `Unknown locationType: ${args.locationType}. Use SPREADSHEET, SHEET, or RANGE`);
  }
}

async function addDeveloperMetadata(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (!args.metadataKey) throw new McpError(ErrorCode.InvalidParams, 'metadataKey is required');
  if (!args.metadataValue) throw new McpError(ErrorCode.InvalidParams, 'metadataValue is required');
  if (!args.locationType) throw new McpError(ErrorCode.InvalidParams, 'locationType is required');

  const location = buildMetadataLocation(args);
  const visibility = args.visibility || 'DOCUMENT';

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        createDeveloperMetadata: {
          developerMetadata: {
            metadataKey: args.metadataKey,
            metadataValue: args.metadataValue,
            location,
            visibility,
          },
        },
      }],
    },
  });

  const mdId = resp.data.replies?.[0]?.createDeveloperMetadata?.developerMetadata?.metadataId;
  return ok({ success: true, metadataId: mdId, message: 'Developer metadata added' });
}

async function getDeveloperMetadata(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.metadataId === undefined) throw new McpError(ErrorCode.InvalidParams, 'metadataId is required');

  const resp = await sheets.spreadsheets.developerMetadata.get({
    spreadsheetId: args.spreadsheetId,
    metadataId: args.metadataId,
  });

  return ok(resp.data);
}

async function searchDeveloperMetadata(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');

  const searchData: any = {};
  if (args.metadataKey) searchData.metadataKey = args.metadataKey;
  if (args.metadataValue) searchData.metadataValue = args.metadataValue;

  const resp = await sheets.spreadsheets.developerMetadata.search({
    spreadsheetId: args.spreadsheetId,
    requestBody: { dataFilters: [searchData] },
  });

  return ok({ metadata: resp.data.matchedDeveloperMetadata || [], total: (resp.data.matchedDeveloperMetadata || []).length });
}

async function deleteDeveloperMetadata(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.metadataId === undefined) throw new McpError(ErrorCode.InvalidParams, 'metadataId is required');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        deleteDeveloperMetadata: {
          dataFilter: { developerMetadataLookup: { metadataId: args.metadataId } },
        },
      }],
    },
  });

  return ok({ success: true, message: `Developer metadata ${args.metadataId} deleted` });
}

// ─── Pivot Tables ───────────────────────────────────────────────────────────

async function createPivotTable(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sourceSheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sourceSheetId is required');
  if (args.targetSheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'targetSheetId is required');

  const source: any = {
    sheetId: args.sourceSheetId,
    startRowIndex: (args.sourceStartRow || 1) - 1,
    startColumnIndex: (args.sourceStartColumn || 1) - 1,
  };
  if (args.sourceEndRow !== undefined) source.endRowIndex = args.sourceEndRow;
  if (args.sourceEndColumn !== undefined) source.endColumnIndex = args.sourceEndColumn;

  const pivotTable: any = {
    source,
    rows: (args.rows || []).map((r: any) => ({
      sourceColumnOffset: r.fieldIndex,
      showTotals: r.showTotals !== false,
      sortOrder: r.sortOrder || 'ASCENDING',
    })),
    columns: (args.columns || []).map((c: any) => ({
      sourceColumnOffset: c.fieldIndex,
      showTotals: c.showTotals !== false,
      sortOrder: c.sortOrder || 'ASCENDING',
    })),
    values: (args.values || []).map((v: any) => ({
      sourceColumnOffset: v.fieldIndex,
      summarizeFunction: v.summarizeFunction || 'SUM',
    })),
    criteria: {},
    valueLayout: 'HORIZONTAL',
  };

  // Build filter criteria
  if (args.filters) {
    for (const f of args.filters) {
      pivotTable.criteria[String(f.fieldIndex)] = {
        filterType: 'VALUES',
        visibleValues: {
          values: (f.visibleValues || []).map((v: string) => v),
        },
      };
    }
  }

  const location: any = {
    sheetId: args.targetSheetId,
    startRow: args.targetStartRow || 0,
    startColumn: args.targetStartColumn || 0,
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        updateCells: {
          rows: [{ values: [{ pivotTable }] }],
          fields: 'pivotTable',
          start: {
            sheetId: args.targetSheetId,
            rowIndex: args.targetStartRow || 0,
            columnIndex: args.targetStartColumn || 0,
          },
        },
      }],
    },
  });

  return ok({ success: true, message: 'Pivot table created', targetSheetId: args.targetSheetId });
}

// ─── Sparkline ──────────────────────────────────────────────────────────────

async function addSparkline(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (!args.cell) throw new McpError(ErrorCode.InvalidParams, 'cell is required');
  if (!args.dataRange) throw new McpError(ErrorCode.InvalidParams, 'dataRange is required');
  if (!args.chartType) throw new McpError(ErrorCode.InvalidParams, 'chartType is required');

  // Build SPARKLINE formula with named options array
  const optionsParts: string[] = [`"charttype","${args.chartType}"`];
  if (args.color) optionsParts.push(`"color","${args.color}"`);
  if (args.negateColor) optionsParts.push(`"negcolor","${args.negateColor}"`);
  if (args.maxColor) optionsParts.push(`"maxcolor","${args.maxColor}"`);
  if (args.minColor) optionsParts.push(`"mincolor","${args.minColor}"`);
  if (args.lineWidth) optionsParts.push(`"linewidth",${args.lineWidth}`);
  if (args.yMin) optionsParts.push(`"ymin","${args.yMin}"`);
  if (args.yMax) optionsParts.push(`"ymax","${args.yMax}"`);

  const sparkFormula = `=SPARKLINE(${args.dataRange}, {${optionsParts.join(', ')}})`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: args.spreadsheetId,
    range: args.cell,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[sparkFormula]] },
  });

  return ok({ success: true, cell: args.cell, formula: sparkFormula });
}

// ─── Data Sources ───────────────────────────────────────────────────────────

async function createDataSource(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (!args.dataSourceId) throw new McpError(ErrorCode.InvalidParams, 'dataSourceId is required');
  if (!args.type) throw new McpError(ErrorCode.InvalidParams, 'type is required');

  const ds: any = {
    dataSourceId: args.dataSourceId,
    name: args.name || args.dataSourceId,
    type: args.type,
  };

  if (args.type === 'BIGQUERY' && args.bigQueryOptions) {
    ds.bigQueryOptions = {
      ...(args.bigQueryOptions.projectId ? { projectId: args.bigQueryOptions.projectId } : {}),
      ...(args.bigQueryOptions.datasetId ? { datasetId: args.bigQueryOptions.datasetId } : {}),
      ...(args.bigQueryOptions.tableId ? { tableId: args.bigQueryOptions.tableId } : {}),
      ...(args.bigQueryOptions.query ? { query: args.bigQueryOptions.query } : {}),
    };
  }

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{ addDataSource: { dataSource: ds } }],
    },
  });

  return ok({ success: true, dataSourceId: args.dataSourceId, message: 'Data source created' });
}

async function listDataSources(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');

  const resp = await sheets.spreadsheets.get({
    spreadsheetId: args.spreadsheetId,
    fields: 'dataSources',
  });

  return ok({
    dataSources: resp.data.dataSources || [],
  });
}

// ─── Named Ranges ───────────────────────────────────────────────────────────

async function createNamedRange(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');

  // Parse A1 range if provided
  let range: any = {};
  if (args.a1Range) {
    // The API accepts A1 ranges via the range field in the batchUpdate
    // We need to build a GridRange from A1 notation
    const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.properties' });
    const a1Match = args.a1Range.match(/^([^!]+)!(.+)$/);
    const sheetName = a1Match ? a1Match[1] : args.a1Range;
    const cellRange = a1Match ? a1Match[2] : '';

    const sheet = ssResp.data.sheets?.find((s: any) => s.properties?.title === sheetName);
    const sheetId = sheet?.properties?.sheetId ?? 0;

    if (cellRange) {
      const cellMatch = cellRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (cellMatch) {
        range = {
          sheetId,
          startRowIndex: parseInt(cellMatch[2]) - 1,
          endRowIndex: parseInt(cellMatch[4]),
          startColumnIndex: colToIndex(cellMatch[1]),
          endColumnIndex: colToIndex(cellMatch[3]) + 1,
        };
      } else {
        // Single cell
        const singleMatch = cellRange.match(/^([A-Z]+)(\d+)$/i);
        if (singleMatch) {
          range = {
            sheetId,
            startRowIndex: parseInt(singleMatch[2]) - 1,
            endRowIndex: parseInt(singleMatch[2]),
            startColumnIndex: colToIndex(singleMatch[1]),
            endColumnIndex: colToIndex(singleMatch[1]) + 1,
          };
        }
      }
    } else {
      // Entire sheet
      range = { sheetId };
    }
  } else if (args.sheetId !== undefined) {
    range = gridRange(args);
  } else {
    throw new McpError(ErrorCode.InvalidParams, 'a1Range is required');
  }

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        addNamedRange: {
          namedRange: {
            name: args.name,
            range,
          },
        },
      }],
    },
  });

  const nrId = resp.data.replies?.[0]?.addNamedRange?.namedRange?.namedRangeId;
  return ok({ success: true, namedRangeId: nrId, name: args.name });
}

async function updateNamedRange(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (!args.namedRangeId) throw new McpError(ErrorCode.InvalidParams, 'namedRangeId is required');

  // Fetch existing
  const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'namedRanges' });
  const existing = (ssResp.data.namedRanges || []).find((nr: any) => nr.namedRangeId === args.namedRangeId);
  if (!existing) throw new McpError(ErrorCode.InvalidParams, `Named range ${args.namedRangeId} not found`);

  let range = existing.range;
  if (args.a1Range) {
    const ssResp2 = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.properties' });
    const a1Match = args.a1Range.match(/^([^!]+)!(.+)$/);
    const sheetName = a1Match ? a1Match[1] : args.a1Range;
    const cellRange = a1Match ? a1Match[2] : '';
    const sheet = ssResp2.data.sheets?.find((s: any) => s.properties?.title === sheetName);
    const sheetId = sheet?.properties?.sheetId ?? existing.range?.sheetId ?? 0;

    if (cellRange) {
      const cellMatch = cellRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (cellMatch) {
        range = {
          sheetId,
          startRowIndex: parseInt(cellMatch[2]) - 1,
          endRowIndex: parseInt(cellMatch[4]),
          startColumnIndex: colToIndex(cellMatch[1]),
          endColumnIndex: colToIndex(cellMatch[3]) + 1,
        };
      }
    }
  } else if (args.sheetId !== undefined) {
    range = gridRange(args);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        updateNamedRange: {
          namedRange: {
            namedRangeId: args.namedRangeId,
            name: args.name || existing.name,
            range,
          },
        },
      }],
    },
  });

  return ok({ success: true, namedRangeId: args.namedRangeId, message: 'Named range updated' });
}

async function deleteNamedRange(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (!args.namedRangeId) throw new McpError(ErrorCode.InvalidParams, 'namedRangeId is required');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        deleteNamedRange: { namedRangeId: args.namedRangeId },
      }],
    },
  });

  return ok({ success: true, message: `Named range ${args.namedRangeId} deleted` });
}

async function listNamedRanges(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');

  const resp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'namedRanges' });
  return ok({ namedRanges: resp.data.namedRanges || [], total: (resp.data.namedRanges || []).length });
}

// ─── Sheet Properties ───────────────────────────────────────────────────────

async function updateSheetProperties(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');

  const props: any = { sheetId: args.sheetId };
  const updateMask: string[] = [];

  if (args.title !== undefined) { props.title = args.title; updateMask.push('title'); }
  if (args.hidden !== undefined) { props.hidden = args.hidden; updateMask.push('hidden'); }
  if (args.tabColor) { props.tabColorStyle = { color: parseColor(args.tabColor) }; updateMask.push('tabColorStyle'); }
  if (args.frozenRowCount !== undefined || args.frozenColumnCount !== undefined || args.rowCount !== undefined || args.columnCount !== undefined) {
    props.gridProperties = {};
    if (args.frozenRowCount !== undefined) { props.gridProperties.frozenRowCount = args.frozenRowCount; }
    if (args.frozenColumnCount !== undefined) { props.gridProperties.frozenColumnCount = args.frozenColumnCount; }
    if (args.rowCount !== undefined) { props.gridProperties.rowCount = args.rowCount; }
    if (args.columnCount !== undefined) { props.gridProperties.columnCount = args.columnCount; }
    updateMask.push('gridProperties');
  }

  if (updateMask.length === 0) throw new McpError(ErrorCode.InvalidParams, 'No properties to update');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: props,
          fields: updateMask.join(','),
        },
      }],
    },
  });

  return ok({ success: true, message: 'Sheet properties updated', fields: updateMask });
}

async function duplicateSheet(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sourceSheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sourceSheetId is required');

  const req: any = { sourceSheetId: args.sourceSheetId };
  if (args.newSheetName) req.newSheetName = args.newSheetName;
  if (args.insertSheetIndex !== undefined) req.insertSheetIndex = args.insertSheetIndex;

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{ duplicateSheet: req }],
    },
  });

  const props = resp.data.replies?.[0]?.duplicateSheet?.properties;
  return ok({ success: true, sheetId: props?.sheetId, title: props?.title });
}

async function copySheet(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sourceSheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sourceSheetId is required');
  if (!args.destinationSpreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'destinationSpreadsheetId is required');

  const resp = await sheets.spreadsheets.sheets.copyTo({
    spreadsheetId: args.spreadsheetId,
    sheetId: args.sourceSheetId,
    requestBody: {
      destinationSpreadsheetId: args.destinationSpreadsheetId,
    },
  });

  return ok({ success: true, newSheetId: resp.data.sheetId, destinationSpreadsheetId: args.destinationSpreadsheetId });
}

async function moveSheet(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (args.newIndex === undefined) throw new McpError(ErrorCode.InvalidParams, 'newIndex is required');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId: args.sheetId,
            index: args.newIndex,
          },
          fields: 'index',
        },
      }],
    },
  });

  return ok({ success: true, message: `Sheet moved to index ${args.newIndex}` });
}

async function updateSheetTabColor(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (!args.color) throw new McpError(ErrorCode.InvalidParams, 'color is required');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId: args.sheetId,
            tabColorStyle: { color: parseColor(args.color) as any },
          },
          fields: 'tabColorStyle',
        },
      }],
    } as any,
  } as any);

  return ok({ success: true, message: `Tab color set to ${args.color}` });
}

// ─── Batch Operations ───────────────────────────────────────────────────────

async function batchUpdateSpreadsheet(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (!args.requests || !Array.isArray(args.requests)) throw new McpError(ErrorCode.InvalidParams, 'requests array is required');

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: args.requests,
    },
  });

  return ok({ success: true, replies: resp.data.replies || [], spreadsheetId: args.spreadsheetId });
}

// ─── Find & Replace ─────────────────────────────────────────────────────────

async function findReplaceSheet(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.find === undefined) throw new McpError(ErrorCode.InvalidParams, 'find is required');
  if (args.replacement === undefined) throw new McpError(ErrorCode.InvalidParams, 'replacement is required');

  const req: any = {
    find: args.find,
    replacement: args.replacement,
  };

  if (args.matchCase !== undefined) req.matchCase = args.matchCase;
  if (args.matchEntireCell !== undefined) req.matchEntireCell = args.matchEntireCell;
  if (args.searchByRegex !== undefined) req.searchByRegex = args.searchByRegex;
  if (args.includeFormulas !== undefined) req.includeFormulas = args.includeFormulas;

  // If a range is specified, set the sheetId
  if (args.range) {
    const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.properties' });
    const a1Match = args.range.match(/^([^!]+)!/);
    const sheetName = a1Match ? a1Match[1] : '';
    const sheet = ssResp.data.sheets?.find((s: any) => s.properties?.title === sheetName);
    if (sheet) {
      req.range = { sheetId: sheet.properties?.sheetId };
    }
  }

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{ findReplace: req }],
    },
  });

  const result = resp.data.replies?.[0]?.findReplace;
  return ok({
    success: true,
    occurrencesChanged: result?.occurrencesChanged || 0,
    sheetsChanged: result?.sheetsChanged || 0,
  });
}

// ─── Sort ───────────────────────────────────────────────────────────────────

async function sortRange(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (!args.range) throw new McpError(ErrorCode.InvalidParams, 'range is required');
  if (!args.sortOrders || !Array.isArray(args.sortOrders) || args.sortOrders.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, 'sortOrders array is required');
  }

  // Parse A1 range to get GridRange
  const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.properties' });
  const a1Match = args.range.match(/^([^!]+)!(.+)$/);
  if (!a1Match) throw new McpError(ErrorCode.InvalidParams, 'range must be in A1 notation, e.g. "Sheet1!A1:D100"');

  const sheetName = a1Match[1];
  const cellRange = a1Match[2];
  const sheet = ssResp.data.sheets?.find((s: any) => s.properties?.title === sheetName);
  if (!sheet) throw new McpError(ErrorCode.InvalidParams, `Sheet "${sheetName}" not found`);

  const cellMatch = cellRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!cellMatch) throw new McpError(ErrorCode.InvalidParams, 'Range must use full A1 notation like A1:D100');

  const gridRange: any = {
    sheetId: sheet.properties?.sheetId,
    startRowIndex: parseInt(cellMatch[2]) - 1,
    endRowIndex: parseInt(cellMatch[4]),
    startColumnIndex: colToIndex(cellMatch[1]),
    endColumnIndex: colToIndex(cellMatch[3]) + 1,
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        sortRange: {
          range: gridRange,
          sortSpecs: args.sortOrders.map((o: any) => ({
            dimensionIndex: o.dimensionIndex,
            sortOrder: o.sortOrder || 'ASCENDING',
          })),
        },
      }],
    },
  });

  return ok({ success: true, message: 'Range sorted' });
}

// ─── Filter Views ───────────────────────────────────────────────────────────

async function createFilterView(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (!args.title) throw new McpError(ErrorCode.InvalidParams, 'title is required');

  const req: any = {
    title: args.title,
    range: { sheetId: args.sheetId },
  };

  if (args.startRow !== undefined) req.range.startRowIndex = args.startRow;
  if (args.endRow !== undefined) req.range.endRowIndex = args.endRow;
  if (args.startColumn !== undefined) req.range.startColumnIndex = args.startColumn;
  if (args.endColumn !== undefined) req.range.endColumnIndex = args.endColumn;

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{ addFilterView: req }],
    },
  });

  const fvId = resp.data.replies?.[0]?.addFilterView?.filter?.filterViewId;
  return ok({ success: true, filterViewId: fvId, title: args.title });
}

async function updateFilterView(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.filterViewId === undefined) throw new McpError(ErrorCode.InvalidParams, 'filterViewId is required');

  // Fetch current filter view
  const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.filterViews' });
  let existing: any = null;
  for (const sheet of ssResp.data.sheets || []) {
    for (const fv of sheet.filterViews || []) {
      if (fv.filterViewId === args.filterViewId) { existing = fv; break; }
    }
    if (existing) break;
  }
  if (!existing) throw new McpError(ErrorCode.InvalidParams, `Filter view ${args.filterViewId} not found`);

  const update: any = {
    filterViewId: args.filterViewId,
  };

  if (args.title) update.title = args.title;
  if (args.startRow !== undefined || args.endRow !== undefined || args.startColumn !== undefined || args.endColumn !== undefined) {
    update.range = {
      ...existing.range,
      startRowIndex: args.startRow ?? existing.range?.startRowIndex,
      endRowIndex: args.endRow ?? existing.range?.endRowIndex,
      startColumnIndex: args.startColumn ?? existing.range?.startColumnIndex,
      endColumnIndex: args.endColumn ?? existing.range?.endColumnIndex,
    };
  }

  if (args.filterCriteria && Array.isArray(args.filterCriteria)) {
    update.criteria = {};
    for (const fc of args.filterCriteria) {
      update.criteria[String(fc.columnIndex)] = {
        filterType: 'VALUES',
        visibleValues: {
          values: (fc.values || []).map((v: string) => v),
        },
      };
    }
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{ updateFilterView: update }],
    },
  });

  return ok({ success: true, filterViewId: args.filterViewId, message: 'Filter view updated' });
}

async function deleteFilterView(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.filterViewId === undefined) throw new McpError(ErrorCode.InvalidParams, 'filterViewId is required');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        deleteFilterView: { filterId: args.filterViewId },
      }],
    },
  });

  return ok({ success: true, message: `Filter view ${args.filterViewId} deleted` });
}

// ─── Slicer ─────────────────────────────────────────────────────────────────

async function addSlicer(sheets: SheetsClient, args: any) {
  if (!args.spreadsheetId) throw new McpError(ErrorCode.InvalidParams, 'spreadsheetId is required');
  if (args.sheetId === undefined) throw new McpError(ErrorCode.InvalidParams, 'sheetId is required');
  if (args.columnIndex === undefined) throw new McpError(ErrorCode.InvalidParams, 'columnIndex is required');

  const slicer: any = {
    filterCriteria: {},
  };

  // Set the data source anchor
  if (args.pivotTableAnchorSheetId !== undefined) {
    slicer.dataExecutionProperties = {
      sheetId: args.pivotTableAnchorSheetId,
      row: args.pivotTableAnchorCellRow || 0,
      column: args.pivotTableAnchorCellColumn || 0,
    };
  }

  if (args.dataRange) {
    // Parse A1 range for the slicer source
    const ssResp = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId, fields: 'sheets.properties' });
    const a1Match = args.dataRange.match(/^([^!]+)!/);
    const sheetName = a1Match ? a1Match[1] : '';
    const sheet = ssResp.data.sheets?.find((s: any) => s.properties?.title === sheetName);
    if (sheet) {
      slicer.dataExecutionProperties = {
        sheetId: sheet.properties?.sheetId,
        row: 0,
        column: args.columnIndex,
      };
    }
  }

  const pos: any = {
    anchorCell: {
      sheetId: args.sheetId,
      rowIndex: args.position?.row || 0,
      columnIndex: args.position?.column || args.columnIndex,
    },
  };
  if (args.position?.offsetPx) pos.offsetPixels = args.position.offsetPx;
  if (args.position?.width) pos.widthPixels = args.position.width;
  if (args.position?.height) pos.heightPixels = args.position.height;

  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [{
        addSlicer: {
          slicer: {
            ...slicer,
            position: pos,
          },
        },
      }],
    },
  });

  const slicerId = resp.data.replies?.[0]?.addSlicer?.slicer?.slicerId;
  return ok({ success: true, slicerId, message: 'Slicer added' });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a column letter string (A, B, ..., Z, AA, AB, ...) to 0-based index */
function colToIndex(col: string): number {
  const upper = col.toUpperCase();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}
