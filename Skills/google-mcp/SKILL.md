---
name: google-mcp
description: "Google Workspace MCP — 279 tools across Drive, Calendar, Docs, Sheets, Slides, Forms, Classroom, Meet, and Labels. Auto-activate when user mentions ANY Google service, file, document, spreadsheet, calendar, form, presentation, classroom, meeting, or label."
risk: safe
source: "leeisfailing/google-mcp"
date_added: "2026-06-29"
---

# Google MCP — Complete Reference

279 tools covering 9 Google Workspace APIs. This is the single source of truth for all available operations.

## AUTO-ACTIVATION TRIGGERS

Activate this skill **immediately** when the user mentions:
- Google, Drive, file, folder, document, docs, Docs
- Calendar, event, meeting, schedule, appointment
- Sheet, spreadsheet, cell, formula, chart, pivot table, CSV
- Slides, presentation, slide, deck, PowerPoint
- Form, survey, quiz, question, response
- Classroom, course, assignment, submission, grade, student, teacher
- Meet, conference, video call
- Label, tag, category
- Any tool name starting with: create_, get_, list_, update_, delete_, add_, remove_, share_, export_, import_, search_, copy_, move_, batch_, find_, sort_, merge_, set_

**Do NOT ask which tool to use.** The AI should know the tool from context.

---

## TEST ALL TOOLS

To verify every tool works correctly, use the comprehensive test prompt in `TEST_PROMPT.md` at the project root. It walks through every tool in order, creating, modifying, inspecting, and cleaning up test data. Run it to collect errors and validate correctness.

---

## COMPLETE TOOL REFERENCE BY SERVICE

### Google Drive (35 tools)

| Tool | Description |
|---|---|
| `list_drive_files` | List files with query, pagination, field filtering |
| `get_drive_file` | Get file metadata by ID |
| `create_drive_file` | Upload/create file with name, mime, parents |
| `update_drive_file` | Update file metadata (name, description, parents) |
| `delete_drive_file` | Delete or trash a file |
| `copy_drive_file` | Copy a file to new location/name |
| `download_drive_file` | Get file content/download URL |
| `search_drive_files` | Full Drive query syntax search |
| `create_drive_folder` | Create folder with parent |
| `list_drive_folder_contents` | List contents of a folder |
| `move_drive_file` | Move file to different parent(s) |
| `add_drive_permission` | Add user/group/domain/anyone permission |
| `list_drive_permissions` | List all permissions on a file |
| `update_drive_permission` | Change permission role |
| `remove_drive_permission` | Remove a permission |
| `share_drive_file` | Quick share with email + role |
| `add_drive_comment` | Add comment to file |
| `list_drive_comments` | List comments on file |
| `resolve_drive_comment` | Mark comment resolved |
| `list_drive_revisions` | List file revisions |
| `get_drive_revision` | Get specific revision |
| `delete_drive_revision` | Delete a revision |
| `star_drive_file` | Star/unstar a file |
| `set_drive_file_properties` | Set custom app properties |
| `list_shared_drives` | List all shared drives |
| `get_shared_drive` | Get shared drive details |
| `create_shared_drive` | Create new shared drive |
| `delete_shared_drive` | Delete a shared drive |
| `get_drive_about` | Get storage quota, user info |
| `create_drive_shortcut` | Create shortcut to file |
| `get_drive_shortcut_target` | Get shortcut target |
| `export_drive_file` | Export Workspace file (PDF, DOCX, etc.) |
| `batch_update_drive_files` | Batch update multiple files |
| `star_drive_file` | Star/unstar a file |

---

### Google Calendar (26 tools)

| Tool | Description |
|---|---|
| `list_calendars` | List all calendars |
| `get_calendar` | Get calendar details |
| `create_calendar` | Create new calendar |
| `update_calendar` | Update summary/description |
| `delete_calendar` | Delete a calendar |
| `get_calendar_colors` | Get available colors |
| `get_calendar_settings` | Get user settings |
| `list_events` | List events with time range, query filter |
| `get_event` | Get event details |
| `create_event` | Create event with attendees, Meet link, recurrence |
| `update_event` | Update event properties |
| `delete_event` | Delete event |
| `quick_add_event` | Create from natural language |
| `move_event` | Move event to another calendar |
| `watch_events` | Set up push notifications |
| `update_recurring_event_instance` | Update single instance of recurring event |
| `delete_recurring_event_instance` | Delete single instance |
| `get_freebusy` | Query free/busy for calendars |
| `get_calendar_list_freebusy` | Free/busy for all calendars |
| `get_event_colors` | Get event color options |
| `watch_calendar_list` | Watch for calendar changes |
| `stop_channel` | Stop notification channel |
| `list_calendar_acl` | List access control rules |
| `add_calendar_acl` | Add access control rule |
| `delete_calendar_acl` | Delete access control rule |
| `import_event` | Import event from ICS |

**Event creation parameters:** summary, description, location, startDateTime, endDateTime, timeZone, attendees (array of emails), recurrence (RRULE strings), conferenceDataVersion (1 for Meet link), sendNotifications, transparency, visibility, colorId, reminders.

**Free/Busy query:** Pass `timeMin`, `timeMax`, and `items` array with calendar IDs.

---

### Google Docs (20 tools)

| Tool | Description |
|---|---|
| `docs_create_document` | Create new document |
| `docs_get_document` | Get full document structure |
| `docs_get_document_plain_text` | Get plain text only |
| `docs_delete_document` | Delete document |
| `docs_insert_text` | Insert text at index |
| `docs_insert_paragraph` | Insert paragraph with styling |
| `docs_insert_page_break` | Insert page break |
| `docs_insert_table` | Insert table with rows/columns/cell content |
| `docs_insert_image` | Insert image from URL |
| `docs_insert_bullet_list` | Insert bulleted list |
| `docs_insert_numbered_list` | Insert numbered list |
| `docs_insert_named_range` | Create named range/bookmark |
| `docs_update_paragraph_style` | Heading, alignment, indent, spacing |
| `docs_update_text_format` | Bold, italic, underline, font, size, color |
| `docs_delete_content_range` | Delete content in range |
| `docs_merge_table_cells` | Merge table cells |
| `docs_unmerge_table_cells` | Unmerge table cells |
| `docs_find_and_replace` | Find/replace with options |
| `docs_replace_all_text` | Replace all occurrences |
| `docs_export_document` | Export as PDF/DOCX/HTML/TXT |

**Document indices:** 0-based, index 0 = first position after document start. Use `endOfSegmentLocation: {}` to append at end.

---

### Google Sheets (47 tools)

| Tool | Description |
|---|---|
| `create_spreadsheet` | Create new spreadsheet |
| `delete_spreadsheet` | Delete spreadsheet |
| `get_spreadsheet` | Get spreadsheet details |
| `list_spreadsheets` | List all spreadsheets |
| `add_sheet` | Add new tab |
| `delete_sheet` | Delete a tab |
| `rename_sheet` | Rename a tab |
| `list_sheets` | List all tabs |
| `read_range` | Read cell values (A1 notation) |
| `write_range` | Write values to range |
| `append_rows` | Append rows after existing data |
| `clear_range` | Clear range content |
| `format_cells` | Apply formatting (bold, colors, borders, etc.) |
| `merge_cells` | Merge cell range |
| `run_formula` | Set a formula in a cell |
| `filter_data` | Filter/sort data |
| `create_chart` | Create chart (bar, line, pie, scatter, etc.) |
| `update_chart` | Update chart spec |
| `delete_chart` | Delete a chart |
| `list_charts` | List all charts |
| `add_conditional_format_rule` | Add conditional formatting |
| `update_conditional_format_rule` | Update a rule |
| `delete_conditional_format_rule` | Delete a rule |
| `list_conditional_format_rules` | List all rules |
| `add_data_validation` | Add data validation (list, checkbox, etc.) |
| `update_data_validation` | Update validation rule |
| `delete_data_validation` | Remove validation |
| `list_data_validations` | List all validations |
| `add_protected_range` | Protect a range |
| `update_protected_range` | Update protection settings |
| `delete_protected_range` | Remove protection |
| `list_protected_ranges` | List protected ranges |
| `add_developer_metadata` | Attach metadata |
| `get_developer_metadata` | Get metadata |
| `search_developer_metadata` | Search metadata |
| `delete_developer_metadata` | Delete metadata |
| `create_pivot_table` | Create pivot table with rows/columns/values |
| `create_named_range` | Create named range |
| `update_named_range` | Update named range |
| `delete_named_range` | Delete named range |
| `list_named_ranges` | List all named ranges |
| `update_sheet_properties` | Update tab color, hide, grid, frozen |
| `duplicate_sheet` | Duplicate a tab |
| `copy_sheet` | Copy tab to another spreadsheet |
| `move_sheet` | Move tab position |
| `update_sheet_tab_color` | Set tab color (RGB) |
| `batch_update_spreadsheet` | Execute raw batchUpdate |
| `find_replace_sheet` | Find and replace (regex support) |
| `sort_range` | Sort by columns |
| `create_filter_view` | Create filter view |
| `update_filter_view` | Update filter view |
| `delete_filter_view` | Delete filter view |
| `add_sparkline` | Add inline sparkline |
| `create_data_source` | Create connected data source |
| `list_data_sources` | List connected sources |
| `add_slicer` | Add slicer UI element |

**Range format:** `Sheet1!A1:C3` or `A1:Z100` or `Sheet1!A:A`. `read_range` returns 2D array of values.

---

### Google Slides (34 tools)

| Tool | Description |
|---|---|
| `slides_create_presentation` | Create new presentation |
| `slides_get_presentation` | Get full presentation |
| `slides_delete_presentation` | Delete presentation |
| `slides_list_presentation_slides` | List all slides |
| `slides_add_slide` | Add slide (by layout or blank) |
| `slides_delete_slide` | Delete slide |
| `slides_duplicate_slide` | Duplicate slide |
| `slides_move_slide` | Move slide position |
| `slides_get_slide` | Get slide details |
| `slides_create_shape` | Create shape (rectangle, ellipse, etc.) |
| `slides_create_text_box` | Create text box |
| `slides_create_image` | Insert image from URL |
| `slides_create_line` | Create line/arrow |
| `slides_delete_element` | Delete element |
| `slides_group_elements` | Group elements |
| `slides_ungroup_elements` | Ungroup elements |
| `slides_insert_text` | Insert text into element |
| `slides_update_text_style` | Bold, italic, font, color |
| `slides_update_paragraph_style` | Alignment, spacing, indent |
| `slides_insert_table` | Insert table |
| `slides_update_table_cell_properties` | Cell fill, borders, padding |
| `slides_update_element_properties` | Position, size, rotation |
| `slides_align_elements` | Align (left, center, right, top, middle, bottom) |
| `slides_distribute_elements` | Distribute horizontally/vertically |
| `slides_bring_to_front` | Bring to front (z-order) |
| `slides_send_to_back` | Send to back (z-order) |
| `slides_update_shape_fill` | Solid or gradient fill |
| `slides_update_shape_border` | Border color, weight, dash |
| `slides_update_shape_shadow` | Add/remove shadow |
| `slides_create_from_template` | Copy presentation (template) |
| `slides_replace_image` | Replace image in place |
| `slides_refresh_sheets_chart` | Refresh linked chart |
| `slides_export_presentation` | Export as PDF/PPTX |
| `slides_set_slide_notes` | Set speaker notes |
| `slides_get_slide_notes` | Get speaker notes |

**Units:** Use `unit: "inches"` (default), `"points"`, or `"EMU"`. 1 inch = 914400 EMUs = 72 points.

---

### Google Forms (44 tools)

| Tool | Description |
|---|---|
| `create_form` | Create new form |
| `copy_form` | Copy an existing form |
| `delete_form` | Delete form |
| `get_form` | Get full form details |
| `get_form_metadata` | Get response count, revision |
| `update_form_settings` | Update title, description, quiz mode |
| `set_publish_settings` | Publish/unpublish, accept responses |
| `set_form_description` | Update description |
| `list_forms` | List forms from Drive |
| `add_text_question` | Short answer text |
| `add_paragraph_question` | Long answer paragraph |
| `add_multiple_choice_question` | Multiple choice with options |
| `add_checkbox_question` | Checkbox (multi-select) |
| `add_dropdown_question` | Dropdown with options |
| `add_linear_scale_question` | Linear scale (1-5, etc.) |
| `add_date_question` | Date question |
| `add_time_question` | Time question |
| `add_rating_question` | Rating (star, heart, etc.) |
| `add_file_upload_question` | File upload |
| `add_choice_grid` | Grid question (rows x columns) |
| `add_page_break` | Add page break |
| `add_section_header` | Add section header |
| `add_title_description` | Add title/description block |
| `add_image` | Add image (URL or Drive) |
| `add_video` | Add YouTube video |
| `update_question` | Update question text/options |
| `delete_question` | Delete a question |
| `reorder_items` | Reorder form items |
| `set_question_grading` | Set point value + correct answer |
| `add_question_validation` | Add regex/number/text validation |
| `add_question_option` | Add option to question |
| `remove_question_option` | Remove option |
| `shuffle_question_options` | Enable/disable shuffling |
| `set_question_required` | Set required/optional |
| `set_question_description` | Add helper text |
| `get_form_responses` | Get all responses |
| `get_responses_sheet` | Get linked spreadsheet URL |
| `get_form_responses_analytics` | Quiz analytics + statistics |
| `delete_all_responses` | Delete all responses |
| `delete_response` | Delete specific response |
| `share_form` | Share form with email |
| `get_form_url` | Get view/edit/create URLs |
| `watch_form_responses` | Poll for new responses |
| `move_item` | Move question position |

**Question options:** `options: ["Red", "Blue", "Green"]` for choice questions. Use `required: true/false`.

---

### Google Classroom (45 tools)

| Tool | Description |
|---|---|
| `list_courses` | List courses (teacher/student filter) |
| `get_course` | Get course details |
| `create_course` | Create new course |
| `update_course` | Update course properties |
| `delete_course` | Delete/archive course |
| `update_course_state` | ACTIVE, ARCHIVED, PROVISIONED |
| `list_announcements` | List announcements |
| `get_announcement` | Get announcement details |
| `create_announcement` | Create announcement |
| `update_announcement` | Update announcement |
| `delete_announcement` | Delete announcement |
| `list_coursework` | List coursework items |
| `get_coursework` | Get coursework details |
| `create_coursework` | Create assignment/quiz/material |
| `update_coursework` | Update coursework |
| `delete_coursework` | Delete coursework |
| `list_student_submissions` | List submissions |
| `get_student_submission` | Get submission details |
| `submit_student_submission` | Turn in submission |
| `unsubmit_student_submission` | Unsubmit (return to NEW) |
| `add_student_submission_attachment` | Add attachment |
| `modify_attachments` | Modify attachments |
| `return_student_submission` | Return to student with grade |
| `reclaim_student_submission` | Teacher reclaims |
| `grade_student_submission` | Set assigned/draft grade |
| `list_topics` | List topics |
| `create_topic` | Create topic |
| `update_topic` | Update topic name |
| `delete_topic` | Delete topic |
| `list_invitations` | List pending invitations |
| `create_invitation` | Invite student/teacher |
| `accept_invitation` | Accept invitation |
| `delete_invitation` | Revoke invitation |
| `list_students` | List students in course |
| `enroll_student` | Enroll student |
| `remove_student` | Remove student |
| `list_teachers` | List teachers |
| `add_teacher` | Add teacher |
| `remove_teacher` | Remove teacher |
| `list_course_materials` | List materials |
| `get_course_material` | Get material details |
| `list_guardians` | List guardian relationships |
| `get_guardian` | Get guardian details |
| `create_guardian` | Create guardian link |
| `delete_guardian` | Remove guardian |

**Course states:** `ACTIVE`, `ARCHIVED`, `PROVISIONED`, `DECLINED`
**Submission states:** `NEW`, `CREATED`, `TURNED_IN`, `RETURNED`, `RECLAIMED_BY_STUDENT`
**Roles:** `STUDENT`, `TEACHER`

---

### Google Meet (12 tools)

| Tool | Description |
|---|---|
| `create_meeting_space` | Create Meet conference |
| `get_meeting_space` | Get conference details |
| `list_meetings` | List meetings from Calendar |
| `delete_meeting_space` | End/delete conference |
| `get_meeting_participants` | List participants |
| `list_meeting_records` | List recordings/transcripts |
| `get_meeting_record` | Get meeting record |
| `get_meeting_recording` | Get recording info |
| `get_meeting_transcript` | Get transcript info |
| `create_meeting_event` | Create calendar event + Meet link |
| `get_meeting_from_event` | Extract Meet from calendar event |
| `update_meeting_access` | Modify access type (OPEN, TRUSTED, RESTRICTED) |

---

### Google Drive Labels (24 tools)

| Tool | Description |
|---|---|
| `list_drive_labels` | List all labels |
| `get_drive_label` | Get label details |
| `create_drive_label` | Create new label |
| `update_drive_label` | Update label (title, state) |
| `delete_drive_label` | Delete label |
| `disable_drive_label` | Disable label (read-only) |
| `enable_drive_label` | Enable label |
| `add_label_field` | Add field (TEXT, INT, SELECTION, DATE, USER, EMAIL) |
| `update_label_field` | Update field properties |
| `delete_label_field` | Remove field |
| `add_label_field_option` | Add selection option |
| `update_label_field_option` | Update option |
| `delete_label_field_option` | Delete option |
| `reorder_label_field_options` | Reorder options |
| `apply_label_to_file` | Apply label with field values to file |
| `remove_label_from_file` | Remove label from file |
| `update_label_values_on_file` | Update applied label values |
| `list_file_labels` | List labels on file |
| `get_file_label` | Get specific label on file |
| `list_label_revisions` | List label definition revisions |
| `get_label_revision` | Get specific revision |
| `disable_label_revision` | Disable revision |
| `get_label_permissions` | Get who can use label |
| `update_label_permissions` | Update permissions |

**Field types:** `TEXT` (string), `INTEGER` (number), `SELECTION` (options), `DATE` (year/month/day), `USER` (user email), `EMAIL` (email address).

---

## QUICK WORKFLOWS

### Share a file
```
share_drive_file { fileId: "xxx", email: "user@example.com", role: "writer" }
```

### Create event with Meet link
```
create_event {
  summary: "Team Sync",
  startDateTime: "2026-06-30T10:00:00Z",
  endDateTime: "2026-06-30T10:30:00Z",
  timeZone: "America/New_York",
  attendees: ["alice@example.com"],
  conferenceDataVersion: 1
}
```

### Write to spreadsheet
```
write_range {
  spreadsheetId: "xxx",
  range: "Sheet1!A1:C3",
  values: [["Name","Score"],["Alice","95"],["Bob","87"]]
}
```

### Create doc with content
```
docs_create_document { title: "Report" }
→ docs_insert_text { documentId: "...", text: "Introduction\n", index: 0 }
→ docs_insert_table { documentId: "...", rows: 3, columns: 2 }
```

### Build a form
```
create_form { title: "Feedback" }
→ add_text_question { formId: "...", title: "Name", required: true }
→ add_multiple_choice_question { formId: "...", title: "Rating", options: ["Excellent","Good","Fair"] }
```

### Course + assignment
```
create_course { name: "Math 101", section: "Fall 2026" }
→ create_coursework { courseId: "...", title: "HW 1", workType: "ASSIGNMENT", maxPoints: 100 }
```

### Apply label to file
```
apply_label_to_file {
  fileId: "xxx",
  labelId: "yyy",
  fieldValues: { "field1": "Approved", "field2": "2026-06-29" }
}
```

---

## AUTH & ERRORS

- **Authentication is automatic.** The server handles OAuth2 token refresh.
- If you get an auth error, tell the user to delete `token.json` and restart.
- If an API returns "not enabled", provide the enable link:
  `https://console.cloud.google.com/apis/library/{api-name}`
- The installer (`CPP/installer.exe`) handles skill installation automatically.

---

## PERFORMANCE

- Use `pageToken` for paginated results (don't fetch everything at once)
- Use `fields` parameter to request only needed data
- Cache IDs — once you get a spreadsheetId/fileId/courseId, reuse it
- For date ranges, always specify both `timeMin`/`timeMax`
- Use `singleEvents: true` in `list_events` to expand recurring events
- Batch operations where possible (sheets `batch_update_spreadsheet`, docs `docs_*` tools)
