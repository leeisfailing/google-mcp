# Google Forms & Sheets MCP Server

A Model Context Protocol (MCP) server for Google Forms and Google Sheets. Create, manage, and automate Google Forms and Spreadsheets with 50 tools.

## Features

- Create, copy, and delete Google Forms
- Add 11 question types (text, paragraph, multiple choice, checkbox, dropdown, linear scale, date, time, rating, choice grid, file upload)
- **Multi-section support** with `section` parameter on all content-adding tools
- Set quiz grading with correct answers, point values, and feedback
- Add page breaks, section headers, titles, images, and videos
- Get form items with section breakdown, metadata, responses, and analytics
- Share forms with specific people via email
- List all your Google Forms
- Secure credential storage (no secrets in config files)
- **Full Google Sheets support** — create, read, write, format spreadsheets, manage tabs, run formulas, and filter data  

## Prerequisites

- Node.js 18+ installed
- A Google account

## Quick Setup

### 1. Install

```bash
git clone https://github.com/matteoantoci/google-forms-mcp.git
cd google-forms-mcp
npm install
npm run build
```

### 2. Get Google API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Google Forms MCP")
3. Enable these APIs:
   - [Google Forms API](https://console.cloud.google.com/apis/library/forms.googleapis.com)
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
4. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
5. Click "Create Credentials" > "OAuth client ID"
6. Configure OAuth consent screen if prompted:
   - Select "External" user type
   - Fill in app name (e.g., "Google Forms MCP")
   - Add your email as developer contact
   - Save and continue through the steps
7. Select "Desktop app" as application type
8. Name it and click "Create"
9. Click the download icon to download `credentials.json`

### 3. Place Credentials

Copy the downloaded JSON file and rename it to `key.json` in the project root:

```
google-forms-mcp/
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

After this, `token.json` is saved and you never need to authenticate again.

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
    "google-forms-mcp": {
      "command": "node",
      "args": ["C:\\Users\\You\\Desktop\\google-forms-mcp\\build\\index.js"]
    }
  }
}
```

#### OpenCode

**Config file location:** `~/.config/opencode/opencode.jsonc`

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "google-forms-mcp": {
      "type": "local",
      "command": ["node", "/absolute/path/to/google-forms-mcp/build/index.js"]
    }
  }
}
```

#### Kilo Code

**Config file location:** `~/.config/kilo/kilo.jsonc`

```jsonc
{
  "mcp": {
    "google-forms-mcp": {
      "type": "local",
      "command": ["node", "/absolute/path/to/google-forms-mcp/build/index.js"]
    }
  }
}
```

#### Cline / Roo Code

**Config file location:** `~/.cline/mcp_settings.json` or `~/.roo/mcp_settings.json`

```json
{
  "mcpServers": {
    "google-forms-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/google-forms-mcp/build/index.js"]
    }
  }
}
```

#### Cursor

**Config file location:** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "google-forms-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/google-forms-mcp/build/index.js"]
    }
  }
}
```

### 6. Restart Your AI Client

Restart Claude Desktop / OpenCode / Kilo Code / Cline for the MCP to load.

## Project Structure

```
google-forms-mcp/
  key.json           # Your Google OAuth client credentials (keep secret)
  token.json         # Auto-generated refresh token (keep secret)
  .gitignore         # Prevents secrets from being committed
  src/
    index.ts         # MCP server
    test-oauth.ts    # OAuth token test utility
  build/             # Compiled output
```

## Available Tools (48)

### Form Management

| Tool | Description |
|------|-------------|
| `create_form` | Create a new Google Form with title and optional description |
| `copy_form` | Create a deep copy of an existing form including all items and sections |
| `delete_form` | Delete a Google Form (requires Google Drive API enabled) |
| `get_form` | Get full form structure and details |
| `get_form_metadata` | Get form metadata including response count and settings |
| `update_form_settings` | Configure quiz mode, collect emails, title, description |
| `set_publish_settings` | Publish/unpublish form, accept/reject responses |
| `set_form_description` | Set or update the form description |
| `list_forms` | List all Google Forms you have access to |
| `share_form` | Share a form with specific people via email |

### Question Types

All question tools accept an optional `section` parameter (1-indexed) to place the question in a specific section. Without `section`, items are appended to the last section.

| Tool | Description |
|------|-------------|
| `add_text_question` | Add a short text answer question |
| `add_paragraph_question` | Add a long text (paragraph) answer question |
| `add_multiple_choice_question` | Add a multiple choice question (single answer) |
| `add_checkbox_question` | Add a checkbox question (multiple answers allowed) |
| `add_dropdown_question` | Add a dropdown selection question |
| `add_linear_scale_question` | Add a linear scale question (e.g., 1-5 rating) |
| `add_date_question` | Add a date picker question |
| `add_time_question` | Add a time picker question |
| `add_rating_question` | Add a star/heart/thumbs-up rating question (3-10 scale) |
| `add_choice_grid` | Add a multiple choice grid (rows x columns) |

### Question Management

| Tool | Description |
|------|-------------|
| `get_form_items` | Get all items with IDs, types, and section assignments |
| `update_question` | Update question title, required status, or choices |
| `delete_question` | Delete a question from the form |
| `reorder_items` | Move a question to a different position in the form |

### Quiz Features

| Tool | Description |
|------|-------------|
| `set_question_grading` | Set correct answers, point values, and feedback for graded questions |

### Content

All content tools accept an optional `section` parameter to place items in a specific section.

| Tool | Description |
|------|-------------|
| `add_title_description` | Add a title and description text block |
| `add_section_header` | Add a description/text block within a section |
| `add_page_break` | Add a section break (creates a new section boundary) |
| `add_image` | Add an image from a public URL |
| `add_video` | Add a YouTube video with optional caption |

### Responses & Analytics

| Tool | Description |
|------|-------------|
| `get_form_responses` | Get all form responses |
| `get_responses_sheet` | Read responses from the linked Google Sheet |
| `get_form_responses_analytics` | Get structured response data with question mapping and scores |

### Google Sheets — Spreadsheet Management

| Tool | Description |
|------|-------------|
| `create_spreadsheet` | Create a new Google Spreadsheet |
| `delete_spreadsheet` | Delete a Google Spreadsheet |
| `get_spreadsheet` | Get spreadsheet metadata including sheet/tab list |
| `list_spreadsheets` | List Google Spreadsheets accessible to the user |

### Google Sheets — Tab Management

| Tool | Description |
|------|-------------|
| `add_sheet` | Add a new sheet/tab to a spreadsheet |
| `delete_sheet` | Delete a sheet/tab from a spreadsheet |
| `rename_sheet` | Rename a sheet/tab in a spreadsheet |
| `list_sheets` | List all sheets/tabs in a spreadsheet |

### Google Sheets — Cell & Range Operations

| Tool | Description |
|------|-------------|
| `read_range` | Read cell values from a range using A1 notation |
| `write_range` | Write values to a range (overwrites existing data) |
| `append_rows` | Append rows to the end of a range |
| `clear_range` | Clear values in a range (keeps formatting) |

### Google Sheets — Formatting

| Tool | Description |
|------|-------------|
| `format_cells` | Apply formatting (bold, colors, alignment, font) to a range |
| `merge_cells` | Merge a range of cells |

### Google Sheets — Formulas & Queries

| Tool | Description |
|------|-------------|
| `run_formula` | Execute a Google Sheets formula (FILTER, QUERY, VLOOKUP, SUMIF, etc.) and return the computed results |
| `filter_sheet` | Filter spreadsheet rows by conditions (equals, contains, greater_than, etc.) — builds FILTER formulas behind the scenes |

## Multi-Section Support

The `section` parameter on question and content tools lets you place items in specific sections. Sections are created by `add_page_break`.

### How It Works

1. Create a form
2. Add questions (they go to section 1 by default)
3. Call `add_page_break` to create section 2
4. Add more questions with `section: 2` to target section 2
5. Call `get_form_items` to see which section each item belongs to

### Example: Two-Section Form

```
1. create_form with title "Survey"
2. add_text_question with questionTitle "Name", section omitted (goes to section 1)
3. add_page_break with title "Part 2"
4. add_multiple_choice_question with questionTitle "Rating", options ["1","2","3"], section: 2
5. get_form_items - verify items are in correct sections
```

### Section Numbering

- Sections are 1-indexed (section 1, section 2, etc.)
- If `section` exceeds the total number of sections, the item appends to the last section
- If `section` is omitted, the item appends to the last section
- `get_form_items` returns `totalSections` and a `sections` array with start indices

## Usage Examples

### Create a Simple Form

```
Create a contact form with:
- Name (text, required)
- Email (text, required)
- Message (paragraph, required)
- How did you find us? (dropdown: Google, Social Media, Friend, Other)
```

### Create a Multi-Section Quiz

```
Create a JavaScript quiz with:
- Title: "JavaScript Basics Quiz"
- Enable quiz mode
- Section 1: "Fundamentals"
  - What is 2 + 2? (multiple choice: 3, 4, 5, 6 - correct: 4, 10 points)
  - Which are JS data types? (checkbox: String, Number, Boolean, Python - correct: String, Number, Boolean, 10 points)
- Section 2: "Advanced"
  - Explain closures (paragraph)
  - Rate this quiz (rating, 1-5 stars)
```

### Create a Survey with Sections

```
Create a customer feedback form with 3 sections:
- Section 1 "About You": Name (text), Email (text)
- Section 2 "Experience": Satisfaction (linear scale 1-5), Date of visit (date)
- Section 3 "Feedback": Comments (paragraph), Would recommend? (multiple choice: Yes/No)
```

## Troubleshooting

### "Server disconnected" error

- Check that the path to `build/index.js` is correct in your config
- Check that Node.js is installed and in your PATH

### "Google Forms API has not been used" error

Enable the Forms API at: https://console.cloud.google.com/apis/library/forms.googleapis.com

### "Google Drive API has not been used" error

Enable the Drive API at: https://console.cloud.google.com/apis/library/drive.googleapis.com

### "No key.json found" error

Place your downloaded Google credentials file as `key.json` in the project root.

### "Authentication failed" error

Delete `token.json` and run `npm start` again to re-authenticate.

### Questions go to wrong section

Use `get_form_items` to check section numbering. The `section` parameter is 1-indexed. If you specify a section number that doesn't exist, items append to the last section.

## License

MIT
