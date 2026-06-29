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

function sanitizeOptions(options: any[]): { value: string }[] {
  return options
    .filter((o): o is string => typeof o === 'string')
    .map((o: string) => ({ value: o.replace(/[\r\n]+/g, ' ').trim() }))
    .filter((o) => o.value.length > 0);
}

function getInsertIndex(formItems: any[], section?: number): number {
  if (!section || section < 1) return formItems.length;
  let sectionCount = 1;
  for (let i = 0; i < formItems.length; i++) {
    if (formItems[i].pageBreakItem) {
      if (section === sectionCount) return i;
      sectionCount++;
    }
  }
  return formItems.length;
}

function findItemIndex(items: any[], itemId: string): number {
  return items.findIndex((item: any) => item.itemId === itemId);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const tools: ToolDefinition[] = [
  // ── 1. create_form ──────────────────────────────────────────────────
  {
    name: 'create_form',
    description: 'Create a new Google Form',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Form title' },
        description: { type: 'string', description: 'Form description (optional)' },
      },
      required: ['title'],
    },
  },
  // ── 2. copy_form ────────────────────────────────────────────────────
  {
    name: 'copy_form',
    description: 'Create a copy of an existing form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID to copy' },
        newTitle: { type: 'string', description: 'New form title (optional)' },
      },
      required: ['formId'],
    },
  },
  // ── 3. delete_form ──────────────────────────────────────────────────
  {
    name: 'delete_form',
    description: 'Delete a Google Form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID to delete' },
      },
      required: ['formId'],
    },
  },
  // ── 4. get_form ─────────────────────────────────────────────────────
  {
    name: 'get_form',
    description: 'Get complete form details (items, settings, info)',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
      },
      required: ['formId'],
    },
  },
  // ── 5. get_form_metadata ────────────────────────────────────────────
  {
    name: 'get_form_metadata',
    description: 'Get response count, form ID, revision ID, and settings',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
      },
      required: ['formId'],
    },
  },
  // ── 6. update_form_settings ─────────────────────────────────────────
  {
    name: 'update_form_settings',
    description: 'Update title, description, quiz mode, collect emails, and quiz settings',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        title: { type: 'string', description: 'New form title (optional)' },
        description: { type: 'string', description: 'New form description (optional)' },
        isQuiz: { type: 'boolean', description: 'Enable/disable quiz mode (optional)' },
        collectEmails: { type: 'boolean', description: 'Collect email addresses (optional)' },
        quizSettings: {
          type: 'object',
          properties: { isQuiz: { type: 'boolean' } },
          description: 'Quiz configuration (optional)',
        },
      },
      required: ['formId'],
    },
  },
  // ── 7. set_publish_settings ─────────────────────────────────────────
  {
    name: 'set_publish_settings',
    description: 'Publish/unpublish form, accept/reject responses',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        isPublished: { type: 'boolean', description: 'Whether the form is published (default true)' },
        isAcceptingResponses: { type: 'boolean', description: 'Whether the form accepts responses (defaults to isPublished)' },
      },
      required: ['formId'],
    },
  },
  // ── 8. set_form_description ─────────────────────────────────────────
  {
    name: 'set_form_description',
    description: 'Set or update the form description',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        description: { type: 'string', description: 'New form description' },
      },
      required: ['formId', 'description'],
    },
  },
  // ── 9. list_forms ───────────────────────────────────────────────────
  {
    name: 'list_forms',
    description: 'List forms from Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { type: 'integer', description: 'Max results (default 20, max 100)' },
        query: { type: 'string', description: 'Search query to filter by title (optional)' },
      },
    },
  },
  // ── 10. add_text_question ───────────────────────────────────────────
  {
    name: 'add_text_question',
    description: 'Add a short answer text question',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle'],
    },
  },
  // ── 11. add_paragraph_question ──────────────────────────────────────
  {
    name: 'add_paragraph_question',
    description: 'Add a long answer paragraph question',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle'],
    },
  },
  // ── 12. add_multiple_choice_question ────────────────────────────────
  {
    name: 'add_multiple_choice_question',
    description: 'Add a multiple choice question with options',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        options: { type: 'array', items: { type: 'string' }, description: 'Array of choices' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle', 'options'],
    },
  },
  // ── 13. add_checkbox_question ───────────────────────────────────────
  {
    name: 'add_checkbox_question',
    description: 'Add a checkbox (multi-select) question with options and shuffle',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        options: { type: 'array', items: { type: 'string' }, description: 'Array of choices' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        shuffle: { type: 'boolean', description: 'Shuffle option order (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle', 'options'],
    },
  },
  // ── 14. add_dropdown_question ───────────────────────────────────────
  {
    name: 'add_dropdown_question',
    description: 'Add a dropdown question with options',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        options: { type: 'array', items: { type: 'string' }, description: 'Array of choices' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle', 'options'],
    },
  },
  // ── 15. add_linear_scale_question ───────────────────────────────────
  {
    name: 'add_linear_scale_question',
    description: 'Add a linear scale question (1-5, 1-10, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        low: { type: 'number', description: 'Low value (0-10)' },
        high: { type: 'number', description: 'High value (0-10)' },
        lowLabel: { type: 'string', description: 'Label for low value (optional)' },
        highLabel: { type: 'string', description: 'Label for high value (optional)' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle', 'low', 'high'],
    },
  },
  // ── 16. add_date_question ───────────────────────────────────────────
  {
    name: 'add_date_question',
    description: 'Add a date question with optional time',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        includeTime: { type: 'boolean', description: 'Include time (default false)' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle'],
    },
  },
  // ── 17. add_time_question ───────────────────────────────────────────
  {
    name: 'add_time_question',
    description: 'Add a time question',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        duration: { type: 'boolean', description: 'Whether this is a duration (default false)' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle'],
    },
  },
  // ── 18. add_rating_question ─────────────────────────────────────────
  {
    name: 'add_rating_question',
    description: 'Add a rating question (star, heart, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        ratingScaleLevel: { type: 'integer', description: 'Scale level 3-10 (default 5)' },
        iconType: { type: 'string', description: 'STAR, HEART, or THUMBS_UP (default STAR)' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle'],
    },
  },
  // ── 19. add_file_upload_question ────────────────────────────────────
  {
    name: 'add_file_upload_question',
    description: 'Add a file upload question with size limits, file type limits',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle'],
    },
  },
  // ── 20. add_choice_grid ─────────────────────────────────────────────
  {
    name: 'add_choice_grid',
    description: 'Add a grid question (rows x columns)',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        questionTitle: { type: 'string', description: 'Question title' },
        rows: { type: 'array', items: { type: 'string' }, description: 'Row labels' },
        columns: { type: 'array', items: { type: 'string' }, description: 'Column labels' },
        type: { type: 'string', description: 'RADIO or CHECKBOX (default RADIO)' },
        required: { type: 'boolean', description: 'Whether required (default false)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'questionTitle', 'rows', 'columns'],
    },
  },
  // ── 21. add_page_break ──────────────────────────────────────────────
  {
    name: 'add_page_break',
    description: 'Add a page break',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        title: { type: 'string', description: 'Page break title (optional)' },
        description: { type: 'string', description: 'Page break description (optional)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId'],
    },
  },
  // ── 22. add_section_header ──────────────────────────────────────────
  {
    name: 'add_section_header',
    description: 'Add a section header with description',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        title: { type: 'string', description: 'Section header title (optional)' },
        description: { type: 'string', description: 'Section header description (optional)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId'],
    },
  },
  // ── 23. add_title_description ───────────────────────────────────────
  {
    name: 'add_title_description',
    description: 'Add a title/description block',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        title: { type: 'string', description: 'Title text' },
        description: { type: 'string', description: 'Description text (optional)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'title'],
    },
  },
  // ── 24. add_image ───────────────────────────────────────────────────
  {
    name: 'add_image',
    description: 'Add an image (URL or Drive file)',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        imageUrl: { type: 'string', description: 'Image URL' },
        title: { type: 'string', description: 'Image title (optional)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'imageUrl'],
    },
  },
  // ── 25. add_video ───────────────────────────────────────────────────
  {
    name: 'add_video',
    description: 'Add a YouTube video',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        videoUrl: { type: 'string', description: 'YouTube URL' },
        title: { type: 'string', description: 'Video title (optional)' },
        caption: { type: 'string', description: 'Video caption (optional, local only)' },
        section: { type: 'integer', description: 'Section number (1-indexed, optional)' },
      },
      required: ['formId', 'videoUrl'],
    },
  },
  // ── 26. update_question ─────────────────────────────────────────────
  {
    name: 'update_question',
    description: 'Update question title, required status, or options',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID of the question to update' },
        newTitle: { type: 'string', description: 'New question title (optional)' },
        required: { type: 'boolean', description: 'New required status (optional)' },
        choices: { type: 'array', items: { type: 'string' }, description: 'New choices for choice questions (optional)' },
      },
      required: ['formId', 'itemId'],
    },
  },
  // ── 27. delete_question ─────────────────────────────────────────────
  {
    name: 'delete_question',
    description: 'Delete a question/item from the form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID to delete' },
      },
      required: ['formId', 'itemId'],
    },
  },
  // ── 28. reorder_items ───────────────────────────────────────────────
  {
    name: 'reorder_items',
    description: 'Reorder form items by moving an item to a new position',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID to move' },
        newIndex: { type: 'integer', description: 'New position index (0-based)' },
      },
      required: ['formId', 'itemId', 'newIndex'],
    },
  },
  // ── 29. set_question_grading ────────────────────────────────────────
  {
    name: 'set_question_grading',
    description: 'Set point value and correct answer for quiz questions',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID of the question' },
        points: { type: 'integer', description: 'Point value (non-negative)' },
        correctAnswers: {
          type: 'array',
          items: {
            type: 'object',
            properties: { value: { type: 'string', description: 'Correct answer value' } },
          },
          description: 'Array of correct answers',
        },
        feedbackCorrect: { type: 'string', description: 'Feedback for correct answer (optional)' },
        feedbackIncorrect: { type: 'string', description: 'Feedback for incorrect answer (optional)' },
      },
      required: ['formId', 'itemId', 'points'],
    },
  },
  // ── 30. add_question_validation ─────────────────────────────────────
  {
    name: 'add_question_validation',
    description: 'Add validation to a text question (regular expression, number, text length, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID of the question' },
        validationType: {
          type: 'string',
          description: 'Type of validation: regex, number, or text',
          enum: ['regex', 'number', 'text'],
        },
        regex: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Regex pattern' },
            hasErrorText: { type: 'boolean', description: 'Show custom error text (default false)' },
          },
          description: 'Regex validation settings',
        },
        number: {
          type: 'object',
          properties: {
            numberType: {
              type: 'string',
              description: 'NUMBER, GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUAL, LESS_THAN_OR_EQUAL, EQUAL, BETWEEN, NOT_NUMBER',
              enum: ['NUMBER', 'GREATER_THAN', 'LESS_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN_OR_EQUAL', 'EQUAL', 'BETWEEN', 'NOT_NUMBER'],
            },
            value: { type: 'number', description: 'Comparison value' },
            maxValue: { type: 'number', description: 'Max value for BETWEEN type' },
          },
          description: 'Number validation settings',
        },
        text: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'LENGTH, CONTAINS, DOES_NOT_CONTAIN, EMAIL_ADDRESS, URL',
              enum: ['LENGTH', 'CONTAINS', 'DOES_NOT_CONTAIN', 'EMAIL_ADDRESS', 'URL'],
            },
            value: { type: 'string', description: 'Comparison value' },
          },
          description: 'Text validation settings',
        },
        customErrorText: { type: 'string', description: 'Custom error text shown on validation failure (optional)' },
      },
      required: ['formId', 'itemId', 'validationType'],
    },
  },
  // ── 31. add_question_option ─────────────────────────────────────────
  {
    name: 'add_question_option',
    description: 'Add an option to a choice question',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID of the question' },
        optionText: { type: 'string', description: 'Text for the new option' },
      },
      required: ['formId', 'itemId', 'optionText'],
    },
  },
  // ── 32. remove_question_option ──────────────────────────────────────
  {
    name: 'remove_question_option',
    description: 'Remove an option from a choice question',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID of the question' },
        optionIndex: { type: 'integer', description: 'Index of the option to remove (0-based)' },
      },
      required: ['formId', 'itemId', 'optionIndex'],
    },
  },
  // ── 33. shuffle_question_options ────────────────────────────────────
  {
    name: 'shuffle_question_options',
    description: 'Set option shuffling on/off for a question',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID of the question' },
        shuffle: { type: 'boolean', description: 'Enable/disable option shuffling' },
      },
      required: ['formId', 'itemId', 'shuffle'],
    },
  },
  // ── 34. set_question_required ───────────────────────────────────────
  {
    name: 'set_question_required',
    description: 'Set whether question is required/optional',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID of the question' },
        required: { type: 'boolean', description: 'Required status' },
      },
      required: ['formId', 'itemId', 'required'],
    },
  },
  // ── 35. set_question_description ────────────────────────────────────
  {
    name: 'set_question_description',
    description: 'Set description/helper text for a question',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID of the question' },
        description: { type: 'string', description: 'Description/helper text' },
      },
      required: ['formId', 'itemId', 'description'],
    },
  },
  // ── 36. get_form_responses ──────────────────────────────────────────
  {
    name: 'get_form_responses',
    description: 'Get all responses to a form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
      },
      required: ['formId'],
    },
  },
  // ── 37. get_responses_sheet ─────────────────────────────────────────
  {
    name: 'get_responses_sheet',
    description: 'Get linked spreadsheet URL for responses',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
      },
      required: ['formId'],
    },
  },
  // ── 38. get_form_responses_analytics ────────────────────────────────
  {
    name: 'get_form_responses_analytics',
    description: 'Get summary analytics of responses with structured data',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
      },
      required: ['formId'],
    },
  },
  // ── 39. delete_all_responses ────────────────────────────────────────
  {
    name: 'delete_all_responses',
    description: 'Delete all form responses',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
      },
      required: ['formId'],
    },
  },
  // ── 40. delete_response ─────────────────────────────────────────────
  {
    name: 'delete_response',
    description: 'Delete a specific response by response ID',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        responseId: { type: 'string', description: 'Response ID to delete' },
      },
      required: ['formId', 'responseId'],
    },
  },
  // ── 41. share_form ──────────────────────────────────────────────────
  {
    name: 'share_form',
    description: 'Share form with email/user via Google Drive sharing',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        emailAddresses: { type: 'array', items: { type: 'string' }, description: 'Email addresses to share with' },
        role: { type: 'string', description: 'Permission role: reader, writer, or commenter (default reader)', enum: ['reader', 'writer', 'commenter'] },
        sendEmail: { type: 'boolean', description: 'Send notification email (default true)' },
        message: { type: 'string', description: 'Custom message for notification email (optional)' },
      },
      required: ['formId', 'emailAddresses'],
    },
  },
  // ── 42. get_form_url ────────────────────────────────────────────────
  {
    name: 'get_form_url',
    description: 'Get the form URL with different access levels',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        urlType: {
          type: 'string',
          description: 'URL type: viewForm, editForm, or createResponse (default viewForm)',
          enum: ['viewForm', 'editForm', 'createResponse'],
        },
      },
      required: ['formId'],
    },
  },
  // ── 43. watch_form_responses ────────────────────────────────────────
  {
    name: 'watch_form_responses',
    description: 'Set up a watch/poll for new form responses (returns last known count)',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
      },
      required: ['formId'],
    },
  },
  // ── 44. move_item ───────────────────────────────────────────────────
  {
    name: 'move_item',
    description: 'Move a question to a specific index position in the form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Form ID' },
        itemId: { type: 'string', description: 'Item ID to move' },
        newIndex: { type: 'integer', description: 'Target index position (0-based)' },
      },
      required: ['formId', 'itemId', 'newIndex'],
    },
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getTools(): ToolDefinition[] {
  return tools;
}

export async function executeTool(name: string, args: any, oauth2Client: any): Promise<any> {
  const forms = google.forms({ version: 'v1', auth: oauth2Client });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  switch (name) {
    // ── 1. create_form ────────────────────────────────────────────────
    case 'create_form': {
      if (!args.title) throw new McpError(ErrorCode.InvalidParams, 'Title is required');
      const form: any = {
        info: { title: args.title, documentTitle: args.title },
      };
      try {
        const response = await forms.forms.create({ requestBody: form });
        const formId = response.data.formId;
        const responderUri = response.data.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`;

        let descriptionSet = false;
        if (args.description) {
          try {
            await forms.forms.batchUpdate({
              formId: formId!,
              requestBody: {
                requests: [
                  { updateFormInfo: { info: { description: args.description }, updateMask: 'description' } },
                ],
              },
            });
            descriptionSet = true;
          } catch (descError: any) {
            console.error('Failed to set form description:', descError);
          }
        }

        return ok({
          formId,
          title: args.title,
          description: descriptionSet ? args.description : '',
          responderUri,
        });
      } catch (error: any) {
        console.error('Error creating form:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to create form: ${error.message}`);
      }
    }

    // ── 2. copy_form ──────────────────────────────────────────────────
    case 'copy_form': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const formResponse = await forms.forms.get({ formId: args.formId });
        const form = formResponse.data;
        const newTitle = args.newTitle || `${form.info?.title || 'Untitled Form'} (Copy)`;
        const newForm: any = {
          info: { title: newTitle },
        };
        const createResponse = await forms.forms.create({ requestBody: newForm });
        const newFormId = createResponse.data.formId;

        // Copy description and documentTitle via batchUpdate (can't set on create)
        try {
          await forms.forms.batchUpdate({
            formId: newFormId!,
            requestBody: {
              requests: [
                {
                  updateFormInfo: {
                    info: { description: form.info?.description || '', title: newTitle },
                    updateMask: 'description',
                  },
                },
              ],
            },
          });
        } catch (e) {
          console.error('Failed to copy form description:', e);
        }

        // Copy settings
        if (form.settings) {
          try {
            const settingsKeys = Object.keys(form.settings).filter(
              (k) => form.settings![k as keyof typeof form.settings] !== null &&
                     form.settings![k as keyof typeof form.settings] !== undefined,
            );
            if (settingsKeys.length > 0) {
              const filteredSettings: any = {};
              settingsKeys.forEach((k) => { filteredSettings[k] = (form.settings as any)[k]; });
              await forms.forms.batchUpdate({
                formId: newFormId!,
                requestBody: {
                  requests: [{ updateSettings: { settings: filteredSettings, updateMask: settingsKeys.join(',') } }],
                },
              });
            }
          } catch (e) {
            console.error('Failed to copy form settings:', e);
          }
        }

        // Copy items (skip image items — images require valid source URIs that can't be re-created)
        const copiedItems: any[] = [];
        if (form.items && form.items.length > 0) {
          for (let index = 0; index < form.items.length; index++) {
            const item = form.items[index];
            if (item.imageItem) {
              console.warn(`Skipping image item "${item.title || ''}" at index ${index} — cannot copy images`);
              continue;
            }
            const { itemId, ...itemWithoutId } = item;
            if (itemWithoutId.questionItem?.question?.questionId) {
              delete itemWithoutId.questionItem.question.questionId;
            }
            copiedItems.push({ createItem: { item: itemWithoutId, location: { index: copiedItems.length } } });
          }
          for (let i = 0; i < copiedItems.length; i += 50) {
            const batch = copiedItems.slice(i, i + 50);
            await forms.forms.batchUpdate({ formId: newFormId!, requestBody: { requests: batch } });
          }
        }

        return ok({
          success: true,
          message: 'Form copied successfully',
          originalFormId: args.formId,
          newFormId,
          title: newTitle,
          responderUri: `https://docs.google.com/forms/d/${newFormId}/viewform`,
        });
      } catch (error: any) {
        console.error('Error copying form:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to copy form: ${error.message}`);
      }
    }

    // ── 3. delete_form ────────────────────────────────────────────────
    case 'delete_form': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        await drive.files.delete({ fileId: args.formId });
        return ok({ success: true, message: 'Form deleted successfully', formId: args.formId });
      } catch (error: any) {
        console.error('Error deleting form:', error);
        const msg = error.message || 'Unknown error';
        if (msg.includes('drive') || msg.includes('Drive') || msg.includes('permission') || msg.includes('disabled')) {
          throw new McpError(ErrorCode.InternalError, 'Failed to delete form: Google Drive API is not enabled. Please enable it at https://console.cloud.google.com/apis/library/drive.googleapis.com');
        }
        throw new McpError(ErrorCode.InternalError, `Failed to delete form: ${msg}`);
      }
    }

    // ── 4. get_form ───────────────────────────────────────────────────
    case 'get_form': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const response = await forms.forms.get({ formId: args.formId });
        return ok(response.data);
      } catch (error: any) {
        console.error('Error getting form:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to get form: ${error.message}`);
      }
    }

    // ── 5. get_form_metadata ──────────────────────────────────────────
    case 'get_form_metadata': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const response = await forms.forms.get({ formId: args.formId });
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
            const responses = await forms.forms.responses.list({ formId: args.formId, pageSize: 5000, pageToken });
            responseCount += (responses.data.responses || []).length;
            pageToken = responses.data.nextPageToken ?? undefined;
          } while (pageToken);
          metadata.responseCount = responseCount;
        } catch (e) {
          metadata.responseCount = null;
        }

        return ok(metadata);
      } catch (error: any) {
        console.error('Error getting form metadata:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to get form metadata: ${error.message}`);
      }
    }

    // ── 6. update_form_settings ───────────────────────────────────────
    case 'update_form_settings': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const requests: any[] = [];

        if (args.title || args.description) {
          const infoUpdate: any = { updateFormInfo: { info: {}, updateMask: '' } };
          const masks: string[] = [];
          if (args.title) { infoUpdate.updateFormInfo.info.title = args.title; masks.push('title'); }
          if (args.description) { infoUpdate.updateFormInfo.info.description = args.description; masks.push('description'); }
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
          requests.push({ updateSettings: { settings, updateMask: masks.join(',') } });
        }

        if (requests.length === 0) throw new McpError(ErrorCode.InvalidParams, 'No settings to update');

        await forms.forms.batchUpdate({ formId: args.formId, requestBody: { requests } });

        return ok({
          success: true,
          message: 'Form settings updated successfully',
          updatedSettings: { title: args.title, description: args.description, isQuiz: args.isQuiz, quizSettings: args.quizSettings, collectEmails: args.collectEmails },
        });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error updating form settings:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to update form settings: ${error.message}`);
      }
    }

    // ── 7. set_publish_settings ───────────────────────────────────────
    case 'set_publish_settings': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const isPublished = args.isPublished !== undefined ? args.isPublished : true;
        const isAcceptingResponses = args.isAcceptingResponses !== undefined ? args.isAcceptingResponses : isPublished;

        await forms.forms.setPublishSettings({
          formId: args.formId,
          requestBody: { publishSettings: { publishState: { isPublished, isAcceptingResponses } } },
        });

        return ok({ success: true, message: 'Publish settings updated successfully', isPublished, isAcceptingResponses });
      } catch (error: any) {
        console.error('Error setting publish settings:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to set publish settings: ${error.message}`);
      }
    }

    // ── 8. set_form_description ───────────────────────────────────────
    case 'set_form_description': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      if (args.description === undefined || args.description === null) throw new McpError(ErrorCode.InvalidParams, 'Description is required');
      try {
        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{ updateFormInfo: { info: { description: args.description }, updateMask: 'description' } }],
          },
        });
        return ok({ success: true, message: 'Form description updated successfully', description: args.description });
      } catch (error: any) {
        console.error('Error setting form description:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to set form description: ${error.message}`);
      }
    }

    // ── 9. list_forms ─────────────────────────────────────────────────
    case 'list_forms': {
      try {
        const maxResults = Math.min(args.maxResults || 20, 100);
        let query = "mimeType='application/vnd.google-apps.form' and trashed=false";
        if (args.query) {
          const safeQuery = args.query.replace(/['"\\()]/g, '');
          query += ` and name contains '${safeQuery}'`;
        }

        const response = await drive.files.list({
          q: query,
          fields: 'files(id, name, createdTime, modifiedTime, webViewLink)',
          orderBy: 'modifiedTime desc',
          pageSize: maxResults,
        });

        const formsList = (response.data.files || []).map((f: any) => ({
          formId: f.id,
          title: f.name,
          created: f.createdTime,
          modified: f.modifiedTime,
          editUrl: f.webViewLink,
        }));

        if (formsList.length === 0) {
          return ok({ message: 'No forms found', forms: [] });
        }

        // Get response counts for each form
        const formsWithCounts: any[] = [];
        for (let i = 0; i < formsList.length; i += 5) {
          const batch = formsList.slice(i, i + 5);
          const results = await Promise.allSettled(
            batch.map(async (f: any) => {
              let count = 0;
              let pageToken: string | undefined;
              do {
                const responses = await forms.forms.responses.list({ formId: f.formId, pageSize: 5000, pageToken });
                count += (responses.data.responses || []).length;
                pageToken = responses.data.nextPageToken ?? undefined;
              } while (pageToken);
              return { ...f, responseCount: count };
            }),
          );
          results.forEach((r, idx) => {
            if (r.status === 'fulfilled') formsWithCounts.push(r.value);
            else formsWithCounts.push({ ...batch[idx], responseCount: null });
          });
        }

        return ok({ total: formsWithCounts.length, forms: formsWithCounts });
      } catch (error: any) {
        console.error('Error listing forms:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to list forms: ${error.message}`);
      }
    }

    // ── 10. add_text_question ─────────────────────────────────────────
    case 'add_text_question': {
      if (!args.formId || !args.questionTitle) throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: {
                  title: args.questionTitle,
                  questionItem: { question: { required: args.required || false, textQuestion: {} } },
                },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Text question added successfully', questionTitle: args.questionTitle, required: args.required || false });
      } catch (error: any) {
        console.error('Error adding text question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add text question: ${error.message}`);
      }
    }

    // ── 11. add_paragraph_question ────────────────────────────────────
    case 'add_paragraph_question': {
      if (!args.formId || !args.questionTitle) throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: {
                  title: args.questionTitle,
                  questionItem: { question: { required: args.required || false, textQuestion: { paragraph: true } } },
                },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Paragraph question added successfully', questionTitle: args.questionTitle, required: args.required || false });
      } catch (error: any) {
        console.error('Error adding paragraph question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add paragraph question: ${error.message}`);
      }
    }

    // ── 12. add_multiple_choice_question ──────────────────────────────
    case 'add_multiple_choice_question': {
      if (!args.formId || !args.questionTitle || !args.options || !Array.isArray(args.options)) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, and options array are required');
      }
      if (args.options.length === 0) throw new McpError(ErrorCode.InvalidParams, 'Options array must not be empty');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);
        const choices = sanitizeOptions(args.options);

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: {
                  title: args.questionTitle,
                  questionItem: { question: { required: args.required || false, choiceQuestion: { type: 'RADIO', options: choices } } },
                },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Multiple choice question added successfully', questionTitle: args.questionTitle, options: args.options, required: args.required || false });
      } catch (error: any) {
        console.error('Error adding multiple choice question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add multiple choice question: ${error.message}`);
      }
    }

    // ── 13. add_checkbox_question ─────────────────────────────────────
    case 'add_checkbox_question': {
      if (!args.formId || !args.questionTitle || !args.options || !Array.isArray(args.options)) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, and options array are required');
      }
      if (args.options.length === 0) throw new McpError(ErrorCode.InvalidParams, 'Options array must not be empty');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);
        const choices = sanitizeOptions(args.options);

        const choiceQuestion: any = { type: 'CHECKBOX', options: choices };
        if (args.shuffle !== undefined) choiceQuestion.shuffle = args.shuffle;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: {
                  title: args.questionTitle,
                  questionItem: { question: { required: args.required || false, choiceQuestion } },
                },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Checkbox question added successfully', questionTitle: args.questionTitle, options: args.options, required: args.required || false });
      } catch (error: any) {
        console.error('Error adding checkbox question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add checkbox question: ${error.message}`);
      }
    }

    // ── 14. add_dropdown_question ─────────────────────────────────────
    case 'add_dropdown_question': {
      if (!args.formId || !args.questionTitle || !args.options || !Array.isArray(args.options)) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, and options array are required');
      }
      if (args.options.length === 0) throw new McpError(ErrorCode.InvalidParams, 'Options array must not be empty');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);
        const choices = sanitizeOptions(args.options);

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: {
                  title: args.questionTitle,
                  questionItem: { question: { required: args.required || false, choiceQuestion: { type: 'DROP_DOWN', options: choices } } },
                },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Dropdown question added successfully', questionTitle: args.questionTitle, options: args.options, required: args.required || false });
      } catch (error: any) {
        console.error('Error adding dropdown question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add dropdown question: ${error.message}`);
      }
    }

    // ── 15. add_linear_scale_question ─────────────────────────────────
    case 'add_linear_scale_question': {
      if (!args.formId || !args.questionTitle || args.low === undefined || args.high === undefined) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, low, and high values are required');
      }
      if (!Number.isInteger(args.low) || !Number.isInteger(args.high) || args.low < 0 || args.low > 10 || args.high < 0 || args.high > 10) {
        throw new McpError(ErrorCode.InvalidParams, 'Low and high must be integers between 0 and 10');
      }
      if (args.low >= args.high) throw new McpError(ErrorCode.InvalidParams, 'Low value must be less than high value');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        const scaleConfig: any = { low: args.low, high: args.high };
        if (args.lowLabel) scaleConfig.lowLabel = args.lowLabel;
        if (args.highLabel) scaleConfig.highLabel = args.highLabel;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: { title: args.questionTitle, questionItem: { question: { required: args.required || false, scaleQuestion: scaleConfig } } },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Linear scale question added successfully', questionTitle: args.questionTitle, low: args.low, high: args.high, lowLabel: args.lowLabel || '', highLabel: args.highLabel || '', required: args.required || false });
      } catch (error: any) {
        console.error('Error adding linear scale question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add linear scale question: ${error.message}`);
      }
    }

    // ── 16. add_date_question ─────────────────────────────────────────
    case 'add_date_question': {
      if (!args.formId || !args.questionTitle) throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: { title: args.questionTitle, questionItem: { question: { required: args.required || false, dateQuestion: { includeTime: args.includeTime || false } } } },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Date question added successfully', questionTitle: args.questionTitle, includeTime: args.includeTime || false, required: args.required || false });
      } catch (error: any) {
        console.error('Error adding date question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add date question: ${error.message}`);
      }
    }

    // ── 17. add_time_question ─────────────────────────────────────────
    case 'add_time_question': {
      if (!args.formId || !args.questionTitle) throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: { title: args.questionTitle, questionItem: { question: { required: args.required || false, timeQuestion: { duration: args.duration || false } } } },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Time question added successfully', questionTitle: args.questionTitle, duration: args.duration || false, required: args.required || false });
      } catch (error: any) {
        console.error('Error adding time question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add time question: ${error.message}`);
      }
    }

    // ── 18. add_rating_question ───────────────────────────────────────
    case 'add_rating_question': {
      if (!args.formId || !args.questionTitle) throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
      if (args.ratingScaleLevel !== undefined && (!Number.isInteger(args.ratingScaleLevel) || args.ratingScaleLevel < 3 || args.ratingScaleLevel > 10)) {
        throw new McpError(ErrorCode.InvalidParams, 'ratingScaleLevel must be an integer between 3 and 10');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        const ratingConfig: any = { ratingScaleLevel: args.ratingScaleLevel || 5, iconType: args.iconType || 'STAR' };

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: { title: args.questionTitle, questionItem: { question: { required: args.required || false, ratingQuestion: ratingConfig } } },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Rating question added successfully', questionTitle: args.questionTitle, iconType: args.iconType || 'STAR', ratingScaleLevel: args.ratingScaleLevel || 5, required: args.required || false });
      } catch (error: any) {
        console.error('Error adding rating question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add rating question: ${error.message}`);
      }
    }

    // ── 19. add_file_upload_question ──────────────────────────────────
    case 'add_file_upload_question': {
      if (!args.formId || !args.questionTitle) throw new McpError(ErrorCode.InvalidParams, 'Form ID and question title are required');
      // The Google Forms API does not support creating file upload questions programmatically.
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: 'The Google Forms API does not support creating file upload questions programmatically.',
            instructions: `To add a file upload question manually:\n1. Open your form at https://docs.google.com/forms/d/${args.formId}/edit\n2. Click the "+" button to add a new item\n3. Select "File upload" from the question type dropdown\n4. Set the question title to: ${args.questionTitle}\n5. Configure accepted file types and max size`,
          }, null, 2),
        }],
      };
    }

    // ── 20. add_choice_grid ───────────────────────────────────────────
    case 'add_choice_grid': {
      if (!args.formId || !args.questionTitle || !args.rows || !args.columns) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, question title, rows, and columns are required');
      }
      if (!Array.isArray(args.rows) || args.rows.length === 0) throw new McpError(ErrorCode.InvalidParams, 'Rows must be a non-empty array of strings');
      if (!Array.isArray(args.columns) || args.columns.length === 0) throw new McpError(ErrorCode.InvalidParams, 'Columns must be a non-empty array of strings');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);
        const columnOptions = sanitizeOptions(args.columns);

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              createItem: {
                item: {
                  title: args.questionTitle,
                  questionGroupItem: {
                    grid: { columns: { type: args.type || 'RADIO', options: columnOptions } },
                    questions: args.rows.map((row: string) => ({ rowQuestion: { title: row }, required: args.required || false })),
                  },
                },
                location: { index: insertIndex },
              },
            }],
          },
        });

        return ok({ success: true, message: 'Choice grid added successfully', questionTitle: args.questionTitle, rows: args.rows, columns: args.columns, type: args.type || 'RADIO', required: args.required || false });
      } catch (error: any) {
        console.error('Error adding choice grid:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add choice grid: ${error.message}`);
      }
    }

    // ── 21. add_page_break ────────────────────────────────────────────
    case 'add_page_break': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        const pageBreakItem: any = { pageBreakItem: {} };
        if (args.title || args.description) {
          pageBreakItem.title = args.title || '';
          if (args.description) pageBreakItem.description = args.description;
        }

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: { requests: [{ createItem: { item: pageBreakItem, location: { index: insertIndex } } }] },
        });

        return ok({ success: true, message: 'Page break added successfully', title: args.title || '', description: args.description || '' });
      } catch (error: any) {
        console.error('Error adding page break:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add page break: ${error.message}`);
      }
    }

    // ── 22. add_section_header ────────────────────────────────────────
    case 'add_section_header': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      if (!args.title && !args.description) throw new McpError(ErrorCode.InvalidParams, 'At least a title or description is required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        const textItem: any = { textItem: {} };
        if (args.title) textItem.title = args.title;
        if (args.description) textItem.description = args.description;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: { requests: [{ createItem: { item: textItem, location: { index: insertIndex } } }] },
        });

        return ok({ success: true, message: 'Section header added successfully', title: args.title || '', description: args.description || '' });
      } catch (error: any) {
        console.error('Error adding section header:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add section header: ${error.message}`);
      }
    }

    // ── 23. add_title_description ─────────────────────────────────────
    case 'add_title_description': {
      if (!args.formId || !args.title) throw new McpError(ErrorCode.InvalidParams, 'Form ID and title are required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        const textItem: any = { textItem: {}, title: args.title };
        if (args.description) textItem.description = args.description;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: { requests: [{ createItem: { item: textItem, location: { index: insertIndex } } }] },
        });

        return ok({ success: true, message: 'Title and description added successfully', title: args.title, description: args.description || '' });
      } catch (error: any) {
        console.error('Error adding title and description:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add title and description: ${error.message}`);
      }
    }

    // ── 24. add_image ─────────────────────────────────────────────────
    case 'add_image': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      if (!args.imageUrl) {
        throw new McpError(ErrorCode.InvalidParams, 'imageUrl is required. To add an image manually, open your form at https://docs.google.com/forms/d/' + args.formId + '/edit');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        const imageItem: any = { imageItem: { image: { sourceUri: args.imageUrl } } };
        if (args.title) imageItem.title = args.title;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: { requests: [{ createItem: { item: imageItem, location: { index: insertIndex } } }] },
        });

        return ok({ success: true, message: 'Image added successfully', title: args.title || '', imageUrl: args.imageUrl });
      } catch (error: any) {
        console.error('Error adding image:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add image: ${error.message}`);
      }
    }

    // ── 25. add_video ─────────────────────────────────────────────────
    case 'add_video': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      if (!args.videoUrl) {
        throw new McpError(ErrorCode.InvalidParams, 'videoUrl is required. To add a video manually, open your form at https://docs.google.com/forms/d/' + args.formId + '/edit');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const formItems = form.data.items || [];
        const insertIndex = getInsertIndex(formItems, args.section);

        let videoId = '';
        const youtubeRegex =
          /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/(?:shorts|live)\/)([a-zA-Z0-9_-]{11})/;
        const match = args.videoUrl.match(youtubeRegex);
        if (match) {
          videoId = match[1];
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid YouTube URL');
        }

        const videoItem: any = { videoItem: { video: { youtubeUri: `https://www.youtube.com/watch?v=${videoId}` } } };
        if (args.title) videoItem.title = args.title;
        if (args.caption) videoItem.videoItem.caption = args.caption;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: { requests: [{ createItem: { item: videoItem, location: { index: insertIndex } } }] },
        });

        return ok({ success: true, message: 'Video added successfully', title: args.title || '', videoUrl: args.videoUrl, videoId, caption: args.caption || '' });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error adding video:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add video: ${error.message}`);
      }
    }

    // ── 26. update_question ───────────────────────────────────────────
    case 'update_question': {
      if (!args.formId || !args.itemId) throw new McpError(ErrorCode.InvalidParams, 'Form ID and item ID are required');
      if (args.choices !== undefined && !Array.isArray(args.choices)) throw new McpError(ErrorCode.InvalidParams, 'Choices must be an array of strings');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const item = items.find((i: any) => i.itemId === args.itemId);
        if (!item) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);

        const updateItem: any = { ...item };
        const masks: string[] = [];

        if (args.newTitle) { updateItem.title = args.newTitle; masks.push('title'); }

        if (item.questionItem && item.questionItem.question) {
          const question = { ...item.questionItem.question };
          if (args.required !== undefined) { question.required = args.required; masks.push('questionItem.question.required'); }
          if (Array.isArray(args.choices) && question.choiceQuestion) {
            question.choiceQuestion = { ...question.choiceQuestion, options: sanitizeOptions(args.choices) };
            masks.push('questionItem.question.choiceQuestion.options');
          }
          updateItem.questionItem = { question };
        }

        if (masks.length === 0) throw new McpError(ErrorCode.InvalidParams, 'No fields to update');

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{ updateItem: { item: updateItem, location: { index: items.indexOf(item) }, updateMask: masks.join(',') } }],
          },
        });

        return ok({ success: true, message: 'Question updated successfully', itemId: args.itemId, newTitle: args.newTitle, required: args.required });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error updating question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to update question: ${error.message}`);
      }
    }

    // ── 27. delete_question ───────────────────────────────────────────
    case 'delete_question': {
      if (!args.formId || !args.itemId) throw new McpError(ErrorCode.InvalidParams, 'Form ID and item ID are required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) {
          throw new McpError(ErrorCode.InvalidParams, `Item with ID "${args.itemId}" not found in form. Use get_form_items to see valid item IDs.`);
        }

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: { requests: [{ deleteItem: { location: { index: itemIndex } } }] },
        });

        return ok({ success: true, message: 'Question deleted successfully', itemId: args.itemId, deletedIndex: itemIndex });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error deleting question:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to delete question: ${error.message}`);
      }
    }

    // ── 28. reorder_items ─────────────────────────────────────────────
    case 'reorder_items': {
      if (!args.formId || !args.itemId || args.newIndex === undefined) throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and new index are required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);
        if (args.newIndex < 0 || args.newIndex >= items.length || !Number.isInteger(args.newIndex)) {
          throw new McpError(ErrorCode.InvalidParams, `newIndex must be between 0 and ${items.length - 1}`);
        }

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{ moveItem: { originalLocation: { index: itemIndex }, newLocation: { index: args.newIndex } } }],
          },
        });

        return ok({ success: true, message: 'Item reordered successfully', itemId: args.itemId, fromIndex: itemIndex, toIndex: args.newIndex });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error reordering items:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to reorder items: ${error.message}`);
      }
    }

    // ── 29. set_question_grading ──────────────────────────────────────
    case 'set_question_grading': {
      if (!args.formId || !args.itemId || args.points === undefined) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and points are required');
      }
      if (!Number.isInteger(args.points) || args.points < 0) throw new McpError(ErrorCode.InvalidParams, 'Points must be a non-negative integer');

      try {
        const form = await forms.forms.get({ formId: args.formId });
        const isQuiz = form.data.settings?.quizSettings?.isQuiz === true;
        if (!isQuiz) {
          throw new McpError(ErrorCode.InvalidParams, 'Form must have quiz mode enabled to set grading. Use update_form_settings with isQuiz: true first.');
        }

        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);

        const item = items[itemIndex];
        if (!item.questionItem || !item.questionItem.question) {
          throw new McpError(ErrorCode.InvalidParams, `Item ${args.itemId} is not a question`);
        }

        const question = item.questionItem.question;
        const isChoiceQuestion = !!question.choiceQuestion;
        const isShortAnswer = !!question.textQuestion && !question.textQuestion.paragraph;
        const isParagraph = !!question.textQuestion && question.textQuestion.paragraph;

        if (!isChoiceQuestion && !isShortAnswer) {
          throw new McpError(ErrorCode.InvalidParams, 'This question type does not support grading. Only SHORT_ANSWER, RADIO, CHECKBOX, and DROPDOWN questions can be graded.');
        }

        const grading: any = { pointValue: args.points };
        if (args.correctAnswers && Array.isArray(args.correctAnswers)) {
          if (isParagraph) throw new McpError(ErrorCode.InvalidParams, 'Paragraph questions do not support correctAnswers. Use generalFeedback instead.');
          grading.correctAnswers = { answers: args.correctAnswers.map((a: any) => ({ value: a.value })) };
        }

        if (args.feedbackCorrect || args.feedbackIncorrect) {
          if (isShortAnswer) {
            grading.generalFeedback = { text: args.feedbackCorrect || args.feedbackIncorrect || '' };
          } else {
            if (args.feedbackCorrect) grading.whenRight = { text: args.feedbackCorrect };
            if (args.feedbackIncorrect) grading.whenWrong = { text: args.feedbackIncorrect };
          }
        }

        question.grading = grading;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              updateItem: {
                item: { itemId: args.itemId, title: item.title, questionItem: { question } },
                location: { index: itemIndex },
                updateMask: 'questionItem.question.grading',
              },
            }],
          },
        });

        return ok({
          success: true,
          message: 'Question grading set successfully',
          itemId: args.itemId,
          points: args.points,
          correctAnswers: args.correctAnswers?.map((a: any) => a.value) || [],
          feedbackCorrect: args.feedbackCorrect || '',
          feedbackIncorrect: args.feedbackIncorrect || '',
        });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error setting question grading:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to set question grading: ${error.message}`);
      }
    }

    // ── 30. add_question_validation ───────────────────────────────────
    case 'add_question_validation': {
      throw new McpError(
        ErrorCode.InvalidParams,
        'The Google Forms API does not support setting question validation programmatically. Validation can only be configured in the Google Forms UI.'
      );
    }

    // ── 31. add_question_option ───────────────────────────────────────
    case 'add_question_option': {
      if (!args.formId || !args.itemId || !args.optionText) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and optionText are required');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);

        const item = items[itemIndex];
        if (!item.questionItem || !item.questionItem.question) {
          throw new McpError(ErrorCode.InvalidParams, `Item ${args.itemId} is not a question`);
        }

        const question = { ...item.questionItem.question };
        if (!question.choiceQuestion) {
          throw new McpError(ErrorCode.InvalidParams, 'This question type does not support options');
        }

        const choiceQuestion = { ...question.choiceQuestion };
        const existingOptions = choiceQuestion.options || [];
        choiceQuestion.options = [...existingOptions, { value: args.optionText }];
        question.choiceQuestion = choiceQuestion;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              updateItem: {
                item: { itemId: args.itemId, title: item.title, questionItem: { question } },
                location: { index: itemIndex },
                updateMask: 'questionItem.question.choiceQuestion.options',
              },
            }],
          },
        });

        return ok({ success: true, message: 'Option added successfully', itemId: args.itemId, optionText: args.optionText });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error adding question option:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to add question option: ${error.message}`);
      }
    }

    // ── 32. remove_question_option ────────────────────────────────────
    case 'remove_question_option': {
      if (!args.formId || !args.itemId || args.optionIndex === undefined) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and optionIndex are required');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);

        const item = items[itemIndex];
        if (!item.questionItem || !item.questionItem.question) {
          throw new McpError(ErrorCode.InvalidParams, `Item ${args.itemId} is not a question`);
        }

        const question = { ...item.questionItem.question };
        if (!question.choiceQuestion) {
          throw new McpError(ErrorCode.InvalidParams, 'This question type does not support options');
        }

        const choiceQuestion = { ...question.choiceQuestion };
        const options = [...(choiceQuestion.options || [])];
        if (args.optionIndex < 0 || args.optionIndex >= options.length) {
          throw new McpError(ErrorCode.InvalidParams, `optionIndex must be between 0 and ${options.length - 1}`);
        }
        const removedOption = options.splice(args.optionIndex, 1)[0];
        choiceQuestion.options = options;
        question.choiceQuestion = choiceQuestion;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              updateItem: {
                item: { itemId: args.itemId, title: item.title, questionItem: { question } },
                location: { index: itemIndex },
                updateMask: 'questionItem.question.choiceQuestion.options',
              },
            }],
          },
        });

        return ok({ success: true, message: 'Option removed successfully', itemId: args.itemId, removedOption: removedOption.value });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error removing question option:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to remove question option: ${error.message}`);
      }
    }

    // ── 33. shuffle_question_options ──────────────────────────────────
    case 'shuffle_question_options': {
      if (!args.formId || !args.itemId || args.shuffle === undefined) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and shuffle are required');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);

        const item = items[itemIndex];
        if (!item.questionItem || !item.questionItem.question) {
          throw new McpError(ErrorCode.InvalidParams, `Item ${args.itemId} is not a question`);
        }

        const question = { ...item.questionItem.question };
        if (!question.choiceQuestion) {
          throw new McpError(ErrorCode.InvalidParams, 'Only choice questions support option shuffling');
        }

        const choiceQuestion = { ...question.choiceQuestion, shuffle: args.shuffle };
        question.choiceQuestion = choiceQuestion;

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              updateItem: {
                item: { itemId: args.itemId, title: item.title, questionItem: { question } },
                location: { index: itemIndex },
                updateMask: 'questionItem.question.choiceQuestion.shuffle',
              },
            }],
          },
        });

        return ok({ success: true, message: `Option shuffling ${args.shuffle ? 'enabled' : 'disabled'}`, itemId: args.itemId, shuffle: args.shuffle });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error setting shuffle:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to set option shuffling: ${error.message}`);
      }
    }

    // ── 34. set_question_required ─────────────────────────────────────
    case 'set_question_required': {
      if (!args.formId || !args.itemId || args.required === undefined) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and required are required');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);

        const item = items[itemIndex];
        if (!item.questionItem || !item.questionItem.question) {
          throw new McpError(ErrorCode.InvalidParams, `Item ${args.itemId} is not a question`);
        }

        const question = { ...item.questionItem.question, required: args.required };

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              updateItem: {
                item: { itemId: args.itemId, title: item.title, questionItem: { question } },
                location: { index: itemIndex },
                updateMask: 'questionItem.question.required',
              },
            }],
          },
        });

        return ok({ success: true, message: `Question ${args.required ? 'set as required' : 'set as optional'}`, itemId: args.itemId, required: args.required });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error setting question required:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to set question required: ${error.message}`);
      }
    }

    // ── 35. set_question_description ──────────────────────────────────
    case 'set_question_description': {
      if (!args.formId || !args.itemId || args.description === undefined) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and description are required');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);

        const item = items[itemIndex];
        const updatedItem = { ...item, description: args.description };

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{
              updateItem: {
                item: updatedItem,
                location: { index: itemIndex },
                updateMask: 'description',
              },
            }],
          },
        });

        return ok({ success: true, message: 'Question description updated successfully', itemId: args.itemId, description: args.description });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error setting question description:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to set question description: ${error.message}`);
      }
    }

    // ── 36. get_form_responses ────────────────────────────────────────
    case 'get_form_responses': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        let allResponses: any[] = [];
        let pageToken: string | undefined;
        do {
          const response = await forms.forms.responses.list({ formId: args.formId, pageSize: 5000, pageToken });
          allResponses = allResponses.concat(response.data.responses || []);
          pageToken = response.data.nextPageToken ?? undefined;
        } while (pageToken);

        return ok({ responses: allResponses, totalResponses: allResponses.length });
      } catch (error: any) {
        console.error('Error getting form responses:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to get form responses: ${error.message}`);
      }
    }

    // ── 37. get_responses_sheet ───────────────────────────────────────
    case 'get_responses_sheet': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const linkedSheetId = form.data.linkedSheetId;

        if (!linkedSheetId) {
          return ok({ message: 'No linked sheet found. Open the form responses tab in Google Forms and click "Link to Sheets" to create one.' });
        }

        const sheetResponse = await sheets.spreadsheets.values.get({ spreadsheetId: linkedSheetId });
        const values = sheetResponse.data.values || [];

        if (values.length === 0) {
          return ok({ spreadsheetId: linkedSheetId, headers: [], responses: [], message: 'No responses yet.' });
        }

        const headers = values[0];
        const rows = values.slice(1);
        const responses = rows.map((row: any[]) => {
          const rowObj: any = {};
          headers.forEach((header: string, i: number) => { rowObj[header] = row[i] || ''; });
          return rowObj;
        });

        return ok({ spreadsheetId: linkedSheetId, headers, responses, totalResponses: responses.length });
      } catch (error: any) {
        console.error('Error getting responses sheet:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to get responses sheet: ${error.message}`);
      }
    }

    // ── 38. get_form_responses_analytics ──────────────────────────────
    case 'get_form_responses_analytics': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const formResponse = await forms.forms.get({ formId: args.formId });
        const form = formResponse.data;
        const formItems = form.items || [];

        // Build question map
        const questionMap: Record<string, any> = {};
        formItems.forEach((item: any, index: number) => {
          if (item.questionItem?.question) {
            const q = item.questionItem.question;
            const info: any = { index, itemId: item.itemId, title: item.title || `Question ${index + 1}`, type: 'unknown' };

            if (q.textQuestion) info.type = q.textQuestion.paragraph ? 'paragraph' : 'text';
            else if (q.choiceQuestion) {
              info.type = q.choiceQuestion.type === 'RADIO' ? 'multiple_choice' : q.choiceQuestion.type === 'CHECKBOX' ? 'checkbox' : q.choiceQuestion.type === 'DROP_DOWN' ? 'dropdown' : q.choiceQuestion.type;
              info.options = q.choiceQuestion.options?.map((o: any) => o.value) || [];
            } else if (q.scaleQuestion) { info.type = 'linear_scale'; info.low = q.scaleQuestion.low; info.high = q.scaleQuestion.high; }
            else if (q.dateQuestion) info.type = 'date';
            else if (q.timeQuestion) info.type = 'time';
            else if (q.ratingQuestion) info.type = 'rating';
            else if (q.fileUploadQuestion) info.type = 'file_upload';

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
          const page = await forms.forms.responses.list({ formId: args.formId, pageSize: 5000, pageToken });
          rawResponses = rawResponses.concat(page.data.responses || []);
          pageToken = page.data.nextPageToken ?? undefined;
        } while (pageToken);

        // Try to get linked sheet data
        let sheetData: any[][] | null = null;
        if (form.linkedSheetId) {
          try {
            const sheetResp = await sheets.spreadsheets.values.get({ spreadsheetId: form.linkedSheetId });
            sheetData = sheetResp.data.values || null;
          } catch { /* Sheet not accessible */ }
        }

        // Process responses
        const processedResponses = rawResponses.map((response: any) => {
          const respondent: any = {
            responseId: response.responseId,
            submittedAt: response.createTime,
            lastSubmittedAt: response.lastSubmittedTime,
            answers: {},
          };

          if (response.answers) {
            for (const [qId, answer] of Object.entries(response.answers)) {
              const qInfo = questionMap[qId];
              if (qInfo) {
                const answerData: any = { questionTitle: qInfo.title, questionType: qInfo.type, questionIndex: qInfo.index };
                const a = answer as any;
                if (a.textAnswers?.answers) answerData.values = a.textAnswers.answers.map((ans: any) => ans.value);
                if (a.grade) { answerData.points = a.grade.score; answerData.maxPoints = a.grade.maxPoints; answerData.isCorrect = a.grade.correct; }
                respondent.answers[qInfo.title] = answerData;
              }
            }
          }
          if (response.respondentEmail) respondent.email = response.respondentEmail;
          return respondent;
        });

        // Build summary
        const summary: any = {
          formId: args.formId,
          title: form.info?.title || 'Untitled',
          totalResponses: processedResponses.length,
          questions: Object.values(questionMap),
          responses: processedResponses,
        };

        if (sheetData && sheetData.length > 0) {
          summary.sheetHeaders = sheetData[0];
          summary.sheetRows = sheetData.slice(1).map((row: any[]) => {
            const obj: Record<string, any> = {};
            sheetData![0].forEach((header: string, i: number) => { obj[header] = row[i] || ''; });
            return obj;
          });
        }

        // Calculate scores for graded forms
        const gradedResponses = processedResponses.filter((r: any) =>
          Object.values(r.answers).some((a: any) => (a as any).points !== undefined),
        );

        if (gradedResponses.length > 0) {
          const scores = gradedResponses.map((r: any) => {
            let totalScore = 0;
            let totalMax = 0;
            const questionScores: any[] = [];
            for (const [, answer] of Object.entries(r.answers)) {
              const a = answer as any;
              if (a.points !== undefined) {
                totalScore += a.points;
                totalMax += a.maxPoints || 0;
                questionScores.push({ question: a.questionTitle, score: a.points, maxScore: a.maxPoints, isCorrect: a.isCorrect });
              }
            }
            return { responseId: r.responseId, email: r.email, submittedAt: r.submittedAt, totalScore, totalMax, percentage: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0, questionScores };
          }).sort((a: any, b: any) => a.totalScore - b.totalScore);

          summary.scoreboard = scores;
          summary.statistics = {
            averageScore: Math.round(scores.reduce((s: number, r: any) => s + r.totalScore, 0) / scores.length),
            highestScore: scores[scores.length - 1]?.totalScore || 0,
            lowestScore: scores[0]?.totalScore || 0,
            averagePercentage: Math.round(scores.reduce((s: number, r: any) => s + r.percentage, 0) / scores.length),
          };
        }

        return ok(summary);
      } catch (error: any) {
        console.error('Error getting form responses analytics:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to get form responses analytics: ${error.message}`);
      }
    }

    // ── 39. delete_all_responses ──────────────────────────────────────
    case 'delete_all_responses': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        // Fetch all response IDs, then delete them one by one via the REST API
        const listRes = await forms.forms.responses.list({ formId: args.formId });
        const responses = listRes.data.responses || [];
        if (responses.length === 0) {
          return ok({ success: true, message: 'No responses to delete', formId: args.formId });
        }
        // Delete each response via direct DELETE request
        for (const r of responses) {
          await oauth2Client.request({
            method: 'DELETE',
            url: `https://forms.googleapis.com/v1/forms/${args.formId}/responses/${r.responseId}`,
          });
        }
        return ok({ success: true, message: `Deleted ${responses.length} responses`, formId: args.formId });
      } catch (error: any) {
        console.error('Error deleting all responses:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to delete all responses: ${error.message}`);
      }
    }

    // ── 40. delete_response ───────────────────────────────────────────
    case 'delete_response': {
      if (!args.formId || !args.responseId) throw new McpError(ErrorCode.InvalidParams, 'Form ID and response ID are required');
      try {
        // Google Forms API doesn't have a typed delete for responses;
        // use direct DELETE request via the REST API
        await oauth2Client.request({
          method: 'DELETE',
          url: `https://forms.googleapis.com/v1/forms/${args.formId}/responses/${args.responseId}`,
        });
        return ok({ success: true, message: 'Response deleted successfully', formId: args.formId, responseId: args.responseId });
      } catch (error: any) {
        console.error('Error deleting response:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to delete response: ${error.message}`);
      }
    }

    // ── 41. share_form ────────────────────────────────────────────────
    case 'share_form': {
      if (!args.formId || !args.emailAddresses || !Array.isArray(args.emailAddresses) || args.emailAddresses.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID and at least one email address are required');
      }
      try {
        const role = args.role || 'reader';
        const sendEmail = args.sendEmail !== undefined ? args.sendEmail : true;

        const results = await Promise.all(
          args.emailAddresses.map(async (email: string) => {
            try {
              const permission = await drive.permissions.create({
                fileId: args.formId,
                requestBody: { type: 'user', role, emailAddress: email },
                sendNotificationEmail: sendEmail,
                emailMessage: args.message || undefined,
                fields: 'id, type, role, emailAddress',
              });
              return { email, success: true, permissionId: permission.data.id };
            } catch (e: any) {
              return { email, success: false, error: e.message };
            }
          }),
        );

        const succeeded = results.filter((r: any) => r.success);
        const failed = results.filter((r: any) => !r.success);

        return ok({
          success: failed.length === 0,
          message: `Shared with ${succeeded.length} of ${args.emailAddresses.length} users`,
          role,
          sentEmailNotifications: sendEmail,
          succeeded: succeeded.map((r: any) => r.email),
          failed: failed.map((r: any) => ({ email: r.email, error: r.error })),
          formUrl: `https://docs.google.com/forms/d/${args.formId}/edit`,
        });
      } catch (error: any) {
        console.error('Error sharing form:', error);
        const errorMessage = error.message || 'Unknown error';
        if (errorMessage.includes('disabled') || errorMessage.includes('permission')) {
          throw new McpError(ErrorCode.InternalError, 'Failed to share form: Google Drive API is not enabled. Please enable it at https://console.cloud.google.com/apis/library/drive.googleapis.com');
        }
        throw new McpError(ErrorCode.InternalError, `Failed to share form: ${errorMessage}`);
      }
    }

    // ── 42. get_form_url ──────────────────────────────────────────────
    case 'get_form_url': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        const urlType = args.urlType || 'viewForm';
        const baseUrl = `https://docs.google.com/forms/d/${args.formId}`;
        let url: string;
        let accessLevel: string;

        switch (urlType) {
          case 'editForm':
            url = `${baseUrl}/edit`;
            accessLevel = 'Edit access (requires form owner/editor)';
            break;
          case 'createResponse':
            url = `${baseUrl}/viewform?usp=sf_link`;
            accessLevel = 'Response submission';
            break;
          case 'viewForm':
          default:
            url = `${baseUrl}/viewform`;
            accessLevel = 'View only';
            break;
        }

        return ok({
          formId: args.formId,
          urlType,
          url,
          accessLevel,
          editFormUrl: `${baseUrl}/edit`,
          viewFormUrl: `${baseUrl}/viewform`,
        });
      } catch (error: any) {
        console.error('Error getting form URL:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to get form URL: ${error.message}`);
      }
    }

    // ── 43. watch_form_responses ──────────────────────────────────────
    case 'watch_form_responses': {
      if (!args.formId) throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
      try {
        // Get the current response count
        let responseCount = 0;
        let pageToken: string | undefined;
        do {
          const response = await forms.forms.responses.list({ formId: args.formId, pageSize: 5000, pageToken });
          responseCount += (response.data.responses || []).length;
          pageToken = response.data.nextPageToken ?? undefined;
        } while (pageToken);

        // Get form metadata for context
        const form = await forms.forms.get({ formId: args.formId });

        return ok({
          formId: args.formId,
          formTitle: form.data.info?.title || 'Untitled',
          currentResponseCount: responseCount,
          responderUri: form.data.responderUri,
          lastChecked: new Date().toISOString(),
          message: `Current response count: ${responseCount}. Call this tool again later to compare counts.`,
          editUrl: `https://docs.google.com/forms/d/${args.formId}/edit`,
        });
      } catch (error: any) {
        console.error('Error watching form responses:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to watch form responses: ${error.message}`);
      }
    }

    // ── 44. move_item ─────────────────────────────────────────────────
    case 'move_item': {
      if (!args.formId || !args.itemId || args.newIndex === undefined) {
        throw new McpError(ErrorCode.InvalidParams, 'Form ID, item ID, and newIndex are required');
      }
      try {
        const form = await forms.forms.get({ formId: args.formId });
        const items = form.data.items || [];
        const itemIndex = items.findIndex((item: any) => item.itemId === args.itemId);
        if (itemIndex === -1) throw new McpError(ErrorCode.InvalidParams, `Item with ID ${args.itemId} not found`);
        if (!Number.isInteger(args.newIndex) || args.newIndex < 0 || args.newIndex >= items.length) {
          throw new McpError(ErrorCode.InvalidParams, `newIndex must be an integer between 0 and ${items.length - 1}`);
        }

        if (itemIndex === args.newIndex) {
          return ok({ success: true, message: 'Item is already at the target position', itemId: args.itemId, currentIndex: itemIndex });
        }

        await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [{ moveItem: { originalLocation: { index: itemIndex }, newLocation: { index: args.newIndex } } }],
          },
        });

        return ok({ success: true, message: 'Item moved successfully', itemId: args.itemId, fromIndex: itemIndex, toIndex: args.newIndex });
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        console.error('Error moving item:', error);
        throw new McpError(ErrorCode.InternalError, `Failed to move item: ${error.message}`);
      }
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}
