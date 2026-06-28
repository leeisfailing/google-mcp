import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

/**
 * Google API error codes and their user-friendly messages.
 * When a Google API is not enabled in the Cloud Console, the API returns
 * a 403 with the "accessNotConfigured" status. This helper provides
 * clear instructions for the user to enable the required API.
 */
const API_ENABLEMENT_MESSAGES: Record<string, string> = {
  'Google Docs API has not been used in project': 'Google Docs API',
  'Google Drive API has not been used in project': 'Google Drive API',
  'Google Sheets API has not been used in project': 'Google Sheets API',
  'Google Slides API has not been used in project': 'Google Slides API',
  'Google Calendar API has not been used in project': 'Google Calendar API',
  'Google Classroom API has not been used in project': 'Google Classroom API',
  'Google Forms API has not been used in project': 'Google Forms API',
  'Google Meet API has not been used in project': 'Google Meet API',
  'Google Drive Labels API has not been used in project': 'Google Drive Labels API',
  'Admin SDK API has not been used in project': 'Admin SDK API',
};

const API_DASHBOARDS: Record<string, string> = {
  'Google Docs API': 'https://console.cloud.google.com/apis/library/docs.googleapis.com',
  'Google Drive API': 'https://console.cloud.google.com/apis/library/drive.googleapis.com',
  'Google Sheets API': 'https://console.cloud.google.com/apis/library/sheets.googleapis.com',
  'Google Slides API': 'https://console.cloud.google.com/apis/library/slides.googleapis.com',
  'Google Calendar API': 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
  'Google Classroom API': 'https://console.cloud.google.com/apis/library/classroom.googleapis.com',
  'Google Forms API': 'https://console.cloud.google.com/apis/library/forms.googleapis.com',
  'Google Meet API': 'https://console.cloud.google.com/apis/library/meet.googleapis.com',
  'Google Drive Labels API': 'https://console.cloud.google.com/apis/library/drivelabels.googleapis.com',
  'Admin SDK API': 'https://console.cloud.google.com/apis/library/admin.googleapis.com',
};

/**
 * Maps tool name prefixes to the API they require.
 */
const TOOL_TO_API: Record<string, string> = {
  // Forms
  'forms_': 'Google Forms API',
  'create_form': 'Google Forms API',
  'copy_form': 'Google Forms API',
  'delete_form': 'Google Forms API',
  'get_form': 'Google Forms API',
  'get_form_metadata': 'Google Forms API',
  'update_form_settings': 'Google Forms API',
  'set_publish_settings': 'Google Forms API',
  'set_form_description': 'Google Forms API',
  'list_forms': 'Google Forms API',
  'add_text_question': 'Google Forms API',
  'add_paragraph_question': 'Google Forms API',
  'add_multiple_choice_question': 'Google Forms API',
  'add_checkbox_question': 'Google Forms API',
  'add_dropdown_question': 'Google Forms API',
  'add_linear_scale_question': 'Google Forms API',
  'add_date_question': 'Google Forms API',
  'add_time_question': 'Google Forms API',
  'add_rating_question': 'Google Forms API',
  'add_file_upload_question': 'Google Forms API',
  'add_choice_grid': 'Google Forms API',
  'add_page_break': 'Google Forms API',
  'add_section_header': 'Google Forms API',
  'add_title_description': 'Google Forms API',
  'add_image': 'Google Forms API',
  'add_video': 'Google Forms API',
  'update_question': 'Google Forms API',
  'delete_question': 'Google Forms API',
  'reorder_items': 'Google Forms API',
  'set_question_grading': 'Google Forms API',
  'add_question_validation': 'Google Forms API',
  'add_question_option': 'Google Forms API',
  'remove_question_option': 'Google Forms API',
  'shuffle_question_options': 'Google Forms API',
  'set_question_required': 'Google Forms API',
  'set_question_description': 'Google Forms API',
  'get_form_responses': 'Google Forms API',
  'get_responses_sheet': 'Google Forms API',
  'get_form_responses_analytics': 'Google Forms API',
  'delete_all_responses': 'Google Forms API',
  'delete_response': 'Google Forms API',
  'share_form': 'Google Forms API',
  'get_form_url': 'Google Forms API',
  'watch_form_responses': 'Google Forms API',
  'move_item': 'Google Forms API',

  // Sheets
  'sheets_': 'Google Sheets API',
  'create_spreadsheet': 'Google Sheets API',
  'delete_spreadsheet': 'Google Sheets API',
  'get_spreadsheet': 'Google Sheets API',
  'list_spreadsheets': 'Google Sheets API',
  'add_sheet': 'Google Sheets API',
  'delete_sheet': 'Google Sheets API',
  'rename_sheet': 'Google Sheets API',
  'list_sheets': 'Google Sheets API',
  'read_range': 'Google Sheets API',
  'write_range': 'Google Sheets API',
  'append_rows': 'Google Sheets API',
  'clear_range': 'Google Sheets API',
  'format_cells': 'Google Sheets API',
  'merge_cells': 'Google Sheets API',
  'run_formula': 'Google Sheets API',
  'filter_data': 'Google Sheets API',
  'create_chart': 'Google Sheets API',
  'update_chart': 'Google Sheets API',
  'delete_chart': 'Google Sheets API',
  'list_charts': 'Google Sheets API',
  'add_conditional_format_rule': 'Google Sheets API',
  'update_conditional_format_rule': 'Google Sheets API',
  'delete_conditional_format_rule': 'Google Sheets API',
  'list_conditional_format_rules': 'Google Sheets API',
  'add_data_validation': 'Google Sheets API',
  'update_data_validation': 'Google Sheets API',
  'delete_data_validation': 'Google Sheets API',
  'list_data_validations': 'Google Sheets API',
  'add_protected_range': 'Google Sheets API',
  'update_protected_range': 'Google Sheets API',
  'delete_protected_range': 'Google Sheets API',
  'list_protected_ranges': 'Google Sheets API',
  'add_developer_metadata': 'Google Sheets API',
  'get_developer_metadata': 'Google Sheets API',
  'search_developer_metadata': 'Google Sheets API',
  'delete_developer_metadata': 'Google Sheets API',
  'create_pivot_table': 'Google Sheets API',
  'create_named_range': 'Google Sheets API',
  'update_named_range': 'Google Sheets API',
  'delete_named_range': 'Google Sheets API',
  'list_named_ranges': 'Google Sheets API',
  'update_sheet_properties': 'Google Sheets API',
  'duplicate_sheet': 'Google Sheets API',
  'copy_sheet': 'Google Sheets API',
  'move_sheet': 'Google Sheets API',
  'update_sheet_tab_color': 'Google Sheets API',
  'batch_update_spreadsheet': 'Google Sheets API',
  'find_replace_sheet': 'Google Sheets API',
  'sort_range': 'Google Sheets API',
  'create_filter_view': 'Google Sheets API',
  'update_filter_view': 'Google Sheets API',
  'delete_filter_view': 'Google Sheets API',

  // Drive
  'drive_': 'Google Drive API',
  'list_drive_files': 'Google Drive API',
  'get_drive_file': 'Google Drive API',
  'create_drive_file': 'Google Drive API',
  'update_drive_file': 'Google Drive API',
  'delete_drive_file': 'Google Drive API',
  'copy_drive_file': 'Google Drive API',
  'download_drive_file': 'Google Drive API',
  'search_drive_files': 'Google Drive API',
  'create_drive_folder': 'Google Drive API',
  'list_drive_folder_contents': 'Google Drive API',
  'move_drive_file': 'Google Drive API',
  'add_drive_permission': 'Google Drive API',
  'list_drive_permissions': 'Google Drive API',
  'update_drive_permission': 'Google Drive API',
  'remove_drive_permission': 'Google Drive API',
  'share_drive_file': 'Google Drive API',
  'add_drive_comment': 'Google Drive API',
  'list_drive_comments': 'Google Drive API',
  'resolve_drive_comment': 'Google Drive API',
  'list_drive_revisions': 'Google Drive API',
  'get_drive_revision': 'Google Drive API',
  'delete_drive_revision': 'Google Drive API',
  'star_drive_file': 'Google Drive API',
  'set_drive_file_properties': 'Google Drive API',
  'list_shared_drives': 'Google Drive API',
  'get_shared_drive': 'Google Drive API',
  'create_shared_drive': 'Google Drive API',
  'delete_shared_drive': 'Google Drive API',
  'get_drive_about': 'Google Drive API',
  'create_drive_shortcut': 'Google Drive API',
  'get_drive_shortcut_target': 'Google Drive API',
  'export_drive_file': 'Google Drive API',
  'batch_update_drive_files': 'Google Drive API',

  // Calendar
  'calendar_': 'Google Calendar API',
  'list_calendars': 'Google Calendar API',
  'get_calendar': 'Google Calendar API',
  'create_calendar': 'Google Calendar API',
  'update_calendar': 'Google Calendar API',
  'delete_calendar': 'Google Calendar API',
  'get_calendar_colors': 'Google Calendar API',
  'get_calendar_settings': 'Google Calendar API',
  'list_events': 'Google Calendar API',
  'get_event': 'Google Calendar API',
  'create_event': 'Google Calendar API',
  'update_event': 'Google Calendar API',
  'delete_event': 'Google Calendar API',
  'quick_add_event': 'Google Calendar API',
  'move_event': 'Google Calendar API',
  'watch_events': 'Google Calendar API',
  'update_recurring_event_instance': 'Google Calendar API',
  'delete_recurring_event_instance': 'Google Calendar API',
  'get_freebusy': 'Google Calendar API',
  'get_calendar_list_freebusy': 'Google Calendar API',
  'get_event_colors': 'Google Calendar API',
  'watch_calendar_list': 'Google Calendar API',
  'stop_channel': 'Google Calendar API',
  'list_calendar_acl': 'Google Calendar API',
  'add_calendar_acl': 'Google Calendar API',
  'delete_calendar_acl': 'Google Calendar API',
  'import_event': 'Google Calendar API',

  // Docs
  'docs_': 'Google Docs API',
  'create_document': 'Google Docs API',
  'get_document': 'Google Docs API',
  'get_document_plain_text': 'Google Docs API',
  'delete_document': 'Google Docs API',
  'insert_text': 'Google Docs API',
  'insert_paragraph': 'Google Docs API',
  'insert_page_break': 'Google Docs API',
  'insert_table': 'Google Docs API',
  'insert_image': 'Google Docs API',
  'insert_bullet_list': 'Google Docs API',
  'insert_numbered_list': 'Google Docs API',
  'insert_named_range': 'Google Docs API',
  'update_paragraph_style': 'Google Docs API',
  'update_text_format': 'Google Docs API',
  'delete_content_range': 'Google Docs API',
  'merge_table_cells': 'Google Docs API',
  'unmerge_table_cells': 'Google Docs API',
  'find_and_replace': 'Google Docs API',
  'replace_all_text': 'Google Docs API',
  'export_document': 'Google Docs API',

  // Slides
  'slides_': 'Google Slides API',
  'create_presentation': 'Google Slides API',
  'get_presentation': 'Google Slides API',
  'delete_presentation': 'Google Slides API',
  'list_presentation_slides': 'Google Slides API',
  'add_slide': 'Google Slides API',
  'delete_slide': 'Google Slides API',
  'duplicate_slide': 'Google Slides API',
  'move_slide': 'Google Slides API',
  'get_slide': 'Google Slides API',
  'create_shape': 'Google Slides API',
  'create_text_box': 'Google Slides API',
  'create_image': 'Google Slides API',
  'create_line': 'Google Slides API',
  'delete_element': 'Google Slides API',
  'group_elements': 'Google Slides API',
  'ungroup_elements': 'Google Slides API',
  'update_text_style': 'Google Slides API',
  'update_table_cell_properties': 'Google Slides API',
  'update_element_properties': 'Google Slides API',
  'align_elements': 'Google Slides API',
  'distribute_elements': 'Google Slides API',
  'bring_to_front': 'Google Slides API',
  'send_to_back': 'Google Slides API',
  'update_shape_fill': 'Google Slides API',
  'update_shape_border': 'Google Slides API',
  'update_shape_shadow': 'Google Slides API',
  'create_from_template': 'Google Slides API',
  'replace_image': 'Google Slides API',
  'refresh_sheets_chart': 'Google Slides API',
  'export_presentation': 'Google Slides API',
  'set_slide_notes': 'Google Slides API',
  'get_slide_notes': 'Google Slides API',

  // Classroom
  'classroom_': 'Google Classroom API',
  'list_courses': 'Google Classroom API',
  'get_course': 'Google Classroom API',
  'create_course': 'Google Classroom API',
  'update_course': 'Google Classroom API',
  'delete_course': 'Google Classroom API',
  'update_course_state': 'Google Classroom API',
  'list_announcements': 'Google Classroom API',
  'get_announcement': 'Google Classroom API',
  'create_announcement': 'Google Classroom API',
  'update_announcement': 'Google Classroom API',
  'delete_announcement': 'Google Classroom API',
  'list_coursework': 'Google Classroom API',
  'get_coursework': 'Google Classroom API',
  'create_coursework': 'Google Classroom API',
  'update_coursework': 'Google Classroom API',
  'delete_coursework': 'Google Classroom API',
  'list_student_submissions': 'Google Classroom API',
  'get_student_submission': 'Google Classroom API',
  'submit_student_submission': 'Google Classroom API',
  'unsubmit_student_submission': 'Google Classroom API',
  'add_student_submission_attachment': 'Google Classroom API',
  'modify_attachments': 'Google Classroom API',
  'return_student_submission': 'Google Classroom API',
  'reclaim_student_submission': 'Google Classroom API',
  'grade_student_submission': 'Google Classroom API',
  'list_topics': 'Google Classroom API',
  'create_topic': 'Google Classroom API',
  'update_topic': 'Google Classroom API',
  'delete_topic': 'Google Classroom API',
  'list_invitations': 'Google Classroom API',
  'create_invitation': 'Google Classroom API',
  'accept_invitation': 'Google Classroom API',
  'delete_invitation': 'Google Classroom API',
  'list_students': 'Google Classroom API',
  'enroll_student': 'Google Classroom API',
  'remove_student': 'Google Classroom API',
  'list_teachers': 'Google Classroom API',
  'add_teacher': 'Google Classroom API',
  'remove_teacher': 'Google Classroom API',
  'list_course_materials': 'Google Classroom API',
  'get_course_material': 'Google Classroom API',
  'list_guardians': 'Google Classroom API',
  'get_guardian': 'Google Classroom API',
  'create_guardian': 'Google Classroom API',
  'delete_guardian': 'Google Classroom API',

  // Meet
  'meet_': 'Google Meet API',
  'create_meeting_space': 'Google Meet API',
  'get_meeting_space': 'Google Meet API',
  'list_meetings': 'Google Meet API',
  'delete_meeting_space': 'Google Meet API',
  'get_meeting_participants': 'Google Meet API',
  'list_meeting_records': 'Google Meet API',
  'get_meeting_record': 'Google Meet API',
  'get_meeting_recording': 'Google Meet API',
  'get_meeting_transcript': 'Google Meet API',
  'create_meeting_event': 'Google Meet API',
  'get_meeting_from_event': 'Google Meet API',
  'update_meeting_access': 'Google Meet API',

  // Labels
  'label_': 'Google Drive Labels API',
  'drive_label': 'Google Drive Labels API',
  'list_drive_labels': 'Google Drive Labels API',
  'get_drive_label': 'Google Drive Labels API',
  'create_drive_label': 'Google Drive Labels API',
  'update_drive_label': 'Google Drive Labels API',
  'delete_drive_label': 'Google Drive Labels API',
  'disable_drive_label': 'Google Drive Labels API',
  'enable_drive_label': 'Google Drive Labels API',
  'add_label_field': 'Google Drive Labels API',
  'update_label_field': 'Google Drive Labels API',
  'delete_label_field': 'Google Drive Labels API',
  'add_label_field_option': 'Google Drive Labels API',
  'update_label_field_option': 'Google Drive Labels API',
  'delete_label_field_option': 'Google Drive Labels API',
  'reorder_label_field_options': 'Google Drive Labels API',
  'apply_label_to_file': 'Google Drive Labels API',
  'remove_label_from_file': 'Google Drive Labels API',
  'update_label_values_on_file': 'Google Drive Labels API',
  'list_file_labels': 'Google Drive Labels API',
  'get_file_label': 'Google Drive Labels API',
  'list_label_revisions': 'Google Drive Labels API',
  'get_label_revision': 'Google Drive Labels API',
  'disable_label_revision': 'Google Drive Labels API',
  'get_label_permissions': 'Google Drive Labels API',
  'update_label_permissions': 'Google Drive Labels API',
};

/**
 * Determines which API a tool belongs to based on its name.
 */
function getApiForTool(toolName: string): string | null {
  // Direct match first
  if (TOOL_TO_API[toolName]) return TOOL_TO_API[toolName];

  // Prefix match
  for (const [prefix, api] of Object.entries(TOOL_TO_API)) {
    if (prefix.endsWith('_') && toolName.startsWith(prefix)) return api;
  }

  return null;
}

/**
 * Wraps an error from a Google API call and provides user-friendly
 * guidance when an API is not enabled.
 */
export function handleGoogleApiError(error: any, toolName?: string): McpError {
  const errorMessage = error?.message || String(error);
  const errorStr = String(error);

  // Check for API not enabled errors
  if (
    errorStr.includes('has not been used in project') ||
    errorStr.includes('accessNotConfigured') ||
    errorStr.includes('disabled') && errorStr.includes('enable') ||
    errorStr.includes('is not enabled for this project')
  ) {
    // Try to extract the API name from the error
    let apiName: string | null = null;

    for (const [pattern, name] of Object.entries(API_ENABLEMENT_MESSAGES)) {
      if (errorMessage.includes(pattern)) {
        apiName = name;
        break;
      }
    }

    // Fallback: try to identify from tool name
    if (!apiName && toolName) {
      apiName = getApiForTool(toolName);
    }

    if (apiName) {
      const dashboard = API_DASHBOARDS[apiName] || 'https://console.cloud.google.com/apis/dashboard';
      return new McpError(
        ErrorCode.InvalidParams,
        `The ${apiName} is not enabled for this Google Cloud project.\n\n` +
        `To enable it:\n` +
        `1. Go to: ${dashboard}\n` +
        `2. Click "Enable" or "Enable API"\n` +
        `3. If prompted, select or create a Google Cloud project\n` +
        `4. Ensure billing is enabled for the project\n\n` +
        `Once enabled, try the tool again.`
      );
    }
  }

  // Check for permission/scoping errors
  if (
    errorStr.includes('insufficient authentication scopes') ||
    errorStr.includes('insufficientPermissions') ||
    errorStr.includes('PERMISSION_DENIED') ||
    errorStr.includes('Request had insufficient authentication scopes')
  ) {
    const apiName = toolName ? getApiForTool(toolName) : null;
    const scopeMessage = apiName
      ? `\n\nThe ${apiName} requires the following OAuth scope. ` +
        `Please re-authenticate with the updated scopes.`
      : `\n\nPlease re-authenticate with updated scopes.`;

    return new McpError(
      ErrorCode.InvalidParams,
      `Insufficient permissions or authentication scopes.` + scopeMessage +
      `\n\nTo fix this, delete token.json and restart the server to trigger re-authentication.`
    );
  }

  // Check for quota/rate limit errors
  if (
    errorStr.includes('quotaExceeded') ||
    errorStr.includes('rateLimitExceeded') ||
    errorStr.includes('429')
  ) {
    return new McpError(
      ErrorCode.InvalidParams,
      `API quota or rate limit exceeded.\n\n` +
      `Please wait a few minutes and try again.\n` +
      `For higher quotas, visit: https://console.cloud.google.com/apis/api/${toolName ? getApiForTool(toolName)?.replace('Google ', '').replace(' API', '').toLowerCase() : 'unknown'}/quotas`
    );
  }

  // Generic API error
  return new McpError(
    ErrorCode.InternalError,
    `Google API error: ${errorMessage}`
  );
}
