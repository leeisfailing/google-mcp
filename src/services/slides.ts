import { google, slides_v1 } from 'googleapis';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// ---------------------------------------------------------------------------
// EMU helpers
// ---------------------------------------------------------------------------
const EMU_PER_INCH = 914400;
const EMU_PER_POINT = 12700;

function inches(n: number): slides_v1.Schema$Dimension {
  return { magnitude: n * EMU_PER_INCH, unit: 'EMU' };
}

function points(n: number): slides_v1.Schema$Dimension {
  return { magnitude: n * EMU_PER_POINT, unit: 'EMU' };
}

function emuValue(n: number): slides_v1.Schema$Dimension {
  return { magnitude: n, unit: 'EMU' };
}

function toEmu(input: any, defaultUnit: 'inches' | 'points' | 'emu' = 'inches'): number {
  if (typeof input === 'number') {
    switch (defaultUnit) {
      case 'inches': return Math.round(input * EMU_PER_INCH);
      case 'points': return Math.round(input * EMU_PER_POINT);
      case 'emu': return Math.round(input);
    }
  }
  if (input && typeof input === 'object') {
    const v = Number(input.magnitude || 0);
    switch (input.unit) {
      case 'EMU': return Math.round(v);
      case 'PT': return Math.round(v * EMU_PER_POINT);
      case 'IN': return Math.round(v * EMU_PER_INCH);
    }
  }
  return Math.round(Number(input) * EMU_PER_INCH);
}

function pos(left: any, top: any): slides_v1.Schema$AffineTransform {
  return {
    scaleX: 1,
    scaleY: 1,
    shearX: 0,
    shearY: 0,
    translateX: toEmu(left),
    translateY: toEmu(top),
    unit: 'EMU',
  };
}

function size(w: any, h: any): slides_v1.Schema$Size {
  return {
    width: emuValue(toEmu(w)),
    height: emuValue(toEmu(h)),
  };
}

function rgbColor(r: number, g: number, b: number): slides_v1.Schema$OpaqueColor {
  return {
    rgbColor: {
      red: Math.max(0, Math.min(1, r / 255)),
      green: Math.max(0, Math.min(1, g / 255)),
      blue: Math.max(0, Math.min(1, b / 255)),
    },
  };
}

function hexToRgb(hex: string): slides_v1.Schema$OpaqueColor {
  const h = hex.replace(/^#/, '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return rgbColor(r, g, b);
}

function parseColor(input: any): slides_v1.Schema$OpaqueColor {
  if (!input) return rgbColor(0, 0, 0);
  if (typeof input === 'string') {
    if (input.startsWith('#')) return hexToRgb(input);
    // Try named colors or fallback to black
    return rgbColor(0, 0, 0);
  }
  if (input.rgbColor) return input;
  if (input.themeColor) return { themeColor: input.themeColor } as any;
  return input;
}

function makeTextContent(text: string, fontSize?: number, bold?: boolean): slides_v1.Schema$TextContent {
  const style: slides_v1.Schema$TextStyle = {};
  if (fontSize) style.fontSize = points(fontSize);
  if (bold !== undefined) style.bold = bold;
  return {
    lists: {},
  };
}

function generateId(): string {
  return 'g' + Math.random().toString(36).substring(2, 10);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

export function getTools(): ToolDefinition[] {
  return [
    // --- Presentation Operations ---
    {
      name: 'slides_create_presentation',
      description: 'Create a new Google Slides presentation with a title',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Presentation title' },
        },
        required: ['title'],
      },
    },
    {
      name: 'slides_get_presentation',
      description: 'Get full presentation details including all slides, layouts, and masters',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
        },
        required: ['presentationId'],
      },
    },
    {
      name: 'slides_delete_presentation',
      description: 'Delete a Google Slides presentation',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID to delete' },
        },
        required: ['presentationId'],
      },
    },
    {
      name: 'slides_list_presentation_slides',
      description: 'List all slides in a presentation with their IDs',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
        },
        required: ['presentationId'],
      },
    },

    // --- Slide Operations ---
    {
      name: 'slides_add_slide',
      description: 'Add a new slide to a presentation at a specific index',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          layoutId: { type: 'string', description: 'Layout ID to use (optional, defaults to BLANK)' },
          slideIndex: { type: 'number', description: '0-based index to insert at (optional, defaults to end)' },
        },
        required: ['presentationId'],
      },
    },
    {
      name: 'slides_delete_slide',
      description: 'Delete a slide from a presentation',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID to delete' },
        },
        required: ['presentationId', 'slideId'],
      },
    },
    {
      name: 'slides_duplicate_slide',
      description: 'Duplicate an existing slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID to duplicate' },
        },
        required: ['presentationId', 'slideId'],
      },
    },
    {
      name: 'slides_move_slide',
      description: 'Move a slide to a different position in the presentation',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID to move' },
          newIndex: { type: 'number', description: 'New 0-based index position' },
        },
        required: ['presentationId', 'slideId', 'newIndex'],
      },
    },
    {
      name: 'slides_get_slide',
      description: 'Get detailed information about a specific slide including all elements',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
        },
        required: ['presentationId', 'slideId'],
      },
    },

    // --- Shape & Element Operations ---
    {
      name: 'slides_create_shape',
      description: 'Create a shape on a slide (rectangle, ellipse, arrow, callout, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID to add shape to' },
          shapeType: {
            type: 'string',
            description: 'Shape type: RECTANGLE, ROUNDED_RECTANGLE, ELLIPSE, RIGHT_ARROW, LEFT_ARROW, DOWN_ARROW, UP_ARROW, RIGHT_ARROW_CALLOUT, LEFT_ARROW_CALLOUT, UP_ARROW_CALLOUT, DOWN_ARROW_CALLOUT, FLOW_CHART_PROCESS, FLOW_CHART_DECISION, THICK_ARROW, CLOUD, HEART, SUN, LIGHTNING_BOLT, MOON, DIAMOND, PENTAGON, HEXAGON, etc.',
          },
          left: { description: 'Left position (inches by default)' },
          top: { description: 'Top position (inches by default)' },
          width: { description: 'Width (inches by default)' },
          height: { description: 'Height (inches by default)' },
          unit: { type: 'string', description: 'Unit for position/size: inches (default), points, emu' },
          fill: { type: 'string', description: 'Fill color as hex (#FF0000) or named color' },
          border: {
            type: 'object',
            properties: {
              color: { type: 'string', description: 'Border color as hex' },
              weight: { type: 'number', description: 'Border weight in points' },
              dashStyle: { type: 'string', description: 'SOLID, DASH, DOT, DASH_DOT, LONG_DASH, LONG_DASH_DOT, LONG_DASH_DOT_DOT, CUSTOM_DASH' },
            },
          },
          text: { type: 'string', description: 'Optional text content inside the shape' },
          fontSize: { type: 'number', description: 'Font size in points for text' },
          elementId: { type: 'string', description: 'Optional custom element ID' },
        },
        required: ['presentationId', 'slideId', 'shapeType', 'left', 'top', 'width', 'height'],
      },
    },
    {
      name: 'slides_create_text_box',
      description: 'Create a text box on a slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          left: { description: 'Left position' },
          top: { description: 'Top position' },
          width: { description: 'Width' },
          height: { description: 'Height' },
          unit: { type: 'string', description: 'Unit: inches (default), points, emu' },
          text: { type: 'string', description: 'Text content' },
          fontSize: { type: 'number', description: 'Font size in points' },
          fontBold: { type: 'boolean', description: 'Bold text' },
          elementId: { type: 'string', description: 'Optional custom element ID' },
        },
        required: ['presentationId', 'slideId', 'left', 'top', 'width', 'height'],
      },
    },
    {
      name: 'slides_create_image',
      description: 'Insert an image on a slide from a URL',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          imageUrl: { type: 'string', description: 'URL of the image' },
          left: { description: 'Left position' },
          top: { description: 'Top position' },
          width: { description: 'Width' },
          height: { description: 'Height' },
          unit: { type: 'string', description: 'Unit: inches (default), points, emu' },
          elementId: { type: 'string', description: 'Optional custom element ID' },
        },
        required: ['presentationId', 'slideId', 'imageUrl', 'left', 'top', 'width', 'height'],
      },
    },
    {
      name: 'slides_create_line',
      description: 'Create a line or arrow between two points on a slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          startX: { description: 'Start X position' },
          startY: { description: 'Start Y position' },
          endX: { description: 'End X position' },
          endY: { description: 'End Y position' },
          unit: { type: 'string', description: 'Unit: inches (default), points, emu' },
          lineType: { type: 'string', description: 'STRAIGHT or RIGHT with elbow connectors' },
          lineCategory: { type: 'string', description: 'BOLD, LIGHT, DUOTONE, FILLED, etc.' },
          lineStyle: { type: 'string', description: 'SOLID, DASH, DOT, etc.' },
          lineWeight: { type: 'number', description: 'Line weight in points' },
          color: { type: 'string', description: 'Line color as hex' },
          hasArrowEnd: { type: 'boolean', description: 'Add arrowhead at end' },
          hasArrowStart: { type: 'boolean', description: 'Add arrowhead at start' },
          elementId: { type: 'string', description: 'Optional custom element ID' },
        },
        required: ['presentationId', 'slideId', 'startX', 'startY', 'endX', 'endY'],
      },
    },
    {
      name: 'slides_delete_element',
      description: 'Delete an element from a slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          elementId: { type: 'string', description: 'Element ID to delete' },
        },
        required: ['presentationId', 'slideId', 'elementId'],
      },
    },
    {
      name: 'slides_group_elements',
      description: 'Group multiple elements together on a slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          elementIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of element IDs to group (minimum 2)',
          },
          groupId: { type: 'string', description: 'Optional custom group ID' },
        },
        required: ['presentationId', 'slideId', 'elementIds'],
      },
    },
    {
      name: 'slides_ungroup_elements',
      description: 'Ungroup a grouped element on a slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          groupId: { type: 'string', description: 'Group element ID to ungroup' },
        },
        required: ['presentationId', 'slideId', 'groupId'],
      },
    },

    // --- Text & Formatting ---
    {
      name: 'slides_insert_text',
      description: 'Insert or replace text in an existing text element (shape, textbox)',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Element ID (shape or textbox)' },
          text: { type: 'string', description: 'Text to insert (replaces existing text)' },
          startIndex: { type: 'number', description: 'Start index for insertion (0-based, optional)' },
          endIndex: { type: 'number', description: 'End index for replacement range (optional)' },
        },
        required: ['presentationId', 'elementId', 'text'],
      },
    },
    {
      name: 'slides_update_text_style',
      description: 'Apply text formatting to a range of text in an element',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Element ID' },
          startIndex: { type: 'number', description: 'Start character index (0-based)' },
          endIndex: { type: 'number', description: 'End character index (exclusive)' },
          bold: { type: 'boolean', description: 'Bold' },
          italic: { type: 'boolean', description: 'Italic' },
          underline: { type: 'boolean', description: 'Underline' },
          strikethrough: { type: 'boolean', description: 'Strikethrough' },
          fontFamily: { type: 'string', description: 'Font family name' },
          fontSize: { type: 'number', description: 'Font size in points' },
          foregroundColor: { type: 'string', description: 'Text color as hex (#FF0000)' },
          fontWeight: { type: 'number', description: 'Font weight (100-900)' },
          smallCaps: { type: 'boolean', description: 'Small caps' },
          baselineOffset: { type: 'string', description: 'SUPERSCRIPT or SUBSCRIPT' },
        },
        required: ['presentationId', 'elementId', 'startIndex', 'endIndex'],
      },
    },
    {
      name: 'slides_update_paragraph_style',
      description: 'Update paragraph alignment, line spacing, and indentation',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Element ID' },
          paragraphIndex: { type: 'number', description: '0-based paragraph index' },
          alignment: { type: 'string', description: 'LEFT, CENTER, RIGHT, JUSTIFIED' },
          lineSpacing: {
            type: 'object',
            properties: {
              percentage: { type: 'number', description: 'Line spacing as percentage (e.g. 150 for 1.5x)' },
            },
          },
          spaceAbove: { type: 'number', description: 'Space above paragraph in points' },
          spaceBelow: { type: 'number', description: 'Space below paragraph in points' },
          indentStart: { type: 'number', description: 'Indent from start in points' },
          indentEnd: { type: 'number', description: 'Indent from end in points' },
          indentFirstLine: { type: 'number', description: 'First line indent in points' },
        },
        required: ['presentationId', 'elementId', 'paragraphIndex'],
      },
    },
    {
      name: 'slides_insert_table',
      description: 'Insert a table on a slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          rows: { type: 'number', description: 'Number of rows' },
          columns: { type: 'number', description: 'Number of columns' },
          left: { description: 'Left position' },
          top: { description: 'Top position' },
          width: { description: 'Total width' },
          height: { description: 'Total height' },
          unit: { type: 'string', description: 'Unit: inches (default), points, emu' },
          elementId: { type: 'string', description: 'Optional custom element ID' },
        },
        required: ['presentationId', 'slideId', 'rows', 'columns', 'left', 'top', 'width', 'height'],
      },
    },
    {
      name: 'slides_update_table_cell_properties',
      description: 'Update properties of a specific table cell',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          tableId: { type: 'string', description: 'Table element ID' },
          rowIndex: { type: 'number', description: '0-based row index' },
          columnIndex: { type: 'number', description: '0-based column index' },
          backgroundColor: { type: 'string', description: 'Cell background color as hex' },
          borderLeft: {
            type: 'object',
            properties: {
              color: { type: 'string' },
              weight: { type: 'number' },
              dashStyle: { type: 'string' },
            },
          },
          borderRight: {
            type: 'object',
            properties: {
              color: { type: 'string' },
              weight: { type: 'number' },
              dashStyle: { type: 'string' },
            },
          },
          borderTop: {
            type: 'object',
            properties: {
              color: { type: 'string' },
              weight: { type: 'number' },
              dashStyle: { type: 'string' },
            },
          },
          borderBottom: {
            type: 'object',
            properties: {
              color: { type: 'string' },
              weight: { type: 'number' },
              dashStyle: { type: 'string' },
            },
          },
          paddingTop: { type: 'number', description: 'Padding top in points' },
          paddingLeft: { type: 'number', description: 'Padding left in points' },
          paddingRight: { type: 'number', description: 'Padding right in points' },
          paddingBottom: { type: 'number', description: 'Padding bottom in points' },
        },
        required: ['presentationId', 'tableId', 'rowIndex', 'columnIndex'],
      },
    },

    // --- Transform & Layout ---
    {
      name: 'slides_update_element_properties',
      description: 'Update position, size, and rotation of an element',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Element ID' },
          left: { description: 'New left position' },
          top: { description: 'New top position' },
          width: { description: 'New width' },
          height: { description: 'New height' },
          unit: { type: 'string', description: 'Unit: inches (default), points, emu' },
          rotation: { type: 'number', description: 'Rotation in degrees (0-360)' },
        },
        required: ['presentationId', 'elementId'],
      },
    },
    {
      name: 'slides_align_elements',
      description: 'Align multiple elements relative to each other or to the slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          elementIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Element IDs to align',
          },
          alignment: {
            type: 'string',
            description: 'Alignment: ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT, ALIGN_TOP, ALIGN_MIDDLE, ALIGN_BOTTOM',
          },
        },
        required: ['presentationId', 'slideId', 'elementIds', 'alignment'],
      },
    },
    {
      name: 'slides_distribute_elements',
      description: 'Distribute elements evenly horizontally or vertically',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          elementIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Element IDs to distribute',
          },
          direction: {
            type: 'string',
            description: 'HORIZONTAL or VERTICAL',
          },
        },
        required: ['presentationId', 'slideId', 'elementIds', 'direction'],
      },
    },
    {
      name: 'slides_bring_to_front',
      description: 'Bring elements to the front (top of z-order)',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          elementIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Element IDs to bring forward',
          },
        },
        required: ['presentationId', 'slideId', 'elementIds'],
      },
    },
    {
      name: 'slides_send_to_back',
      description: 'Send elements to the back (bottom of z-order)',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          elementIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Element IDs to send backward',
          },
        },
        required: ['presentationId', 'slideId', 'elementIds'],
      },
    },

    // --- Styling ---
    {
      name: 'slides_update_shape_fill',
      description: 'Update the fill color of a shape (solid or gradient)',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Shape element ID' },
          fillColor: { type: 'string', description: 'Solid fill color as hex (#FF0000)' },
          gradient: {
            type: 'object',
            properties: {
              color1: { type: 'string', description: 'Start color as hex' },
              color2: { type: 'string', description: 'End color as hex' },
              type: { type: 'string', description: 'LINEAR, RADIAL' },
              angle: { type: 'number', description: 'Gradient angle in degrees' },
            },
          },
          transparency: { type: 'number', description: 'Transparency percentage (0-100)' },
        },
        required: ['presentationId', 'elementId'],
      },
    },
    {
      name: 'slides_update_shape_border',
      description: 'Update the border of a shape',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Shape element ID' },
          color: { type: 'string', description: 'Border color as hex' },
          weight: { type: 'number', description: 'Border weight in points' },
          dashStyle: { type: 'string', description: 'SOLID, DASH, DOT, DASH_DOT, LONG_DASH, etc.' },
        },
        required: ['presentationId', 'elementId'],
      },
    },
    {
      name: 'slides_update_shape_shadow',
      description: 'Add or remove a shadow on a shape',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Shape element ID' },
          visible: { type: 'boolean', description: 'Show shadow (true) or remove (false)' },
          color: { type: 'string', description: 'Shadow color as hex' },
          alpha: { type: 'number', description: 'Shadow opacity (0-1)' },
          blurRadius: { type: 'number', description: 'Blur radius in points' },
          offsetX: { type: 'number', description: 'X offset in points' },
          offsetY: { type: 'number', description: 'Y offset in points' },
        },
        required: ['presentationId', 'elementId', 'visible'],
      },
    },

    // --- Content ---
    {
      name: 'slides_create_from_template',
      description: 'Create a new presentation by copying an existing template presentation',
      inputSchema: {
        type: 'object',
        properties: {
          templatePresentationId: { type: 'string', description: 'Template presentation ID to copy' },
          newTitle: { type: 'string', description: 'Title for the new presentation' },
        },
        required: ['templatePresentationId', 'newTitle'],
      },
    },
    {
      name: 'slides_replace_image',
      description: 'Replace an existing image element with a new image',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Image element ID to replace' },
          imageUrl: { type: 'string', description: 'URL of the new image' },
        },
        required: ['presentationId', 'elementId', 'imageUrl'],
      },
    },
    {
      name: 'slides_refresh_sheets_chart',
      description: 'Refresh a linked Google Sheets chart embedded in the presentation',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          elementId: { type: 'string', description: 'Sheets chart element ID' },
          spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID' },
          chartId: { type: 'number', description: 'Chart ID from the spreadsheet' },
        },
        required: ['presentationId', 'elementId', 'spreadsheetId', 'chartId'],
      },
    },

    // --- Export ---
    {
      name: 'slides_export_presentation',
      description: 'Export a presentation as PDF or PPTX',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          format: { type: 'string', description: 'Export format: PDF or PPTX' },
          downloadPath: { type: 'string', description: 'Local file path to save to (optional)' },
        },
        required: ['presentationId', 'format'],
      },
    },

    // --- Notes ---
    {
      name: 'slides_set_slide_notes',
      description: 'Set speaker notes for a slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
          notes: { type: 'string', description: 'Speaker notes text' },
        },
        required: ['presentationId', 'slideId', 'notes'],
      },
    },
    {
      name: 'slides_get_slide_notes',
      description: 'Get speaker notes for a slide',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: { type: 'string', description: 'Presentation ID' },
          slideId: { type: 'string', description: 'Slide ID' },
        },
        required: ['presentationId', 'slideId'],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Execute tool
// ---------------------------------------------------------------------------

export async function executeTool(name: string, args: any, oauth2Client: any): Promise<any> {
  const slides = google.slides({ version: 'v1', auth: oauth2Client });

  try {
    switch (name) {
      // ---------------------------------------------------------------
      // Presentation Operations
      // ---------------------------------------------------------------
      case 'slides_create_presentation': {
        const response = await slides.presentations.create({
          requestBody: { title: args.title },
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_get_presentation': {
        const response = await slides.presentations.get({
          presentationId: args.presentationId,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_delete_presentation': {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.delete({
          fileId: args.presentationId,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ message: 'Presentation deleted successfully' }) }],
        };
      }

      case 'slides_list_presentation_slides': {
        const response = await slides.presentations.get({
          presentationId: args.presentationId,
          fields: 'slides(objectId,slideProperties,masterPageId)',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.slides || [], null, 2) }],
        };
      }

      // ---------------------------------------------------------------
      // Slide Operations
      // ---------------------------------------------------------------
      case 'slides_add_slide': {
        const request: any = { slides: [{ layoutId: args.layoutId || 'BLANK' }] };
        if (args.slideIndex !== undefined) {
          request.insertionIndex = args.slideIndex;
        }
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests: [{ createSlide: request }] } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_delete_slide': {
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{ deleteObject: { objectId: args.slideId } }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_duplicate_slide': {
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{ duplicateObject: { objectId: args.slideId } }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_move_slide': {
        // Get current slide list to figure out moves
        const pres = await slides.presentations.get({
          presentationId: args.presentationId,
          fields: 'slides(objectId)',
        });
        const slidesList = pres.data.slides || [];
        const currentIdx = slidesList.findIndex((s: any) => s.objectId === args.slideId);
        if (currentIdx === -1) {
          throw new McpError(ErrorCode.InvalidParams, `Slide ${args.slideId} not found`);
        }
        const targetIdx = args.newIndex;
        if (targetIdx < 0 || targetIdx >= slidesList.length) {
          throw new McpError(ErrorCode.InvalidParams, `Index ${targetIdx} out of range (0-${slidesList.length - 1})`);
        }
        // Use updateSlidePosition request
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              updateSlidesPosition: {
                slideObjectIds: [args.slideId],
                insertionIndex: targetIdx,
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_get_slide': {
        const response = await slides.presentations.get({
          presentationId: args.presentationId,
        });
        const slide = (response.data.slides || []).find((s: any) => s.objectId === args.slideId);
        if (!slide) {
          throw new McpError(ErrorCode.InvalidParams, `Slide ${args.slideId} not found`);
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(slide, null, 2) }],
        };
      }

      // ---------------------------------------------------------------
      // Shape & Element Operations
      // ---------------------------------------------------------------
      case 'slides_create_shape': {
        const eId = args.elementId || generateId();
        const unit = args.unit || 'inches';
        const request: any = {
          createShape: {
            shapeType: args.shapeType,
            elementProperties: {
              objectId: eId,
              size: {
                width: emuValue(toEmu(args.width, unit)),
                height: emuValue(toEmu(args.height, unit)),
              },
              transform: pos(toEmu(args.left, unit), toEmu(args.top, unit)),
            },
          },
        };

        const requests: any[] = [request];

        // Apply fill
        if (args.fill) {
          requests.push({
            updateShapeProperties: {
              objectId: eId,
              shapeProperties: {
                shapeBackgroundFill: {
                  solidFill: {
                    color: parseColor(args.fill),
                  },
                },
              },
              fields: 'shapeBackgroundFill.solidFill.color',
            },
          });
        }

        // Apply border
        if (args.border) {
          const borderProps: any = {
            outline: {
              outlineFill: {
                solidFill: { color: parseColor(args.border.color || '#000000') },
              },
              weight: { magnitude: args.border.weight || 1, unit: 'PT' },
            },
          };
          if (args.border.dashStyle) {
            borderProps.outline.dashStyle = args.border.dashStyle;
          }
          requests.push({
            updateShapeProperties: {
              objectId: eId,
              shapeProperties: borderProps,
              fields: 'outline',
            },
          });
        }

        // Insert text
        if (args.text) {
          requests.push({
            insertText: {
              objectId: eId,
              insertionIndex: 0,
              text: args.text,
            },
          });
          if (args.fontSize) {
            requests.push({
              updateTextStyle: {
                objectId: eId,
                textStyle: {
                  fontSize: points(args.fontSize),
                },
                fields: 'fontSize',
                insertTextLocation: {
                  startIndex: 0,
                  endIndex: args.text.length,
                },
              },
            });
          }
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ elementId: eId, ...response.data }, null, 2) }],
        };
      }

      case 'slides_create_text_box': {
        const eId = args.elementId || generateId();
        const unit = args.unit || 'inches';
        const requests: any[] = [{
          createTextBox: {
            elementProperties: {
              objectId: eId,
              size: {
                width: emuValue(toEmu(args.width, unit)),
                height: emuValue(toEmu(args.height, unit)),
              },
              transform: pos(toEmu(args.left, unit), toEmu(args.top, unit)),
            },
          },
        }];

        if (args.text) {
          requests.push({
            insertText: {
              objectId: eId,
              insertionIndex: 0,
              text: args.text,
            },
          });
          const styleFields: string[] = [];
          const style: any = {};
          if (args.fontSize) {
            style.fontSize = points(args.fontSize);
            styleFields.push('fontSize');
          }
          if (args.fontBold !== undefined) {
            style.bold = args.fontBold;
            styleFields.push('bold');
          }
          if (styleFields.length > 0) {
            requests.push({
              updateTextStyle: {
                objectId: eId,
                textStyle: style,
                fields: styleFields.join(','),
                insertTextLocation: {
                  startIndex: 0,
                  endIndex: args.text.length,
                },
              },
            });
          }
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ elementId: eId, ...response.data }, null, 2) }],
        };
      }

      case 'slides_create_image': {
        const eId = args.elementId || generateId();
        const unit = args.unit || 'inches';
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              createImage: {
                url: args.imageUrl,
                elementProperties: {
                  objectId: eId,
                  size: {
                    width: emuValue(toEmu(args.width, unit)),
                    height: emuValue(toEmu(args.height, unit)),
                  },
                  transform: pos(toEmu(args.left, unit), toEmu(args.top, unit)),
                },
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ elementId: eId, ...response.data }, null, 2) }],
        };
      }

      case 'slides_create_line': {
        const eId = args.elementId || generateId();
        const unit = args.unit || 'inches';

        const lineCategory = args.lineCategory || 'BOLD';
        const lineStyle = args.lineStyle || 'SOLID';
        const lineWeight = args.lineWeight || 1;

        // Determine connector type
        const lineType = args.lineType || 'STRAIGHT';

        const startPt = { x: toEmu(args.startX, unit), y: toEmu(args.startY, unit) };
        const endPt = { x: toEmu(args.endX, unit), y: toEmu(args.endY, unit) };

        // Compute bounding box and transform for STRAIGHT lines
        const left = Math.min(startPt.x, endPt.x);
        const top = Math.min(startPt.y, endPt.y);
        const w = Math.abs(endPt.x - startPt.x) || 1;
        const h = Math.abs(endPt.y - startPt.y) || 1;

        const requests: any[] = [{
          createLine: {
            lineCategory: lineCategory,
            elementProperties: {
              objectId: eId,
              size: {
                width: emuValue(w),
                height: emuValue(h),
              },
              transform: pos(left, top),
            },
          },
        }];

        // Update line properties
        const lineProps: any = {
          lineFill: {},
          lineWeight: { magnitude: lineWeight, unit: 'PT' },
          dashStyle: lineStyle,
        };
        if (args.color) {
          lineProps.lineFill = {
            solidFill: { color: parseColor(args.color) },
          };
        }
        if (args.hasArrowEnd) {
          lineProps.endArrow = { type: args.arrowEndType || 'STEALTH_ARROW' };
        }
        if (args.hasArrowStart) {
          lineProps.startArrow = { type: args.arrowStartType || 'STEALTH_ARROW' };
        }

        requests.push({
          updateLineProperties: {
            objectId: eId,
            lineProperties: lineProps,
            fields: '*',
          },
        });

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ elementId: eId, ...response.data }, null, 2) }],
        };
      }

      case 'slides_delete_element': {
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{ deleteObject: { objectId: args.elementId } }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_group_elements': {
        const groupId = args.groupId || generateId();
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              groupObjects: {
                childrenObjectIds: args.elementIds,
                groupObjectId: groupId,
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ groupId, ...response.data }, null, 2) }],
        };
      }

      case 'slides_ungroup_elements': {
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              ungroupObjects: {
                objectIds: [args.groupId],
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ---------------------------------------------------------------
      // Text & Formatting
      // ---------------------------------------------------------------
      case 'slides_insert_text': {
        const requests: any[] = [];
        if (args.startIndex !== undefined && args.endIndex !== undefined) {
          // Replace range
          requests.push({
            deleteText: {
              objectId: args.elementId,
              textLocation: {
                insertTextLocation: {
                  startIndex: args.startIndex,
                  endIndex: args.endIndex,
                },
              },
            },
          });
          requests.push({
            insertText: {
              objectId: args.elementId,
              insertionIndex: args.startIndex,
              text: args.text,
            },
          });
        } else {
          // Delete all existing text and insert new
          // First get current text to know the range
          const pres = await slides.presentations.get({
            presentationId: args.presentationId,
            fields: 'slides(objectId,pageElements(objectId,shape,text))',
          });
          let currentText = '';
          for (const slide of pres.data.slides || []) {
            const el = (slide.pageElements || []).find((pe: any) => pe.objectId === args.elementId);
            if (el?.shape?.text?.textElements) {
              currentText = (el.shape.text.textElements || []).map((te: any) => te.textRun?.content || '').join('');
              break;
            }
          }
          if (currentText.length > 0) {
            requests.push({
              deleteText: {
                objectId: args.elementId,
                textLocation: {
                  insertTextLocation: {
                    startIndex: 0,
                    endIndex: currentText.length,
                  },
                },
              },
            });
          }
          requests.push({
            insertText: {
              objectId: args.elementId,
              insertionIndex: 0,
              text: args.text,
            },
          });
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_update_text_style': {
        const style: any = {};
        const fields: string[] = [];

        if (args.bold !== undefined) { style.bold = args.bold; fields.push('bold'); }
        if (args.italic !== undefined) { style.italic = args.italic; fields.push('italic'); }
        if (args.underline !== undefined) { style.underline = args.underline; fields.push('underline'); }
        if (args.strikethrough !== undefined) { style.strikethrough = args.strikethrough; fields.push('strikethrough'); }
        if (args.fontFamily) { style.fontFamily = args.fontFamily; fields.push('fontFamily'); }
        if (args.fontSize) { style.fontSize = points(args.fontSize); fields.push('fontSize'); }
        if (args.foregroundColor) { style.foregroundColor = { opaqueColor: parseColor(args.foregroundColor) }; fields.push('foregroundColor'); }
        if (args.fontWeight) { style.weightedFontFamily = { fontFamily: args.fontFamily || 'Arial', weight: args.fontWeight }; fields.push('weightedFontFamily'); }
        if (args.smallCaps !== undefined) { style.smallCaps = args.smallCaps; fields.push('smallCaps'); }
        if (args.baselineOffset) { style.baselineOffset = args.baselineOffset; fields.push('baselineOffset'); }

        if (fields.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'At least one style property must be specified');
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              updateTextStyle: {
                objectId: args.elementId,
                textStyle: style,
                fields: fields.join(','),
                insertTextLocation: {
                  startIndex: args.startIndex,
                  endIndex: args.endIndex,
                },
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_update_paragraph_style': {
        const style: any = {};
        const fields: string[] = [];

        if (args.alignment) { style.alignment = args.alignment; fields.push('alignment'); }
        if (args.lineSpacing) {
          style.lineSpacing = {
            percentage: args.lineSpacing.percentage || 100,
          };
          fields.push('lineSpacing');
        }
        if (args.spaceAbove !== undefined) {
          style.spaceAbove = points(args.spaceAbove);
          fields.push('spaceAbove');
        }
        if (args.spaceBelow !== undefined) {
          style.spaceBelow = points(args.spaceBelow);
          fields.push('spaceBelow');
        }
        if (args.indentStart !== undefined) {
          style.indentStart = points(args.indentStart);
          fields.push('indentStart');
        }
        if (args.indentEnd !== undefined) {
          style.indentEnd = points(args.indentEnd);
          fields.push('indentEnd');
        }
        if (args.indentFirstLine !== undefined) {
          style.indentFirstLine = points(args.indentFirstLine);
          fields.push('indentFirstLine');
        }

        if (fields.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'At least one paragraph style property must be specified');
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              updateParagraphStyle: {
                objectId: args.elementId,
                paragraphStyle: style,
                fields: fields.join(','),
                textLocation: {
                  insertTextLocation: {
                    segmentId: '',
                    startIndex: -1,
                    endIndex: -1,
                  },
                },
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_insert_table': {
        const eId = args.elementId || generateId();
        const unit = args.unit || 'inches';
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              createTable: {
                rows: args.rows,
                columns: args.columns,
                elementProperties: {
                  objectId: eId,
                  size: {
                    width: emuValue(toEmu(args.width, unit)),
                    height: emuValue(toEmu(args.height, unit)),
                  },
                  transform: pos(toEmu(args.left, unit), toEmu(args.top, unit)),
                },
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ tableId: eId, ...response.data }, null, 2) }],
        };
      }

      case 'slides_update_table_cell_properties': {
        const cellProps: any = {};

        if (args.backgroundColor) {
          cellProps.backgroundColor = {
            solidFill: { color: parseColor(args.backgroundColor) },
          };
        }

        const makeBorder = (b: any) => {
          if (!b) return undefined;
          const obj: any = {};
          if (b.color) obj.outlineFill = { solidFill: { color: parseColor(b.color) } };
          if (b.weight) obj.weight = { magnitude: b.weight, unit: 'PT' };
          if (b.dashStyle) obj.dashStyle = b.dashStyle;
          return obj;
        };

        if (args.borderLeft) cellProps.borderLeft = makeBorder(args.borderLeft);
        if (args.borderRight) cellProps.borderRight = makeBorder(args.borderRight);
        if (args.borderTop) cellProps.borderTop = makeBorder(args.borderTop);
        if (args.borderBottom) cellProps.borderBottom = makeBorder(args.borderBottom);

        if (args.paddingTop !== undefined) cellProps.paddingTop = points(args.paddingTop);
        if (args.paddingLeft !== undefined) cellProps.paddingLeft = points(args.paddingLeft);
        if (args.paddingRight !== undefined) cellProps.paddingRight = points(args.paddingRight);
        if (args.paddingBottom !== undefined) cellProps.paddingBottom = points(args.paddingBottom);

        const fieldsList: string[] = [];
        if (args.backgroundColor) fieldsList.push('backgroundColor');
        if (args.borderLeft) fieldsList.push('borderLeft');
        if (args.borderRight) fieldsList.push('borderRight');
        if (args.borderTop) fieldsList.push('borderTop');
        if (args.borderBottom) fieldsList.push('borderBottom');
        if (args.paddingTop !== undefined) fieldsList.push('paddingTop');
        if (args.paddingLeft !== undefined) fieldsList.push('paddingLeft');
        if (args.paddingRight !== undefined) fieldsList.push('paddingRight');
        if (args.paddingBottom !== undefined) fieldsList.push('paddingBottom');

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              updateTableProperties: {
                tableProperties: {
                  tableRange: {
                    location: {
                      slideIndex: 0,
                    },
                    rowSpan: 1,
                    columnSpan: 1,
                  },
                },
                fields: fieldsList.join(','),
                objectId: args.tableId,
                rowIndex: args.rowIndex,
                columnIndex: args.columnIndex,
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ---------------------------------------------------------------
      // Transform & Layout
      // ---------------------------------------------------------------
      case 'slides_update_element_properties': {
        const props: any = {};
        const fields: string[] = [];
        const unit = args.unit || 'inches';

        if (args.left !== undefined && args.top !== undefined) {
          props.transform = pos(toEmu(args.left, unit), toEmu(args.top, unit));
          fields.push('transform');
        }

        if (args.width !== undefined && args.height !== undefined) {
          props.size = {
            width: emuValue(toEmu(args.width, unit)),
            height: emuValue(toEmu(args.height, unit)),
          };
          fields.push('size');
        }

        if (args.rotation !== undefined) {
          if (!props.transform) {
            props.transform = pos(0, 0);
          }
          props.transform.angle = args.rotation;
          if (!fields.includes('transform')) fields.push('transform');
        }

        if (fields.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'At least one property must be specified');
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              updatePageElementTransform: {
                objectId: args.elementId,
                transform: props.transform || pos(0, 0),
                applyMode: 'ABSOLUTE',
              },
            }],
          } as any,
        });

        // Also update size if specified
        if (props.size) {
          await slides.presentations.batchUpdate({
            presentationId: args.presentationId,
            requestBody: {
              requests: [{
                updateObjectProperties: {
                  objectId: args.elementId,
                  objectProperties: props.size,
                  fields: 'size',
                },
              }],
            } as any,
          });
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_align_elements': {
        const requests: any[] = args.elementIds.map((elementId: string) => ({
          updatePageElementTransform: {
            objectId: elementId,
            transform: pos(0, 0),
            applyMode: args.alignment,
          },
        }));

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_distribute_elements': {
        const distributionMode = args.direction === 'VERTICAL' ? 'DISTRIBUTE_VERTICALLY' : 'DISTRIBUTE_HORIZONTALLY';
        const requests: any[] = args.elementIds.map((elementId: string) => ({
          updatePageElementTransform: {
            objectId: elementId,
            transform: pos(0, 0),
            applyMode: distributionMode,
          },
        }));

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_bring_to_front': {
        const requests: any[] = args.elementIds.map((elementId: string) => ({
          updateObjectProperties: {
            objectId: elementId,
            objectProperties: {},
            fields: 'tab',
          },
        }));

        // Actually use the correct API for z-order
        // Google Slides API doesn't have a direct bring_to_front, we use updateObjectProperties
        // But the correct approach is to manipulate via requests
        // The best approach: update object tab for each element
        const batchRequests: any[] = [];
        for (const elementId of args.elementIds) {
          batchRequests.push({
            updateObjectProperties: {
              objectId: elementId,
              objectProperties: {},
              fields: 'tab',
            },
          });
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests: batchRequests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_send_to_back': {
        const batchRequests: any[] = [];
        for (const elementId of args.elementIds) {
          batchRequests.push({
            updateObjectProperties: {
              objectId: elementId,
              objectProperties: {},
              fields: 'tab',
            },
          });
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests: batchRequests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ---------------------------------------------------------------
      // Styling
      // ---------------------------------------------------------------
      case 'slides_update_shape_fill': {
        const requests: any[] = [];

        if (args.gradient) {
          const gradType = args.gradient.type || 'LINEAR';
          requests.push({
            updateShapeProperties: {
              objectId: args.elementId,
              shapeProperties: {
                shapeBackgroundFill: {
                  gradientFill: {
                    type: gradType,
                    gradientStops: [
                      { color: { opaqueColor: parseColor(args.gradient.color1 || '#FFFFFF') }, alpha: 1 },
                      { color: { opaqueColor: parseColor(args.gradient.color2 || '#000000') }, alpha: 1 },
                    ],
                  },
                },
              },
              fields: 'shapeBackgroundFill.gradientFill',
            },
          });
          if (args.gradient.angle !== undefined && gradType === 'LINEAR') {
            requests[requests.length - 1].shapeProperties.shapeBackgroundFill.gradientFill.angle = args.gradient.angle;
          }
        } else if (args.fillColor) {
          requests.push({
            updateShapeProperties: {
              objectId: args.elementId,
              shapeProperties: {
                shapeBackgroundFill: {
                  solidFill: {
                    color: parseColor(args.fillColor),
                    alpha: args.transparency !== undefined ? 1 - (args.transparency / 100) : 1,
                  },
                },
              },
              fields: 'shapeBackgroundFill.solidFill',
            },
          });
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Either fillColor or gradient must be specified');
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_update_shape_border': {
        const outlineProps: any = {};
        if (args.color) {
          outlineProps.outlineFill = {
            solidFill: { color: parseColor(args.color) },
          };
        }
        if (args.weight !== undefined) {
          outlineProps.weight = { magnitude: args.weight, unit: 'PT' };
        }
        if (args.dashStyle) {
          outlineProps.dashStyle = args.dashStyle;
        }

        const fields: string[] = [];
        if (args.color) fields.push('outlineFill');
        if (args.weight !== undefined) fields.push('weight');
        if (args.dashStyle) fields.push('dashStyle');

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              updateShapeProperties: {
                objectId: args.elementId,
                shapeProperties: {
                  outline: outlineProps,
                },
                fields: `outline.${fields.join(',outline.')}`,
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_update_shape_shadow': {
        const requests: any[] = [];

        if (!args.visible) {
          // Remove shadow
          requests.push({
            updateShapeProperties: {
              objectId: args.elementId,
              shapeProperties: {
                shadow: {
                  visible: false,
                },
              },
              fields: 'shadow',
            },
          });
        } else {
          const shadowProps: any = {
            visible: true,
            type: 'OUTER',
          };
          if (args.color) {
            shadowProps.color = { opaqueColor: parseColor(args.color) };
          }
          if (args.alpha !== undefined) {
            shadowProps.alpha = args.alpha;
          }
          if (args.blurRadius !== undefined) {
            shadowProps.blurRadius = { magnitude: args.blurRadius * EMU_PER_POINT, unit: 'EMU' };
          }
          if (args.offsetX !== undefined) {
            shadowProps.offsetX = { magnitude: args.offsetX * EMU_PER_POINT, unit: 'EMU' };
          }
          if (args.offsetY !== undefined) {
            shadowProps.offsetY = { magnitude: args.offsetY * EMU_PER_POINT, unit: 'EMU' };
          }

          requests.push({
            updateShapeProperties: {
              objectId: args.elementId,
              shapeProperties: {
                shadow: shadowProps,
              },
              fields: 'shadow',
            },
          });
        }

        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ---------------------------------------------------------------
      // Content
      // ---------------------------------------------------------------
      case 'slides_create_from_template': {
        // Copy the template presentation via Drive API
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const copyRes = await drive.files.copy({
          fileId: args.templatePresentationId,
          requestBody: {
            name: args.newTitle,
          },
        });
        // Rename the copied presentation
        const newId = copyRes.data.id!;
        await drive.files.update({
          fileId: newId,
          requestBody: {
            name: args.newTitle,
          },
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: 'Presentation created from template',
              presentationId: newId,
              title: args.newTitle,
              webViewLink: `https://docs.google.com/presentation/d/${newId}/edit`,
            }, null, 2),
          }],
        };
      }

      case 'slides_replace_image': {
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              replaceImage: {
                imageObjectId: args.elementId,
                url: args.imageUrl,
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_refresh_sheets_chart': {
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              refreshSheetsChart: {
                objectId: args.elementId,
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ---------------------------------------------------------------
      // Export
      // ---------------------------------------------------------------
      case 'slides_export_presentation': {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        let mimeType: string;
        let fileExtension: string;

        if (args.format.toUpperCase() === 'PDF') {
          mimeType = 'application/pdf';
          fileExtension = 'pdf';
        } else if (args.format.toUpperCase() === 'PPTX') {
          mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          fileExtension = 'pptx';
        } else {
          throw new McpError(ErrorCode.InvalidParams, `Unsupported format: ${args.format}. Use PDF or PPTX.`);
        }

        const response = await drive.files.export(
          {
            fileId: args.presentationId,
            mimeType,
          },
          { responseType: 'arraybuffer' }
        );

        if (args.downloadPath) {
          const fs = await import('fs');
          fs.writeFileSync(args.downloadPath, Buffer.from(response.data as ArrayBuffer));
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                message: `Presentation exported successfully`,
                format: args.format,
                path: args.downloadPath,
                size: (response.data as ArrayBuffer).byteLength,
              }, null, 2),
            }],
          };
        }

        // Return as base64 if no path specified
        const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: `Presentation exported as ${args.format}`,
              format: args.format,
              data: base64,
              mimeType,
            }, null, 2),
          }],
        };
      }

      // ---------------------------------------------------------------
      // Notes
      // ---------------------------------------------------------------
      case 'slides_set_slide_notes': {
        const response = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{
              insertText: {
                objectId: `${args.slideId}_notes`,
                insertionIndex: 0,
                text: args.notes,
              },
            }],
          } as any,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'slides_get_slide_notes': {
        const pres = await slides.presentations.get({
          presentationId: args.presentationId,
          fields: 'slides(objectId,slideProperties.notesProperties)',
        });
        const slide = (pres.data.slides || []).find((s: any) => s.objectId === args.slideId);
        if (!slide) {
          throw new McpError(ErrorCode.InvalidParams, `Slide ${args.slideId} not found`);
        }

        const notesProps = (slide as any).slideProperties?.notesProperties;
        let notesText = '';
        if (notesProps?.speakerNotesObjectId) {
          // Fetch the notes content
          const detailPres = await slides.presentations.get({
            presentationId: args.presentationId,
            fields: 'slides(objectId,pageElements(objectId,shape(text)))',
          });
          for (const s of detailPres.data.slides || []) {
            if (s.objectId === args.slideId) {
              for (const pe of s.pageElements || []) {
                if (pe.objectId === notesProps.speakerNotesObjectId) {
                  notesText = (pe.shape?.text?.textElements || []).map((te: any) => te.textRun?.content || '').join('');
                  break;
                }
              }
              break;
            }
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              slideId: args.slideId,
              speakerNotesObjectId: notesProps?.speakerNotesObjectId || null,
              notes: notesText,
            }, null, 2),
          }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      error?.message || 'Unknown error occurred'
    );
  }
}
