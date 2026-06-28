# Google MCP - Comprehensive Test Prompt

Copy and paste the prompt below into a new Claude conversation with the Google MCP server connected. It tests every tool in order, including multi-section support, grading, analytics, and error handling.

---

## Test Prompt

```
I need you to thoroughly test every Google MCP tool by creating, modifying, inspecting, and cleaning up a test form. Follow these steps IN ORDER. At each step, report the result (success/failure) and any issues. At the end, summarize what worked and what didn't.

**STEP 1 - Create a form**
Create a new Google Form with title "MCP Test Form" and description "Automated test of all MCP tools".

**STEP 2 - Add questions to section 1 (default section)**
Add these 5 questions to the form (no section param - should go to last section):
1. add_text_question: title "What is your name?", required
2. add_paragraph_question: title "Tell us about yourself", required
3. add_multiple_choice_question: title "Favorite color?", options: ["Red", "Blue", "Green", "Yellow"]
4. add_checkbox_question: title "Which languages do you speak?", options: ["English", "Spanish", "French", "German"]
5. add_dropdown_question: title "Country?", options: ["USA", "Canada", "UK", "Australia"]

**STEP 3 - Create a second section**
Add a page break with title "Section 2: Details" and description "Please answer the following".

**STEP 4 - Add questions to section 2**
Add these questions with section: 2:
1. add_linear_scale_question: title "How satisfied are you?", low: 1, high: 5, lowLabel "Not happy", highLabel "Very happy"
2. add_date_question: title "When is your birthday?"
3. add_time_question: title "What time works best?", duration: true
4. add_rating_question: title "Rate our service", ratingScaleLevel: 7, iconType: "HEART"

**STEP 5 - Add content to section 1**
Add a title_description with title "Important" and description "Answer carefully" with section: 1.

**STEP 6 - Add media to section 2**
1. add_image: title "Test Image", imageUrl "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png" with section: 2
2. add_video: title "Test Video", videoUrl "https://www.youtube.com/watch?v=dQw4w9WgXcQ", caption "Never gonna give you up" with section: 2

**STEP 7 - Verify sections with get_form_items**
Call get_form_items and verify:
- Total sections is 2
- Each item has a section field (1 or 2)
- Questions added with section: 1 are in section 1
- Questions added with section: 2 are in section 2
- The page break item is listed with type "page_break"

**STEP 8 - Test question updates**
1. update_question: change the text question title to "What is your full name?"
2. Use get_form_items to verify the title changed

**STEP 9 - Test grading**
1. set_question_grading on the multiple choice question: 10 points, correct answer "Blue", feedbackCorrect "Correct!", feedbackIncorrect "Try again"
2. set_question_grading on the text question: 5 points, feedbackCorrect "Good job"
3. Try set_question_grading on the paragraph question - should FAIL with an error about unsupported question type

**STEP 10 - Test error handling**
1. add_text_question with an invalid formId - should fail gracefully
2. add_rating_question with ratingScaleLevel: 1 - should fail (must be 3-10)
3. add_rating_question with ratingScaleLevel: 100 - should fail
4. add_section_header with no title and no description - should fail
5. add_text_question with section: 99 (nonexistent section) - should still append to end

**STEP 11 - Test reorder**
Use reorder_items to move the dropdown question to position 0 (top of form). Then use get_form_items to verify it moved.

**STEP 12 - Test form settings**
1. update_form_settings: set isQuiz: true AND collectEmails: true in one call
2. get_form and verify quizSettings and emailCollectionType were updated

**STEP 13 - Test publish settings**
1. set_publish_settings: isPublished: true
2. set_form_description: set to "Updated description for testing"

**STEP 14 - Test list and metadata**
1. get_form_metadata: verify response count and form details
2. list_forms: verify the test form appears in the list
3. get_form_responses: should return empty (no responses yet)

**STEP 15 - Test copy**
1. copy_form: copy the test form with newTitle "MCP Test Form (Copy)"
2. get_form_items on the copied form - verify all items including sections were copied

**STEP 16 - Test delete**
1. delete_form: delete the copied form
2. list_forms: verify the copy is gone

**STEP 17 - Test responses and analytics**
1. get_form_responses_analytics on the original form
2. Should return structured data with questions array and responses array

**STEP 18 - Cleanup**
1. delete_form: delete the original test form "MCP Test Form"
2. list_forms: confirm it's gone

**FINAL - Report**
Provide a summary table:
| Tool | Status | Notes |
|------|--------|-------|
| create_form | | |
| add_text_question | | |
| add_paragraph_question | | |
| add_multiple_choice_question | | |
| add_checkbox_question | | |
| add_dropdown_question | | |
| add_linear_scale_question | | |
| add_date_question | | |
| add_time_question | | |
| add_rating_question | | |
| add_choice_grid | | (skip - not tested above) |
| add_page_break | | |
| add_section_header | | (skip - tested as title_description) |
| add_title_description | | |
| add_image | | |
| add_video | | |
| get_form_items | | |
| get_form | | |
| get_form_metadata | | |
| update_form_settings | | |
| set_publish_settings | | |
| set_form_description | | |
| update_question | | |
| delete_question | | (skip - not tested) |
| set_question_grading | | |
| reorder_items | | |
| copy_form | | |
| delete_form | | |
| list_forms | | |
| get_form_responses | | |
| get_form_responses_analytics | | |
| get_responses_sheet | | (skip - needs linked sheet) |
| share_form | | (skip - needs email) |
```
