# Google MCP Server

A Model Context Protocol (MCP) server for Google Workspace. **330 tools** covering Drive, Calendar, Docs, Sheets, Slides, Forms, Classroom, Meet, Drive Labels, and Gmail — all through a single, secure MCP server.

## Features

- **330 tools** across 10 Google Workspace APIs
- **Automatic OAuth2 re-authentication** — browser opens when tokens expire
- **Auto-updates** from GitHub on every startup
- **Claude skill installation** — tools are instantly available in Claude
- Secure credential storage (no secrets in config files)
- Works with Claude Desktop, OpenCode, Kilo Code, Cline, and Cursor

## Supported APIs

| API | Tools | Key Capabilities |
|-----|-------|------------------|
| Google Drive | 33 | Files, folders, permissions, sharing, comments, revisions, shared drives |
| Google Calendar | 26 | Events, calendars, free/busy, recurring events, ACL, ICS import |
| Google Docs | 20 | Create, edit, format, tables, images, lists, find/replace, export |
| Google Sheets | 56 | Cells, formulas, charts, pivot tables, validation, protection, metadata, sparklines, slicers |
| Google Slides | 35 | Presentations, slides, shapes, text, images, alignment, styling |
| Google Forms | 44 | All question types, quizzes, sections, responses, analytics |
| Google Classroom | 45 | Courses, assignments, submissions, grades, rosters, guardians |
| Google Meet | 12 | Conferences, recordings, transcripts, Calendar integration |
| Google Drive Labels | 24 | Labels, fields, options, application, revisions, permissions |
| Gmail | 33 | Messages, drafts, labels, threads, attachments, filters, auto-reply |

## Prerequisites

- Node.js 18+ installed
- Claude Desktop installed (or another MCP-compatible client)
- A Google account

## Quick Setup

### Option A: Windows Installer (Recommended)

**One-click install for Windows.** The installer handles everything automatically:

1. Place `key.json` in the project root (see "Get Google API Credentials" below)
2. Double-click `CPP/installer.exe`
3. The installer will:
   - Check that Node.js and Claude Desktop are installed
   - Run `npm install` and `npm run build`
   - Guide you through Google OAuth (opens browser)
   - Configure Claude Desktop automatically
   - Install all skills for Claude
4. Claude Desktop opens — you're ready to go

**Auto-Updates:** Once installed, the MCP server checks for updates from GitHub every time Claude Desktop starts. If a new version is available, it pulls the latest code and rebuilds automatically in the background. No manual updates needed.

**Drag-and-drop support:** You can also drag `key.json` directly onto `installer.exe`.

### Option B: Manual Setup

#### 1. Install

```bash
git clone https://github.com/leeisfailing/google-mcp.git
cd google-mcp
npm install
npm run build
```

### 2. Get Google API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Google MCP")
3. Enable these APIs:
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   - [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)
   - [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com)
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
   - [Google Slides API](https://console.cloud.google.com/apis/library/slides.googleapis.com)
   - [Google Forms API](https://console.cloud.google.com/apis/library/forms.googleapis.com)
   - [Google Classroom API](https://console.cloud.google.com/apis/library/classroom.googleapis.com)
   - [Google Meet API](https://console.cloud.google.com/apis/library/meet.googleapis.com)
   - [Google Drive Labels API](https://console.cloud.google.com/apis/library/drivelabels.googleapis.com)
   - [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
4. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
5. Click "Create Credentials" > "OAuth client ID"
6. Configure OAuth consent screen if prompted:
   - Select "External" user type
   - Fill in app name (e.g., "Google MCP")
   - Add your email as developer contact
   - Save and continue through the steps
7. Select "Desktop app" as application type
8. Name it and click "Create"
9. Click the download icon to download `credentials.json`

### 3. Place Credentials

Copy the downloaded JSON file and rename it to `key.json` in the project root:

```
google-mcp/
  key.json           <-- rename your downloaded file to this
  src/
  package.json
  ...
```

### 4. First Run (One-Time OAuth)

```bash
npm start
```

On first run, the server will:
1. Detect `key.json` and load your client ID/secret
2. Detect no `token.json` exists
3. Open your browser for Google OAuth consent
4. Save the refresh token to `token.json` automatically

After this, `token.json` is saved and you never need to authenticate again. If tokens expire, the server automatically opens the browser for re-authentication.

### 5. Configure Your AI Client

**No secrets in your config!** The server reads from files automatically.

#### Claude Desktop

**Config file locations:**
- Windows: `C:\Users\User\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "google-mcp": {
      "command": "node",
      "args": ["C:\\Users\\You\\Desktop\\google-mcp\\auto-update.js"]
    }
  }
}
```

> **Note:** Claude Desktop uses `auto-update.js` which automatically checks for updates from GitHub on startup and installs skills.

#### OpenCode

**Config file location:** `~/.config/opencode/opencode.jsonc`

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "google-mcp": {
      "type": "local",
      "command": ["node", "/absolute/path/to/google-mcp/build/index.js"]
    }
  }
}
```

#### Kilo Code

**Config file location:** `~/.config/kilo/kilo.jsonc`

```jsonc
{
  "mcp": {
    "google-mcp": {
      "type": "local",
      "command": ["node", "/absolute/path/to/google-mcp/build/index.js"]
    }
  }
}
```

#### Cline / Roo Code

**Config file location:** `~/.cline/mcp_settings.json` or `~/.roo/mcp_settings.json`

```json
{
  "mcpServers": {
    "google-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/google-mcp/build/index.js"]
    }
  }
}
```

#### Cursor

**Config file location:** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "google-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/google-mcp/build/index.js"]
    }
  }
}
```

### 6. Restart Your AI Client

Restart Claude Desktop / OpenCode / Kilo Code / Cline for the MCP to load.

## Project Structure

```
google-mcp/
  key.json           # Your Google OAuth client credentials (keep secret)
  token.json         # Auto-generated refresh token (keep secret)
  auto-update.js     # Auto-update wrapper for Claude Desktop
  .gitignore         # Prevents secrets from being committed
  src/
    index.ts         # MCP server with modular architecture
    test-oauth.ts    # OAuth token test utility
    services/
      drive.ts       # Google Drive API (33 tools)
      calendar.ts    # Google Calendar API (26 tools)
      docs.ts        # Google Docs API (20 tools)
      sheets.ts      # Google Sheets API (56 tools)
      slides.ts      # Google Slides API (35 tools)
      forms.ts       # Google Forms API (44 tools)
      classroom.ts   # Google Classroom API (45 tools)
      meet.ts        # Google Meet API (12 tools)
      labels.ts      # Google Drive Labels API (24 tools)
      gmail.ts       # Gmail API (33 tools)
      api-utils.ts   # API error handling and enablement guidance
  skills/
    google-mcp/
      SKILL.md       # Claude skill with all 330 tools
  CPP/
    installer.cpp    # Windows installer source
    build.bat        # Build script for installer
  build/             # Compiled output
```

## Available Tools (330)

### Google Drive (33 tools)

| Tool | Description |
|------|-------------|
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

### Google Calendar (26 tools)

| Tool | Description |
|------|-------------|
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

### Google Docs (20 tools)

| Tool | Description |
|------|-------------|
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

### Google Sheets (56 tools)

| Tool | Description |
|------|-------------|
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

### Google Slides (35 tools)

| Tool | Description |
|------|-------------|
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

### Google Forms (44 tools)

| Tool | Description |
|------|-------------|
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

### Google Classroom (45 tools)

| Tool | Description |
|------|-------------|
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

### Google Meet (12 tools)

| Tool | Description |
|------|-------------|
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

### Google Drive Labels (24 tools)

| Tool | Description |
|------|-------------|
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

### Gmail (33 tools)

| Tool | Description |
|------|-------------|
| `list_messages` | List messages with query, labels, pagination |
| `get_message` | Get full message with headers, body, metadata |
| `get_message_raw` | Get raw MIME content of a message |
| `send_message` | Send email (structured or raw MIME) with attachments |
| `reply_to_message` | Reply to a message (auto-sets In-Reply-To, Re: prefix) |
| `forward_message` | Forward a message with optional prepended text |
| `trash_message` | Move message to trash |
| `untrash_message` | Remove message from trash |
| `delete_message` | Permanently delete (bypasses trash) |
| `modify_message` | Add/remove labels from a message |
| `batch_modify_messages` | Modify labels on multiple messages at once |
| `batch_delete_messages` | Permanently delete multiple messages |
| `list_drafts` | List drafts |
| `get_draft` | Get a specific draft |
| `create_draft` | Create new draft (structured or raw MIME) |
| `update_draft` | Update existing draft |
| `delete_draft` | Delete a draft |
| `send_draft` | Send an existing draft |
| `list_labels` | List all Gmail labels |
| `get_label` | Get a specific label |
| `create_label` | Create new label (supports nested "/" names) |
| `update_label` | Update label name/color/visibility |
| `delete_label` | Delete a label (messages are preserved) |
| `list_threads` | List threads with query/pagination |
| `get_thread` | Get a thread with all messages |
| `trash_thread` | Move thread to trash |
| `untrash_thread` | Remove thread from trash |
| `delete_thread` | Permanently delete thread |
| `modify_thread` | Add/remove labels from thread |
| `get_attachment` | Download message attachment (base64url) |
| `list_filters` | List mail filters |
| `create_filter` | Create filter (auto-label, archive, forward, delete, etc.) |
| `delete_filter` | Delete a filter |
| `get_auto_reply` | Get vacation responder settings |
| `set_auto_reply` | Enable/disable vacation responder |

**Gmail search queries:** Use standard Gmail search syntax: `from:user@example.com`, `subject:hello`, `is:unread`, `after:2026/01/01`, `has:attachment`, `label:important`.

## Quick Workflows

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

## Troubleshooting

### "Server disconnected" error
- Check that the path to `build/index.js` is correct in your config
- Check that Node.js is installed and in your PATH

### "Google API has not been used" error
Enable the required API at: `https://console.cloud.google.com/apis/library/{api-name}`

The installer will guide you through enabling all required APIs.

### "No key.json found" error
Place your downloaded Google credentials file as `key.json` in the project root.

### "Authentication failed" error
The server automatically handles re-authentication. If it fails:
1. Delete `token.json`
2. Run `npm start` or restart Claude Desktop

### Token expired / revoked
The server automatically detects expired tokens and opens the browser for re-authentication. No manual intervention needed.

## License

MIT
