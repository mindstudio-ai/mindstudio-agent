#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/generated/metadata.ts
var metadata_exports = {};
__export(metadata_exports, {
  stepMetadata: () => stepMetadata
});
var stepMetadata;
var init_metadata = __esm({
  "src/generated/metadata.ts"() {
    "use strict";
    stepMetadata = {
      "activeCampaignAddNote": {
        stepType: "activeCampaignAddNote",
        description: "Add a note to an existing contact in ActiveCampaign.",
        usageNotes: "- Requires an ActiveCampaign OAuth connection (connectionId).\n- The contact must already exist \u2014 use the contact ID from a previous create or search step.",
        inputSchema: { "type": "object", "properties": { "contactId": { "type": "string", "description": "ActiveCampaign contact ID to add the note to" }, "note": { "type": "string", "description": "Note text content" }, "connectionId": { "type": "string", "description": "ActiveCampaign OAuth connection ID" } }, "required": ["contactId", "note"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "activeCampaignCreateContact": {
        stepType: "activeCampaignCreateContact",
        description: "Create or sync a contact in ActiveCampaign.",
        usageNotes: "- Requires an ActiveCampaign OAuth connection (connectionId).\n- If a contact with the email already exists, it may be updated depending on ActiveCampaign settings.\n- Custom fields are passed as a key-value map where keys are field IDs.",
        inputSchema: { "type": "object", "properties": { "email": { "type": "string", "description": "Contact email address" }, "firstName": { "type": "string", "description": "Contact first name" }, "lastName": { "type": "string", "description": "Contact last name" }, "phone": { "type": "string", "description": "Contact phone number" }, "accountId": { "type": "string", "description": "ActiveCampaign account ID to associate the contact with" }, "customFields": { "type": "object", "properties": {}, "required": [], "description": "Custom field values keyed by field ID" }, "connectionId": { "type": "string", "description": "ActiveCampaign OAuth connection ID" } }, "required": ["email", "firstName", "lastName", "phone", "accountId", "customFields"] },
        outputSchema: { "type": "object", "properties": { "contactId": { "type": "string", "description": "ActiveCampaign contact ID of the created contact" } }, "required": ["contactId"] }
      },
      "addSubtitlesToVideo": {
        stepType: "addSubtitlesToVideo",
        description: "Automatically add subtitles to a video",
        usageNotes: "- Can control style of text and animation",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video" }, "language": { "type": "string", "description": "ISO language code for subtitle transcription" }, "fontName": { "type": "string", "description": "Google Font name for subtitle text" }, "fontSize": { "type": "number", "description": "Font size in pixels. Default: 100." }, "fontWeight": { "enum": ["normal", "bold", "black"], "type": "string", "description": "Font weight for subtitle text" }, "fontColor": { "enum": ["white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"], "type": "string", "description": "Color of the subtitle text" }, "highlightColor": { "enum": ["white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"], "type": "string", "description": "Color used to highlight the currently spoken word" }, "strokeWidth": { "type": "number", "description": "Width of the text stroke outline in pixels" }, "strokeColor": { "enum": ["black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"], "type": "string", "description": "Color of the text stroke outline" }, "backgroundColor": { "enum": ["black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta", "none"], "type": "string", "description": "Background color behind subtitle text. Use 'none' for transparent." }, "backgroundOpacity": { "type": "number", "description": "Opacity of the subtitle background. 0.0 = fully transparent, 1.0 = fully opaque." }, "position": { "enum": ["top", "center", "bottom"], "type": "string", "description": "Vertical position of subtitle text on screen" }, "yOffset": { "type": "number", "description": "Vertical offset in pixels from the position. Positive moves down, negative moves up. Default: 75." }, "wordsPerSubtitle": { "type": "number", "description": "Maximum number of words per subtitle segment. Use 1 for single-word display, 2-3 for short phrases, or 8-12 for full sentences. Default: 3." }, "enableAnimation": { "type": "boolean", "description": "When true, enables bounce-style entrance animation for subtitles. Default: true." }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "language", "fontName", "fontSize", "fontWeight", "fontColor", "highlightColor", "strokeWidth", "strokeColor", "backgroundColor", "backgroundOpacity", "position", "yOffset", "wordsPerSubtitle", "enableAnimation"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with subtitles added" } }, "required": ["videoUrl"] }
      },
      "airtableCreateUpdateRecord": {
        stepType: "airtableCreateUpdateRecord",
        description: "Create a new record or update an existing record in an Airtable table.",
        usageNotes: '- If recordId is provided, updates that record. Otherwise, creates a new one.\n- When updating with updateMode "onlySpecified", unspecified fields are left as-is. With "all", unspecified fields are cleared.\n- Array fields (e.g. multipleAttachments) accept arrays of values.',
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Airtable OAuth connection ID" }, "baseId": { "type": "string", "description": "Airtable base ID" }, "tableId": { "type": "string", "description": "Airtable table ID" }, "recordId": { "type": "string", "description": "Record ID to update. Omit to create a new record" }, "updateMode": { "enum": ["onlySpecified", "all"], "type": "string", "description": "How to handle unspecified fields on update. 'onlySpecified' leaves them as-is, 'all' clears them" }, "fields": { "description": "Field schema metadata used for type resolution" }, "recordData": { "type": "object", "properties": {}, "required": [], "description": "Field values to set, keyed by field ID" } }, "required": ["baseId", "tableId", "fields", "recordData"] },
        outputSchema: { "type": "object", "properties": { "recordId": { "type": "string", "description": "The Airtable record ID of the created or updated record" } }, "required": ["recordId"] }
      },
      "airtableDeleteRecord": {
        stepType: "airtableDeleteRecord",
        description: "Delete a record from an Airtable table by its record ID.",
        usageNotes: "- Requires an active Airtable OAuth connection (connectionId).\n- Silently succeeds if the record does not exist.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Airtable OAuth connection ID" }, "baseId": { "type": "string", "description": "Airtable base ID" }, "tableId": { "type": "string", "description": "Airtable table ID" }, "recordId": { "type": "string", "description": "Record ID to delete" } }, "required": ["baseId", "tableId", "recordId"] },
        outputSchema: { "type": "object", "properties": { "deleted": { "type": "boolean", "description": "Whether the record was successfully deleted" } }, "required": ["deleted"] }
      },
      "airtableGetRecord": {
        stepType: "airtableGetRecord",
        description: "Fetch a single record from an Airtable table by its record ID.",
        usageNotes: "- Requires an active Airtable OAuth connection (connectionId).\n- If the record is not found, returns a string message instead of a record object.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Airtable OAuth connection ID" }, "baseId": { "type": "string", "description": 'Airtable base ID (e.g. "appXXXXXX")' }, "tableId": { "type": "string", "description": 'Airtable table ID (e.g. "tblXXXXXX")' }, "recordId": { "type": "string", "description": 'Record ID to fetch (e.g. "recXXXXXX")' } }, "required": ["baseId", "tableId", "recordId"] },
        outputSchema: { "type": "object", "properties": { "record": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string", "description": "Airtable record ID" }, "createdTime": { "type": "string", "description": "ISO 8601 timestamp when the record was created" }, "fields": { "type": "object", "properties": {}, "required": [], "description": "Field values keyed by field name" } }, "required": ["id", "createdTime", "fields"] }, { "type": "null" }] } }, "required": ["record"] }
      },
      "airtableGetTableRecords": {
        stepType: "airtableGetTableRecords",
        description: "Fetch multiple records from an Airtable table with optional pagination.",
        usageNotes: "- Requires an active Airtable OAuth connection (connectionId).\n- Default limit is 100 records. Maximum is 1000.\n- When outputFormat is 'csv', the variable receives CSV text. The direct execution output always returns parsed records.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Airtable OAuth connection ID" }, "baseId": { "type": "string", "description": 'Airtable base ID (e.g. "appXXXXXX")' }, "tableId": { "type": "string", "description": 'Airtable table ID (e.g. "tblXXXXXX")' }, "outputFormat": { "enum": ["json", "csv"], "type": "string", "description": "Output format for the result. Defaults to 'json'" }, "limit": { "type": "number", "description": "Maximum number of records to return. Defaults to 100, max 1000" } }, "required": ["baseId", "tableId"] },
        outputSchema: { "type": "object", "properties": { "records": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Airtable record ID" }, "createdTime": { "type": "string", "description": "ISO 8601 timestamp when the record was created" }, "fields": { "type": "object", "properties": {}, "required": [], "description": "Field values keyed by field name" } }, "required": ["id", "createdTime", "fields"] }, "description": "The list of records retrieved from the Airtable table" } }, "required": ["records"] }
      },
      "analyzeImage": {
        stepType: "analyzeImage",
        description: "Analyze an image using a vision model based on a text prompt.",
        usageNotes: "- Uses the configured vision model to generate a text analysis of the image.\n- The prompt should describe what to look for or extract from the image.\n- Pass imageUrl for a single image, or imageUrls for multiple images analyzed together in one request.\n- Most vision models (OpenAI, Grok, Gemini) accept multiple images in one request. Ideogram describe is single-image only.",
        inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Instructions describing what to look for or extract from the image" }, "imageUrl": { "type": "string", "description": "URL of a single image to analyze. Kept for backward compatibility; prefer imageUrls." }, "imageUrls": { "type": "array", "items": { "type": "string" }, "description": "One or more image URLs to analyze together in a single model request" }, "visionModelOverride": { "anyOf": [{ "type": "object", "properties": { "model": { "type": "string" }, "config": { "type": "object", "properties": {}, "required": [] } }, "required": ["model"] }, { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"] }] } }, "required": ["prompt"] },
        outputSchema: { "type": "object", "properties": { "analysis": { "type": "string", "description": "Text analysis of the image generated by the vision model" } }, "required": ["analysis"] }
      },
      "analyzeVideo": {
        stepType: "analyzeVideo",
        description: "Analyze a video using a video analysis model based on a text prompt.",
        usageNotes: "- Uses the configured video analysis model to generate a text analysis of the video.\n- The prompt should describe what to look for or extract from the video.",
        inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Instructions describing what to look for or extract from the video" }, "videoUrl": { "type": "string", "description": "URL of the video to analyze" }, "videoAnalysisModelOverride": { "anyOf": [{ "type": "object", "properties": { "model": { "type": "string" }, "config": { "type": "object", "properties": {}, "required": [] } }, "required": ["model"] }, { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"] }] } }, "required": ["prompt", "videoUrl"] },
        outputSchema: { "type": "object", "properties": { "analysis": { "type": "string", "description": "Text analysis of the video generated by the video analysis model" } }, "required": ["analysis"] }
      },
      "captureThumbnail": {
        stepType: "captureThumbnail",
        description: "Capture a thumbnail from a video at a specified timestamp",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to capture a frame from" }, "at": { "anyOf": [{ "type": "number" }, { "type": "string" }] } }, "required": ["videoUrl", "at"] },
        outputSchema: { "type": "object", "properties": { "thumbnailUrl": { "type": "string", "description": "URL of the captured thumbnail image" } }, "required": ["thumbnailUrl"] }
      },
      "checkAppRole": {
        stepType: "checkAppRole",
        description: "Check whether the current user has a specific app role and branch accordingly.",
        usageNotes: '- Checks if the current user has been assigned a specific role in this app.\n- If the user has the role, transitions to the "has role" path.\n- If the user does not have the role, transitions to the "no role" path, or errors if no path is configured.\n- Role names are defined by the app creator and assigned to users via the app roles system.\n- The roleName field supports {{variables}} for dynamic role checks.',
        inputSchema: { "type": "object", "properties": { "roleName": { "type": "string", "description": "The role name to check (supports {{variables}})" }, "hasRoleStepId": { "type": "string", "description": "Step to transition to if the user has the role (same workflow)" }, "hasRoleWorkflowId": { "type": "string", "description": "Workflow to jump to if the user has the role (cross workflow)" }, "noRoleStepId": { "type": "string", "description": "Step to transition to if the user does not have the role (same workflow)" }, "noRoleWorkflowId": { "type": "string", "description": "Workflow to jump to if the user does not have the role (cross workflow)" } }, "required": ["roleName"], "description": "Configuration for the check app role step" },
        outputSchema: { "type": "object", "properties": { "hasRole": { "type": "boolean", "description": "Whether the current user has the checked role" }, "userRoles": { "type": "array", "items": { "type": "string" }, "description": "All roles assigned to the current user for this app" } }, "required": ["hasRole", "userRoles"] }
      },
      "codaCreateUpdatePage": {
        stepType: "codaCreateUpdatePage",
        description: "Create a new page or update an existing page in a Coda document.",
        usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- If pageData.pageId is provided, updates that page. Otherwise, creates a new one.\n- Page content is provided as markdown and converted to Coda's canvas format.\n- When updating, insertionMode controls how content is applied (default: 'append').",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "pageData": { "type": "object", "properties": { "docId": { "type": "string", "description": "Coda document ID" }, "pageId": { "type": "string", "description": "Page ID to update. Omit to create a new page" }, "name": { "type": "string", "description": "Page title" }, "subtitle": { "type": "string", "description": "Page subtitle" }, "iconName": { "type": "string", "description": "Page icon name" }, "imageUrl": { "type": "string", "description": "Page cover image URL" }, "parentPageId": { "type": "string", "description": "Parent page ID for nesting under another page" }, "pageContent": { "anyOf": [{ "type": "string" }, {}] }, "contentUpdate": { "description": "Content update payload for partial updates" }, "insertionMode": { "type": "string", "description": 'How to insert content on update: "append" or "replace"' } }, "required": ["docId", "name", "subtitle", "iconName", "imageUrl", "pageContent"], "description": "Page configuration including document ID, title, content, and optional parent page" } }, "required": ["pageData"] },
        outputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "The Coda page ID of the created or updated page" } }, "required": ["pageId"] }
      },
      "codaCreateUpdateRow": {
        stepType: "codaCreateUpdateRow",
        description: "Create a new row or update an existing row in a Coda table.",
        usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- If rowId is provided, updates that row. Otherwise, creates a new one.\n- Row data keys are column IDs. Empty values are excluded.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "docId": { "type": "string", "description": "Coda document ID" }, "tableId": { "type": "string", "description": "Table ID within the document" }, "rowId": { "type": "string", "description": "Row ID to update. Omit to create a new row" }, "rowData": { "type": "object", "properties": {}, "required": [], "description": "Column values to set, keyed by column ID" } }, "required": ["docId", "tableId", "rowData"] },
        outputSchema: { "type": "object", "properties": { "rowId": { "type": "string", "description": "The Coda row ID of the created or updated row" } }, "required": ["rowId"] }
      },
      "codaFindRow": {
        stepType: "codaFindRow",
        description: "Search for a row in a Coda table by matching column values.",
        usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- Returns the first row matching all specified column values, or null if no match.\n- Search criteria in rowData are ANDed together.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "docId": { "type": "string", "description": "Coda document ID" }, "tableId": { "type": "string", "description": "Table ID to search within" }, "rowData": { "type": "object", "properties": {}, "required": [], "description": "Column values to match against, keyed by column ID. All criteria are ANDed together" } }, "required": ["docId", "tableId", "rowData"] },
        outputSchema: { "type": "object", "properties": { "row": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string", "description": "Coda row ID" }, "values": { "type": "object", "properties": {}, "required": [], "description": "Column values keyed by column name" } }, "required": ["id", "values"] }, { "type": "null" }] } }, "required": ["row"] }
      },
      "codaGetPage": {
        stepType: "codaGetPage",
        description: "Export and read the contents of a page from a Coda document.",
        usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- Page export is asynchronous on Coda's side \u2014 there may be a brief delay while it processes.\n- If a page was just created in a prior step, there is an automatic 20-second retry if the first export attempt fails.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "docId": { "type": "string", "description": "Coda document ID" }, "pageId": { "type": "string", "description": "Page ID within the document" }, "outputFormat": { "enum": ["html", "markdown"], "type": "string", "description": "Export format for the page content. Defaults to 'html'" } }, "required": ["docId", "pageId"] },
        outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "Page content in the requested format (HTML or Markdown)" } }, "required": ["content"] }
      },
      "codaGetTableRows": {
        stepType: "codaGetTableRows",
        description: "Fetch rows from a Coda table with optional pagination.",
        usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- Default limit is 10000 rows. Rows are fetched in pages of 500.\n- When outputFormat is 'csv', the variable receives CSV text. The direct execution output always returns parsed rows.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "docId": { "type": "string", "description": "Coda document ID" }, "tableId": { "type": "string", "description": "Table ID within the document" }, "limit": { "type": ["number", "string"] }, "outputFormat": { "enum": ["json", "csv"], "type": "string", "description": "Output format for the result. Defaults to 'json'" } }, "required": ["docId", "tableId"] },
        outputSchema: { "type": "object", "properties": { "rows": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Coda row ID" }, "values": { "type": "object", "properties": {}, "required": [], "description": "Column values keyed by column name" } }, "required": ["id", "values"] }, "description": "The list of rows retrieved from the Coda table" } }, "required": ["rows"] }
      },
      "convertPdfToImages": {
        stepType: "convertPdfToImages",
        description: "Convert each page of a PDF document into a PNG image.",
        usageNotes: "- Each page is converted to a separate PNG and re-hosted on the CDN.\n- Returns an array of image URLs, one per page.",
        inputSchema: { "type": "object", "properties": { "pdfUrl": { "type": "string", "description": "URL of the PDF document to convert" } }, "required": ["pdfUrl"] },
        outputSchema: { "type": "object", "properties": { "imageUrls": { "type": "array", "items": { "type": "string" }, "description": "CDN URLs of the generated page images, one per page of the PDF" } }, "required": ["imageUrls"] }
      },
      "createDataSource": {
        stepType: "createDataSource",
        description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Create a new empty vector data source for the current app.",
        usageNotes: '- Creates a new data source (vector database) associated with the current app version.\n- The data source is created empty \u2014 use the "Upload Data Source Document" block to add documents.\n- Returns the new data source ID which can be used in subsequent blocks.',
        inputSchema: { "type": "object", "properties": { "name": { "type": "string", "description": "Name for the new data source (supports variable interpolation)" } }, "required": ["name"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "createGmailDraft": {
        stepType: "createGmailDraft",
        description: "Create a draft email in the connected Gmail account.",
        usageNotes: `- Requires a Google OAuth connection with Gmail compose scope.
- The draft appears in the user's Gmail Drafts folder but is not sent.
- messageType controls the body format: "plain" for plain text, "html" for raw HTML, "markdown" for auto-converted markdown.`,
        inputSchema: { "type": "object", "properties": { "to": { "type": "string", "description": "Recipient email address(es), comma-separated for multiple" }, "subject": { "type": "string", "description": "Email subject line" }, "message": { "type": "string", "description": "Email body content" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "messageType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Body format: "plain", "html", or "markdown"' } }, "required": ["to", "subject", "message", "messageType"] },
        outputSchema: { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID" } }, "required": ["draftId"] }
      },
      "createGoogleCalendarEvent": {
        stepType: "createGoogleCalendarEvent",
        description: "Create a new event on a Google Calendar.",
        usageNotes: '- Requires a Google OAuth connection with Calendar events scope.\n- Date/time values must be ISO 8601 format (e.g. "2025-07-02T10:00:00-07:00").\n- Attendees are specified as one email address per line in a single string.\n- Set addMeetLink to true to automatically attach a Google Meet video call.',
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "summary": { "type": "string", "description": "Event title" }, "description": { "type": "string", "description": "Event description" }, "location": { "type": "string", "description": "Event location" }, "startDateTime": { "type": "string", "description": "Start time in ISO 8601 format" }, "endDateTime": { "type": "string", "description": "End time in ISO 8601 format" }, "attendees": { "type": "string", "description": "Attendee email addresses, one per line" }, "addMeetLink": { "type": "boolean", "description": "Whether to attach a Google Meet video call link" }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["summary", "startDateTime", "endDateTime"] },
        outputSchema: { "type": "object", "properties": { "eventId": { "type": "string", "description": "Google Calendar event ID" }, "htmlLink": { "type": "string", "description": "URL to view the event in Google Calendar" } }, "required": ["eventId", "htmlLink"] }
      },
      "createGoogleDoc": {
        stepType: "createGoogleDoc",
        description: "Create a new Google Document and optionally populate it with content.",
        usageNotes: '- textType determines how the text field is interpreted: "plain" for plain text, "html" for HTML markup, "markdown" for Markdown.',
        inputSchema: { "type": "object", "properties": { "title": { "type": "string", "description": "Title for the new document" }, "text": { "type": "string", "description": "Document body content" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "textType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Format of the text field: "plain", "html", or "markdown"' } }, "required": ["title", "text", "textType"] },
        outputSchema: { "type": "object", "properties": { "documentUrl": { "type": "string", "description": "URL of the newly created Google Document" } }, "required": ["documentUrl"] }
      },
      "createGoogleSheet": {
        stepType: "createGoogleSheet",
        description: "Create a new Google Spreadsheet and populate it with CSV data.",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "title": { "type": "string", "description": "Title for the new spreadsheet" }, "text": { "type": "string", "description": "CSV data to populate the sheet with" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["title", "text"] },
        outputSchema: { "type": "object", "properties": { "spreadsheetUrl": { "type": "string", "description": "URL of the newly created Google Spreadsheet" } }, "required": ["spreadsheetUrl"] }
      },
      "deleteDataSource": {
        stepType: "deleteDataSource",
        description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Delete a vector data source from the current app.",
        usageNotes: "- Soft-deletes a data source (vector database) by marking it as deleted.\n- The Milvus partition is cleaned up asynchronously by a background cron job.\n- The data source must belong to the current app version.",
        inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the data source to delete (supports variable interpolation)" } }, "required": ["dataSourceId"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "deleteDataSourceDocument": {
        stepType: "deleteDataSourceDocument",
        description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Delete a single document from a data source.",
        usageNotes: "- Soft-deletes a document by marking it as deleted.\n- Requires both the data source ID and document ID.\n- After deletion, reloads vectors into Milvus so the data source reflects the change immediately.",
        inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the data source containing the document (supports variable interpolation)" }, "documentId": { "type": "string", "description": "ID of the document to delete (supports variable interpolation)" } }, "required": ["dataSourceId", "documentId"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "deleteGmailEmail": {
        stepType: "deleteGmailEmail",
        description: "Move an email to trash in the connected Gmail account (recoverable delete).",
        usageNotes: "- Requires a Google OAuth connection with Gmail modify scope.\n- Uses trash (recoverable) rather than permanent delete.",
        inputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID to delete (move to trash)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageId"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "deleteGoogleCalendarEvent": {
        stepType: "deleteGoogleCalendarEvent",
        description: "Retrieve a specific event from a Google Calendar by event ID.",
        usageNotes: "- Requires a Google OAuth connection with Calendar events scope.\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns the structured event.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "eventId": { "type": "string", "description": "Google Calendar event ID to delete" }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["eventId"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "deleteGoogleSheetRows": {
        stepType: "deleteGoogleSheetRows",
        description: "Delete a range of rows from a Google Spreadsheet.",
        usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- startRow and endRow are 1-based row numbers (inclusive).\n- If sheetName is omitted, operates on the first sheet.",
        inputSchema: { "type": "object", "properties": { "documentId": { "type": "string", "description": "Google Spreadsheet ID or URL" }, "sheetName": { "type": "string", "description": "Sheet/tab name (defaults to first sheet)" }, "startRow": { "type": "string", "description": "First row to delete (1-based, inclusive)" }, "endRow": { "type": "string", "description": "Last row to delete (1-based, inclusive)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["documentId", "startRow", "endRow"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "detectChanges": {
        stepType: "detectChanges",
        description: "Detect changes between runs by comparing current input against previously stored state. Routes execution based on whether a change occurred.",
        usageNotes: '- Persists state across runs using a global variable keyed to the step ID.\n- Two modes: "comparison" (default) uses strict string inequality; "ai" uses an LLM to determine if a meaningful change occurred.\n- First run always treats the value as "changed" since there is no previous state.\n- Each mode supports transitions to different steps/workflows for the "changed" and "unchanged" paths.\n- AI mode bills normally for the LLM call.',
        inputSchema: { "type": "object", "properties": { "mode": { "enum": ["ai", "comparison"], "type": "string", "description": "Detection mode: 'comparison' for strict string inequality, 'ai' for LLM-based. Default: 'comparison'" }, "input": { "type": "string", "description": "Current value to check (variable template)" }, "prompt": { "type": "string", "description": "AI mode: what constitutes a meaningful change" }, "modelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "AI mode: model settings override" }, "previousValueVariable": { "type": "string", "description": "Optional variable name to store the previous value into for downstream access" }, "changedStepId": { "type": "string", "description": "Step to transition to if changed (same workflow)" }, "changedWorkflowId": { "type": "string", "description": "Workflow to jump to if changed (cross workflow)" }, "unchangedStepId": { "type": "string", "description": "Step to transition to if unchanged (same workflow)" }, "unchangedWorkflowId": { "type": "string", "description": "Workflow to jump to if unchanged (cross workflow)" } }, "required": ["mode", "input"], "description": "Configuration for the detect changes step" },
        outputSchema: { "type": "object", "properties": { "hasChanged": { "type": "boolean", "description": "Whether a change was detected" }, "currentValue": { "type": "string", "description": "The resolved input value" }, "previousValue": { "type": "string", "description": "The stored value from last run (empty string on first run)" }, "isFirstRun": { "type": "boolean", "description": "True when no previous state exists" } }, "required": ["hasChanged", "currentValue", "previousValue", "isFirstRun"] }
      },
      "detectPII": {
        stepType: "detectPII",
        description: "Scan text for personally identifiable information using Microsoft Presidio.",
        usageNotes: "- In workflow mode, transitions to detectedStepId if PII is found, notDetectedStepId otherwise.\n- In direct execution, returns the detection results without transitioning.\n- If entities is empty, returns immediately with no detections.",
        inputSchema: { "type": "object", "properties": { "input": { "type": "string", "description": "Text to scan for personally identifiable information" }, "language": { "type": "string", "description": 'Language code of the input text (e.g. "en")' }, "entities": { "type": "array", "items": { "type": "string" }, "description": 'PII entity types to scan for (e.g. ["PHONE_NUMBER", "EMAIL_ADDRESS"]). Empty array means nothing is scanned.' }, "detectedStepId": { "type": "string", "description": "Step to transition to if PII is detected (workflow mode)" }, "notDetectedStepId": { "type": "string", "description": "Step to transition to if no PII is detected (workflow mode)" }, "outputLogVariable": { "type": "string", "description": "Variable name to store the raw detection results" } }, "required": ["input", "language", "entities"] },
        outputSchema: { "type": "object", "properties": { "detected": { "type": "boolean", "description": "Whether any PII was found in the input text" }, "detections": { "type": "array", "items": { "type": "object", "properties": { "entity_type": { "type": "string", "description": 'PII entity type (e.g. "PHONE_NUMBER", "EMAIL_ADDRESS", "PERSON")' }, "start": { "type": "number", "description": "Start character index in the input text" }, "end": { "type": "number", "description": "End character index in the input text" }, "score": { "type": "number", "description": "Confidence score between 0 and 1" } }, "required": ["entity_type", "start", "end", "score"] }, "description": "List of detected PII entities with type, location, and confidence" } }, "required": ["detected", "detections"] }
      },
      "discordEditMessage": {
        stepType: "discordEditMessage",
        description: "Edit a previously sent Discord channel message. Use with the message ID returned by Send Discord Message.",
        usageNotes: "- Only messages sent by the bot can be edited.\n- The messageId is returned by the Send Discord Message step.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- When editing with an attachment, the new attachment replaces any previous attachments on the message.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).",
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": "Discord bot token for authentication" }, "channelId": { "type": "string", "description": "Discord channel ID containing the message" }, "messageId": { "type": "string", "description": "ID of the message to edit (returned by Send Discord Message)" }, "text": { "type": "string", "description": "New message text to replace the existing content" }, "attachmentUrl": { "type": "string", "description": "URL of a file to download and attach to the message (replaces any previous attachments)" } }, "required": ["botToken", "channelId", "messageId", "text"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "discordSendFollowUp": {
        stepType: "discordSendFollowUp",
        description: "Send a follow-up message to a Discord slash command interaction.",
        usageNotes: "- Requires the applicationId and interactionToken from the Discord trigger variables.\n- Follow-up messages appear as new messages in the channel after the initial response.\n- Returns the sent message ID.\n- Interaction tokens expire after 15 minutes.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).",
        inputSchema: { "type": "object", "properties": { "applicationId": { "type": "string", "description": "Discord application ID from the bot registration" }, "interactionToken": { "type": "string", "description": "Interaction token provided by the Discord trigger \u2014 expires after 15 minutes" }, "text": { "type": "string", "description": "Message text to send as a follow-up" }, "attachmentUrl": { "type": "string", "description": "URL of a file to download and attach to the message" } }, "required": ["applicationId", "interactionToken", "text"] },
        outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "ID of the sent follow-up message" } }, "required": ["messageId"] }
      },
      "discordSendMessage": {
        stepType: "discordSendMessage",
        description: "Send a message to Discord \u2014 either edit the loading message or send a new channel message.",
        usageNotes: '- mode "edit" replaces the loading message (interaction response) with the final result. Uses applicationId and interactionToken from trigger variables. No bot permissions required.\n- mode "send" sends a new message to a channel. Uses botToken and channelId from trigger variables. Returns a messageId that can be used with Edit Discord Message.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).\n- Interaction tokens expire after 15 minutes.',
        inputSchema: { "type": "object", "properties": { "mode": { "enum": ["edit", "send"], "type": "string", "description": '"edit" replaces the loading message, "send" sends a new channel message' }, "text": { "type": "string", "description": "Message text to send" }, "applicationId": { "type": "string", "description": 'Discord application ID from the bot registration (required for "reply" mode)' }, "interactionToken": { "type": "string", "description": 'Interaction token provided by the Discord trigger \u2014 expires after 15 minutes (required for "reply" mode)' }, "botToken": { "type": "string", "description": 'Discord bot token for authentication (required for "send" mode)' }, "channelId": { "type": "string", "description": 'Discord channel ID to send the message to (required for "send" mode)' }, "attachmentUrl": { "type": "string", "description": "URL of a file to download and attach to the message" } }, "required": ["mode", "text"] },
        outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": 'ID of the sent Discord message, only present in "send" mode (use with Edit Discord Message)' } } }
      },
      "downloadVideo": {
        stepType: "downloadVideo",
        description: "Download a video file",
        usageNotes: "- Works with YouTube, TikTok, etc., by using ytdlp behind the scenes\n- Can save as mp4 or mp3",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video to download (supports YouTube, TikTok, etc. via yt-dlp)" }, "format": { "enum": ["mp4", "mp3"], "type": "string", "description": "Output format for the downloaded file" } }, "required": ["videoUrl", "format"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the downloaded and re-hosted video file" } }, "required": ["videoUrl"] }
      },
      "enhanceImageGenerationPrompt": {
        stepType: "enhanceImageGenerationPrompt",
        description: "Generate or enhance an image generation prompt using a language model. Optionally generates a negative prompt.",
        usageNotes: "- Rewrites the user's prompt with added detail about style, lighting, colors, and composition.\n- Also useful for initial generation, it doesn't always need to be enhancing an existing prompt\n- When includeNegativePrompt is true, a second model call generates a negative prompt.",
        inputSchema: { "type": "object", "properties": { "initialPrompt": { "type": "string", "description": "The raw prompt to enhance" }, "includeNegativePrompt": { "type": "boolean", "description": "Whether to also generate a negative prompt" }, "negativePromptDestinationVariableName": { "type": "string", "description": "Variable name to save the negative prompt into" }, "systemPrompt": { "type": "string", "description": "Custom system prompt for the enhancement model. Uses a default prompt if not provided" }, "modelOverride": { "description": "Model override settings. Leave undefined to use the default model" } }, "required": ["initialPrompt", "includeNegativePrompt", "systemPrompt"] },
        outputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "The enhanced image generation prompt" }, "negativePrompt": { "type": "string", "description": "The negative prompt, only present when includeNegativePrompt was true" } }, "required": ["prompt"] }
      },
      "enhanceVideoGenerationPrompt": {
        stepType: "enhanceVideoGenerationPrompt",
        description: "Generate or enhance a video generation prompt using a language model. Optionally generates a negative prompt.",
        usageNotes: "- Rewrites the user's prompt with added detail about style, camera movement, lighting, and composition.\n- Also useful for initial generation, it doesn't always need to be enhancing an existing prompt\n- When includeNegativePrompt is true, a second model call generates a negative prompt.",
        inputSchema: { "type": "object", "properties": { "initialPrompt": { "type": "string", "description": "The raw prompt to enhance" }, "includeNegativePrompt": { "type": "boolean", "description": "Whether to also generate a negative prompt" }, "negativePromptDestinationVariableName": { "type": "string", "description": "Variable name to save the negative prompt into" }, "systemPrompt": { "type": "string", "description": "Custom system prompt for the enhancement model. Uses a default prompt if not provided" }, "modelOverride": { "description": "Model override settings. Leave undefined to use the default model" } }, "required": ["initialPrompt", "includeNegativePrompt", "systemPrompt"] },
        outputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "The enhanced video generation prompt" }, "negativePrompt": { "type": "string", "description": "The negative prompt, only present when includeNegativePrompt was true" } }, "required": ["prompt"] }
      },
      "enrichPerson": {
        stepType: "enrichPerson",
        description: "Look up professional information about a person using Apollo.io. Search by ID, name, LinkedIn URL, email, or domain.",
        usageNotes: "- At least one search parameter must be provided.\n- Returns enriched data from Apollo including contact details, employment info, and social profiles.",
        inputSchema: { "type": "object", "properties": { "params": { "type": "object", "properties": { "id": { "type": "string", "description": "Apollo person ID" }, "name": { "type": "string", "description": "Person's full name" }, "linkedinUrl": { "type": "string", "description": "LinkedIn profile URL" }, "email": { "type": "string", "description": "Email address" }, "domain": { "type": "string", "description": "Company domain" } }, "required": ["id", "name", "linkedinUrl", "email", "domain"], "description": "Search parameters to identify the person (ID, name, LinkedIn URL, email, or domain)" } }, "required": ["params"] },
        outputSchema: { "type": "object", "properties": { "data": { "description": "Apollo enrichment result with contact details, employment history, and social profiles" } }, "required": ["data"] }
      },
      "extractAudioFromVideo": {
        stepType: "extractAudioFromVideo",
        description: "Extract audio MP3 from a video file",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to extract audio from" } }, "required": ["videoUrl"] },
        outputSchema: { "type": "object", "properties": { "audioUrl": { "type": "string", "description": "URL of the extracted audio MP3 file" } }, "required": ["audioUrl"] }
      },
      "extractText": {
        stepType: "extractText",
        description: "Download a file from a URL and extract its text content. Supports PDFs (including scanned/image-based PDFs via OCR), plain text files, and other document formats.",
        usageNotes: "- Best suited for PDFs and raw text/document files. For web pages, use the scrapeUrl step instead.\n- Handles both text-layer PDFs and image-based/scanned PDFs (e.g. Figma/Canva exports, scanned documents). Image-based PDFs are processed with OCR automatically \u2014 there is no need to convert PDF pages to images first.\n- Accepts a single URL, a comma-separated list of URLs, or a JSON array of URLs.\n- Files are rehosted on the MindStudio CDN before extraction.\n- Optionally set `model` to a specific document-extraction model (`mistral-ocr-latest`, `llamaparse`, `google-document-ai`); omit to use the platform default.\n- Maximum file size is 50MB per URL.",
        inputSchema: { "type": "object", "properties": { "url": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] }, "model": { "type": "string", "description": "Optional extraction model id (a `document_extraction` model, e.g. `mistral-ocr-latest`, `llamaparse`, `google-document-ai`). Defaults to the platform default when omitted." } }, "required": ["url"] },
        outputSchema: { "type": "object", "properties": { "text": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["text"] }
      },
      "fetchDataSourceDocument": {
        stepType: "fetchDataSourceDocument",
        description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Fetch the full extracted text contents of a document in a data source.",
        usageNotes: '- Loads a document by ID and returns its full extracted text content.\n- The document must have been successfully processed (status "done").\n- Also returns document metadata (name, summary, word count).',
        inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the data source containing the document (supports variable interpolation)" }, "documentId": { "type": "string", "description": "ID of the document to fetch (supports variable interpolation)" } }, "required": ["dataSourceId", "documentId"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "fetchGoogleDoc": {
        stepType: "fetchGoogleDoc",
        description: "Fetch the contents of an existing Google Document.",
        usageNotes: '- exportType controls the output format: "html" for HTML markup, "markdown" for Markdown, "json" for structured JSON, "plain" for plain text.',
        inputSchema: { "type": "object", "properties": { "documentId": { "type": "string", "description": "Google Document ID (from the document URL)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["html", "markdown", "json", "plain"], "type": "string", "description": 'Output format: "html", "markdown", "json", or "plain"' } }, "required": ["documentId", "exportType"] },
        outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "Document contents in the requested export format" } }, "required": ["content"] }
      },
      "fetchGoogleSheet": {
        stepType: "fetchGoogleSheet",
        description: "Fetch contents of a Google Spreadsheet range.",
        usageNotes: '- range uses A1 notation (e.g. "Sheet1!A1:C10"). Omit to fetch the entire first sheet.\n- exportType controls the output format: "csv" for comma-separated values, "json" for structured JSON.',
        inputSchema: { "type": "object", "properties": { "spreadsheetId": { "type": "string", "description": "Google Spreadsheet ID (from the spreadsheet URL)" }, "range": { "type": "string", "description": 'Cell range in A1 notation (e.g. "Sheet1!A1:C10")' }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["csv", "json"], "type": "string", "description": 'Output format: "csv" or "json"' } }, "required": ["spreadsheetId", "range", "exportType"] },
        outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "Spreadsheet data in the requested export format" } }, "required": ["content"] }
      },
      "fetchSlackChannelHistory": {
        stepType: "fetchSlackChannelHistory",
        description: "Fetch recent message history from a Slack channel.",
        usageNotes: "- The user is responsible for connecting their Slack workspace and selecting the channel",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Slack OAuth connection ID (leave empty to allow user to select)" }, "channelId": { "type": "string", "description": "Slack channel ID (leave empty to allow user to select a channel)" }, "limit": { "type": "number", "description": "Maximum number of messages to return (1-15)" }, "startDate": { "type": "string", "description": "Earliest date to include messages from" }, "endDate": { "type": "string", "description": "Latest date to include messages up to" }, "includeImages": { "type": "boolean", "description": "Whether to include images in the output" }, "includeRawMessage": { "type": "boolean", "description": "Whether to include the raw Slack message object (useful for bot messages with complex attachments)" } }, "required": ["channelId"] },
        outputSchema: { "type": "object", "properties": { "messages": { "type": "array", "items": { "type": "object", "properties": { "from": { "type": "string" }, "content": { "type": "string" }, "timestamp": { "type": "string" }, "images": { "type": "array", "items": { "type": "string" } }, "rawMessage": { "type": "object", "properties": { "app_id": { "type": "string" }, "assistant_app_thread": { "type": "object", "properties": { "first_user_thread_reply": { "type": "string" }, "title": { "type": "string" }, "title_blocks": { "type": "array", "items": { "type": "string" } } } }, "attachments": { "type": "array", "items": { "type": "object", "properties": { "actions": { "type": "array", "items": { "type": "string" } }, "app_id": { "type": "string" }, "app_unfurl_url": { "type": "string" }, "author_icon": { "type": "string" }, "author_id": { "type": "string" }, "author_link": { "type": "string" }, "author_name": { "type": "string" }, "author_subname": { "type": "string" }, "blocks": { "type": "array", "items": { "type": "string" } }, "bot_id": { "type": "string" }, "bot_team_id": { "type": "string" }, "callback_id": { "type": "string" }, "channel_id": { "type": "string" }, "channel_name": { "type": "string" }, "channel_team": { "type": "string" }, "color": { "type": "string" }, "fallback": { "type": "string" }, "fields": { "type": "array", "items": { "type": "string" } }, "file_id": { "type": "string" }, "filename": { "type": "string" }, "files": { "type": "array", "items": { "type": "string" } }, "footer": { "type": "string" }, "footer_icon": { "type": "string" }, "from_url": { "type": "string" }, "hide_border": { "type": "boolean" }, "hide_color": { "type": "boolean" }, "id": { "type": "number" }, "image_bytes": { "type": "number" }, "image_height": { "type": "number" }, "image_url": { "type": "string" }, "image_width": { "type": "number" }, "indent": { "type": "boolean" }, "is_app_unfurl": { "type": "boolean" }, "is_file_attachment": { "type": "boolean" }, "is_msg_unfurl": { "type": "boolean" }, "is_reply_unfurl": { "type": "boolean" }, "is_thread_root_unfurl": { "type": "boolean" }, "list": { "type": "string" }, "list_record": { "type": "string" }, "list_record_id": { "type": "string" }, "list_records": { "type": "array", "items": { "type": "string" } }, "list_schema": { "type": "array", "items": { "type": "string" } }, "list_view": { "type": "string" }, "list_view_id": { "type": "string" }, "message_blocks": { "type": "array", "items": { "type": "string" } }, "metadata": { "type": "string" }, "mimetype": { "type": "string" }, "mrkdwn_in": { "type": "array", "items": { "type": "string" } }, "msg_subtype": { "type": "string" }, "original_url": { "type": "string" }, "pretext": { "type": "string" }, "preview": { "type": "string" }, "service_icon": { "type": "string" }, "service_name": { "type": "string" }, "service_url": { "type": "string" }, "size": { "type": "number" }, "text": { "type": "string" }, "thumb_height": { "type": "number" }, "thumb_url": { "type": "string" }, "thumb_width": { "type": "number" }, "title": { "type": "string" }, "title_link": { "type": "string" }, "ts": { "type": "string" }, "url": { "type": "string" }, "video_html": { "type": "string" }, "video_html_height": { "type": "number" }, "video_html_width": { "type": "number" }, "video_url": { "type": "string" } } } }, "blocks": { "type": "array", "items": { "type": "object", "properties": { "accessory": { "type": "string" }, "alt_text": { "type": "string" }, "api_decoration_available": { "type": "boolean" }, "app_collaborators": { "type": "array", "items": { "type": "string" } }, "app_id": { "type": "string" }, "author_name": { "type": "string" }, "block_id": { "type": "string" }, "bot_user_id": { "type": "string" }, "button_label": { "type": "string" }, "call": { "type": "string" }, "call_id": { "type": "string" }, "description": { "type": "string" }, "developer_trace_id": { "type": "string" }, "dispatch_action": { "type": "boolean" }, "element": { "type": "string" }, "elements": { "type": "array", "items": { "type": "string" } }, "expand": { "type": "boolean" }, "external_id": { "type": "string" }, "fallback": { "type": "string" }, "fields": { "type": "array", "items": { "type": "string" } }, "file": { "type": "string" }, "file_id": { "type": "string" }, "function_trigger_id": { "type": "string" }, "hint": { "type": "string" }, "image_bytes": { "type": "number" }, "image_height": { "type": "number" }, "image_url": { "type": "string" }, "image_width": { "type": "number" }, "is_animated": { "type": "boolean" }, "is_workflow_app": { "type": "boolean" }, "label": { "type": "string" }, "optional": { "type": "boolean" }, "owning_team_id": { "type": "string" }, "provider_icon_url": { "type": "string" }, "provider_name": { "type": "string" }, "sales_home_workflow_app_type": { "type": "number" }, "share_url": { "type": "string" }, "slack_file": { "type": "string" }, "source": { "type": "string" }, "text": { "type": "string" }, "thumbnail_url": { "type": "string" }, "title": { "type": "string" }, "title_url": { "type": "string" }, "trigger_subtype": { "type": "string" }, "trigger_type": { "type": "string" }, "type": { "type": "string" }, "url": { "type": "string" }, "video_url": { "type": "string" }, "workflow_id": { "type": "string" } } } }, "bot_id": { "type": "string" }, "bot_profile": { "type": "object", "properties": { "app_id": { "type": "string" }, "deleted": { "type": "boolean" }, "icons": { "type": "string" }, "id": { "type": "string" }, "name": { "type": "string" }, "team_id": { "type": "string" }, "updated": { "type": "number" } } }, "client_msg_id": { "type": "string" }, "display_as_bot": { "type": "boolean" }, "edited": { "type": "object", "properties": { "ts": { "type": "string" }, "user": { "type": "string" } } }, "files": { "type": "array", "items": { "type": "object", "properties": { "access": { "type": "string" }, "alt_txt": { "type": "string" }, "app_id": { "type": "string" }, "app_name": { "type": "string" }, "attachments": { "type": "array", "items": {} }, "blocks": { "type": "array", "items": { "type": "string" } }, "bot_id": { "type": "string" }, "can_toggle_canvas_lock": { "type": "boolean" }, "canvas_printing_enabled": { "type": "boolean" }, "canvas_template_mode": { "type": "string" }, "cc": { "type": "array", "items": { "type": "string" } }, "channel_actions_count": { "type": "number" }, "channel_actions_ts": { "type": "string" }, "channels": { "type": "array", "items": { "type": "string" } }, "comments_count": { "type": "number" }, "converted_pdf": { "type": "string" }, "created": { "type": "number" }, "deanimate": { "type": "string" }, "deanimate_gif": { "type": "string" }, "display_as_bot": { "type": "boolean" }, "dm_mpdm_users_with_file_access": { "type": "array", "items": { "type": "string" } }, "duration_ms": { "type": "number" }, "edit_link": { "type": "string" }, "edit_timestamp": { "type": "number" }, "editable": { "type": "boolean" }, "editor": { "type": "string" }, "editors": { "type": "array", "items": { "type": "string" } }, "external_id": { "type": "string" }, "external_type": { "type": "string" }, "external_url": { "type": "string" }, "favorites": { "type": "array", "items": { "type": "string" } }, "file_access": { "type": "string" }, "filetype": { "type": "string" }, "from": { "type": "array", "items": { "type": "string" } }, "groups": { "type": "array", "items": { "type": "string" } }, "has_more": { "type": "boolean" }, "has_more_shares": { "type": "boolean" }, "has_rich_preview": { "type": "boolean" }, "headers": { "type": "string" }, "hls": { "type": "string" }, "hls_embed": { "type": "string" }, "id": { "type": "string" }, "image_exif_rotation": { "type": "number" }, "ims": { "type": "array", "items": { "type": "string" } }, "initial_comment": { "type": "string" }, "is_channel_space": { "type": "boolean" }, "is_external": { "type": "boolean" }, "is_public": { "type": "boolean" }, "is_restricted_sharing_enabled": { "type": "boolean" }, "is_starred": { "type": "boolean" }, "last_editor": { "type": "string" }, "last_read": { "type": "number" }, "lines": { "type": "number" }, "lines_more": { "type": "number" }, "linked_channel_id": { "type": "string" }, "list_csv_download_url": { "type": "string" }, "list_limits": { "type": "string" }, "list_metadata": { "type": "string" }, "media_display_type": { "type": "string" }, "media_progress": { "type": "string" }, "mimetype": { "type": "string" }, "mode": { "type": "string" }, "mp4": { "type": "string" }, "mp4_low": { "type": "string" }, "name": { "type": "string" }, "non_owner_editable": { "type": "boolean" }, "num_stars": { "type": "number" }, "org_or_workspace_access": { "type": "string" }, "original_attachment_count": { "type": "number" }, "original_h": { "type": "string" }, "original_w": { "type": "string" }, "permalink": { "type": "string" }, "permalink_public": { "type": "string" }, "pinned_to": { "type": "array", "items": { "type": "string" } }, "pjpeg": { "type": "string" }, "plain_text": { "type": "string" }, "pretty_type": { "type": "string" }, "preview": { "type": "string" }, "preview_highlight": { "type": "string" }, "preview_is_truncated": { "type": "boolean" }, "preview_plain_text": { "type": "string" }, "private_channels_with_file_access_count": { "type": "number" }, "private_file_with_access_count": { "type": "number" }, "public_url_shared": { "type": "boolean" }, "quip_thread_id": { "type": "string" }, "reactions": { "type": "array", "items": { "type": "string" } }, "saved": { "type": "string" }, "sent_to_self": { "type": "boolean" }, "shares": { "type": "string" }, "show_badge": { "type": "boolean" }, "simplified_html": { "type": "string" }, "size": { "type": "number" }, "source_team": { "type": "string" }, "subject": { "type": "string" }, "subtype": { "type": "string" }, "team_pref_version_history_enabled": { "type": "boolean" }, "teams_shared_with": { "type": "array", "items": {} }, "template_conversion_ts": { "type": "number" }, "template_description": { "type": "string" }, "template_icon": { "type": "string" }, "template_name": { "type": "string" }, "template_title": { "type": "string" }, "thumb_1024": { "type": "string" }, "thumb_1024_gif": { "type": "string" }, "thumb_1024_h": { "type": "string" }, "thumb_1024_w": { "type": "string" }, "thumb_160": { "type": "string" }, "thumb_160_gif": { "type": "string" }, "thumb_160_h": { "type": "string" }, "thumb_160_w": { "type": "string" }, "thumb_360": { "type": "string" }, "thumb_360_gif": { "type": "string" }, "thumb_360_h": { "type": "string" }, "thumb_360_w": { "type": "string" }, "thumb_480": { "type": "string" }, "thumb_480_gif": { "type": "string" }, "thumb_480_h": { "type": "string" }, "thumb_480_w": { "type": "string" }, "thumb_64": { "type": "string" }, "thumb_64_gif": { "type": "string" }, "thumb_64_h": { "type": "string" }, "thumb_64_w": { "type": "string" }, "thumb_720": { "type": "string" }, "thumb_720_gif": { "type": "string" }, "thumb_720_h": { "type": "string" }, "thumb_720_w": { "type": "string" }, "thumb_80": { "type": "string" }, "thumb_800": { "type": "string" }, "thumb_800_gif": { "type": "string" }, "thumb_800_h": { "type": "string" }, "thumb_800_w": { "type": "string" }, "thumb_80_gif": { "type": "string" }, "thumb_80_h": { "type": "string" }, "thumb_80_w": { "type": "string" }, "thumb_960": { "type": "string" }, "thumb_960_gif": { "type": "string" }, "thumb_960_h": { "type": "string" }, "thumb_960_w": { "type": "string" }, "thumb_gif": { "type": "string" }, "thumb_pdf": { "type": "string" }, "thumb_pdf_h": { "type": "string" }, "thumb_pdf_w": { "type": "string" }, "thumb_tiny": { "type": "string" }, "thumb_video": { "type": "string" }, "thumb_video_h": { "type": "number" }, "thumb_video_w": { "type": "number" }, "timestamp": { "type": "number" }, "title": { "type": "string" }, "title_blocks": { "type": "array", "items": { "type": "string" } }, "to": { "type": "array", "items": { "type": "string" } }, "transcription": { "type": "string" }, "update_notification": { "type": "number" }, "updated": { "type": "number" }, "url_private": { "type": "string" }, "url_private_download": { "type": "string" }, "url_static_preview": { "type": "string" }, "user": { "type": "string" }, "user_team": { "type": "string" }, "username": { "type": "string" }, "vtt": { "type": "string" } } } }, "icons": { "type": "object", "properties": { "emoji": { "type": "string" }, "image_36": { "type": "string" }, "image_48": { "type": "string" }, "image_64": { "type": "string" }, "image_72": { "type": "string" } } }, "inviter": { "type": "string" }, "is_locked": { "type": "boolean" }, "latest_reply": { "type": "string" }, "metadata": { "type": "object", "properties": { "event_payload": { "type": "string" }, "event_type": { "type": "string" } } }, "parent_user_id": { "type": "string" }, "purpose": { "type": "string" }, "reactions": { "type": "array", "items": { "type": "object", "properties": { "count": { "type": "number" }, "name": { "type": "string" }, "url": { "type": "string" }, "users": { "type": "array", "items": { "type": "string" } } } } }, "reply_count": { "type": "number" }, "reply_users": { "type": "array", "items": { "type": "string" } }, "reply_users_count": { "type": "number" }, "root": { "type": "object", "properties": { "bot_id": { "type": "string" }, "icons": { "type": "string" }, "latest_reply": { "type": "string" }, "parent_user_id": { "type": "string" }, "reply_count": { "type": "number" }, "reply_users": { "type": "array", "items": { "type": "string" } }, "reply_users_count": { "type": "number" }, "subscribed": { "type": "boolean" }, "subtype": { "type": "string" }, "text": { "type": "string" }, "thread_ts": { "type": "string" }, "ts": { "type": "string" }, "type": { "type": "string" }, "username": { "type": "string" } } }, "subscribed": { "type": "boolean" }, "subtype": { "type": "string" }, "team": { "type": "string" }, "text": { "type": "string" }, "thread_ts": { "type": "string" }, "topic": { "type": "string" }, "ts": { "type": "string" }, "type": { "type": "string" }, "upload": { "type": "boolean" }, "user": { "type": "string" }, "username": { "type": "string" }, "x_files": { "type": "array", "items": { "type": "string" } } } } }, "required": ["from", "content"] }, "description": "List of messages from the channel history" } }, "required": ["messages"] }
      },
      "fetchYoutubeCaptions": {
        stepType: "fetchYoutubeCaptions",
        description: "Retrieve the captions/transcript for a YouTube video.",
        usageNotes: '- Supports multiple languages via the language parameter.\n- "text" export produces timestamped plain text; "json" export produces structured transcript data.',
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "YouTube video URL to fetch captions for" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Output format: "text" for timestamped plain text, "json" for structured transcript data' }, "language": { "type": "string", "description": 'Language code for the captions (e.g. "en")' } }, "required": ["videoUrl", "exportType", "language"] },
        outputSchema: { "type": "object", "properties": { "transcripts": { "type": "array", "items": { "type": "object", "properties": { "text": { "type": "string", "description": "Transcript text segment" }, "start": { "type": "number", "description": "Start time of the segment in seconds" } }, "required": ["text", "start"] }, "description": "Parsed transcript segments with text and start timestamps" } }, "required": ["transcripts"] }
      },
      "fetchYoutubeChannel": {
        stepType: "fetchYoutubeChannel",
        description: "Retrieve metadata and recent videos for a YouTube channel.",
        usageNotes: "- Accepts a YouTube channel URL (e.g. https://www.youtube.com/@ChannelName or /channel/ID).\n- Returns channel info and video listings as a JSON object.",
        inputSchema: { "type": "object", "properties": { "channelUrl": { "type": "string", "description": "YouTube channel URL (e.g. https://www.youtube.com/@ChannelName or /channel/ID)" } }, "required": ["channelUrl"] },
        outputSchema: { "type": "object", "properties": {}, "required": [] }
      },
      "fetchYoutubeComments": {
        stepType: "fetchYoutubeComments",
        description: "Retrieve comments for a YouTube video.",
        usageNotes: '- Paginates through comments (up to 5 pages).\n- "text" export produces markdown-formatted text; "json" export produces structured comment data.',
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "YouTube video URL to fetch comments for" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Output format: "text" for markdown-formatted text, "json" for structured comment data' }, "limitPages": { "type": "string", "description": "Maximum number of comment pages to fetch (1-5)" } }, "required": ["videoUrl", "exportType", "limitPages"] },
        outputSchema: { "type": "object", "properties": { "comments": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Unique comment identifier" }, "link": { "type": "string", "description": "Direct URL to the comment" }, "publishedDate": { "type": "string", "description": "Date the comment was published" }, "text": { "type": "string", "description": "Text content of the comment" }, "likes": { "type": "number", "description": "Number of likes on the comment" }, "replies": { "type": "number", "description": "Number of replies to the comment" }, "author": { "type": "string", "description": "Display name of the comment author" }, "authorLink": { "type": "string", "description": "URL to the author's YouTube channel" }, "authorImg": { "type": "string", "description": "URL of the author's profile image" } }, "required": ["id", "link", "publishedDate", "text", "likes", "replies", "author", "authorLink", "authorImg"] }, "description": "List of comments retrieved from the video" } }, "required": ["comments"] }
      },
      "fetchYoutubeVideo": {
        stepType: "fetchYoutubeVideo",
        description: "Retrieve metadata for a YouTube video (title, description, stats, channel info).",
        usageNotes: "- Returns video metadata, channel info, and engagement stats.\n- Video format data is excluded from the response.",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "YouTube video URL to fetch metadata for" } }, "required": ["videoUrl"] },
        outputSchema: { "type": "object", "properties": {}, "required": [] }
      },
      "generate3dModel": {
        stepType: "generate3dModel",
        description: "Generate a 3D model using a 3D generation model.",
        usageNotes: "- Text-to-3D models use the prompt field.\n- Image-to-3D and multi-view models take image URLs through the selected model's configuration inputs.\n- The output is standardized as a GLB URL plus optional FBX/OBJ/USDZ, thumbnail, texture maps, and provider task ID.",
        inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Text prompt for text-to-3D models, or optional guidance for image-to-3D models" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "threeDModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "3D generation model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default 3D model if not specified" } } },
        outputSchema: { "type": "object", "properties": { "prompt": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "providerTaskId": { "type": "string" }, "resolvedConfig": { "type": "object", "properties": {}, "required": [] } }, "required": ["glbUrl"] }
      },
      "generateAsset": {
        stepType: "generatePdf",
        description: "Generate an HTML asset and export it as a webpage, PDF, or image",
        usageNotes: '- Agents can generate HTML documents and export as webpage, PDFs, images, or videos. They do this by using the "generatePdf" block, which defines an HTML page with variables, and then the generation process renders the page to create the output and save its URL at the specified variable.\n- The template for the HTML page is generated by a separate process, and it can only use variables that have already been defined in the workflow at the time of its execution. It has full access to handlebars to render the HTML template, including a handlebars helper to render a markdown variable string as HTML (which can be useful for creating templates that render long strings). The template can also create its own simple JavaScript to do things like format dates and strings.\n- If PDF or composited image generation are part of the workflow, assistant adds the block and leaves the "source" empty. In a separate step, assistant generates a detailed request for the developer who will write the HTML.\n- Can also auto-generate HTML from a prompt (like a generate text block to generate HTML). In these cases, create a prompt with variables in the dynamicPrompt variable describing, in detail, the document to generate\n- Can either display output directly to user (foreground mode) or save the URL of the asset to a variable (background mode)',
        inputSchema: { "type": "object", "properties": { "source": { "type": "string", "description": "The HTML or Markdown source template for the asset" }, "sourceType": { "enum": ["html", "markdown", "spa", "raw", "dynamic", "customInterface"], "type": "string", "description": "Source type: html, markdown (auto-formatted), spa (single page app), raw (pre-generated HTML in a variable), dynamic (AI-generated from prompt), or customInterface" }, "outputFormat": { "enum": ["pdf", "png", "html", "mp4", "openGraph"], "type": "string", "description": "The output format for the generated asset" }, "pageSize": { "enum": ["full", "letter", "A4", "custom"], "type": "string", "description": "Page size for PDF, PNG, or MP4 output" }, "testData": { "type": "object", "properties": {}, "required": [], "description": "Test data used for previewing the template with sample variable values" }, "options": { "type": "object", "properties": { "pageWidthPx": { "type": "number", "description": "Custom page width in pixels (for custom pageSize)" }, "pageHeightPx": { "type": "number", "description": "Custom page height in pixels (for custom pageSize)" }, "pageOrientation": { "enum": ["portrait", "landscape"], "type": "string", "description": "Page orientation for the rendered output" }, "rehostMedia": { "type": "boolean", "description": "Whether to re-host third-party images on the MindStudio CDN" }, "videoDurationSeconds": { "type": "number", "description": "Duration in seconds for MP4 video output" } }, "description": "Additional rendering options" }, "spaSource": { "type": "object", "properties": { "source": { "type": "string", "description": "Source code of the SPA (legacy, use files instead)" }, "lastCompiledSource": { "type": "string", "description": "Last compiled source (cached)" }, "files": { "type": "object", "properties": {}, "required": [], "description": "Multi-file SPA source" }, "paths": { "type": "array", "items": { "type": "string" }, "description": "Available route paths in the SPA" }, "root": { "type": "string", "description": "Root URL of the SPA bundle" }, "zipUrl": { "type": "string", "description": "URL of the zipped SPA bundle" } }, "required": ["paths", "root", "zipUrl"], "description": "Single page app source configuration (advanced)" }, "rawSource": { "type": "string", "description": "Raw HTML source stored in a variable, using handlebars syntax (e.g. {{myHtmlVariable}})" }, "dynamicPrompt": { "type": "string", "description": 'Prompt to generate the HTML dynamically when sourceType is "dynamic"' }, "dynamicSourceModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model override for dynamic HTML generation. Leave undefined to use the default model" }, "transitionControl": { "enum": ["default", "native"], "type": "string", "description": "Controls how the step transitions after displaying in foreground mode" }, "shareControl": { "enum": ["default", "hidden"], "type": "string", "description": "Controls visibility of the share button on displayed assets" }, "shareImageUrl": { "type": "string", "description": "URL of a custom Open Graph share image" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["source", "sourceType", "outputFormat", "pageSize", "testData"] },
        outputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "CDN URL of the generated asset (PDF, PNG, HTML, or MP4 depending on outputFormat)" } }, "required": ["url"] }
      },
      "generateChart": {
        stepType: "generateChart",
        description: "Create a chart image using QuickChart (Chart.js) and return the URL.",
        usageNotes: "- The data field must be a Chart.js-compatible JSON object serialized as a string.\n- Supported chart types: bar, line, pie.",
        inputSchema: { "type": "object", "properties": { "chart": { "type": "object", "properties": { "chartType": { "enum": ["bar", "line", "pie"], "type": "string", "description": "The type of chart to generate" }, "data": { "type": "string", "description": "Chart.js-compatible JSON data serialized as a string" }, "options": { "type": "object", "properties": { "width": { "type": "string", "description": 'Image width in pixels (e.g. "500")' }, "height": { "type": "string", "description": 'Image height in pixels (e.g. "300")' } }, "required": ["width", "height"], "description": "Image rendering options" } }, "required": ["chartType", "data", "options"], "description": "Chart configuration including type, data, and rendering options" } }, "required": ["chart"] },
        outputSchema: { "type": "object", "properties": { "chartUrl": { "type": "string", "description": "URL of the generated chart image" } }, "required": ["chartUrl"] }
      },
      "generateImage": {
        stepType: "generateImage",
        description: "Generate an image from a text prompt using an AI model.",
        usageNotes: "- Prompts should be descriptive but concise (roughly 3\u20136 sentences).\n- Images are automatically hosted on a CDN.\n- In foreground mode, the image is displayed to the user. In background mode, the URL is saved to a variable.\n- When generateVariants is true with numVariants > 1, multiple images are generated in parallel.\n- In direct execution, foreground mode behaves as background, and userSelect variant behavior behaves as saveAll.",
        inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Text prompt describing the image to generate" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "imageModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "Image generation model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default image model if not specified" }, "generateVariants": { "type": "boolean", "description": "Whether to generate multiple image variants in parallel" }, "numVariants": { "type": "number", "description": "Number of variants to generate (max 10)" }, "addWatermark": { "type": "boolean", "description": "Whether to add a MindStudio watermark to the generated image.\n\nThe watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there." } }, "required": ["prompt"] },
        outputSchema: { "type": "object", "properties": { "imageUrl": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["imageUrl"] }
      },
      "generateLipsync": {
        stepType: "generateLipsync",
        description: "Generate a lip sync video from provided audio and image.",
        usageNotes: "- In foreground mode, the video is displayed to the user. In background mode, the URL is saved to a variable.",
        inputSchema: { "type": "object", "properties": { "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "addWatermark": { "type": "boolean", "description": "Whether to add a MindStudio watermark to the generated video.\n\nThe watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there." }, "lipsyncModelOverride": { "type": "object", "properties": { "model": { "type": "string" }, "config": { "type": "object", "properties": {}, "required": [] } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default lipsync model if not specified" } } },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "generateMusic": {
        stepType: "generateMusic",
        description: "Generate an audio file from provided instructions (text) using a music model.",
        usageNotes: "- The text field contains the instructions (prompt) for the music generation.\n- In foreground mode, the audio is displayed to the user. In background mode, the URL is saved to a variable.",
        inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The instructions (prompt) for the music generation" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "musicModelOverride": { "type": "object", "properties": { "model": { "type": "string" }, "config": { "type": "object", "properties": {}, "required": [] } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default music model if not specified" } }, "required": ["text"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "generatePdf": {
        stepType: "generatePdf",
        description: "Generate an HTML asset and export it as a webpage, PDF, or image",
        usageNotes: '- Agents can generate HTML documents and export as webpage, PDFs, images, or videos. They do this by using the "generatePdf" block, which defines an HTML page with variables, and then the generation process renders the page to create the output and save its URL at the specified variable.\n- The template for the HTML page is generated by a separate process, and it can only use variables that have already been defined in the workflow at the time of its execution. It has full access to handlebars to render the HTML template, including a handlebars helper to render a markdown variable string as HTML (which can be useful for creating templates that render long strings). The template can also create its own simple JavaScript to do things like format dates and strings.\n- If PDF or composited image generation are part of the workflow, assistant adds the block and leaves the "source" empty. In a separate step, assistant generates a detailed request for the developer who will write the HTML.\n- Can also auto-generate HTML from a prompt (like a generate text block to generate HTML). In these cases, create a prompt with variables in the dynamicPrompt variable describing, in detail, the document to generate\n- Can either display output directly to user (foreground mode) or save the URL of the asset to a variable (background mode)',
        inputSchema: { "type": "object", "properties": { "source": { "type": "string", "description": "The HTML or Markdown source template for the asset" }, "sourceType": { "enum": ["html", "markdown", "spa", "raw", "dynamic", "customInterface"], "type": "string", "description": "Source type: html, markdown (auto-formatted), spa (single page app), raw (pre-generated HTML in a variable), dynamic (AI-generated from prompt), or customInterface" }, "outputFormat": { "enum": ["pdf", "png", "html", "mp4", "openGraph"], "type": "string", "description": "The output format for the generated asset" }, "pageSize": { "enum": ["full", "letter", "A4", "custom"], "type": "string", "description": "Page size for PDF, PNG, or MP4 output" }, "testData": { "type": "object", "properties": {}, "required": [], "description": "Test data used for previewing the template with sample variable values" }, "options": { "type": "object", "properties": { "pageWidthPx": { "type": "number", "description": "Custom page width in pixels (for custom pageSize)" }, "pageHeightPx": { "type": "number", "description": "Custom page height in pixels (for custom pageSize)" }, "pageOrientation": { "enum": ["portrait", "landscape"], "type": "string", "description": "Page orientation for the rendered output" }, "rehostMedia": { "type": "boolean", "description": "Whether to re-host third-party images on the MindStudio CDN" }, "videoDurationSeconds": { "type": "number", "description": "Duration in seconds for MP4 video output" } }, "description": "Additional rendering options" }, "spaSource": { "type": "object", "properties": { "source": { "type": "string", "description": "Source code of the SPA (legacy, use files instead)" }, "lastCompiledSource": { "type": "string", "description": "Last compiled source (cached)" }, "files": { "type": "object", "properties": {}, "required": [], "description": "Multi-file SPA source" }, "paths": { "type": "array", "items": { "type": "string" }, "description": "Available route paths in the SPA" }, "root": { "type": "string", "description": "Root URL of the SPA bundle" }, "zipUrl": { "type": "string", "description": "URL of the zipped SPA bundle" } }, "required": ["paths", "root", "zipUrl"], "description": "Single page app source configuration (advanced)" }, "rawSource": { "type": "string", "description": "Raw HTML source stored in a variable, using handlebars syntax (e.g. {{myHtmlVariable}})" }, "dynamicPrompt": { "type": "string", "description": 'Prompt to generate the HTML dynamically when sourceType is "dynamic"' }, "dynamicSourceModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model override for dynamic HTML generation. Leave undefined to use the default model" }, "transitionControl": { "enum": ["default", "native"], "type": "string", "description": "Controls how the step transitions after displaying in foreground mode" }, "shareControl": { "enum": ["default", "hidden"], "type": "string", "description": "Controls visibility of the share button on displayed assets" }, "shareImageUrl": { "type": "string", "description": "URL of a custom Open Graph share image" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["source", "sourceType", "outputFormat", "pageSize", "testData"] },
        outputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "CDN URL of the generated asset (PDF, PNG, HTML, or MP4 depending on outputFormat)" } }, "required": ["url"] }
      },
      "generateStaticVideoFromImage": {
        stepType: "generateStaticVideoFromImage",
        description: "Convert a static image to an MP4",
        usageNotes: "- Can use to create slides/intertitles/slates for video composition",
        inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the source image to convert to video" }, "duration": { "type": "string", "description": "Duration of the output video in seconds" } }, "required": ["imageUrl", "duration"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the generated static video" } }, "required": ["videoUrl"] }
      },
      "generateText": {
        stepType: "userMessage",
        description: "Send a message to an AI model and return the response, or echo a system message.",
        usageNotes: `- Source "user" sends the message to an LLM and returns the model's response.
- Source "system" echoes the message content directly (no AI call).
- Mode "background" saves the result to a variable. Mode "foreground" streams it to the user (not available in direct execution).
- Structured output (JSON/CSV) can be enforced via structuredOutputType and structuredOutputExample.
- When executed inside a v2 app method (managed sandbox or local dev tunnel),
  LLM token output can be streamed to the frontend in real time via an SSE
  side-channel. The frontend opts in by passing { stream: true } to the method
  invocation via @mindstudio-ai/interface. Tokens are published to Redis
  pub/sub as they arrive and forwarded as SSE events on the invoke response.
  The method code itself is unchanged \u2014 streaming is transparent to the
  developer. See V2ExecutionService.ts and the invoke handler in V2Apps for
  the server-side plumbing.`,
        inputSchema: { "type": "object", "properties": { "message": { "type": "string", "description": "The message to send (prompt for AI, or text for system echo)" }, "source": { "enum": ["user", "system"], "type": "string", "description": 'Message source: "user" sends to AI model, "system" echoes message content directly. Defaults to "user"' }, "modelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model configuration override. Optional; uses the workflow's default model if not specified" }, "structuredOutputType": { "enum": ["text", "json", "csv"], "type": "string", "description": "Output format constraint for structured responses" }, "structuredOutputExample": { "type": "string", "description": "Sample showing the desired output shape (for JSON/CSV formats). A TypeScript interface is also useful here for more complex types." }, "chatHistoryMode": { "enum": ["include", "exclude"], "type": "string", "description": "Whether to include or exclude prior chat history in the AI context" } }, "required": ["message"], "description": "Configuration for the user message step" },
        outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "The AI model's response or echoed system message content" } }, "required": ["content"] }
      },
      "generateVideo": {
        stepType: "generateVideo",
        description: "Generate a video from a text prompt using an AI model.",
        usageNotes: "- Prompts should be descriptive but concise (roughly 3\u20136 sentences).\n- Videos are automatically hosted on a CDN.\n- In foreground mode, the video is displayed to the user. In background mode, the URL is saved to a variable.\n- When generateVariants is true with numVariants > 1, multiple videos are generated in parallel.\n- In direct execution, foreground mode behaves as background, and userSelect variant behavior behaves as saveAll.",
        inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Text prompt describing the video to generate" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "videoModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "Video generation model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default video model if not specified" }, "generateVariants": { "type": "boolean", "description": "Whether to generate multiple video variants in parallel" }, "numVariants": { "type": "number", "description": "Number of variants to generate (max 10)" }, "addWatermark": { "type": "boolean", "description": "Whether to add a MindStudio watermark to the generated video.\n\nThe watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there." } }, "required": ["prompt"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["videoUrl"] }
      },
      "getGmailAttachments": {
        stepType: "getGmailAttachments",
        description: "Download attachments from a Gmail email and re-host them on CDN.",
        usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Attachments are uploaded to CDN and returned as URLs.\n- Attachments larger than 25MB are skipped.\n- Use the message ID from Search Gmail Emails, List Recent Gmail Emails, or Get Gmail Email steps.",
        inputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageId"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "getGmailDraft": {
        stepType: "getGmailDraft",
        description: "Retrieve a specific draft from Gmail by draft ID.",
        usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the draft content including subject, recipients, sender, and body.",
        inputSchema: { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID to retrieve" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["draftId"] },
        outputSchema: { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID" }, "messageId": { "type": "string", "description": "Gmail message ID" }, "subject": { "type": "string", "description": "Email subject" }, "to": { "type": "string", "description": "Recipient email" }, "from": { "type": "string", "description": "Sender email" }, "body": { "type": "string", "description": "Draft body content" } }, "required": ["draftId", "messageId", "subject", "to", "from", "body"] }
      },
      "getGmailEmail": {
        stepType: "getGmailEmail",
        description: "Retrieve a specific email from Gmail by message ID.",
        usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the email subject, sender, recipient, date, body (plain text preferred, falls back to HTML), and labels.",
        inputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID to retrieve" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageId"] },
        outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID" }, "subject": { "type": "string", "description": "Email subject" }, "from": { "type": "string", "description": "Sender email" }, "to": { "type": "string", "description": "Recipient email" }, "date": { "type": "string", "description": "Email date" }, "body": { "type": "string", "description": "Email body content" }, "labels": { "type": "string", "description": "Comma-separated label IDs" } }, "required": ["messageId", "subject", "from", "to", "date", "body", "labels"] }
      },
      "getGmailUnreadCount": {
        stepType: "getGmailUnreadCount",
        description: "Get the number of unread emails in the connected Gmail inbox.",
        usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the unread message count for the inbox label.\n- This is a lightweight call that does not fetch any email content.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" } } },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "getGoogleCalendarEvent": {
        stepType: "getGoogleCalendarEvent",
        description: "Retrieve a specific event from a Google Calendar by event ID.",
        usageNotes: "- Requires a Google OAuth connection with Calendar events scope.\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns the structured event.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "eventId": { "type": "string", "description": "Google Calendar event ID to retrieve" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["eventId", "exportType"] },
        outputSchema: { "type": "object", "properties": { "event": { "type": "object", "properties": { "id": { "type": "string", "description": "Google Calendar event ID" }, "status": { "type": "string", "description": 'Event status (e.g. "confirmed", "tentative", "cancelled")' }, "htmlLink": { "type": "string", "description": "URL to view the event in Google Calendar" }, "created": { "type": "string", "description": "Timestamp when the event was created" }, "updated": { "type": "string", "description": "Timestamp when the event was last updated" }, "summary": { "type": "string", "description": "Event title" }, "description": { "type": "string", "description": "Event description" }, "location": { "type": "string", "description": "Event location" }, "organizer": { "anyOf": [{ "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" } } }, { "type": "null" }] }, "start": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "end": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "attendees": { "anyOf": [{ "type": "array", "items": { "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" }, "responseStatus": { "type": "string" } } } }, { "type": "null" }] } }, "description": "The retrieved calendar event" } }, "required": ["event"] }
      },
      "getGoogleDriveFile": {
        stepType: "getGoogleDriveFile",
        description: "Download a file from Google Drive and rehost it on the CDN. Returns a public CDN URL.",
        usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- Google-native files (Docs, Sheets, Slides) cannot be downloaded \u2014 use dedicated steps instead.\n- Maximum file size: 200MB.\n- The file is downloaded and re-uploaded to the CDN; the returned URL is publicly accessible.",
        inputSchema: { "type": "object", "properties": { "fileId": { "type": "string", "description": "Google Drive file ID" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["fileId"] },
        outputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "CDN URL of the downloaded file" }, "name": { "type": "string", "description": "Original file name" }, "mimeType": { "type": "string", "description": "File MIME type" }, "size": { "type": "number", "description": "File size in bytes" } }, "required": ["url", "name", "mimeType", "size"] }
      },
      "getGoogleSheetInfo": {
        stepType: "getGoogleSheetInfo",
        description: "Get metadata about a Google Spreadsheet including sheet names, row counts, and column counts.",
        usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- Returns the spreadsheet title and a list of all sheets with their dimensions.",
        inputSchema: { "type": "object", "properties": { "documentId": { "type": "string", "description": "Google Spreadsheet ID or URL" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["documentId"] },
        outputSchema: { "type": "object", "properties": { "title": { "type": "string", "description": "Spreadsheet title" }, "sheets": { "type": "array", "items": { "type": "object", "properties": { "sheetId": { "type": "number" }, "title": { "type": "string" }, "rowCount": { "type": "number" }, "columnCount": { "type": "number" } }, "required": ["sheetId", "title", "rowCount", "columnCount"] }, "description": "List of sheets with their properties" } }, "required": ["title", "sheets"] }
      },
      "getMediaMetadata": {
        stepType: "getMediaMetadata",
        description: "Get info about a media file",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "mediaUrl": { "type": "string", "description": "URL of the audio or video file to analyze" } }, "required": ["mediaUrl"] },
        outputSchema: { "type": "object", "properties": { "metadata": { "type": "string", "description": "JSON string containing the media file metadata" } }, "required": ["metadata"] }
      },
      "hubspotCreateCompany": {
        stepType: "hubspotCreateCompany",
        description: "Create a new company or update an existing one in HubSpot. Matches by domain.",
        usageNotes: "- Requires a HubSpot OAuth connection (connectionId).\n- If a company with the given domain already exists, it is updated. Otherwise, a new one is created.\n- Property values are type-checked against enabledProperties before being sent to HubSpot.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "HubSpot OAuth connection ID" }, "company": { "type": "object", "properties": { "domain": { "type": "string", "description": "Company domain, used for matching existing companies" }, "name": { "type": "string", "description": "Company name" } }, "required": ["domain", "name"], "description": "Company data including domain, name, and additional properties" }, "enabledProperties": { "type": "array", "items": { "type": "object", "properties": { "label": { "type": "string", "description": "Display label for the HubSpot property" }, "value": { "type": "string", "description": "HubSpot property internal name" }, "type": { "enum": ["string", "number", "bool"], "type": "string", "description": "Data type of the property value" } }, "required": ["label", "value", "type"] }, "description": "HubSpot properties enabled for this step, used for type validation" } }, "required": ["company", "enabledProperties"] },
        outputSchema: { "type": "object", "properties": { "companyId": { "type": "string", "description": "HubSpot company ID of the created or updated company" } }, "required": ["companyId"] }
      },
      "hubspotCreateContact": {
        stepType: "hubspotCreateContact",
        description: "Create a new contact or update an existing one in HubSpot. Matches by email address.",
        usageNotes: "- Requires a HubSpot OAuth connection (connectionId).\n- If a contact with the given email already exists, it is updated. Otherwise, a new one is created.\n- If companyDomain is provided, the contact is associated with that company (creating the company if needed).\n- Property values are type-checked against enabledProperties before being sent to HubSpot.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "HubSpot OAuth connection ID" }, "contact": { "type": "object", "properties": { "email": { "type": "string", "description": "Contact email address, used for matching existing contacts" }, "firstname": { "type": "string", "description": "Contact first name" }, "lastname": { "type": "string", "description": "Contact last name" } }, "required": ["email", "firstname", "lastname"], "description": "Contact data including email, first name, last name, and additional properties" }, "enabledProperties": { "type": "array", "items": { "type": "object", "properties": { "label": { "type": "string", "description": "Display label for the HubSpot property" }, "value": { "type": "string", "description": "HubSpot property internal name" }, "type": { "enum": ["string", "number", "bool"], "type": "string", "description": "Data type of the property value" } }, "required": ["label", "value", "type"] }, "description": "HubSpot properties enabled for this step, used for type validation" }, "companyDomain": { "type": "string", "description": "Company domain to associate the contact with. Creates the company if it does not exist" } }, "required": ["contact", "enabledProperties", "companyDomain"] },
        outputSchema: { "type": "object", "properties": { "contactId": { "type": "string", "description": "HubSpot contact ID of the created or updated contact" } }, "required": ["contactId"] }
      },
      "hubspotGetCompany": {
        stepType: "hubspotGetCompany",
        description: "Look up a HubSpot company by domain name or company ID.",
        usageNotes: "- Requires a HubSpot OAuth connection (connectionId).\n- Returns null if the company is not found.\n- When searching by domain, performs a search query then fetches the full company record.\n- Use additionalProperties to request specific HubSpot properties beyond the defaults.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "HubSpot OAuth connection ID" }, "searchBy": { "enum": ["domain", "id"], "type": "string", "description": "How to look up the company: by domain name or HubSpot company ID" }, "companyDomain": { "type": "string", "description": "Domain to search by (used when searchBy is 'domain')" }, "companyId": { "type": "string", "description": "HubSpot company ID (used when searchBy is 'id')" }, "additionalProperties": { "type": "array", "items": { "type": "string" }, "description": "Extra HubSpot property names to include in the response beyond the defaults" } }, "required": ["searchBy", "companyDomain", "companyId", "additionalProperties"] },
        outputSchema: { "type": "object", "properties": { "company": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string" }, "properties": { "type": "object", "properties": {}, "required": [] }, "createdAt": { "type": "string" }, "updatedAt": { "type": "string" }, "archived": { "type": "boolean" } }, "required": ["id", "properties", "createdAt", "updatedAt", "archived"] }, { "type": "null" }] } }, "required": ["company"] }
      },
      "hubspotGetContact": {
        stepType: "hubspotGetContact",
        description: "Look up a HubSpot contact by email address or contact ID.",
        usageNotes: "- Requires a HubSpot OAuth connection (connectionId).\n- Returns null if the contact is not found.\n- Use additionalProperties to request specific HubSpot properties beyond the defaults.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "HubSpot OAuth connection ID" }, "searchBy": { "enum": ["email", "id"], "type": "string", "description": "How to look up the contact: by email address or HubSpot contact ID" }, "contactEmail": { "type": "string", "description": "Email address to search by (used when searchBy is 'email')" }, "contactId": { "type": "string", "description": "HubSpot contact ID (used when searchBy is 'id')" }, "additionalProperties": { "type": "array", "items": { "type": "string" }, "description": "Extra HubSpot property names to include in the response beyond the defaults" } }, "required": ["searchBy", "contactEmail", "contactId", "additionalProperties"] },
        outputSchema: { "type": "object", "properties": { "contact": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string" }, "properties": { "type": "object", "properties": {}, "required": [] }, "createdAt": { "type": "string" }, "updatedAt": { "type": "string" }, "archived": { "type": "boolean" } }, "required": ["id", "properties", "createdAt", "updatedAt", "archived"] }, { "type": "null" }] } }, "required": ["contact"] }
      },
      "hunterApiCompanyEnrichment": {
        stepType: "hunterApiCompanyEnrichment",
        description: "Look up company information by domain using Hunter.io.",
        usageNotes: "- Returns company name, description, location, industry, size, technologies, and more.\n- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns null if the company is not found.",
        inputSchema: { "type": "object", "properties": { "domain": { "type": "string", "description": 'Domain or URL to look up (e.g. "example.com")' } }, "required": ["domain"] },
        outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": { "name": { "type": "string" }, "domain": { "type": "string" }, "description": { "type": "string" }, "country": { "type": "string" }, "state": { "type": "string" }, "city": { "type": "string" }, "industry": { "type": "string" }, "employees_range": { "type": "string" }, "logo_url": { "type": "string" }, "technologies": { "type": "array", "items": { "type": "string" } } }, "required": ["name", "domain", "description", "country", "state", "city", "industry", "employees_range", "logo_url", "technologies"] }, { "type": "null" }] } }, "required": ["data"] }
      },
      "hunterApiDomainSearch": {
        stepType: "hunterApiDomainSearch",
        description: "Search for email addresses associated with a domain using Hunter.io.",
        usageNotes: "- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns a list of email addresses found for the domain along with organization info.",
        inputSchema: { "type": "object", "properties": { "domain": { "type": "string", "description": 'Domain or URL to search for email addresses (e.g. "example.com")' } }, "required": ["domain"] },
        outputSchema: { "type": "object", "properties": { "data": { "type": "object", "properties": { "domain": { "type": "string", "description": "The searched domain" }, "disposable": { "type": "boolean", "description": "Whether the domain uses disposable email addresses" }, "webmail": { "type": "boolean", "description": "Whether the domain is a webmail provider" }, "accept_all": { "type": "boolean", "description": "Whether the domain accepts all email addresses" }, "pattern": { "type": "string", "description": 'Common email pattern for the domain (e.g. "{first}.{last}")' }, "organization": { "type": "string", "description": "Organization name associated with the domain" }, "country": { "type": "string", "description": "Country of the organization" }, "state": { "type": "string", "description": "State or region of the organization" }, "emails": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string", "description": "Email address" }, "type": { "type": "string", "description": 'Email type (e.g. "personal", "generic")' }, "confidence": { "type": "number", "description": "Confidence score (0-100)" }, "first_name": { "type": "string", "description": "Contact first name" }, "last_name": { "type": "string", "description": "Contact last name" }, "position": { "type": "string", "description": "Job title or position" }, "seniority": { "type": "string", "description": "Seniority level" }, "department": { "type": "string", "description": "Department within the organization" }, "linkedin": { "type": "string", "description": "LinkedIn profile URL" }, "twitter": { "type": "string", "description": "Twitter handle" }, "phone_number": { "type": "string", "description": "Phone number" } }, "required": ["value", "type", "confidence", "first_name", "last_name", "position", "seniority", "department", "linkedin", "twitter", "phone_number"] }, "description": "List of email addresses found for the domain" }, "linked_domains": { "type": "array", "items": { "type": "string" }, "description": "Other domains linked to this organization" } }, "required": ["domain", "disposable", "webmail", "accept_all", "pattern", "organization", "country", "state", "emails", "linked_domains"], "description": "Domain search results including emails and organization info" } }, "required": ["data"] }
      },
      "hunterApiEmailFinder": {
        stepType: "hunterApiEmailFinder",
        description: "Find an email address for a specific person at a domain using Hunter.io.",
        usageNotes: "- Requires a first name, last name, and domain.\n- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns the most likely email address with a confidence score.",
        inputSchema: { "type": "object", "properties": { "domain": { "type": "string", "description": 'Domain to search (e.g. "example.com"). Full URLs are also accepted' }, "firstName": { "type": "string", "description": "Person's first name" }, "lastName": { "type": "string", "description": "Person's last name" } }, "required": ["domain", "firstName", "lastName"] },
        outputSchema: { "type": "object", "properties": { "data": { "type": "object", "properties": { "first_name": { "type": "string", "description": "Person's first name" }, "last_name": { "type": "string", "description": "Person's last name" }, "email": { "type": "string", "description": "The found email address" }, "score": { "type": "number", "description": "Confidence score (0-100)" }, "domain": { "type": "string", "description": "Domain searched" }, "accept_all": { "type": "boolean", "description": "Whether the domain accepts all email addresses" }, "position": { "type": "string", "description": "Job title or position" }, "twitter": { "type": "string", "description": "Twitter handle" }, "linkedin_url": { "type": "string", "description": "LinkedIn profile URL" }, "phone_number": { "type": "string", "description": "Phone number" }, "company": { "type": "string", "description": "Company name" }, "sources": { "type": "array", "items": { "type": "object", "properties": { "domain": { "type": "string", "description": "Domain where the email was found" }, "uri": { "type": "string", "description": "URI of the page where the email was found" }, "extracted_on": { "type": "string", "description": "Date when the email was extracted" } }, "required": ["domain", "uri", "extracted_on"] }, "description": "Sources where the email was found" } }, "required": ["first_name", "last_name", "email", "score", "domain", "accept_all", "position", "twitter", "linkedin_url", "phone_number", "company", "sources"], "description": "Email finder results including the found email and confidence score" } }, "required": ["data"] }
      },
      "hunterApiEmailVerification": {
        stepType: "hunterApiEmailVerification",
        description: "Verify whether an email address is valid and deliverable using Hunter.io.",
        usageNotes: '- Checks email format, MX records, SMTP server, and mailbox deliverability.\n- Returns a status ("valid", "invalid", "accept_all", "webmail", "disposable", "unknown") and a score.',
        inputSchema: { "type": "object", "properties": { "email": { "type": "string", "description": "Email address to verify" } }, "required": ["email"] },
        outputSchema: { "type": "object", "properties": { "data": { "type": "object", "properties": { "status": { "type": "string", "description": 'Verification status (e.g. "valid", "invalid", "accept_all", "webmail", "disposable", "unknown")' }, "result": { "type": "string", "description": "Deliverability result" }, "score": { "type": "number", "description": "Confidence score (0-100)" }, "email": { "type": "string", "description": "The verified email address" }, "regexp": { "type": "boolean", "description": "Whether the email matches a valid format" }, "gibberish": { "type": "boolean", "description": "Whether the email appears to be gibberish" }, "disposable": { "type": "boolean", "description": "Whether the email uses a disposable email service" }, "webmail": { "type": "boolean", "description": "Whether the email is from a webmail provider" }, "mx_records": { "type": "boolean", "description": "Whether MX records exist for the domain" }, "smtp_server": { "type": "boolean", "description": "Whether the SMTP server is reachable" }, "smtp_check": { "type": "boolean", "description": "Whether the SMTP mailbox check passed" }, "accept_all": { "type": "boolean", "description": "Whether the domain accepts all email addresses" }, "block": { "type": "boolean", "description": "Whether the email is blocked" }, "sources": { "type": "array", "items": { "type": "object", "properties": { "domain": { "type": "string", "description": "Domain where the email was found" }, "uri": { "type": "string", "description": "URI of the page where the email was found" }, "extracted_on": { "type": "string", "description": "Date when the email was extracted" } }, "required": ["domain", "uri", "extracted_on"] }, "description": "Sources where the email was found" } }, "required": ["status", "result", "score", "email", "regexp", "gibberish", "disposable", "webmail", "mx_records", "smtp_server", "smtp_check", "accept_all", "block", "sources"], "description": "Email verification results including status, deliverability, and confidence score" } }, "required": ["data"] }
      },
      "hunterApiPersonEnrichment": {
        stepType: "hunterApiPersonEnrichment",
        description: "Look up professional information about a person by their email address using Hunter.io.",
        usageNotes: "- Returns name, job title, social profiles, and company information.\n- If the person is not found, returns an object with an error message instead of throwing.",
        inputSchema: { "type": "object", "properties": { "email": { "type": "string", "description": "Email address to look up" } }, "required": ["email"] },
        outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": { "first_name": { "type": "string" }, "last_name": { "type": "string" }, "email": { "type": "string" }, "position": { "type": "string" }, "seniority": { "type": "string" }, "department": { "type": "string" }, "linkedin_url": { "type": "string" }, "twitter": { "type": "string" }, "phone_number": { "type": "string" }, "company": { "anyOf": [{ "type": "object", "properties": { "name": { "type": "string" }, "domain": { "type": "string" }, "industry": { "type": "string" } }, "required": ["name", "domain", "industry"] }, { "type": "null" }] } }, "required": ["first_name", "last_name", "email", "position", "seniority", "department", "linkedin_url", "twitter", "phone_number", "company"] }, { "type": "object", "properties": { "error": { "type": "string" } }, "required": ["error"] }] } }, "required": ["data"] }
      },
      "imageFaceSwap": {
        stepType: "imageFaceSwap",
        description: "Replace a face in an image with a face from another image using AI.",
        usageNotes: "- Requires both a target image and a face source image.\n- Output is re-hosted on the CDN as a PNG.",
        inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the target image containing the face to replace" }, "faceImageUrl": { "type": "string", "description": "URL of the image containing the replacement face" }, "engine": { "type": "string", "description": "Face swap engine to use" } }, "required": ["imageUrl", "faceImageUrl", "engine"] },
        outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the face-swapped image (PNG)" } }, "required": ["imageUrl"] }
      },
      "imageRemoveWatermark": {
        stepType: "imageRemoveWatermark",
        description: "Remove watermarks from an image using AI.",
        usageNotes: "- Output is re-hosted on the CDN as a PNG.",
        inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the image to remove the watermark from" }, "engine": { "type": "string", "description": "Watermark removal engine to use" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["imageUrl", "engine"] },
        outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the processed image with watermark removed (PNG)" } }, "required": ["imageUrl"] }
      },
      "insertVideoClips": {
        stepType: "insertVideoClips",
        description: "Insert b-roll clips into a base video at a timecode, optionally with an xfade transition.",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "baseVideoUrl": { "type": "string", "description": "URL of the base video to insert clips into" }, "overlayVideos": { "type": "array", "items": { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the overlay video clip" }, "startTimeSec": { "type": "number", "description": "Timecode in seconds at which to insert this clip" } }, "required": ["videoUrl", "startTimeSec"] }, "description": "Array of overlay clips to insert at specified timecodes" }, "transition": { "type": "string", "description": "Optional xfade transition effect name between clips" }, "transitionDuration": { "type": "number", "description": "Duration of the transition in seconds" }, "useOverlayAudio": { "type": "boolean", "description": "When true, uses audio from the overlay clips instead of the base video audio during inserts" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["baseVideoUrl", "overlayVideos"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with clips inserted" } }, "required": ["videoUrl"] }
      },
      "listDataSources": {
        stepType: "listDataSources",
        description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. List all data sources for the current app.",
        usageNotes: "- Returns metadata for every data source associated with the current app version.\n- Each entry includes the data source ID, name, description, status, and document list.",
        inputSchema: { "type": "object", "properties": {}, "required": [] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "listGmailDrafts": {
        stepType: "listGmailDrafts",
        description: "List drafts in the connected Gmail account.",
        usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns up to 50 drafts (default 10).\n- The variable receives text or JSON depending on exportType.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "limit": { "type": "string", "description": "Max drafts to return (default: 10, max: 50)" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' } }, "required": ["exportType"] },
        outputSchema: { "type": "object", "properties": { "drafts": { "type": "array", "items": { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID" }, "messageId": { "type": "string", "description": "Gmail message ID" }, "subject": { "type": "string", "description": "Email subject" }, "to": { "type": "string", "description": "Recipient email" }, "snippet": { "type": "string", "description": "Short preview text" } }, "required": ["draftId", "messageId", "subject", "to", "snippet"] }, "description": "List of draft summaries" } }, "required": ["drafts"] }
      },
      "listGmailLabels": {
        stepType: "listGmailLabels",
        description: "List all labels in the connected Gmail account. Use these label IDs or names with the Update Gmail Labels step.",
        usageNotes: '- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns both system labels (INBOX, SENT, TRASH, etc.) and user-created labels.\n- Label type is "system" for built-in labels or "user" for custom labels.',
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" } } },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "listGoogleCalendarEvents": {
        stepType: "listGoogleCalendarEvents",
        description: "List upcoming events from a Google Calendar, ordered by start time.",
        usageNotes: "- Requires a Google OAuth connection with Calendar events scope.\n- Only returns future events (timeMin = now).\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns structured events.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "limit": { "type": "number", "description": "Maximum number of events to return (default: 10)" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["limit", "exportType"] },
        outputSchema: { "type": "object", "properties": { "events": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Google Calendar event ID" }, "status": { "type": "string", "description": 'Event status (e.g. "confirmed", "tentative", "cancelled")' }, "htmlLink": { "type": "string", "description": "URL to view the event in Google Calendar" }, "created": { "type": "string", "description": "Timestamp when the event was created" }, "updated": { "type": "string", "description": "Timestamp when the event was last updated" }, "summary": { "type": "string", "description": "Event title" }, "description": { "type": "string", "description": "Event description" }, "location": { "type": "string", "description": "Event location" }, "organizer": { "anyOf": [{ "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" } } }, { "type": "null" }] }, "start": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "end": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "attendees": { "anyOf": [{ "type": "array", "items": { "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" }, "responseStatus": { "type": "string" } } } }, { "type": "null" }] } } }, "description": "List of upcoming calendar events ordered by start time" } }, "required": ["events"] }
      },
      "listGoogleDriveFiles": {
        stepType: "listGoogleDriveFiles",
        description: "List files in a Google Drive folder.",
        usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- If folderId is omitted, lists files in the root folder.\n- Returns file metadata including name, type, size, and links.",
        inputSchema: { "type": "object", "properties": { "folderId": { "type": "string", "description": "Google Drive folder ID (defaults to root)" }, "limit": { "type": "number", "description": "Max files to return (default: 20)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' } }, "required": ["exportType"] },
        outputSchema: { "type": "object", "properties": { "files": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "mimeType": { "type": "string" }, "size": { "type": "string" }, "webViewLink": { "type": "string" }, "createdTime": { "type": "string" }, "modifiedTime": { "type": "string" } }, "required": ["id", "name", "mimeType", "size", "webViewLink", "createdTime", "modifiedTime"] }, "description": "List of files in the folder" } }, "required": ["files"] }
      },
      "listRecentGmailEmails": {
        stepType: "listRecentGmailEmails",
        description: "List recent emails from the connected Gmail inbox.",
        usageNotes: '- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns up to 100 emails (default 5), ordered by most recent first.\n- Functionally equivalent to Search Gmail Emails with an "in:inbox" query.',
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "limit": { "type": "string", "description": "Maximum number of emails to return (1-100, default: 5)" } }, "required": ["exportType", "limit"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "logic": {
        stepType: "logic",
        description: "Route execution to different branches based on AI evaluation, comparison operators, or workflow jumps.",
        usageNotes: `- Supports two modes: "ai" (default) uses an AI model to pick the most accurate statement; "comparison" uses operator-based checks.
- In AI mode, the model picks the most accurate statement from the list. All possible cases must be specified.
- In comparison mode, the context is the left operand and each case's condition is the right operand. First matching case wins. Use operator "default" as a fallback.
- Requires at least two cases.
- Each case can transition to a step in the current workflow (destinationStepId) or jump to another workflow (destinationWorkflowId).`,
        inputSchema: { "type": "object", "properties": { "mode": { "enum": ["ai", "comparison"], "type": "string", "description": "Evaluation mode: 'ai' for LLM-based, 'comparison' for operator-based. Default: 'ai'" }, "context": { "type": "string", "description": "AI mode: prompt context. Comparison mode: left operand (resolved via variables)." }, "cases": { "type": "array", "items": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string", "description": "Unique case identifier" }, "condition": { "type": "string", "description": "AI mode: statement to evaluate. Comparison mode: right operand value." }, "operator": { "enum": ["eq", "neq", "gt", "lt", "gte", "lte", "exists", "not_exists", "contains", "not_contains", "default"], "type": "string", "description": "Comparison operator (comparison mode only)" }, "destinationStepId": { "type": "string", "description": "Step to transition to if this case wins (workflow mode only)" }, "destinationWorkflowId": { "type": "string", "description": "Workflow to jump to if this case wins (uses that workflow's initial step)" } }, "required": ["id", "condition"] }, { "type": "string" }] }, "description": "List of conditions to evaluate (objects for managed UIs, strings for code)" }, "modelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Optional model settings override; uses the organization default if not specified (AI mode only)" } }, "required": ["context", "cases"], "description": "Configuration for the router step" },
        outputSchema: { "type": "object", "properties": { "selectedCase": { "type": "number", "description": "The index of the winning case" } }, "required": ["selectedCase"] }
      },
      "makeDotComRunScenario": {
        stepType: "makeDotComRunScenario",
        description: "Trigger a Make.com (formerly Integromat) scenario via webhook and return the response.",
        usageNotes: "- The webhook URL must be configured in your Make.com scenario.\n- Input key-value pairs are sent as JSON in the POST body.\n- Response format depends on the Make.com scenario configuration.",
        inputSchema: { "type": "object", "properties": { "webhookUrl": { "type": "string", "description": "Make.com webhook URL for the scenario" }, "input": { "type": "object", "properties": {}, "required": [], "description": "Key-value pairs to send as the JSON POST body" } }, "required": ["webhookUrl", "input"] },
        outputSchema: { "type": "object", "properties": { "data": { "description": "Response from the Make.com scenario (JSON or string depending on scenario configuration)" } }, "required": ["data"] }
      },
      "mergeAudio": {
        stepType: "mergeAudio",
        description: "Merge one or more clips into a single audio file.",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "mp3Urls": { "type": "array", "items": { "type": "string" }, "description": "URLs of the MP3 audio clips to merge in order" }, "fileMetadata": { "type": "object", "properties": {}, "required": [], "description": "FFmpeg MP3 metadata key-value pairs to embed in the output file" }, "albumArtUrl": { "type": "string", "description": "URL of an image to embed as album art in the output file" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["mp3Urls"] },
        outputSchema: { "type": "object", "properties": { "audioUrl": { "type": "string", "description": "URL of the merged audio file" } }, "required": ["audioUrl"] }
      },
      "mergeVideos": {
        stepType: "mergeVideos",
        description: "Merge one or more clips into a single video.",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrls": { "type": "array", "items": { "type": "string" }, "description": "URLs of the video clips to merge in order" }, "transition": { "type": "string", "description": "Optional xfade transition effect name" }, "transitionDuration": { "type": "number", "description": "Duration of the transition in seconds" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrls"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the merged video" } }, "required": ["videoUrl"] }
      },
      "meshyAnimate": {
        stepType: "meshyAnimate",
        description: "Apply a preset animation to a rigged 3D character model using Meshy.",
        usageNotes: "- Requires a rig_task_id from a previously completed Meshy rigging step.\n- Select an animation from Meshy's library of 600+ preset animations.\n- Only works with humanoid (bipedal) rigged characters.\n- Supports post-processing: FPS change (24/25/30/60), FBX-to-USDZ conversion, or armature extraction.\n- Animation categories: DailyActions, WalkAndRun, Fighting, Dancing, BodyMovements.",
        inputSchema: { "type": "object", "properties": { "rigTaskId": { "type": "string", "description": "ID of a completed Meshy rigging task" }, "actionId": { "type": "number", "description": "Animation action ID from the Meshy animation library" } }, "required": ["rigTaskId", "actionId"] },
        outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
      },
      "meshyImageTo3d": {
        stepType: "meshyImageTo3d",
        description: "Generate a 3D model from one or more images using Meshy. Uses the multi-image-to-3D endpoint.",
        usageNotes: "- Accepts 1-4 image URLs. All images should depict the same object from different angles for best results.\n- By default generates with textures. Set shouldTexture to false for mesh-only output.\n- Uses should_remesh: false to preserve UV mapping integrity.",
        inputSchema: { "type": "object", "properties": { "imageUrls": { "type": "array", "items": { "type": "string" }, "description": "1-4 image URLs depicting the same object from different angles" }, "shouldTexture": { "type": "boolean", "description": "Whether to generate textures (default true)" }, "topology": { "type": "string", "description": '"triangle" (default) or "quad"' }, "targetPolycount": { "type": "number", "description": "Target polygon count (default 30000, range 100-300000)" }, "symmetryMode": { "type": "string", "description": 'Symmetry mode: "auto" (default), "off", or "on"' }, "poseMode": { "type": "string", "description": 'Pose mode: "a-pose", "t-pose", or "" (default, no specific pose)' }, "textureImageUrl": { "type": "string", "description": "2D image URL to guide the texturing process (.jpg, .jpeg, .png)" } }, "required": ["imageUrls"] },
        outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
      },
      "meshyRemesh": {
        stepType: "meshyRemesh",
        description: "Remesh an existing 3D model to adjust topology, polygon count, or convert formats using Meshy.",
        usageNotes: "- Provide either an input task ID (from a previous Meshy step) or a model URL.\n- Defaults to triangle topology with 30,000 target polys.\n- Useful for reducing face count before rigging (max 300k faces for rigging).",
        inputSchema: { "type": "object", "properties": { "inputTaskId": { "type": "string", "description": "ID of a completed Meshy task to remesh" }, "modelUrl": { "type": "string", "description": "URL to a 3D model file (.glb, .fbx, .obj, .stl)" }, "topology": { "type": "string", "description": 'Topology: "triangle" (default) or "quad"' }, "targetPolycount": { "type": "number", "description": "Target polygon count (default 30000, range 100-300000)" }, "resizeHeight": { "type": "number", "description": "Resize model to this height in meters (0 or omitted = no resize)" } } },
        outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
      },
      "meshyRig": {
        stepType: "meshyRig",
        description: "Auto-rig a humanoid 3D model and generate basic walking/running animations using Meshy.",
        usageNotes: "- Only works well with standard humanoid (bipedal) models with clearly defined limbs.\n- Prefers model_url over input_task_id for cleaner rigging input.\n- Models with more than 300,000 faces should be remeshed first.\n- Returns rigged model files and optional basic animations.",
        inputSchema: { "type": "object", "properties": { "inputTaskId": { "type": "string", "description": "ID of a completed Meshy task to rig" }, "modelUrl": { "type": "string", "description": "URL to a textured humanoid GLB file (preferred over inputTaskId)" }, "heightMeters": { "type": "number", "description": "Approximate character height in meters (default 1.7)" } } },
        outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
      },
      "meshyTextTo3d": {
        stepType: "meshyTextTo3d",
        description: "Generate a 3D model preview from a text prompt using Meshy. Produces an untextured mesh (preview stage).",
        usageNotes: "- Creates a text-to-3D preview task (mesh generation only, no texture).\n- Use the Meshy Texture step to apply textures to the preview.\n- Maximum prompt length is 600 characters.",
        inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Description of the 3D model to generate (max 600 characters)" }, "modelType": { "type": "string", "description": '"standard" (default) or "lowpoly". Lowpoly ignores topology/target_polycount.' }, "topology": { "type": "string", "description": '"triangle" (default) or "quad"' }, "targetPolycount": { "type": "number", "description": "Target polygon count (default 30000, range 100-300000)" }, "symmetryMode": { "type": "string", "description": 'Symmetry mode: "auto" (default), "off", or "on"' }, "poseMode": { "type": "string", "description": 'Pose mode: "a-pose", "t-pose", or "" (default, no specific pose)' } }, "required": ["prompt"] },
        outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
      },
      "meshyTexture": {
        stepType: "meshyTexture",
        description: "Apply or replace textures on a 3D model using a text prompt or reference image via Meshy.",
        usageNotes: "- Provide either an input task ID (from a previous Meshy step) or a model URL.\n- Provide either a text style prompt or an image style URL to guide texturing.\n- Supports .glb, .gltf, .obj, .fbx, .stl model formats when using modelUrl.\n- By default preserves original UVs (enableOriginalUv = true).\n- Works with any model source: text-to-3D previews, image-to-3D, remeshed models, or external files.",
        inputSchema: { "type": "object", "properties": { "inputTaskId": { "type": "string", "description": "ID of a completed Meshy task to texture" }, "modelUrl": { "type": "string", "description": "URL to a 3D model file (.glb, .gltf, .obj, .fbx, .stl)" }, "textStylePrompt": { "type": "string", "description": "Text description of desired texture style (max 600 characters)" }, "imageStyleUrl": { "type": "string", "description": "2D image URL to guide texturing (.jpg, .jpeg, .png)" }, "enableOriginalUv": { "type": "boolean", "description": "Preserve original UV mapping (default true)" }, "enablePbr": { "type": "boolean", "description": "Generate PBR maps (metallic, roughness, normal). Default false." } } },
        outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
      },
      "mixAudioIntoVideo": {
        stepType: "mixAudioIntoVideo",
        description: "Mix an audio track into a video",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video" }, "audioUrl": { "type": "string", "description": "URL of the audio track to mix into the video" }, "options": { "type": "object", "properties": { "keepVideoAudio": { "type": "boolean", "description": "When true, preserves the original video audio alongside the new track. Defaults to false." }, "audioGainDb": { "type": "number", "description": "Volume adjustment for the new audio track in decibels. Defaults to 0." }, "videoGainDb": { "type": "number", "description": "Volume adjustment for the existing video audio in decibels. Defaults to 0." }, "loopAudio": { "type": "boolean", "description": "When true, loops the audio track to match the video duration. Defaults to false." } }, "description": "Audio mixing options" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "audioUrl", "options"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with the mixed audio track" } }, "required": ["videoUrl"] }
      },
      "muteVideo": {
        stepType: "muteVideo",
        description: "Mute a video file",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to mute" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the muted video" } }, "required": ["videoUrl"] }
      },
      "n8nRunNode": {
        stepType: "n8nRunNode",
        description: "Trigger an n8n workflow node via webhook and return the response.",
        usageNotes: "- The webhook URL must be configured in your n8n workflow.\n- Supports GET and POST methods with optional Basic authentication.\n- For GET requests, input values are sent as query parameters. For POST, they are sent as JSON body.",
        inputSchema: { "type": "object", "properties": { "method": { "type": "string", "description": "HTTP method to use (GET or POST)" }, "authentication": { "enum": ["none", "basic", "string"], "type": "string", "description": "Authentication type for the webhook request" }, "user": { "type": "string", "description": "Username for Basic authentication" }, "password": { "type": "string", "description": "Password for Basic authentication" }, "webhookUrl": { "type": "string", "description": "n8n webhook URL for the workflow node" }, "input": { "type": "object", "properties": {}, "required": [], "description": "Key-value pairs sent as query params (GET) or JSON body (POST)" } }, "required": ["method", "authentication", "user", "password", "webhookUrl", "input"] },
        outputSchema: { "type": "object", "properties": { "data": { "description": "Response from the n8n node (JSON or string depending on node configuration)" } }, "required": ["data"] }
      },
      "notionCreatePage": {
        stepType: "notionCreatePage",
        description: "Create a new page in Notion as a child of an existing page.",
        usageNotes: "- Requires a Notion OAuth connection (connectionId).\n- Content is provided as markdown and converted to Notion blocks (headings, paragraphs, lists, code, quotes).\n- The page is created as a child of the specified parent page (pageId).",
        inputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "Parent page ID to create the new page under" }, "content": { "type": "string", "description": "Page content in markdown format" }, "title": { "type": "string", "description": "Page title" }, "connectionId": { "type": "string", "description": "Notion OAuth connection ID" } }, "required": ["pageId", "content", "title"] },
        outputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "Notion page ID of the created page" }, "pageUrl": { "type": "string", "description": "URL to view the page in Notion" } }, "required": ["pageId", "pageUrl"] }
      },
      "notionUpdatePage": {
        stepType: "notionUpdatePage",
        description: "Update the content of an existing Notion page.",
        usageNotes: '- Requires a Notion OAuth connection (connectionId).\n- Content is provided as markdown and converted to Notion blocks.\n- "append" mode adds content to the end of the page. "overwrite" mode deletes all existing blocks first.',
        inputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "Notion page ID to update" }, "content": { "type": "string", "description": "New content in markdown format" }, "mode": { "enum": ["append", "overwrite"], "type": "string", "description": "How to apply the content: 'append' adds to end, 'overwrite' replaces all existing content" }, "connectionId": { "type": "string", "description": "Notion OAuth connection ID" } }, "required": ["pageId", "content", "mode"] },
        outputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "Notion page ID of the updated page" }, "pageUrl": { "type": "string", "description": "URL to view the page in Notion" } }, "required": ["pageId", "pageUrl"] }
      },
      "particlePodcastsFindMentions": {
        stepType: "particlePodcastsFindMentions",
        description: "Find every dialogue line mentioning a specific entity or company across all podcasts.",
        usageNotes: "- Provide `entityId` (for people, products, places) OR `companyId` (for organizations). At least one is required.\n- Use `contextLines` to include surrounding dialogue with each mention (default behavior is set by Particle).\n- Resolve a name to an `entityId` / `companyId` first via Search Companies (or by inspecting a Search Dialogue response).\n- Cursor-paginated; expect potentially large result sets for popular entities.",
        inputSchema: { "type": "object", "properties": { "entityId": { "type": "string", "description": "Knowledge-graph entity ID (person, product, place, etc.)" }, "companyId": { "type": "string", "description": "Company ID" }, "contextLines": { "type": "number", "description": "Surrounding dialogue lines to include with each mention" }, "limit": { "type": "number", "description": "Max results, up to 100" }, "cursor": { "type": "string", "description": "Pagination cursor" } } },
        outputSchema: { "type": "string" }
      },
      "particlePodcastsGetEpisode": {
        stepType: "particlePodcastsGetEpisode",
        description: "Fetch full metadata for a single episode: details, speakers, entities, clips, and ads \u2014 merged into one response.",
        usageNotes: "- Pass an episode ID or slug as `id`.\n- Returns five sub-resources merged: `episode` (metadata), `speakers` (diarized speaker list), `entities` (knowledge-graph mentions), `clips` (AI-extracted highlights), `ads` (detected ad spots).\n- Use Get Episode Transcript separately when you need the full transcript text \u2014 it isn't bundled here because the payload is large and has its own format/range options.\n- Bills as 5 units against the get-episode event type (one per sub-call).",
        inputSchema: { "type": "object", "properties": { "id": { "type": "string", "description": "Episode ID or slug" } }, "required": ["id"] },
        outputSchema: { "type": "string" }
      },
      "particlePodcastsGetEpisodeTranscript": {
        stepType: "particlePodcastsGetEpisodeTranscript",
        description: "Fetch the diarized transcript for an episode in dialogue, plain text, or SRT subtitle format.",
        usageNotes: '- Pass an episode ID or slug as `id`.\n- Use `format` = "dialogue" (default, with speaker turns), "text" (plain), or "srt" (subtitle).\n- Filter to a single speaker with `speaker`, or to a time range with `start` / `end` (seconds).\n- Transcripts are large \u2014 prefer time-range filtering when you only need a snippet.',
        inputSchema: { "type": "object", "properties": { "id": { "type": "string", "description": "Episode ID or slug" }, "format": { "enum": ["dialogue", "text", "srt"], "type": "string", "description": "Transcript format" }, "speaker": { "type": "string", "description": "Filter to a single speaker" }, "start": { "type": "number", "description": "Start time in seconds" }, "end": { "type": "number", "description": "End time in seconds" } }, "required": ["id"] },
        outputSchema: { "type": "string" }
      },
      "particlePodcastsSearchCompanies": {
        stepType: "particlePodcastsSearchCompanies",
        description: "Search the Particle knowledge graph for companies by name, ticker, domain, CIK, or QID.",
        usageNotes: '- Provide one or more identifiers: `q` (free-text name), `ticker` (e.g. "TSLA"), `domain` (e.g. "tesla.com"), `cik` (SEC), or `qid` (Wikidata).\n- Use this to resolve a company name to a canonical `companyId` for use with Find Mentions or Search Dialogue.\n- Returned company objects include slugs, domains, and IDs \u2014 any of these can be passed to downstream blocks.',
        inputSchema: { "type": "object", "properties": { "q": { "type": "string", "description": "Free-text company name" }, "ticker": { "type": "string", "description": "Stock ticker" }, "domain": { "type": "string", "description": "Company domain" }, "cik": { "type": "string", "description": "SEC CIK" }, "qid": { "type": "string", "description": "Wikidata QID" }, "entityId": { "type": "string", "description": "Knowledge-graph entity ID" }, "updatedAfter": { "type": "string", "description": "Only include companies updated after this ISO timestamp" }, "limit": { "type": "number", "description": "Max results" }, "cursor": { "type": "string", "description": "Pagination cursor" } } },
        outputSchema: { "type": "string" }
      },
      "particlePodcastsSearchDialogue": {
        stepType: "particlePodcastsSearchDialogue",
        description: "Search across podcast dialogue using semantic or keyword search. Returns matched lines grouped by episode.",
        usageNotes: '- Provide `semanticSearch` for meaning-based discovery ("find moments where someone talks about market timing") or `keywordSearch` for exact phrase/proper-noun matching. At least one must be provided.\n- Filter to a specific entity or company by passing `entityId` / `companyId`.\n- Each returned dialogue line carries the source episode + speaker so you can chain to Get Episode or Get Episode Transcript for context.\n- Cursor-paginated.',
        inputSchema: { "type": "object", "properties": { "semanticSearch": { "type": "string", "description": "Meaning-based dialogue search" }, "keywordSearch": { "type": "string", "description": "Exact-phrase dialogue search" }, "entityId": { "type": "string", "description": "Restrict to dialogue mentioning this entity" }, "companyId": { "type": "string", "description": "Restrict to dialogue mentioning this company" }, "limit": { "type": "number", "description": "Max results, up to 100" }, "cursor": { "type": "string", "description": "Pagination cursor" } } },
        outputSchema: { "type": "string" }
      },
      "particlePodcastsSearchPodcasts": {
        stepType: "particlePodcastsSearchPodcasts",
        description: "Search and list podcasts in the Particle catalog by keyword, topic, or language.",
        usageNotes: '- Use `q` for free-text keyword search across podcast titles and descriptions.\n- Use `topic` to filter to a Particle taxonomy topic.\n- Use `language` (BCP 47, e.g. "en") to restrict to a language.\n- Returns podcast objects with canonical IDs and slugs. Pass either to other Particle Podcasts blocks.\n- Cursor-paginated; pass the returned `cursor` back to `cursor` for the next page.',
        inputSchema: { "type": "object", "properties": { "q": { "type": "string", "description": "Free-text query across podcast title and description" }, "topic": { "type": "string", "description": "Particle taxonomy topic slug" }, "language": { "type": "string", "description": "BCP 47 language code" }, "suitabilityTier": { "type": "string", "description": "Brand-suitability tier filter" }, "limit": { "type": "number", "description": "Max results, up to 100" }, "cursor": { "type": "string", "description": "Pagination cursor" } } },
        outputSchema: { "type": "string" }
      },
      "peopleSearch": {
        stepType: "peopleSearch",
        description: "Search for people matching specific criteria using Apollo.io. Supports natural language queries and advanced filters.",
        usageNotes: '- Can use a natural language "smartQuery" which is converted to Apollo search parameters by an AI model.\n- Advanced params can override or supplement the smart query results.\n- Optionally enriches returned people and/or their organizations for additional detail.\n- Results are paginated. Use limit and page to control the result window.',
        inputSchema: { "type": "object", "properties": { "smartQuery": { "type": "string", "description": 'Natural language search query (e.g. "marketing directors at SaaS companies in NYC")' }, "enrichPeople": { "type": "boolean", "description": "Whether to enrich each result with full contact details" }, "enrichOrganizations": { "type": "boolean", "description": "Whether to enrich each result with full company details" }, "limit": { "type": "string", "description": "Maximum number of results to return" }, "page": { "type": "string", "description": "Page number for pagination" }, "params": { "type": "object", "properties": { "personTitles": { "type": "string", "description": "Job titles to search for (comma-separated)" }, "includeSimilarTitles": { "type": "string", "description": "Whether to include similar/related job titles" }, "qKeywords": { "type": "string", "description": "Keywords to search for in person profiles" }, "personLocations": { "type": "string", "description": "Geographic locations of people (comma-separated)" }, "personSeniorities": { "type": "string", "description": "Seniority levels to filter by (comma-separated)" }, "organizationLocations": { "type": "string", "description": "Geographic locations of organizations (comma-separated)" }, "qOrganizationDomainsList": { "type": "string", "description": "Organization domains to filter by (comma-separated)" }, "contactEmailStatus": { "type": "string", "description": "Email verification status filter" }, "organizationNumEmployeesRanges": { "type": "string", "description": 'Employee count ranges as semicolon-separated pairs (e.g. "1,10; 250,500")' }, "revenueRangeMin": { "type": "string", "description": "Minimum annual revenue filter" }, "revenueRangeMax": { "type": "string", "description": "Maximum annual revenue filter" }, "currentlyUsingAllOfTechnologyUids": { "type": "string", "description": "Technology UIDs the organization must use (all required)" }, "currentlyUsingAnyOfTechnologyUids": { "type": "string", "description": "Technology UIDs the organization uses (any match)" }, "currentlyNotUsingAnyOfTechnologyUids": { "type": "string", "description": "Technology UIDs the organization must not use" } }, "required": ["personTitles", "includeSimilarTitles", "qKeywords", "personLocations", "personSeniorities", "organizationLocations", "qOrganizationDomainsList", "contactEmailStatus", "organizationNumEmployeesRanges", "revenueRangeMin", "revenueRangeMax", "currentlyUsingAllOfTechnologyUids", "currentlyUsingAnyOfTechnologyUids", "currentlyNotUsingAnyOfTechnologyUids"], "description": "Advanced search filter parameters" } }, "required": ["smartQuery", "enrichPeople", "enrichOrganizations", "limit", "page", "params"] },
        outputSchema: { "type": "object", "properties": { "results": { "description": "Apollo search results with matched people and optionally enriched data" } }, "required": ["results"] }
      },
      "postToLinkedIn": {
        stepType: "postToLinkedIn",
        description: "Create a post on LinkedIn from the connected account.",
        usageNotes: "- Requires a LinkedIn OAuth connection (connectionId).\n- Supports text posts, image posts, video posts, document posts, and article posts.\n- Attach one media type per post: image, video, document, or article.\n- Documents support PDF, PPT, PPTX, DOC, DOCX (max 100MB, 300 pages). Displays as a slideshow carousel.\n- Articles create a link preview with optional custom title, description, and thumbnail.\n- Visibility controls who can see the post.",
        inputSchema: { "type": "object", "properties": { "message": { "type": "string", "description": "The text content of the LinkedIn post" }, "visibility": { "enum": ["PUBLIC", "CONNECTIONS"], "type": "string", "description": 'Who can see the post: "PUBLIC" or "CONNECTIONS"' }, "imageUrl": { "type": "string", "description": "URL of an image to attach to the post" }, "videoUrl": { "type": "string", "description": "URL of a video to attach to the post" }, "documentUrl": { "type": "string", "description": "URL of a document (PDF, PPT, DOC) to attach to the post" }, "articleUrl": { "type": "string", "description": "URL to share as an article link preview" }, "titleText": { "type": "string", "description": "Title text for media or article attachments" }, "descriptionText": { "type": "string", "description": "Description text for article attachments" }, "connectionId": { "type": "string", "description": "LinkedIn OAuth connection ID" } }, "required": ["message", "visibility"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "postToSlackChannel": {
        stepType: "postToSlackChannel",
        description: "Send a message to a Slack channel via a connected bot.",
        usageNotes: "- The user is responsible for connecting their Slack workspace and selecting the channel\n- Supports both simple text messages and slack blocks messages\n- Text messages can use limited markdown (slack-only fomatting\u2014e.g., headers are just rendered as bold)",
        inputSchema: { "type": "object", "properties": { "channelId": { "type": "string", "description": "Slack channel ID (leave empty to allow user to select a channel)" }, "messageType": { "enum": ["string", "blocks"], "type": "string", "description": 'Message format: "string" for plain text/markdown, "blocks" for Slack Block Kit JSON' }, "message": { "type": "string", "description": 'Message content (plain text/markdown for "string" type, or JSON for "blocks" type)' }, "connectionId": { "type": "string", "description": "Slack OAuth connection ID (leave empty to allow user to select)" } }, "required": ["channelId", "messageType", "message"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "postToX": {
        stepType: "postToX",
        description: "Create a post on X (Twitter) from the connected account.",
        usageNotes: "- Requires an X OAuth connection (connectionId).\n- Maximum 280 characters of text.\n- Optionally attach up to 4 media items (images, GIFs, or videos) via mediaUrls.\n- Media URLs must be publicly accessible. The service fetches and uploads them to X.\n- Supported formats: JPEG, PNG, GIF, WEBP, MP4. Images up to 5MB, videos up to 512MB.",
        inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The text content of the post (max 280 characters)" }, "connectionId": { "type": "string", "description": "X (Twitter) OAuth connection ID" }, "mediaUrls": { "type": "array", "items": { "type": "string" }, "description": "Up to 4 URLs of images, GIFs, or videos to attach to the post" } }, "required": ["text"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "postToZapier": {
        stepType: "postToZapier",
        description: "Send data to a Zapier Zap via webhook and return the response.",
        usageNotes: "- The webhook URL must be configured in the Zapier Zap settings\n- Input keys and values are sent as the JSON body of the POST request\n- The webhook response (JSON or plain text) is returned as the output",
        inputSchema: { "type": "object", "properties": { "webhookUrl": { "type": "string", "description": "Zapier webhook URL to send data to" }, "input": { "type": "object", "properties": {}, "required": [], "description": "Key-value pairs to send as the JSON POST body" } }, "required": ["webhookUrl", "input"] },
        outputSchema: { "type": "object", "properties": { "data": { "description": "Parsed webhook response from Zapier (JSON object, array, or string)" } }, "required": ["data"] }
      },
      "queryAppDatabase": {
        stepType: "queryAppDatabase",
        description: "Execute a SQL query against the app managed database.",
        usageNotes: '- Executes raw SQL against a SQLite database managed by the app.\n- For SELECT queries, returns rows as JSON.\n- For INSERT/UPDATE/DELETE, returns the number of affected rows.\n- Use {{variables}} directly in your SQL. By default they are automatically extracted\n  and passed as safe parameterized values (preventing SQL injection).\n  Example: INSERT INTO contacts (name, comment) VALUES ({{name}}, {{comment}})\n- Full MindStudio handlebars syntax is supported, including helpers like {{json myVar}},\n  {{get myVar "$.path"}}, {{global.orgName}}, etc.\n- Set parameterize to false for raw/dynamic SQL where variables are interpolated directly\n  into the query string. Use this when another step generates full or partial SQL, e.g.\n  a bulk INSERT with a precomputed VALUES list. The user is responsible for sanitization\n  when parameterize is false.',
        inputSchema: { "type": "object", "properties": { "databaseId": { "type": "string", "description": "Name or ID of the app data database to query" }, "sql": { "type": "string", "description": "SQL query to execute. Use {{variables}} directly in the SQL \u2014 they are handled according to the `parameterize` setting.\n\nWhen parameterize is true (default):   {{variables}} are extracted from the SQL, replaced with ? placeholders,   resolved via the full MindStudio handlebars pipeline, and passed as safe   parameterized values to SQLite. This prevents SQL injection.   Example: INSERT INTO contacts (name, email) VALUES ({{name}}, {{email}})\n\nWhen parameterize is false:   The entire SQL string is resolved via compileString (standard handlebars   interpolation) and executed as-is. Use this for dynamic/generated SQL   where another step builds the query. The user is responsible for safety.   Example: {{generatedInsertQuery}}\n\nAsk the user for the database schema if they have not already provided it." }, "parameterize": { "type": "boolean", "description": "Whether to treat {{variables}} as parameterized query values (default: true).\n\n- true:  {{vars}} are extracted, replaced with ?, and passed as bind params.          Safe from SQL injection. Use for standard CRUD operations.\n- false: {{vars}} are interpolated directly into the SQL string via handlebars.          Use when another step generates full or partial SQL (e.g. bulk inserts          with precomputed VALUES). The user is responsible for sanitization." } }, "required": ["databaseId", "sql"] },
        outputSchema: { "type": "object", "properties": { "rows": { "type": "array", "items": {}, "description": "Result rows for SELECT queries (empty array for write queries)" }, "changes": { "type": "number", "description": "Number of rows affected by INSERT, UPDATE, or DELETE queries (0 for SELECT)" } }, "required": ["rows", "changes"] }
      },
      "queryDataSource": {
        stepType: "queryDataSource",
        description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Search a vector data source (RAG) and return relevant document chunks.",
        usageNotes: "- Queries a vectorized data source and returns the most relevant chunks.\n- Useful for retrieval-augmented generation (RAG) workflows.",
        inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the vector data source to query" }, "query": { "type": "string", "description": "The search query to run against the data source" }, "maxResults": { "type": "number", "description": "Maximum number of chunks to return (recommended 1-3)" } }, "required": ["dataSourceId", "query", "maxResults"] },
        outputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "All matching chunks joined with newlines" }, "chunks": { "type": "array", "items": { "type": "string" }, "description": "Individual matching text chunks from the data source" }, "query": { "type": "string", "description": "The resolved search query that was executed" }, "citations": { "type": "array", "items": {}, "description": "Source citations for the matched chunks" }, "latencyMs": { "type": "number", "description": "Query execution time in milliseconds" } }, "required": ["text", "chunks", "query", "citations", "latencyMs"] }
      },
      "queryExternalDatabase": {
        stepType: "queryExternalDatabase",
        description: "Execute a SQL query against an external database connected to the workspace.",
        usageNotes: "- Requires a database connection configured in the workspace.\n- Supports PostgreSQL (including Supabase), MySQL, and MSSQL.\n- Results can be returned as JSON or CSV.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Database connection ID configured in the workspace" }, "query": { "type": "string", "description": "SQL query to execute (supports variable interpolation)" }, "outputFormat": { "enum": ["json", "csv"], "type": "string", "description": "Output format for the result variable" } }, "required": ["query", "outputFormat"], "description": "Configuration for the external database query step" },
        outputSchema: { "type": "object", "properties": { "data": { "description": "Query result rows (array of objects for JSON, CSV string for CSV format)" } }, "required": ["data"] }
      },
      "redactPII": {
        stepType: "redactPII",
        description: "Replace personally identifiable information in text with placeholders using Microsoft Presidio.",
        usageNotes: '- PII is replaced with entity type placeholders (e.g. "Call me at <PHONE_NUMBER>").\n- If entities is empty, returns empty text immediately without processing.',
        inputSchema: { "type": "object", "properties": { "input": { "type": "string", "description": "Text to redact PII from" }, "language": { "type": "string", "description": 'Language code of the input text (e.g. "en")' }, "entities": { "type": "array", "items": { "type": "string" }, "description": 'PII entity types to redact (e.g. ["PHONE_NUMBER", "EMAIL_ADDRESS"]). Empty array means nothing is redacted.' } }, "required": ["input", "language", "entities"] },
        outputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": 'The input text with detected PII replaced by entity type placeholders (e.g. "<PHONE_NUMBER>")' } }, "required": ["text"] }
      },
      "removeBackgroundFromImage": {
        stepType: "removeBackgroundFromImage",
        description: "Remove the background from an image using AI, producing a transparent PNG.",
        usageNotes: `- Uses the Bria background removal model via fal.ai by default.
- Uses WaveSpeed's Ideogram background removal model when type is "advanced".
- Output is re-hosted on the CDN as a PNG with transparency.`,
        inputSchema: { "type": "object", "properties": { "type": { "enum": ["standard", "advanced"], "type": "string", "description": "Background removal quality tier" }, "imageUrl": { "type": "string", "description": "URL of the source image to remove the background from" }, "autoCrop": { "type": "boolean", "description": "Whether to automatically trim transparent padding from the result, on by default" } }, "required": ["imageUrl"] },
        outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the image with background removed (transparent PNG)" } }, "required": ["imageUrl"] }
      },
      "replyToGmailEmail": {
        stepType: "replyToGmailEmail",
        description: "Reply to an existing email in Gmail. The reply is threaded under the original message.",
        usageNotes: '- Requires a Google OAuth connection with Gmail compose and readonly scopes.\n- The reply is sent to the original sender and threaded under the original message.\n- messageType controls the body format: "plain", "html", or "markdown".',
        inputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID to reply to" }, "message": { "type": "string", "description": "Reply body content" }, "messageType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Body format: "plain", "html", or "markdown"' }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageId", "message", "messageType"] },
        outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID of the sent reply" } }, "required": ["messageId"] }
      },
      "resizeVideo": {
        stepType: "resizeVideo",
        description: "Resize a video file",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to resize" }, "mode": { "enum": ["fit", "exact"], "type": "string", "description": "Resize mode: 'fit' scales within max dimensions, 'exact' forces exact dimensions" }, "maxWidth": { "type": "number", "description": "Maximum width in pixels (used with 'fit' mode)" }, "maxHeight": { "type": "number", "description": "Maximum height in pixels (used with 'fit' mode)" }, "width": { "type": "number", "description": "Exact width in pixels (used with 'exact' mode)" }, "height": { "type": "number", "description": "Exact height in pixels (used with 'exact' mode)" }, "strategy": { "enum": ["pad", "crop"], "type": "string", "description": "Strategy for handling aspect ratio mismatch in 'exact' mode" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "mode"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the resized video" } }, "required": ["videoUrl"] }
      },
      "runFromConnectorRegistry": {
        stepType: "runFromConnectorRegistry",
        description: "Run a raw API connector to a third-party service",
        usageNotes: '- Use the /developer/v2/helpers/connectors endpoint to list available services and actions.\n- Use /developer/v2/helpers/connectors/{serviceId}/{actionId} to get the full input configuration for an action.\n- Use /developer/v2/helpers/connections to list your available OAuth connections.\n- The actionId format is "serviceId/actionId" (e.g., "slack/send-message").\n- Pass a __connectionId to authenticate the request with a specific OAuth connection, otherwise the default will be used (if configured).',
        inputSchema: { "type": "object", "properties": { "actionId": { "type": "string", "description": "The connector action identifier in the format serviceId/actionId" }, "displayName": { "type": "string", "description": "Human-readable name of the connector action" }, "icon": { "type": "string", "description": "Icon URL for the connector" }, "configurationValues": { "type": "object", "properties": {}, "required": [], "description": "Key-value configuration parameters for the connector action" }, "__connectionId": { "type": "string", "description": "OAuth connection ID used to authenticate the connector request" } }, "required": ["actionId", "displayName", "icon", "configurationValues"], "description": "Configuration for the connector registry step" },
        outputSchema: { "type": "object", "properties": { "data": { "type": "object", "properties": {}, "required": [], "description": "Key-value map of output variables set by the connector" } }, "required": ["data"] }
      },
      "runPackagedWorkflow": {
        stepType: "runPackagedWorkflow",
        description: 'Run a packaged workflow ("custom block")',
        usageNotes: `- From the user's perspective, packaged workflows are just ordinary blocks. Behind the scenes, they operate like packages/libraries in a programming language, letting the user execute custom functionality.
- Some of these packaged workflows are available as part of MindStudio's "Standard Library" and available to every user.
- Available packaged workflows are documented here as individual blocks, but the runPackagedWorkflow block is how they need to be wrapped in order to be executed correctly.`,
        inputSchema: { "type": "object", "properties": { "appId": { "type": "string", "description": "The app ID of the packaged workflow source" }, "workflowId": { "type": "string", "description": "The source workflow ID to execute" }, "inputVariables": { "type": "object", "properties": {}, "required": [], "description": "Variables to pass as input to the packaged workflow" }, "outputVariables": { "type": "object", "properties": {}, "required": [], "description": "Variables to capture from the packaged workflow output" }, "name": { "type": "string", "description": "Display name of the packaged workflow" } }, "required": ["appId", "workflowId", "inputVariables", "outputVariables", "name"], "description": "Configuration for the packaged workflow step" },
        outputSchema: { "type": "object", "properties": { "data": { "description": "The result data returned from the packaged workflow" } }, "required": ["data"] }
      },
      "scrapeLinkedInCompany": {
        stepType: "scrapeLinkedInCompany",
        description: "Scrape public company data from a LinkedIn company page.",
        usageNotes: "- Requires a LinkedIn company URL (e.g. https://www.linkedin.com/company/mindstudioai).\n- Returns structured company data including description, employees, updates, and similar companies.",
        inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "LinkedIn company page URL (e.g. https://www.linkedin.com/company/mindstudioai)" } }, "required": ["url"] },
        outputSchema: { "type": "object", "properties": { "company": { "description": "Scraped LinkedIn company data" } }, "required": ["company"] }
      },
      "scrapeLinkedInProfile": {
        stepType: "scrapeLinkedInProfile",
        description: "Scrape public profile data from a LinkedIn profile page.",
        usageNotes: "- Requires a LinkedIn profile URL (e.g. https://www.linkedin.com/in/username).\n- Returns structured profile data including experience, education, articles, and activities.",
        inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "LinkedIn profile URL (e.g. https://www.linkedin.com/in/username)" } }, "required": ["url"] },
        outputSchema: { "type": "object", "properties": { "profile": { "description": "Scraped LinkedIn profile data" } }, "required": ["profile"] }
      },
      "scrapeUrl": {
        stepType: "scrapeUrl",
        description: "Extract text, HTML, or structured content from one or more web pages.",
        usageNotes: '- Accepts a single URL or multiple URLs (as a JSON array, comma-separated, or newline-separated).\n- Output format controls the result shape: "text" returns markdown, "html" returns raw HTML, "json" returns structured scraper data, "summary" returns a model-written summary and requires the "firecrawl" service.\n- Can optionally capture a screenshot of each page.\n- Handles bot protection automatically; no proxy or rendering configuration is needed.',
        inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "URL(s) to scrape. Accepts a single URL, JSON array, or comma/newline-separated list" }, "service": { "enum": ["default", "firecrawl"], "type": "string", "description": "Scraping service to use" }, "autoEnhance": { "type": "boolean", "description": "No longer selects a provider \u2014 the default service's anti-bot engine decides per request how hard to work. Retained because existing workflows set it and the builder still renders it." }, "outputFormat": { "enum": ["text", "json", "html", "summary"], "type": "string", "description": "Output format: text returns markdown, html returns raw HTML, json returns structured scraper data, summary returns a model-written summary (Firecrawl only)" }, "pageOptions": { "type": "object", "properties": { "onlyMainContent": { "type": "boolean", "description": "Whether to extract only the main content of the page, excluding navigation, footers, etc." }, "screenshot": { "type": "boolean", "description": "Whether to capture a screenshot of the page" }, "waitFor": { "type": "number", "description": "Milliseconds to wait before scraping (0 for immediate)" }, "replaceAllPathsWithAbsolutePaths": { "type": "boolean", "description": "Whether to convert relative URLs to absolute URLs in the result" }, "headers": { "type": "object", "properties": {}, "required": [], "description": "Custom HTTP request headers as key-value pairs" }, "removeTags": { "type": "array", "items": { "type": "string" }, "description": "HTML tags to remove from the scraped result" }, "mobile": { "type": "boolean", "description": "Whether to scrape using a mobile user-agent" } }, "required": ["onlyMainContent", "screenshot", "waitFor", "replaceAllPathsWithAbsolutePaths", "headers", "removeTags", "mobile"], "description": "Page-level scraping options (content filtering, screenshots, headers, etc.)" } }, "required": ["url"] },
        outputSchema: { "type": "object", "properties": { "content": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }, { "type": "object", "properties": { "text": { "type": "string", "description": "Markdown/plain-text content of the scraped page" }, "html": { "type": "string", "description": "Raw HTML content of the scraped page" }, "json": { "type": "object", "properties": {}, "required": [], "description": "Structured data extracted from the page" }, "screenshotUrl": { "type": "string", "description": "Screenshot URL of the page (if requested)" }, "metadata": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title" }, "description": { "type": "string", "description": "Page meta description" }, "url": { "type": "string", "description": "Canonical URL" }, "image": { "type": "string", "description": "Open Graph image URL" } }, "required": ["title", "description", "url", "image"], "description": "Page metadata (Open Graph / meta tags)" }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "description": "Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care \u2014 billing, in particular \u2014 can tell a failure from real page content." }, "costUnits": { "type": "number", "description": "What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.\n\nIncludes every attempt made on the caller's behalf, not just the last one." } }, "required": ["text", "html"] }, { "type": "array", "items": { "type": "object", "properties": { "text": { "type": "string", "description": "Markdown/plain-text content of the scraped page" }, "html": { "type": "string", "description": "Raw HTML content of the scraped page" }, "json": { "type": "object", "properties": {}, "required": [], "description": "Structured data extracted from the page" }, "screenshotUrl": { "type": "string", "description": "Screenshot URL of the page (if requested)" }, "metadata": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title" }, "description": { "type": "string", "description": "Page meta description" }, "url": { "type": "string", "description": "Canonical URL" }, "image": { "type": "string", "description": "Open Graph image URL" } }, "required": ["title", "description", "url", "image"], "description": "Page metadata (Open Graph / meta tags)" }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "description": "Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care \u2014 billing, in particular \u2014 can tell a failure from real page content." }, "costUnits": { "type": "number", "description": "What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.\n\nIncludes every attempt made on the caller's behalf, not just the last one." } }, "required": ["text", "html"] } }] }, "screenshot": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["content"] }
      },
      "scrapeXPost": {
        stepType: "scrapeXPost",
        description: "Scrape data from a single X (Twitter) post by URL.",
        usageNotes: "- Returns structured post data (text, html, optional json/screenshot/metadata).\n- Optionally saves the text content to a variable.",
        inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "Full URL to the X post (e.g. https://x.com/elonmusk/status/1655608985058267139)" } }, "required": ["url"] },
        outputSchema: { "type": "object", "properties": { "post": { "type": "object", "properties": { "text": { "type": "string", "description": "Markdown/plain-text content of the scraped page" }, "html": { "type": "string", "description": "Raw HTML content of the scraped page" }, "json": { "type": "object", "properties": {}, "required": [], "description": "Structured data extracted from the page" }, "screenshotUrl": { "type": "string", "description": "Screenshot URL of the page (if requested)" }, "metadata": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title" }, "description": { "type": "string", "description": "Page meta description" }, "url": { "type": "string", "description": "Canonical URL" }, "image": { "type": "string", "description": "Open Graph image URL" } }, "required": ["title", "description", "url", "image"], "description": "Page metadata (Open Graph / meta tags)" }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "description": "Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care \u2014 billing, in particular \u2014 can tell a failure from real page content." }, "costUnits": { "type": "number", "description": "What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.\n\nIncludes every attempt made on the caller's behalf, not just the last one." } }, "required": ["text", "html"], "description": "Scraped post data including text, HTML, and optional structured JSON" } }, "required": ["post"] }
      },
      "scrapeXProfile": {
        stepType: "scrapeXProfile",
        description: "Scrape public profile data from an X (Twitter) account by URL.",
        usageNotes: "- Returns structured profile data.\n- Optionally saves the result to a variable.",
        inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "Full URL or username for the X profile (e.g. https://x.com/elonmusk)" } }, "required": ["url"] },
        outputSchema: { "type": "object", "properties": { "profile": { "type": "object", "properties": { "text": { "type": "string", "description": "Markdown/plain-text content of the scraped page" }, "html": { "type": "string", "description": "Raw HTML content of the scraped page" }, "json": { "type": "object", "properties": {}, "required": [], "description": "Structured data extracted from the page" }, "screenshotUrl": { "type": "string", "description": "Screenshot URL of the page (if requested)" }, "metadata": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title" }, "description": { "type": "string", "description": "Page meta description" }, "url": { "type": "string", "description": "Canonical URL" }, "image": { "type": "string", "description": "Open Graph image URL" } }, "required": ["title", "description", "url", "image"], "description": "Page metadata (Open Graph / meta tags)" }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "description": "Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care \u2014 billing, in particular \u2014 can tell a failure from real page content." }, "costUnits": { "type": "number", "description": "What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.\n\nIncludes every attempt made on the caller's behalf, not just the last one." } }, "required": ["text", "html"], "description": "Scraped profile data including text, HTML, and optional structured JSON" } }, "required": ["profile"] }
      },
      "screenshotUrl": {
        stepType: "screenshotUrl",
        description: "Capture a screenshot of a web page as a PNG image.",
        usageNotes: "- Takes a viewport or full-page screenshot of the given URL.\n- Returns a CDN-hosted PNG image URL.\n- Viewport mode captures only the visible area; fullPage captures the entire scrollable page.\n- You can customize viewport width/height, add a delay, or wait for a CSS selector before capturing.",
        inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "URL to screenshot" }, "mode": { "enum": ["viewport", "fullPage"], "type": "string", "description": "Screenshot mode: viewport captures visible area, fullPage captures entire page" }, "width": { "type": "number", "description": "Viewport width in pixels (default: 1280)" }, "height": { "type": "number", "description": "Viewport height in pixels (default: 800, ignored for fullPage mode)" }, "delay": { "type": "number", "description": "Milliseconds to wait before capturing (default: 0)" }, "waitFor": { "type": "string", "description": "CSS selector to wait for before capturing" } }, "required": ["url"] },
        outputSchema: { "type": "object", "properties": { "screenshotUrl": { "type": "string" } }, "required": ["screenshotUrl"] }
      },
      "searchGmailEmails": {
        stepType: "searchGmailEmails",
        description: "Search for emails in the connected Gmail account using a Gmail search query. To list recent inbox emails, pass an empty query string.",
        usageNotes: '- Requires a Google OAuth connection with Gmail readonly scope.\n- Uses Gmail search syntax (e.g. "from:user@example.com", "subject:invoice", "is:unread").\n- To list recent inbox emails, use an empty query string or "in:inbox".\n- Returns up to 100 emails (default 5). The variable receives text or JSON depending on exportType.\n- The direct execution output always returns structured email objects.',
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": 'Gmail search query (e.g. "from:user@example.com", "subject:invoice", "is:unread")' }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "limit": { "type": "string", "description": "Maximum number of emails to return (1-10, default: 5)" } }, "required": ["query", "exportType", "limit"] },
        outputSchema: { "type": "object", "properties": { "emails": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Gmail message ID" }, "subject": { "type": "string", "description": "Email subject line" }, "from": { "type": "string", "description": "Sender email address" }, "to": { "type": "string", "description": "Recipient email address" }, "date": { "type": "string", "description": "Email date" }, "plainBody": { "type": "string", "description": "Plain text body content" }, "htmlBody": { "type": "string", "description": "HTML body content (if available)" }, "labels": { "type": "string", "description": "Comma-separated label IDs applied to the email" } }, "required": ["id", "subject", "from", "to", "date", "plainBody", "htmlBody", "labels"] }, "description": "List of matching email messages" } }, "required": ["emails"] }
      },
      "searchGoogle": {
        stepType: "searchGoogle",
        description: "Search the web using Google and return structured results.",
        usageNotes: "- Defaults to us/english, but can optionally specify country and/or language.\n- Defaults to any time, but can optionally specify last hour, last day, week, month, or year.\n- Defaults to top 30 results, but can specify 1 to 100 results to return.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "The search query to send to Google" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Format for the variable value: "text" or "json"' }, "countryCode": { "type": "string", "description": "Google gl country code (defaults to US)" }, "languageCode": { "type": "string", "description": 'Google hl language code (defaults to "en")' }, "dateRange": { "enum": ["hour", "day", "week", "month", "year", "any"], "type": "string", "description": 'Time range filter: "hour", "day", "week", "month", "year", or "any"' }, "numResults": { "type": "number", "description": "Number of results to return (1-100, default: 30)" } }, "required": ["query", "exportType"] },
        outputSchema: { "type": "object", "properties": { "results": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string", "description": "Title of the search result" }, "description": { "type": "string", "description": "Snippet/description of the search result" }, "url": { "type": "string", "description": "URL of the search result page" } }, "required": ["title", "description", "url"] }, "description": "List of search result entries" } }, "required": ["results"] }
      },
      "searchGoogleCalendarEvents": {
        stepType: "searchGoogleCalendarEvents",
        description: "Search for events in a Google Calendar by keyword, date range, or both.",
        usageNotes: '- Requires a Google OAuth connection with Calendar events scope.\n- Supports keyword search via "query" and date filtering via "timeMin"/"timeMax" (ISO 8601 format).\n- Unlike "List Events" which only shows future events, this allows searching past events too.',
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Text search term" }, "timeMin": { "type": "string", "description": "Start of time range (ISO 8601)" }, "timeMax": { "type": "string", "description": "End of time range (ISO 8601)" }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary")' }, "limit": { "type": "number", "description": "Maximum number of events to return (default: 10)" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["exportType"] },
        outputSchema: { "type": "object", "properties": { "events": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Google Calendar event ID" }, "status": { "type": "string", "description": 'Event status (e.g. "confirmed", "tentative", "cancelled")' }, "htmlLink": { "type": "string", "description": "URL to view the event in Google Calendar" }, "created": { "type": "string", "description": "Timestamp when the event was created" }, "updated": { "type": "string", "description": "Timestamp when the event was last updated" }, "summary": { "type": "string", "description": "Event title" }, "description": { "type": "string", "description": "Event description" }, "location": { "type": "string", "description": "Event location" }, "organizer": { "anyOf": [{ "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" } } }, { "type": "null" }] }, "start": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "end": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "attendees": { "anyOf": [{ "type": "array", "items": { "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" }, "responseStatus": { "type": "string" } } } }, { "type": "null" }] } } }, "description": "List of matching calendar events" } }, "required": ["events"] }
      },
      "searchGoogleDrive": {
        stepType: "searchGoogleDrive",
        description: "Search for files in Google Drive by keyword.",
        usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- Searches file content and names using Google Drive's fullText search.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search keyword" }, "limit": { "type": "number", "description": "Max files to return (default: 20)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' } }, "required": ["query", "exportType"] },
        outputSchema: { "type": "object", "properties": { "files": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "mimeType": { "type": "string" }, "size": { "type": "string" }, "webViewLink": { "type": "string" }, "createdTime": { "type": "string" }, "modifiedTime": { "type": "string" } }, "required": ["id", "name", "mimeType", "size", "webViewLink", "createdTime", "modifiedTime"] }, "description": "List of matching files" } }, "required": ["files"] }
      },
      "searchGoogleImages": {
        stepType: "searchGoogleImages",
        description: "Search Google Images and return image results with URLs and metadata.",
        usageNotes: "- Defaults to us/english, but can optionally specify country and/or language.\n- Defaults to any time, but can optionally specify last hour, last day, week, month, or year.\n- Defaults to top 30 results, but can specify 1 to 100 results to return.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "The image search query" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Format for the variable value: "text" or "json"' }, "countryCode": { "type": "string", "description": "Google gl country code (defaults to US)" }, "languageCode": { "type": "string", "description": 'Google hl language code (defaults to "en")' }, "dateRange": { "enum": ["hour", "day", "week", "month", "year", "any"], "type": "string", "description": 'Time range filter: "hour", "day", "week", "month", "year", or "any"' }, "numResults": { "type": "number", "description": "Number of results to return (1-100, default: 30)" } }, "required": ["query", "exportType"] },
        outputSchema: { "type": "object", "properties": { "images": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string", "description": "Title/alt text of the image" }, "imageUrl": { "type": "string", "description": "Direct URL of the full-size image" }, "imageWidth": { "type": "number", "description": "Width of the full-size image in pixels" }, "imageHeight": { "type": "number", "description": "Height of the full-size image in pixels" }, "thumbnailUrl": { "type": "string", "description": "URL of the thumbnail image" }, "thumbnailWidth": { "type": "number", "description": "Width of the thumbnail in pixels" }, "thumbnailHeight": { "type": "number", "description": "Height of the thumbnail in pixels" }, "source": { "type": "string", "description": "Source website name" }, "domain": { "type": "string", "description": "Domain of the source website" }, "link": { "type": "string", "description": "URL of the page containing the image" }, "googleUrl": { "type": "string", "description": "Google Images URL for this result" }, "position": { "type": "number", "description": "Position/rank of this result in the search results" } }, "required": ["title", "imageUrl", "imageWidth", "imageHeight", "thumbnailUrl", "thumbnailWidth", "thumbnailHeight", "source", "domain", "link", "googleUrl", "position"] }, "description": "List of image search results with URLs and metadata" } }, "required": ["images"] }
      },
      "searchGoogleNews": {
        stepType: "searchGoogleNews",
        description: "Search Google News for recent news articles matching a query.",
        usageNotes: "- Defaults to top 30 results, but can specify 1 to 100 results to return.",
        inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The news search query" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Format for the variable value: "text" or "json"' }, "numResults": { "type": "number", "description": "Number of results to return (1-100, default: 30)" } }, "required": ["text", "exportType"] },
        outputSchema: { "type": "object", "properties": { "articles": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string", "description": "Headline of the news article" }, "link": { "type": "string", "description": "URL to the full article" }, "date": { "type": "string", "description": "Publication date of the article" }, "source": { "type": "object", "properties": { "name": { "type": "string", "description": "Name of the news source" } }, "required": ["name"], "description": "Source publication" }, "snippet": { "type": "string", "description": "Brief excerpt or summary of the article" } }, "required": ["title", "link", "date", "source"] }, "description": "List of matching news articles" } }, "required": ["articles"] }
      },
      "searchGoogleTrends": {
        stepType: "searchGoogleTrends",
        description: "Fetch Google Trends data for a search term.",
        usageNotes: '- date accepts shorthand ("now 1-H", "today 1-m", "today 5-y", etc.) or custom "yyyy-mm-dd yyyy-mm-dd" ranges.\n- data_type controls the shape of returned data: TIMESERIES, GEO_MAP, GEO_MAP_0, RELATED_TOPICS, or RELATED_QUERIES.',
        inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The search term to look up on Google Trends" }, "hl": { "type": "string", "description": 'Language code (e.g. "en")' }, "geo": { "type": "string", "description": "Geographic region: empty string for worldwide, or a two-letter country code" }, "data_type": { "enum": ["TIMESERIES", "GEO_MAP", "GEO_MAP_0", "RELATED_TOPICS", "RELATED_QUERIES"], "type": "string", "description": "Type of trend data to return" }, "cat": { "type": "string", "description": 'Category filter ("0" for all categories)' }, "date": { "type": "string", "description": 'Date range for trend data. Available options:   - "now 1-H" - Past hour   - "now 4-H" - Past 4 hours   - "now 1-d" - Past day   - "now 7-d" - Past 7 days   - "today 1-m" - Past 30 days   - "today 3-m" - Past 90 days   - "today 12-m" - Past 12 months   - "today 5-y" - Past 5 years   - "all - 2004" - present   - You can also pass custom values: "yyyy-mm-dd yyyy-mm-dd"' }, "ts": { "type": "string", "description": "Timezone offset in minutes (-1439 to 1439, default: 420 for PDT)" } }, "required": ["text", "hl", "geo", "data_type", "cat", "date", "ts"] },
        outputSchema: { "type": "object", "properties": { "trends": { "type": "object", "properties": {}, "required": [], "description": "Google Trends data for the searched term" } }, "required": ["trends"] }
      },
      "searchPerplexity": {
        stepType: "searchPerplexity",
        description: "Search the web using the Perplexity API and return structured results.",
        usageNotes: "- Defaults to US results. Use countryCode (ISO code) to filter by country.\n- Returns 10 results by default, configurable from 1 to 20.\n- The variable receives text or JSON depending on exportType. The direct execution output always returns structured results.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search query to send to Perplexity" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": "Output format for the variable: plain text or structured JSON" }, "countryCode": { "type": "string", "description": 'ISO country code to filter results by region (e.g. "us", "gb")' }, "numResults": { "type": "number", "description": "Number of results to return (1-20, default: 10)" } }, "required": ["query", "exportType"] },
        outputSchema: { "type": "object", "properties": { "results": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title of the search result" }, "description": { "type": "string", "description": "Snippet or description of the search result" }, "url": { "type": "string", "description": "URL of the search result page" } }, "required": ["title", "description", "url"] }, "description": "List of structured search results" } }, "required": ["results"] }
      },
      "searchXPosts": {
        stepType: "searchXPosts",
        description: "Search recent X (Twitter) posts matching a query.",
        usageNotes: "- Searches only the past 7 days of posts.\n- Query supports X API v2 search operators (up to 512 characters).\n\nAvailable search operators in query:\n\n| Operator         | Description                                      |\n| -----------------| -------------------------------------------------|\n| from:            | Posts from a specific user (e.g., from:elonmusk) |\n| to:              | Posts sent to a specific user (e.g., to:NASA)    |\n| @                | Mentions a user (e.g., @openai)                  |\n| #                | Hashtag search (e.g., #AI)                       |\n| is:retweet       | Filters retweets                                 |\n| is:reply         | Filters replies                                  |\n| has:media        | Posts containing media (images, videos, or GIFs) |\n| has:links        | Posts containing URLs                            |\n| lang:            | Filters by language (e.g., lang:en)              |\n| -                | Excludes specific terms (e.g., -spam)            |\n| ()               | Groups terms or operators (e.g., (AI OR ML))     |\n| AND, OR, NOT     | Boolean logic for combining or excluding terms   |\n\nConjunction-Required Operators (must be combined with a standalone operator):\n\n| Operator     | Description                                    |\n| ------------ | -----------------------------------------------|\n| has:media  | Posts containing media (images, videos, or GIFs) |\n| has:links  | Posts containing URLs                            |\n| is:retweet | Filters retweets                                 |\n| is:reply   | Filters replies                                  |\n\nFor example, has:media alone is invalid, but #AI has:media is valid.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search query (max 512 chars, supports X API v2 search operators)" }, "scope": { "enum": ["recent", "all"], "type": "string", "description": 'Search scope: "recent" for past 7 days or "all" for full archive' }, "options": { "type": "object", "properties": { "startTime": { "type": "string", "description": "ISO 8601 date; only return posts after this time" }, "endTime": { "type": "string", "description": "ISO 8601 date; only return posts before this time" }, "maxResults": { "type": "number", "description": "Number of results to return (default: 50, max: 100)" } }, "description": "Additional search options" } }, "required": ["query", "scope", "options"] },
        outputSchema: { "type": "object", "properties": { "posts": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Unique post identifier" }, "authorId": { "type": "string", "description": "Author's X user ID" }, "dateCreated": { "type": "string", "description": "ISO 8601 timestamp when the post was created" }, "text": { "type": "string", "description": "Text content of the post" }, "stats": { "type": "object", "properties": { "retweets": { "type": "number", "description": "Number of retweets/reposts" }, "replies": { "type": "number", "description": "Number of replies" }, "likes": { "type": "number", "description": "Number of likes" } }, "required": ["retweets", "replies", "likes"], "description": "Engagement statistics for the post" } }, "required": ["id", "authorId", "dateCreated", "text", "stats"] }, "description": "List of matching X posts" } }, "required": ["posts"] }
      },
      "searchYoutube": {
        stepType: "searchYoutube",
        description: "Search for YouTube videos by keyword.",
        usageNotes: "- Supports pagination (up to 5 pages) and country/language filters.\n- Use the filter/filterType fields for YouTube search parameter (sp) filters.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search query for YouTube videos" }, "limitPages": { "type": "string", "description": "Maximum number of pages to fetch (1-5)" }, "filter": { "type": "string", "description": "YouTube search parameter (sp) filter value" }, "filterType": { "type": "string", "description": "Filter type identifier" }, "countryCode": { "type": "string", "description": 'Google gl country code for regional results (default: "US")' }, "languageCode": { "type": "string", "description": 'Google hl language code for result language (default: "en")' } }, "required": ["query", "limitPages", "filter", "filterType"] },
        outputSchema: { "type": "object", "properties": { "results": { "type": "object", "properties": {}, "required": [], "description": "YouTube search results including video_results, channel_results, etc." } }, "required": ["results"] }
      },
      "searchYoutubeTrends": {
        stepType: "searchYoutubeTrends",
        description: "Retrieve trending videos on YouTube by category and region.",
        usageNotes: '- Categories: "now" (trending now), "music", "gaming", "films".\n- Supports country and language filtering.',
        inputSchema: { "type": "object", "properties": { "bp": { "enum": ["now", "music", "gaming", "films"], "type": "string", "description": 'Trending category: "now" (trending now), "music", "gaming", or "films"' }, "hl": { "type": "string", "description": 'Language code (e.g. "en")' }, "gl": { "type": "string", "description": 'Country code (e.g. "US")' } }, "required": ["bp", "hl", "gl"] },
        outputSchema: { "type": "object", "properties": {}, "required": [] }
      },
      "sendEmail": {
        stepType: "sendEmail",
        description: "Send an email to one or more recipient addresses.",
        usageNotes: `- Use the "to" field to send to one or more specific recipient email addresses directly. Allowed recipients depend on the sender: when the app sends from a domain it owns (a verified custom domain or its <slug>.madewithremy.com subdomain) any recipient is allowed; when it falls back to the shared Remy address, recipients must be verified app users or members of the app's organization. (v1 apps cannot use a direct "to" \u2014 they must resolve recipients via a connection.)
- Alternatively, recipient email addresses can be resolved from OAuth connections configured by the app creator via connectionId. The user running the workflow does not specify the recipient directly.
- Use "cc" and "bcc" to add visible / hidden recipients (a string or an array). They are subject to the same recipient rules as "to".
- "to" is optional only in the sense that recipients can come from elsewhere \u2014 omit it and supply "cc"/"bcc" for a hidden-list send, or omit all three and recipients are resolved from an OAuth connection. Naming nobody at all is an error.
- Bcc-only sends are supported: with no "to" or "cc", the To: header is addressed to the app's own sender address (the standard "undisclosed recipients" pattern) so recipients can't see each other. The returned "recipients" reflects that auto-filled address.
- Every recipient counts toward the app's daily outbound cap, including cc and bcc.
- The sender defaults automatically: v2 apps send from the app's own identity \u2014 its verified custom domain if set, else its platform subdomain (noreply@<slug>.madewithremy.com), else the default Remy address.
- Optionally set "from" to a custom handle, but ONLY if the app has a custom domain or subdomain: a bare handle ("support" \u2192 support@<app-domain>), a full "support@your-domain.com", or "Name <support@your-domain.com>". The domain must be one the app owns, or the step fails.
- If the body is a URL to a hosted HTML file on the CDN, the HTML is fetched and used as the email body.
- The body is interpreted automatically: if it already looks like HTML it is sent as HTML, otherwise it is rendered from Markdown. Every email is sent as multipart with a plain-text alternative auto-derived from the body (better deliverability).
- Set bodyType to override interpretation: "html" (send as-is), "markdown" (render to HTML), or "text" (plain text only, no HTML part). Default is "auto".
- Optionally set "text" to supply your own plain-text alternative instead of the auto-derived one.
- Use "attachments" to attach files by URL. Each entry is a URL string, or an object { url, filename?, contentType? } to control the attachment's displayed filename and MIME type.
- When generateHtml is enabled, the body text is converted to a styled HTML email using an AI model (implies an HTML body).
- Set replyTo to control the Reply-To address for replies.
- For threaded replies in a shared inbox, set inReplyTo (the Message-ID being replied to) and references (prior Message-IDs in the thread).
- connectionId can be a comma-separated list to send to multiple recipients.
- The special connectionId "trigger_email" uses the email address that triggered the workflow.`,
        inputSchema: { "type": "object", "properties": { "subject": { "type": "string", "description": "Email subject line" }, "body": { "type": "string", "description": "Email body content (plain text, markdown, HTML, or a CDN URL to an HTML file)" }, "to": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] }, "cc": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] }, "bcc": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] }, "connectionId": { "type": "string", "description": "OAuth connection ID(s) for the recipient(s), comma-separated for multiple" }, "generateHtml": { "type": "boolean", "description": "When true, auto-convert the body text into a styled HTML email using AI" }, "generateHtmlInstructions": { "type": "string", "description": "Natural language instructions for the HTML generation style" }, "generateHtmlModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model settings override for HTML generation" }, "attachments": { "type": "array", "items": { "anyOf": [{ "type": "string" }, { "type": "object", "properties": { "url": { "type": "string" }, "filename": { "type": "string" }, "contentType": { "type": "string" } }, "required": ["url"] }] }, "description": "Files to attach: each entry is a URL string, or an object `{ url, filename?, contentType? }` to control the displayed filename and MIME type." }, "from": { "type": "string", "description": "Custom sender handle \u2014 only for apps with a custom domain or subdomain. Bare handle (`support`), full `support@your-domain.com`, or `Name <support@your-domain.com>`. Must resolve to a domain the app owns." }, "bodyType": { "enum": ["auto", "html", "markdown", "text"], "type": "string", "description": "How to interpret `body`: `auto` (default \u2014 detect HTML, else render markdown), `html` (send as-is), `markdown` (render to HTML), or `text` (send as plain text only, no HTML part). Every send includes a text/plain alternative." }, "text": { "type": "string", "description": "Explicit text/plain alternative body. Auto-derived from `body` if omitted." }, "replyTo": { "type": "string", "description": "Reply-To address for the email." }, "inReplyTo": { "type": "string", "description": "Message-ID this email replies to, for inbox threading (In-Reply-To header)." }, "references": { "type": "array", "items": { "type": "string" }, "description": "Prior Message-IDs in the thread, for inbox threading (References header)." } }, "required": ["subject", "body"] },
        outputSchema: { "type": "object", "properties": { "recipients": { "type": "array", "items": { "type": "string" }, "description": "To addresses the message was sent to." }, "cc": { "type": "array", "items": { "type": "string" }, "description": "Cc addresses on the message (empty if none)." }, "bcc": { "type": "array", "items": { "type": "string" }, "description": "Bcc addresses on the message (empty if none)." }, "from": { "type": "string", "description": "The resolved sender address the message went out as (auto-selected when no `from` is given)." } }, "required": ["recipients", "cc", "bcc", "from"] }
      },
      "sendGmailDraft": {
        stepType: "sendGmailDraft",
        description: "Send an existing draft from the connected Gmail account.",
        usageNotes: "- Requires a Google OAuth connection with Gmail compose scope.\n- The draft is sent and removed from the Drafts folder.\n- Use the draft ID returned by the Create Gmail Draft or List Gmail Drafts steps.",
        inputSchema: { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID to send" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["draftId"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "sendGmailMessage": {
        stepType: "sendGmailMessage",
        description: "Send an email from the connected Gmail account.",
        usageNotes: '- Requires a Google OAuth connection with Gmail compose scope.\n- messageType controls the body format: "plain" for plain text, "html" for raw HTML, "markdown" for auto-converted markdown.',
        inputSchema: { "type": "object", "properties": { "to": { "type": "string", "description": "Recipient email address(es), comma-separated for multiple" }, "subject": { "type": "string", "description": "Email subject line" }, "message": { "type": "string", "description": "Email body content" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "messageType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Body format: "plain", "html", or "markdown"' } }, "required": ["to", "subject", "message", "messageType"] },
        outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID of the sent email" } }, "required": ["messageId"] }
      },
      "sendSlackDirectMessage": {
        stepType: "sendSlackDirectMessage",
        description: "Send a direct message to a Slack user via a connected bot.",
        usageNotes: "- The user is responsible for connecting their Slack workspace\n- The recipient is identified by their Slack user ID\n- Supports both simple text messages and Slack blocks messages\n- Text messages can use limited markdown (slack-only formatting\u2014e.g., headers are just rendered as bold)",
        inputSchema: { "type": "object", "properties": { "slackUserId": { "type": "string", "description": "Slack user ID of the recipient" }, "messageType": { "enum": ["string", "blocks"], "type": "string", "description": 'Message format: "string" for plain text/markdown, "blocks" for Slack Block Kit JSON' }, "message": { "type": "string", "description": 'Message content (plain text/markdown for "string" type, or JSON for "blocks" type)' }, "connectionId": { "type": "string", "description": "Slack OAuth connection ID (leave empty to allow user to select)" } }, "required": ["slackUserId", "messageType", "message"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "sendSMS": {
        stepType: "sendSMS",
        description: "Send an SMS or MMS message to a phone number configured via OAuth connection.",
        usageNotes: "- User is responsible for configuring the connection to the number (MindStudio requires double opt-in to prevent spam)\n- If mediaUrls are provided, the message is sent as MMS instead of SMS\n- MMS supports up to 10 media URLs (images, video, audio, PDF) with a 5MB limit per file\n- MMS is only supported on US and Canadian carriers; international numbers will receive SMS only (media silently dropped)",
        inputSchema: { "type": "object", "properties": { "body": { "type": "string", "description": "SMS message body text" }, "connectionId": { "type": "string", "description": "OAuth connection ID for the recipient phone number" }, "mediaUrls": { "type": "array", "items": { "type": "string" }, "description": "Optional array of media URLs to send as MMS (up to 10, 5MB each)" } }, "required": ["body"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "setGmailReadStatus": {
        stepType: "setGmailReadStatus",
        description: "Mark one or more Gmail emails as read or unread.",
        usageNotes: "- Requires a Google OAuth connection with Gmail modify scope.\n- Accepts one or more message IDs as a comma-separated string or array.\n- Set markAsRead to true to mark as read, false to mark as unread.",
        inputSchema: { "type": "object", "properties": { "messageIds": { "type": "string", "description": "Gmail message ID(s), comma-separated" }, "markAsRead": { "type": "boolean", "description": "true = mark as read, false = mark as unread" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageIds", "markAsRead"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "setRunTitle": {
        stepType: "setRunTitle",
        description: "Set the title of the agent run for the user's history",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "title": { "type": "string", "description": "The title to assign to the agent run (supports variable interpolation)" } }, "required": ["title"], "description": "Configuration for the set run title step" },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "setVariable": {
        stepType: "setVariable",
        description: "Explicitly set a variable to a given value.",
        usageNotes: "- Useful for bootstrapping global variables or setting constants.\n- The variable name and value both support variable interpolation.\n- The type field is a UI hint only (controls input widget in the editor).",
        inputSchema: { "type": "object", "properties": { "value": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["value"], "description": "Configuration for the set variable step" },
        outputSchema: { "type": "object", "properties": {}, "required": [] }
      },
      "telegramEditMessage": {
        stepType: "telegramEditMessage",
        description: "Edit a previously sent Telegram message. Use with the message ID returned by Send Telegram Message.",
        usageNotes: '- Only text messages sent by the bot can be edited.\n- The messageId is returned by the Send Telegram Message step.\n- Common pattern: send a "Processing..." message, do work, then edit it with the result.',
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID containing the message" }, "messageId": { "type": "string", "description": "ID of the message to edit" }, "text": { "type": "string", "description": "New message text (MarkdownV2 formatting supported)" } }, "required": ["botToken", "chatId", "messageId", "text"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "telegramReplyToMessage": {
        stepType: "telegramReplyToMessage",
        description: "Send a reply to a specific Telegram message. The reply will be visually threaded in the chat.",
        usageNotes: "- Use the rawMessage.message_id from the incoming trigger variables to reply to the user's message.\n- Especially useful in group chats where replies provide context.\n- Returns the sent message ID, which can be used with Edit Telegram Message.",
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the reply to" }, "replyToMessageId": { "type": "string", "description": "ID of the message to reply to" }, "text": { "type": "string", "description": "Reply text (MarkdownV2 formatting supported)" } }, "required": ["botToken", "chatId", "replyToMessageId", "text"] },
        outputSchema: { "type": "object", "properties": { "messageId": { "type": "number", "description": "ID of the sent reply message" } }, "required": ["messageId"] }
      },
      "telegramSendAudio": {
        stepType: "telegramSendAudio",
        description: "Send an audio file to a Telegram chat as music or a voice note via a bot.",
        usageNotes: '- "audio" mode sends as a standard audio file. "voice" mode sends as a voice message (re-uploads the file for large file support).',
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the audio to" }, "audioUrl": { "type": "string", "description": "URL of the audio file to send" }, "mode": { "enum": ["audio", "voice"], "type": "string", "description": 'Send as a standard audio track ("audio") or as a voice note ("voice")' }, "caption": { "type": "string", "description": "Optional caption text for the audio" } }, "required": ["botToken", "chatId", "audioUrl", "mode"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "telegramSendFile": {
        stepType: "telegramSendFile",
        description: "Send a document/file to a Telegram chat via a bot.",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the file to" }, "fileUrl": { "type": "string", "description": "URL of the document/file to send" }, "caption": { "type": "string", "description": "Optional caption text for the file" } }, "required": ["botToken", "chatId", "fileUrl"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "telegramSendImage": {
        stepType: "telegramSendImage",
        description: "Send an image to a Telegram chat via a bot.",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the image to" }, "imageUrl": { "type": "string", "description": "URL of the image to send" }, "caption": { "type": "string", "description": "Optional caption text for the image" } }, "required": ["botToken", "chatId", "imageUrl"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "telegramSendMessage": {
        stepType: "telegramSendMessage",
        description: "Send a text message to a Telegram chat via a bot.",
        usageNotes: '- Messages are sent using MarkdownV2 formatting. Special characters are auto-escaped.\n- botToken format is "botId:token" \u2014 both parts are required.\n- Returns the sent message ID, which can be used with Edit Telegram Message to update the message later.',
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the message to" }, "text": { "type": "string", "description": "Message text to send (MarkdownV2 formatting supported)" } }, "required": ["botToken", "chatId", "text"] },
        outputSchema: { "type": "object", "properties": { "messageId": { "type": "number", "description": "ID of the sent Telegram message" } }, "required": ["messageId"] }
      },
      "telegramSendVideo": {
        stepType: "telegramSendVideo",
        description: "Send a video to a Telegram chat via a bot.",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the video to" }, "videoUrl": { "type": "string", "description": "URL of the video to send" }, "caption": { "type": "string", "description": "Optional caption text for the video" } }, "required": ["botToken", "chatId", "videoUrl"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "telegramSetTyping": {
        stepType: "telegramSetTyping",
        description: 'Show the "typing..." indicator in a Telegram chat via a bot.',
        usageNotes: "- The typing indicator automatically expires after a few seconds. Use this right before sending a message for a natural feel.",
        inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to show the typing indicator in" } }, "required": ["botToken", "chatId"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "textToSpeech": {
        stepType: "textToSpeech",
        description: "Generate an audio file from provided text using a speech model.",
        usageNotes: "- The text field contains the exact words to be spoken (not instructions).\n- In foreground mode, the audio is displayed to the user. In background mode, the URL is saved to a variable.",
        inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The text to convert to speech" }, "intermediateAsset": { "type": "boolean" }, "speechModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "Speech synthesis model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default speech model if not specified" } }, "required": ["text"] },
        outputSchema: { "type": "object", "properties": { "audioUrl": { "type": "string", "description": "URL of the generated audio file" } }, "required": ["audioUrl"] }
      },
      "transcribeAudio": {
        stepType: "transcribeAudio",
        description: "Convert an audio file to text using a transcription model.",
        usageNotes: "- The prompt field provides optional context to improve transcription accuracy (e.g. language, speaker names, domain).",
        inputSchema: { "type": "object", "properties": { "audioUrl": { "type": "string", "description": "URL of the audio file to transcribe" }, "prompt": { "type": "string", "description": "Optional context to improve transcription accuracy (e.g. language, speaker names, domain terms)" }, "transcriptionModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "Audio transcription model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default transcription model if not specified" } }, "required": ["audioUrl", "prompt"] },
        outputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The transcribed text from the audio file" } }, "required": ["text"] }
      },
      "trimMedia": {
        stepType: "trimMedia",
        description: "Trim an audio or video clip",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "inputUrl": { "type": "string", "description": "URL of the source audio or video file to trim" }, "start": { "type": ["number", "string"] }, "duration": { "type": ["string", "number"] }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["inputUrl"] },
        outputSchema: { "type": "object", "properties": { "mediaUrl": { "type": "string", "description": "URL of the trimmed media file" } }, "required": ["mediaUrl"] }
      },
      "updateGmailLabels": {
        stepType: "updateGmailLabels",
        description: "Add or remove labels on Gmail messages, identified by message IDs or a search query.",
        usageNotes: "- Requires a Google OAuth connection with Gmail modify scope.\n- Provide either a query (Gmail search syntax) or explicit messageIds to target messages.\n- Label IDs can be label names or Gmail label IDs \u2014 names are resolved automatically.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Gmail search query to find messages (alternative to messageIds)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "messageIds": { "type": "string", "description": "Comma-separated message IDs to target (alternative to query)" }, "addLabelIds": { "type": "string", "description": "Comma-separated label names or IDs to add" }, "removeLabelIds": { "type": "string", "description": "Comma-separated label names or IDs to remove" } }, "required": ["query", "messageIds", "addLabelIds", "removeLabelIds"] },
        outputSchema: { "type": "object", "properties": { "updatedMessageIds": { "type": "array", "items": { "type": "string" }, "description": "Gmail message IDs that were updated" } }, "required": ["updatedMessageIds"] }
      },
      "updateGoogleCalendarEvent": {
        stepType: "updateGoogleCalendarEvent",
        description: "Update an existing event on a Google Calendar. Only specified fields are changed.",
        usageNotes: "- Requires a Google OAuth connection with Calendar events scope.\n- Fetches the existing event first, then applies only the provided updates. Omitted fields are left unchanged.\n- Attendees are specified as one email address per line, and replace the entire attendee list.",
        inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "eventId": { "type": "string", "description": "Google Calendar event ID to update" }, "summary": { "type": "string", "description": "Updated event title" }, "description": { "type": "string", "description": "Updated event description" }, "location": { "type": "string", "description": "Updated event location" }, "startDateTime": { "type": "string", "description": "Updated start time in ISO 8601 format" }, "endDateTime": { "type": "string", "description": "Updated end time in ISO 8601 format" }, "attendees": { "type": "string", "description": "Updated attendee email addresses (one per line, replaces all existing attendees)" }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["eventId"] },
        outputSchema: { "type": "object", "properties": { "eventId": { "type": "string", "description": "Google Calendar event ID" }, "htmlLink": { "type": "string", "description": "URL to view the updated event in Google Calendar" } }, "required": ["eventId", "htmlLink"] }
      },
      "updateGoogleDoc": {
        stepType: "updateGoogleDoc",
        description: "Update the contents of an existing Google Document.",
        usageNotes: '- operationType controls how content is applied: "addToTop" prepends, "addToBottom" appends, "overwrite" replaces all content.\n- textType determines how the text field is interpreted: "plain" for plain text, "html" for HTML markup, "markdown" for Markdown.',
        inputSchema: { "type": "object", "properties": { "documentId": { "type": "string", "description": "Google Document ID to update" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "text": { "type": "string", "description": "New content to write to the document" }, "textType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Format of the text field: "plain", "html", or "markdown"' }, "operationType": { "enum": ["addToTop", "addToBottom", "overwrite"], "type": "string", "description": 'How to apply the content: "addToTop", "addToBottom", or "overwrite"' } }, "required": ["documentId", "text", "textType", "operationType"] },
        outputSchema: { "type": "object", "properties": { "documentUrl": { "type": "string", "description": "URL of the updated Google Document" } }, "required": ["documentUrl"] }
      },
      "updateGoogleSheet": {
        stepType: "updateGoogleSheet",
        description: "Update a Google Spreadsheet with new data.",
        usageNotes: '- operationType controls how data is written: "addToBottom" appends rows, "overwrite" replaces all data, "range" writes to a specific cell range.\n- Data should be provided as CSV in the text field.',
        inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "CSV data to write to the spreadsheet" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "spreadsheetId": { "type": "string", "description": "Google Spreadsheet ID to update" }, "range": { "type": "string", "description": 'Target cell range in A1 notation (used with "range" operationType)' }, "operationType": { "enum": ["addToBottom", "overwrite", "range"], "type": "string", "description": 'How to apply the data: "addToBottom", "overwrite", or "range"' } }, "required": ["text", "spreadsheetId", "range", "operationType"] },
        outputSchema: { "type": "object", "properties": { "spreadsheetUrl": { "type": "string", "description": "URL of the updated Google Spreadsheet" } }, "required": ["spreadsheetUrl"] }
      },
      "uploadDataSourceDocument": {
        stepType: "uploadDataSourceDocument",
        description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Upload a file into an existing data source from a URL or raw text content.",
        usageNotes: '- If "file" is a single URL, the file is downloaded from that URL and uploaded.\n- If "file" is any other string, a .txt document is created from that content and uploaded.\n- The block waits (polls) for processing to complete before transitioning, up to 5 minutes.\n- Once processing finishes, vectors are loaded into Milvus so the data source is immediately queryable.\n- Supported file types (when using a URL) are the same as the data source upload UI (PDF, DOCX, TXT, etc.).',
        inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the target data source (supports variable interpolation)" }, "file": { "type": "string", "description": "A URL to download, or raw text content to create a .txt document from (supports variable interpolation)" }, "fileName": { "type": "string", "description": "Display name for the document (supports variable interpolation)" } }, "required": ["dataSourceId", "file", "fileName"] },
        outputSchema: { "description": "This step does not produce output data." }
      },
      "upscaleImage": {
        stepType: "upscaleImage",
        description: "Increase the resolution of an image using AI upscaling.",
        usageNotes: "- Output is re-hosted on the CDN as a PNG.",
        inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the image to upscale" }, "targetResolution": { "enum": ["2k", "4k", "8k"], "type": "string", "description": "Target output resolution" }, "engine": { "enum": ["standard", "pro"], "type": "string", "description": "Upscaling engine quality tier" } }, "required": ["imageUrl", "targetResolution", "engine"] },
        outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the upscaled image (PNG)" } }, "required": ["imageUrl"] }
      },
      "upscaleVideo": {
        stepType: "upscaleVideo",
        description: "Upscale a video file",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to upscale" }, "targetResolution": { "enum": ["720p", "1080p", "2K", "4K"], "type": "string", "description": "Target output resolution for the upscaled video" }, "engine": { "enum": ["standard", "pro", "ultimate", "flashvsr", "seedance", "seedvr2", "runwayml/upscale-v1"], "type": "string", "description": "Upscaling engine to use. Higher tiers produce better quality at higher cost." }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "targetResolution", "engine"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the upscaled video" } }, "required": ["videoUrl"] }
      },
      "userMessage": {
        stepType: "userMessage",
        description: "Send a message to an AI model and return the response, or echo a system message.",
        usageNotes: `- Source "user" sends the message to an LLM and returns the model's response.
- Source "system" echoes the message content directly (no AI call).
- Mode "background" saves the result to a variable. Mode "foreground" streams it to the user (not available in direct execution).
- Structured output (JSON/CSV) can be enforced via structuredOutputType and structuredOutputExample.
- When executed inside a v2 app method (managed sandbox or local dev tunnel),
  LLM token output can be streamed to the frontend in real time via an SSE
  side-channel. The frontend opts in by passing { stream: true } to the method
  invocation via @mindstudio-ai/interface. Tokens are published to Redis
  pub/sub as they arrive and forwarded as SSE events on the invoke response.
  The method code itself is unchanged \u2014 streaming is transparent to the
  developer. See V2ExecutionService.ts and the invoke handler in V2Apps for
  the server-side plumbing.`,
        inputSchema: { "type": "object", "properties": { "message": { "type": "string", "description": "The message to send (prompt for AI, or text for system echo)" }, "source": { "enum": ["user", "system"], "type": "string", "description": 'Message source: "user" sends to AI model, "system" echoes message content directly. Defaults to "user"' }, "modelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model configuration override. Optional; uses the workflow's default model if not specified" }, "structuredOutputType": { "enum": ["text", "json", "csv"], "type": "string", "description": "Output format constraint for structured responses" }, "structuredOutputExample": { "type": "string", "description": "Sample showing the desired output shape (for JSON/CSV formats). A TypeScript interface is also useful here for more complex types." }, "chatHistoryMode": { "enum": ["include", "exclude"], "type": "string", "description": "Whether to include or exclude prior chat history in the AI context" } }, "required": ["message"], "description": "Configuration for the user message step" },
        outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "The AI model's response or echoed system message content" } }, "required": ["content"] }
      },
      "videoFaceSwap": {
        stepType: "videoFaceSwap",
        description: "Swap faces in a video file",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video containing faces to swap" }, "faceImageUrl": { "type": "string", "description": "URL of the image containing the replacement face" }, "targetIndex": { "type": "number", "description": "Zero-based index of the face to replace in the video" }, "engine": { "type": "string", "description": "Face swap engine to use" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "faceImageUrl", "targetIndex", "engine"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the face-swapped video" } }, "required": ["videoUrl"] }
      },
      "videoRemoveBackground": {
        stepType: "videoRemoveBackground",
        description: "Remove or replace background from a video",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video" }, "newBackground": { "enum": ["transparent", "image"], "type": "string", "description": "Whether to make the background transparent or replace it with an image" }, "newBackgroundImageUrl": { "type": "string", "description": "URL of a replacement background image. Required when newBackground is 'image'." }, "engine": { "type": "string", "description": "Background removal engine to use" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "newBackground", "engine"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with background removed or replaced" } }, "required": ["videoUrl"] }
      },
      "videoRemoveWatermark": {
        stepType: "videoRemoveWatermark",
        description: "Remove a watermark from a video",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video containing a watermark" }, "engine": { "type": "string", "description": "Watermark removal engine to use" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "engine"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with watermark removed" } }, "required": ["videoUrl"] }
      },
      "watermarkImage": {
        stepType: "watermarkImage",
        description: "Overlay a watermark image onto another image.",
        usageNotes: "- The watermark is placed at the specified corner with configurable padding and width.",
        inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the base image" }, "watermarkImageUrl": { "type": "string", "description": "URL of the watermark image to overlay" }, "corner": { "enum": ["top-left", "top-right", "bottom-left", "bottom-right"], "type": "string", "description": "Corner position for the watermark placement" }, "paddingPx": { "type": "number", "description": "Padding from the corner in pixels" }, "widthPx": { "type": "number", "description": "Width of the watermark overlay in pixels" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["imageUrl", "watermarkImageUrl", "corner", "paddingPx", "widthPx"] },
        outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the watermarked image" } }, "required": ["imageUrl"] }
      },
      "watermarkVideo": {
        stepType: "watermarkVideo",
        description: "Add an image watermark to a video",
        usageNotes: "",
        inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video" }, "imageUrl": { "type": "string", "description": "URL of the watermark image to overlay" }, "corner": { "enum": ["top-left", "top-right", "bottom-left", "bottom-right"], "type": "string", "description": "Corner position for the watermark placement" }, "paddingPx": { "type": "number", "description": "Padding from the corner in pixels" }, "widthPx": { "type": "number", "description": "Width of the watermark overlay in pixels" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "imageUrl", "corner", "paddingPx", "widthPx"] },
        outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the watermarked video" } }, "required": ["videoUrl"] }
      },
      "youDotComFinanceResearch": {
        stepType: "youDotComFinanceResearch",
        description: "Ask a financial research question using You.com Finance Research and return the sourced response.",
        usageNotes: "- Use this for financial questions such as company analysis, earnings, market research, filings, macroeconomics, and due diligence.\n- researchEffort supports deep (default) or exhaustive.\n- Finance Research returns the same response shape as Web Research, but searches a finance-optimized index.\n- Use it for cited synthesis, not raw price feeds or structured time-series exports.",
        inputSchema: { "type": "object", "properties": { "input": { "type": "string", "description": "Financial research question" }, "researchEffort": { "enum": ["deep", "exhaustive"], "type": "string", "description": "Depth of finance research to perform" } }, "required": ["input"] },
        outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
      },
      "youDotComGetPageContent": {
        stepType: "youDotComGetPageContent",
        description: "Fetch clean Markdown, HTML, or metadata for known URLs using the You.com Contents API.",
        usageNotes: "- Use this step when you already know the URLs. Use Web Search with livecrawl when You.com should discover pages from a query.\n- A single request supports up to 10 URLs.\n- Request only the formats you need. Markdown is recommended for LLM consumption.\n- Increase crawlTimeout for JavaScript-heavy pages, up to 60 seconds.\n- Individual pages can partially fail; check each returned item before processing.",
        inputSchema: { "type": "object", "properties": { "urls": { "type": "array", "items": { "type": "string" }, "description": "URLs to fetch, max 10" }, "formats": { "type": "array", "items": { "enum": ["markdown", "html", "metadata"], "type": "string" }, "description": "Content formats to return; defaults to markdown" }, "crawlTimeout": { "type": "number", "description": "Per-URL crawl timeout in seconds" } }, "required": ["urls"] },
        outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
      },
      "youDotComLiveNews": {
        stepType: "youDotComLiveNews",
        description: "Fetch live news articles through the You.com Search API and return the full structured response.",
        usageNotes: "- Defaults freshness to day for breaking or recent news.\n- Use country and language together to monitor regional or non-English news.\n- Use livecrawl: 'news' with livecrawlFormats: ['markdown'] when you need full article text.\n- Use a custom freshness range like YYYY-MM-DDtoYYYY-MM-DD for historical news windows.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "News query" }, "freshness": { "type": "string", "description": "Recency filter; defaults to day" }, "count": { "type": "number", "description": "Max results per section, up to 100" }, "country": { "type": "string", "description": "ISO 3166-1 alpha-2 country code" }, "language": { "type": "string", "description": "BCP 47 language code" }, "safesearch": { "enum": ["off", "moderate", "strict"], "type": "string", "description": "Content moderation level" }, "livecrawl": { "enum": ["news", "all"], "type": "string", "description": "Fetch full content for news or all results" }, "livecrawlFormats": { "type": "array", "items": { "enum": ["markdown", "html"], "type": "string" }, "description": "Full-content formats to return when livecrawl is enabled" } }, "required": ["query"] },
        outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
      },
      "youDotComWebResearch": {
        stepType: "youDotComWebResearch",
        description: "Ask a research question and return a grounded You.com Research API answer with sources.",
        usageNotes: "- Use Web Search when you need raw URLs and snippets. Use Web Research when you want a synthesized answer with citations.\n- researchEffort controls depth and latency: lite, standard, deep, or exhaustive. standard is a good default.\n- sourceControl can restrict, exclude, or boost domains, and can apply freshness or country filters.\n- includeDomains cannot be combined with excludeDomains or boostDomains.\n- outputSchema returns structured output.content and is supported by standard, deep, and exhaustive, not lite.",
        inputSchema: { "type": "object", "properties": { "input": { "type": "string", "description": "Research question" }, "researchEffort": { "enum": ["lite", "standard", "deep", "exhaustive"], "type": "string", "description": "Depth of research to perform" }, "sourceControl": { "anyOf": [{ "type": "object", "properties": { "includeDomains": { "type": "array", "items": { "type": "string" } }, "excludeDomains": { "type": "array", "items": { "type": "string" } }, "boostDomains": { "type": "array", "items": { "type": "string" } }, "freshness": { "type": "string" }, "country": { "type": "string" } } }, { "type": "string" }] }, "outputSchema": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "string" }] } }, "required": ["input"] },
        outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
      },
      "youDotComWebSearch": {
        stepType: "youDotComWebSearch",
        description: "Search the web and news using the You.com Search API and return the full structured response.",
        usageNotes: "- Query supports You.com search operators:\n\n| Operator | Description | Example |\n| -------- | ----------- | ------- |\n| site: | Search within a domain and its subdomains | site:uscourts.gov |\n| filetype: | Search for a specific file type | filetype:pdf |\n| + | Require the exact term after the operator | +GAAP |\n| - | Exclude the exact term after the operator | -prs |\n| AND | Require both expressions | guitar AND Fender |\n| OR | Match either expression | guitar OR drum |\n| NOT | Negate an expression | NOT site:uscourts.gov |\n\n- Use livecrawl with livecrawlFormats: ['markdown'] when you need full page content instead of snippets.\n- Use the Get Page Content step when you already know the URLs to fetch.\n- Use freshness for recency: day, week, month, year, or YYYY-MM-DDtoYYYY-MM-DD.\n- Use country (ISO 3166-1 alpha-2) and language (BCP 47) to focus results geographically or linguistically.\n- includeDomains cannot be combined with excludeDomains or boostDomains.",
        inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search query; supports You.com search operators" }, "count": { "type": "number", "description": "Max results per section, up to 100" }, "freshness": { "type": "string", "description": "Recency filter: day, week, month, year, or YYYY-MM-DDtoYYYY-MM-DD" }, "country": { "type": "string", "description": "ISO 3166-1 alpha-2 country code" }, "language": { "type": "string", "description": "BCP 47 language code" }, "offset": { "type": "number", "description": "Pagination offset, 0-9" }, "safesearch": { "enum": ["off", "moderate", "strict"], "type": "string", "description": "Content moderation level" }, "livecrawl": { "enum": ["web", "news", "all"], "type": "string", "description": "Fetch full content for web, news, or all results" }, "livecrawlFormats": { "type": "array", "items": { "enum": ["markdown", "html"], "type": "string" }, "description": "Full-content formats to return when livecrawl is enabled" }, "crawlTimeout": { "type": "number", "description": "Maximum livecrawl timeout in seconds" }, "includeDomains": { "type": "array", "items": { "type": "string" }, "description": "Restrict results to these domains" }, "excludeDomains": { "type": "array", "items": { "type": "string" }, "description": "Exclude these domains" }, "boostDomains": { "type": "array", "items": { "type": "string" }, "description": "Boost these domains without excluding other domains" } }, "required": ["query"] },
        outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
      }
    };
  }
});

// src/errors.ts
var MindStudioError;
var init_errors = __esm({
  "src/errors.ts"() {
    "use strict";
    MindStudioError = class extends Error {
      constructor(message, code, status, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
      }
      name = "MindStudioError";
      toString() {
        return `MindStudioError [${this.code}] (${this.status}): ${this.message}`;
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          code: this.code,
          status: this.status,
          ...this.details != null && { details: this.details }
        };
      }
    };
  }
});

// src/http.ts
async function request(config, method, path, body) {
  const url = `${config.baseUrl}/developer/v2${path}`;
  await config.rateLimiter.acquire();
  try {
    return await requestWithRetry(config, method, url, body, 0);
  } finally {
    config.rateLimiter.release();
  }
}
async function requestWithRetry(config, method, url, body, attempt) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "User-Agent": "@mindstudio-ai/agent"
    },
    body: body != null ? JSON.stringify(body) : void 0
  });
  config.rateLimiter.updateFromHeaders(res.headers);
  if (attempt < config.maxRetries && (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504)) {
    const retryAfter = res.headers.get("retry-after");
    const waitMs = retryAfter ? parseFloat(retryAfter) * 1e3 : Math.min(1e3 * Math.pow(2, attempt), 1e4);
    await sleep(waitMs);
    return requestWithRetry(config, method, url, body, attempt + 1);
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let code = "api_error";
    let details;
    try {
      const text = await res.text();
      try {
        const body2 = JSON.parse(text);
        details = body2;
        const errMsg = (typeof body2.errorMessage === "string" ? body2.errorMessage : void 0) ?? (typeof body2.errorString === "string" ? body2.errorString : void 0) ?? (typeof body2.error === "string" ? body2.error : void 0) ?? (typeof body2.message === "string" ? body2.message : void 0) ?? (typeof body2.details === "string" ? body2.details : void 0);
        if (errMsg) message = errMsg;
        else if (body2.error || body2.message || body2.details) {
          message = JSON.stringify(body2.error ?? body2.message ?? body2.details);
        }
        if (body2.code) code = String(body2.code);
        else if (typeof body2.errorString === "string") code = body2.errorString;
      } catch {
        if (text) {
          const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          if (stripped) message = stripped.slice(0, 200);
        }
      }
    } catch {
    }
    throw new MindStudioError(message, code, res.status, details);
  }
  const data = await res.json();
  return { data, headers: res.headers };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var init_http = __esm({
  "src/http.ts"() {
    "use strict";
    init_errors();
  }
});

// src/context.ts
function getRequestContext() {
  return als.getStore();
}
var noopAls, als;
var init_context = __esm({
  async "src/context.ts"() {
    "use strict";
    noopAls = {
      getStore: () => void 0,
      run: (_store, fn) => fn()
    };
    als = noopAls;
    try {
      if (typeof process !== "undefined" && process.versions?.node) {
        const mod = await import("async_hooks");
        als = new mod.AsyncLocalStorage();
      }
    } catch {
    }
  }
});

// src/db-ws.ts
function isReadOnlySql(sql) {
  const head = sql.trimStart().slice(0, 8).toUpperCase();
  return head.startsWith("SELECT") || head.startsWith("PRAGMA") || head.startsWith("EXPLAIN");
}
function getOrOpen(url) {
  if (socket && socket.readyState === WS_OPEN) {
    return Promise.resolve(socket);
  }
  if (opening) {
    return opening;
  }
  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) {
    return Promise.reject(
      new DbWsTransportError("global WebSocket unavailable")
    );
  }
  opening = new Promise((resolve, reject) => {
    let ws;
    const fail = (err) => {
      clearTimeout(openTimer);
      if (socket === ws) {
        socket = null;
      }
      opening = null;
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new DbWsTransportError(err.message, true));
      }
      pending.clear();
      reject(err);
    };
    const openTimer = setTimeout(() => {
      try {
        ws?.close();
      } catch {
      }
      fail(new DbWsTransportError("ws open timed out"));
    }, WS_OPEN_TIMEOUT_MS);
    try {
      ws = new WebSocketCtor(url);
    } catch (err) {
      fail(new DbWsTransportError(err?.message || "ws construct failed"));
      return;
    }
    ws.onopen = () => {
      clearTimeout(openTimer);
      socket = ws;
      opening = null;
      resolve(ws);
    };
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(
          typeof ev.data === "string" ? ev.data : String(ev.data)
        );
      } catch {
        return;
      }
      if (!msg || msg.t !== "db-result" || msg.id == null) {
        return;
      }
      const p = pending.get(msg.id);
      if (!p) {
        return;
      }
      clearTimeout(p.timer);
      pending.delete(msg.id);
      if (msg.error) {
        p.reject(
          new MindStudioError(
            `[db] ${msg.error.message || "Database query failed"}`,
            msg.error.code || "db_query_error",
            400,
            msg.error
          )
        );
      } else {
        p.resolve(msg.results);
      }
    };
    ws.onerror = () => fail(new DbWsTransportError("ws error"));
    ws.onclose = () => fail(new DbWsTransportError("ws closed"));
  });
  return opening;
}
async function executeDbBatchOverWs(url, token, databaseId, queries) {
  const id = ++idCounter;
  const frame = JSON.stringify({ t: "db", id, token, databaseId, queries });
  if (frame.length > WS_MAX_FRAME_CHARS) {
    throw new DbWsTransportError("payload too large for ws");
  }
  const ws = await getOrOpen(url);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new DbWsTransportError("ws execute timed out", true));
    }, WS_REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    try {
      ws.send(frame);
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(
        new DbWsTransportError(
          `ws send failed: ${err?.message || "unknown"}`,
          false
        )
      );
    }
  });
}
var WS_REQUEST_TIMEOUT_MS, WS_OPEN_TIMEOUT_MS, WS_OPEN, WS_MAX_FRAME_CHARS, DbWsTransportError, socket, opening, idCounter, pending;
var init_db_ws = __esm({
  "src/db-ws.ts"() {
    "use strict";
    init_errors();
    WS_REQUEST_TIMEOUT_MS = 3e5;
    WS_OPEN_TIMEOUT_MS = 5e3;
    WS_OPEN = 1;
    WS_MAX_FRAME_CHARS = 9e5;
    DbWsTransportError = class extends Error {
      constructor(message, sent = false) {
        super(message);
        this.sent = sent;
      }
      name = "DbWsTransportError";
    };
    socket = null;
    opening = null;
    idCounter = 0;
    pending = /* @__PURE__ */ new Map();
  }
});

// src/rate-limit.ts
var DEFAULTS, RateLimiter;
var init_rate_limit = __esm({
  "src/rate-limit.ts"() {
    "use strict";
    init_errors();
    DEFAULTS = {
      internal: { concurrency: 10, callCap: 500 },
      apiKey: { concurrency: 20, callCap: Infinity }
    };
    RateLimiter = class {
      constructor(authType) {
        this.authType = authType;
        this.concurrencyLimit = DEFAULTS[authType].concurrency;
        this.callCap = DEFAULTS[authType].callCap;
      }
      inflight = 0;
      concurrencyLimit;
      callCount = 0;
      callCap;
      queue = [];
      /** Acquire a slot. Resolves when a concurrent slot is available. */
      async acquire() {
        if (this.callCount >= this.callCap) {
          throw new MindStudioError(
            `Call cap exceeded (${this.callCap} calls per execution). Reduce the number of API calls or use executeStepBatch() to combine multiple steps.`,
            "call_cap_exceeded",
            429
          );
        }
        if (this.inflight < this.concurrencyLimit) {
          this.inflight++;
          this.callCount++;
          return;
        }
        return new Promise((resolve) => {
          this.queue.push(() => {
            this.inflight++;
            this.callCount++;
            resolve();
          });
        });
      }
      /** Release a slot and let the next queued request proceed. */
      release() {
        this.inflight--;
        const next = this.queue.shift();
        if (next) next();
      }
      /** Update limits from response headers. */
      updateFromHeaders(headers) {
        const concurrency = headers.get("x-ratelimit-concurrency-limit");
        if (concurrency) {
          this.concurrencyLimit = parseInt(concurrency, 10);
        }
        const limit = headers.get("x-ratelimit-limit");
        if (limit && this.authType === "internal") {
          this.callCap = parseInt(limit, 10);
        }
      }
      /** Read current rate limit state from response headers. */
      static parseHeaders(headers) {
        const remaining = headers.get("x-ratelimit-remaining");
        const concurrencyRemaining = headers.get(
          "x-ratelimit-concurrency-remaining"
        );
        return {
          remaining: remaining != null ? parseInt(remaining, 10) : void 0,
          concurrencyRemaining: concurrencyRemaining != null ? parseInt(concurrencyRemaining, 10) : void 0
        };
      }
    };
  }
});

// src/config.ts
var config_exports = {};
__export(config_exports, {
  clearConfig: () => clearConfig,
  getConfigPath: () => getConfigPath,
  loadConfig: () => loadConfig,
  saveConfig: () => saveConfig
});
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
function configPaths() {
  const dir = join(homedir(), ".mindstudio");
  return { dir, file: join(dir, "config.json") };
}
function getConfigPath() {
  return configPaths().file;
}
function loadConfig() {
  try {
    const raw = readFileSync(configPaths().file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveConfig(config) {
  const { dir, file } = configPaths();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
function clearConfig() {
  saveConfig({});
}
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
  }
});

// src/auth/index.ts
var AuthContext, Roles;
var init_auth = __esm({
  "src/auth/index.ts"() {
    "use strict";
    init_errors();
    AuthContext = class {
      /** The current user's ID, or null for unauthenticated users. */
      userId;
      /** The current user's roles in this app. */
      roles;
      /** All role assignments for this app (all users, all roles). */
      _roleAssignments;
      constructor(ctx) {
        this.userId = ctx.userId;
        this._roleAssignments = ctx.roleAssignments;
        this.roles = ctx.roleAssignments.filter((a) => a.userId === ctx.userId).map((a) => a.roleName);
      }
      /**
       * Check if the current user has **any** of the given roles.
       * Returns true if at least one matches.
       *
       * @example
       * ```ts
       * if (auth.hasRole(Roles.admin, Roles.approver)) {
       *   // user is an admin OR an approver
       * }
       * ```
       */
      hasRole(...roles) {
        return roles.some((r) => this.roles.includes(r));
      }
      /**
       * Require the current user to have at least one of the given roles.
       * Throws a `MindStudioError` with code `'forbidden'` and status 403
       * if the user lacks all of the specified roles.
       *
       * Use this at the top of route handlers to gate access.
       *
       * @example
       * ```ts
       * auth.requireRole(Roles.admin);
       * // code below only runs if user is an admin
       * ```
       */
      requireRole(...roles) {
        if (this.userId == null) {
          throw new MindStudioError(
            "No authenticated user",
            "unauthenticated",
            401
          );
        }
        if (!this.hasRole(...roles)) {
          throw new MindStudioError(
            `User has role(s) [${this.roles.join(", ") || "none"}] but requires one of: [${roles.join(", ")}]`,
            "forbidden",
            403
          );
        }
      }
      /**
       * Get all user IDs that have the given role in this app.
       * Synchronous — scans the preloaded role assignments.
       *
       * @example
       * ```ts
       * const reviewers = auth.getUsersByRole(Roles.reviewer);
       * // ['user-id-1', 'user-id-2', ...]
       * ```
       */
      getUsersByRole(role) {
        return this._roleAssignments.filter((a) => a.roleName === role).map((a) => a.userId);
      }
    };
    Roles = new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop === "string") return prop;
          return void 0;
        }
      }
    );
  }
});

// src/db/sql.ts
function serializeParam(val) {
  if (val === null || val === void 0) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number" || typeof val === "string") return val;
  return JSON.stringify(val);
}
function serializeColumnParam(val, columnName, columns) {
  const col = columns.find((c) => c.name === columnName);
  if (col?.type === "user" && typeof val === "string") {
    return val.startsWith(USER_PREFIX) ? val : `${USER_PREFIX}${val}`;
  }
  return serializeParam(val);
}
function escapeValue(val) {
  if (val === null || val === void 0) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
  const json = JSON.stringify(val);
  return `'${json.replace(/'/g, "''")}'`;
}
function deserializeRow(row, columns) {
  if (row == null) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const col = columns.find((c) => c.name === key);
    if (typeof value === "string" && value.startsWith(USER_PREFIX)) {
      result[key] = value.slice(USER_PREFIX.length);
    } else if (col?.type === "json" && typeof value === "string") {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else if (col?.type === "boolean" && typeof value === "number") {
      result[key] = value !== 0;
    } else if (col?.type === "number" && typeof value === "string") {
      const num = Number(value);
      result[key] = Number.isNaN(num) ? value : num;
    } else if (!col && typeof value === "string" && (value[0] === "[" || value[0] === "{")) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}
function buildSelect(table, options = {}) {
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  if (options.where) {
    sql += ` WHERE ${options.where}`;
    if (options.whereParams) params.push(...options.whereParams);
  }
  if (options.orderBy) sql += ` ORDER BY ${options.orderBy}${options.desc ? " DESC" : " ASC"}`;
  if (options.limit != null) sql += ` LIMIT ${options.limit}`;
  if (options.offset != null) sql += ` OFFSET ${options.offset}`;
  return { sql, params: params.length > 0 ? params : void 0 };
}
function buildExists(table, where, whereParams, negate) {
  const inner = where ? `SELECT 1 FROM ${table} WHERE ${where}` : `SELECT 1 FROM ${table}`;
  const fn = negate ? "NOT EXISTS" : "EXISTS";
  return { sql: `SELECT ${fn}(${inner}) as result`, params: whereParams?.length ? whereParams : void 0 };
}
function buildInsert(table, data, columns) {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const placeholders = keys.map(() => "?").join(", ");
  const params = keys.map((k) => serializeColumnParam(filtered[k], k, columns));
  return {
    sql: `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    params
  };
}
function buildUpdate(table, id, data, columns) {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const assignments = keys.map((k) => `${k} = ?`).join(", ");
  const params = [
    ...keys.map((k) => serializeColumnParam(filtered[k], k, columns)),
    id
    // for WHERE id = ?
  ];
  return {
    sql: `UPDATE ${table} SET ${assignments} WHERE id = ? RETURNING *`,
    params
  };
}
function buildUpsert(table, data, conflictColumns, columns) {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const placeholders = keys.map(() => "?").join(", ");
  const params = keys.map(
    (k) => serializeColumnParam(filtered[k], k, columns)
  );
  const updateKeys = keys.filter((k) => !conflictColumns.includes(k));
  const conflict = conflictColumns.join(", ");
  const sql = updateKeys.length > 0 ? `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflict}) DO UPDATE SET ${updateKeys.map((k) => `${k} = excluded.${k}`).join(", ")} RETURNING *` : `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflict}) DO NOTHING RETURNING *`;
  return { sql, params };
}
function buildDelete(table, where, whereParams) {
  let sql = `DELETE FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  return { sql, params: whereParams?.length ? whereParams : void 0 };
}
function stripSystemColumns(data) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SYSTEM_COLUMNS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}
var USER_PREFIX, SYSTEM_COLUMNS;
var init_sql = __esm({
  "src/db/sql.ts"() {
    "use strict";
    USER_PREFIX = "@@user@@";
    SYSTEM_COLUMNS = /* @__PURE__ */ new Set([
      "id",
      "created_at",
      "createdAt",
      "updated_at",
      "updatedAt",
      "last_updated_by",
      "lastUpdatedBy"
    ]);
  }
});

// src/db/predicate.ts
function compilePredicate(fn, bindings) {
  try {
    const source = fn.toString();
    const names = extractParamNames(source);
    if (!names) return { type: "js", fn, reason: "could not extract parameter name" };
    const body = extractBody(source);
    if (!body) return { type: "js", fn, reason: "could not extract function body" };
    const tokens = tokenize(body);
    if (tokens.length === 0) return { type: "js", fn, reason: "empty token stream" };
    const parser = new Parser(tokens, names.row, names.bindings, bindings, fn);
    const ast = parser.parseExpression();
    if (!ast) return { type: "js", fn, reason: "could not parse expression" };
    if (parser.pos < tokens.length) return { type: "js", fn, reason: "unexpected tokens after expression" };
    const where = compileNode(ast);
    if (!where) return { type: "js", fn, reason: "could not compile to SQL" };
    return { type: "sql", where };
  } catch (err) {
    return { type: "js", fn, reason: `compilation error: ${err?.message || "unknown"}` };
  }
}
function extractParamNames(source) {
  const arrowIdx = source.indexOf("=>");
  if (arrowIdx === -1) return null;
  let paramList = source.slice(0, arrowIdx).trim();
  if (paramList.startsWith("(") && paramList.endsWith(")")) {
    paramList = paramList.slice(1, -1).trim();
  }
  if (paramList.length === 0) return null;
  const parts = splitParams(paramList);
  if (parts.length === 0 || parts.length > 2) return null;
  const row = stripTypeAnnotation(parts[0]);
  if (!row) return null;
  if (parts.length === 1) return { row };
  const bindings = stripTypeAnnotation(parts[1]);
  if (!bindings) return null;
  return { row, bindings };
}
function splitParams(input) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "<" || ch === "(") depth++;
    else if (ch === ">" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
function stripTypeAnnotation(part) {
  const colonIdx = part.indexOf(":");
  const name = (colonIdx === -1 ? part : part.slice(0, colonIdx)).trim();
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : null;
}
function extractBody(source) {
  const arrowIdx = source.indexOf("=>");
  if (arrowIdx === -1) return null;
  let body = source.slice(arrowIdx + 2).trim();
  if (body.startsWith("{")) {
    const match = body.match(/^\{\s*return\s+([\s\S]+?)\s*;?\s*\}$/);
    if (!match) return null;
    body = match[1];
  }
  return body.trim() || null;
}
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = "";
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === "\\") {
          i++;
          if (i < expr.length) str += expr[i];
        } else {
          str += expr[i];
        }
        i++;
      }
      if (i >= expr.length) return [];
      i++;
      tokens.push({ type: "string", value: str });
      continue;
    }
    if (ch === "`") return [];
    if (/[0-9]/.test(ch) || ch === "-" && i + 1 < expr.length && /[0-9]/.test(expr[i + 1])) {
      let num = ch;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: "number", value: num });
      continue;
    }
    if (expr.slice(i, i + 3) === "===" || expr.slice(i, i + 3) === "!==") {
      tokens.push({ type: "operator", value: expr.slice(i, i + 3) });
      i += 3;
      continue;
    }
    if (expr.slice(i, i + 2) === "==" || expr.slice(i, i + 2) === "!=" || expr.slice(i, i + 2) === "<=" || expr.slice(i, i + 2) === ">=" || expr.slice(i, i + 2) === "&&" || expr.slice(i, i + 2) === "||") {
      tokens.push({ type: "operator", value: expr.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (ch === "!" || ch === "<" || ch === ">") {
      tokens.push({ type: "operator", value: ch });
      i++;
      continue;
    }
    if (ch === ".") {
      tokens.push({ type: "dot", value: "." });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i++;
      continue;
    }
    if (ch === "[") {
      tokens.push({ type: "lbracket", value: "[" });
      i++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "rbracket", value: "]" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: "," });
      i++;
      continue;
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = ch;
      i++;
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      tokens.push({ type: "identifier", value: ident });
      continue;
    }
    return [];
  }
  return tokens;
}
function compileNode(node) {
  switch (node.kind) {
    case "comparison":
      return `${node.field} ${node.operator} ${escapeValue(node.value)}`;
    case "nullCheck":
      return `${node.field} ${node.isNull ? "IS NULL" : "IS NOT NULL"}`;
    case "in": {
      if (node.values.length === 0) return "0";
      const vals = node.values.map(escapeValue).join(", ");
      return `${node.field} IN (${vals})`;
    }
    case "like":
      return `${node.field} LIKE ${escapeValue(node.pattern)}`;
    case "booleanField":
      return node.negated ? `${node.field} = 0` : `${node.field} = 1`;
    case "logical": {
      const left = compileNode(node.left);
      const right = compileNode(node.right);
      if (!left || !right) return null;
      return `(${left} ${node.operator} ${right})`;
    }
    case "not": {
      const inner = compileNode(node.operand);
      if (!inner) return null;
      return `NOT (${inner})`;
    }
    default:
      return null;
  }
}
function isComparisonOp(value) {
  return value in JS_TO_SQL_OP;
}
var Parser, JS_TO_SQL_OP, PARSE_FAILED;
var init_predicate = __esm({
  "src/db/predicate.ts"() {
    "use strict";
    init_sql();
    Parser = class {
      constructor(tokens, paramName, bindingsName, bindingsValue, originalFn) {
        this.tokens = tokens;
        this.paramName = paramName;
        this.bindingsName = bindingsName;
        this.bindingsValue = bindingsValue;
        this.originalFn = originalFn;
      }
      pos = 0;
      /** Peek at the current token without consuming it. */
      peek() {
        return this.tokens[this.pos];
      }
      /** Consume the current token and advance. */
      advance() {
        return this.tokens[this.pos++];
      }
      /** Check if the current token matches an expected type and value. */
      match(type, value) {
        const t = this.peek();
        if (!t) return false;
        if (t.type !== type) return false;
        if (value !== void 0 && t.value !== value) return false;
        return true;
      }
      /** Consume a token if it matches, otherwise return false. */
      eat(type, value) {
        if (this.match(type, value)) {
          this.advance();
          return true;
        }
        return false;
      }
      // --- Grammar rules ---
      /** Entry point: parse a full expression. */
      parseExpression() {
        return this.parseOr();
      }
      /** or_expr → and_expr ( '||' and_expr )* */
      parseOr() {
        let left = this.parseAnd();
        if (!left) return null;
        while (this.match("operator", "||")) {
          this.advance();
          const right = this.parseAnd();
          if (!right) return null;
          left = { kind: "logical", operator: "OR", left, right };
        }
        return left;
      }
      /** and_expr → not_expr ( '&&' not_expr )* */
      parseAnd() {
        let left = this.parseNot();
        if (!left) return null;
        while (this.match("operator", "&&")) {
          this.advance();
          const right = this.parseNot();
          if (!right) return null;
          left = { kind: "logical", operator: "AND", left, right };
        }
        return left;
      }
      /** not_expr → '!' not_expr | primary */
      parseNot() {
        if (this.match("operator", "!")) {
          this.advance();
          if (this.match("lparen")) {
            this.advance();
            const inner2 = this.parseExpression();
            if (!inner2) return null;
            if (!this.eat("rparen")) return null;
            return { kind: "not", operand: inner2 };
          }
          const inner = this.parsePrimary();
          if (!inner) return null;
          if (inner.kind === "booleanField") {
            return { ...inner, negated: !inner.negated };
          }
          return { kind: "not", operand: inner };
        }
        return this.parsePrimary();
      }
      /**
       * primary → field_comparison | null_check | includes_expr | paren_expr | boolean_field
       *
       * This is the workhorse — handles the different patterns that can appear
       * as atomic expressions within a larger &&/|| combination.
       */
      parsePrimary() {
        if (this.match("lparen")) {
          this.advance();
          const inner = this.parseExpression();
          if (!inner) return null;
          if (!this.eat("rparen")) return null;
          return inner;
        }
        if (this.match("lbracket")) {
          return this.parseArrayIncludes();
        }
        if (this.match("identifier", this.paramName)) {
          return this.parseFieldExpression();
        }
        if (this.bindingsName && this.match("identifier", this.bindingsName)) {
          return this.parseBindingsArrayIncludes();
        }
        if (this.match("identifier")) {
          return this.parseNonParamExpression();
        }
        return null;
      }
      /**
       * Parse an expression that starts with the parameter name (e.g. `o.field`).
       *
       * Could be:
       * - `o.field === value` (comparison)
       * - `o.field != null` (null check)
       * - `o.field.includes('text')` (LIKE)
       * - `o.field` alone (boolean field check)
       */
      parseFieldExpression() {
        this.advance();
        const field = this.parseFieldPath();
        if (!field) return null;
        const next = this.peek();
        if (next?.type === "dot" && this.lookAheadForIncludes()) {
          return this.parseFieldIncludes(field);
        }
        if (next?.type === "operator" && isComparisonOp(next.value)) {
          return this.parseComparison(field);
        }
        return { kind: "booleanField", field, negated: false };
      }
      /**
       * Parse a dot-separated field path after the parameter name.
       * `o.status` → `"status"`, `o.address.city` → `"json_extract(address, '$.city')"`.
       */
      parseFieldPath() {
        if (!this.eat("dot")) return null;
        if (!this.match("identifier")) return null;
        const parts = [this.advance().value];
        while (this.match("dot") && this.tokens[this.pos + 1]?.type === "identifier") {
          if (this.tokens[this.pos + 2]?.type === "lparen") break;
          this.advance();
          parts.push(this.advance().value);
        }
        if (parts.length === 1) {
          return parts[0];
        }
        const root = parts[0];
        const jsonPath = "$." + parts.slice(1).join(".");
        return `json_extract(${root}, '${jsonPath}')`;
      }
      /**
       * Parse a comparison: `field OP value`.
       * The field has already been parsed; we need the operator and right-hand value.
       */
      parseComparison(field) {
        const opToken = this.advance();
        const jsOp = opToken.value;
        const value = this.parseValue();
        if (value === PARSE_FAILED) return null;
        if (value === null || value === void 0) {
          if (jsOp === "===" || jsOp === "==") {
            return { kind: "nullCheck", field, isNull: true };
          }
          if (jsOp === "!==" || jsOp === "!=") {
            return { kind: "nullCheck", field, isNull: false };
          }
          return null;
        }
        const sqlOp = JS_TO_SQL_OP[jsOp];
        if (!sqlOp) return null;
        return { kind: "comparison", field, operator: sqlOp, value };
      }
      /**
       * Parse `o.field.includes('text')` → LIKE expression.
       * The field name has already been parsed.
       */
      parseFieldIncludes(field) {
        this.advance();
        this.advance();
        if (!this.eat("lparen")) return null;
        const value = this.parseValue();
        if (value === PARSE_FAILED || typeof value !== "string") return null;
        if (!this.eat("rparen")) return null;
        const escaped = value.replace(/%/g, "\\%").replace(/_/g, "\\_");
        return { kind: "like", field, pattern: `%${escaped}%` };
      }
      /**
       * Parse `['a', 'b', 'c'].includes(o.field)` → IN expression.
       * The opening bracket has been peeked but not consumed.
       */
      parseArrayIncludes() {
        this.advance();
        const values = [];
        while (!this.match("rbracket")) {
          if (values.length > 0) {
            if (!this.eat("comma")) return null;
          }
          const val = this.parseValue();
          if (val === PARSE_FAILED) return null;
          values.push(val);
        }
        this.advance();
        if (!this.eat("dot")) return null;
        if (!this.match("identifier", "includes")) return null;
        this.advance();
        if (!this.eat("lparen")) return null;
        if (!this.match("identifier", this.paramName)) return null;
        this.advance();
        const field = this.parseFieldPath();
        if (!field) return null;
        if (!this.eat("rparen")) return null;
        return { kind: "in", field, values };
      }
      /**
       * Parse an expression that starts with an identifier that is NOT the
       * parameter name. This could be:
       * - A keyword literal: `true`, `false`, `null`, `undefined`
       * - A closure variable used in a comparison (handled by backtracking)
       */
      parseNonParamExpression() {
        const ident = this.peek().value;
        if (ident === "true" || ident === "false") return null;
        return null;
      }
      /**
       * Parse `$.ids.includes(o.field)` → IN expression with resolved values.
       * The bindings identifier has been peeked but not consumed.
       *
       * Falls back (returns null) if the resolved bindings value isn't an array,
       * or if the path doesn't exist on the bindings object.
       */
      parseBindingsArrayIncludes() {
        const bound = this.tryResolveBindingsValue();
        if (bound === PARSE_FAILED) return null;
        if (!Array.isArray(bound)) return null;
        if (!this.eat("dot")) return null;
        if (!this.match("identifier", "includes")) return null;
        this.advance();
        if (!this.eat("lparen")) return null;
        if (!this.match("identifier", this.paramName)) return null;
        this.advance();
        const field = this.parseFieldPath();
        if (!field) return null;
        if (!this.eat("rparen")) return null;
        return { kind: "in", field, values: bound };
      }
      /**
       * If the current token is the bindings parameter name, walk a dotted path
       * (`$.foo.bar`) and resolve the value from the bindings object. Returns
       * the resolved value or `PARSE_FAILED`.
       *
       * Stops walking before a method call (e.g. doesn't consume `.includes` in
       * `$.ids.includes(...)`) so the caller can dispatch on what follows.
       *
       * Restores `pos` on failure so callers can fall through cleanly.
       */
      tryResolveBindingsValue() {
        if (!this.bindingsName) return PARSE_FAILED;
        if (!this.match("identifier", this.bindingsName)) return PARSE_FAILED;
        if (this.bindingsValue == null) return PARSE_FAILED;
        const startPos = this.pos;
        this.advance();
        const path = [];
        while (this.match("dot") && this.tokens[this.pos + 1]?.type === "identifier") {
          if (this.tokens[this.pos + 2]?.type === "lparen") break;
          this.advance();
          path.push(this.advance().value);
        }
        if (path.length === 0) {
          this.pos = startPos;
          return PARSE_FAILED;
        }
        let value = this.bindingsValue;
        for (const key of path) {
          if (value == null || typeof value !== "object") {
            this.pos = startPos;
            return PARSE_FAILED;
          }
          value = value[key];
        }
        if (value === void 0) {
          this.pos = startPos;
          return PARSE_FAILED;
        }
        return value;
      }
      /**
       * Parse a literal value or closure variable reference.
       *
       * Returns the parsed value, or PARSE_FAILED if parsing fails.
       * Returns `null` or `undefined` for those keyword literals.
       */
      parseValue() {
        const t = this.peek();
        if (!t) return PARSE_FAILED;
        if (t.type === "string") {
          this.advance();
          return t.value;
        }
        if (t.type === "number") {
          this.advance();
          return Number(t.value);
        }
        if (t.type === "identifier") {
          if (t.value === "true") {
            this.advance();
            return true;
          }
          if (t.value === "false") {
            this.advance();
            return false;
          }
          if (t.value === "null") {
            this.advance();
            return null;
          }
          if (t.value === "undefined") {
            this.advance();
            return void 0;
          }
          if (this.bindingsName && t.value === this.bindingsName) {
            const bound = this.tryResolveBindingsValue();
            if (bound !== PARSE_FAILED) return bound;
          }
          return this.resolveClosureVariable();
        }
        if (t.type === "operator" && t.value === "-") {
          this.advance();
          const next = this.peek();
          if (next?.type === "number") {
            this.advance();
            return -Number(next.value);
          }
          return PARSE_FAILED;
        }
        return PARSE_FAILED;
      }
      /**
       * Attempt to resolve a closure variable's value.
       *
       * This handles the common pattern:
       * ```ts
       * const userId = auth.userId;
       * orders.filter(o => o.requestedBy === userId)
       * ```
       *
       * Closure variable resolution is fundamentally limited in JavaScript —
       * we can't access another function's closure scope from outside without
       * `eval`. The `===` operator can't be overridden via Proxy or
       * Symbol.toPrimitive, so we can't intercept comparisons.
       *
       * For now, this falls back to JS execution. The predicate still works
       * correctly — it just scans all rows instead of generating SQL.
       * This is the most common reason for JS fallback in practice, since
       * almost every real-world filter references a variable like `userId`.
       *
       * A future improvement could accept an explicit `vars` argument:
       * ```ts
       * orders.filter(o => o.requestedBy === $userId, { $userId: auth.userId })
       * ```
       */
      resolveClosureVariable() {
        this.advance();
        while (this.match("dot") && this.tokens[this.pos + 1]?.type === "identifier") {
          this.advance();
          this.advance();
        }
        return PARSE_FAILED;
      }
      /**
       * Look ahead to check if the next tokens form `.includes(`.
       * Used to disambiguate `o.field.includes(...)` from `o.field.nested`.
       */
      lookAheadForIncludes() {
        return this.tokens[this.pos]?.type === "dot" && this.tokens[this.pos + 1]?.type === "identifier" && this.tokens[this.pos + 1]?.value === "includes" && this.tokens[this.pos + 2]?.type === "lparen";
      }
    };
    JS_TO_SQL_OP = {
      "===": "=",
      "==": "=",
      "!==": "!=",
      "!=": "!=",
      "<": "<",
      ">": ">",
      "<=": "<=",
      ">=": ">="
    };
    PARSE_FAILED = /* @__PURE__ */ Symbol("PARSE_FAILED");
  }
});

// src/db/query.ts
function extractFieldName(accessor) {
  const source = accessor.toString();
  const match = source.match(
    /^\s*\(?([a-zA-Z_$][a-zA-Z0-9_$]*)\)?\s*=>\s*\1\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/
  );
  return match?.[2] ?? null;
}
var Query;
var init_query = __esm({
  "src/db/query.ts"() {
    "use strict";
    init_predicate();
    init_sql();
    Query = class _Query {
      _predicates;
      _sortAccessor;
      _reversed;
      _limit;
      _offset;
      _config;
      /** @internal Pre-compiled WHERE clause (bypasses predicate compiler). Used by Table.get(). */
      _rawWhere;
      _rawWhereParams;
      /** @internal Post-process transform applied after row deserialization. */
      _postProcess;
      constructor(config, options) {
        this._config = config;
        this._predicates = options?.predicates ?? [];
        this._sortAccessor = options?.sortAccessor;
        this._reversed = options?.reversed ?? false;
        this._limit = options?.limit;
        this._offset = options?.offset;
        this._postProcess = options?.postProcess;
        this._rawWhere = options?.rawWhere;
        this._rawWhereParams = options?.rawWhereParams;
      }
      _clone(overrides) {
        return new _Query(this._config, {
          predicates: overrides.predicates ?? this._predicates,
          sortAccessor: overrides.sortAccessor ?? this._sortAccessor,
          reversed: overrides.reversed ?? this._reversed,
          limit: overrides.limit ?? this._limit,
          offset: overrides.offset ?? this._offset,
          postProcess: overrides.postProcess,
          rawWhere: this._rawWhere,
          rawWhereParams: this._rawWhereParams
        });
      }
      filter(predicate, bindings) {
        return this._clone({
          predicates: [...this._predicates, { fn: predicate, bindings }]
        });
      }
      sortBy(accessor) {
        return this._clone({ sortAccessor: accessor });
      }
      reverse() {
        return this._clone({ reversed: !this._reversed });
      }
      take(n) {
        return this._clone({ limit: n });
      }
      skip(n) {
        return this._clone({ offset: n });
      }
      // -------------------------------------------------------------------------
      // Terminal methods
      // -------------------------------------------------------------------------
      first() {
        return this._clone({
          limit: 1,
          postProcess: (rows) => rows[0] ?? null
        });
      }
      last() {
        return this._clone({
          limit: 1,
          reversed: !this._reversed,
          postProcess: (rows) => rows[0] ?? null
        });
      }
      count() {
        return this._clone({
          postProcess: (rows) => rows.length
        });
      }
      some() {
        return this._clone({
          limit: 1,
          postProcess: (rows) => rows.length > 0
        });
      }
      async every() {
        const compiled = this._compilePredicates();
        if (compiled.allSql && compiled.sqlWhere) {
          const query = buildExists(
            this._config.tableName,
            `NOT (${compiled.sqlWhere})`,
            void 0,
            true
          );
          const results = await this._config.executeBatch([query]);
          const row = results[0]?.rows[0];
          return row?.result === 1;
        }
        if (this._predicates.length === 0) return true;
        const allRows = await this._fetchAllRows();
        return allRows.every(
          (row) => this._predicates.every((p) => p.fn(row, p.bindings))
        );
      }
      min(accessor) {
        return this.sortBy(accessor).first();
      }
      max(accessor) {
        return this.sortBy(accessor).reverse().first();
      }
      groupBy(accessor) {
        return this._clone({
          postProcess: (rows) => {
            const map = /* @__PURE__ */ new Map();
            for (const row of rows) {
              const key = accessor(row);
              const group = map.get(key);
              if (group) group.push(row);
              else map.set(key, [row]);
            }
            return map;
          }
        });
      }
      // -------------------------------------------------------------------------
      // Batch compilation — used by db.batch() to extract SQL without executing
      // -------------------------------------------------------------------------
      /**
       * @internal Compile this query into a SqlQuery for batch execution.
       *
       * Returns the compiled SQL query (if all predicates compile to SQL),
       * or null (if JS fallback is needed). In the fallback case, a bare
       * `SELECT *` is returned as `fallbackQuery` so the batch can fetch
       * all rows and this query can filter them in JS post-fetch.
       */
      _compile() {
        if (this._rawWhere) {
          const query = buildSelect(this._config.tableName, {
            where: this._rawWhere,
            whereParams: this._rawWhereParams,
            orderBy: void 0,
            limit: this._limit,
            offset: this._offset
          });
          return { type: "query", query, fallbackQuery: null, config: this._config, postProcess: this._postProcess };
        }
        const compiled = this._compilePredicates();
        const sortField = this._sortAccessor ? extractFieldName(this._sortAccessor) : void 0;
        if (compiled.allSql) {
          const query = buildSelect(this._config.tableName, {
            where: compiled.sqlWhere || void 0,
            orderBy: sortField ?? void 0,
            desc: this._reversed,
            limit: this._limit,
            offset: this._offset
          });
          return { type: "query", query, fallbackQuery: null, config: this._config, postProcess: this._postProcess };
        }
        const fallbackQuery = buildSelect(this._config.tableName);
        return {
          type: "query",
          query: null,
          fallbackQuery,
          config: this._config,
          predicates: this._predicates,
          sortAccessor: this._sortAccessor,
          reversed: this._reversed,
          limit: this._limit,
          offset: this._offset,
          postProcess: this._postProcess
        };
      }
      /**
       * @internal Process raw SQL results into typed rows. Used by db.batch()
       * after executing the compiled query.
       *
       * For SQL-compiled queries: just deserialize the rows.
       * For JS-fallback queries: filter, sort, and slice in JS.
       */
      static _processResults(result, compiled) {
        const rows = result.rows.map(
          (row) => deserializeRow(
            row,
            compiled.config.columns
          )
        );
        if (compiled.query) {
          return compiled.postProcess ? compiled.postProcess(rows) : rows;
        }
        let filtered = compiled.predicates ? rows.filter((row) => compiled.predicates.every((p) => p.fn(row, p.bindings))) : rows;
        if (compiled.sortAccessor) {
          const accessor = compiled.sortAccessor;
          const reversed = compiled.reversed ?? false;
          filtered.sort((a, b) => {
            const aVal = accessor(a);
            const bVal = accessor(b);
            if (aVal < bVal) return reversed ? 1 : -1;
            if (aVal > bVal) return reversed ? -1 : 1;
            return 0;
          });
        }
        if (compiled.offset != null || compiled.limit != null) {
          const start = compiled.offset ?? 0;
          const end = compiled.limit != null ? start + compiled.limit : void 0;
          filtered = filtered.slice(start, end);
        }
        return compiled.postProcess ? compiled.postProcess(filtered) : filtered;
      }
      // -------------------------------------------------------------------------
      // PromiseLike
      // -------------------------------------------------------------------------
      then(onfulfilled, onrejected) {
        const promise = this._execute().then(
          (rows) => this._postProcess ? this._postProcess(rows) : rows
        );
        return promise.then(onfulfilled, onrejected);
      }
      catch(onrejected) {
        return this.then(void 0, onrejected);
      }
      // -------------------------------------------------------------------------
      // Execution internals
      // -------------------------------------------------------------------------
      async _execute() {
        if (this._rawWhere) {
          const query = buildSelect(this._config.tableName, {
            where: this._rawWhere,
            whereParams: this._rawWhereParams,
            limit: this._limit,
            offset: this._offset
          });
          const results = await this._config.executeBatch([query]);
          return results[0].rows.map(
            (row) => deserializeRow(
              row,
              this._config.columns
            )
          );
        }
        const compiled = this._compilePredicates();
        if (compiled.allSql) {
          const sortField = this._sortAccessor ? extractFieldName(this._sortAccessor) : void 0;
          const query = buildSelect(this._config.tableName, {
            where: compiled.sqlWhere || void 0,
            orderBy: sortField ?? void 0,
            desc: this._reversed,
            limit: this._limit,
            offset: this._offset
          });
          const results = await this._config.executeBatch([query]);
          return results[0].rows.map(
            (row) => deserializeRow(
              row,
              this._config.columns
            )
          );
        }
        let rows = await this._fetchAndFilterInJs(compiled);
        if (this._sortAccessor) {
          const accessor = this._sortAccessor;
          rows.sort((a, b) => {
            const aVal = accessor(a);
            const bVal = accessor(b);
            if (aVal < bVal) return this._reversed ? 1 : -1;
            if (aVal > bVal) return this._reversed ? -1 : 1;
            return 0;
          });
        }
        if (this._offset != null || this._limit != null) {
          const start = this._offset ?? 0;
          const end = this._limit != null ? start + this._limit : void 0;
          rows = rows.slice(start, end);
        }
        return rows;
      }
      _compilePredicates() {
        if (this._predicates.length === 0) {
          return { allSql: true, sqlWhere: "", compiled: [] };
        }
        const compiled = this._predicates.map((p) => compilePredicate(p.fn, p.bindings));
        const allSql = compiled.every((c) => c.type === "sql");
        let sqlWhere = "";
        if (allSql) {
          sqlWhere = compiled.map((c) => c.where).join(" AND ");
        }
        return { allSql, sqlWhere, compiled };
      }
      async _fetchAndFilterInJs(compiled) {
        const allRows = await this._fetchAllRows();
        const jsFallbacks = compiled.compiled.filter((c) => c.type === "js");
        if (jsFallbacks.length > 0) {
          const reasons = jsFallbacks.map((c) => c.type === "js" ? c.reason : void 0).filter(Boolean);
          const reasonSuffix = reasons.length > 0 ? ` (${reasons.join("; ")})` : "";
          console.warn(
            `[mindstudio] Filter on '${this._config.tableName}' could not be compiled to SQL${reasonSuffix} \u2014 scanning ${allRows.length} rows in JS`
          );
        }
        return allRows.filter(
          (row) => this._predicates.every((p) => p.fn(row, p.bindings))
        );
      }
      async _fetchAllRows() {
        const query = buildSelect(this._config.tableName);
        const results = await this._config.executeBatch([query]);
        return results[0].rows.map(
          (row) => deserializeRow(row, this._config.columns)
        );
      }
    };
  }
});

// src/db/mutation.ts
var Mutation;
var init_mutation = __esm({
  "src/db/mutation.ts"() {
    "use strict";
    init_errors();
    Mutation = class _Mutation {
      /** @internal */
      _config;
      /** @internal */
      _queries;
      /** @internal */
      _processResult;
      /** @internal Non-batchable executor for complex mutations (e.g. removeAll JS fallback). */
      _executor;
      constructor(config, queries, processResult) {
        this._config = config;
        this._queries = queries;
        this._processResult = processResult;
        this._executor = void 0;
      }
      /**
       * Create a non-batchable mutation that wraps an async executor.
       * Used for operations that require multi-step execution (e.g. removeAll
       * with a JS-fallback predicate: fetch all rows → filter → delete).
       *
       * Works fine when awaited standalone. Throws if passed to db.batch().
       *
       * @internal
       */
      static fromExecutor(config, executor) {
        const m = new _Mutation(config, [], () => void 0);
        Object.defineProperty(m, "_executor", { value: executor });
        return m;
      }
      // -------------------------------------------------------------------------
      // PromiseLike — executes on await
      // -------------------------------------------------------------------------
      then(onfulfilled, onrejected) {
        return this._execute().then(onfulfilled, onrejected);
      }
      catch(onrejected) {
        return this._execute().catch(onrejected);
      }
      // -------------------------------------------------------------------------
      // Batch compilation — used by db.batch()
      // -------------------------------------------------------------------------
      /**
       * @internal Compile this mutation into SQL for batch execution.
       * Returns the queries and a result processor.
       *
       * Throws if this is a non-batchable mutation (created via fromExecutor).
       */
      _compile() {
        if (this._executor) {
          throw new MindStudioError(
            "This operation cannot be batched (e.g. removeAll with a JS-fallback predicate). Await it separately instead of passing to db.batch().",
            "not_batchable",
            400
          );
        }
        return {
          type: "mutation",
          queries: this._queries,
          config: this._config,
          processResult: this._processResult
        };
      }
      /**
       * @internal Process raw SQL results into the typed result.
       * Used by db.batch() after executing the compiled queries.
       */
      static _processResults(results, compiled) {
        return compiled.processResult(results);
      }
      // -------------------------------------------------------------------------
      // Execution
      // -------------------------------------------------------------------------
      async _execute() {
        if (this._executor) {
          return this._executor();
        }
        const results = await this._config.executeBatch(this._queries);
        return this._processResult(results);
      }
    };
  }
});

// src/db/table.ts
var Table;
var init_table = __esm({
  "src/db/table.ts"() {
    "use strict";
    init_query();
    init_mutation();
    init_predicate();
    init_errors();
    init_sql();
    Table = class {
      /** @internal */
      _config;
      constructor(config) {
        this._config = config;
      }
      // -------------------------------------------------------------------------
      // Reads — all return batchable Query objects (lazy until awaited)
      // -------------------------------------------------------------------------
      /** Get a single row by ID. Returns null if not found. */
      get(id) {
        return new Query(this._config, {
          rawWhere: "id = ?",
          rawWhereParams: [id],
          limit: 1,
          postProcess: (rows) => rows[0] ?? null
        });
      }
      findOne(predicate, bindings) {
        return this.filter(predicate, bindings).first();
      }
      count(predicate, bindings) {
        if (predicate) return this.filter(predicate, bindings).count();
        return this.toArray().count();
      }
      some(predicate, bindings) {
        return this.filter(predicate, bindings).some();
      }
      async every(predicate, bindings) {
        return this.filter(predicate, bindings).every();
      }
      /** True if the table has zero rows. */
      async isEmpty() {
        const query = buildExists(this._config.tableName, void 0, void 0, true);
        const results = await this._config.executeBatch([query]);
        const row = results[0]?.rows[0];
        return row?.result === 1;
      }
      /** Row with the minimum value for a field, or null if table is empty. */
      min(accessor) {
        return this.sortBy(accessor).first();
      }
      /** Row with the maximum value for a field, or null if table is empty. */
      max(accessor) {
        return this.sortBy(accessor).reverse().first();
      }
      /** Group rows by a field. Returns a Map. */
      groupBy(accessor) {
        return new Query(this._config).groupBy(accessor);
      }
      /** Get all rows as an array. */
      toArray() {
        return new Query(this._config);
      }
      filter(predicate, bindings) {
        return new Query(this._config).filter(predicate, bindings);
      }
      /** Sort rows by a field. Returns a chainable Query. */
      sortBy(accessor) {
        return new Query(this._config).sortBy(accessor);
      }
      push(data) {
        const isArray = Array.isArray(data);
        const items = (isArray ? data : [data]).map(
          (item) => this._config.defaults ? { ...this._config.defaults, ...item } : item
        );
        for (const item of items) {
          this._checkManagedColumns(item);
        }
        const queries = items.map(
          (item) => buildInsert(
            this._config.tableName,
            item,
            this._config.columns
          )
        );
        return new Mutation(this._config, queries, (results) => {
          const rows = results.map((r) => {
            if (r.rows.length > 0) {
              return deserializeRow(
                r.rows[0],
                this._config.columns
              );
            }
            throw new MindStudioError(
              `Insert into '${this._config.tableName}' succeeded but returned no row. This may indicate a constraint violation.`,
              "insert_failed",
              500
            );
          });
          const result = isArray ? rows : rows[0];
          this._syncRolesIfNeeded(
            items,
            result,
            isArray
          );
          return result;
        });
      }
      /**
       * Update a row by ID. Only the provided fields are changed.
       * Returns the updated row via `UPDATE ... RETURNING *`.
       */
      update(id, data) {
        this._checkManagedColumns(data);
        const query = buildUpdate(
          this._config.tableName,
          id,
          data,
          this._config.columns
        );
        return new Mutation(this._config, [query], (results) => {
          if (!results[0]?.rows[0]) {
            throw new MindStudioError(
              `Row not found: no row with ID '${id}' in table '${this._config.tableName}'`,
              "row_not_found",
              404
            );
          }
          const result = deserializeRow(
            results[0].rows[0],
            this._config.columns
          );
          this._syncRolesIfNeeded(
            [data],
            result,
            false
          );
          return result;
        });
      }
      remove(id) {
        const query = buildDelete(this._config.tableName, `id = ?`, [id]);
        return new Mutation(this._config, [query], (results) => ({
          deleted: results[0].changes > 0
        }));
      }
      removeAll(predicate, bindings) {
        const compiled = compilePredicate(predicate, bindings);
        if (compiled.type === "sql") {
          const query = buildDelete(this._config.tableName, compiled.where);
          return new Mutation(this._config, [query], (results) => results[0].changes);
        }
        return Mutation.fromExecutor(this._config, async () => {
          console.warn(
            `[mindstudio] removeAll predicate on ${this._config.tableName} could not be compiled to SQL \u2014 fetching all rows first`
          );
          const allQuery = buildSelect(this._config.tableName);
          const allResults = await this._config.executeBatch([allQuery]);
          const allRows = allResults[0].rows.map(
            (r) => deserializeRow(
              r,
              this._config.columns
            )
          );
          const matching = allRows.filter((row) => predicate(row, bindings));
          if (matching.length === 0) return 0;
          const deleteQueries = matching.filter((row) => row.id).map((row) => buildDelete(this._config.tableName, `id = ?`, [row.id]));
          if (deleteQueries.length > 0) {
            await this._config.executeBatch(deleteQueries);
          }
          return matching.length;
        });
      }
      clear() {
        const query = buildDelete(this._config.tableName);
        return new Mutation(this._config, [query], (results) => results[0].changes);
      }
      /**
       * Insert a row, or update it if a row with the same unique key already
       * exists. The conflict key must match a `unique` constraint declared in
       * defineTable options. Returns the created or updated row.
       *
       * Uses SQLite's `INSERT ... ON CONFLICT ... DO UPDATE SET ... RETURNING *`.
       *
       * @param conflictKey - Column name(s) that form the unique constraint.
       *   Pass a single string for single-column unique, or an array for compound.
       * @param data - Row data to insert (or update on conflict). Defaults apply.
       */
      upsert(conflictKey, data) {
        const conflictColumns = Array.isArray(conflictKey) ? conflictKey : [conflictKey];
        this._validateUniqueConstraint(conflictColumns);
        const withDefaults = this._config.defaults ? { ...this._config.defaults, ...data } : data;
        this._checkManagedColumns(withDefaults);
        for (const col of conflictColumns) {
          if (!(col in withDefaults)) {
            throw new MindStudioError(
              `Upsert on ${this._config.tableName} requires "${col}" in data (conflict key)`,
              "missing_conflict_key",
              400
            );
          }
        }
        const query = buildUpsert(
          this._config.tableName,
          withDefaults,
          conflictColumns,
          this._config.columns
        );
        return new Mutation(this._config, [query], (results) => {
          if (!results[0]?.rows[0]) {
            throw new MindStudioError(
              `Upsert into ${this._config.tableName} returned no row`,
              "upsert_failed",
              500
            );
          }
          const result = deserializeRow(
            results[0].rows[0],
            this._config.columns
          );
          this._syncRolesIfNeeded([withDefaults], result, false);
          return result;
        });
      }
      // -------------------------------------------------------------------------
      // Internal helpers
      // -------------------------------------------------------------------------
      /** @internal Throw if data includes a platform-managed read-only column. */
      _checkManagedColumns(data) {
        const mc = this._config.managedColumns;
        if (!mc) return;
        const keys = Object.keys(data);
        for (const key of keys) {
          if (mc.email && key === mc.email || mc.phone && key === mc.phone || mc.apiKey && key === mc.apiKey) {
            const friendly = key === mc.email ? "email" : key === mc.phone ? "phone" : "API key";
            throw new MindStudioError(
              `Cannot write to "${key}" \u2014 this column is managed by auth. Use the auth API to change a user's ${friendly}.`,
              "managed_column_write",
              400
            );
          }
        }
      }
      /**
       * @internal Fire role sync for rows that wrote to the roles column.
       * Called inside processResult (runs after SQL execution in both
       * standalone and batch paths). Fire-and-forget.
       */
      _syncRolesIfNeeded(inputItems, result, isArray) {
        const rolesCol = this._config.managedColumns?.roles;
        const syncRoles = this._config.syncRoles;
        if (!rolesCol || !syncRoles) return;
        if (!inputItems.some((item) => rolesCol in item)) return;
        if (isArray) {
          for (const row of result) {
            if (row?.id) {
              syncRoles(row.id, row[rolesCol]).catch(() => {
              });
            }
          }
        } else {
          const row = result;
          if (row?.id) {
            syncRoles(row.id, row[rolesCol]).catch(() => {
            });
          }
        }
      }
      /** @internal Validate that the given columns match a declared unique constraint. */
      _validateUniqueConstraint(columns) {
        if (!this._config.unique?.length) {
          throw new MindStudioError(
            `Cannot upsert on ${this._config.tableName}: no unique constraints declared. Add unique: [[${columns.map((c) => `'${c}'`).join(", ")}]] to defineTable options.`,
            "no_unique_constraint",
            400
          );
        }
        const sorted = [...columns].sort().join(",");
        const match = this._config.unique.some(
          (u) => [...u].sort().join(",") === sorted
        );
        if (!match) {
          throw new MindStudioError(
            `Cannot upsert on (${columns.join(", ")}): no matching unique constraint declared on ${this._config.tableName}.`,
            "no_unique_constraint",
            400
          );
        }
      }
    };
  }
});

// src/db/index.ts
function createDb(databases, executeBatch, authConfig, syncRoles) {
  return {
    defineTable(name, options) {
      const resolved = resolveTable(databases, name, options?.database);
      const config = {
        databaseId: resolved.databaseId,
        tableName: name,
        columns: resolved.columns,
        unique: options?.unique,
        defaults: options?.defaults,
        managedColumns: authConfig?.table === name ? authConfig.columns : void 0,
        syncRoles: authConfig?.table === name && authConfig.columns.roles ? syncRoles : void 0,
        executeBatch: (queries) => executeBatch(resolved.databaseId, queries)
      };
      return new Table(config);
    },
    // --- Time helpers ---
    // Pure JS, no platform dependency. All timestamps are unix ms.
    now: () => Date.now(),
    days: (n) => n * 864e5,
    hours: (n) => n * 36e5,
    minutes: (n) => n * 6e4,
    ago: (ms) => Date.now() - ms,
    fromNow: (ms) => Date.now() + ms,
    // --- User references ---
    userRef: (id) => id.startsWith(USER_PREFIX) ? id.slice(USER_PREFIX.length) : id,
    // --- Batch execution ---
    batch: ((...operations) => {
      return (async () => {
        const compiled = operations.map((op) => {
          if (op instanceof Query) {
            return op._compile();
          }
          if (op instanceof Mutation) {
            return op._compile();
          }
          throw new MindStudioError(
            "db.batch() only accepts Query and Mutation objects (from .filter(), .update(), .push(), etc.)",
            "invalid_batch_operation",
            400
          );
        });
        const groups = /* @__PURE__ */ new Map();
        for (let i = 0; i < compiled.length; i++) {
          const c = compiled[i];
          const dbId = c.config.databaseId;
          if (!groups.has(dbId)) groups.set(dbId, []);
          if (c.type === "query") {
            const sqlQuery = c.query ?? c.fallbackQuery;
            groups.get(dbId).push({ opIndex: i, sqlQueries: [sqlQuery] });
          } else {
            groups.get(dbId).push({ opIndex: i, sqlQueries: c.queries });
          }
        }
        const opResults = /* @__PURE__ */ new Map();
        await Promise.all(
          Array.from(groups.entries()).map(async ([dbId, entries]) => {
            const flatQueries = [];
            const slices = [];
            for (const entry of entries) {
              slices.push({
                opIndex: entry.opIndex,
                start: flatQueries.length,
                count: entry.sqlQueries.length
              });
              flatQueries.push(...entry.sqlQueries);
            }
            const results = await executeBatch(dbId, flatQueries);
            for (const { opIndex, start, count } of slices) {
              opResults.set(opIndex, results.slice(start, start + count));
            }
          })
        );
        return compiled.map((c, i) => {
          const results = opResults.get(i);
          if (c.type === "query") {
            if (!c.query && c.predicates?.length) {
              console.warn(
                `[mindstudio] db.batch(): filter on '${c.config.tableName}' could not be compiled to SQL \u2014 processing in JS`
              );
            }
            return Query._processResults(results[0], c);
          } else {
            return Mutation._processResults(results, c);
          }
        });
      })();
    })
  };
}
function resolveTable(databases, tableName, databaseHint) {
  if (databases.length === 0) {
    throw new MindStudioError(
      `No databases found in app context. Make sure the app has at least one database configured.`,
      "no_databases",
      400
    );
  }
  if (databaseHint) {
    const targetDb = databases.find(
      (db) => db.id === databaseHint || db.name === databaseHint
    );
    if (!targetDb) {
      const available = databases.map((db) => db.name || db.id).join(", ");
      throw new MindStudioError(
        `Database "${databaseHint}" not found. Available databases: ${available}`,
        "database_not_found",
        400
      );
    }
    const table = targetDb.tables.find((t) => t.name === tableName);
    if (!table) {
      const available = targetDb.tables.map((t) => t.name).join(", ");
      throw new MindStudioError(
        `Table "${tableName}" not found in database "${databaseHint}". Available tables: ${available || "(none)"}`,
        "table_not_found",
        400
      );
    }
    return { databaseId: targetDb.id, columns: table.schema };
  }
  for (const db of databases) {
    const table = db.tables.find((t) => t.name === tableName);
    if (table) {
      return {
        databaseId: db.id,
        columns: table.schema
      };
    }
  }
  const availableTables = databases.flatMap((db) => db.tables.map((t) => t.name)).join(", ");
  throw new MindStudioError(
    `Table "${tableName}" not found in app databases. Available tables: ${availableTables || "(none)"}`,
    "table_not_found",
    400
  );
}
var init_db = __esm({
  "src/db/index.ts"() {
    "use strict";
    init_errors();
    init_table();
    init_query();
    init_mutation();
    init_sql();
    init_table();
  }
});

// src/files/store.ts
import { createHash, randomUUID } from "crypto";
function toBase64(content) {
  return Buffer.from(
    typeof content === "string" ? Buffer.from(content) : content
  ).toString("base64");
}
function extensionFor(filename) {
  if (!filename) {
    return "";
  }
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot) : "";
}
var Store;
var init_store = __esm({
  "src/files/store.ts"() {
    "use strict";
    init_errors();
    Store = class {
      constructor(_store, _access, _call, _policy = {}) {
        this._store = _store;
        this._access = _access;
        this._call = _call;
        this._policy = _policy;
      }
      /** The store's name. */
      get name() {
        return this._store;
      }
      /** The store's access level. */
      get access() {
        return this._access;
      }
      /** Store bytes. Returns a {@link StoredFile} with a ready-to-use `url`. */
      async put(content, options) {
        const ext = extensionFor(options?.filename);
        const key = options?.key ?? (options?.contentAddressed ? `${createHash("sha256").update(content).digest("hex")}${ext}` : `${randomUUID()}${ext}`);
        const meta = await this._call("put", {
          store: this._store,
          access: this._access,
          key,
          body: toBase64(content),
          ...options?.contentType ? { contentType: options.contentType } : {}
        });
        return this._toFile(key, meta);
      }
      /** Read an object's bytes (backend / trusted context). */
      async get(key) {
        const res = await this._call("get", {
          store: this._store,
          access: this._access,
          key
        });
        return Buffer.from(res.body, "base64");
      }
      /** Metadata without downloading. Rejects if the object doesn't exist. */
      async head(key) {
        const meta = await this._call("head", {
          store: this._store,
          access: this._access,
          key
        });
        return this._toFile(key, meta);
      }
      /** Whether an object exists. */
      async exists(key) {
        try {
          await this.head(key);
          return true;
        } catch {
          return false;
        }
      }
      /** List objects in the store (optionally under `prefix`), one page at a time. */
      async list(options) {
        const res = await this._call("list", {
          store: this._store,
          access: this._access,
          ...options?.prefix ? { prefix: options.prefix } : {},
          ...options?.cursor ? { cursor: options.cursor } : {},
          ...options?.limit ? { limit: options.limit } : {}
        });
        return {
          files: (res.files ?? []).map((f) => this._toFile(f.key, f)),
          ...res.cursor ? { cursor: res.cursor } : {}
        };
      }
      /** Delete an object. No-op if it doesn't exist. */
      async delete(key) {
        await this._call("delete", {
          store: this._store,
          access: this._access,
          key
        });
      }
      /**
       * Mint an ABSOLUTE, signed share URL for a key — works with **no** active
       * session (email it, or embed it on another site). Expires (default 24h).
       * Private stores only.
       *
       * The same link is available as `file.shareUrl()` on a {@link StoredFile};
       * this convenience skips the `head()` when you already hold just the key.
       */
      async shareUrl(key, options) {
        const res = await this._call("sign", {
          store: this._store,
          access: this._access,
          key,
          ...options?.expiresIn ? { expiresIn: options.expiresIn } : {}
        });
        return res.url;
      }
      /**
       * Mint an {@link UploadToken} for a **client-direct** upload — the browser
       * POSTs the file straight to storage, so the bytes never pass through the
       * platform. Return the token from a backend method and hand it to the
       * frontend's `platform.upload(token, file)`. Works for private + public stores.
       *
       * Enforced at upload time by the presigned POST: a max size (this call's
       * `maxSize`, else the store's, else the platform default) and — when
       * `contentType` is set — an exact content-type match. When the store declares
       * `contentTypes`, `contentType` must be one of them.
       *
       * Note: a presigned POST can pin exactly ONE content-type per token, so the
       * *allowlist* is declared on `defineStore({ contentTypes })` and each token
       * pins one type from it. This is by design, not a per-token limitation.
       *
       * @example
       * ```ts
       * // backend method
       * export async function getUploadSlot(input: { contentType: string }) {
       *   return Uploads.createUploadToken({ contentType: input.contentType, maxSize: 50 * 1024 * 1024 });
       * }
       * ```
       */
      async createUploadToken(options) {
        if (options?.contentType && this._policy.contentTypes && !this._policy.contentTypes.includes(options.contentType)) {
          throw new MindStudioError(
            `contentType "${options.contentType}" is not allowed by store "${this._store}".`,
            "content_type_not_allowed",
            400
          );
        }
        const key = options?.key ?? `${randomUUID()}${extensionFor(options?.filename)}`;
        const maxSize = options?.maxSize ?? this._policy.maxSize;
        const res = await this._call("create-upload", {
          store: this._store,
          access: this._access,
          key,
          ...options?.contentType ? { contentType: options.contentType } : {},
          ...maxSize ? { maxSize } : {},
          ...options?.expiresIn ? { expiresIn: options.expiresIn } : {}
        });
        return {
          key,
          url: `/_/files/${this._access}/${this._store}/${key}`,
          upload: { url: res.uploadUrl, fields: res.uploadFields }
        };
      }
      _toFile(key, meta) {
        const store = this._store;
        const access = this._access;
        const call = this._call;
        return {
          store,
          key,
          access,
          url: `/_/files/${access}/${store}/${key}`,
          ...typeof meta?.size === "number" ? { size: meta.size } : {},
          ...meta?.contentType ? { contentType: meta.contentType } : {},
          ...meta?.updatedAt ? { updatedAt: meta.updatedAt } : {},
          async shareUrl(options) {
            const res = await call("sign", {
              store,
              access,
              key,
              ...options?.expiresIn ? { expiresIn: options.expiresIn } : {}
            });
            return res.url;
          }
        };
      }
    };
  }
});

// src/files/index.ts
function createFiles(call) {
  return {
    defineStore(name, options) {
      return new Store(name, options?.access ?? "private", call, {
        ...options?.maxSize !== void 0 ? { maxSize: options.maxSize } : {},
        ...options?.contentTypes ? { contentTypes: options.contentTypes } : {}
      });
    }
  };
}
var init_files = __esm({
  "src/files/index.ts"() {
    "use strict";
    init_store();
  }
});

// src/datasources/source.ts
import { createHash as createHash2 } from "crypto";
var DataSource;
var init_source = __esm({
  "src/datasources/source.ts"() {
    "use strict";
    DataSource = class {
      constructor(_slug, _call) {
        this._slug = _slug;
        this._call = _call;
      }
      get name() {
        return this._slug;
      }
      /**
       * Search the corpus.
       *
       * Returns chunks ranked by relevance, each with a citation. Searching a
       * source that doesn't exist yet returns no results rather than throwing —
       * code may name a corpus the build hasn't populated.
       *
       * **Deterministic** for a fixed corpus and configuration: the same query
       * returns the same hits in the same order, so it's safe to build an eval set
       * or a regression check on top of it. There is no seed to set. Two things do
       * legitimately move the results: adding or removing documents, and changing
       * the corpus configuration — both of which you control.
       *
       * Alongside `results` and `latencyMs` comes {@link SearchRan} — what the
       * search actually did, which is the first thing to check when results don't
       * look like the options you passed.
       */
      async search(query, options) {
        const { results, mode, latencyMs } = await this._call("search", {
          slug: this._slug,
          query,
          ...options?.topK !== void 0 ? { topK: options.topK } : {},
          ...options?.scoreThreshold !== void 0 ? { scoreThreshold: options.scoreThreshold } : {},
          ...options?.filter !== void 0 ? { filter: options.filter } : {},
          ...options?.mode !== void 0 ? { mode: options.mode } : {},
          ...options?.maxPerDocument !== void 0 ? { maxPerDocument: options.maxPerDocument } : {},
          ...options?.highlight !== void 0 ? { highlight: options.highlight } : {},
          ...options?.rerank !== void 0 ? { rerank: options.rerank } : {},
          ...options?.hybrid !== void 0 ? { hybrid: options.hybrid } : {},
          ...options?.explain !== void 0 ? { explain: options.explain } : {},
          ...options?.expand !== void 0 ? { expand: options.expand } : {}
        });
        return { results: results ?? [], mode, latencyMs: latencyMs ?? 0 };
      }
      /**
       * What is in the corpus, and how it was built.
       *
       * Document and chunk counts, storage, and the embedding model and chunking
       * settings actually in effect — which is not the same as the platform
       * default, since a corpus keeps the configuration it was built with until
       * someone migrates it.
       */
      async stats() {
        return this._call("stats", { slug: this._slug });
      }
      /**
       * Every chunk of one document, exactly as it was indexed.
       *
       * The direct answer to "why isn't this document coming back?" — search only
       * shows you the chunks that surface, which is no help when none do. Reading
       * how a document was actually split usually is.
       *
       * Pass `{ vectors: true }` to include each chunk's embedding. Large: roughly
       * 8KB per chunk, so a 500-chunk document is several megabytes.
       */
      async chunks(documentId, options) {
        const { chunks } = await this._call("chunks", {
          slug: this._slug,
          documentId,
          ...options?.vectors ? { vectors: true } : {}
        });
        return chunks ?? [];
      }
      /**
       * Add a document to the corpus.
       *
       * Returns as soon as the document is queued — extraction and embedding run
       * in the background and take a while, so poll {@link documents} for status
       * rather than assuming the content is searchable on return.
       *
       * **Adding the same bytes twice is free.** Documents are content-addressed,
       * so a re-add is a no-op when this source has already processed those exact
       * bytes under its current configuration. Reconfiguring the source is what
       * makes a re-add do work again — and that is an explicit, owner-triggered
       * migration, never something a deploy causes.
       */
      async add(content, options) {
        const bytes = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
        return this._call("add", {
          slug: this._slug,
          filename: options.filename,
          ...options.contentType ? { contentType: options.contentType } : {},
          ...options.metadata !== void 0 ? { metadata: options.metadata } : {},
          body: bytes.toString("base64")
        });
      }
      /** Every document in the corpus, with ingest status. */
      async documents() {
        const { documents } = await this._call("documents", { slug: this._slug });
        return documents ?? [];
      }
      /** Remove a document and its vectors. */
      async remove(documentId) {
        await this._call("remove", { slug: this._slug, documentId });
      }
      /**
       * Create the data source if it doesn't exist yet.
       *
       * Rarely needed — `add` and `search` both handle a missing source. Useful
       * when you want it to exist (and appear in the dashboard) before any
       * document has been added.
       */
      async ensure(name) {
        await this._call("ensure", {
          slug: this._slug,
          ...name ? { name } : {}
        });
      }
      /**
       * @internal Content hash of some bytes, matching what the server computes.
       * Exposed for callers that want to check whether they already added a file.
       */
      static contentHash(content) {
        return createHash2("sha256").update(Buffer.from(content)).digest("hex");
      }
    };
  }
});

// src/datasources/index.ts
function createDataSources(call) {
  return {
    defineDataSource(name) {
      return new DataSource(name, call);
    }
  };
}
var init_datasources = __esm({
  "src/datasources/index.ts"() {
    "use strict";
    init_source();
  }
});

// src/voice/index.ts
function createVoice(call) {
  return {
    async call(params) {
      return await call("call", {
        to: params.to,
        assumeIdentity: params.assumeIdentity === true
      });
    }
  };
}
var init_voice = __esm({
  "src/voice/index.ts"() {
    "use strict";
  }
});

// src/task/schema.ts
function describe(value) {
  if (value === void 0) return "undefined";
  const json = JSON.stringify(value);
  if (json === void 0) return String(value);
  return json.length > 60 ? `${json.slice(0, 57)}...` : json;
}
function matchesTypeName(value, name) {
  switch (name) {
    case "null":
      return value === null;
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
function validateAgainstSchema(value, schema) {
  const errors = [];
  walk(value, schema, "$", errors);
  return errors;
}
function walk(value, schema, path, errors) {
  if (schema.const !== void 0) {
    if (value !== schema.const) {
      errors.push({
        path,
        message: `expected the constant ${describe(schema.const)}, got ${describe(value)}`
      });
    }
    return;
  }
  if (schema.enum !== void 0) {
    if (!schema.enum.includes(value)) {
      errors.push({
        path,
        message: `expected one of ${schema.enum.map(describe).join(" | ")}, got ${describe(value)}`
      });
    }
    return;
  }
  if (schema.type !== void 0) {
    const names = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!names.some((name) => matchesTypeName(value, name))) {
      errors.push({
        path,
        message: `expected type ${names.join(" | ")}, got ${describe(value)}`
      });
      return;
    }
  }
  if (matchesTypeName(value, "object")) {
    const record = value;
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in record) || record[key] === void 0) {
          errors.push({
            path,
            message: `missing required property "${key}"`
          });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in record && record[key] !== void 0) {
          walk(record[key], propSchema, `${path}.${key}`, errors);
        }
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in schema.properties)) {
            errors.push({
              path,
              message: `unexpected property "${key}" (additionalProperties is false)`
            });
          }
        }
      }
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      walk(item, schema.items, `${path}[${index}]`, errors);
    });
  }
}
function formatValidationErrors(errors) {
  return errors.map((e) => `- at ${e.path}: ${e.message}`).join("\n");
}
function assertSupportedSchema(schema) {
  assertSupportedNode(schema, "$");
}
function assertSupportedNode(schema, path) {
  for (const key of Object.keys(schema)) {
    if (SUPPORTED_KEYWORDS.has(key)) continue;
    const hint = key === "nullable" ? ' Use a type array instead: type: ["string", "null"].' : key === "oneOf" || key === "anyOf" || key === "allOf" ? " Model alternatives with an enum, a type array, or a discriminating property instead." : "";
    throw new MindStudioError(
      `[task] Unsupported JSON Schema keyword "${key}" at ${path} in outputSchema. Supported: type, properties, required, additionalProperties, items, enum, const.${hint}`,
      "task_output_schema_unsupported",
      400
    );
  }
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      assertSupportedNode(propSchema, `${path}.${key}`);
    }
  }
  if (schema.items) {
    assertSupportedNode(schema.items, `${path}[]`);
  }
}
function buildExampleFromSchema(schema) {
  if (schema.const !== void 0) return schema.const;
  if (schema.enum !== void 0 && schema.enum.length > 0)
    return schema.enum[0];
  const names = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const name = names.find((n) => n !== "null") ?? names[0];
  switch (name) {
    case "object": {
      const example = {};
      for (const [key, propSchema] of Object.entries(
        schema.properties ?? {}
      )) {
        example[key] = buildExampleFromSchema(propSchema);
      }
      return example;
    }
    case "array":
      return schema.items ? [buildExampleFromSchema(schema.items)] : [];
    case "string":
      return "...";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      return null;
  }
}
function stripCodeFences(text) {
  const match = /^```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/.exec(
    text.trim()
  );
  return match ? match[1] : text;
}
var SUPPORTED_KEYWORDS;
var init_schema = __esm({
  "src/task/schema.ts"() {
    "use strict";
    init_errors();
    SUPPORTED_KEYWORDS = /* @__PURE__ */ new Set([
      "type",
      "properties",
      "required",
      "additionalProperties",
      "items",
      "enum",
      "const",
      // Harmless annotations — ignored by the validator, allowed to pass through.
      "description",
      "title",
      "examples",
      "default"
    ]);
  }
});

// src/task/index.ts
function resolveStepType(name) {
  const meta = stepMetadata[name];
  return meta ? meta.stepType : name;
}
function mapTools(tools) {
  return tools.map((t) => {
    if (typeof t === "object" && "appMethod" in t) {
      return {
        appMethod: t.appMethod,
        ...t.description ? { description: t.description } : {},
        ...t.defaults ? { defaults: t.defaults } : {}
      };
    }
    const method = typeof t === "string" ? t : t.method;
    const stepType = resolveStepType(method);
    const defaults = typeof t === "object" ? t.defaults : void 0;
    return defaults ? { stepType, defaults } : { stepType };
  });
}
function buildTaskRequestBody(options) {
  return {
    prompt: options.prompt,
    input: options.input,
    tools: mapTools(options.tools),
    // The legacy whole-task route requires structuredOutputExample and
    // composes its own prompt server-side, so in schema mode we synthesize a
    // skeleton example from the schema. Validation still happens client-side
    // after the result comes back (see _runTaskInner).
    structuredOutputExample: options.outputSchema ? JSON.stringify(buildExampleFromSchema(options.outputSchema)) : typeof options.structuredOutputExample === "string" ? options.structuredOutputExample : JSON.stringify(options.structuredOutputExample),
    model: options.model,
    ...options.maxTurns != null && { maxTurns: options.maxTurns },
    ...options.appId != null && { appId: options.appId },
    ...options.threadId != null && { threadId: options.threadId }
  };
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isDevMode() {
  return !!(process.env.CALLBACK_TOKEN || getRequestContext()?.callbackToken);
}
function logTaskResult(result) {
  if (!isDevMode()) return;
  const toolSummary = result.toolCalls.map((tc) => `${tc.name} (${tc.durationMs}ms) ${tc.success ? "\u2713" : "\u2717"}`).join(", ");
  console.log(
    `[task] ${result.turns} turn${result.turns === 1 ? "" : "s"}` + (toolSummary ? `: ${toolSummary}` : "") + ` | ${result.parsedSuccessfully ? "output OK" : "\u26A0 output not valid JSON"} | cost: ${result.usage.totalBillingCost}`
  );
}
async function runTaskPoll(httpConfig, body) {
  const { data } = await request(
    httpConfig,
    "POST",
    "/task",
    body
  );
  const pollUrl = `${httpConfig.baseUrl}/developer/v2/task/poll/${data.taskToken}`;
  let pollDelay = 300;
  while (true) {
    await sleep2(pollDelay);
    pollDelay = Math.min(pollDelay * 1.5, 3e3);
    const res = await fetch(pollUrl, {
      headers: { "User-Agent": "@mindstudio-ai/agent" }
    });
    if (res.status === 502 || res.status === 503 || res.status === 504)
      continue;
    if (res.status === 404) {
      throw new MindStudioError(
        "Task poll token not found or expired.",
        "poll_token_expired",
        404
      );
    }
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new MindStudioError(
        errorBody.message ?? errorBody.error ?? `Task poll failed: ${res.status} ${res.statusText}`,
        errorBody.code ?? "poll_error",
        res.status,
        errorBody
      );
    }
    const poll = await res.json();
    if (poll.status === "pending") {
      if (isDevMode() && poll.currentTurn != null) {
        console.log(
          `[task] running... turn ${poll.currentTurn}/${poll.maxTurns ?? "?"}`
        );
      }
      continue;
    }
    if (poll.status === "error") {
      throw new MindStudioError(
        poll.error ?? "Task execution failed.",
        "task_execution_error",
        500
      );
    }
    const result = {
      output: poll.output,
      outputRaw: poll.outputRaw ?? "",
      parsedSuccessfully: poll.parsedSuccessfully ?? true,
      turns: poll.turns ?? 0,
      usage: poll.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalBillingCost: 0
      },
      toolCalls: poll.toolCalls ?? []
    };
    logTaskResult(result);
    return result;
  }
}
async function runTaskStream(httpConfig, body, onEvent) {
  const url = `${httpConfig.baseUrl}/developer/v2/task`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${httpConfig.token}`,
      "Content-Type": "application/json",
      "User-Agent": "@mindstudio-ai/agent",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let code = "api_error";
    let details;
    try {
      const text = await res.text();
      try {
        const errBody = JSON.parse(text);
        details = errBody;
        const errMsg = (typeof errBody.error === "string" ? errBody.error : void 0) ?? (typeof errBody.message === "string" ? errBody.message : void 0);
        if (errMsg) message = errMsg;
        if (errBody.code) code = errBody.code;
      } catch {
        const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (stripped) message = stripped.slice(0, 200);
      }
    } catch {
    }
    throw new MindStudioError(`[task] ${message}`, code, res.status, details);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        onEvent(event);
        if (event.type === "error") {
          throw new MindStudioError(
            event.error ?? "Task execution failed.",
            "task_execution_error",
            500
          );
        }
        if (event.type === "done") {
          result = {
            output: event.output,
            outputRaw: event.outputRaw ?? "",
            parsedSuccessfully: event.parsedSuccessfully ?? true,
            turns: event.turns ?? 0,
            usage: event.usage ?? {
              inputTokens: 0,
              outputTokens: 0,
              totalBillingCost: 0
            },
            toolCalls: event.toolCalls ?? []
          };
        }
      } catch (err) {
        if (err instanceof MindStudioError) throw err;
      }
    }
  }
  if (buffer.startsWith("data: ")) {
    try {
      const event = JSON.parse(buffer.slice(6));
      onEvent(event);
      if (event.type === "error") {
        throw new MindStudioError(
          event.error ?? "Task execution failed.",
          "task_execution_error",
          500
        );
      }
      if (event.type === "done") {
        result = {
          output: event.output,
          outputRaw: event.outputRaw ?? "",
          parsedSuccessfully: event.parsedSuccessfully ?? true,
          turns: event.turns ?? 0,
          usage: event.usage ?? {
            inputTokens: 0,
            outputTokens: 0,
            totalBillingCost: 0
          },
          toolCalls: event.toolCalls ?? []
        };
      }
    } catch (err) {
      if (err instanceof MindStudioError) throw err;
    }
  }
  if (!result) {
    throw new MindStudioError(
      "[task] Stream ended without a done event. The task execution may have been interrupted.",
      "stream_error",
      500
    );
  }
  logTaskResult(result);
  return result;
}
var init_task = __esm({
  async "src/task/index.ts"() {
    "use strict";
    init_http();
    init_errors();
    await init_context();
    init_metadata();
    init_schema();
  }
});

// src/task/local.ts
function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function mergeToolInput(modelInput, defaults) {
  const merged = { ...modelInput };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }
    const modelValue = merged[key];
    merged[key] = isPlainObject(defaultValue) && isPlainObject(modelValue) ? mergeToolInput(modelValue, defaultValue) : defaultValue;
  }
  return merged;
}
function truncateToolOutput(output) {
  const serialized = JSON.stringify(output);
  return serialized && serialized.length > MAX_TOOL_OUTPUT_CHARS ? serialized.slice(0, MAX_TOOL_OUTPUT_CHARS) + "... [truncated]" : output;
}
async function attemptTurn(httpConfig, body) {
  const url = `${httpConfig.baseUrl}/developer/v2/task/turn`;
  await httpConfig.rateLimiter.acquire();
  try {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${httpConfig.token}`,
          "Content-Type": "application/json",
          "User-Agent": "@mindstudio-ai/agent",
          Accept: "text/event-stream"
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new TurnError(
        `Network error: ${err instanceof Error ? err.message : "fetch failed"}`,
        true,
        "request"
      );
    }
    httpConfig.rateLimiter.updateFromHeaders(res.headers);
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      let code;
      try {
        const errBody = await res.json();
        const errMsg = (typeof errBody.errorMessage === "string" ? errBody.errorMessage : void 0) ?? (typeof errBody.errorString === "string" ? errBody.errorString : void 0) ?? (typeof errBody.error === "string" ? errBody.error : void 0);
        if (errMsg) message = errMsg;
        if (typeof errBody.errorString === "string") code = errBody.errorString;
      } catch {
      }
      const retryable = res.status >= 500 || res.status === 429;
      throw new TurnError(message, retryable, "request", res.status, code);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const events = [];
    let text = "";
    const toolCalls = [];
    let turn = null;
    const handleLine = (line) => {
      if (!line.startsWith("data: ")) {
        return;
      }
      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        return;
      }
      if (event.type === "error") {
        const status = typeof event.status === "number" ? event.status : 500;
        const message = typeof event.error === "string" ? event.error : "Model call failed";
        const retryable = status >= 500 || /overloaded|terminated|network/i.test(message);
        throw new TurnError(message, retryable, "model", status);
      }
      if (event.type === "turn") {
        turn = {
          events,
          text,
          toolCalls,
          stopReason: typeof event.stopReason === "string" ? event.stopReason : "end_turn",
          usage: event.usage ?? {},
          billingCost: typeof event.billingCost === "number" ? event.billingCost : 0
        };
        return;
      }
      if (event.type === "text" && typeof event.text === "string") {
        text += event.text;
      } else if (event.type === "tool_use") {
        toolCalls.push({
          id: event.id,
          name: event.name,
          input: event.input ?? {}
        });
      }
      events.push(event);
    };
    while (true) {
      let stallTimer;
      let readResult;
      try {
        readResult = await Promise.race([
          reader.read(),
          new Promise((_, reject) => {
            stallTimer = setTimeout(
              () => reject(new Error("stream_stall")),
              STALL_TIMEOUT_MS
            );
          })
        ]);
        clearTimeout(stallTimer);
      } catch (err) {
        clearTimeout(stallTimer);
        try {
          await reader.cancel();
        } catch {
        }
        if (err instanceof TurnError) {
          throw err;
        }
        const isStall = err instanceof Error && err.message === "stream_stall";
        throw new TurnError(
          isStall ? "Turn stalled \u2014 no data received for 5 minutes" : `Network error: stream interrupted \u2014 ${err instanceof Error ? err.message : "unknown"}`,
          true,
          "request"
        );
      }
      if (readResult.done) {
        break;
      }
      buffer += decoder.decode(readResult.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        handleLine(line);
      }
    }
    if (buffer) {
      handleLine(buffer);
    }
    if (!turn) {
      throw new TurnError(
        "Network error: stream ended before turn completion",
        true,
        "request"
      );
    }
    return turn;
  } finally {
    httpConfig.rateLimiter.release();
  }
}
async function runTurnWithRetry(httpConfig, body) {
  for (let attempt = 0; attempt < MAX_TURN_ATTEMPTS; attempt++) {
    try {
      return await attemptTurn(httpConfig, body);
    } catch (err) {
      if (!(err instanceof TurnError) || !err.retryable || attempt >= MAX_TURN_ATTEMPTS - 1) {
        throw err;
      }
      if (isDevMode()) {
        console.log(
          `[task] connection lost, retrying turn (attempt ${attempt + 2} of ${MAX_TURN_ATTEMPTS})`
        );
      }
      await sleep2(INITIAL_BACKOFF_MS * 2 ** attempt);
    }
  }
  throw new TurnError("Turn retries exhausted", false, "request");
}
async function runTaskLocal(deps, options) {
  const { httpConfig } = deps;
  const onEvent = options.onEvent;
  const outputSchema = options.outputSchema;
  if (outputSchema) assertSupportedSchema(outputSchema);
  let system;
  if (outputSchema) {
    system = `${options.prompt}

When you have completed the task, respond with your final output as a single JSON object that conforms to this JSON Schema. Respond with the JSON object itself \u2014 NOT the schema, no prose, no code fences:
${JSON.stringify(outputSchema)}
<!-- cache_breakpoint -->`;
  } else {
    const structuredOutputExample = typeof options.structuredOutputExample === "string" ? options.structuredOutputExample : JSON.stringify(options.structuredOutputExample);
    system = `${options.prompt}

When you have completed the task, respond with your final output as JSON matching this example:
${structuredOutputExample}
<!-- cache_breakpoint -->`;
  }
  const wireTools = mapTools(options.tools);
  const toolKinds = /* @__PURE__ */ new Map();
  const toolDefaults = /* @__PURE__ */ new Map();
  for (const t of wireTools) {
    if ("appMethod" in t) {
      toolKinds.set(t.appMethod, "method");
      if (t.defaults) toolDefaults.set(t.appMethod, t.defaults);
    } else {
      toolKinds.set(t.stepType, "step");
      if (t.defaults) toolDefaults.set(t.stepType, t.defaults);
    }
  }
  const maxTurns = Math.min(
    Math.max(options.maxTurns || DEFAULT_MAX_TURNS, 1),
    MAX_TURNS_LIMIT
  );
  const messages = [
    { role: "user", content: JSON.stringify(options.input) }
  ];
  let loopCount = 0;
  let schemaRepairCount = 0;
  const toolCallLog = [];
  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalBillingCost: 0
  };
  const buildResult = (output2, outputRaw, parsedSuccessfully2, turns) => ({
    output: output2,
    outputRaw,
    parsedSuccessfully: parsedSuccessfully2,
    turns,
    usage: totalUsage,
    toolCalls: toolCallLog
  });
  const accumulate = (turn) => {
    totalUsage.inputTokens += turn.usage.inputTokens ?? 0;
    totalUsage.outputTokens += turn.usage.outputTokens ?? 0;
    totalUsage.cacheCreationTokens += turn.usage.cacheCreationTokens ?? 0;
    totalUsage.cacheReadTokens += turn.usage.cacheReadTokens ?? 0;
    totalUsage.totalBillingCost += turn.billingCost;
    for (const event of turn.events) {
      onEvent?.(event);
    }
  };
  const finish = (result) => {
    onEvent?.({ type: "done", ...result });
    logTaskResult(result);
    return result;
  };
  const schemaMismatch = (outputRaw, errors) => {
    onEvent?.({
      type: "error",
      error: "Output did not conform to outputSchema.",
      errors
    });
    return new MindStudioError(
      "[task] Output did not conform to outputSchema after all repair attempts.",
      "task_output_schema_mismatch",
      422,
      {
        outputRaw,
        errors,
        turns: loopCount,
        usage: totalUsage,
        toolCalls: toolCallLog
      }
    );
  };
  const turnFailure = (err) => {
    if (err instanceof TurnError && err.phase === "model") {
      if (isDevMode()) {
        console.error(`[task] Model call failed: ${err.message}`);
      }
      if (outputSchema) {
        throw new MindStudioError(
          `[task] ${err.message}`,
          "task_execution_error",
          500,
          { turns: loopCount, usage: totalUsage, toolCalls: toolCallLog }
        );
      }
      return finish(buildResult(null, "", false, loopCount));
    }
    if (err instanceof TurnError) {
      throw new MindStudioError(
        `[task] ${err.message}`,
        err.errorCode ?? "task_turn_error",
        err.status ?? 500
      );
    }
    throw err;
  };
  while (loopCount < maxTurns) {
    loopCount++;
    let turn;
    try {
      turn = await runTurnWithRetry(httpConfig, {
        model: options.model,
        system,
        messages,
        tools: wireTools
      });
    } catch (err) {
      if (loopCount === 1 && err instanceof TurnError && err.status === 404 && err.errorCode === "not_found") {
        throw new MindStudioError(
          "Task turn endpoint unavailable.",
          TURN_UNAVAILABLE_CODE,
          404
        );
      }
      return turnFailure(err);
    }
    accumulate(turn);
    if (turn.stopReason === "tool_use" && turn.toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: turn.text,
        toolCalls: turn.toolCalls
      });
      const results = await Promise.all(
        turn.toolCalls.map(async (toolCall) => {
          onEvent?.({
            type: "tool_call_start",
            id: toolCall.id,
            name: toolCall.name
          });
          const startTime = Date.now();
          const defaults = toolDefaults.get(toolCall.name) || {};
          const mergedInput = mergeToolInput(toolCall.input, defaults);
          const execute = toolKinds.get(toolCall.name) === "method" ? deps.executeMethodTool : deps.executeStepTool;
          const result = await execute(toolCall.name, mergedInput);
          toolCallLog.push({
            name: toolCall.name,
            success: !result.isError,
            durationMs: Date.now() - startTime
          });
          return { toolCall, ...result };
        })
      );
      for (const { toolCall, output: output3, billingCost, isError } of results) {
        if (billingCost) {
          totalUsage.totalBillingCost += billingCost;
        }
        const truncated = truncateToolOutput(output3);
        messages.push({
          role: "user",
          content: JSON.stringify(truncated),
          toolCallId: toolCall.id,
          ...isError && { isToolError: true }
        });
        onEvent?.({
          type: "tool_call_result",
          id: toolCall.id,
          output: truncated
        });
      }
      if (isDevMode()) {
        console.log(`[task] running... turn ${loopCount}/${maxTurns}`);
      }
      continue;
    }
    messages.push({ role: "assistant", content: turn.text });
    let output2;
    let parseOk = true;
    try {
      output2 = JSON.parse(outputSchema ? stripCodeFences(turn.text) : turn.text);
    } catch {
      parseOk = false;
    }
    if (parseOk) {
      if (!outputSchema) {
        return finish(buildResult(output2, turn.text, true, loopCount));
      }
      const errors = validateAgainstSchema(output2, outputSchema);
      if (errors.length === 0) {
        return finish(buildResult(output2, turn.text, true, loopCount));
      }
      if (loopCount < maxTurns && schemaRepairCount < MAX_SCHEMA_REPAIR_ATTEMPTS) {
        schemaRepairCount++;
        messages.push({
          role: "user",
          content: `Your JSON output did not conform to the required schema. Fix these problems and respond again with ONLY the corrected JSON:
${formatValidationErrors(errors)}`
        });
        continue;
      }
      throw schemaMismatch(turn.text, errors);
    }
    if (loopCount < maxTurns) {
      messages.push({
        role: "user",
        content: "Your response was not valid JSON. Please respond with ONLY the JSON output, no other text."
      });
      continue;
    }
    if (outputSchema) {
      throw schemaMismatch(turn.text, [
        { path: "$", message: "output was not valid JSON" }
      ]);
    }
    return finish(buildResult(turn.text, turn.text, false, loopCount));
  }
  messages.push({
    role: "user",
    content: "You have reached the maximum number of turns. Please provide your final output now as JSON."
  });
  let finalText = "";
  try {
    const turn = await runTurnWithRetry(httpConfig, {
      model: options.model,
      system,
      messages,
      tools: []
    });
    accumulate(turn);
    finalText = turn.text;
  } catch (err) {
    if (err instanceof TurnError && err.phase === "model") {
      if (isDevMode()) {
        console.error(`[task] Final model call failed: ${err.message}`);
      }
    } else {
      return turnFailure(err);
    }
  }
  let parsedSuccessfully = true;
  let output;
  try {
    output = JSON.parse(outputSchema ? stripCodeFences(finalText) : finalText);
  } catch {
    output = finalText;
    parsedSuccessfully = false;
  }
  if (outputSchema) {
    if (!parsedSuccessfully) {
      throw schemaMismatch(finalText, [
        { path: "$", message: "output was not valid JSON" }
      ]);
    }
    const errors = validateAgainstSchema(output, outputSchema);
    if (errors.length > 0) {
      throw schemaMismatch(finalText, errors);
    }
  }
  return finish(
    buildResult(output, finalText, parsedSuccessfully, loopCount + 1)
  );
}
var DEFAULT_MAX_TURNS, MAX_TURNS_LIMIT, MAX_SCHEMA_REPAIR_ATTEMPTS, MAX_TOOL_OUTPUT_CHARS, MAX_TURN_ATTEMPTS, INITIAL_BACKOFF_MS, STALL_TIMEOUT_MS, TURN_UNAVAILABLE_CODE, UNSAFE_KEYS, TurnError;
var init_local = __esm({
  async "src/task/local.ts"() {
    "use strict";
    init_errors();
    await init_task();
    init_schema();
    DEFAULT_MAX_TURNS = 20;
    MAX_TURNS_LIMIT = 100;
    MAX_SCHEMA_REPAIR_ATTEMPTS = 3;
    MAX_TOOL_OUTPUT_CHARS = 5e4;
    MAX_TURN_ATTEMPTS = 5;
    INITIAL_BACKOFF_MS = 1e3;
    STALL_TIMEOUT_MS = 3e5;
    TURN_UNAVAILABLE_CODE = "task_turn_unavailable";
    UNSAFE_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
    TurnError = class extends Error {
      constructor(message, retryable, phase, status, errorCode) {
        super(message);
        this.retryable = retryable;
        this.phase = phase;
        this.status = status;
        this.errorCode = errorCode;
      }
    };
  }
});

// src/generated/steps.ts
var steps_exports = {};
__export(steps_exports, {
  applyStepMethods: () => applyStepMethods
});
function applyStepMethods(AgentClass) {
  const proto = AgentClass.prototype;
  proto.activeCampaignAddNote = function(step, options) {
    return this.executeStep("activeCampaignAddNote", step, options);
  };
  proto.activeCampaignCreateContact = function(step, options) {
    return this.executeStep("activeCampaignCreateContact", step, options);
  };
  proto.addSubtitlesToVideo = function(step, options) {
    return this.executeStep("addSubtitlesToVideo", step, options);
  };
  proto.airtableCreateUpdateRecord = function(step, options) {
    return this.executeStep("airtableCreateUpdateRecord", step, options);
  };
  proto.airtableDeleteRecord = function(step, options) {
    return this.executeStep("airtableDeleteRecord", step, options);
  };
  proto.airtableGetRecord = function(step, options) {
    return this.executeStep("airtableGetRecord", step, options);
  };
  proto.airtableGetTableRecords = function(step, options) {
    return this.executeStep("airtableGetTableRecords", step, options);
  };
  proto.analyzeImage = function(step, options) {
    return this.executeStep("analyzeImage", step, options);
  };
  proto.analyzeVideo = function(step, options) {
    return this.executeStep("analyzeVideo", step, options);
  };
  proto.captureThumbnail = function(step, options) {
    return this.executeStep("captureThumbnail", step, options);
  };
  proto.checkAppRole = function(step, options) {
    return this.executeStep("checkAppRole", step, options);
  };
  proto.codaCreateUpdatePage = function(step, options) {
    return this.executeStep("codaCreateUpdatePage", step, options);
  };
  proto.codaCreateUpdateRow = function(step, options) {
    return this.executeStep("codaCreateUpdateRow", step, options);
  };
  proto.codaFindRow = function(step, options) {
    return this.executeStep("codaFindRow", step, options);
  };
  proto.codaGetPage = function(step, options) {
    return this.executeStep("codaGetPage", step, options);
  };
  proto.codaGetTableRows = function(step, options) {
    return this.executeStep("codaGetTableRows", step, options);
  };
  proto.convertPdfToImages = function(step, options) {
    return this.executeStep("convertPdfToImages", step, options);
  };
  proto.createDataSource = function(step, options) {
    return this.executeStep("createDataSource", step, options);
  };
  proto.createGmailDraft = function(step, options) {
    return this.executeStep("createGmailDraft", step, options);
  };
  proto.createGoogleCalendarEvent = function(step, options) {
    return this.executeStep("createGoogleCalendarEvent", step, options);
  };
  proto.createGoogleDoc = function(step, options) {
    return this.executeStep("createGoogleDoc", step, options);
  };
  proto.createGoogleSheet = function(step, options) {
    return this.executeStep("createGoogleSheet", step, options);
  };
  proto.deleteDataSource = function(step, options) {
    return this.executeStep("deleteDataSource", step, options);
  };
  proto.deleteDataSourceDocument = function(step, options) {
    return this.executeStep("deleteDataSourceDocument", step, options);
  };
  proto.deleteGmailEmail = function(step, options) {
    return this.executeStep("deleteGmailEmail", step, options);
  };
  proto.deleteGoogleCalendarEvent = function(step, options) {
    return this.executeStep("deleteGoogleCalendarEvent", step, options);
  };
  proto.deleteGoogleSheetRows = function(step, options) {
    return this.executeStep("deleteGoogleSheetRows", step, options);
  };
  proto.detectChanges = function(step, options) {
    return this.executeStep("detectChanges", step, options);
  };
  proto.detectPII = function(step, options) {
    return this.executeStep("detectPII", step, options);
  };
  proto.discordEditMessage = function(step, options) {
    return this.executeStep("discordEditMessage", step, options);
  };
  proto.discordSendFollowUp = function(step, options) {
    return this.executeStep("discordSendFollowUp", step, options);
  };
  proto.discordSendMessage = function(step, options) {
    return this.executeStep("discordSendMessage", step, options);
  };
  proto.downloadVideo = function(step, options) {
    return this.executeStep("downloadVideo", step, options);
  };
  proto.enhanceImageGenerationPrompt = function(step, options) {
    return this.executeStep("enhanceImageGenerationPrompt", step, options);
  };
  proto.enhanceVideoGenerationPrompt = function(step, options) {
    return this.executeStep("enhanceVideoGenerationPrompt", step, options);
  };
  proto.enrichPerson = function(step, options) {
    return this.executeStep("enrichPerson", step, options);
  };
  proto.extractAudioFromVideo = function(step, options) {
    return this.executeStep("extractAudioFromVideo", step, options);
  };
  proto.extractText = function(step, options) {
    return this.executeStep("extractText", step, options);
  };
  proto.fetchDataSourceDocument = function(step, options) {
    return this.executeStep("fetchDataSourceDocument", step, options);
  };
  proto.fetchGoogleDoc = function(step, options) {
    return this.executeStep("fetchGoogleDoc", step, options);
  };
  proto.fetchGoogleSheet = function(step, options) {
    return this.executeStep("fetchGoogleSheet", step, options);
  };
  proto.fetchSlackChannelHistory = function(step, options) {
    return this.executeStep("fetchSlackChannelHistory", step, options);
  };
  proto.fetchYoutubeCaptions = function(step, options) {
    return this.executeStep("fetchYoutubeCaptions", step, options);
  };
  proto.fetchYoutubeChannel = function(step, options) {
    return this.executeStep("fetchYoutubeChannel", step, options);
  };
  proto.fetchYoutubeComments = function(step, options) {
    return this.executeStep("fetchYoutubeComments", step, options);
  };
  proto.fetchYoutubeVideo = function(step, options) {
    return this.executeStep("fetchYoutubeVideo", step, options);
  };
  proto.generate3dModel = function(step, options) {
    return this.executeStep("generate3dModel", step, options);
  };
  proto.generateChart = function(step, options) {
    return this.executeStep("generateChart", step, options);
  };
  proto.generateImage = function(step, options) {
    return this.executeStep("generateImage", step, options);
  };
  proto.generateLipsync = function(step, options) {
    return this.executeStep("generateLipsync", step, options);
  };
  proto.generateMusic = function(step, options) {
    return this.executeStep("generateMusic", step, options);
  };
  proto.generateAsset = function(step, options) {
    return this.executeStep("generatePdf", step, options);
  };
  proto.generateStaticVideoFromImage = function(step, options) {
    return this.executeStep("generateStaticVideoFromImage", step, options);
  };
  proto.generateVideo = function(step, options) {
    return this.executeStep("generateVideo", step, options);
  };
  proto.getGmailAttachments = function(step, options) {
    return this.executeStep("getGmailAttachments", step, options);
  };
  proto.getGmailDraft = function(step, options) {
    return this.executeStep("getGmailDraft", step, options);
  };
  proto.getGmailEmail = function(step, options) {
    return this.executeStep("getGmailEmail", step, options);
  };
  proto.getGmailUnreadCount = function(step, options) {
    return this.executeStep("getGmailUnreadCount", step, options);
  };
  proto.getGoogleCalendarEvent = function(step, options) {
    return this.executeStep("getGoogleCalendarEvent", step, options);
  };
  proto.getGoogleDriveFile = function(step, options) {
    return this.executeStep("getGoogleDriveFile", step, options);
  };
  proto.getGoogleSheetInfo = function(step, options) {
    return this.executeStep("getGoogleSheetInfo", step, options);
  };
  proto.getMediaMetadata = function(step, options) {
    return this.executeStep("getMediaMetadata", step, options);
  };
  proto.hubspotCreateCompany = function(step, options) {
    return this.executeStep("hubspotCreateCompany", step, options);
  };
  proto.hubspotCreateContact = function(step, options) {
    return this.executeStep("hubspotCreateContact", step, options);
  };
  proto.hubspotGetCompany = function(step, options) {
    return this.executeStep("hubspotGetCompany", step, options);
  };
  proto.hubspotGetContact = function(step, options) {
    return this.executeStep("hubspotGetContact", step, options);
  };
  proto.hunterApiCompanyEnrichment = function(step, options) {
    return this.executeStep("hunterApiCompanyEnrichment", step, options);
  };
  proto.hunterApiDomainSearch = function(step, options) {
    return this.executeStep("hunterApiDomainSearch", step, options);
  };
  proto.hunterApiEmailFinder = function(step, options) {
    return this.executeStep("hunterApiEmailFinder", step, options);
  };
  proto.hunterApiEmailVerification = function(step, options) {
    return this.executeStep("hunterApiEmailVerification", step, options);
  };
  proto.hunterApiPersonEnrichment = function(step, options) {
    return this.executeStep("hunterApiPersonEnrichment", step, options);
  };
  proto.imageFaceSwap = function(step, options) {
    return this.executeStep("imageFaceSwap", step, options);
  };
  proto.imageRemoveWatermark = function(step, options) {
    return this.executeStep("imageRemoveWatermark", step, options);
  };
  proto.insertVideoClips = function(step, options) {
    return this.executeStep("insertVideoClips", step, options);
  };
  proto.listDataSources = function(step, options) {
    return this.executeStep("listDataSources", step, options);
  };
  proto.listGmailDrafts = function(step, options) {
    return this.executeStep("listGmailDrafts", step, options);
  };
  proto.listGmailLabels = function(step, options) {
    return this.executeStep("listGmailLabels", step, options);
  };
  proto.listGoogleCalendarEvents = function(step, options) {
    return this.executeStep("listGoogleCalendarEvents", step, options);
  };
  proto.listGoogleDriveFiles = function(step, options) {
    return this.executeStep("listGoogleDriveFiles", step, options);
  };
  proto.listRecentGmailEmails = function(step, options) {
    return this.executeStep("listRecentGmailEmails", step, options);
  };
  proto.logic = function(step, options) {
    return this.executeStep("logic", step, options);
  };
  proto.makeDotComRunScenario = function(step, options) {
    return this.executeStep("makeDotComRunScenario", step, options);
  };
  proto.mergeAudio = function(step, options) {
    return this.executeStep("mergeAudio", step, options);
  };
  proto.mergeVideos = function(step, options) {
    return this.executeStep("mergeVideos", step, options);
  };
  proto.meshyAnimate = function(step, options) {
    return this.executeStep("meshyAnimate", step, options);
  };
  proto.meshyImageTo3d = function(step, options) {
    return this.executeStep("meshyImageTo3d", step, options);
  };
  proto.meshyRemesh = function(step, options) {
    return this.executeStep("meshyRemesh", step, options);
  };
  proto.meshyRig = function(step, options) {
    return this.executeStep("meshyRig", step, options);
  };
  proto.meshyTextTo3d = function(step, options) {
    return this.executeStep("meshyTextTo3d", step, options);
  };
  proto.meshyTexture = function(step, options) {
    return this.executeStep("meshyTexture", step, options);
  };
  proto.mixAudioIntoVideo = function(step, options) {
    return this.executeStep("mixAudioIntoVideo", step, options);
  };
  proto.muteVideo = function(step, options) {
    return this.executeStep("muteVideo", step, options);
  };
  proto.n8nRunNode = function(step, options) {
    return this.executeStep("n8nRunNode", step, options);
  };
  proto.notionCreatePage = function(step, options) {
    return this.executeStep("notionCreatePage", step, options);
  };
  proto.notionUpdatePage = function(step, options) {
    return this.executeStep("notionUpdatePage", step, options);
  };
  proto.particlePodcastsFindMentions = function(step, options) {
    return this.executeStep("particlePodcastsFindMentions", step, options);
  };
  proto.particlePodcastsGetEpisode = function(step, options) {
    return this.executeStep("particlePodcastsGetEpisode", step, options);
  };
  proto.particlePodcastsGetEpisodeTranscript = function(step, options) {
    return this.executeStep("particlePodcastsGetEpisodeTranscript", step, options);
  };
  proto.particlePodcastsSearchCompanies = function(step, options) {
    return this.executeStep("particlePodcastsSearchCompanies", step, options);
  };
  proto.particlePodcastsSearchDialogue = function(step, options) {
    return this.executeStep("particlePodcastsSearchDialogue", step, options);
  };
  proto.particlePodcastsSearchPodcasts = function(step, options) {
    return this.executeStep("particlePodcastsSearchPodcasts", step, options);
  };
  proto.peopleSearch = function(step, options) {
    return this.executeStep("peopleSearch", step, options);
  };
  proto.postToLinkedIn = function(step, options) {
    return this.executeStep("postToLinkedIn", step, options);
  };
  proto.postToSlackChannel = function(step, options) {
    return this.executeStep("postToSlackChannel", step, options);
  };
  proto.postToX = function(step, options) {
    return this.executeStep("postToX", step, options);
  };
  proto.postToZapier = function(step, options) {
    return this.executeStep("postToZapier", step, options);
  };
  proto.queryAppDatabase = function(step, options) {
    return this.executeStep("queryAppDatabase", step, options);
  };
  proto.queryDataSource = function(step, options) {
    return this.executeStep("queryDataSource", step, options);
  };
  proto.queryExternalDatabase = function(step, options) {
    return this.executeStep("queryExternalDatabase", step, options);
  };
  proto.redactPII = function(step, options) {
    return this.executeStep("redactPII", step, options);
  };
  proto.removeBackgroundFromImage = function(step, options) {
    return this.executeStep("removeBackgroundFromImage", step, options);
  };
  proto.replyToGmailEmail = function(step, options) {
    return this.executeStep("replyToGmailEmail", step, options);
  };
  proto.resizeVideo = function(step, options) {
    return this.executeStep("resizeVideo", step, options);
  };
  proto.runFromConnectorRegistry = function(step, options) {
    return this.executeStep("runFromConnectorRegistry", step, options);
  };
  proto.runPackagedWorkflow = function(step, options) {
    return this.executeStep("runPackagedWorkflow", step, options);
  };
  proto.scrapeLinkedInCompany = function(step, options) {
    return this.executeStep("scrapeLinkedInCompany", step, options);
  };
  proto.scrapeLinkedInProfile = function(step, options) {
    return this.executeStep("scrapeLinkedInProfile", step, options);
  };
  proto.scrapeUrl = function(step, options) {
    return this.executeStep("scrapeUrl", step, options);
  };
  proto.scrapeXPost = function(step, options) {
    return this.executeStep("scrapeXPost", step, options);
  };
  proto.scrapeXProfile = function(step, options) {
    return this.executeStep("scrapeXProfile", step, options);
  };
  proto.screenshotUrl = function(step, options) {
    return this.executeStep("screenshotUrl", step, options);
  };
  proto.searchGmailEmails = function(step, options) {
    return this.executeStep("searchGmailEmails", step, options);
  };
  proto.searchGoogle = function(step, options) {
    return this.executeStep("searchGoogle", step, options);
  };
  proto.searchGoogleCalendarEvents = function(step, options) {
    return this.executeStep("searchGoogleCalendarEvents", step, options);
  };
  proto.searchGoogleDrive = function(step, options) {
    return this.executeStep("searchGoogleDrive", step, options);
  };
  proto.searchGoogleImages = function(step, options) {
    return this.executeStep("searchGoogleImages", step, options);
  };
  proto.searchGoogleNews = function(step, options) {
    return this.executeStep("searchGoogleNews", step, options);
  };
  proto.searchGoogleTrends = function(step, options) {
    return this.executeStep("searchGoogleTrends", step, options);
  };
  proto.searchPerplexity = function(step, options) {
    return this.executeStep("searchPerplexity", step, options);
  };
  proto.searchXPosts = function(step, options) {
    return this.executeStep("searchXPosts", step, options);
  };
  proto.searchYoutube = function(step, options) {
    return this.executeStep("searchYoutube", step, options);
  };
  proto.searchYoutubeTrends = function(step, options) {
    return this.executeStep("searchYoutubeTrends", step, options);
  };
  proto.sendEmail = function(step, options) {
    return this.executeStep("sendEmail", step, options);
  };
  proto.sendGmailDraft = function(step, options) {
    return this.executeStep("sendGmailDraft", step, options);
  };
  proto.sendGmailMessage = function(step, options) {
    return this.executeStep("sendGmailMessage", step, options);
  };
  proto.sendSlackDirectMessage = function(step, options) {
    return this.executeStep("sendSlackDirectMessage", step, options);
  };
  proto.sendSMS = function(step, options) {
    return this.executeStep("sendSMS", step, options);
  };
  proto.setGmailReadStatus = function(step, options) {
    return this.executeStep("setGmailReadStatus", step, options);
  };
  proto.setRunTitle = function(step, options) {
    return this.executeStep("setRunTitle", step, options);
  };
  proto.setVariable = function(step, options) {
    return this.executeStep("setVariable", step, options);
  };
  proto.telegramEditMessage = function(step, options) {
    return this.executeStep("telegramEditMessage", step, options);
  };
  proto.telegramReplyToMessage = function(step, options) {
    return this.executeStep("telegramReplyToMessage", step, options);
  };
  proto.telegramSendAudio = function(step, options) {
    return this.executeStep("telegramSendAudio", step, options);
  };
  proto.telegramSendFile = function(step, options) {
    return this.executeStep("telegramSendFile", step, options);
  };
  proto.telegramSendImage = function(step, options) {
    return this.executeStep("telegramSendImage", step, options);
  };
  proto.telegramSendMessage = function(step, options) {
    return this.executeStep("telegramSendMessage", step, options);
  };
  proto.telegramSendVideo = function(step, options) {
    return this.executeStep("telegramSendVideo", step, options);
  };
  proto.telegramSetTyping = function(step, options) {
    return this.executeStep("telegramSetTyping", step, options);
  };
  proto.textToSpeech = function(step, options) {
    return this.executeStep("textToSpeech", step, options);
  };
  proto.transcribeAudio = function(step, options) {
    return this.executeStep("transcribeAudio", step, options);
  };
  proto.trimMedia = function(step, options) {
    return this.executeStep("trimMedia", step, options);
  };
  proto.updateGmailLabels = function(step, options) {
    return this.executeStep("updateGmailLabels", step, options);
  };
  proto.updateGoogleCalendarEvent = function(step, options) {
    return this.executeStep("updateGoogleCalendarEvent", step, options);
  };
  proto.updateGoogleDoc = function(step, options) {
    return this.executeStep("updateGoogleDoc", step, options);
  };
  proto.updateGoogleSheet = function(step, options) {
    return this.executeStep("updateGoogleSheet", step, options);
  };
  proto.uploadDataSourceDocument = function(step, options) {
    return this.executeStep("uploadDataSourceDocument", step, options);
  };
  proto.upscaleImage = function(step, options) {
    return this.executeStep("upscaleImage", step, options);
  };
  proto.upscaleVideo = function(step, options) {
    return this.executeStep("upscaleVideo", step, options);
  };
  proto.generateText = function(step, options) {
    return this.executeStep("userMessage", step, options);
  };
  proto.videoFaceSwap = function(step, options) {
    return this.executeStep("videoFaceSwap", step, options);
  };
  proto.videoRemoveBackground = function(step, options) {
    return this.executeStep("videoRemoveBackground", step, options);
  };
  proto.videoRemoveWatermark = function(step, options) {
    return this.executeStep("videoRemoveWatermark", step, options);
  };
  proto.watermarkImage = function(step, options) {
    return this.executeStep("watermarkImage", step, options);
  };
  proto.watermarkVideo = function(step, options) {
    return this.executeStep("watermarkVideo", step, options);
  };
  proto.youDotComFinanceResearch = function(step, options) {
    return this.executeStep("youDotComFinanceResearch", step, options);
  };
  proto.youDotComGetPageContent = function(step, options) {
    return this.executeStep("youDotComGetPageContent", step, options);
  };
  proto.youDotComLiveNews = function(step, options) {
    return this.executeStep("youDotComLiveNews", step, options);
  };
  proto.youDotComWebResearch = function(step, options) {
    return this.executeStep("youDotComWebResearch", step, options);
  };
  proto.youDotComWebSearch = function(step, options) {
    return this.executeStep("youDotComWebSearch", step, options);
  };
}
var init_steps = __esm({
  "src/generated/steps.ts"() {
    "use strict";
  }
});

// src/client.ts
var client_exports = {};
__export(client_exports, {
  MindStudioAgent: () => MindStudioAgent
});
function sleep3(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function assetStoreBody(store) {
  return store ? { assetStore: { store: store.name, access: store.access } } : {};
}
function resolveStepType2(name) {
  const meta = stepMetadata[name];
  return meta ? meta.stepType : name;
}
function resolveToken(provided, config) {
  const rctx = getRequestContext();
  if (rctx?.callbackToken)
    return { token: rctx.callbackToken, authType: "internal" };
  if (process.env.CALLBACK_TOKEN)
    return { token: process.env.CALLBACK_TOKEN, authType: "internal" };
  if (provided) return { token: provided, authType: "apiKey" };
  if (process.env.MINDSTUDIO_API_KEY)
    return { token: process.env.MINDSTUDIO_API_KEY, authType: "apiKey" };
  if (config?.apiKey) return { token: config.apiKey, authType: "apiKey" };
  throw new MindStudioError(
    "No API key provided. Run `mindstudio login`, pass `apiKey` to the constructor, or set the MINDSTUDIO_API_KEY environment variable.",
    "missing_api_key",
    401
  );
}
var DEFAULT_BASE_URL, DEFAULT_MAX_RETRIES, MindStudioAgent;
var init_client = __esm({
  async "src/client.ts"() {
    "use strict";
    init_http();
    init_errors();
    await init_context();
    init_db_ws();
    init_rate_limit();
    init_config();
    init_auth();
    init_db();
    init_files();
    init_datasources();
    init_voice();
    await init_task();
    await init_local();
    init_schema();
    init_steps();
    init_metadata();
    DEFAULT_BASE_URL = "https://v1.mindstudio-api.com";
    DEFAULT_MAX_RETRIES = 3;
    MindStudioAgent = class {
      /** @internal */
      _httpConfig;
      /** @internal */
      _reuseThreadId;
      /** @internal */
      _threadId;
      /** @internal Stream ID for SSE token streaming. Set by sandbox via STREAM_ID env var. */
      _streamId;
      // ---- App context (db + auth) ----
      /**
       * @internal App ID for context resolution. Resolved from:
       * constructor appId → MINDSTUDIO_APP_ID env → sandbox globals →
       * auto-detected from first executeStep response header.
       */
      _appId;
      /**
       * @internal Cached app context (auth + databases). Populated by
       * ensureContext() and cached for the lifetime of the instance.
       */
      _context;
      /**
       * @internal Deduplication promise for ensureContext(). Ensures only one
       * context fetch is in-flight at a time, even if multiple db/auth
       * operations trigger it concurrently.
       */
      _contextPromise;
      /** @internal Cached AuthContext instance, created during context hydration. */
      _auth;
      /** @internal Cached Db namespace instance, created during context hydration. */
      _db;
      /** @internal Cached Files namespace instance (lazy; no context hydration needed). */
      _files;
      _dataSources;
      _voice;
      /** @internal Auth type — 'internal' for CALLBACK_TOKEN (managed mode), 'apiKey' otherwise. */
      _authType;
      /** @internal Usage source sent on step executions (from MINDSTUDIO_REQUEST_SOURCE).
       *  Only set for api-key (CLI) auth so in-app/managed runtime is unaffected. */
      _requestSource;
      /**
       * @internal Resolve the current auth token. Checks ALS request context
       * first, then CALLBACK_TOKEN env var, then static config token.
       */
      get _token() {
        const rctx = getRequestContext();
        if (rctx?.callbackToken) return rctx.callbackToken;
        if (this._authType === "internal" && process.env.CALLBACK_TOKEN) {
          return process.env.CALLBACK_TOKEN;
        }
        return this._httpConfig.token;
      }
      /**
       * @internal HTTP config with ALS-aware baseUrl and token resolution.
       * Used instead of `_httpConfig` at all `request()` call sites.
       */
      get _currentHttpConfig() {
        const rctx = getRequestContext();
        if (rctx?.remoteHostname) {
          return {
            ...this._httpConfig,
            baseUrl: rctx.remoteHostname,
            token: this._token
          };
        }
        return this._httpConfig;
      }
      /**
       * @internal Stream ID with ALS-aware resolution.
       */
      get _currentStreamId() {
        return getRequestContext()?.streamId ?? this._streamId;
      }
      /**
       * @internal Get resolved app context from ALS or instance cache.
       */
      _getContext() {
        const rctx = getRequestContext();
        if (rctx?.auth && rctx?.databases) {
          return {
            auth: rctx.auth,
            databases: rctx.databases,
            authConfig: rctx.authConfig
          };
        }
        return this._context;
      }
      constructor(options = {}) {
        const config = loadConfig();
        const { token, authType } = resolveToken(options.apiKey, config);
        const rctx = getRequestContext();
        const baseUrl = options.baseUrl ?? rctx?.remoteHostname ?? process.env.MINDSTUDIO_BASE_URL ?? process.env.REMOTE_HOSTNAME ?? config.baseUrl ?? DEFAULT_BASE_URL;
        this._reuseThreadId = options.reuseThreadId ?? /^(true|1)$/i.test(process.env.MINDSTUDIO_REUSE_THREAD_ID ?? "");
        this._appId = options.appId ?? process.env.MINDSTUDIO_APP_ID ?? void 0;
        this._authType = authType;
        this._requestSource = authType === "apiKey" ? process.env.MINDSTUDIO_REQUEST_SOURCE || void 0 : void 0;
        this._httpConfig = {
          baseUrl,
          token,
          rateLimiter: new RateLimiter(authType),
          maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES
        };
        if (authType === "internal") {
          this._trySandboxHydration();
        }
        this._streamId = process.env.STREAM_ID ?? void 0;
      }
      /**
       * Execute any step by its type name. This is the low-level method that all
       * typed step methods delegate to. Use it as an escape hatch for step types
       * not yet covered by the generated methods.
       *
       * ```ts
       * const result = await agent.executeStep("generateImage", { prompt: "hello", mode: "background" });
       * ```
       */
      async executeStep(stepType, step, options) {
        if (options?.onLog) {
          return this._executeStepStreaming(
            stepType,
            step,
            options
          );
        }
        const threadId = options?.threadId ?? (this._reuseThreadId && !getRequestContext() ? this._threadId : void 0);
        const { data: asyncData, headers } = await request(this._currentHttpConfig, "POST", `/steps/${stepType}/execute-async`, {
          step,
          ...options?.appId != null && { appId: options.appId },
          ...threadId != null && { threadId },
          ...this._currentStreamId != null && { streamId: this._currentStreamId },
          ...(options?.requestSource ?? this._requestSource) != null && {
            requestSource: options?.requestSource ?? this._requestSource
          },
          ...assetStoreBody(options?.store)
        });
        const remaining = headers.get("x-ratelimit-remaining");
        const returnedThreadId = asyncData.threadId ?? "";
        if (this._reuseThreadId && returnedThreadId && !getRequestContext()) {
          this._threadId = returnedThreadId;
        }
        if (!this._appId && asyncData.appId && !getRequestContext()) {
          this._appId = asyncData.appId;
        }
        const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/${stepType}/execute-async/poll/${asyncData.executionToken}`;
        let pollDelay = 100;
        while (true) {
          await sleep3(pollDelay);
          pollDelay = Math.min(pollDelay * 2, 5e3);
          const res = await fetch(pollUrl, {
            headers: { "User-Agent": "@mindstudio-ai/agent" }
          });
          if (res.status === 502 || res.status === 503 || res.status === 504)
            continue;
          if (res.status === 404) {
            throw new MindStudioError(
              `[${stepType}] Execution token expired.`,
              "poll_token_expired",
              404
            );
          }
          if (!res.ok) {
            const errorBody = await res.json().catch(() => ({}));
            throw new MindStudioError(
              errorBody.message ?? errorBody.error ?? `[${stepType}] Poll failed: ${res.status} ${res.statusText}`,
              errorBody.code ?? "poll_error",
              res.status,
              errorBody
            );
          }
          const poll = await res.json();
          if (poll.status === "pending") continue;
          if (poll.status === "error") {
            throw new MindStudioError(
              `[${stepType}] ${poll.error ?? "Step execution failed."}`,
              "step_error",
              500
            );
          }
          let output;
          if (poll.output != null) {
            output = poll.output;
          } else if (poll.outputUrl) {
            const s3Res = await fetch(poll.outputUrl);
            if (!s3Res.ok) {
              throw new MindStudioError(
                `Failed to fetch ${stepType} output from S3: ${s3Res.status} ${s3Res.statusText}`,
                "output_fetch_error",
                s3Res.status
              );
            }
            const envelope = await s3Res.json();
            output = envelope.value;
          } else {
            output = void 0;
          }
          return {
            ...output,
            $appId: poll.appId ?? asyncData.appId ?? "",
            $threadId: poll.threadId ?? returnedThreadId,
            $rateLimitRemaining: remaining != null ? parseInt(remaining, 10) : void 0,
            $billingCost: poll.billingCost,
            $billingEvents: poll.billingEvents
          };
        }
      }
      /**
       * @internal Streaming step execution — sends `Accept: text/event-stream`
       * and parses SSE events for real-time debug logs.
       */
      async _executeStepStreaming(stepType, step, options) {
        const threadId = options.threadId ?? (this._reuseThreadId && !getRequestContext() ? this._threadId : void 0);
        const url = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/${stepType}/execute`;
        const body = {
          step,
          ...options.appId != null && { appId: options.appId },
          ...threadId != null && { threadId },
          ...this._currentStreamId != null && { streamId: this._currentStreamId },
          ...(options.requestSource ?? this._requestSource) != null && {
            requestSource: options.requestSource ?? this._requestSource
          },
          ...assetStoreBody(options.store)
        };
        await this._httpConfig.rateLimiter.acquire();
        let res;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this._token}`,
              "Content-Type": "application/json",
              "User-Agent": "@mindstudio-ai/agent",
              Accept: "text/event-stream"
            },
            body: JSON.stringify(body)
          });
        } catch (err) {
          this._httpConfig.rateLimiter.release();
          throw err;
        }
        this._httpConfig.rateLimiter.updateFromHeaders(res.headers);
        if (!res.ok) {
          this._httpConfig.rateLimiter.release();
          let message = `${res.status} ${res.statusText}`;
          let code = "api_error";
          let details;
          try {
            const text = await res.text();
            try {
              const body2 = JSON.parse(text);
              details = body2;
              const errMsg = (typeof body2.error === "string" ? body2.error : void 0) ?? (typeof body2.message === "string" ? body2.message : void 0) ?? (typeof body2.details === "string" ? body2.details : void 0);
              if (errMsg) message = errMsg;
              else if (body2.error || body2.message || body2.details) {
                message = JSON.stringify(
                  body2.error ?? body2.message ?? body2.details
                );
              }
              if (body2.code) code = body2.code;
            } catch {
              const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
              if (stripped) message = stripped.slice(0, 200);
            }
          } catch {
          }
          throw new MindStudioError(
            `[${stepType}] ${message}`,
            code,
            res.status,
            details
          );
        }
        const headers = res.headers;
        try {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let doneEvent = null;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === "log") {
                  options.onLog({
                    value: event.value,
                    tag: event.tag,
                    ts: event.ts
                  });
                } else if (event.type === "done") {
                  doneEvent = {
                    output: event.output,
                    outputUrl: event.outputUrl,
                    billingCost: event.billingCost,
                    billingEvents: event.billingEvents
                  };
                } else if (event.type === "error") {
                  throw new MindStudioError(
                    `[${stepType}] ${event.error || "Step execution failed"}`,
                    "step_error",
                    500
                  );
                }
              } catch (err) {
                if (err instanceof MindStudioError) throw err;
              }
            }
          }
          if (buffer.startsWith("data: ")) {
            try {
              const event = JSON.parse(buffer.slice(6));
              if (event.type === "done") {
                doneEvent = {
                  output: event.output,
                  outputUrl: event.outputUrl,
                  billingCost: event.billingCost,
                  billingEvents: event.billingEvents
                };
              } else if (event.type === "error") {
                throw new MindStudioError(
                  event.error || "Step execution failed",
                  "step_error",
                  500
                );
              } else if (event.type === "log") {
                options.onLog({
                  value: event.value,
                  tag: event.tag,
                  ts: event.ts
                });
              }
            } catch (err) {
              if (err instanceof MindStudioError) throw err;
            }
          }
          if (!doneEvent) {
            throw new MindStudioError(
              `[${stepType}] Stream ended unexpectedly without completing. The step execution may have been interrupted.`,
              "stream_error",
              500
            );
          }
          let output;
          if (doneEvent.output != null) {
            output = doneEvent.output;
          } else if (doneEvent.outputUrl) {
            const s3Res = await fetch(doneEvent.outputUrl);
            if (!s3Res.ok) {
              throw new MindStudioError(
                `Failed to fetch ${stepType} output from S3: ${s3Res.status} ${s3Res.statusText}`,
                "output_fetch_error",
                s3Res.status
              );
            }
            const envelope = await s3Res.json();
            output = envelope.value;
          } else {
            output = void 0;
          }
          const returnedThreadId = headers.get("x-mindstudio-thread-id") ?? "";
          if (this._reuseThreadId && returnedThreadId && !getRequestContext()) {
            this._threadId = returnedThreadId;
          }
          const returnedAppId = headers.get("x-mindstudio-app-id");
          if (!this._appId && returnedAppId && !getRequestContext()) {
            this._appId = returnedAppId;
          }
          const remaining = headers.get("x-ratelimit-remaining");
          return {
            ...output,
            $appId: headers.get("x-mindstudio-app-id") ?? "",
            $threadId: returnedThreadId,
            $rateLimitRemaining: remaining != null ? parseInt(remaining, 10) : void 0,
            $billingCost: doneEvent.billingCost,
            $billingEvents: doneEvent.billingEvents
          };
        } finally {
          this._httpConfig.rateLimiter.release();
        }
      }
      /**
       * Execute multiple steps in parallel in a single request.
       *
       * All steps run in parallel on the server. Results are returned in the same
       * order as the input. Individual step failures do not affect other steps —
       * partial success is possible.
       *
       * ```ts
       * const { results } = await agent.executeStepBatch([
       *   { stepType: 'generateImage', step: { prompt: 'a sunset' } },
       *   { stepType: 'textToSpeech', step: { text: 'Hello world' } },
       * ]);
       * ```
       */
      async executeStepBatch(steps, options) {
        const threadId = options?.threadId ?? (this._reuseThreadId && !getRequestContext() ? this._threadId : void 0);
        const { data: asyncData } = await request(this._currentHttpConfig, "POST", "/steps/execute-batch-async", {
          steps: steps.map((s) => ({
            ...s,
            stepType: resolveStepType2(s.stepType)
          })),
          ...options?.appId != null && { appId: options.appId },
          ...threadId != null && { threadId },
          ...this._requestSource != null && {
            requestSource: this._requestSource
          },
          ...assetStoreBody(options?.store)
        });
        const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/execute-batch-async/poll/${asyncData.batchToken}`;
        let pollDelay = 300;
        while (true) {
          await sleep3(pollDelay);
          pollDelay = Math.min(pollDelay * 1.5, 3e3);
          const res = await fetch(pollUrl, {
            headers: { "User-Agent": "@mindstudio-ai/agent" }
          });
          if (res.status === 502 || res.status === 503 || res.status === 504)
            continue;
          if (res.status === 404) {
            throw new MindStudioError(
              "Batch poll token not found or expired.",
              "poll_token_expired",
              404
            );
          }
          if (!res.ok) {
            const errorBody = await res.json().catch(() => ({}));
            throw new MindStudioError(
              errorBody.message ?? errorBody.error ?? `Batch poll failed: ${res.status} ${res.statusText}`,
              errorBody.code ?? "poll_error",
              res.status,
              errorBody
            );
          }
          const poll = await res.json();
          if (poll.status === "pending") {
            if (options?.onProgress && poll.totalSteps != null && poll.completedSteps != null) {
              options.onProgress(poll.completedSteps, poll.totalSteps);
            }
            continue;
          }
          if (poll.status === "error") {
            throw new MindStudioError(
              poll.error ?? "Batch execution failed.",
              "batch_execution_error",
              500
            );
          }
          const results = await Promise.all(
            poll.results.map(async (r) => {
              if (r.output != null) {
                return {
                  stepType: r.stepType,
                  output: r.output,
                  billingCost: r.billingCost,
                  error: r.error
                };
              }
              if (r.outputUrl) {
                const s3Res = await fetch(r.outputUrl);
                if (!s3Res.ok) {
                  return {
                    stepType: r.stepType,
                    error: `Failed to fetch output from S3: ${s3Res.status} ${s3Res.statusText}`
                  };
                }
                const envelope = await s3Res.json();
                return {
                  stepType: r.stepType,
                  output: envelope.value,
                  billingCost: r.billingCost
                };
              }
              return {
                stepType: r.stepType,
                billingCost: r.billingCost,
                error: r.error
              };
            })
          );
          const resultThreadId = poll.threadId ?? asyncData.threadId;
          if (this._reuseThreadId && resultThreadId && !getRequestContext()) {
            this._threadId = resultThreadId;
          }
          return {
            results,
            totalBillingCost: poll.totalBillingCost,
            appId: poll.appId,
            threadId: resultThreadId
          };
        }
      }
      async runTask(options) {
        const taskPromise = this._runTaskInner(options);
        const hook = globalThis.__msWaitUntil;
        if (typeof hook === "function") {
          try {
            hook(taskPromise.catch(() => {
            }));
          } catch {
          }
        }
        return taskPromise;
      }
      /**
       * Register background work with the platform so the sandbox stays alive
       * until it settles (bounded at ~30 minutes) instead of being reaped as
       * idle, and so an interruption is recorded in the request log if the
       * sandbox is torn down anyway.
       *
       * Use it for the fire-and-forget pattern — kick off slow work, return
       * early, write results back when it finishes:
       *
       * ```ts
       * mindstudio.waitUntil(
       *   enrichRecord(id)
       *     .then((data) => Records.update(id, { ...data, status: 'ready' }))
       *     .catch(() => Records.update(id, { status: 'failed' })),
       * );
       * return { status: 'processing' };
       * ```
       *
       * Failures of the registered promise are caught and logged to the request
       * log — they can never crash the sandbox. Outside a managed sandbox this
       * degrades to just that error-catching. If you need the result, keep your
       * own reference to the promise and `await` it — `waitUntil` returns void.
       */
      waitUntil(promise) {
        const caught = Promise.resolve(promise).catch((err) => {
          console.error(
            "[waitUntil] Background work failed:",
            err instanceof Error ? err.stack ?? err.message : String(err)
          );
        });
        const hook = globalThis.__msWaitUntil;
        if (typeof hook === "function") {
          try {
            hook(caught);
          } catch {
          }
        }
      }
      async _runTaskInner(options) {
        const httpConfig = this._currentHttpConfig;
        try {
          return await runTaskLocal(
            {
              httpConfig,
              executeStepTool: async (stepType, input) => {
                try {
                  const result = await this.executeStep(stepType, input, {
                    requestSource: "v2-task"
                  });
                  const output = {};
                  let billingCost = 0;
                  for (const [key, value] of Object.entries(
                    result
                  )) {
                    if (key === "$billingCost" && typeof value === "number") {
                      billingCost = value;
                    }
                    if (!key.startsWith("$")) {
                      output[key] = value;
                    }
                  }
                  return { output, billingCost, isError: false };
                } catch (err) {
                  return {
                    output: {
                      error: err instanceof Error ? err.message : "Step execution failed"
                    },
                    billingCost: 0,
                    isError: true
                  };
                }
              },
              executeMethodTool: async (methodId, input) => {
                try {
                  const { data } = await request(
                    { ...httpConfig, maxRetries: 0 },
                    "POST",
                    "/task/invoke-method",
                    {
                      methodId,
                      input
                    }
                  );
                  if (data.error) {
                    return {
                      output: { error: data.error },
                      billingCost: 0,
                      isError: true
                    };
                  }
                  return {
                    output: data.output ?? null,
                    billingCost: 0,
                    isError: false
                  };
                } catch (err) {
                  return {
                    output: {
                      error: err instanceof Error ? err.message : "Method execution failed"
                    },
                    billingCost: 0,
                    isError: true
                  };
                }
              }
            },
            options
          );
        } catch (err) {
          if (err instanceof MindStudioError && err.code === TURN_UNAVAILABLE_CODE) {
            const body = buildTaskRequestBody(options);
            const result = options.onEvent ? await runTaskStream(httpConfig, body, options.onEvent) : await runTaskPoll(httpConfig, body);
            if (options.outputSchema) {
              const errors = result.parsedSuccessfully ? validateAgainstSchema(result.output, options.outputSchema) : [{ path: "$", message: "output was not valid JSON" }];
              if (errors.length > 0) {
                throw new MindStudioError(
                  "[task] Output did not conform to outputSchema (legacy task route, no repair turns).",
                  "task_output_schema_mismatch",
                  422,
                  {
                    outputRaw: result.outputRaw,
                    errors,
                    turns: result.turns,
                    usage: result.usage,
                    toolCalls: result.toolCalls
                  }
                );
              }
            }
            return result;
          }
          throw err;
        }
      }
      /**
       * Get the authenticated user's identity and organization info.
       *
       * ```ts
       * const info = await agent.getUserInfo();
       * console.log(info.displayName, info.organizationName);
       * ```
       */
      async getUserInfo() {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          "/account/userinfo"
        );
        return data;
      }
      /**
       * List all pre-built agents in the organization.
       *
       * ```ts
       * const { apps } = await agent.listAgents();
       * for (const app of apps) console.log(app.name, app.id);
       * ```
       */
      async listAgents() {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          "/agents/load"
        );
        return data;
      }
      /**
       * Run a pre-built agent and wait for the result.
       *
       * Uses async polling internally — the request returns immediately with a
       * callback token, then polls until the run completes or fails.
       *
       * ```ts
       * const result = await agent.runAgent({
       *   appId: 'your-agent-id',
       *   variables: { query: 'hello' },
       * });
       * console.log(result.result);
       * ```
       */
      async runAgent(options) {
        const pollInterval = options.pollIntervalMs ?? 1e3;
        const { data } = await request(this._currentHttpConfig, "POST", "/agents/run", {
          appId: options.appId,
          async: true,
          ...options.variables != null && { variables: options.variables },
          ...options.workflow != null && { workflow: options.workflow },
          ...options.version != null && { version: options.version },
          ...options.includeBillingCost != null && {
            includeBillingCost: options.includeBillingCost
          },
          ...options.metadata != null && { metadata: options.metadata }
        });
        const token = data.callbackToken;
        const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/agents/run/poll/${token}`;
        while (true) {
          await sleep3(pollInterval);
          const res = await fetch(pollUrl, {
            headers: { "User-Agent": "@mindstudio-ai/agent" }
          });
          if (res.status === 502 || res.status === 503 || res.status === 504)
            continue;
          if (res.status === 404) {
            throw new MindStudioError(
              "Poll token not found or expired.",
              "poll_token_expired",
              404
            );
          }
          if (!res.ok) {
            const errorBody = await res.json().catch(() => ({}));
            throw new MindStudioError(
              errorBody.message ?? errorBody.error ?? `Poll request failed: ${res.status} ${res.statusText}`,
              errorBody.code ?? "poll_error",
              res.status,
              errorBody
            );
          }
          const poll = await res.json();
          if (poll.status === "pending") continue;
          if (poll.status === "error") {
            throw new MindStudioError(
              poll.error ?? "Agent run failed.",
              "agent_run_error",
              500
            );
          }
          return poll.result;
        }
      }
      /** @internal Used by generated action methods. */
      _request(method, path, body) {
        return request(this._currentHttpConfig, method, path, body);
      }
      // -------------------------------------------------------------------------
      // Helper methods — models
      // -------------------------------------------------------------------------
      /** List all available AI models. */
      async listModels() {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          "/helpers/models"
        );
        return data;
      }
      /** List AI models filtered by type. */
      async listModelsByType(modelType) {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          `/helpers/models/${modelType}`
        );
        return data;
      }
      /** List all available AI models (summary). Returns only id, name, type, and tags. */
      async listModelsSummary() {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          "/helpers/models-summary"
        );
        return data;
      }
      /** List AI models (summary) filtered by type. */
      async listModelsSummaryByType(modelType) {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          `/helpers/models-summary/${modelType}`
        );
        return data;
      }
      // -------------------------------------------------------------------------
      // Helper methods — OAuth connectors & connections
      // -------------------------------------------------------------------------
      /**
       * List available OAuth connector services (Slack, Google, HubSpot, etc.).
       *
       * These are third-party integrations from the MindStudio Connector Registry.
       * For most tasks, use actions directly instead.
       */
      async listConnectors() {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          "/helpers/connectors"
        );
        return data;
      }
      /** Get details for a single OAuth connector service. */
      async getConnector(serviceId) {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          `/helpers/connectors/${serviceId}`
        );
        return data;
      }
      /** Get the full configuration for an OAuth connector action, including input fields. */
      async getConnectorAction(serviceId, actionId) {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          `/helpers/connectors/${serviceId}/${actionId}`
        );
        return data;
      }
      /** List OAuth connections for the organization. These are authenticated third-party service links. */
      async listConnections() {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          "/helpers/connections"
        );
        return data;
      }
      /** List packaged workflows available to the organization. */
      async listPackagedWorkflows() {
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          "/helpers/packaged-workflows"
        );
        return data;
      }
      // -------------------------------------------------------------------------
      // Helper methods — cost estimation
      // -------------------------------------------------------------------------
      /** Estimate the cost of executing an action before running it. */
      async estimateStepCost(stepType, step, options) {
        const { data } = await request(this._currentHttpConfig, "POST", "/helpers/step-cost-estimate", {
          step: { type: resolveStepType2(stepType), ...step },
          ...options
        });
        return data;
      }
      // -------------------------------------------------------------------------
      // Streaming
      // -------------------------------------------------------------------------
      /**
       * Send a stream chunk to the caller via SSE.
       *
       * When invoked from a method that was called with `stream: true`, chunks
       * are delivered in real-time as Server-Sent Events. When there is no active
       * stream (no `STREAM_ID`), calls are silently ignored — so it's safe to
       * call unconditionally.
       *
       * Accepts strings (sent as `type: 'token'`) or structured data (sent as
       * `type: 'data'`). The caller receives each chunk as an SSE event.
       *
       * @example
       * ```ts
       * // Stream text tokens
       * await agent.stream('Processing item 1...');
       *
       * // Stream structured data
       * await agent.stream({ progress: 50, currentItem: 'abc' });
       * ```
       */
      stream = async (data) => {
        const streamId = this._currentStreamId;
        if (!streamId) return;
        const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/stream-chunk`;
        const body = typeof data === "string" ? { streamId, type: "token", text: data } : { streamId, type: "data", data };
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: this._token
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn(`[mindstudio] stream chunk failed: ${res.status} ${text}`);
        }
      };
      // -------------------------------------------------------------------------
      // db + auth namespaces
      // -------------------------------------------------------------------------
      /**
       * The `auth` namespace — synchronous role-based access control.
       *
       * Provides the current user's identity and roles. All methods are
       * synchronous since the role map is preloaded during context hydration.
       *
       * **Important**: Context must be hydrated before accessing `auth`.
       * - Inside the MindStudio sandbox: automatic (populated from globals)
       * - Outside the sandbox: call `await agent.ensureContext()` first,
       *   or access `auth` after any `db` operation (which auto-hydrates)
       *
       * @throws {MindStudioError} if context has not been hydrated yet
       *
       * @example
       * ```ts
       * await agent.ensureContext();
       * agent.auth.requireRole(Roles.admin);
       * const admins = agent.auth.getUsersByRole(Roles.admin);
       * ```
       */
      get auth() {
        const rctx = getRequestContext();
        if (rctx?.auth) {
          return new AuthContext(rctx.auth);
        }
        if (this._authType === "internal") {
          const ai = globalThis.ai;
          if (ai?.auth) {
            return new AuthContext(ai.auth);
          }
        }
        if (!this._auth) {
          this._trySandboxHydration();
        }
        if (!this._auth) {
          throw new MindStudioError(
            "Auth context not loaded. Call `await agent.ensureContext()` first, or perform any db operation (which auto-loads context).",
            "context_not_loaded",
            400
          );
        }
        return this._auth;
      }
      /**
       * The `db` namespace — chainable collection API over managed databases.
       *
       * Use `db.defineTable<T>(name)` to get a typed Table<T>, then call
       * collection methods (filter, sortBy, push, update, etc.) on it.
       *
       * Context is auto-hydrated on first query execution — you can safely
       * call `defineTable()` at module scope without triggering any HTTP.
       *
       * @example
       * ```ts
       * const Orders = agent.db.defineTable<Order>('orders');
       * const active = await Orders.filter(o => o.status === 'active').take(10);
       * ```
       */
      get db() {
        if (getRequestContext()) {
          return this._createLazyDb();
        }
        if (!this._db) {
          this._trySandboxHydration();
        }
        if (this._db) return this._db;
        return this._createLazyDb();
      }
      /**
       * Hydrate the app context (auth + database metadata). This must be
       * called before using `auth` synchronously. For `db`, hydration happens
       * automatically on first query.
       *
       * Context is fetched once and cached for the instance's lifetime.
       * Calling `ensureContext()` multiple times is safe (no-op after first).
       *
       * Context sources (checked in order):
       * 1. Sandbox globals (`globalThis.ai.auth`, `globalThis.ai.databases`)
       * 2. HTTP: `GET /developer/v2/helpers/app-context?appId={appId}`
       *
       * @throws {MindStudioError} if no `appId` is available
       *
       * @example
       * ```ts
       * await agent.ensureContext();
       * // auth is now available synchronously
       * agent.auth.requireRole(Roles.admin);
       * ```
       */
      async ensureContext() {
        if (this._getContext()) return;
        if (this._context) return;
        if (!this._contextPromise) {
          this._contextPromise = this._hydrateContext();
        }
        await this._contextPromise;
      }
      /**
       * @internal Fetch and cache app context, then create auth + db instances.
       *
       * In managed mode (CALLBACK_TOKEN), the platform resolves the app from
       * the token — no appId needed. With an API key, appId is required.
       */
      async _hydrateContext() {
        if (!this._appId && this._authType !== "internal") {
          throw new MindStudioError(
            "No app ID available for context resolution. Pass `appId` to the constructor, set the MINDSTUDIO_APP_ID environment variable, or make a step execution call first (which auto-detects the app ID).",
            "missing_app_id",
            400
          );
        }
        const context = await this.getAppContext(this._appId);
        this._applyContext(context);
      }
      /**
       * @internal Apply a resolved context object — creates AuthContext and Db.
       * Used by both the HTTP path and sandbox hydration.
       */
      _applyContext(context) {
        this._context = context;
        this._auth = new AuthContext(context.auth);
        this._db = createDb(
          context.databases,
          this._executeDbBatch.bind(this),
          context.authConfig,
          this._syncRoles.bind(this)
        );
      }
      /**
       * @internal Try to hydrate context synchronously from sandbox globals.
       * Called in the constructor when CALLBACK_TOKEN auth is detected.
       *
       * The MindStudio sandbox pre-populates `globalThis.ai` with:
       * - `ai.auth`: { userId, roleAssignments[] }
       * - `ai.databases`: [{ id, name, tables[] }]
       */
      _trySandboxHydration() {
        if (getRequestContext()) return;
        const ai = globalThis.ai;
        if (ai?.auth && ai?.databases) {
          this._applyContext({
            auth: ai.auth,
            databases: ai.databases,
            authConfig: ai.authConfig
          });
        }
      }
      /**
       * The `files` namespace — typed, private-by-default file storage (the twin of
       * `db`). No context hydration needed: the hook token identifies the app
       * server-side and stores are code-defined (access travels per call).
       *
       * @example
       * ```ts
       * const Uploads = agent.files.defineStore('uploads');
       * const f = await Uploads.put(buffer, { contentType: 'image/png' });
       * return { url: f.url };
       * ```
       */
      get files() {
        return this._files ??= createFiles(this._filesRequest.bind(this));
      }
      /**
       * Jewel surfaces: arrival-shaped triggers (`propose`) and the app-native
       * approval queue (`queue.list` / `queue.resolve`). See {@link JewelsApi}.
       */
      get jewels() {
        return {
          propose: (methodId, subject, opts) => {
            if (!methodId || typeof methodId !== "string") {
              throw new MindStudioError(
                "methodId is required",
                "missing_method_id",
                400
              );
            }
            return this._jewelsRequest("propose", {
              methodId,
              subject,
              ...opts?.idempotencyKey !== void 0 && {
                idempotencyKey: opts.idempotencyKey
              }
            });
          },
          queue: {
            list: (opts) => this._jewelsRequest("queue/list", {
              ...opts?.methodId !== void 0 && { methodId: opts.methodId },
              ...opts?.limit !== void 0 && { limit: opts.limit }
            }),
            resolve: (itemId, opts) => this._jewelsRequest("queue/resolve", {
              itemId,
              action: opts.action,
              ...opts.input !== void 0 && { input: opts.input }
            })
          }
        };
      }
      /**
       * Raw hook-token call shared by the jewels surfaces (mirrors reportIssue).
       * No retries: propose holds the request for the jewel run and is idempotent
       * by key anyway; resolve applies a method and must never double-fire.
       */
      async _jewelsRequest(path, body) {
        const rctx = getRequestContext();
        if (this._authType !== "internal" && !rctx?.callbackToken) {
          throw new MindStudioError(
            `jewels.${path.replace("/", ".")} requires an app execution context (hook token) \u2014 it cannot be called with an API key.`,
            "jewels_requires_app_context",
            400
          );
        }
        const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/jewels/${path}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: this._token
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          let code = "jewels_error";
          let message = `jewels.${path.replace("/", ".")} failed: ${res.status} ${res.statusText}`;
          let details;
          try {
            const errBody = await res.json();
            details = errBody;
            if (typeof errBody.errorString === "string") code = errBody.errorString;
            message = typeof errBody.errorMessage === "string" && errBody.errorMessage || typeof errBody.errorString === "string" && errBody.errorString || message;
          } catch {
          }
          throw new MindStudioError(message, code, res.status, details);
        }
        return await res.json();
      }
      /**
       * Searchable document corpora.
       *
       * @example
       * ```ts
       * const Policies = agent.dataSources.defineDataSource('policies');
       * const { results } = await Policies.search('what are the payment terms?');
       * ```
       */
      get dataSources() {
        return this._dataSources ??= createDataSources(
          this._dataSourcesRequest.bind(this)
        );
      }
      /**
       * Telephony: outbound calls answered by this app's voice agent.
       *
       * @example
       * ```ts
       * await agent.voice.call({ to: '+13105551234', assumeIdentity: true });
       * ```
       */
      get voice() {
        return this._voice ??= createVoice(this._voiceRequest.bind(this));
      }
      /**
       * @internal Transport for the `files` namespace — POST /_internal/v2/files/<op>
       * with the raw hook token (mirrors `_executeDbBatch`).
       */
      async _filesRequest(op, body) {
        return this._brokeredRequest("files", op, body, {
          fallbackMessage: "File operation failed",
          fallbackCode: "file_error"
        });
      }
      /**
       * @internal Transport for the `dataSources` namespace —
       * POST /_internal/v2/datasources/<op> with the raw hook token.
       */
      async _dataSourcesRequest(op, body) {
        return this._brokeredRequest("datasources", op, body, {
          fallbackMessage: "Data source operation failed",
          fallbackCode: "data_source_error"
        });
      }
      /**
       * @internal Transport for the `voice` namespace —
       * POST /_internal/v2/voice/<op> with the raw hook token.
       */
      async _voiceRequest(op, body) {
        return this._brokeredRequest("voice", op, body, {
          fallbackMessage: "Voice operation failed",
          fallbackCode: "voice_error"
        });
      }
      /**
       * @internal Shared shape for the brokered `/_internal/v2/<ns>/<op>` data
       * planes. Factored out rather than copied per namespace so error handling
       * can't drift between them.
       */
      async _brokeredRequest(namespace, op, body, errors) {
        const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/${namespace}/${op}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: this._token
          },
          body: JSON.stringify(body)
        });
        if (res.status === 204) {
          return void 0;
        }
        const text = await res.text();
        let json;
        if (text) {
          try {
            json = JSON.parse(text);
          } catch {
          }
        }
        if (!res.ok) {
          const rawMsg = json?.errorMessage ?? (typeof json?.error === "string" ? json.error : json?.error?.message);
          const message = typeof rawMsg === "string" ? rawMsg : `${errors.fallbackMessage}: ${res.status} ${res.statusText}`;
          const code = json?.errorString ?? json?.code ?? errors.fallbackCode;
          throw new MindStudioError(message, code, res.status);
        }
        return json;
      }
      /**
       * @internal Execute a batch of SQL queries against a managed database.
       * Used as the `executeBatch` callback for Table/Query instances.
       *
       * Calls `POST /_internal/v2/db/query` directly with the hook token
       * (raw, no Bearer prefix). All queries run on a single SQLite connection,
       * enabling RETURNING clauses and multi-statement batches.
       */
      async _executeDbBatch(databaseId, queries) {
        const dbWsUrl = typeof process !== "undefined" ? process.env?.DB_WS_URL : void 0;
        if (dbWsUrl) {
          try {
            return await executeDbBatchOverWs(
              dbWsUrl,
              this._token,
              databaseId,
              queries
            );
          } catch (err) {
            if (!(err instanceof DbWsTransportError)) {
              throw err;
            }
            if (err.sent && queries.some((q) => !isReadOnlySql(q.sql))) {
              throw new MindStudioError(
                "[db] Connection was interrupted after this query was sent; because it contains a write, it was not automatically retried (the write may or may not have been applied). Verify the current state before re-running it.",
                "db_transport_interrupted",
                503
              );
            }
            console.warn(
              `[mindstudio] db: WebSocket transport unavailable (${err.message}); using HTTP for this query.`
            );
          }
        }
        const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/db/query`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: this._token
          },
          body: JSON.stringify({ databaseId, queries })
        });
        if (!res.ok) {
          let message = `Database query failed: ${res.status} ${res.statusText}`;
          let code = "db_query_error";
          try {
            const text = await res.text();
            try {
              const body = JSON.parse(text);
              const errMsg = (typeof body.error === "string" ? body.error : void 0) ?? (typeof body.message === "string" ? body.message : void 0) ?? (typeof body.details === "string" ? body.details : void 0);
              if (errMsg) message = errMsg;
              else if (body.error || body.message || body.details) {
                message = JSON.stringify(
                  body.error ?? body.message ?? body.details
                );
              }
              if (body.code) code = body.code;
            } catch {
              if (text && text.length < 500) message = text;
            }
          } catch {
          }
          throw new MindStudioError(`[db] ${message}`, code, res.status);
        }
        const data = await res.json();
        return data.results;
      }
      /**
       * @internal Sync a user's roles to the platform after a successful
       * auth table write. Calls POST /_internal/v2/auth/sync-user.
       * Fire-and-forget: errors are caught and logged, never propagated.
       */
      async _syncRoles(userId, roles) {
        try {
          const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/auth/sync-user`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: this._token
            },
            body: JSON.stringify({
              appId: this._appId,
              userId,
              roles
            })
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.warn(
              `[mindstudio] Role sync failed for user ${userId} (${res.status}${text ? ": " + text.slice(0, 100) : ""}). Roles were saved to the database but may not be reflected in auth.hasRole() until the next successful write.`
            );
          }
        } catch (err) {
          console.warn(
            `[mindstudio] Role sync failed for user ${userId}: network error. Roles were saved to the database but may not be reflected in auth.hasRole() until the next successful write.`
          );
        }
      }
      /**
       * @internal Create a lazy Db proxy that auto-hydrates context.
       *
       * defineTable() returns Table instances immediately (no async needed).
       * But the Table's executeBatch callback is wrapped to call ensureContext()
       * before the first query, so context is fetched lazily.
       */
      _createLazyDb() {
        const agent = this;
        return {
          defineTable(name, options) {
            const databaseHint = options?.database;
            const tableConfig = {
              databaseId: "",
              tableName: name,
              columns: [],
              unique: options?.unique,
              defaults: options?.defaults,
              executeBatch: async (queries) => {
                await agent.ensureContext();
                const ctx = agent._getContext();
                const ac = ctx.authConfig;
                if (ac && ac.table === name && !tableConfig.managedColumns) {
                  tableConfig.managedColumns = ac.columns;
                  if (ac.columns.roles) {
                    tableConfig.syncRoles = agent._syncRoles.bind(agent);
                  }
                }
                const databases = ctx.databases;
                let targetDb;
                if (databaseHint) {
                  targetDb = databases.find(
                    (d) => d.id === databaseHint || d.name === databaseHint
                  );
                } else {
                  targetDb = databases.find(
                    (d) => d.tables.some((t) => t.name === name)
                  );
                }
                if (tableConfig.columns.length === 0 && targetDb) {
                  const tableSchema = targetDb.tables.find((t) => t.name === name);
                  if (tableSchema) {
                    tableConfig.columns = tableSchema.schema;
                  }
                }
                const databaseId = targetDb?.id ?? databases[0]?.id ?? "";
                return agent._executeDbBatch(databaseId, queries);
              }
            };
            return new Table(tableConfig);
          },
          // Time helpers work without context
          now: () => Date.now(),
          days: (n) => n * 864e5,
          hours: (n) => n * 36e5,
          minutes: (n) => n * 6e4,
          ago: (ms) => Date.now() - ms,
          fromNow: (ms) => Date.now() + ms,
          userRef: (id) => id.startsWith("@@user@@") ? id.slice("@@user@@".length) : id,
          // Batch needs context — hydrate first, then delegate to real db
          batch: ((...queries) => {
            return (async () => {
              await agent.ensureContext();
              const resolvedDb = agent._db ?? createDb(
                agent._getContext().databases,
                agent._executeDbBatch.bind(agent),
                agent._getContext().authConfig,
                agent._syncRoles.bind(agent)
              );
              return resolvedDb.batch(...queries);
            })();
          })
        };
      }
      // -------------------------------------------------------------------------
      // Helper methods — user resolution
      // -------------------------------------------------------------------------
      /**
       * Resolve a single user ID to display info (name, email, profile picture).
       *
       * Use this when you have a `User`-typed field value and need the person's
       * display name, email, or avatar. Returns null if the user ID is not found.
       *
       * Also available as a top-level import:
       * ```ts
       * import { resolveUser } from '@mindstudio-ai/agent';
       * ```
       *
       * @param userId - The user ID to resolve (a `User` branded string or plain UUID)
       * @returns Resolved user info, or null if not found
       *
       * @example
       * ```ts
       * const user = await agent.resolveUser(order.requestedBy);
       * if (user) {
       *   console.log(user.name);              // "Jane Smith"
       *   console.log(user.email);             // "jane@example.com"
       *   console.log(user.profilePictureUrl); // "https://..." or null
       * }
       * ```
       */
      async resolveUser(userId) {
        const { users } = await this.resolveUsers([userId]);
        return users[0] ?? null;
      }
      /**
       * Resolve multiple user IDs to display info in a single request.
       * Maximum 100 user IDs per request.
       *
       * Use this for batch resolution when you have multiple user references
       * to display (e.g. all approvers on a purchase order, all team members).
       *
       * @param userIds - Array of user IDs to resolve (max 100)
       * @returns Object with `users` array of resolved user info
       *
       * @example
       * ```ts
       * // Resolve all approvers at once
       * const approverIds = approvals.map(a => a.assignedTo);
       * const { users } = await agent.resolveUsers(approverIds);
       *
       * for (const u of users) {
       *   console.log(`${u.name} (${u.email})`);
       * }
       * ```
       */
      async resolveUsers(userIds) {
        const { data } = await request(
          this._currentHttpConfig,
          "POST",
          "/helpers/resolve-users",
          { userIds }
        );
        return data;
      }
      // -------------------------------------------------------------------------
      // Issue reporting
      // -------------------------------------------------------------------------
      /**
       * File a bug report or feature idea into this app's issue tracker.
       *
       * For building an in-app "Report a bug" feature: wire the frontend UI to
       * an app backend method that calls this. The issue lands in the app's
       * issue tracker, visible to the app's team and available to the Remy agent.
       *
       * **Backend / managed-context only.** It authenticates with the app's hook
       * token (the same credential used for `db` queries), and the app id is
       * derived from that token server-side. Calling it outside a managed
       * context (e.g. with a plain API key) will fail with `401`.
       *
       * Rate limited per app (20 / 60s). On the limit this throws a
       * `MindStudioError` with `code === 'rate_limited'` and `status === 429` —
       * catch it to show a graceful "try again shortly" message. Every call
       * creates a new issue (no dedupe), so guard against double-submit in the UI.
       *
       * @returns The filed issue. Show `issue.number` to confirm "Reported as #42".
       *
       * @example
       * ```ts
       * // app backend method, e.g. exported as `reportBug`
       * export async function reportBug({ title, details, userEmail }) {
       *   try {
       *     const { number } = await mindstudio.reportIssue({
       *       title,
       *       body: details,
       *       kind: 'bug',
       *       reporter: userEmail, // free-form label; omit for anonymous
       *     });
       *     return { ok: true, issueNumber: number };
       *   } catch (e) {
       *     if (e instanceof MindStudioError && e.code === 'rate_limited') {
       *       return { ok: false, retry: true };
       *     }
       *     throw e;
       *   }
       * }
       * ```
       */
      async reportIssue(input) {
        const title = input.title?.trim();
        if (!title) {
          throw new MindStudioError("title is required", "missing_title", 400);
        }
        const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/report-issue`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: this._token
          },
          body: JSON.stringify({
            title,
            ...input.body !== void 0 && { body: input.body },
            ...input.kind !== void 0 && { kind: input.kind },
            ...input.reporter !== void 0 && { reporter: input.reporter }
          })
        });
        if (!res.ok) {
          let code = "report_issue_error";
          let message = `Report issue failed: ${res.status} ${res.statusText}`;
          let details;
          try {
            const body = await res.json();
            details = body;
            if (typeof body.errorString === "string") code = body.errorString;
            message = typeof body.errorMessage === "string" && body.errorMessage || typeof body.errorString === "string" && body.errorString || message;
          } catch {
          }
          throw new MindStudioError(message, code, res.status, details);
        }
        const data = await res.json();
        return data.issue;
      }
      /**
       * Invalidate the prerendered snapshot(s) for the current app so crawlers get
       * a fresh render on their next visit. Call after content behind a prerendered
       * page changes (e.g. a short URL's target). Omit `paths` (or pass an empty
       * array) to purge every snapshot for the app.
       *
       * Raw hook-token call (mirrors `reportIssue`) — the appId comes from the
       * token. Backend / managed-context only.
       *
       * ```ts
       * await mindstudio.invalidatePrerender(['/u/abc']);
       * ```
       */
      async invalidatePrerender(paths) {
        const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/prerender/invalidate`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: this._token
          },
          body: JSON.stringify(paths && paths.length ? { paths } : {})
        });
        if (!res.ok) {
          let code = "prerender_invalidate_error";
          let message = `Prerender invalidation failed: ${res.status} ${res.statusText}`;
          let details;
          try {
            const body = await res.json();
            details = body;
            if (typeof body.errorString === "string") code = body.errorString;
            message = typeof body.errorMessage === "string" && body.errorMessage || typeof body.errorString === "string" && body.errorString || message;
          } catch {
          }
          throw new MindStudioError(message, code, res.status, details);
        }
        return await res.json();
      }
      // -------------------------------------------------------------------------
      // App context
      // -------------------------------------------------------------------------
      /**
       * Get auth and database context for an app.
       *
       * Returns role assignments and managed database schemas. Useful for
       * hydrating `auth` and `db` namespaces when running outside the sandbox.
       *
       * When called with a CALLBACK_TOKEN (managed mode), `appId` is optional —
       * the platform resolves the app from the token. With an API key, `appId`
       * is required.
       *
       * ```ts
       * const ctx = await agent.getAppContext('your-app-id');
       * console.log(ctx.auth.roleAssignments, ctx.databases);
       * ```
       */
      async getAppContext(appId) {
        const query = appId ? `?appId=${encodeURIComponent(appId)}` : "";
        const { data } = await request(
          this._currentHttpConfig,
          "GET",
          `/helpers/app-context${query}`
        );
        return data;
      }
      // -------------------------------------------------------------------------
      // Account methods
      // -------------------------------------------------------------------------
      /** Update the display name of the authenticated user/agent. */
      async changeName(displayName) {
        await request(this._currentHttpConfig, "POST", "/account/change-name", {
          name: displayName
        });
      }
      /** Update the profile picture of the authenticated user/agent. */
      async changeProfilePicture(url) {
        await request(
          this._currentHttpConfig,
          "POST",
          "/account/change-profile-picture",
          {
            url
          }
        );
      }
      /**
       * Upload a file to the MindStudio CDN.
       *
       * Gets a presigned upload request from the API, POSTs the file as
       * multipart/form-data, and returns the permanent public URL.
       *
       * @deprecated For app file storage use the `files` store
       * (`files.defineStore(...).put(...)`) — private by default, app-scoped, and
       * served on the app's own domain. `uploadFile` uploads to the shared account
       * media CDN; it remains only for account-level assets (e.g. an agent avatar
       * passed to `changeProfilePicture`).
       */
      async uploadFile(content, options) {
        const filename = options.filename ?? `upload.${options.extension}`;
        const { data } = await request(this._currentHttpConfig, "POST", "/account/upload", { filename });
        const form = new FormData();
        for (const [k, v] of Object.entries(data.fields)) form.append(k, v);
        const buf = content.buffer.slice(
          content.byteOffset,
          content.byteOffset + content.byteLength
        );
        const fileBlob = new Blob(
          [buf],
          options.type ? { type: options.type } : void 0
        );
        form.append("file", fileBlob, filename);
        const res = await fetch(data.url, { method: "POST", body: form });
        if (!res.ok) {
          const errorText = await res.text().catch(() => "");
          throw new MindStudioError(
            `Upload failed: ${res.status} ${res.statusText}${errorText ? ` \u2014 ${errorText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}` : ""}`,
            "upload_error",
            res.status,
            errorText || void 0
          );
        }
        if (!data.publicUrl) {
          throw new MindStudioError(
            "Upload succeeded but server did not return a public URL.",
            "missing_public_url",
            500
          );
        }
        return { url: data.publicUrl };
      }
    };
    applyStepMethods(MindStudioAgent);
  }
});

// src/ask/sse.ts
async function* streamChat(params) {
  const { baseUrl, apiKey, ...body } = params;
  const url = `${baseUrl}/_internal/v2/agent/sdk/chat`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    yield { type: "error", error: `Network error: ${err.message}` };
    return;
  }
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body2 = await res.json();
      if (body2.error) errorMessage = body2.error;
      if (body2.errorMessage) errorMessage = body2.errorMessage;
    } catch {
    }
    yield { type: "error", error: errorMessage };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "text" || event.type === "tool_use" || event.type === "done" || event.type === "error") {
          yield event;
        }
      } catch {
      }
    }
  }
  if (buffer.startsWith("data: ")) {
    try {
      const event = JSON.parse(buffer.slice(6));
      if (event.type === "text" || event.type === "tool_use" || event.type === "done" || event.type === "error") {
        yield event;
      }
    } catch {
    }
  }
}
var init_sse = __esm({
  "src/ask/sse.ts"() {
    "use strict";
  }
});

// src/ask/tools.ts
function kebabToCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
async function toolGetActionDetails(input) {
  const { stepMetadata: stepMetadata2 } = await Promise.resolve().then(() => (init_metadata(), metadata_exports));
  const raw = input.actionName;
  const camel = raw.includes("-") ? kebabToCamel(raw) : raw;
  const meta = stepMetadata2[camel] ?? stepMetadata2[raw];
  if (!meta) {
    const keys = Object.keys(stepMetadata2);
    const lower = camel.toLowerCase();
    const match = keys.find((k) => k.toLowerCase() === lower);
    if (match) {
      return JSON.stringify(stepMetadata2[match], null, 2);
    }
    return JSON.stringify({
      error: `Unknown action: ${raw}. Available actions: ${keys.slice(0, 20).join(", ")}...`
    });
  }
  return JSON.stringify(meta, null, 2);
}
async function toolListModels(agent, input) {
  const type = input.type;
  const details = input.details;
  if (details) {
    const result2 = type ? await agent.listModelsByType(type) : await agent.listModels();
    return JSON.stringify(result2, null, 2);
  }
  const result = type ? await agent.listModelsSummaryByType(type) : await agent.listModelsSummary();
  return JSON.stringify(result, null, 2);
}
async function toolGetConnectorDetails(agent, input) {
  const serviceId = input.serviceId;
  const actionId = input.actionId;
  if (actionId) {
    const result2 = await agent.getConnectorAction(serviceId, actionId);
    return JSON.stringify(result2, null, 2);
  }
  const result = await agent.getConnector(serviceId);
  return JSON.stringify(result, null, 2);
}
async function executeTool(agent, name, input) {
  try {
    let result;
    switch (name) {
      case "getActionDetails":
        result = await toolGetActionDetails(input);
        break;
      case "listModels":
        result = await toolListModels(agent, input);
        break;
      case "getConnectorDetails":
        result = await toolGetConnectorDetails(agent, input);
        break;
      default:
        result = JSON.stringify({ error: `Unknown tool: ${name}` });
    }
    return { result, isError: result.includes('"error"') };
  } catch (err) {
    return { result: `Error: ${err.message}`, isError: true };
  }
}
var ASK_TOOLS;
var init_tools = __esm({
  "src/ask/tools.ts"() {
    "use strict";
    ASK_TOOLS = [
      {
        name: "getActionDetails",
        description: "Get the full definition for a specific SDK action \u2014 JSON schema for inputs and outputs, usage notes, and description. Use this when you need exact parameter types, enum values, or optional fields to build correct code.",
        inputSchema: {
          type: "object",
          properties: {
            actionName: {
              type: "string",
              description: 'The action name in camelCase or kebab-case (e.g. "generateImage" or "generate-image")'
            }
          },
          required: ["actionName"]
        }
      },
      {
        name: "listModels",
        description: "List available AI models, optionally filtered by type. By default returns a compact summary (id, name, type, tags). With details=true, returns full model objects including the `inputs` array that defines config options (width, height, seed, etc.) \u2014 use this when you need to check model capabilities or build code with config options. You can filter the full list yourself instead of calling this multiple times.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: 'Filter by model type: "llm_chat", "image_generation", "3d_generation", "video_generation", "video_analysis", "text_to_speech", "music_generation", "lipsync", "vision", "transcription", "embedding", "reranking", "document_extraction". The last three back the data-source retrieval pipeline and have no step of their own \u2014 name them, do not pass them to a generate call.'
            },
            details: {
              type: "boolean",
              description: "If true, returns full model objects with inputs/config arrays. Use this when you need to check supported inputs, config options, or model capabilities."
            }
          }
        }
      },
      {
        name: "getConnectorDetails",
        description: "Drill into an OAuth connector service. With just serviceId, returns the list of available actions. With serviceId + actionId, returns the full action config including all input fields needed to call it via runFromConnectorRegistry.",
        inputSchema: {
          type: "object",
          properties: {
            serviceId: {
              type: "string",
              description: 'The connector service ID (e.g. "hubspot", "slack", "google-drive")'
            },
            actionId: {
              type: "string",
              description: "Optional action ID within the service. If provided, returns full action config with input fields."
            }
          },
          required: ["serviceId"]
        }
      }
    ];
  }
});

// src/ask/prompt/identity.ts
var identity;
var init_identity = __esm({
  "src/ask/prompt/identity.ts"() {
    "use strict";
    identity = `
You are a senior MindStudio SDK engineer. You help AI coding agents build applications with the @mindstudio-ai/agent TypeScript SDK. You don't just answer questions \u2014 you identify what the caller is actually trying to build and give them the complete approach: which actions to use, how to compose them, and what pitfalls to avoid. Your output is consumed by developers who will implement what you propose. Be direct, opinionated, and prescriptive \u2014 don't leave room for the caller to make bad choices.

Do not offer advice or recommend products or services outside the scope of the MindStudio SDK. If something is not possible, or would be tricky to do, note it for the developer and let them figure out how to solve it - that's outside the scope of your role.

Never invent URLs, email addresses, support channels, Discord servers, community forums, or documentation links. Do not direct the user to "MindStudio support", "the docs", or anything similar \u2014 you do not know where those live. The only URLs you may cite are ones that appear verbatim in the reference context below. When a question is outside your scope, say so and stop \u2014 do not speculate about where else the user could get help, and do not offer a handoff path you cannot verify.

If the user asks about @mindstudio-ai/interface, inform them that that is a separate package and they should trust what they already know about it.

## Scope

1. **Actions** \u2014 selecting and composing SDK actions for a use case
2. **AI models** \u2014 model selection, config options, override patterns
3. **OAuth connectors** \u2014 discovering and using the 850+ connector actions
4. **Task agents** \u2014 autonomous multi-step tool-use loops via runTask()
5. **Architecture** \u2014 batch execution, error handling, data flow between actions
6. **Managed databases and auth** \u2014 db, auth, Roles, resolveUser for MindStudio apps`.trim();
  }
});

// src/ask/prompt/reference.ts
function buildReferenceDocs(data) {
  return `<sdk_reference>
  <quick_reference>
  Auth is always pre-configured. Use the \`mindstudio\` singleton for actions: \`import { mindstudio } from '@mindstudio-ai/agent'\`. Use \`db\`, \`auth\`, \`Roles\`, \`stream\` as direct named imports. Do NOT use \`new MindStudioAgent()\` in code examples for MindStudio apps \u2014 the singleton handles auth automatically.
  Calling convention: \`const result = await mindstudio.methodName({ ...input })\`
  Results are flat: output fields + \`$appId\`, \`$threadId\`, \`$billingCost\` metadata.
  Thread persistence: pass \`{ threadId: result.$threadId, appId: result.$appId }\` as second arg.
  All 200+ models accessed through one API key \u2014 MindStudio routes to the provider server-side.

  Execution visibility (\`onLog\`):
  - **All step methods** (generateImage, generateText, searchGoogle, etc.) accept an \`onLog\` callback in the OPTIONS object (second argument). This enables SSE streaming with real-time progress during execution. Example: \`await mindstudio.generateImage({ prompt: '...' }, { onLog: (event) => console.log(event.tag, event.value) })\`. The event has \`{ value: string, tag: string, ts: number }\`. It works on ANY step method.
  - **Task agents** use \`onEvent\` (on the options object itself, not a second arg) for streaming events during the tool-use loop.

  \`stream()\` \u2014 pushing updates to the frontend:
  \`stream()\` sends real-time SSE events from server-side method code to the frontend. Two distinct behaviors depending on what you pass:
  - \`stream('text')\` \u2192 sent as a \`token\` event. The frontend's \`onToken\` callback receives the **accumulated** text (not a delta \u2014 each call contains the full text so far). Use for streaming text output progressively.
  - \`stream({ ... })\` \u2192 sent as a \`data\` event. The frontend receives this via a separate \`onStreamData\` handler (NOT \`onToken\`). Use for structured progress updates, status changes, URLs, etc.
  These are fundamentally different event types. Do NOT mix them up \u2014 \`stream({ status: 'done' })\` will NOT appear in \`onToken\`, and \`stream('Processing...')\` will NOT appear in \`onStreamData\`.
  \`stream()\` is silently ignored when there is no active SSE connection (CLI, background jobs) \u2014 always safe to include unconditionally.

  Progress for long-running operations:
  For any step that takes more than a few seconds (video generation, image generation, audio generation, lipsync, upscaling, etc.), ALWAYS use \`onLog\` combined with \`stream()\` to keep the user informed. This is the standard pattern, not optional:
  \`\`\`typescript
  import { mindstudio, stream } from '@mindstudio-ai/agent';

  // Send structured progress updates (frontend reads via onStreamData)
  await stream({ status: 'generating_video', message: 'Starting video generation...' });
  const { videoUrl } = await mindstudio.generateVideo({
    prompt: '...',
  }, {
    onLog: (event) => stream({ status: 'progress', message: event.value }),
  });
  await stream({ status: 'complete', videoUrl });
  \`\`\`
  Without this pattern, long-running operations appear to hang with no feedback to the user.

  Prompt caching and cost: Anthropic prompt caching is enabled automatically on every LLM call. There is NO SDK toggle, no opt-in flag, no configuration \u2014 it cannot be enabled or disabled. The platform marks the static portion of each request (system prompt + tool descriptions + leading conversation history) for caching, and subsequent calls within the 5-minute TTL read from cache at roughly 10% of full input cost. The \`$billingCost\` returned on every step result is the post-cache amount. In multi-turn chatbot / RAG / tool-use loops, expect 40-60% of input tokens to be served from cache after the first turn. NEVER tell a user "MindStudio doesn't support prompt caching" or "the SDK doesn't expose caching" \u2014 both are wrong. Caching is on, automatic, and already discounted. The SDK does not currently surface per-call cache hit/miss counts (no \`$cacheReadTokens\` field today), but the discount IS being applied. Real cost levers for chat/RAG/tool-using agents, in priority order: (1) trim tool descriptions \u2014 JSON tool schemas are larger than people expect and add to every turn, (2) cap conversation history by turn count or token budget with summarization on overflow (single biggest variable cost driver in multi-turn chat), (3) pre-filter large contexts via embedding retrieval before passing to the expensive model rather than dumping a whole library in the prompt, (4) shorten the system prompt \u2014 every K saved is one K not in the cache footprint either. Do NOT recommend "enabling prompt caching" as a cost-reduction strategy; it's already on and the savings are already in \`$billingCost\`.

  Database queries (Query, Mutation) support both \`await\` and \`.then()/.catch()\` \u2014 use standard try/catch with await or chain \`.catch()\` directly.

  Filter predicates and bindings: Filters compile to SQL when the predicate uses field comparisons, &&/||, .includes(), null checks, and boolean fields with literal values. Predicates that reference outer-scope variables (e.g. \`o => o.companyId === input.companyId\`) cannot be compiled \u2014 JavaScript closures aren't inspectable from outside the function \u2014 so they fall back to JS and scan the whole table. For filters on tables that may grow, ALWAYS use the explicit-bindings form so the filter compiles to SQL: \`Investments.filter((i, $) => i.companyId === $.companyId, { companyId: input.companyId })\`. The second predicate parameter (any name \u2014 \`$\`, \`vars\`, \`b\`) signals that bindings are in play; the third argument provides the values. Supported on filter, findOne, count, some, every, removeAll. Bound array \u2192 \`$.ids.includes(o.field)\` compiles to IN; bound string \u2192 \`o.field.includes($.text)\` compiles to LIKE. Missing keys fall back to JS \u2014 the SDK does not substitute NULL. ALWAYS include an inline code comment when you write the bindings form so downstream coding agents don't "simplify" the bindings argument away, e.g. \`{ companyId: input.companyId } // bindings: lifts closure var so filter compiles to SQL\`.

  Auth + DB identity: When an app has auth enabled, the authenticated user IS a row in the app's users table. \`auth.userId\` is the row's \`id\` \u2014 do NOT add a separate \`userId\` column. Access user data with \`Users.get(auth.userId)\`. The platform creates the user row on first login and manages the \`email\`, \`phone\`, and \`roles\` columns automatically. IMPORTANT: The platform only populates the mapped auth columns (email, phone, roles) when creating the row \u2014 all other columns will be null until the developer's code sets them. Non-auth columns on the user table should be typed as optional (e.g. \`username?: string\`) and null-checked before use.

  User-typed columns: The \`User\` type is just \`string\` at runtime. Write plain UUIDs to user-typed columns \u2014 do NOT add a \`@@user@@\` prefix manually and do NOT use \`as any\`. The SDK adds and strips the prefix automatically on read/write. If TypeScript complains about assigning a plain string to a \`User\` field, use \`db.userRef(id)\` to type-cast cleanly. Reads always return bare UUIDs; use \`resolveUser(id)\` when you need display info (name, email, avatar). Never do your own prefix handling \u2014 it will fight the SDK and cause double-prefixing or orphan refs. The \`@@user@@\` prefix is only visible in storage if you bypass the SDK with raw SQL; app code should never see or produce it.

  Task agents: For multi-step tasks requiring autonomous tool use, use \`runTask()\`. Provide a prompt, input, SDK action names as tools (with optional default overrides), an output contract, and a model. The SDK runs a tool-use loop and returns structured output. Prefer \`outputSchema\` for the output contract: plain JSON Schema (\`type\`/\`properties\`/\`required\`/\`enum\`/\`items\`; nullable via type arrays like \`["string","null"]\` \u2014 never \`nullable: true\`, never \`oneOf\`/\`$ref\`). Output is validated every turn with automatic repair and \`result.output\` is typed by inference from the schema \u2014 no generic argument and no \`parsedSuccessfully\` check needed; the call throws \`MindStudioError\` code \`task_output_schema_mismatch\` instead of ever returning nonconforming output. The legacy \`structuredOutputExample\` option (example object the model imitates) still works but is unvalidated \u2014 always check \`result.parsedSuccessfully\` before using its output. Tools can include any SDK action \u2014 e.g. \`['searchGoogle', 'fetchUrl', { method: 'generateImage', defaults: { imageModelOverride: { model: 'seedream-4.5' } } }]\`. Supports SSE streaming via \`onEvent\` callback.

  Uploading files / getting a hosted URL: For app file storage (user uploads, generated documents, images, marketing assets), use the \`files\` store \u2014 define a store at module scope and call \`await SomeStore.put(bytes, { contentType?, filename? })\` \u2192 returns \`{ url }\` served on the app's own domain (private by default; use a public store for world-readable assets). \`bytes\` is a \`Buffer\`/\`Uint8Array\`, so read/fetch the content first. The older \`mindstudio.uploadFile(...)\` (and the \`mindstudio upload <filepath>\` CLI) upload to the shared account media CDN and are DEPRECATED for app storage \u2014 they remain only for account-level one-off assets (e.g. an agent avatar for \`changeProfilePicture\`). Actions that generate a file (generateImage, generateVideo, generateSpeech, generatePdf, upscaleImage, \u2026) can write their output directly into a store: pass the store handle as \`store\` in the options object, e.g. \`await mindstudio.generateImage({ prompt }, { store: Assets })\`. It's optional \u2014 omit it and the asset goes to the shared CDN as before. More generally: some SDK capabilities are exposed as \`mindstudio\` CLI commands (list-actions, run-agent, exec, batch, \u2026), not only as code \u2014 reach for the CLI for one-off operations instead of writing and running code.

  Jewel arrival triggers (\`mindstudio.jewels.propose\`): For apps whose methods carry jewels (shadow companions declared in the manifest), \`await mindstudio.jewels.propose(methodId, subject, { idempotencyKey? })\` hands a decision moment to a method's jewel at the spot where app code knows the moment was born (e.g. an ingest branch that lands a row in a pending state). The platform runs the jewel and routes by the method's autonomy; the returned \`outcome\` is one of \`recorded\` (shadow \u2014 logged for later grading), \`queued\` (approve \u2014 \`queueItemId\` addresses the item), \`committed\` (auto \u2014 the method ran; \`output\` carries its return value), \`abstained\`, \`disabled\` (no jewel / manual \u2014 returned, never thrown), \`skipped\`, \`failed\`, or \`pending\` (a concurrent replay). \`idempotencyKey\` has Stripe semantics \u2014 a replayed key returns the original outcome, so webhook retries are safe; give sibling proposals for one moment the same key (usually the row's id) so grading can close them together. Backend only (hook token). The call blocks for the jewel run \u2014 wrap chains in \`mindstudio.waitUntil(...)\` so the calling method returns immediately, and order alternatives by priority (e.g. dedupe before classify), short-circuiting when one returns \`committed\`.

  Native approval flows (\`mindstudio.jewels.queue\`): For \`approve\`-mode methods, build the review inbox in the app itself. \`queue.list({ methodId?, limit? })\` returns pending items ({ id, methodId, subject, proposed, reasoning, proposedAt, expiresAt }); \`queue.resolve(itemId, { action: 'approve' | 'dismiss', input? })\` resolves one. Approve APPLIES the target method as the current session user \u2014 the reviewer \u2014 so the effect belongs to the human who clicked and the target method's own auth checks gate who may approve; ALSO gate the wrapping list/resolve methods with the app's reviewer role (\`auth.requireRole\`). Pass \`input\` to apply an edited version of the proposal (the edit is captured with the pair \u2014 high-value signal). Dismissal records the rejection without running anything. Unresolved items expire at the method's attributionWindow. Backend only (hook token).

  Reporting bugs / ideas (\`reportIssue\`): For building an in-app "Report a bug" or feedback feature, use \`mindstudio.reportIssue({ title, body?, kind?, reporter? })\` (also importable directly as \`reportIssue\`). It files an issue into the app's issue tracker \u2014 visible to the app's team in the dashboard and pickup-able by the Remy agent. Backend only: wire it as frontend UI \u2192 app backend method \u2192 \`reportIssue\` (a browser can't call it; it uses the app's hook token, and the app id is derived server-side). \`kind\` is \`'bug'\` (default) or \`'idea'\`. \`reporter\` is a free-form display label (a name, email, or ticket id) \u2014 NOT an identity check and not tied to a user; pass the current user's email if you have it, or omit for anonymous. It returns the created issue \u2014 show \`result.number\` to confirm "Reported as #42". Rate limited per app (20/min): catch \`MindStudioError\` with \`code === 'rate_limited'\` and show a graceful "try again shortly" message, and debounce the submit button (every call creates a new issue \u2014 no dedupe).

  Table options: \`db.defineTable<T>(name, { unique, defaults })\`.
  - \`unique: [['email'], ['userId', 'orgId']]\` \u2014 declares unique constraints (SDK communicates to platform, enables upsert).
  - \`defaults: { status: 'pending' }\` \u2014 client-side defaults applied in push() and upsert().
  - \`Table.upsert(conflictKey, data)\` \u2014 INSERT ... ON CONFLICT ... DO UPDATE. Conflict key must match a declared unique constraint. Returns created or updated row.
  </quick_reference>

  <model_overrides>
  Actions that use AI models accept a model override object. Each model has its own config options (dimensions, seed, etc.) defined in its \`inputs\` array. The \`inputs[].variable\` values are the keys for the \`config\` object:

  \`\`\`typescript
  import { mindstudio } from '@mindstudio-ai/agent';

  await mindstudio.generateImage({
    prompt: 'a sunset',
    imageModelOverride: {
      model: 'seedream-4.5',
      config: {
        width: 1024,
        height: 768,
        seed: 42,
      }
    }
  });
  \`\`\`

  Call listModels with details=true to discover the available config options for a model. The \`inputs\` array in the response defines what config keys are valid, their types, defaults, and constraints.

  Multi-vendor models list their serving routes in the \`routes\` field of listModels output. \`model: 'claude-opus-5@amazonBedrock'\` pins requests to that route (data-boundary/compliance use cases); the bare ID lets the platform route automatically and is the right default. Preserve any \`@route\` suffix the user's existing config carries.
  </model_overrides>

  <actions>
  ${data.llmsContent}
  </actions>

  <models>
  ${data.modelsSummary}
  </models>

  <oauth_connections>
  ${data.connections}
  </oauth_connections>

  <connector_services>
  OAuth connector services from the MindStudio Connector Registry. Each service has multiple actions (850+ total). Use the getConnectorDetails tool to drill into a service's actions and get input fields. Connector actions are executed via the \`runFromConnectorRegistry\` SDK action and require the user to have an OAuth connection set up for that service.

  ${data.connectorServices}
  </connector_services>
</sdk_reference>`;
}
var init_reference = __esm({
  "src/ask/prompt/reference.ts"() {
    "use strict";
  }
});

// src/ask/prompt/instructions.ts
var instructions;
var init_instructions = __esm({
  "src/ask/prompt/instructions.ts"() {
    "use strict";
    instructions = `<instructions>
  <principles>
  - Respond to intent, not just the question. When asked "how do I call generateText," also surface relevant configuration the caller probably doesn't know about \u2014 structured output options, response format controls, model-specific features. When asked "how do I parse JSON from a model response," recognize they're probably doing it wrong and suggest built-in structured output instead.
  - Think at the workflow level. When the caller describes a multi-step process ("take user input, call an LLM, extract entities, save to database"), respond with the complete architectural approach: which actions to use, how to chain them, where to use batch execution, what error handling to add. Not just the signature for one action.
  - Be opinionated about SDK usage. Make concrete recommendations about the right way to build things. "Use executeStepBatch here" is better than "you could optionally batch these." Stay grounded on model claims \u2014 only state facts from model metadata, not editorial judgments about quality.
  - Match depth to the question. Sometimes the user will ask you for help with a single function signature, for example - or sometimes they will want complete archiecture review. A simple "what params does generateImage take" gets a concise answer with a code example. A workflow question gets the full architectural response.
  </principles>

  <anti_patterns>
  Flag these when the caller's question implies them:

  - **Manual JSON parsing from LLM output** \u2014 if they're calling generateText and then parsing the response, they probably want structured output / response format controls instead of \`JSON.parse(content)\`.
  - **Sequential calls that should be batched** \u2014 multiple independent action calls (generate image + text-to-speech + search) should use \`executeStepBatch()\`. Three round trips become one.
  - **Building custom HTTP integrations when a connector exists** \u2014 if they're asking how to call the Slack API, Airtable API, HubSpot API, etc. via \`httpRequest\`, the answer is \`runFromConnectorRegistry\` with an existing OAuth connector. 850+ connector actions exist for this. If the user's has not configured the specific connectio in MindStudio yet, that should be step one. Direct them to https://app.mindstudio.ai/services/integrations
  - **Missing MindStudioError handling** \u2014 the SDK has structured errors with \`code\`, \`status\`, \`details\`. Catching generic \`Error\` loses actionable information. Always include \`MindStudioError\` handling in code examples.
  - **One-at-a-time db writes when batch exists** \u2014 N sequential \`update()\` or \`push()\` calls should be a single \`db.batch()\` call. One round trip instead of N.
  - **Closure variables in filter predicates** \u2014 \`Table.filter(o => o.x === input.x)\` cannot compile to SQL (JS closures aren't introspectable from outside the function), so it scans every row in the table in JS. For filters comparing to outer-scope values, use the explicit bindings form: \`Table.filter((o, $) => o.x === $.x, { x: input.x })\`. Recommend this whenever the predicate references a value from the enclosing function and the table might have more than a few hundred rows.
  - **Hardcoded model IDs without context** \u2014 model IDs can change. When writing code with a specific model, include a comment noting which model it is and why it was chosen, so the caller can swap it later.
  - **Adding a userId column to the auth users table** \u2014 \`auth.userId\` IS the row's \`id\` in the users table. The platform creates the row on login. Don't add a separate \`userId\` column \u2014 just use \`Users.get(auth.userId)\` to access the user's row.
  - Do not recommend using thread persistence. This is an advanced feature - if someone needs this they will discover it on their own.
  - Generate text is great for one-off text generation requests to models. For sustained conversations, conversations that require history, persistence, or multiple threads or tool use, recommend that the developer add an Agent interface to their MindStudio app and use that directly. They will understand what you mean by this.
  - **Manual multi-step orchestration when runTask() fits** \u2014 if the caller is chaining multiple SDK actions with conditional logic (search \u2192 extract \u2192 generate \u2192 validate), suggest \`runTask()\` instead. It handles the tool-use loop, error recovery, and structured output enforcement automatically.
  - **Recommending model switches when the user needs better prompting** \u2014 when a user says "my generated images aren't faithful enough" or "the output quality isn't good," the answer is to improve the prompt, NOT to recommend a different model. Do NOT analyze model configs, architectures, or capabilities to find a "better" model. The recommended models (Seedream 4.5, Gemini 3.1 Flash Image) handle all use cases. Help the user write a better prompt instead.
  </anti_patterns>

  <task_agent_guidance>
  \`runTask()\` is powerful but not always the right tool. Use this guidance to recommend it correctly:

  **USE runTask() when:**
  - The task requires 3+ steps with branching or judgment (e.g. "search, and if results are bad, try different terms")
  - The model needs to decide what to do next based on intermediate results (research, enrichment, content pipelines)
  - Error recovery matters \u2014 if a search fails, the model can try a different approach
  - The caller describes a goal, not a fixed sequence of steps
  - Examples: "find contact info for this person", "research this company and create a summary with logo", "generate product content in multiple formats"

  **DO NOT use runTask() when:**
  - The pipeline is simple and linear (2-3 steps, no decisions) \u2014 just call the actions directly in sequence, it's simpler and cheaper
  - The task is a single action call \u2014 just use the SDK method directly (\`generateText\`, \`searchGoogle\`, etc.)
  - The caller needs a persistent conversation \u2014 recommend an Agent interface in MindStudio instead
  - The caller just needs text generation \u2014 use \`generateText()\` directly

  When recommending \`runTask()\`, always include: a clear prompt, the specific tools needed (not every action \u2014 just the relevant ones), and a concrete \`outputSchema\` (plain JSON Schema: type/properties/required/enum/items; nullable via type arrays). The schema is critical \u2014 it is simultaneously the model's instruction, the SDK's validation contract (validated every turn with automatic repair; throws \`task_output_schema_mismatch\` rather than returning garbage), and the TypeScript type of \`result.output\`. Reserve the legacy \`structuredOutputExample\` for deliberately loose/exploratory output, and pair it with a \`parsedSuccessfully\` check.
  </task_agent_guidance>

  <model_guidance>
  Each model in the reference above includes a \`popularity\` score (0.0\u20131.0) reflecting real platform usage over the last 30 days, normalized per model type. Use this to guide recommendations:

  - **When the caller asks for a specific model**: use it. But if a significantly more popular or newer model exists in the same category, mention it. "Here's how to do X with Claude 3.5 Haiku \u2014 note that Claude Haiku 4.5 is the current generation and a better default."
  - **Never rank vendors** or claim one provider is better than another. Popularity reflects usage patterns, not quality judgments. Present options with their model IDs and let the caller choose. Never make assumptions about the capabilities of models, or suggest that a certain model is "good" at a specific task or better/worse than another at a task.
  - **Prefer popular models as defaults** in code examples unless the caller has a reason to use something specific.
  - **Always recommend latest-generation models**: For Anthropic, this is Claude 4 family, GPT-5 for OpenAI, Gemini 3 for Google, etc. MindStudio supports a ton of different models, including legacy models - but they are there for niche uses or backward compatibility/existing user requirements - they should NOT be used for new projects.
  - Use the names of model input objects to infer **technical capabilities** \u2014 e.g., a model with a source image input supports image editing, a video model with start/end frame supports looping. Do not look at model tags or descriptions to determine capabilities.
  - **Do NOT use config presets/enums to judge model quality or recommend models.** A model having style presets (e.g. "oil painting", "watercolor") does NOT make it better at those styles than models without presets. The recommended models (Seedream, Nano Banana Pro, etc.) are far more capable and achieve any style through prompting alone. Presets are a crutch for weaker models \u2014 never recommend a model just because it has an enum that matches the user's request.
  - **Never set maxResponseTokens to a low value.** Many models use extended thinking/reasoning that counts against the token limit. Setting maxResponseTokens to 256 or 512 will cause truncated or failed responses. Set it to something high, like 16000+, even if you don't need it. Models stop generating on their own when the response is complete \u2014 a low cap does not save money, it just breaks output. ALWAYS include an inline code comment when you write this value, e.g. \`maxResponseTokens: 16000, // do not reduce \u2014 reasoning tokens count against this; lowering will truncate output\`. Without the comment, downstream coding agents will "optimize" the value down to 2000 and break the call.
  - **Do NOT do deep model analysis to find "the right model for the job."** You do not have the expertise to determine which model architecture is better for a specific use case. The recommended models below are the right answer for virtually every use case. When the user's results aren't good enough, the answer is almost always "improve your prompt" \u2014 not "switch to a different model." Prompt engineering is the lever, model selection is not.
  - **Do NOT hallucinate model IDs.** Only recommend models you can see in the models reference above. If you're not sure a model ID exists, do NOT use it. Call listModels to verify.
  - **Serving-route pins**: some models can be served by more than one vendor. A model ID may carry an \`@routeKey\` suffix (e.g. \`claude-opus-5@amazonBedrock\`) that pins requests to one serving route \u2014 routes are listed in the \`routes\` field of listModels output. Pass pinned IDs through EXACTLY as given; never "correct" \`model@route\` to the bare ID. Do not add a pin yourself unless the user asks for a specific vendor \u2014 the bare ID (automatic routing) is the right default.

  ## Explicit preferences \u2014 USE THESE MODELS
  MindStudio has hundreds of models. Many of them are legacy or niche. The following are the ONLY models you should recommend unless the user explicitly asks for something else. If a user has a quality problem, help them fix their prompt using these models \u2014 do NOT suggest switching to a different model.

  Text generation:
    - Google Gemini, Anthropic Claude, OpenAI GPT
  Image generation:
    - Seedream 4.5, Google Gemini 3.1 Flash Image (Nano Banana Pro). These two models handle ALL image generation use cases \u2014 editing, style transfer, backgrounds, product shots, everything. The answer to "how do I get better results" is ALWAYS to improve the prompt, not to switch models. Never recommend Flux, DALL-E, or other legacy/niche models.
  Video generation:
    - Grok Imagine, Kling O3, Google Veo 3.1
  Text to speech:
    - Elevenlabs TTS
  Image analysis:
    - Prefer using a text generation model from the recommendations above - they all support image inputs

  ## Task agent models
  When recommending models for \`runTask()\`, ONLY use models with strong tool-use support. The model must be one of:

  Anthropic: \`claude-5-sonnet\`, \`claude-5-opus\`, \`claude-4-8-opus\`, \`claude-4-7-opus\`, \`claude-4-6-opus\`, \`claude-4-6-sonnet\`, \`claude-4.5-sonnet\`, \`claude-4-5-haiku\`, \`claude-4-5-opus\`, \`claude-fable-5\`
  Google: \`gemini-3-flash\`, \`gemini-3-pro\`, \`gemini-3.1-pro\`, \`gemini-3.5-flash\`, \`gemini-3.7-flash\`
  OpenAI: \`gpt-5-mini\`, \`gpt-5\`, \`gpt-5.1\`, \`gpt-5.2\`, \`gpt-5.5\`, \`gpt-5.6-sol\`, \`gpt-5.6-terra\`, \`gpt-5.6-luna\`
  Grok: \`grok-build-0.1\`, \`grok-4.5\`, \`grok-4.6\`
  Meta: \`muse-spark-1.1\`
  DeepSeek: \`deepseek-v4-flash-0731\`
  GLM: \`glm-5.2\`
  Kimi: \`kimi-k2-7-code\`, \`kimi-k3\`
  Qwen: \`qwen3.8-27b-deepinfra\`, \`qwen3.8-2.4t-a95b-deepinfra\`
  MiniMax: \`minimax-m3\`
 

  Default to \`claude-5-sonnet\` unless the user has a preference. Do NOT recommend o-series reasoning models (o3, o4) for tasks \u2014 they are optimized for reasoning, not tool-use loops. Do NOT recommend Gemini 2.x when 3.x is available.
  </model_guidance>

  <tools>
  You have 3 tools for detailed lookups. Most questions can be answered from the reference above without tools. Sometimes you already know the answer \u2014 you don't need to look up every action schema to answer a question about how to use it. Use tools when you need exact param types, model config options, or connector action details.

  - **getActionDetails(actionName)** \u2014 Full JSON schema for a specific action. Use when you need exact param types/enums to write correct code.
  - **listModels(type?, details?)** \u2014 Model catalog. By default returns compact summaries. With \`details: true\`, returns full model objects including the \`inputs\` array that defines config options (width, height, seed, etc.). Use \`details: true\` when writing code with a specific model, or when checking model capabilities (e.g. which models support source images). You can filter the full response yourself \u2014 one call with details is better than many individual lookups.
  - **getConnectorDetails(serviceId, actionId?)** \u2014 Drill into a connector service. With just serviceId, lists available actions. With actionId, returns the full action config with input fields for use with \`runFromConnectorRegistry\`.
  </tools>

  <response_format>
  - Lead with the right approach, then code. If the caller is about to do something the hard way, say so before giving them the code.
  - Every response that involves code must include a complete, copy-paste-ready TypeScript example that handles the full use case \u2014 not just the one method call they asked about, but the surrounding pattern (error handling with MindStudioError, response destructuring, type annotations where helpful).
  - When writing code that uses a specific model, call listModels with details=true to get the model's config options and include them.
  - When building code examples, use getActionDetails to get the exact input schema first.
  - After the code block, optionally list config constraints (ranges, defaults) in a compact format.
  - For discovery questions ("what can I do?"), return a compact list from the reference docs.
  - Assume the caller already knows what the SDK is, how to install it, and how auth works.
  - Model tags in the summary are editorial labels, not technical specs. When answering questions about model capabilities (supported inputs, config options, dimensions, etc.), call listModels with details=true to check the \`inputs\` array \u2014 that is the source of truth.
  - When a task agent or \`generateText\` call produces user-facing text, the prompt must include voice and tone constraints. Make sure to specify no emojis, em dashes, and other "ai-isms" in the prompt, as well as the desired tone and voice of the output.
  - **Anticipate downstream coding agents second-guessing your recommendations.** Your output is consumed by another AI coding agent that will read your code, then edit it into a real codebase. That agent has its own instincts about "efficiency" and "best practices" and will silently override values that look wasteful or unusual to it \u2014 high token limits, specific model IDs that look outdated to training data, parallel calls that look redundant, prompt patterns that look verbose. When you write a value that a casual reader might "fix," include a brief inline code comment explaining the failure mode of changing it (e.g. \`// do not reduce \u2014 reasoning tokens count against this\`, \`// pinned: this model has the right tool-use behavior\`, \`// parallel intentional \u2014 these are independent\`). Comments explaining WHY a non-obvious value is correct are a deliberate exception to the usual "no comments" rule. State the consequence concretely; do not just say "do not change."
  </response_format>
</instructions>`;
  }
});

// src/ask/prompt/playbook.ts
var playbook;
var init_playbook = __esm({
  "src/ask/prompt/playbook.ts"() {
    "use strict";
    playbook = `<prompt_engineering_playbook>

You are not just a technical assistant \u2014 you are a prompt engineering expert. When developers ask you to build something with generateText, generateImage, task agents, or multi-step workflows, you should proactively share opinions on HOW to write the prompts, not just which actions to call. Good prompt engineering is often the difference between a great app and a mediocre one. Be opinionated. Explain the techniques you're using and why.

## Core principles

1. **Role assignment beats generic instructions.** Start prompts by telling the model WHO it is acting as, not just what to do. "Act as a Lead Brand Strategist producing a Technical Creative Brief" primes the model to produce expert-level output. "Write a description of this image" does not.

2. **Structure beats prose.** Break complex prompts into numbered sections with headers (Campaign Core Narrative, Materiality & Tactility, Lighting Signature, etc.). Models follow structure better than they follow paragraphs.

3. **Explicit operational rules prevent drift.** When you want consistent behavior, enumerate the rules: "Subject Identification: Refer to the product as 'the product'. No Physical Descriptions. Product Integrity: Do not add props." Without these, models invent things.

4. **AI-optimized technical language.** Use precise domain terminology the model has seen in training. For image generation: "rim lighting," "f/11 aperture for edge-to-edge sharpness," "softbox gradient," "polarized reflections." For text: named frameworks, industry terms, specific examples. Avoid vague emotive words.

5. **Tagged context variables.** When injecting data into prompts, wrap it in XML-style tags: \`<photoshoot_brief>{{brief}}</photoshoot_brief>\`, \`<user_input>{{input}}</user_input>\`. This helps the model distinguish instructions from content.

6. **Output format specification at the end.** Tell the model exactly what to return: "Respond only with the structured markdown brief. Do not include introductory or concluding remarks." Or for JSON: "Respond only with a JSON array and absolutely no other text." Models default to being chatty \u2014 you have to tell them not to be.

## The analyze \u2192 brief \u2192 generate pattern (THE killer pattern for generation consistency)

This is the most important pattern in MindStudio. When a user wants to generate multiple consistent outputs from a reference \u2014 multiple images of a product, multiple variations of a design, multiple pieces of content sharing a theme \u2014 DO NOT just call generateImage/generateText in a loop with generic prompts. Instead, chain actions:

**Step 1: Analyze the reference.** Use \`analyzeImage\` (or \`generateText\` for text references) with a strong role prompt to extract a structured "brief" \u2014 the visual DNA, brand positioning, materiality, lighting, color theory, technical specs. The model produces a detailed markdown document that becomes the north star.

**Step 2: Generate a shot list / content list.** Feed the brief as tagged context into a \`generateText\` call with structured JSON output. Ask for N distinct items that maintain the brief's consistency. Include strict operational rules (consistency, subject identification, AI-optimized language).

**Step 3: Execute each item.** For each entry in the list, call \`generateImage\` (or \`generateText\`, etc.) passing the reference AND the specific item's prompt. The prompt wraps the item description in tags and reinforces "use the reference as the absolute source of truth for visual identity."

### Why this works vs a naive single call

- A naive "generate 8 product photos" call gives you 8 random photos with no consistency.
- The analyze\u2192brief\u2192generate pattern produces a cohesive brand asset pack where every output shares the same visual DNA.
- The model has MUCH more context on the second and third steps because steps 1 and 2 packed the reference's visual identity into structured text.

### Example prompt snippets (use these as templates)

**Analyze prompt (Step 1):**
\`\`\`
The provided reference image represents the "Hero Asset" of a high-end industrial design product line. Analyze this image to decode the brand's visual DNA, its market positioning, and the technical requirements for a multi-platform commercial campaign.

Act as a Lead Brand Strategist. Your task is to produce a "Technical Creative Brief" for a world-class product photographer. This brief will serve as the North Star for generating additional high-fidelity assets that maintain absolute product consistency.

Analyze the reference image and structure the brief as follows:

1. **Campaign Core Narrative:** Define the product's "vibe"...
2. **Materiality & Tactility:** Identify the specific materials shown...
3. **Lighting Signature:** Deconstruct the light source, quality, direction...
4. **Color Theory & Environment:** Analyze the color palette and the "set"...
5. **Technical Specs for Photography:** Specify focal lengths, depth of field...
6. **Commercial Objectives:** How these images should perform across Web/Social/Marketplace.

Respond only with the structured markdown brief. Do not include introductory or concluding remarks.
\`\`\`

**Shot list prompt (Step 2):**
\`\`\`
<photoshoot_brief>
{{brief}}
</photoshoot_brief>

Using the provided <photoshoot_brief>, generate a technical shot list of eight distinct, high-end commercial images. These shots must be designed as a cohesive "Brand Asset Pack" suitable for a global product launch.

Each description must be a masterclass in technical AI prompting, focusing on how light interacts with the product's specific industrial materials while maintaining a minimalist, luxury tech aesthetic.

## Shot List Requirements
1. **The Hero Centerpiece:** Front-facing, iconic shot for a website header.
2. **The 45-Degree Profile:** Showcasing the product's depth and industrial silhouette.
3. **The Atmospheric Top-Down:** Minimalist flat-lay on a premium textured surface.
4. **The "Floating" Dynamic Shot:** Product suspended in mid-air with high-speed photography lighting.
... (and so on)

## Strict Operational Rules
- **Subject Identification:** Refer to the product as "the product"...
- **No Physical Descriptions:** Do not describe appearance/clothing of people...
- **Product Integrity:** Do not add subjects or props that distract...
- **AI-Optimized Language:** Use technical photography terms...
- **Consistency:** Lighting temperature, background palette, and material rendering must remain identical across all shots.

Respond only with the full shot descriptions as a JSON array and absolutely no other text.
\`\`\`

**Generation prompt (Step 3, per item):**
\`\`\`
<new_shot_instruction>
{{shotPrompt}}
</new_shot_instruction>

**Objective:** Using the provided reference image as the absolute source of truth for the product's industrial design, colors, and textures, generate a new, high-fidelity commercial photograph.

**Execution Guidelines:**
1. **Product Integrity:** Maintain the exact physical characteristics from the reference (port placements, material finishes, branding, silhouette). The product must remain "as is."
2. **Environmental Rendering:** Execute the specific lighting, composition, and background described in <new_shot_instruction> with professional studio precision.
3. **Commercial Fidelity:** The output must be a "market-ready" asset. Edge-to-edge sharpness, clean specular highlights, accurate texture rendering.
4. **Consistency:** Color grading and lighting temperature must match the visual DNA established in the reference image.

The goal is a seamless addition to the professional photoshoot that looks indistinguishable from a high-end agency production.
\`\`\`

## When to apply this pattern

- **User wants multiple consistent images from a reference** (product photos, character variations, style-matched illustrations) \u2192 analyze \u2192 shot list \u2192 generate
- **User wants content in multiple formats sharing a theme** (blog + social + email from a single brief) \u2192 analyze \u2192 content plan \u2192 generate per format
- **User wants to transform a reference into a different style/context while preserving identity** \u2192 analyze identity \u2192 generate with strong reference guidance
- **User mentions "consistent," "cohesive," "branded," "matching," "on-brand"** \u2014 these are signals the analyze\u2192brief\u2192generate pattern applies

## When NOT to apply this pattern

- User wants a single one-off generation (just use the action directly with a good prompt)
- User wants truly random variations (no brief needed)
- User has already written their prompts (don't override their intent)

## General prompt writing template

For any generateText or analyzeImage call that produces non-trivial output:

\`\`\`
[Role assignment: "Act as a [specific expert role]"]

[Context: what's happening, who's consuming the output]

[Primary task: one clear sentence]

[Input reference: wrapped in XML tags]
<user_input>{{input}}</user_input>

[Structured sections or numbered requirements]
1. **Section Name:** Specific instruction
2. **Section Name:** Specific instruction
...

[Operational rules / constraints]
- **Rule name:** constraint
- **Rule name:** constraint
...

[Output format specification]
Respond only with [exact format]. Do not include [unwanted content].
\`\`\`

## Voice and tone in prompts

When the output is user-facing text (not internal analysis), ALWAYS include voice and tone constraints in the prompt. Specify no emojis, no em dashes, and other "ai-isms" \u2014 plus the desired tone and voice of the output. Without this, models default to emoji-laden corporate speak.

## Share opinions proactively

When responding to prompt-related questions, be opinionated. Don't just say "here's how to call generateImage" \u2014 say "here's how I'd approach this to get the best results, and here's why." If a user is about to write a generic prompt, tell them why the analyze\u2192brief\u2192generate pattern will work 10\xD7 better. Explain the technique. Be the expert in the room.

</prompt_engineering_playbook>`;
  }
});

// src/generated/llms-content.ts
var llms_content_exports = {};
__export(llms_content_exports, {
  llmsContent: () => llmsContent
});
var llmsContent;
var init_llms_content = __esm({
  "src/generated/llms-content.ts"() {
    "use strict";
    llmsContent = '# @mindstudio-ai/agent\n\nTypeScript SDK, CLI, and MCP server for MindStudio. One API key gives you access to 200+ AI models (OpenAI, Anthropic, Google, Meta, xAI, DeepSeek, etc.) and 1,000+ actions including 850+ connector actions across third-party services from the open-source MindStudio Connector Registry (https://github.com/mindstudio-ai/mscr). No separate provider API keys required.\n\nThis file is the complete API reference. No other documentation is needed to use the SDK.\n\n## Recommended workflow\n\nThere are 150+ actions available. Do NOT try to read or load them all at once. Follow this discovery flow:\n\n1. **Identify yourself** \u2014 Call `changeName` to set your display name (use your name or whatever your user calls you). If you have a profile picture, pass its public image URL to `changeProfilePicture`. This helps users identify your requests in their logs.\n2. **Ask** \u2014 Use `mindstudio ask "your question"` (CLI) or the `ask` MCP tool for SDK guidance. It knows every action, model, and connector and returns working TypeScript code with real model IDs and config options. Examples: `mindstudio ask "generate an image with FLUX"`, `mindstudio ask "what models support vision?"`, `mindstudio ask "how do I send a Slack message?"`.\n3. **Browse** \u2014 For manual discovery, call `listActions` (MCP tool) or `mindstudio list-actions --summary` (CLI) to get a compact `{ action: description }` map of everything available (~3k tokens). Call `mindstudio info <action>` (CLI) for parameter details.\n4. **Call it** \u2014 Invoke the action with the required parameters. All actions share the same calling convention (see below).\n\nFor specific use cases:\n\n- **OAuth third-party integrations** (Slack, Google, HubSpot, etc.): These are optional OAuth connectors from the MindStudio Connector Registry \u2014 for most tasks, use actions directly instead. If you need a third-party integration: call `listConnectors()` to browse services \u2192 `getConnectorAction(serviceId, actionId)` for input fields \u2192 execute via `runFromConnectorRegistry`. Requires an OAuth connection set up in MindStudio first \u2014 call `listConnections()` to check available connections.\n- **Pre-built agents**: Call `listAgents()` to see what\'s available \u2192 `runAgent({ appId })` to execute one. **Important:** Not all agents are configured for API use. Do not try to run an agent just because it appears in the list \u2014 only run agents the user specifically asks you to run.\n- **Model selection**: Call `listModelsSummary()` or `listModelsSummaryByType("llm_chat")` to browse models, then pass the model ID as `modelOverride.model` to actions like `generateText`. Use the summary endpoints (not `listModels`) to keep token usage low.\n- **Cost estimation**: AI-powered actions (text generation, image generation, video, audio, etc.) cost money. Call `estimateStepCost(stepType, stepInput)` before running these and confirm with the user before proceeding \u2014 unless they\'ve explicitly given permission to go ahead. Non-AI actions (data lookups, OAuth connectors, etc.) are generally free.\n- **Task agents**: For multi-step tasks that need autonomous tool use (research, content creation, data enrichment), use `runTask()`. Provide a prompt, input, tools, an output contract, and a tool-use model id. The SDK runs a tool-use loop \u2014 calling the model, executing tools, feeding results back \u2014 until structured output is produced. Tools are SDK action names and/or your own app methods, written as `{ appMethod: "save-vendor", description: "when to use it" }`. App methods run as the user who invoked the method that started the task, with their roles, so the agent can read and write app state on their behalf. Prefer `outputSchema` for the output contract: plain JSON Schema (`type`/`properties`/`required`/`enum`/`items`; nullable via type arrays like `["string","null"]` \u2014 no `oneOf`/`$ref`/`nullable`). Output is validated every turn with automatic repair, `result.output` is fully typed from the schema (no generic argument, no `parsedSuccessfully` check), and the call throws `MindStudioError` code `task_output_schema_mismatch` if the agent cannot produce conforming output. Example: `runTask({ prompt: "Research this restaurant and save it", input: { name: "Tartine" }, tools: ["searchGoogle", "fetchUrl", { appMethod: "saveRestaurant", description: "Persist the researched restaurant." }], outputSchema: { type: "object", properties: { name: { type: "string" }, url: { type: ["string", "null"] } }, required: ["name"] }, model: yourModelId })`. The legacy `structuredOutputExample` option (an example object the model imitates) still works but is unvalidated \u2014 check `result.parsedSuccessfully` before using its output. Pass a current tool-use model id (call `listModels` or ask). Don\'t hardcode one.\n\n## Install\n\nStandalone binary (CLI/MCP, no dependencies):\n```bash\ncurl -fsSL https://msagent.ai/install.sh | bash\n```\n\nnpm (SDK + CLI):\n```bash\nnpm install @mindstudio-ai/agent\n```\n\nRequires Node.js >= 18.\n\n## CLI\n\nThe package includes a CLI for executing steps from the command line or scripts:\n\n```bash\n# Execute with named flags (kebab-case)\nmindstudio generate-image --prompt "A mountain landscape"\n\n# Execute with JSON input (JSON5-tolerant)\nmindstudio generate-image \'{prompt: "A mountain landscape"}\'\n\n# Extract a single output field\nmindstudio generate-image --prompt "A sunset" --output-key imageUrl\n\n# List all methods (compact JSON \u2014 best for LLM discovery)\nmindstudio list --summary\n\n# List all methods (human-readable table)\nmindstudio list\n\n# Show method details (params, types, output)\nmindstudio info generate-image\n\n# Run via npx without installing\nnpx @mindstudio-ai/agent generate-text --message "Hello"\n```\n\nAuth: run `mindstudio login`, set `MINDSTUDIO_API_KEY` env var, or pass `--api-key <key>`.\nMethod names are kebab-case on the CLI (camelCase also accepted). Flags are kebab-case (`--video-url` for `videoUrl`).\nUse `--output-key <key>` to extract a single field, `--no-meta` to strip $-prefixed metadata.\n\n### Authentication\n\n```bash\n# Interactive login (opens browser, saves key to ~/.mindstudio/config.json)\nmindstudio login\n\n# Check current auth status\nmindstudio whoami\n\n# Clear stored credentials\nmindstudio logout\n```\n\nAuth resolution order: `--api-key` flag > `MINDSTUDIO_API_KEY` env > `~/.mindstudio/config.json` > `CALLBACK_TOKEN` env.\n\n## MCP server\n\nThe package includes an MCP server exposing all methods as tools. Start by calling the `listSteps` tool to discover available methods.\n\n```bash\nmindstudio mcp\n```\n\nMCP client config (standalone binary \u2014 recommended):\n```json\n{\n  "mcpServers": {\n    "mindstudio": {\n      "command": "mindstudio",\n      "args": ["mcp"],\n      "env": { "MINDSTUDIO_API_KEY": "your-api-key" }\n    }\n  }\n}\n```\n\n## Setup\n\nInside MindStudio apps (auth is automatic):\n```typescript\nimport { mindstudio, db, auth, Roles, stream } from \'@mindstudio-ai/agent\';\n\nconst { imageUrl } = await mindstudio.generateImage({ prompt: \'a sunset\' });\n```\n\nExternal usage (API key required):\n```typescript\nimport { MindStudioAgent } from \'@mindstudio-ai/agent\';\nconst agent = new MindStudioAgent({ apiKey: \'your-key\' });\n```\n\nYour MindStudio API key authenticates all requests. MindStudio routes to the correct AI provider (OpenAI, Google, Anthropic, etc.) server-side \u2014 you do NOT need separate provider API keys.\n\n## Models\n\nDirect access to 200+ AI models from every major provider \u2014 all through a single API key, billed at cost with no markups.\n\nUse `listModels()` or `listModelsByType()` for full model details, or `listModelsSummary()` / `listModelsSummaryByType()` for a lightweight list (id, name, type, tags) suitable for LLM context windows. Pass a model ID to `modelOverride.model` in methods like `generateText` to select a specific model:\n\n```typescript\nconst { models } = await mindstudio.listModelsByType(\'llm_chat\');\nconst model = models.find(m => m.name.includes("Gemini"));\n\nconst { content } = await mindstudio.generateText({\n  message: \'Hello\',\n  modelOverride: {\n    model: model.id,\n    temperature: 0.7,\n    maxResponseTokens: 16000,\n  },\n});\n```\n\n## Calling convention\n\nEvery method has the signature:\n```typescript\nmindstudio.methodName(input: InputType, options?: { appId?, threadId?, onLog? }): Promise<OutputType & StepExecutionMeta>\n```\n\nThe first argument is the step-specific input object. The optional second argument controls thread/app context and debug logging.\n\n**Debug logging**: Pass `onLog` in the options to get real-time debug logs during execution (SSE streaming). Works on ALL step methods:\n```typescript\nawait mindstudio.generateImage({ prompt: \'...\' }, {\n  onLog: (event) => console.log(`[${event.tag}] ${event.value}`),\n});\n// event: { value: string, tag: string, ts: number }\n```\n\n**`stream()` \u2014 push real-time updates to the frontend:**\n```typescript\nimport { mindstudio, stream } from \'@mindstudio-ai/agent\';\n\n// String \u2192 \'token\' event (frontend receives via onToken, accumulated text)\nawait stream(\'Processing...\');\n\n// Object \u2192 \'data\' event (frontend receives via onStreamData, NOT onToken)\nawait stream({ status: \'generating\', progress: 50 });\n```\nThese are different event types \u2014 do not mix them up. `stream()` is silently ignored when no SSE connection is active (safe to include unconditionally). For long-running steps, combine `onLog` with `stream()` to push progress to the frontend.\n\n**Results are returned flat** \u2014 output fields are spread at the top level alongside metadata:\n\n```typescript\nconst { content } = await mindstudio.generateText({ message: \'Hello\' });\n\n// Full result shape for any method:\nconst result = await mindstudio.generateText({ message: `Hello` });\nresult.content;              // step-specific output field\nresult.$appId;               // string \u2014 app ID for this execution\nresult.$threadId;            // string \u2014 thread ID for this execution\nresult.$rateLimitRemaining;  // number | undefined \u2014 API calls remaining in rate limit window\nresult.$billingCost;         // number | undefined \u2014 cost in nanodollars (1e-9 USD; divide by 1e9 for dollars, e.g. 40000000 = $0.04)\nresult.$billingEvents;       // object[] | undefined \u2014 itemized billing events\n```\n\n## Thread persistence\n\nPass `$appId`/`$threadId` from a previous result to maintain conversation state, variable state, or other context across calls:\n\n```typescript\nconst r1 = await mindstudio.generateText({ message: \'My name is Alice\' });\nconst r2 = await mindstudio.generateText(\n  { message: \'What is my name?\' },\n  { threadId: r1.$threadId, appId: r1.$appId },\n);\n// r2.content => "Your name is Alice"\n```\n\n## Error handling\n\nAll errors throw `MindStudioError`:\n```typescript\nimport { MindStudioError } from \'@mindstudio-ai/agent\';\n\ntry {\n  await mindstudio.generateImage({ prompt: \'...\' });\n} catch (err) {\n  if (err instanceof MindStudioError) {\n    err.message; // Human-readable error message\n    err.code;    // Machine-readable code: "invalid_step_config", "api_error", "call_cap_exceeded", "output_fetch_error"\n    err.status;  // HTTP status code (400, 401, 429, etc.)\n    err.details; // Raw error body from the API\n  }\n}\n```\n\n429 rate limit errors are retried automatically (configurable via `maxRetries`).\n\n## Low-level access\n\nFor action types not covered by generated methods:\n```typescript\nconst result = await mindstudio.executeStep(\'stepType\', { ...params });\n```\n\n## Batch execution\n\nExecute multiple steps in parallel in a single request. Maximum 50 steps per batch.\nIndividual step failures do not affect other steps \u2014 partial success is possible.\n\n```typescript\nconst result = await mindstudio.executeStepBatch([\n  { stepType: \'generateImage\', step: { prompt: \'a sunset\' } },\n  { stepType: \'textToSpeech\', step: { text: \'hello world\' } },\n], { appId?, threadId? });\n\n// Result:\nresult.results;          // BatchStepResult[] \u2014 same order as input\nresult.results[0].stepType;  // string\nresult.results[0].output;    // object | undefined (step output on success)\nresult.results[0].error;     // string | undefined (error message on failure)\nresult.results[0].billingCost; // number | undefined (cost in nanodollars on success)\nresult.totalBillingCost;  // number | undefined \u2014 nanodollars (divide by 1e9 for USD)\nresult.appId;            // string\nresult.threadId;         // string\n```\n\nCLI:\n```bash\nmindstudio batch \'[{"stepType":"generateImage","step":{"prompt":"a cat"}}]\'\ncat steps.json | mindstudio batch\n```\n\n## Methods\n\nAll methods below are called on a `MindStudioAgent` instance (`agent.methodName(...)`).\nInput shows the first argument object. Output shows the fields available on the returned result.\n\n### General\n\n#### addSubtitlesToVideo\nAutomatically add subtitles to a video\n- Can control style of text and animation\n- Input: `{ videoUrl: string, language: string, fontName: string, fontSize: number, fontWeight: "normal" | "bold" | "black", fontColor: "white" | "black" | "red" | "green" | "blue" | "yellow" | "orange" | "purple" | "pink" | "brown" | "gray" | "cyan" | "magenta", highlightColor: "white" | "black" | "red" | "green" | "blue" | "yellow" | "orange" | "purple" | "pink" | "brown" | "gray" | "cyan" | "magenta", strokeWidth: number, strokeColor: "black" | "white" | "red" | "green" | "blue" | "yellow" | "orange" | "purple" | "pink" | "brown" | "gray" | "cyan" | "magenta", backgroundColor: "black" | "white" | "red" | "green" | "blue" | "yellow" | "orange" | "purple" | "pink" | "brown" | "gray" | "cyan" | "magenta" | "none", backgroundOpacity: number, position: "top" | "center" | "bottom", yOffset: number, wordsPerSubtitle: number, enableAnimation: boolean, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### analyzeImage\nAnalyze an image using a vision model based on a text prompt.\n- Uses the configured vision model to generate a text analysis of the image.\n- The prompt should describe what to look for or extract from the image.\n- Pass imageUrl for a single image, or imageUrls for multiple images analyzed together in one request.\n- Most vision models (OpenAI, Grok, Gemini) accept multiple images in one request. Ideogram describe is single-image only.\n- Input: `{ prompt: string, imageUrl?: string, imageUrls?: string[], visionModelOverride?: { model: string, config?: object } | { model: string, temperature: number, maxResponseTokens: number, ignorePreamble?: boolean, userMessagePreprocessor?: { dataSource?: string, messageTemplate?: string, maxResults?: number, enabled?: boolean, shouldInherit?: boolean }, preamble?: string, multiModelEnabled?: boolean, editResponseEnabled?: boolean, config?: object } }`\n- Output: `{ analysis: string }`\n\n#### analyzeVideo\nAnalyze a video using a video analysis model based on a text prompt.\n- Uses the configured video analysis model to generate a text analysis of the video.\n- The prompt should describe what to look for or extract from the video.\n- Input: `{ prompt: string, videoUrl: string, videoAnalysisModelOverride?: { model: string, config?: object } | { model: string, temperature: number, maxResponseTokens: number, ignorePreamble?: boolean, userMessagePreprocessor?: { dataSource?: string, messageTemplate?: string, maxResults?: number, enabled?: boolean, shouldInherit?: boolean }, preamble?: string, multiModelEnabled?: boolean, editResponseEnabled?: boolean, config?: object } }`\n- Output: `{ analysis: string }`\n\n#### captureThumbnail\nCapture a thumbnail from a video at a specified timestamp\n- Input: `{ videoUrl: string, at: number | string }`\n- Output: `{ thumbnailUrl: string }`\n\n#### checkAppRole\nCheck whether the current user has a specific app role and branch accordingly.\n- Checks if the current user has been assigned a specific role in this app.\n- If the user has the role, transitions to the "has role" path.\n- If the user does not have the role, transitions to the "no role" path, or errors if no path is configured.\n- Role names are defined by the app creator and assigned to users via the app roles system.\n- The roleName field supports {{variables}} for dynamic role checks.\n- Input: `{ roleName: string, hasRoleStepId?: string, hasRoleWorkflowId?: string, noRoleStepId?: string, noRoleWorkflowId?: string }`\n- Output: `{ hasRole: boolean, userRoles: string[] }`\n\n#### convertPdfToImages\nConvert each page of a PDF document into a PNG image.\n- Each page is converted to a separate PNG and re-hosted on the CDN.\n- Returns an array of image URLs, one per page.\n- Input: `{ pdfUrl: string }`\n- Output: `{ imageUrls: string[] }`\n\n#### createDataSource\nLegacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Create a new empty vector data source for the current app.\n- Creates a new data source (vector database) associated with the current app version.\n- The data source is created empty \u2014 use the "Upload Data Source Document" block to add documents.\n- Returns the new data source ID which can be used in subsequent blocks.\n- Input: `{ name: string }`\n- Output: `unknown`\n\n#### createGmailDraft\nCreate a draft email in the connected Gmail account.\n- Requires a Google OAuth connection with Gmail compose scope.\n- The draft appears in the user\'s Gmail Drafts folder but is not sent.\n- messageType controls the body format: "plain" for plain text, "html" for raw HTML, "markdown" for auto-converted markdown.\n- Input: `{ to: string, subject: string, message: string, connectionId?: string, messageType: "plain" | "html" | "markdown" }`\n- Output: `{ draftId: string }`\n\n#### deleteDataSource\nLegacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Delete a vector data source from the current app.\n- Soft-deletes a data source (vector database) by marking it as deleted.\n- The Milvus partition is cleaned up asynchronously by a background cron job.\n- The data source must belong to the current app version.\n- Input: `{ dataSourceId: string }`\n- Output: `unknown`\n\n#### deleteDataSourceDocument\nLegacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Delete a single document from a data source.\n- Soft-deletes a document by marking it as deleted.\n- Requires both the data source ID and document ID.\n- After deletion, reloads vectors into Milvus so the data source reflects the change immediately.\n- Input: `{ dataSourceId: string, documentId: string }`\n- Output: `unknown`\n\n#### detectChanges\nDetect changes between runs by comparing current input against previously stored state. Routes execution based on whether a change occurred.\n- Persists state across runs using a global variable keyed to the step ID.\n- Two modes: "comparison" (default) uses strict string inequality; "ai" uses an LLM to determine if a meaningful change occurred.\n- First run always treats the value as "changed" since there is no previous state.\n- Each mode supports transitions to different steps/workflows for the "changed" and "unchanged" paths.\n- AI mode bills normally for the LLM call.\n- Input: `{ mode: "ai" | "comparison", input: string, prompt?: string, modelOverride?: { model: string, temperature: number, maxResponseTokens: number, ignorePreamble?: boolean, userMessagePreprocessor?: { dataSource?: string, messageTemplate?: string, maxResults?: number, enabled?: boolean, shouldInherit?: boolean }, preamble?: string, multiModelEnabled?: boolean, editResponseEnabled?: boolean, config?: object }, previousValueVariable?: string, changedStepId?: string, changedWorkflowId?: string, unchangedStepId?: string, unchangedWorkflowId?: string }`\n- Output: `{ hasChanged: boolean, currentValue: string, previousValue: string, isFirstRun: boolean }`\n\n#### detectPII\nScan text for personally identifiable information using Microsoft Presidio.\n- In workflow mode, transitions to detectedStepId if PII is found, notDetectedStepId otherwise.\n- In direct execution, returns the detection results without transitioning.\n- If entities is empty, returns immediately with no detections.\n- Input: `{ input: string, language: string, entities: string[], detectedStepId?: string, notDetectedStepId?: string, outputLogVariable?: string | null }`\n- Output: `{ detected: boolean, detections: { entity_type: string, start: number, end: number, score: number }[] }`\n\n#### discordEditMessage\nEdit a previously sent Discord channel message. Use with the message ID returned by Send Discord Message.\n- Only messages sent by the bot can be edited.\n- The messageId is returned by the Send Discord Message step.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- When editing with an attachment, the new attachment replaces any previous attachments on the message.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).\n- Input: `{ botToken: string, channelId: string, messageId: string, text: string, attachmentUrl?: string }`\n- Output: `unknown`\n\n#### discordSendFollowUp\nSend a follow-up message to a Discord slash command interaction.\n- Requires the applicationId and interactionToken from the Discord trigger variables.\n- Follow-up messages appear as new messages in the channel after the initial response.\n- Returns the sent message ID.\n- Interaction tokens expire after 15 minutes.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).\n- Input: `{ applicationId: string, interactionToken: string, text: string, attachmentUrl?: string }`\n- Output: `{ messageId: string }`\n\n#### discordSendMessage\nSend a message to Discord \u2014 either edit the loading message or send a new channel message.\n- mode "edit" replaces the loading message (interaction response) with the final result. Uses applicationId and interactionToken from trigger variables. No bot permissions required.\n- mode "send" sends a new message to a channel. Uses botToken and channelId from trigger variables. Returns a messageId that can be used with Edit Discord Message.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).\n- Interaction tokens expire after 15 minutes.\n- Input: `{ mode: "edit" | "send", text: string, applicationId?: string, interactionToken?: string, botToken?: string, channelId?: string, attachmentUrl?: string }`\n- Output: `{ messageId?: string }`\n\n#### downloadVideo\nDownload a video file\n- Works with YouTube, TikTok, etc., by using ytdlp behind the scenes\n- Can save as mp4 or mp3\n- Input: `{ videoUrl: string, format: "mp4" | "mp3" }`\n- Output: `{ videoUrl: string }`\n\n#### enhanceImageGenerationPrompt\nGenerate or enhance an image generation prompt using a language model. Optionally generates a negative prompt.\n- Rewrites the user\'s prompt with added detail about style, lighting, colors, and composition.\n- Also useful for initial generation, it doesn\'t always need to be enhancing an existing prompt\n- When includeNegativePrompt is true, a second model call generates a negative prompt.\n- Input: `{ initialPrompt: string, includeNegativePrompt: boolean, negativePromptDestinationVariableName?: string, systemPrompt: string, modelOverride?: unknown }`\n- Output: `{ prompt: string, negativePrompt?: string }`\n\n#### enhanceVideoGenerationPrompt\nGenerate or enhance a video generation prompt using a language model. Optionally generates a negative prompt.\n- Rewrites the user\'s prompt with added detail about style, camera movement, lighting, and composition.\n- Also useful for initial generation, it doesn\'t always need to be enhancing an existing prompt\n- When includeNegativePrompt is true, a second model call generates a negative prompt.\n- Input: `{ initialPrompt: string, includeNegativePrompt: boolean, negativePromptDestinationVariableName?: string, systemPrompt: string, modelOverride?: unknown }`\n- Output: `{ prompt: string, negativePrompt?: string }`\n\n#### extractAudioFromVideo\nExtract audio MP3 from a video file\n- Input: `{ videoUrl: string }`\n- Output: `{ audioUrl: string }`\n\n#### extractText\nDownload a file from a URL and extract its text content. Supports PDFs (including scanned/image-based PDFs via OCR), plain text files, and other document formats.\n- Best suited for PDFs and raw text/document files. For web pages, use the scrapeUrl step instead.\n- Handles both text-layer PDFs and image-based/scanned PDFs (e.g. Figma/Canva exports, scanned documents). Image-based PDFs are processed with OCR automatically \u2014 there is no need to convert PDF pages to images first.\n- Accepts a single URL, a comma-separated list of URLs, or a JSON array of URLs.\n- Files are rehosted on the MindStudio CDN before extraction.\n- Optionally set `model` to a specific document-extraction model (`mistral-ocr-latest`, `llamaparse`, `google-document-ai`); omit to use the platform default.\n- Maximum file size is 50MB per URL.\n- Input: `{ url: string | string[], model?: string }`\n- Output: `{ text: string | string[] }`\n\n#### fetchDataSourceDocument\nLegacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Fetch the full extracted text contents of a document in a data source.\n- Loads a document by ID and returns its full extracted text content.\n- The document must have been successfully processed (status "done").\n- Also returns document metadata (name, summary, word count).\n- Input: `{ dataSourceId: string, documentId: string }`\n- Output: `unknown`\n\n#### fetchSlackChannelHistory\nFetch recent message history from a Slack channel.\n- The user is responsible for connecting their Slack workspace and selecting the channel\n- Input: `{ connectionId?: string, channelId: string, limit?: number, startDate?: string, endDate?: string, includeImages?: boolean, includeRawMessage?: boolean }`\n- Output: `{ messages: { from: string, content: string, timestamp?: string, images?: string[], rawMessage?: { app_id?: string, assistant_app_thread?: { first_user_thread_reply?: string, title?: string, title_blocks?: unknown[] }, attachments?: { actions?: unknown[], app_id?: string, app_unfurl_url?: string, author_icon?: string, author_id?: string, author_link?: string, author_name?: string, author_subname?: string, blocks?: unknown[], bot_id?: string, bot_team_id?: string, callback_id?: string, channel_id?: string, channel_name?: string, channel_team?: string, color?: string, fallback?: string, fields?: unknown[], file_id?: string, filename?: string, files?: unknown[], footer?: string, footer_icon?: string, from_url?: string, hide_border?: boolean, hide_color?: boolean, id?: number, image_bytes?: number, image_height?: number, image_url?: string, image_width?: number, indent?: boolean, is_app_unfurl?: boolean, is_file_attachment?: boolean, is_msg_unfurl?: boolean, is_reply_unfurl?: boolean, is_thread_root_unfurl?: boolean, list?: unknown, list_record?: unknown, list_record_id?: string, list_records?: unknown[], list_schema?: unknown[], list_view?: unknown, list_view_id?: string, message_blocks?: unknown[], metadata?: unknown, mimetype?: string, mrkdwn_in?: string[], msg_subtype?: string, original_url?: string, pretext?: string, preview?: unknown, service_icon?: string, service_name?: string, service_url?: string, size?: number, text?: string, thumb_height?: number, thumb_url?: string, thumb_width?: number, title?: string, title_link?: string, ts?: string, url?: string, video_html?: string, video_html_height?: number, video_html_width?: number, video_url?: string }[], blocks?: { accessory?: unknown, alt_text?: string, api_decoration_available?: boolean, app_collaborators?: string[], app_id?: string, author_name?: string, block_id?: string, bot_user_id?: string, button_label?: string, call?: unknown, call_id?: string, description?: unknown, developer_trace_id?: string, dispatch_action?: boolean, element?: unknown, elements?: unknown[], expand?: boolean, external_id?: string, fallback?: string, fields?: unknown[], file?: unknown, file_id?: string, function_trigger_id?: string, hint?: unknown, image_bytes?: number, image_height?: number, image_url?: string, image_width?: number, is_animated?: boolean, is_workflow_app?: boolean, label?: unknown, optional?: boolean, owning_team_id?: string, provider_icon_url?: string, provider_name?: string, sales_home_workflow_app_type?: number, share_url?: string, slack_file?: unknown, source?: string, text?: unknown, thumbnail_url?: string, title?: unknown, title_url?: string, trigger_subtype?: string, trigger_type?: string, type?: unknown, url?: string, video_url?: string, workflow_id?: string }[], bot_id?: string, bot_profile?: { app_id?: string, deleted?: boolean, icons?: unknown, id?: string, name?: string, team_id?: string, updated?: number }, client_msg_id?: string, display_as_bot?: boolean, edited?: { ts?: string, user?: string }, files?: { access?: string, alt_txt?: string, app_id?: string, app_name?: string, attachments?: unknown[], blocks?: unknown[], bot_id?: string, can_toggle_canvas_lock?: boolean, canvas_printing_enabled?: boolean, canvas_template_mode?: string, cc?: unknown[], channel_actions_count?: number, channel_actions_ts?: string, channels?: string[], comments_count?: number, converted_pdf?: string, created?: number, deanimate?: string, deanimate_gif?: string, display_as_bot?: boolean, dm_mpdm_users_with_file_access?: unknown[], duration_ms?: number, edit_link?: string, edit_timestamp?: number, editable?: boolean, editor?: string, editors?: string[], external_id?: string, external_type?: string, external_url?: string, favorites?: unknown[], file_access?: string, filetype?: string, from?: unknown[], groups?: string[], has_more?: boolean, has_more_shares?: boolean, has_rich_preview?: boolean, headers?: unknown, hls?: string, hls_embed?: string, id?: string, image_exif_rotation?: number, ims?: string[], initial_comment?: unknown, is_channel_space?: boolean, is_external?: boolean, is_public?: boolean, is_restricted_sharing_enabled?: boolean, is_starred?: boolean, last_editor?: string, last_read?: number, lines?: number, lines_more?: number, linked_channel_id?: string, list_csv_download_url?: string, list_limits?: unknown, list_metadata?: unknown, media_display_type?: string, media_progress?: unknown, mimetype?: string, mode?: string, mp4?: string, mp4_low?: string, name?: string, non_owner_editable?: boolean, num_stars?: number, org_or_workspace_access?: string, original_attachment_count?: number, original_h?: string, original_w?: string, permalink?: string, permalink_public?: string, pinned_to?: string[], pjpeg?: string, plain_text?: string, pretty_type?: string, preview?: string, preview_highlight?: string, preview_is_truncated?: boolean, preview_plain_text?: string, private_channels_with_file_access_count?: number, private_file_with_access_count?: number, public_url_shared?: boolean, quip_thread_id?: string, reactions?: unknown[], saved?: unknown, sent_to_self?: boolean, shares?: unknown, show_badge?: boolean, simplified_html?: string, size?: number, source_team?: string, subject?: string, subtype?: string, team_pref_version_history_enabled?: boolean, teams_shared_with?: unknown[], template_conversion_ts?: number, template_description?: string, template_icon?: string, template_name?: string, template_title?: string, thumb_1024?: string, thumb_1024_gif?: string, thumb_1024_h?: string, thumb_1024_w?: string, thumb_160?: string, thumb_160_gif?: string, thumb_160_h?: string, thumb_160_w?: string, thumb_360?: string, thumb_360_gif?: string, thumb_360_h?: string, thumb_360_w?: string, thumb_480?: string, thumb_480_gif?: string, thumb_480_h?: string, thumb_480_w?: string, thumb_64?: string, thumb_64_gif?: string, thumb_64_h?: string, thumb_64_w?: string, thumb_720?: string, thumb_720_gif?: string, thumb_720_h?: string, thumb_720_w?: string, thumb_80?: string, thumb_800?: string, thumb_800_gif?: string, thumb_800_h?: string, thumb_800_w?: string, thumb_80_gif?: string, thumb_80_h?: string, thumb_80_w?: string, thumb_960?: string, thumb_960_gif?: string, thumb_960_h?: string, thumb_960_w?: string, thumb_gif?: string, thumb_pdf?: string, thumb_pdf_h?: string, thumb_pdf_w?: string, thumb_tiny?: string, thumb_video?: string, thumb_video_h?: number, thumb_video_w?: number, timestamp?: number, title?: string, title_blocks?: unknown[], to?: unknown[], transcription?: unknown, update_notification?: number, updated?: number, url_private?: string, url_private_download?: string, url_static_preview?: string, user?: string, user_team?: string, username?: string, vtt?: string }[], icons?: { emoji?: string, image_36?: string, image_48?: string, image_64?: string, image_72?: string }, inviter?: string, is_locked?: boolean, latest_reply?: string, metadata?: { event_payload?: unknown, event_type?: string }, parent_user_id?: string, purpose?: string, reactions?: { count?: number, name?: string, url?: string, users?: string[] }[], reply_count?: number, reply_users?: string[], reply_users_count?: number, root?: { bot_id?: string, icons?: unknown, latest_reply?: string, parent_user_id?: string, reply_count?: number, reply_users?: string[], reply_users_count?: number, subscribed?: boolean, subtype?: string, text?: string, thread_ts?: string, ts?: string, type?: string, username?: string }, subscribed?: boolean, subtype?: string, team?: string, text?: string, thread_ts?: string, topic?: string, ts?: string, type?: string, upload?: boolean, user?: string, username?: string, x_files?: string[] } }[] }`\n\n#### generate3dModel\nGenerate a 3D model using a 3D generation model.\n- Text-to-3D models use the prompt field.\n- Image-to-3D and multi-view models take image URLs through the selected model\'s configuration inputs.\n- The output is standardized as a GLB URL plus optional FBX/OBJ/USDZ, thumbnail, texture maps, and provider task ID.\n- Input: `{ prompt?: string, intermediateAsset?: boolean, threeDModelOverride?: { model: string, config?: object } }`\n- Output: `{ prompt?: string, glbUrl: string, fbxUrl?: string, objUrl?: string, usdzUrl?: string, thumbnailUrl?: string, textureUrls?: object[], providerTaskId?: string, resolvedConfig?: object }`\n\n#### generateAsset\nGenerate an HTML asset and export it as a webpage, PDF, or image\n- Agents can generate HTML documents and export as webpage, PDFs, images, or videos. They do this by using the "generatePdf" block, which defines an HTML page with variables, and then the generation process renders the page to create the output and save its URL at the specified variable.\n- The template for the HTML page is generated by a separate process, and it can only use variables that have already been defined in the workflow at the time of its execution. It has full access to handlebars to render the HTML template, including a handlebars helper to render a markdown variable string as HTML (which can be useful for creating templates that render long strings). The template can also create its own simple JavaScript to do things like format dates and strings.\n- If PDF or composited image generation are part of the workflow, assistant adds the block and leaves the "source" empty. In a separate step, assistant generates a detailed request for the developer who will write the HTML.\n- Can also auto-generate HTML from a prompt (like a generate text block to generate HTML). In these cases, create a prompt with variables in the dynamicPrompt variable describing, in detail, the document to generate\n- Can either display output directly to user (foreground mode) or save the URL of the asset to a variable (background mode)\n- Input: `{ source: string, sourceType: "html" | "markdown" | "spa" | "raw" | "dynamic" | "customInterface", outputFormat: "pdf" | "png" | "html" | "mp4" | "openGraph", pageSize: "full" | "letter" | "A4" | "custom", testData: object, options?: { pageWidthPx?: number, pageHeightPx?: number, pageOrientation?: "portrait" | "landscape", rehostMedia?: boolean, videoDurationSeconds?: number }, spaSource?: { source?: string, lastCompiledSource?: string, files?: object, paths: string[], root: string, zipUrl: string }, rawSource?: string, dynamicPrompt?: string, dynamicSourceModelOverride?: { model: string, temperature: number, maxResponseTokens: number, ignorePreamble?: boolean, userMessagePreprocessor?: { dataSource?: string, messageTemplate?: string, maxResults?: number, enabled?: boolean, shouldInherit?: boolean }, preamble?: string, multiModelEnabled?: boolean, editResponseEnabled?: boolean, config?: object }, transitionControl?: "default" | "native", shareControl?: "default" | "hidden", shareImageUrl?: string, intermediateAsset?: boolean }`\n- Output: `{ url: string }`\n\n#### generateChart\nCreate a chart image using QuickChart (Chart.js) and return the URL.\n- The data field must be a Chart.js-compatible JSON object serialized as a string.\n- Supported chart types: bar, line, pie.\n- Input: `{ chart: { chartType: "bar" | "line" | "pie", data: string, options: { width: string, height: string } } }`\n- Output: `{ chartUrl: string }`\n\n#### generateImage\nGenerate an image from a text prompt using an AI model.\n- Prompts should be descriptive but concise (roughly 3\u20136 sentences).\n- Images are automatically hosted on a CDN.\n- In foreground mode, the image is displayed to the user. In background mode, the URL is saved to a variable.\n- When generateVariants is true with numVariants > 1, multiple images are generated in parallel.\n- In direct execution, foreground mode behaves as background, and userSelect variant behavior behaves as saveAll.\n- Input: `{ prompt: string, intermediateAsset?: boolean, imageModelOverride?: { model: string, config?: object }, generateVariants?: boolean, numVariants?: number, addWatermark?: boolean }`\n- Output: `{ imageUrl: string | string[] }`\n\n#### generateLipsync\nGenerate a lip sync video from provided audio and image.\n- In foreground mode, the video is displayed to the user. In background mode, the URL is saved to a variable.\n- Input: `{ intermediateAsset?: boolean, addWatermark?: boolean, lipsyncModelOverride?: { model: string, config?: object } }`\n- Output: `unknown`\n\n#### generateMusic\nGenerate an audio file from provided instructions (text) using a music model.\n- The text field contains the instructions (prompt) for the music generation.\n- In foreground mode, the audio is displayed to the user. In background mode, the URL is saved to a variable.\n- Input: `{ text: string, intermediateAsset?: boolean, musicModelOverride?: { model: string, config?: object } }`\n- Output: `unknown`\n\n#### generateStaticVideoFromImage\nConvert a static image to an MP4\n- Can use to create slides/intertitles/slates for video composition\n- Input: `{ imageUrl: string, duration: string }`\n- Output: `{ videoUrl: string }`\n\n#### generateText\nSend a message to an AI model and return the response, or echo a system message.\n- Source "user" sends the message to an LLM and returns the model\'s response.\n- Source "system" echoes the message content directly (no AI call).\n- Mode "background" saves the result to a variable. Mode "foreground" streams it to the user (not available in direct execution).\n- Structured output (JSON/CSV) can be enforced via structuredOutputType and structuredOutputExample.\n- When executed inside a v2 app method (managed sandbox or local dev tunnel),\nLLM token output can be streamed to the frontend in real time via an SSE\nside-channel. The frontend opts in by passing { stream: true } to the method\ninvocation via @mindstudio-ai/interface. Tokens are published to Redis\npub/sub as they arrive and forwarded as SSE events on the invoke response.\nThe method code itself is unchanged \u2014 streaming is transparent to the\ndeveloper. See V2ExecutionService.ts and the invoke handler in V2Apps for\nthe server-side plumbing.\n- Input: `{ message: string, source?: "user" | "system", modelOverride?: { model: string, temperature: number, maxResponseTokens: number, ignorePreamble?: boolean, userMessagePreprocessor?: { dataSource?: string, messageTemplate?: string, maxResults?: number, enabled?: boolean, shouldInherit?: boolean }, preamble?: string, multiModelEnabled?: boolean, editResponseEnabled?: boolean, config?: object }, structuredOutputType?: "text" | "json" | "csv", structuredOutputExample?: string, chatHistoryMode?: "include" | "exclude" }`\n- Output: `{ content: string }`\n\n#### generateVideo\nGenerate a video from a text prompt using an AI model.\n- Prompts should be descriptive but concise (roughly 3\u20136 sentences).\n- Videos are automatically hosted on a CDN.\n- In foreground mode, the video is displayed to the user. In background mode, the URL is saved to a variable.\n- When generateVariants is true with numVariants > 1, multiple videos are generated in parallel.\n- In direct execution, foreground mode behaves as background, and userSelect variant behavior behaves as saveAll.\n- Input: `{ prompt: string, intermediateAsset?: boolean, videoModelOverride?: { model: string, config?: object }, generateVariants?: boolean, numVariants?: number, addWatermark?: boolean }`\n- Output: `{ videoUrl: string | string[] }`\n\n#### getGmailAttachments\nDownload attachments from a Gmail email and re-host them on CDN.\n- Requires a Google OAuth connection with Gmail readonly scope.\n- Attachments are uploaded to CDN and returned as URLs.\n- Attachments larger than 25MB are skipped.\n- Use the message ID from Search Gmail Emails, List Recent Gmail Emails, or Get Gmail Email steps.\n- Input: `{ messageId: string, connectionId?: string }`\n- Output: `unknown`\n\n#### getGmailUnreadCount\nGet the number of unread emails in the connected Gmail inbox.\n- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the unread message count for the inbox label.\n- This is a lightweight call that does not fetch any email content.\n- Input: `{ connectionId?: string }`\n- Output: `unknown`\n\n#### getMediaMetadata\nGet info about a media file\n- Input: `{ mediaUrl: string }`\n- Output: `{ metadata: string }`\n\n#### imageFaceSwap\nReplace a face in an image with a face from another image using AI.\n- Requires both a target image and a face source image.\n- Output is re-hosted on the CDN as a PNG.\n- Input: `{ imageUrl: string, faceImageUrl: string, engine: string }`\n- Output: `{ imageUrl: string }`\n\n#### imageRemoveWatermark\nRemove watermarks from an image using AI.\n- Output is re-hosted on the CDN as a PNG.\n- Input: `{ imageUrl: string, engine: string, intermediateAsset?: boolean }`\n- Output: `{ imageUrl: string }`\n\n#### insertVideoClips\nInsert b-roll clips into a base video at a timecode, optionally with an xfade transition.\n- Input: `{ baseVideoUrl: string, overlayVideos: { videoUrl: string, startTimeSec: number }[], transition?: string, transitionDuration?: number, useOverlayAudio?: boolean, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### listDataSources\nLegacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. List all data sources for the current app.\n- Returns metadata for every data source associated with the current app version.\n- Each entry includes the data source ID, name, description, status, and document list.\n- Input: `object`\n- Output: `unknown`\n\n#### listGmailLabels\nList all labels in the connected Gmail account. Use these label IDs or names with the Update Gmail Labels step.\n- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns both system labels (INBOX, SENT, TRASH, etc.) and user-created labels.\n- Label type is "system" for built-in labels or "user" for custom labels.\n- Input: `{ connectionId?: string }`\n- Output: `unknown`\n\n#### listRecentGmailEmails\nList recent emails from the connected Gmail inbox.\n- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns up to 100 emails (default 5), ordered by most recent first.\n- Functionally equivalent to Search Gmail Emails with an "in:inbox" query.\n- Input: `{ connectionId?: string, exportType: "json" | "text", limit: string }`\n- Output: `unknown`\n\n#### logic\nRoute execution to different branches based on AI evaluation, comparison operators, or workflow jumps.\n- Supports two modes: "ai" (default) uses an AI model to pick the most accurate statement; "comparison" uses operator-based checks.\n- In AI mode, the model picks the most accurate statement from the list. All possible cases must be specified.\n- In comparison mode, the context is the left operand and each case\'s condition is the right operand. First matching case wins. Use operator "default" as a fallback.\n- Requires at least two cases.\n- Each case can transition to a step in the current workflow (destinationStepId) or jump to another workflow (destinationWorkflowId).\n- Input: `{ mode?: "ai" | "comparison", context: string, cases: ({ id: string, condition: string, operator?: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "not_exists" | "contains" | "not_contains" | "default", destinationStepId?: string, destinationWorkflowId?: string } | string)[], modelOverride?: { model: string, temperature: number, maxResponseTokens: number, ignorePreamble?: boolean, userMessagePreprocessor?: { dataSource?: string, messageTemplate?: string, maxResults?: number, enabled?: boolean, shouldInherit?: boolean }, preamble?: string, multiModelEnabled?: boolean, editResponseEnabled?: boolean, config?: object } }`\n- Output: `{ selectedCase: number }`\n\n#### makeDotComRunScenario\nTrigger a Make.com (formerly Integromat) scenario via webhook and return the response.\n- The webhook URL must be configured in your Make.com scenario.\n- Input key-value pairs are sent as JSON in the POST body.\n- Response format depends on the Make.com scenario configuration.\n- Input: `{ webhookUrl: string, input: object }`\n- Output: `{ data: unknown }`\n\n#### mergeAudio\nMerge one or more clips into a single audio file.\n- Input: `{ mp3Urls: string[], fileMetadata?: object, albumArtUrl?: string, intermediateAsset?: boolean }`\n- Output: `{ audioUrl: string }`\n\n#### mergeVideos\nMerge one or more clips into a single video.\n- Input: `{ videoUrls: string[], transition?: string, transitionDuration?: number, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### mixAudioIntoVideo\nMix an audio track into a video\n- Input: `{ videoUrl: string, audioUrl: string, options: { keepVideoAudio?: boolean, audioGainDb?: number, videoGainDb?: number, loopAudio?: boolean }, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### muteVideo\nMute a video file\n- Input: `{ videoUrl: string, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### n8nRunNode\nTrigger an n8n workflow node via webhook and return the response.\n- The webhook URL must be configured in your n8n workflow.\n- Supports GET and POST methods with optional Basic authentication.\n- For GET requests, input values are sent as query parameters. For POST, they are sent as JSON body.\n- Input: `{ method: string, authentication: "none" | "basic" | "string", user: string, password: string, webhookUrl: string, input: object }`\n- Output: `{ data: unknown }`\n\n#### postToSlackChannel\nSend a message to a Slack channel via a connected bot.\n- The user is responsible for connecting their Slack workspace and selecting the channel\n- Supports both simple text messages and slack blocks messages\n- Text messages can use limited markdown (slack-only fomatting\u2014e.g., headers are just rendered as bold)\n- Input: `{ channelId: string, messageType: "string" | "blocks", message: string, connectionId?: string }`\n- Output: `unknown`\n\n#### postToZapier\nSend data to a Zapier Zap via webhook and return the response.\n- The webhook URL must be configured in the Zapier Zap settings\n- Input keys and values are sent as the JSON body of the POST request\n- The webhook response (JSON or plain text) is returned as the output\n- Input: `{ webhookUrl: string, input: object }`\n- Output: `{ data: unknown }`\n\n#### queryAppDatabase\nExecute a SQL query against the app managed database.\n- Executes raw SQL against a SQLite database managed by the app.\n- For SELECT queries, returns rows as JSON.\n- For INSERT/UPDATE/DELETE, returns the number of affected rows.\n- Use {{variables}} directly in your SQL. By default they are automatically extracted\nand passed as safe parameterized values (preventing SQL injection).\nExample: INSERT INTO contacts (name, comment) VALUES ({{name}}, {{comment}})\n- Full MindStudio handlebars syntax is supported, including helpers like {{json myVar}},\n{{get myVar "$.path"}}, {{global.orgName}}, etc.\n- Set parameterize to false for raw/dynamic SQL where variables are interpolated directly\ninto the query string. Use this when another step generates full or partial SQL, e.g.\na bulk INSERT with a precomputed VALUES list. The user is responsible for sanitization\nwhen parameterize is false.\n- Input: `{ databaseId: string, sql: string, parameterize?: boolean }`\n- Output: `{ rows: unknown[], changes: number }`\n\n#### queryDataSource\nLegacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Search a vector data source (RAG) and return relevant document chunks.\n- Queries a vectorized data source and returns the most relevant chunks.\n- Useful for retrieval-augmented generation (RAG) workflows.\n- Input: `{ dataSourceId: string, query: string, maxResults: number }`\n- Output: `{ text: string, chunks: string[], query: string, citations: unknown[], latencyMs: number }`\n\n#### queryExternalDatabase\nExecute a SQL query against an external database connected to the workspace.\n- Requires a database connection configured in the workspace.\n- Supports PostgreSQL (including Supabase), MySQL, and MSSQL.\n- Results can be returned as JSON or CSV.\n- Input: `{ connectionId?: string, query: string, outputFormat: "json" | "csv" }`\n- Output: `{ data: unknown }`\n\n#### redactPII\nReplace personally identifiable information in text with placeholders using Microsoft Presidio.\n- PII is replaced with entity type placeholders (e.g. "Call me at <PHONE_NUMBER>").\n- If entities is empty, returns empty text immediately without processing.\n- Input: `{ input: string, language: string, entities: string[] }`\n- Output: `{ text: string }`\n\n#### removeBackgroundFromImage\nRemove the background from an image using AI, producing a transparent PNG.\n- Uses the Bria background removal model via fal.ai by default.\n- Uses WaveSpeed\'s Ideogram background removal model when type is "advanced".\n- Output is re-hosted on the CDN as a PNG with transparency.\n- Input: `{ type?: "standard" | "advanced", imageUrl: string, autoCrop?: boolean }`\n- Output: `{ imageUrl: string }`\n\n#### resizeVideo\nResize a video file\n- Input: `{ videoUrl: string, mode: "fit" | "exact", maxWidth?: number, maxHeight?: number, width?: number, height?: number, strategy?: "pad" | "crop", intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### runFromConnectorRegistry\nRun a raw API connector to a third-party service\n- Use the /developer/v2/helpers/connectors endpoint to list available services and actions.\n- Use /developer/v2/helpers/connectors/{serviceId}/{actionId} to get the full input configuration for an action.\n- Use /developer/v2/helpers/connections to list your available OAuth connections.\n- The actionId format is "serviceId/actionId" (e.g., "slack/send-message").\n- Pass a __connectionId to authenticate the request with a specific OAuth connection, otherwise the default will be used (if configured).\n- Input: `{ actionId: string, displayName: string, icon: string, configurationValues: object, __connectionId?: string }`\n- Output: `{ data: object }`\n\n#### runPackagedWorkflow\nRun a packaged workflow ("custom block")\n- From the user\'s perspective, packaged workflows are just ordinary blocks. Behind the scenes, they operate like packages/libraries in a programming language, letting the user execute custom functionality.\n- Some of these packaged workflows are available as part of MindStudio\'s "Standard Library" and available to every user.\n- Available packaged workflows are documented here as individual blocks, but the runPackagedWorkflow block is how they need to be wrapped in order to be executed correctly.\n- Input: `{ appId: string, workflowId: string, inputVariables: object, outputVariables: object, name: string }`\n- Output: `{ data: unknown }`\n\n#### scrapeLinkedInCompany\nScrape public company data from a LinkedIn company page.\n- Requires a LinkedIn company URL (e.g. https://www.linkedin.com/company/mindstudioai).\n- Returns structured company data including description, employees, updates, and similar companies.\n- Input: `{ url: string }`\n- Output: `{ company: unknown }`\n\n#### scrapeLinkedInProfile\nScrape public profile data from a LinkedIn profile page.\n- Requires a LinkedIn profile URL (e.g. https://www.linkedin.com/in/username).\n- Returns structured profile data including experience, education, articles, and activities.\n- Input: `{ url: string }`\n- Output: `{ profile: unknown }`\n\n#### scrapeUrl\nExtract text, HTML, or structured content from one or more web pages.\n- Accepts a single URL or multiple URLs (as a JSON array, comma-separated, or newline-separated).\n- Output format controls the result shape: "text" returns markdown, "html" returns raw HTML, "json" returns structured scraper data, "summary" returns a model-written summary and requires the "firecrawl" service.\n- Can optionally capture a screenshot of each page.\n- Handles bot protection automatically; no proxy or rendering configuration is needed.\n- Input: `{ url: string, service?: "default" | "firecrawl", autoEnhance?: boolean, outputFormat?: "text" | "json" | "html" | "summary", pageOptions?: { onlyMainContent: boolean, screenshot: boolean, waitFor: number, replaceAllPathsWithAbsolutePaths: boolean, headers: object, removeTags: string[], mobile: boolean } }`\n- Output: `{ content: string | string[] | { text: string, html: string, json?: object, screenshotUrl?: string, metadata?: { title: string, description: string, url: string, image: string }, error?: { code: string, message: string }, costUnits?: number } | { text: string, html: string, json?: object, screenshotUrl?: string, metadata?: { title: string, description: string, url: string, image: string }, error?: { code: string, message: string }, costUnits?: number }[], screenshot?: string | string[] }`\n\n#### scrapeXPost\nScrape data from a single X (Twitter) post by URL.\n- Returns structured post data (text, html, optional json/screenshot/metadata).\n- Optionally saves the text content to a variable.\n- Input: `{ url: string }`\n- Output: `{ post: { text: string, html: string, json?: object, screenshotUrl?: string, metadata?: { title: string, description: string, url: string, image: string }, error?: { code: string, message: string }, costUnits?: number } }`\n\n#### scrapeXProfile\nScrape public profile data from an X (Twitter) account by URL.\n- Returns structured profile data.\n- Optionally saves the result to a variable.\n- Input: `{ url: string }`\n- Output: `{ profile: { text: string, html: string, json?: object, screenshotUrl?: string, metadata?: { title: string, description: string, url: string, image: string }, error?: { code: string, message: string }, costUnits?: number } }`\n\n#### screenshotUrl\nCapture a screenshot of a web page as a PNG image.\n- Takes a viewport or full-page screenshot of the given URL.\n- Returns a CDN-hosted PNG image URL.\n- Viewport mode captures only the visible area; fullPage captures the entire scrollable page.\n- You can customize viewport width/height, add a delay, or wait for a CSS selector before capturing.\n- Input: `{ url: string, mode?: "viewport" | "fullPage", width?: number, height?: number, delay?: number, waitFor?: string }`\n- Output: `{ screenshotUrl: string }`\n\n#### searchGmailEmails\nSearch for emails in the connected Gmail account using a Gmail search query. To list recent inbox emails, pass an empty query string.\n- Requires a Google OAuth connection with Gmail readonly scope.\n- Uses Gmail search syntax (e.g. "from:user@example.com", "subject:invoice", "is:unread").\n- To list recent inbox emails, use an empty query string or "in:inbox".\n- Returns up to 100 emails (default 5). The variable receives text or JSON depending on exportType.\n- The direct execution output always returns structured email objects.\n- Input: `{ query: string, connectionId?: string, exportType: "json" | "text", limit: string }`\n- Output: `{ emails: { id: string, subject: string, from: string, to: string, date: string, plainBody: string, htmlBody: string, labels: string }[] }`\n\n#### searchGoogle\nSearch the web using Google and return structured results.\n- Defaults to us/english, but can optionally specify country and/or language.\n- Defaults to any time, but can optionally specify last hour, last day, week, month, or year.\n- Defaults to top 30 results, but can specify 1 to 100 results to return.\n- Input: `{ query: string, exportType: "text" | "json", countryCode?: string, languageCode?: string, dateRange?: "hour" | "day" | "week" | "month" | "year" | "any", numResults?: number }`\n- Output: `{ results: { title: string, description: string, url: string }[] }`\n\n#### searchGoogleImages\nSearch Google Images and return image results with URLs and metadata.\n- Defaults to us/english, but can optionally specify country and/or language.\n- Defaults to any time, but can optionally specify last hour, last day, week, month, or year.\n- Defaults to top 30 results, but can specify 1 to 100 results to return.\n- Input: `{ query: string, exportType: "text" | "json", countryCode?: string, languageCode?: string, dateRange?: "hour" | "day" | "week" | "month" | "year" | "any", numResults?: number }`\n- Output: `{ images: { title: string, imageUrl: string, imageWidth: number, imageHeight: number, thumbnailUrl: string, thumbnailWidth: number, thumbnailHeight: number, source: string, domain: string, link: string, googleUrl: string, position: number }[] }`\n\n#### searchGoogleNews\nSearch Google News for recent news articles matching a query.\n- Defaults to top 30 results, but can specify 1 to 100 results to return.\n- Input: `{ text: string, exportType: "text" | "json", numResults?: number }`\n- Output: `{ articles: { title: string, link: string, date: string, source: { name: string }, snippet?: string }[] }`\n\n#### searchGoogleTrends\nFetch Google Trends data for a search term.\n- date accepts shorthand ("now 1-H", "today 1-m", "today 5-y", etc.) or custom "yyyy-mm-dd yyyy-mm-dd" ranges.\n- data_type controls the shape of returned data: TIMESERIES, GEO_MAP, GEO_MAP_0, RELATED_TOPICS, or RELATED_QUERIES.\n- Input: `{ text: string, hl: string, geo: string, data_type: "TIMESERIES" | "GEO_MAP" | "GEO_MAP_0" | "RELATED_TOPICS" | "RELATED_QUERIES", cat: string, date: string, ts: string }`\n- Output: `{ trends: object }`\n\n#### searchPerplexity\nSearch the web using the Perplexity API and return structured results.\n- Defaults to US results. Use countryCode (ISO code) to filter by country.\n- Returns 10 results by default, configurable from 1 to 20.\n- The variable receives text or JSON depending on exportType. The direct execution output always returns structured results.\n- Input: `{ query: string, exportType: "text" | "json", countryCode?: string, numResults?: number }`\n- Output: `{ results: { title: string, description: string, url: string }[] }`\n\n#### sendEmail\nSend an email to one or more recipient addresses.\n- Use the "to" field to send to one or more specific recipient email addresses directly. Allowed recipients depend on the sender: when the app sends from a domain it owns (a verified custom domain or its <slug>.madewithremy.com subdomain) any recipient is allowed; when it falls back to the shared Remy address, recipients must be verified app users or members of the app\'s organization. (v1 apps cannot use a direct "to" \u2014 they must resolve recipients via a connection.)\n- Alternatively, recipient email addresses can be resolved from OAuth connections configured by the app creator via connectionId. The user running the workflow does not specify the recipient directly.\n- Use "cc" and "bcc" to add visible / hidden recipients (a string or an array). They are subject to the same recipient rules as "to".\n- "to" is optional only in the sense that recipients can come from elsewhere \u2014 omit it and supply "cc"/"bcc" for a hidden-list send, or omit all three and recipients are resolved from an OAuth connection. Naming nobody at all is an error.\n- Bcc-only sends are supported: with no "to" or "cc", the To: header is addressed to the app\'s own sender address (the standard "undisclosed recipients" pattern) so recipients can\'t see each other. The returned "recipients" reflects that auto-filled address.\n- Every recipient counts toward the app\'s daily outbound cap, including cc and bcc.\n- The sender defaults automatically: v2 apps send from the app\'s own identity \u2014 its verified custom domain if set, else its platform subdomain (noreply@<slug>.madewithremy.com), else the default Remy address.\n- Optionally set "from" to a custom handle, but ONLY if the app has a custom domain or subdomain: a bare handle ("support" \u2192 support@<app-domain>), a full "support@your-domain.com", or "Name <support@your-domain.com>". The domain must be one the app owns, or the step fails.\n- If the body is a URL to a hosted HTML file on the CDN, the HTML is fetched and used as the email body.\n- The body is interpreted automatically: if it already looks like HTML it is sent as HTML, otherwise it is rendered from Markdown. Every email is sent as multipart with a plain-text alternative auto-derived from the body (better deliverability).\n- Set bodyType to override interpretation: "html" (send as-is), "markdown" (render to HTML), or "text" (plain text only, no HTML part). Default is "auto".\n- Optionally set "text" to supply your own plain-text alternative instead of the auto-derived one.\n- Use "attachments" to attach files by URL. Each entry is a URL string, or an object { url, filename?, contentType? } to control the attachment\'s displayed filename and MIME type.\n- When generateHtml is enabled, the body text is converted to a styled HTML email using an AI model (implies an HTML body).\n- Set replyTo to control the Reply-To address for replies.\n- For threaded replies in a shared inbox, set inReplyTo (the Message-ID being replied to) and references (prior Message-IDs in the thread).\n- connectionId can be a comma-separated list to send to multiple recipients.\n- The special connectionId "trigger_email" uses the email address that triggered the workflow.\n- Input: `{ subject: string, body: string, to?: string | string[], cc?: string | string[], bcc?: string | string[], connectionId?: string, generateHtml?: boolean, generateHtmlInstructions?: string, generateHtmlModelOverride?: { model: string, temperature: number, maxResponseTokens: number, ignorePreamble?: boolean, userMessagePreprocessor?: { dataSource?: string, messageTemplate?: string, maxResults?: number, enabled?: boolean, shouldInherit?: boolean }, preamble?: string, multiModelEnabled?: boolean, editResponseEnabled?: boolean, config?: object }, attachments?: (string | { url: string, filename?: string, contentType?: string })[], from?: string, bodyType?: "auto" | "html" | "markdown" | "text", text?: string, replyTo?: string, inReplyTo?: string, references?: string[] }`\n- Output: `{ recipients: string[], cc: string[], bcc: string[], from: string }`\n\n#### sendGmailDraft\nSend an existing draft from the connected Gmail account.\n- Requires a Google OAuth connection with Gmail compose scope.\n- The draft is sent and removed from the Drafts folder.\n- Use the draft ID returned by the Create Gmail Draft or List Gmail Drafts steps.\n- Input: `{ draftId: string, connectionId?: string }`\n- Output: `unknown`\n\n#### sendGmailMessage\nSend an email from the connected Gmail account.\n- Requires a Google OAuth connection with Gmail compose scope.\n- messageType controls the body format: "plain" for plain text, "html" for raw HTML, "markdown" for auto-converted markdown.\n- Input: `{ to: string, subject: string, message: string, connectionId?: string, messageType: "plain" | "html" | "markdown" }`\n- Output: `{ messageId: string }`\n\n#### sendSlackDirectMessage\nSend a direct message to a Slack user via a connected bot.\n- The user is responsible for connecting their Slack workspace\n- The recipient is identified by their Slack user ID\n- Supports both simple text messages and Slack blocks messages\n- Text messages can use limited markdown (slack-only formatting\u2014e.g., headers are just rendered as bold)\n- Input: `{ slackUserId: string, messageType: "string" | "blocks", message: string, connectionId?: string }`\n- Output: `unknown`\n\n#### sendSMS\nSend an SMS or MMS message to a phone number configured via OAuth connection.\n- User is responsible for configuring the connection to the number (MindStudio requires double opt-in to prevent spam)\n- If mediaUrls are provided, the message is sent as MMS instead of SMS\n- MMS supports up to 10 media URLs (images, video, audio, PDF) with a 5MB limit per file\n- MMS is only supported on US and Canadian carriers; international numbers will receive SMS only (media silently dropped)\n- Input: `{ body: string, connectionId?: string, mediaUrls?: string[] }`\n- Output: `unknown`\n\n#### setGmailReadStatus\nMark one or more Gmail emails as read or unread.\n- Requires a Google OAuth connection with Gmail modify scope.\n- Accepts one or more message IDs as a comma-separated string or array.\n- Set markAsRead to true to mark as read, false to mark as unread.\n- Input: `{ messageIds: string, markAsRead: boolean, connectionId?: string }`\n- Output: `unknown`\n\n#### setRunTitle\nSet the title of the agent run for the user\'s history\n- Input: `{ title: string }`\n- Output: `unknown`\n\n#### setVariable\nExplicitly set a variable to a given value.\n- Useful for bootstrapping global variables or setting constants.\n- The variable name and value both support variable interpolation.\n- The type field is a UI hint only (controls input widget in the editor).\n- Input: `{ value: string | string[] }`\n- Output: `object`\n\n#### telegramEditMessage\nEdit a previously sent Telegram message. Use with the message ID returned by Send Telegram Message.\n- Only text messages sent by the bot can be edited.\n- The messageId is returned by the Send Telegram Message step.\n- Common pattern: send a "Processing..." message, do work, then edit it with the result.\n- Input: `{ botToken: string, chatId: string, messageId: string, text: string }`\n- Output: `unknown`\n\n#### telegramReplyToMessage\nSend a reply to a specific Telegram message. The reply will be visually threaded in the chat.\n- Use the rawMessage.message_id from the incoming trigger variables to reply to the user\'s message.\n- Especially useful in group chats where replies provide context.\n- Returns the sent message ID, which can be used with Edit Telegram Message.\n- Input: `{ botToken: string, chatId: string, replyToMessageId: string, text: string }`\n- Output: `{ messageId: number }`\n\n#### telegramSendAudio\nSend an audio file to a Telegram chat as music or a voice note via a bot.\n- "audio" mode sends as a standard audio file. "voice" mode sends as a voice message (re-uploads the file for large file support).\n- Input: `{ botToken: string, chatId: string, audioUrl: string, mode: "audio" | "voice", caption?: string }`\n- Output: `unknown`\n\n#### telegramSendFile\nSend a document/file to a Telegram chat via a bot.\n- Input: `{ botToken: string, chatId: string, fileUrl: string, caption?: string }`\n- Output: `unknown`\n\n#### telegramSendImage\nSend an image to a Telegram chat via a bot.\n- Input: `{ botToken: string, chatId: string, imageUrl: string, caption?: string }`\n- Output: `unknown`\n\n#### telegramSendMessage\nSend a text message to a Telegram chat via a bot.\n- Messages are sent using MarkdownV2 formatting. Special characters are auto-escaped.\n- botToken format is "botId:token" \u2014 both parts are required.\n- Returns the sent message ID, which can be used with Edit Telegram Message to update the message later.\n- Input: `{ botToken: string, chatId: string, text: string }`\n- Output: `{ messageId: number }`\n\n#### telegramSendVideo\nSend a video to a Telegram chat via a bot.\n- Input: `{ botToken: string, chatId: string, videoUrl: string, caption?: string }`\n- Output: `unknown`\n\n#### telegramSetTyping\nShow the "typing..." indicator in a Telegram chat via a bot.\n- The typing indicator automatically expires after a few seconds. Use this right before sending a message for a natural feel.\n- Input: `{ botToken: string, chatId: string }`\n- Output: `unknown`\n\n#### textToSpeech\nGenerate an audio file from provided text using a speech model.\n- The text field contains the exact words to be spoken (not instructions).\n- In foreground mode, the audio is displayed to the user. In background mode, the URL is saved to a variable.\n- Input: `{ text: string, intermediateAsset?: boolean, speechModelOverride?: { model: string, config?: object } }`\n- Output: `{ audioUrl: string }`\n\n#### transcribeAudio\nConvert an audio file to text using a transcription model.\n- The prompt field provides optional context to improve transcription accuracy (e.g. language, speaker names, domain).\n- Input: `{ audioUrl: string, prompt: string, transcriptionModelOverride?: { model: string, config?: object } }`\n- Output: `{ text: string }`\n\n#### trimMedia\nTrim an audio or video clip\n- Input: `{ inputUrl: string, start?: number | string, duration?: string | number, intermediateAsset?: boolean }`\n- Output: `{ mediaUrl: string }`\n\n#### updateGmailLabels\nAdd or remove labels on Gmail messages, identified by message IDs or a search query.\n- Requires a Google OAuth connection with Gmail modify scope.\n- Provide either a query (Gmail search syntax) or explicit messageIds to target messages.\n- Label IDs can be label names or Gmail label IDs \u2014 names are resolved automatically.\n- Input: `{ query: string, connectionId?: string, messageIds: string, addLabelIds: string, removeLabelIds: string }`\n- Output: `{ updatedMessageIds: string[] }`\n\n#### uploadDataSourceDocument\nLegacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Upload a file into an existing data source from a URL or raw text content.\n- If "file" is a single URL, the file is downloaded from that URL and uploaded.\n- If "file" is any other string, a .txt document is created from that content and uploaded.\n- The block waits (polls) for processing to complete before transitioning, up to 5 minutes.\n- Once processing finishes, vectors are loaded into Milvus so the data source is immediately queryable.\n- Supported file types (when using a URL) are the same as the data source upload UI (PDF, DOCX, TXT, etc.).\n- Input: `{ dataSourceId: string, file: string, fileName: string }`\n- Output: `unknown`\n\n#### upscaleImage\nIncrease the resolution of an image using AI upscaling.\n- Output is re-hosted on the CDN as a PNG.\n- Input: `{ imageUrl: string, targetResolution: "2k" | "4k" | "8k", engine: "standard" | "pro" }`\n- Output: `{ imageUrl: string }`\n\n#### upscaleVideo\nUpscale a video file\n- Input: `{ videoUrl: string, targetResolution: "720p" | "1080p" | "2K" | "4K", engine: "standard" | "pro" | "ultimate" | "flashvsr" | "seedance" | "seedvr2" | "runwayml/upscale-v1", intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### videoFaceSwap\nSwap faces in a video file\n- Input: `{ videoUrl: string, faceImageUrl: string, targetIndex: number, engine: string, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### videoRemoveBackground\nRemove or replace background from a video\n- Input: `{ videoUrl: string, newBackground: "transparent" | "image", newBackgroundImageUrl?: string, engine: string, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### videoRemoveWatermark\nRemove a watermark from a video\n- Input: `{ videoUrl: string, engine: string, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n#### watermarkImage\nOverlay a watermark image onto another image.\n- The watermark is placed at the specified corner with configurable padding and width.\n- Input: `{ imageUrl: string, watermarkImageUrl: string, corner: "top-left" | "top-right" | "bottom-left" | "bottom-right", paddingPx: number, widthPx: number, intermediateAsset?: boolean }`\n- Output: `{ imageUrl: string }`\n\n#### watermarkVideo\nAdd an image watermark to a video\n- Input: `{ videoUrl: string, imageUrl: string, corner: "top-left" | "top-right" | "bottom-left" | "bottom-right", paddingPx: number, widthPx: number, intermediateAsset?: boolean }`\n- Output: `{ videoUrl: string }`\n\n### ActiveCampaign\n\n#### activeCampaignAddNote\nAdd a note to an existing contact in ActiveCampaign.\n- Requires an ActiveCampaign OAuth connection (connectionId).\n- The contact must already exist \u2014 use the contact ID from a previous create or search step.\n- Input: `{ contactId: string, note: string, connectionId?: string }`\n- Output: `unknown`\n\n#### activeCampaignCreateContact\nCreate or sync a contact in ActiveCampaign.\n- Requires an ActiveCampaign OAuth connection (connectionId).\n- If a contact with the email already exists, it may be updated depending on ActiveCampaign settings.\n- Custom fields are passed as a key-value map where keys are field IDs.\n- Input: `{ email: string, firstName: string, lastName: string, phone: string, accountId: string, customFields: object, connectionId?: string }`\n- Output: `{ contactId: string }`\n\n### Airtable\n\n#### airtableCreateUpdateRecord\nCreate a new record or update an existing record in an Airtable table.\n- If recordId is provided, updates that record. Otherwise, creates a new one.\n- When updating with updateMode "onlySpecified", unspecified fields are left as-is. With "all", unspecified fields are cleared.\n- Array fields (e.g. multipleAttachments) accept arrays of values.\n- Input: `{ connectionId?: string, baseId: string, tableId: string, recordId?: string, updateMode?: "onlySpecified" | "all", fields: unknown, recordData: object }`\n- Output: `{ recordId: string }`\n\n#### airtableDeleteRecord\nDelete a record from an Airtable table by its record ID.\n- Requires an active Airtable OAuth connection (connectionId).\n- Silently succeeds if the record does not exist.\n- Input: `{ connectionId?: string, baseId: string, tableId: string, recordId: string }`\n- Output: `{ deleted: boolean }`\n\n#### airtableGetRecord\nFetch a single record from an Airtable table by its record ID.\n- Requires an active Airtable OAuth connection (connectionId).\n- If the record is not found, returns a string message instead of a record object.\n- Input: `{ connectionId?: string, baseId: string, tableId: string, recordId: string }`\n- Output: `{ record: { id: string, createdTime: string, fields: object } | null }`\n\n#### airtableGetTableRecords\nFetch multiple records from an Airtable table with optional pagination.\n- Requires an active Airtable OAuth connection (connectionId).\n- Default limit is 100 records. Maximum is 1000.\n- When outputFormat is \'csv\', the variable receives CSV text. The direct execution output always returns parsed records.\n- Input: `{ connectionId?: string, baseId: string, tableId: string, outputFormat?: "json" | "csv", limit?: number }`\n- Output: `{ records: { id: string, createdTime: string, fields: object }[] }`\n\n### Apollo\n\n#### enrichPerson\nLook up professional information about a person using Apollo.io. Search by ID, name, LinkedIn URL, email, or domain.\n- At least one search parameter must be provided.\n- Returns enriched data from Apollo including contact details, employment info, and social profiles.\n- Input: `{ params: { id: string, name: string, linkedinUrl: string, email: string, domain: string } }`\n- Output: `{ data: unknown }`\n\n#### peopleSearch\nSearch for people matching specific criteria using Apollo.io. Supports natural language queries and advanced filters.\n- Can use a natural language "smartQuery" which is converted to Apollo search parameters by an AI model.\n- Advanced params can override or supplement the smart query results.\n- Optionally enriches returned people and/or their organizations for additional detail.\n- Results are paginated. Use limit and page to control the result window.\n- Input: `{ smartQuery: string, enrichPeople: boolean, enrichOrganizations: boolean, limit: string, page: string, params: { personTitles: string, includeSimilarTitles: string, qKeywords: string, personLocations: string, personSeniorities: string, organizationLocations: string, qOrganizationDomainsList: string, contactEmailStatus: string, organizationNumEmployeesRanges: string, revenueRangeMin: string, revenueRangeMax: string, currentlyUsingAllOfTechnologyUids: string, currentlyUsingAnyOfTechnologyUids: string, currentlyNotUsingAnyOfTechnologyUids: string } }`\n- Output: `{ results: unknown }`\n\n### Coda\n\n#### codaCreateUpdatePage\nCreate a new page or update an existing page in a Coda document.\n- Requires a Coda OAuth connection (connectionId).\n- If pageData.pageId is provided, updates that page. Otherwise, creates a new one.\n- Page content is provided as markdown and converted to Coda\'s canvas format.\n- When updating, insertionMode controls how content is applied (default: \'append\').\n- Input: `{ connectionId?: string, pageData: { docId: string, pageId?: string, name: string, subtitle: string, iconName: string, imageUrl: string, parentPageId?: string, pageContent: string | unknown, contentUpdate?: unknown, insertionMode?: string } }`\n- Output: `{ pageId: string }`\n\n#### codaCreateUpdateRow\nCreate a new row or update an existing row in a Coda table.\n- Requires a Coda OAuth connection (connectionId).\n- If rowId is provided, updates that row. Otherwise, creates a new one.\n- Row data keys are column IDs. Empty values are excluded.\n- Input: `{ connectionId?: string, docId: string, tableId: string, rowId?: string, rowData: object }`\n- Output: `{ rowId: string }`\n\n#### codaFindRow\nSearch for a row in a Coda table by matching column values.\n- Requires a Coda OAuth connection (connectionId).\n- Returns the first row matching all specified column values, or null if no match.\n- Search criteria in rowData are ANDed together.\n- Input: `{ connectionId?: string, docId: string, tableId: string, rowData: object }`\n- Output: `{ row: { id: string, values: object } | null }`\n\n#### codaGetPage\nExport and read the contents of a page from a Coda document.\n- Requires a Coda OAuth connection (connectionId).\n- Page export is asynchronous on Coda\'s side \u2014 there may be a brief delay while it processes.\n- If a page was just created in a prior step, there is an automatic 20-second retry if the first export attempt fails.\n- Input: `{ connectionId?: string, docId: string, pageId: string, outputFormat?: "html" | "markdown" }`\n- Output: `{ content: string }`\n\n#### codaGetTableRows\nFetch rows from a Coda table with optional pagination.\n- Requires a Coda OAuth connection (connectionId).\n- Default limit is 10000 rows. Rows are fetched in pages of 500.\n- When outputFormat is \'csv\', the variable receives CSV text. The direct execution output always returns parsed rows.\n- Input: `{ connectionId?: string, docId: string, tableId: string, limit?: number | string, outputFormat?: "json" | "csv" }`\n- Output: `{ rows: { id: string, values: object }[] }`\n\n### Gmail\n\n#### deleteGmailEmail\nMove an email to trash in the connected Gmail account (recoverable delete).\n- Requires a Google OAuth connection with Gmail modify scope.\n- Uses trash (recoverable) rather than permanent delete.\n- Input: `{ messageId: string, connectionId?: string }`\n- Output: `unknown`\n\n#### getGmailDraft\nRetrieve a specific draft from Gmail by draft ID.\n- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the draft content including subject, recipients, sender, and body.\n- Input: `{ draftId: string, connectionId?: string }`\n- Output: `{ draftId: string, messageId: string, subject: string, to: string, from: string, body: string }`\n\n#### getGmailEmail\nRetrieve a specific email from Gmail by message ID.\n- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the email subject, sender, recipient, date, body (plain text preferred, falls back to HTML), and labels.\n- Input: `{ messageId: string, connectionId?: string }`\n- Output: `{ messageId: string, subject: string, from: string, to: string, date: string, body: string, labels: string }`\n\n#### listGmailDrafts\nList drafts in the connected Gmail account.\n- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns up to 50 drafts (default 10).\n- The variable receives text or JSON depending on exportType.\n- Input: `{ connectionId?: string, limit?: string, exportType: "json" | "text" }`\n- Output: `{ drafts: { draftId: string, messageId: string, subject: string, to: string, snippet: string }[] }`\n\n#### replyToGmailEmail\nReply to an existing email in Gmail. The reply is threaded under the original message.\n- Requires a Google OAuth connection with Gmail compose and readonly scopes.\n- The reply is sent to the original sender and threaded under the original message.\n- messageType controls the body format: "plain", "html", or "markdown".\n- Input: `{ messageId: string, message: string, messageType: "plain" | "html" | "markdown", connectionId?: string }`\n- Output: `{ messageId: string }`\n\n### Google\n\n#### createGoogleDoc\nCreate a new Google Document and optionally populate it with content.\n- textType determines how the text field is interpreted: "plain" for plain text, "html" for HTML markup, "markdown" for Markdown.\n- Input: `{ title: string, text: string, connectionId?: string, textType: "plain" | "html" | "markdown" }`\n- Output: `{ documentUrl: string }`\n\n#### createGoogleSheet\nCreate a new Google Spreadsheet and populate it with CSV data.\n- Input: `{ title: string, text: string, connectionId?: string }`\n- Output: `{ spreadsheetUrl: string }`\n\n#### deleteGoogleSheetRows\nDelete a range of rows from a Google Spreadsheet.\n- Requires a Google OAuth connection with Drive scope.\n- startRow and endRow are 1-based row numbers (inclusive).\n- If sheetName is omitted, operates on the first sheet.\n- Input: `{ documentId: string, sheetName?: string, startRow: string, endRow: string, connectionId?: string }`\n- Output: `unknown`\n\n#### fetchGoogleDoc\nFetch the contents of an existing Google Document.\n- exportType controls the output format: "html" for HTML markup, "markdown" for Markdown, "json" for structured JSON, "plain" for plain text.\n- Input: `{ documentId: string, connectionId?: string, exportType: "html" | "markdown" | "json" | "plain" }`\n- Output: `{ content: string }`\n\n#### fetchGoogleSheet\nFetch contents of a Google Spreadsheet range.\n- range uses A1 notation (e.g. "Sheet1!A1:C10"). Omit to fetch the entire first sheet.\n- exportType controls the output format: "csv" for comma-separated values, "json" for structured JSON.\n- Input: `{ spreadsheetId: string, range: string, connectionId?: string, exportType: "csv" | "json" }`\n- Output: `{ content: string }`\n\n#### getGoogleSheetInfo\nGet metadata about a Google Spreadsheet including sheet names, row counts, and column counts.\n- Requires a Google OAuth connection with Drive scope.\n- Returns the spreadsheet title and a list of all sheets with their dimensions.\n- Input: `{ documentId: string, connectionId?: string }`\n- Output: `{ title: string, sheets: { sheetId: number, title: string, rowCount: number, columnCount: number }[] }`\n\n#### updateGoogleDoc\nUpdate the contents of an existing Google Document.\n- operationType controls how content is applied: "addToTop" prepends, "addToBottom" appends, "overwrite" replaces all content.\n- textType determines how the text field is interpreted: "plain" for plain text, "html" for HTML markup, "markdown" for Markdown.\n- Input: `{ documentId: string, connectionId?: string, text: string, textType: "plain" | "html" | "markdown", operationType: "addToTop" | "addToBottom" | "overwrite" }`\n- Output: `{ documentUrl: string }`\n\n#### updateGoogleSheet\nUpdate a Google Spreadsheet with new data.\n- operationType controls how data is written: "addToBottom" appends rows, "overwrite" replaces all data, "range" writes to a specific cell range.\n- Data should be provided as CSV in the text field.\n- Input: `{ text: string, connectionId?: string, spreadsheetId: string, range: string, operationType: "addToBottom" | "overwrite" | "range" }`\n- Output: `{ spreadsheetUrl: string }`\n\n### Google Calendar\n\n#### createGoogleCalendarEvent\nCreate a new event on a Google Calendar.\n- Requires a Google OAuth connection with Calendar events scope.\n- Date/time values must be ISO 8601 format (e.g. "2025-07-02T10:00:00-07:00").\n- Attendees are specified as one email address per line in a single string.\n- Set addMeetLink to true to automatically attach a Google Meet video call.\n- Input: `{ connectionId?: string, summary: string, description?: string, location?: string, startDateTime: string, endDateTime: string, attendees?: string, addMeetLink?: boolean, calendarId?: string }`\n- Output: `{ eventId: string, htmlLink: string }`\n\n#### deleteGoogleCalendarEvent\nRetrieve a specific event from a Google Calendar by event ID.\n- Requires a Google OAuth connection with Calendar events scope.\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns the structured event.\n- Input: `{ connectionId?: string, eventId: string, calendarId?: string }`\n- Output: `unknown`\n\n#### getGoogleCalendarEvent\nRetrieve a specific event from a Google Calendar by event ID.\n- Requires a Google OAuth connection with Calendar events scope.\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns the structured event.\n- Input: `{ connectionId?: string, eventId: string, exportType: "json" | "text", calendarId?: string }`\n- Output: `{ event: { id?: string | null, status?: string | null, htmlLink?: string | null, created?: string | null, updated?: string | null, summary?: string | null, description?: string | null, location?: string | null, organizer?: { displayName?: string | null, email?: string | null } | null, start?: { dateTime?: string | null, timeZone?: string | null } | null, end?: { dateTime?: string | null, timeZone?: string | null } | null, attendees?: ({ displayName?: string | null, email?: string | null, responseStatus?: string | null })[] | null } }`\n\n#### listGoogleCalendarEvents\nList upcoming events from a Google Calendar, ordered by start time.\n- Requires a Google OAuth connection with Calendar events scope.\n- Only returns future events (timeMin = now).\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns structured events.\n- Input: `{ connectionId?: string, limit: number, exportType: "json" | "text", calendarId?: string }`\n- Output: `{ events: ({ id?: string | null, status?: string | null, htmlLink?: string | null, created?: string | null, updated?: string | null, summary?: string | null, description?: string | null, location?: string | null, organizer?: { displayName?: string | null, email?: string | null } | null, start?: { dateTime?: string | null, timeZone?: string | null } | null, end?: { dateTime?: string | null, timeZone?: string | null } | null, attendees?: ({ displayName?: string | null, email?: string | null, responseStatus?: string | null })[] | null })[] }`\n\n#### searchGoogleCalendarEvents\nSearch for events in a Google Calendar by keyword, date range, or both.\n- Requires a Google OAuth connection with Calendar events scope.\n- Supports keyword search via "query" and date filtering via "timeMin"/"timeMax" (ISO 8601 format).\n- Unlike "List Events" which only shows future events, this allows searching past events too.\n- Input: `{ query?: string, timeMin?: string, timeMax?: string, calendarId?: string, limit?: number, exportType: "json" | "text", connectionId?: string }`\n- Output: `{ events: ({ id?: string | null, status?: string | null, htmlLink?: string | null, created?: string | null, updated?: string | null, summary?: string | null, description?: string | null, location?: string | null, organizer?: { displayName?: string | null, email?: string | null } | null, start?: { dateTime?: string | null, timeZone?: string | null } | null, end?: { dateTime?: string | null, timeZone?: string | null } | null, attendees?: ({ displayName?: string | null, email?: string | null, responseStatus?: string | null })[] | null })[] }`\n\n#### updateGoogleCalendarEvent\nUpdate an existing event on a Google Calendar. Only specified fields are changed.\n- Requires a Google OAuth connection with Calendar events scope.\n- Fetches the existing event first, then applies only the provided updates. Omitted fields are left unchanged.\n- Attendees are specified as one email address per line, and replace the entire attendee list.\n- Input: `{ connectionId?: string, eventId: string, summary?: string, description?: string, location?: string, startDateTime?: string, endDateTime?: string, attendees?: string, calendarId?: string }`\n- Output: `{ eventId: string, htmlLink: string }`\n\n### Google Drive\n\n#### getGoogleDriveFile\nDownload a file from Google Drive and rehost it on the CDN. Returns a public CDN URL.\n- Requires a Google OAuth connection with Drive scope.\n- Google-native files (Docs, Sheets, Slides) cannot be downloaded \u2014 use dedicated steps instead.\n- Maximum file size: 200MB.\n- The file is downloaded and re-uploaded to the CDN; the returned URL is publicly accessible.\n- Input: `{ fileId: string, connectionId?: string }`\n- Output: `{ url: string, name: string, mimeType: string, size: number }`\n\n#### listGoogleDriveFiles\nList files in a Google Drive folder.\n- Requires a Google OAuth connection with Drive scope.\n- If folderId is omitted, lists files in the root folder.\n- Returns file metadata including name, type, size, and links.\n- Input: `{ folderId?: string, limit?: number, connectionId?: string, exportType: "json" | "text" }`\n- Output: `{ files: { id: string, name: string, mimeType: string, size: string, webViewLink: string, createdTime: string, modifiedTime: string }[] }`\n\n#### searchGoogleDrive\nSearch for files in Google Drive by keyword.\n- Requires a Google OAuth connection with Drive scope.\n- Searches file content and names using Google Drive\'s fullText search.\n- Input: `{ query: string, limit?: number, connectionId?: string, exportType: "json" | "text" }`\n- Output: `{ files: { id: string, name: string, mimeType: string, size: string, webViewLink: string, createdTime: string, modifiedTime: string }[] }`\n\n### HubSpot\n\n#### hubspotCreateCompany\nCreate a new company or update an existing one in HubSpot. Matches by domain.\n- Requires a HubSpot OAuth connection (connectionId).\n- If a company with the given domain already exists, it is updated. Otherwise, a new one is created.\n- Property values are type-checked against enabledProperties before being sent to HubSpot.\n- Input: `{ connectionId?: string, company: { domain: string, name: string }, enabledProperties: ({ label: string, value: string, type: "string" | "number" | "bool" })[] }`\n- Output: `{ companyId: string }`\n\n#### hubspotCreateContact\nCreate a new contact or update an existing one in HubSpot. Matches by email address.\n- Requires a HubSpot OAuth connection (connectionId).\n- If a contact with the given email already exists, it is updated. Otherwise, a new one is created.\n- If companyDomain is provided, the contact is associated with that company (creating the company if needed).\n- Property values are type-checked against enabledProperties before being sent to HubSpot.\n- Input: `{ connectionId?: string, contact: { email: string, firstname: string, lastname: string }, enabledProperties: ({ label: string, value: string, type: "string" | "number" | "bool" })[], companyDomain: string }`\n- Output: `{ contactId: string }`\n\n#### hubspotGetCompany\nLook up a HubSpot company by domain name or company ID.\n- Requires a HubSpot OAuth connection (connectionId).\n- Returns null if the company is not found.\n- When searching by domain, performs a search query then fetches the full company record.\n- Use additionalProperties to request specific HubSpot properties beyond the defaults.\n- Input: `{ connectionId?: string, searchBy: "domain" | "id", companyDomain: string, companyId: string, additionalProperties: string[] }`\n- Output: `{ company: { id: string, properties: object, createdAt: string, updatedAt: string, archived: boolean } | null }`\n\n#### hubspotGetContact\nLook up a HubSpot contact by email address or contact ID.\n- Requires a HubSpot OAuth connection (connectionId).\n- Returns null if the contact is not found.\n- Use additionalProperties to request specific HubSpot properties beyond the defaults.\n- Input: `{ connectionId?: string, searchBy: "email" | "id", contactEmail: string, contactId: string, additionalProperties: string[] }`\n- Output: `{ contact: { id: string, properties: object, createdAt: string, updatedAt: string, archived: boolean } | null }`\n\n### Hunter.io\n\n#### hunterApiCompanyEnrichment\nLook up company information by domain using Hunter.io.\n- Returns company name, description, location, industry, size, technologies, and more.\n- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns null if the company is not found.\n- Input: `{ domain: string }`\n- Output: `{ data: { name: string, domain: string, description: string | null, country: string | null, state: string | null, city: string | null, industry: string | null, employees_range: string | null, logo_url: string | null, technologies: string[] } | null }`\n\n#### hunterApiDomainSearch\nSearch for email addresses associated with a domain using Hunter.io.\n- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns a list of email addresses found for the domain along with organization info.\n- Input: `{ domain: string }`\n- Output: `{ data: { domain: string, disposable: boolean, webmail: boolean, accept_all: boolean, pattern: string, organization: string, country: string | null, state: string | null, emails: ({ value: string, type: string, confidence: number, first_name: string | null, last_name: string | null, position: string | null, seniority: string | null, department: string | null, linkedin: string | null, twitter: string | null, phone_number: string | null })[], linked_domains: string[] } }`\n\n#### hunterApiEmailFinder\nFind an email address for a specific person at a domain using Hunter.io.\n- Requires a first name, last name, and domain.\n- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns the most likely email address with a confidence score.\n- Input: `{ domain: string, firstName: string, lastName: string }`\n- Output: `{ data: { first_name: string, last_name: string, email: string, score: number, domain: string, accept_all: boolean, position: string | null, twitter: string | null, linkedin_url: string | null, phone_number: string | null, company: string | null, sources: { domain: string, uri: string, extracted_on: string }[] } }`\n\n#### hunterApiEmailVerification\nVerify whether an email address is valid and deliverable using Hunter.io.\n- Checks email format, MX records, SMTP server, and mailbox deliverability.\n- Returns a status ("valid", "invalid", "accept_all", "webmail", "disposable", "unknown") and a score.\n- Input: `{ email: string }`\n- Output: `{ data: { status: string, result: string, score: number, email: string, regexp: boolean, gibberish: boolean, disposable: boolean, webmail: boolean, mx_records: boolean, smtp_server: boolean, smtp_check: boolean, accept_all: boolean, block: boolean, sources: { domain: string, uri: string, extracted_on: string }[] } }`\n\n#### hunterApiPersonEnrichment\nLook up professional information about a person by their email address using Hunter.io.\n- Returns name, job title, social profiles, and company information.\n- If the person is not found, returns an object with an error message instead of throwing.\n- Input: `{ email: string }`\n- Output: `{ data: { first_name: string, last_name: string, email: string, position: string | null, seniority: string | null, department: string | null, linkedin_url: string | null, twitter: string | null, phone_number: string | null, company: { name: string, domain: string, industry: string | null } | null } | { error: string } }`\n\n### LinkedIn\n\n#### postToLinkedIn\nCreate a post on LinkedIn from the connected account.\n- Requires a LinkedIn OAuth connection (connectionId).\n- Supports text posts, image posts, video posts, document posts, and article posts.\n- Attach one media type per post: image, video, document, or article.\n- Documents support PDF, PPT, PPTX, DOC, DOCX (max 100MB, 300 pages). Displays as a slideshow carousel.\n- Articles create a link preview with optional custom title, description, and thumbnail.\n- Visibility controls who can see the post.\n- Input: `{ message: string, visibility: "PUBLIC" | "CONNECTIONS", imageUrl?: string, videoUrl?: string, documentUrl?: string, articleUrl?: string, titleText?: string, descriptionText?: string, connectionId?: string }`\n- Output: `unknown`\n\n### Meshy\n\n#### meshyAnimate\nApply a preset animation to a rigged 3D character model using Meshy.\n- Requires a rig_task_id from a previously completed Meshy rigging step.\n- Select an animation from Meshy\'s library of 600+ preset animations.\n- Only works with humanoid (bipedal) rigged characters.\n- Supports post-processing: FPS change (24/25/30/60), FBX-to-USDZ conversion, or armature extraction.\n- Animation categories: DailyActions, WalkAndRun, Fighting, Dancing, BodyMovements.\n- Input: `{ rigTaskId: string, actionId: number }`\n- Output: `{ glbUrl: string, fbxUrl?: string, objUrl?: string, usdzUrl?: string, thumbnailUrl?: string, textureUrls?: object[], animations?: { name: string, glbUrl?: string, fbxUrl?: string }[], providerTaskId?: string }`\n\n#### meshyImageTo3d\nGenerate a 3D model from one or more images using Meshy. Uses the multi-image-to-3D endpoint.\n- Accepts 1-4 image URLs. All images should depict the same object from different angles for best results.\n- By default generates with textures. Set shouldTexture to false for mesh-only output.\n- Uses should_remesh: false to preserve UV mapping integrity.\n- Input: `{ imageUrls: string[], shouldTexture?: boolean, topology?: string, targetPolycount?: number, symmetryMode?: string, poseMode?: string, textureImageUrl?: string }`\n- Output: `{ glbUrl: string, fbxUrl?: string, objUrl?: string, usdzUrl?: string, thumbnailUrl?: string, textureUrls?: object[], animations?: { name: string, glbUrl?: string, fbxUrl?: string }[], providerTaskId?: string }`\n\n#### meshyRemesh\nRemesh an existing 3D model to adjust topology, polygon count, or convert formats using Meshy.\n- Provide either an input task ID (from a previous Meshy step) or a model URL.\n- Defaults to triangle topology with 30,000 target polys.\n- Useful for reducing face count before rigging (max 300k faces for rigging).\n- Input: `{ inputTaskId?: string, modelUrl?: string, topology?: string, targetPolycount?: number, resizeHeight?: number }`\n- Output: `{ glbUrl: string, fbxUrl?: string, objUrl?: string, usdzUrl?: string, thumbnailUrl?: string, textureUrls?: object[], animations?: { name: string, glbUrl?: string, fbxUrl?: string }[], providerTaskId?: string }`\n\n#### meshyRig\nAuto-rig a humanoid 3D model and generate basic walking/running animations using Meshy.\n- Only works well with standard humanoid (bipedal) models with clearly defined limbs.\n- Prefers model_url over input_task_id for cleaner rigging input.\n- Models with more than 300,000 faces should be remeshed first.\n- Returns rigged model files and optional basic animations.\n- Input: `{ inputTaskId?: string, modelUrl?: string, heightMeters?: number }`\n- Output: `{ glbUrl: string, fbxUrl?: string, objUrl?: string, usdzUrl?: string, thumbnailUrl?: string, textureUrls?: object[], animations?: { name: string, glbUrl?: string, fbxUrl?: string }[], providerTaskId?: string }`\n\n#### meshyTextTo3d\nGenerate a 3D model preview from a text prompt using Meshy. Produces an untextured mesh (preview stage).\n- Creates a text-to-3D preview task (mesh generation only, no texture).\n- Use the Meshy Texture step to apply textures to the preview.\n- Maximum prompt length is 600 characters.\n- Input: `{ prompt: string, modelType?: string, topology?: string, targetPolycount?: number, symmetryMode?: string, poseMode?: string }`\n- Output: `{ glbUrl: string, fbxUrl?: string, objUrl?: string, usdzUrl?: string, thumbnailUrl?: string, textureUrls?: object[], animations?: { name: string, glbUrl?: string, fbxUrl?: string }[], providerTaskId?: string }`\n\n#### meshyTexture\nApply or replace textures on a 3D model using a text prompt or reference image via Meshy.\n- Provide either an input task ID (from a previous Meshy step) or a model URL.\n- Provide either a text style prompt or an image style URL to guide texturing.\n- Supports .glb, .gltf, .obj, .fbx, .stl model formats when using modelUrl.\n- By default preserves original UVs (enableOriginalUv = true).\n- Works with any model source: text-to-3D previews, image-to-3D, remeshed models, or external files.\n- Input: `{ inputTaskId?: string, modelUrl?: string, textStylePrompt?: string, imageStyleUrl?: string, enableOriginalUv?: boolean, enablePbr?: boolean }`\n- Output: `{ glbUrl: string, fbxUrl?: string, objUrl?: string, usdzUrl?: string, thumbnailUrl?: string, textureUrls?: object[], animations?: { name: string, glbUrl?: string, fbxUrl?: string }[], providerTaskId?: string }`\n\n### Notion\n\n#### notionCreatePage\nCreate a new page in Notion as a child of an existing page.\n- Requires a Notion OAuth connection (connectionId).\n- Content is provided as markdown and converted to Notion blocks (headings, paragraphs, lists, code, quotes).\n- The page is created as a child of the specified parent page (pageId).\n- Input: `{ pageId: string, content: string, title: string, connectionId?: string }`\n- Output: `{ pageId: string, pageUrl: string }`\n\n#### notionUpdatePage\nUpdate the content of an existing Notion page.\n- Requires a Notion OAuth connection (connectionId).\n- Content is provided as markdown and converted to Notion blocks.\n- "append" mode adds content to the end of the page. "overwrite" mode deletes all existing blocks first.\n- Input: `{ pageId: string, content: string, mode: "append" | "overwrite", connectionId?: string }`\n- Output: `{ pageId: string, pageUrl: string }`\n\n### Particle Podcasts\n\n#### particlePodcastsFindMentions\nFind every dialogue line mentioning a specific entity or company across all podcasts.\n- Provide `entityId` (for people, products, places) OR `companyId` (for organizations). At least one is required.\n- Use `contextLines` to include surrounding dialogue with each mention (default behavior is set by Particle).\n- Resolve a name to an `entityId` / `companyId` first via Search Companies (or by inspecting a Search Dialogue response).\n- Cursor-paginated; expect potentially large result sets for popular entities.\n- Input: `{ entityId?: string, companyId?: string, contextLines?: number, limit?: number, cursor?: string }`\n- Output: `unknown`\n\n#### particlePodcastsGetEpisode\nFetch full metadata for a single episode: details, speakers, entities, clips, and ads \u2014 merged into one response.\n- Pass an episode ID or slug as `id`.\n- Returns five sub-resources merged: `episode` (metadata), `speakers` (diarized speaker list), `entities` (knowledge-graph mentions), `clips` (AI-extracted highlights), `ads` (detected ad spots).\n- Use Get Episode Transcript separately when you need the full transcript text \u2014 it isn\'t bundled here because the payload is large and has its own format/range options.\n- Bills as 5 units against the get-episode event type (one per sub-call).\n- Input: `{ id: string }`\n- Output: `unknown`\n\n#### particlePodcastsGetEpisodeTranscript\nFetch the diarized transcript for an episode in dialogue, plain text, or SRT subtitle format.\n- Pass an episode ID or slug as `id`.\n- Use `format` = "dialogue" (default, with speaker turns), "text" (plain), or "srt" (subtitle).\n- Filter to a single speaker with `speaker`, or to a time range with `start` / `end` (seconds).\n- Transcripts are large \u2014 prefer time-range filtering when you only need a snippet.\n- Input: `{ id: string, format?: "dialogue" | "text" | "srt", speaker?: string, start?: number, end?: number }`\n- Output: `unknown`\n\n#### particlePodcastsSearchCompanies\nSearch the Particle knowledge graph for companies by name, ticker, domain, CIK, or QID.\n- Provide one or more identifiers: `q` (free-text name), `ticker` (e.g. "TSLA"), `domain` (e.g. "tesla.com"), `cik` (SEC), or `qid` (Wikidata).\n- Use this to resolve a company name to a canonical `companyId` for use with Find Mentions or Search Dialogue.\n- Returned company objects include slugs, domains, and IDs \u2014 any of these can be passed to downstream blocks.\n- Input: `{ q?: string, ticker?: string, domain?: string, cik?: string, qid?: string, entityId?: string, updatedAfter?: string, limit?: number, cursor?: string }`\n- Output: `unknown`\n\n#### particlePodcastsSearchDialogue\nSearch across podcast dialogue using semantic or keyword search. Returns matched lines grouped by episode.\n- Provide `semanticSearch` for meaning-based discovery ("find moments where someone talks about market timing") or `keywordSearch` for exact phrase/proper-noun matching. At least one must be provided.\n- Filter to a specific entity or company by passing `entityId` / `companyId`.\n- Each returned dialogue line carries the source episode + speaker so you can chain to Get Episode or Get Episode Transcript for context.\n- Cursor-paginated.\n- Input: `{ semanticSearch?: string, keywordSearch?: string, entityId?: string, companyId?: string, limit?: number, cursor?: string }`\n- Output: `unknown`\n\n#### particlePodcastsSearchPodcasts\nSearch and list podcasts in the Particle catalog by keyword, topic, or language.\n- Use `q` for free-text keyword search across podcast titles and descriptions.\n- Use `topic` to filter to a Particle taxonomy topic.\n- Use `language` (BCP 47, e.g. "en") to restrict to a language.\n- Returns podcast objects with canonical IDs and slugs. Pass either to other Particle Podcasts blocks.\n- Cursor-paginated; pass the returned `cursor` back to `cursor` for the next page.\n- Input: `{ q?: string, topic?: string, language?: string, suitabilityTier?: string, limit?: number, cursor?: string }`\n- Output: `unknown`\n\n### X\n\n#### postToX\nCreate a post on X (Twitter) from the connected account.\n- Requires an X OAuth connection (connectionId).\n- Maximum 280 characters of text.\n- Optionally attach up to 4 media items (images, GIFs, or videos) via mediaUrls.\n- Media URLs must be publicly accessible. The service fetches and uploads them to X.\n- Supported formats: JPEG, PNG, GIF, WEBP, MP4. Images up to 5MB, videos up to 512MB.\n- Input: `{ text: string, connectionId?: string, mediaUrls?: string[] }`\n- Output: `unknown`\n\n#### searchXPosts\nSearch recent X (Twitter) posts matching a query.\n- Searches only the past 7 days of posts.\n- Query supports X API v2 search operators (up to 512 characters).\nAvailable search operators in query:\n| Operator         | Description                                      |\n| -----------------| -------------------------------------------------|\n| from:            | Posts from a specific user (e.g., from:elonmusk) |\n| to:              | Posts sent to a specific user (e.g., to:NASA)    |\n| @                | Mentions a user (e.g., @openai)                  |\n| #                | Hashtag search (e.g., #AI)                       |\n| is:retweet       | Filters retweets                                 |\n| is:reply         | Filters replies                                  |\n| has:media        | Posts containing media (images, videos, or GIFs) |\n| has:links        | Posts containing URLs                            |\n| lang:            | Filters by language (e.g., lang:en)              |\n| -                | Excludes specific terms (e.g., -spam)            |\n| ()               | Groups terms or operators (e.g., (AI OR ML))     |\n| AND, OR, NOT     | Boolean logic for combining or excluding terms   |\nConjunction-Required Operators (must be combined with a standalone operator):\n| Operator     | Description                                    |\n| ------------ | -----------------------------------------------|\n| has:media  | Posts containing media (images, videos, or GIFs) |\n| has:links  | Posts containing URLs                            |\n| is:retweet | Filters retweets                                 |\n| is:reply   | Filters replies                                  |\nFor example, has:media alone is invalid, but #AI has:media is valid.\n- Input: `{ query: string, scope: "recent" | "all", options: { startTime?: string, endTime?: string, maxResults?: number } }`\n- Output: `{ posts: { id: string, authorId: string, dateCreated: string, text: string, stats: { retweets: number, replies: number, likes: number } }[] }`\n\n### You.com\n\n#### youDotComFinanceResearch\nAsk a financial research question using You.com Finance Research and return the sourced response.\n- Use this for financial questions such as company analysis, earnings, market research, filings, macroeconomics, and due diligence.\n- researchEffort supports deep (default) or exhaustive.\n- Finance Research returns the same response shape as Web Research, but searches a finance-optimized index.\n- Use it for cited synthesis, not raw price feeds or structured time-series exports.\n- Input: `{ input: string, researchEffort?: "deep" | "exhaustive" }`\n- Output: `{ data: object | unknown[] }`\n\n#### youDotComGetPageContent\nFetch clean Markdown, HTML, or metadata for known URLs using the You.com Contents API.\n- Use this step when you already know the URLs. Use Web Search with livecrawl when You.com should discover pages from a query.\n- A single request supports up to 10 URLs.\n- Request only the formats you need. Markdown is recommended for LLM consumption.\n- Increase crawlTimeout for JavaScript-heavy pages, up to 60 seconds.\n- Individual pages can partially fail; check each returned item before processing.\n- Input: `{ urls: string[], formats?: ("markdown" | "html" | "metadata")[], crawlTimeout?: number }`\n- Output: `{ data: object | unknown[] }`\n\n#### youDotComLiveNews\nFetch live news articles through the You.com Search API and return the full structured response.\n- Defaults freshness to day for breaking or recent news.\n- Use country and language together to monitor regional or non-English news.\n- Use livecrawl: \'news\' with livecrawlFormats: [\'markdown\'] when you need full article text.\n- Use a custom freshness range like YYYY-MM-DDtoYYYY-MM-DD for historical news windows.\n- Input: `{ query: string, freshness?: string, count?: number, country?: string, language?: string, safesearch?: "off" | "moderate" | "strict", livecrawl?: "news" | "all", livecrawlFormats?: ("markdown" | "html")[] }`\n- Output: `{ data: object | unknown[] }`\n\n#### youDotComWebResearch\nAsk a research question and return a grounded You.com Research API answer with sources.\n- Use Web Search when you need raw URLs and snippets. Use Web Research when you want a synthesized answer with citations.\n- researchEffort controls depth and latency: lite, standard, deep, or exhaustive. standard is a good default.\n- sourceControl can restrict, exclude, or boost domains, and can apply freshness or country filters.\n- includeDomains cannot be combined with excludeDomains or boostDomains.\n- outputSchema returns structured output.content and is supported by standard, deep, and exhaustive, not lite.\n- Input: `{ input: string, researchEffort?: "lite" | "standard" | "deep" | "exhaustive", sourceControl?: { includeDomains?: string[], excludeDomains?: string[], boostDomains?: string[], freshness?: string, country?: string } | string, outputSchema?: object | string }`\n- Output: `{ data: object | unknown[] }`\n\n#### youDotComWebSearch\nSearch the web and news using the You.com Search API and return the full structured response.\n- Query supports You.com search operators:\n| Operator | Description | Example |\n| -------- | ----------- | ------- |\n| site: | Search within a domain and its subdomains | site:uscourts.gov |\n| filetype: | Search for a specific file type | filetype:pdf |\n| + | Require the exact term after the operator | +GAAP |\n| - | Exclude the exact term after the operator | -prs |\n| AND | Require both expressions | guitar AND Fender |\n| OR | Match either expression | guitar OR drum |\n| NOT | Negate an expression | NOT site:uscourts.gov |\n- Use livecrawl with livecrawlFormats: [\'markdown\'] when you need full page content instead of snippets.\n- Use the Get Page Content step when you already know the URLs to fetch.\n- Use freshness for recency: day, week, month, year, or YYYY-MM-DDtoYYYY-MM-DD.\n- Use country (ISO 3166-1 alpha-2) and language (BCP 47) to focus results geographically or linguistically.\n- includeDomains cannot be combined with excludeDomains or boostDomains.\n- Input: `{ query: string, count?: number, freshness?: string, country?: string, language?: string, offset?: number, safesearch?: "off" | "moderate" | "strict", livecrawl?: "web" | "news" | "all", livecrawlFormats?: ("markdown" | "html")[], crawlTimeout?: number, includeDomains?: string[], excludeDomains?: string[], boostDomains?: string[] }`\n- Output: `{ data: object | unknown[] }`\n\n### YouTube\n\n#### fetchYoutubeCaptions\nRetrieve the captions/transcript for a YouTube video.\n- Supports multiple languages via the language parameter.\n- "text" export produces timestamped plain text; "json" export produces structured transcript data.\n- Input: `{ videoUrl: string, exportType: "text" | "json", language: string }`\n- Output: `{ transcripts: { text: string, start: number }[] }`\n\n#### fetchYoutubeChannel\nRetrieve metadata and recent videos for a YouTube channel.\n- Accepts a YouTube channel URL (e.g. https://www.youtube.com/@ChannelName or /channel/ID).\n- Returns channel info and video listings as a JSON object.\n- Input: `{ channelUrl: string }`\n- Output: `object`\n\n#### fetchYoutubeComments\nRetrieve comments for a YouTube video.\n- Paginates through comments (up to 5 pages).\n- "text" export produces markdown-formatted text; "json" export produces structured comment data.\n- Input: `{ videoUrl: string, exportType: "text" | "json", limitPages: string }`\n- Output: `{ comments: { id: string, link: string, publishedDate: string, text: string, likes: number, replies: number, author: string, authorLink: string, authorImg: string }[] }`\n\n#### fetchYoutubeVideo\nRetrieve metadata for a YouTube video (title, description, stats, channel info).\n- Returns video metadata, channel info, and engagement stats.\n- Video format data is excluded from the response.\n- Input: `{ videoUrl: string }`\n- Output: `object`\n\n#### searchYoutube\nSearch for YouTube videos by keyword.\n- Supports pagination (up to 5 pages) and country/language filters.\n- Use the filter/filterType fields for YouTube search parameter (sp) filters.\n- Input: `{ query: string, limitPages: string, filter: string, filterType: string, countryCode?: string, languageCode?: string }`\n- Output: `{ results: object }`\n\n#### searchYoutubeTrends\nRetrieve trending videos on YouTube by category and region.\n- Categories: "now" (trending now), "music", "gaming", "films".\n- Supports country and language filtering.\n- Input: `{ bp: "now" | "music" | "gaming" | "films", hl: string, gl: string }`\n- Output: `object`\n\n### Helpers\n\n#### `listModels()`\nList all available AI models across all categories.\n\nOutput:\n```typescript\n{\n  models: {\n    id: string;\n    name: string;            // Display name\n    type: "llm_chat" | "image_generation" | "video_generation" | "video_analysis" | "text_to_speech" | "vision" | "transcription";\n    maxTemperature: number;\n    maxResponseSize: number;\n    inputs: object[];        // Accepted input types\n  }[]\n}\n```\n\n#### `listModelsByType(modelType)`\nList AI models filtered by type.\n- `modelType`: `"llm_chat"` | `"image_generation"` | `"video_generation"` | `"video_analysis"` | `"text_to_speech"` | `"vision"` | `"transcription"`\n- Output: same as `listModels()`\n\n#### `listModelsSummary()`\nList all available AI models (summary). Returns only id, name, type, and tags. Suitable for display or consumption inside a model context window.\n\nOutput:\n```typescript\n{\n  models: {\n    id: string;\n    name: string;\n    type: "llm_chat" | "image_generation" | "video_generation" | "video_analysis" | "text_to_speech" | "vision" | "transcription";\n    tags: string;            // Comma-separated tags\n  }[]\n}\n```\n\n#### `listModelsSummaryByType(modelType)`\nList AI models (summary) filtered by type.\n- `modelType`: `"llm_chat"` | `"image_generation"` | `"video_generation"` | `"video_analysis"` | `"text_to_speech"` | `"vision"` | `"transcription"`\n- Output: same as `listModelsSummary()`\n\n#### `listConnectors()`\nList available OAuth connector services (Slack, Google, HubSpot, etc.) and their actions. These are third-party integrations \u2014 for most tasks, use actions directly instead.\n\nOutput:\n```typescript\n{\n  services: {\n    id: string;\n    name: string;\n    icon: string;\n    actions: { id: string; name: string }[];\n  }[]\n}\n```\n\n#### `getConnector(serviceId)`\nGet details for a single OAuth connector service by ID.\n\nOutput:\n```typescript\n{\n  service: {\n    id: string;\n    name: string;\n    icon: string;\n    actions: { id: string; name: string }[];\n  }\n}\n```\n\n#### `getConnectorAction(serviceId, actionId)`\nGet the full configuration for an OAuth connector action, including all input fields needed to call it via `runFromConnectorRegistry`. OAuth connectors are sourced from the open-source MindStudio Connector Registry (MSCR) with 850+ actions across third-party services.\n\nOutput:\n```typescript\n{\n  action: {\n    id: string;\n    name: string;\n    description: string;\n    quickHelp: string;\n    configuration: { title: string; items: { label: string; helpText: string; variable: string; type: string; defaultValue: string; placeholder: string; selectOptions?: object }[] }[];\n  }\n}\n```\n\n#### `listConnections()`\nList OAuth connections for the organization (authenticated third-party service links). Use the returned connection IDs when calling OAuth connector actions. Connectors require the user to connect to the third-party service in MindStudio before they can be used.\n\nOutput:\n```typescript\n{\n  connections: {\n    id: string;       // Connection ID to pass to connector actions\n    provider: string; // Integration provider (e.g. slack, google)\n    name: string;     // Display name or account identifier\n  }[]\n}\n```\n\n#### `estimateStepCost(stepType, step?, options?)`\nEstimate the cost of executing a step before running it. Pass the same step config you would use for execution.\n\n```typescript\nconst estimate = await mindstudio.estimateStepCost(\'generateText\', { message: \'Hello\' });\n```\n\n- `stepType`: string \u2014 The action name (e.g. `"generateText"`).\n- `step`: object \u2014 Optional action input parameters for more accurate estimates.\n- `options`: `{ appId?: string, workflowId?: string }` \u2014 Optional context for pricing.\n\nOutput:\n```typescript\n{\n  costType?: string;  // "free" when the step has no cost\n  estimates?: {\n    eventType: string;       // Billing event type\n    label: string;           // Human-readable cost label\n    unitPrice: number;       // Price per unit in nanodollars (1e-9 USD)\n    unitType: string;        // What constitutes a unit (e.g. "token", "request")\n    estimatedCost?: number;  // Estimated total cost in nanodollars, or null if not estimable\n    quantity: number;        // Number of billable units\n  }[]\n}\n```\n\n#### `changeName(displayName)`\nUpdate the display name of the authenticated agent. Useful for agents to set their own name after connecting.\n\n```typescript\nawait mindstudio.changeName(\'My Agent\');\n```\n\n#### `changeProfilePicture(profilePictureUrl)`\nUpdate the profile picture of the authenticated agent. Useful for agents to set their own avatar after connecting.\n\n```typescript\nawait mindstudio.changeProfilePicture(\'https://example.com/avatar.png\');\n```\n\n#### `uploadFile(content, options)`\n**Deprecated for app file storage** \u2014 use the `files` store below (`files.defineStore(...).put(...)`): private by default, app-scoped, and served on the app\'s own domain. `uploadFile` uploads to the shared account media CDN and remains only for account-level assets (e.g. an agent avatar for `changeProfilePicture`). Gets a signed upload URL, PUTs the file content, and returns the permanent public URL.\n\n```typescript\nimport { readFileSync } from \'fs\';\nconst { url } = await mindstudio.uploadFile(readFileSync(\'photo.png\'), { extension: \'png\', type: \'image/png\' });\n```\n\n- `content`: `Buffer | Uint8Array` \u2014 The file content.\n- `options.extension`: string \u2014 File extension without the dot (e.g. `"png"`, `"jpg"`, `"mp4"`).\n- `options.type`: string (optional) \u2014 MIME type (e.g. `"image/png"`). Determines which CDN subdomain is used.\n\nOutput: `{ url: string }` \u2014 The permanent public CDN URL.\n\n#### `files` \u2014 per-app file storage (private by default)\nTyped per-app file storage: user uploads, generated documents, images, marketing assets. Think of a store as a CDN-backed bucket the app talks to \u2014 NOT app-defined state like a `db` table. The API is *shaped* like the `db` namespace (define a store at module scope, then read/write), but its contents aren\'t modeled by code, and one store is shared across dev and prod (a file uploaded in the dev editor is already live in prod at the same URL). Creates are safe by default because keys default to unique (UUID, or a content-addressed hash); the operations to treat with care are `delete(key)` and overwriting a fixed key. Files are served on the app\'s own domain: private stores (the default) are signed / session-authorized; public stores are world-readable, CDN-served, and images resize via query params (e.g. `?w=400&h=300&fit=cover`). Prefer this over the deprecated `uploadFile()` for app storage.\n\n```typescript\nimport { files } from \'@mindstudio-ai/agent\';\n\n// Define stores at module scope (access is pinned here).\nexport const Uploads = files.defineStore(\'uploads\');                  // private (default)\nexport const Assets  = files.defineStore(\'assets\', { access: \'public\' });\n\n// Store bytes and get a ready-to-use URL.\nconst file = await Uploads.put(buffer, { contentType: \'application/pdf\', filename: \'report.pdf\' });\nfile.url;              // stable on-domain URL for a logged-in user (drop into <img>/<a download>)\nawait file.shareUrl(); // absolute signed URL that works with NO session (email/embed); default 24h\n```\n\nStore methods:\n- `put(content, { key?, contentType?, filename?, contentAddressed? })` \u2192 `StoredFile`. `content` is `Buffer | Uint8Array | string`. Omit `key` for a random UUID; `contentAddressed: true` derives an immutable `<sha256>.<ext>` key.\n- `get(key)` \u2192 `Buffer` \xB7 `head(key)` \u2192 `StoredFile` \xB7 `exists(key)` \u2192 `boolean`\n- `list({ prefix?, cursor?, limit? })` \u2192 `{ files: StoredFile[]; cursor? }`\n- `delete(key)` \u2192 `void`\n- `shareUrl(key, { expiresIn? })` \u2192 signed absolute URL (private stores; no session needed)\n\n`StoredFile`: `{ store, key, access, size?, contentType?, updatedAt?, url, shareUrl() }`.\n\n`defineStore(name, options?)` options: `access: \'public\' | \'private\'` (default private), `maxSize` (bytes; cap for client-direct uploads), `contentTypes` (allowlist for client-direct uploads).\n\nUser uploads (client-direct \u2014 bytes go straight to storage, never through the app backend): a backend method mints a token, the frontend submits it with `@mindstudio-ai/interface`.\n```typescript\n// backend method\nconst token = await Uploads.createUploadToken({ contentType, maxSize: 25 * 1024 * 1024 });\nreturn token;\n// frontend (@mindstudio-ai/interface)\nimport { platform } from \'@mindstudio-ai/interface\';\nconst { url } = await platform.upload(token, file, { onProgress });\n```\n\nGenerated assets: any action that produces a file (`generateImage`, `generateVideo`, `generateSpeech`, `generatePdf`, `upscaleImage`, \u2026) can put its output straight into one of these stores \u2014 pass the store handle as `store` in the OPTIONS object (second argument). Optional: omit it and the asset goes to the shared MindStudio CDN as before. Reach for it when the asset belongs to the app \u2014 private to a user, or listed alongside its other files.\n\n```typescript\nconst { imageUrl } = await mindstudio.generateImage({ prompt: \'a red sneaker\' }, { store: Assets });\n```\n\n#### `dataSources` \u2014 searchable document corpora (RAG)\n\nDeclare a data source at module scope and import the handle. The platform owns parsing, chunking, embedding, storage and tenant isolation; every hit returns a citation.\n```typescript\nimport { dataSources } from \'@mindstudio-ai/agent\';\nexport const Policies = dataSources.defineDataSource(\'policies\');\n\n// search\nconst { results } = await Policies.search(\'what are the payment terms?\', { topK: 5 });\n// options: topK (default 5, max 50), scoreThreshold, filter, mode, maxPerDocument, highlight, rerank, hybrid\nconst context = results.map((r) => r.text).join(String.fromCharCode(10, 10));\n\n// narrow before ranking: metadata tags, filename, pages, required words\nawait Policies.search(\'termination clause\', {\n  filter: { metadata: { department: \'legal\', year: [2025, 2026] }, phrase: \'notice period\' },\n  maxPerDocument: 2,  // stop one document monopolizing the results\n});\n\n// mode: \'hybrid\' (default) | \'semantic\' | \'lexical\'. Lexical skips the query\n// embedding \u2014 fastest, right for identifier-shaped queries (error codes, SKUs).\nawait Policies.search(\'ERR-7741X\', { mode: \'lexical\' });\n\n// add a document (background \u2014 poll documents() for status)\nawait Policies.add(buffer, { filename: \'policy.pdf\', contentType: \'application/pdf\', metadata: { department: \'legal\' } });\nconst docs = await Policies.documents();\n\n// introspection \u2014 what is in the corpus, and how one document was split\nconst { chunkCount, pipeline } = await Policies.stats();  // counts + the config actually in effect\nconst chunks = await Policies.chunks(docs[0].id);       // why a document does or doesn\'t match\n```\n\n`SearchHit`: `{ score, text, citation: { documentId, filename, pageNumber, chunkIndex, headingPath, boundingBox?, url } }`. `citation.url` is a stable on-domain link to the source document \u2014 drop it in an `<a href>`. `(documentId, chunkIndex)` is a chunk\'s stable identity \u2014 key an eval set on that, not on `text`.\n\nAlso on each hit: `retrievalRank`/`retrievalScore` (position before reranking \u2014 compare with the final position to see what reranking did). Three opt-in search options for debugging and display: `explain: true` adds `explain.{dense,lexical,matchedVia}` so you can see which half of hybrid found a hit; `expand: 1` adds `neighbors.{before,after}` for surrounding context; `highlight: true` adds `matches` \u2014 `{start, end}` offsets of query terms in `text`, for rendering highlights. None of them changes the results or their order.\n\n`filter` fields (all AND together, and only narrow): `metadata` (per-key equals, or any-of via an array), `filename`, `documentIds`, `pages: {min?, max?}`, `contains` (all words, any order), `phrase` (exact adjacent sequence). Document metadata is set at add time: scalars only, \u226416 keys, keys `[a-zA-Z0-9_-]`. Re-adding the same bytes with different metadata updates the tags in place \u2014 no re-processing.\n\nSearch is deterministic for a fixed corpus and configuration \u2014 same query, same order \u2014 so regression checks are meaningful. `search()` also returns `latencyMs`.\n\nOther methods: `stats()`, `documents()`, `chunks(documentId, {vectors?})`, `remove(documentId)`, `ensure(name?)` (rarely needed \u2014 `add` and `search` create-on-reference), and `DataSource.contentHash(bytes)` to check for an existing document before adding.\n\nSupported: pdf, docx, pptx, xlsx, odt, rtf, epub, images, txt, md, json, csv, tsv, log, html.\n\nAdding the same bytes twice is free \u2014 documents are content-addressed, so a re-add is a no-op when this source has already processed those exact bytes under its current configuration. Only reconfiguring the source makes a re-add do work again, and that is an explicit owner-triggered migration, never a side effect of a deploy.\n\nEverything in `SearchOptions` \u2014 `mode`, `filter`, `rerank`, `hybrid`, `maxPerDocument`, `highlight` \u2014 is free to change and takes effect on the next search. How documents are chunked and embedded is configured on the corpus itself with `mindstudio-prod datasources config` \u2014 not in code \u2014 and changing it on a populated source is rejected rather than silently rebuilding.\n\n**A data source is live and shared.** Unlike database tables there is no dev copy and no per-release isolation: adding or removing a document changes what the deployed app retrieves, immediately. Scenarios never reset a data source, and re-ingesting a large corpus costs real money.\n';
  }
});

// src/ask/prompt/index.ts
async function buildSystemPrompt(agent) {
  const [modelsResult, connectionsResult, connectorsResult, llmsResult] = await Promise.allSettled([
    agent.listModelsSummary(),
    agent.listConnections(),
    agent.listConnectors(),
    Promise.resolve().then(() => (init_llms_content(), llms_content_exports))
  ]);
  const modelsSummary = modelsResult.status === "fulfilled" ? modelsResult.value.models.map(
    (m) => `- ${m.id} (${m.name}, type: ${m.type}${m.popularity != null ? ", popularity: " + m.popularity : ""}${m.tags ? ", tags: " + m.tags : ""})`
  ).join("\n") : "(Could not load models \u2014 use the listModels tool to look them up)";
  const connections = connectionsResult.status === "fulfilled" && connectionsResult.value.connections.length > 0 ? connectionsResult.value.connections.map((c) => `- ${c.provider}: ${c.name} (id: ${c.id})`).join("\n") : "No OAuth connections configured.";
  const connectorServices = connectorsResult.status === "fulfilled" ? connectorsResult.value.services.map(
    (s) => `- ${s.id}: ${s.name} (${s.actions?.length ?? 0} actions)`
  ).join("\n") : "(Could not load connectors \u2014 use the getConnectorDetails tool)";
  const llmsContent2 = llmsResult.status === "fulfilled" ? llmsResult.value.llmsContent : "(Could not load action reference \u2014 use getActionDetails tool)";
  const referenceDocs = buildReferenceDocs({
    modelsSummary,
    connections,
    connectorServices,
    llmsContent: llmsContent2
  });
  return `${identity}

${referenceDocs}

${playbook}

${instructions}

<!-- cache_breakpoint -->`;
}
var init_prompt = __esm({
  "src/ask/prompt/index.ts"() {
    "use strict";
    init_identity();
    init_reference();
    init_instructions();
    init_playbook();
  }
});

// src/ask/index.ts
var ask_exports = {};
__export(ask_exports, {
  cmdAsk: () => cmdAsk,
  runAsk: () => runAsk
});
function resolveCredentials(options) {
  const config = loadConfig();
  const apiKey = process.env.CALLBACK_TOKEN ?? options.apiKey ?? process.env.MINDSTUDIO_API_KEY ?? config.apiKey;
  if (!apiKey) {
    throw new Error(
      "Not authenticated. Run `mindstudio login` or set MINDSTUDIO_API_KEY."
    );
  }
  const baseUrl = options.baseUrl ?? process.env.MINDSTUDIO_BASE_URL ?? process.env.REMOTE_HOSTNAME ?? config.baseUrl ?? DEFAULT_BASE_URL2;
  return { apiKey, baseUrl };
}
async function runAsk(question, options = {}, onEvent) {
  const { apiKey, baseUrl } = resolveCredentials(options);
  const agent = new MindStudioAgent({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });
  const system = await buildSystemPrompt(agent);
  const messages = [{ role: "user", content: question }];
  while (true) {
    let assistantText = "";
    const toolCalls = [];
    let stopReason = "end_turn";
    for await (const event of streamChat({
      baseUrl,
      apiKey,
      system,
      messages,
      tools: ASK_TOOLS
    })) {
      switch (event.type) {
        case "text":
          assistantText += event.text;
          onEvent?.({ type: "text", text: event.text });
          break;
        case "tool_use":
          toolCalls.push({
            id: event.id,
            name: event.name,
            input: event.input
          });
          onEvent?.({
            type: "tool_start",
            name: event.name,
            input: event.input
          });
          break;
        case "done":
          stopReason = event.stopReason;
          break;
        case "error":
          throw new Error(event.error);
      }
    }
    messages.push({
      role: "assistant",
      content: assistantText,
      toolCalls: toolCalls.length > 0 ? toolCalls : void 0
    });
    if (stopReason !== "tool_use" || toolCalls.length === 0) {
      return assistantText;
    }
    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const { result, isError } = await executeTool(agent, tc.name, tc.input);
        onEvent?.({ type: "tool_done", name: tc.name, isError });
        return { id: tc.id, result, isError };
      })
    );
    for (const r of results) {
      messages.push({
        role: "user",
        content: r.result,
        toolCallId: r.id,
        isToolError: r.isError
      });
    }
  }
}
function summarizeInput(input) {
  const vals = Object.values(input).filter((v) => typeof v === "string");
  const summary = vals.join(", ");
  return summary.length > 60 ? summary.slice(0, 57) + "..." : summary;
}
async function cmdAsk(question, options) {
  try {
    let lineBuffer = "";
    const response = await runAsk(question, options, (event) => {
      switch (event.type) {
        case "text":
          lineBuffer += event.text;
          while (lineBuffer.includes("\n")) {
            const idx = lineBuffer.indexOf("\n");
            process.stderr.write(lineBuffer.slice(0, idx + 1));
            lineBuffer = lineBuffer.slice(idx + 1);
          }
          break;
        case "tool_start":
          if (lineBuffer) {
            process.stderr.write(lineBuffer + "\n");
            lineBuffer = "";
          }
          process.stderr.write(
            ` ${ansi.cyan("\u27E1")} ${ansi.bold(event.name)} ${ansi.dim(summarizeInput(event.input))}
`
          );
          break;
        case "tool_done":
          break;
      }
    });
    if (lineBuffer) {
      process.stderr.write(lineBuffer);
    }
    if (process.stdout.isTTY) {
      process.stderr.write("\n");
    } else {
      process.stdout.write(response + "\n");
    }
  } catch (err) {
    process.stderr.write(`Error: ${err.message}
`);
    process.exit(1);
  }
}
var DEFAULT_BASE_URL2, ansi;
var init_ask = __esm({
  async "src/ask/index.ts"() {
    "use strict";
    init_config();
    await init_client();
    init_sse();
    init_tools();
    init_prompt();
    DEFAULT_BASE_URL2 = "https://v1.mindstudio-api.com";
    ansi = {
      dim: (s) => `\x1B[2m${s}\x1B[0m`,
      green: (s) => `\x1B[32m${s}\x1B[0m`,
      red: (s) => `\x1B[31m${s}\x1B[0m`,
      cyan: (s) => `\x1B[36m${s}\x1B[0m`,
      bold: (s) => `\x1B[1m${s}\x1B[0m`
    };
  }
});

// src/mcp.ts
var mcp_exports = {};
__export(mcp_exports, {
  startMcpServer: () => startMcpServer
});
import { createInterface } from "readline";
import { readFileSync as readFileSync2 } from "fs";
import { basename, extname } from "path";
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}
function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}
async function startMcpServer(options) {
  let agent = null;
  let metadata = null;
  let tools = null;
  async function getMetadata() {
    if (!metadata) {
      const mod = await Promise.resolve().then(() => (init_metadata(), metadata_exports));
      metadata = mod.stepMetadata;
    }
    return metadata;
  }
  function getAgent() {
    if (!agent) {
      agent = new MindStudioAgent({
        apiKey: options?.apiKey,
        baseUrl: options?.baseUrl,
        reuseThreadId: true
      });
    }
    return agent;
  }
  async function buildTools() {
    if (tools) return tools;
    const meta = await getMetadata();
    const stepTools = Object.entries(meta).map(
      ([name, step]) => ({
        name,
        description: step.description + (step.usageNotes ? "\n\n" + step.usageNotes : ""),
        inputSchema: step.inputSchema
      })
    );
    tools = [ASK_TOOL, ...stepTools, ...HELPER_TOOLS];
    return tools;
  }
  async function handleMessage(msg) {
    const { id, method, params } = msg;
    switch (method) {
      case "initialize":
        sendResult(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: {
            name: "mindstudio-agent",
            version: "0.1.100-jewel.1"
          },
          instructions: 'Welcome to MindStudio \u2014 a platform with 200+ AI models, 850+ third-party integrations, and pre-built agents.\n\nGetting started:\n1. Call `ask` with any question about the SDK \u2014 it knows every action, model, and connector and returns working code with real model IDs and config options. Examples: ask("generate an image with FLUX"), ask("what models support vision?"), ask("how do I send a Slack message?").\n2. Call `changeName` to set your display name \u2014 use your name or whatever your user calls you. This is how you\'ll appear in MindStudio request logs.\n3. If you have a profile picture, pass its public image URL to `changeProfilePicture`.\n4. For manual browsing, call `listActions` to discover all available actions.\n\nThen use the tools to generate text, images, video, audio, search the web, work with data sources, run agents, and more.\n\nImportant:\n- AI-powered actions (text generation, image generation, video, audio, etc.) cost money. Before running these, call `estimateActionCost` and confirm with the user before proceeding \u2014 unless they\'ve explicitly told you to go ahead.\n- Not all agents from `listAgents` are configured for API use. Do not try to run an agent just because it appears in the list \u2014 it will likely fail. Only run agents the user specifically asks you to run.'
        });
        break;
      case "notifications/initialized":
        break;
      case "tools/list":
        sendResult(id, { tools: await buildTools() });
        break;
      case "tools/call": {
        const toolName = params.name;
        const args = params.arguments ?? {};
        try {
          let result;
          if (toolName === "ask") {
            const { runAsk: runAsk2 } = await init_ask().then(() => ask_exports);
            result = await runAsk2(
              args.question,
              options
            );
          } else if (toolName === "listActions") {
            const meta = await getMetadata();
            const summary = {};
            for (const [name, step] of Object.entries(meta)) {
              summary[name] = step.description;
            }
            for (const [name, desc] of Object.entries(
              HELPER_DESCRIPTIONS
            )) {
              summary[name] = desc;
            }
            result = summary;
          } else if (toolName === "listModels") {
            result = await getAgent().listModels();
          } else if (toolName === "listModelsByType") {
            result = await getAgent().listModelsByType(
              args.modelType
            );
          } else if (toolName === "listModelsSummary") {
            result = await getAgent().listModelsSummary();
          } else if (toolName === "listModelsSummaryByType") {
            result = await getAgent().listModelsSummaryByType(
              args.modelType
            );
          } else if (toolName === "listConnectors") {
            result = await getAgent().listConnectors();
          } else if (toolName === "getConnector") {
            result = await getAgent().getConnector(
              args.serviceId
            );
          } else if (toolName === "getConnectorAction") {
            result = await getAgent().getConnectorAction(
              args.serviceId,
              args.actionId
            );
          } else if (toolName === "listConnections") {
            result = await getAgent().listConnections();
          } else if (toolName === "listPackagedWorkflows") {
            result = await getAgent().listPackagedWorkflows();
          } else if (toolName === "estimateActionCost") {
            const meta = await getMetadata();
            const rawType = args.stepType;
            const resolved = meta[rawType]?.stepType ?? rawType;
            result = await getAgent().estimateStepCost(
              resolved,
              args.step,
              {
                appId: args.appId,
                workflowId: args.workflowId
              }
            );
          } else if (toolName === "changeName") {
            await getAgent().changeName(
              args.displayName
            );
            result = { success: true };
          } else if (toolName === "changeProfilePicture") {
            await getAgent().changeProfilePicture(
              args.profilePictureUrl
            );
            result = { success: true };
          } else if (toolName === "uploadFile") {
            const filePath = args.filePath;
            const ext = extname(filePath).slice(1).toLowerCase();
            if (!ext) throw new Error("Cannot determine file extension from path.");
            const content = readFileSync2(filePath);
            const mimeType = MIME_TYPES[ext];
            result = await getAgent().uploadFile(content, {
              extension: ext,
              filename: basename(filePath),
              ...mimeType && { type: mimeType }
            });
          } else if (toolName === "executeBatch") {
            result = await getAgent().executeStepBatch(
              args.steps
            );
          } else if (toolName === "listAgents") {
            result = await getAgent().listAgents();
          } else if (toolName === "runAgent") {
            result = await getAgent().runAgent({
              appId: args.appId,
              variables: args.variables,
              workflow: args.workflow,
              version: args.version
            });
          } else {
            const meta = await getMetadata();
            const step = meta[toolName];
            if (!step) {
              sendError(id, -32602, `Unknown tool: ${toolName}`);
              return;
            }
            result = await getAgent().executeStep(
              step.stepType,
              args
            );
          }
          sendResult(id, {
            content: [
              { type: "text", text: JSON.stringify(result, null, 2) }
            ]
          });
        } catch (err) {
          const message = err instanceof MindStudioError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
          sendResult(id, {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true
          });
        }
        break;
      }
      default:
        if (id !== void 0) {
          sendError(id, -32601, `Method not found: ${method}`);
        }
        break;
    }
  }
  console.log = console.warn;
  const rl = createInterface({ input: process.stdin, terminal: false });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      await handleMessage(msg);
    } catch {
      sendError(void 0, -32700, "Parse error");
    }
  }
}
var MCP_PROTOCOL_VERSION, MIME_TYPES, ASK_TOOL, HELPER_DESCRIPTIONS, HELPER_TOOLS;
var init_mcp = __esm({
  async "src/mcp.ts"() {
    "use strict";
    await init_client();
    init_errors();
    MCP_PROTOCOL_VERSION = "2024-11-05";
    MIME_TYPES = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      pdf: "application/pdf",
      json: "application/json",
      txt: "text/plain",
      csv: "text/csv"
    };
    ASK_TOOL = {
      name: "ask",
      description: 'Ask a question about the MindStudio SDK \u2014 available actions, AI models, OAuth connectors, integrations, and how to use them. Returns complete TypeScript code with real model IDs, config options, and correct types. Use this when you need to discover actions, find model IDs, look up connector details, or get working code examples.\n\nExample questions:\n- "generate an image with FLUX"\n- "what models support vision?"\n- "how do I send a Slack message with an attachment?"\n- "what connectors could I configure?"\n- "what are the config options for flux-max-2?"',
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "Natural language question about the MindStudio SDK"
          }
        },
        required: ["question"]
      }
    };
    HELPER_DESCRIPTIONS = {
      listModels: "List all available AI models.",
      listModelsByType: "List AI models filtered by type.",
      listModelsSummary: "List all AI models (summary: id, name, type, tags).",
      listModelsSummaryByType: "List AI models (summary) filtered by type.",
      listConnectors: "List available OAuth connector services (third-party integrations). For most tasks, use actions directly instead.",
      getConnector: "Get details for an OAuth connector service.",
      getConnectorAction: "Get full configuration for an OAuth connector action.",
      listConnections: "List OAuth connections for the organization (authenticated third-party service links).",
      listPackagedWorkflows: "List packaged workflows available to the organization.",
      estimateStepCost: "Estimate the cost of executing an action before running it.",
      changeName: "Update the display name of the authenticated agent.",
      changeProfilePicture: "Update the profile picture of the authenticated agent.",
      uploadFile: "Upload a file to the account media CDN (deprecated for app storage \u2014 prefer the files store).",
      listAgents: "List all pre-built agents in the organization.",
      runAgent: "Run a pre-built agent and wait for the result.",
      executeBatch: "Execute multiple actions in parallel in a single request."
    };
    HELPER_TOOLS = [
      {
        name: "listActions",
        description: "List all available actions with their descriptions. Returns a compact { action: description } map. Call this to discover what actions are available, then call a specific action by name. Tip: if you haven't already, call `changeName` to set your display name first.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "listModels",
        description: "List all available AI models across all categories.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "listModelsByType",
        description: "List AI models filtered by type.",
        inputSchema: {
          type: "object",
          properties: {
            modelType: {
              type: "string",
              enum: [
                "llm_chat",
                "image_generation",
                "3d_generation",
                "video_generation",
                "video_analysis",
                "text_to_speech",
                "music_generation",
                "lipsync",
                "vision",
                "transcription",
                "embedding",
                "reranking",
                "document_extraction"
              ]
            }
          },
          required: ["modelType"]
        }
      },
      {
        name: "listModelsSummary",
        description: "List all available AI models (summary) with only id, name, type, and tags. Suitable for display or consumption inside a model context window.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "listModelsSummaryByType",
        description: "List AI models (summary) filtered by type.",
        inputSchema: {
          type: "object",
          properties: {
            modelType: {
              type: "string",
              enum: [
                "llm_chat",
                "image_generation",
                "3d_generation",
                "video_generation",
                "video_analysis",
                "text_to_speech",
                "music_generation",
                "lipsync",
                "vision",
                "transcription",
                "embedding",
                "reranking",
                "document_extraction"
              ]
            }
          },
          required: ["modelType"]
        }
      },
      {
        name: "listConnectors",
        description: "List available OAuth connector services (Slack, Google, HubSpot, etc.) and their actions. These are third-party integrations \u2014 for most tasks, use actions directly instead.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "getConnector",
        description: "Get details for a single OAuth connector service by ID.",
        inputSchema: {
          type: "object",
          properties: { serviceId: { type: "string" } },
          required: ["serviceId"]
        }
      },
      {
        name: "getConnectorAction",
        description: "Get the full configuration for an OAuth connector action, including all input fields needed to call it via runFromConnectorRegistry.",
        inputSchema: {
          type: "object",
          properties: {
            serviceId: {
              type: "string",
              description: "The connector service ID."
            },
            actionId: {
              type: "string",
              description: 'The full action ID including service prefix (e.g. "slack/send-message").'
            }
          },
          required: ["serviceId", "actionId"]
        }
      },
      {
        name: "listConnections",
        description: "List OAuth connections for the organization (authenticated third-party service links). Use the returned connection IDs when calling OAuth connector actions.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "listPackagedWorkflows",
        description: "List packaged workflows available to the organization, including their app/workflow IDs and input/output signatures.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "estimateActionCost",
        description: "Estimate the cost of executing an action before running it. Pass the same config you would use for execution.",
        inputSchema: {
          type: "object",
          properties: {
            stepType: {
              type: "string",
              description: 'The action type name (e.g. "generateText").'
            },
            step: {
              type: "object",
              description: "The action input parameters.",
              additionalProperties: true
            },
            appId: {
              type: "string",
              description: "Optional app ID for context-specific pricing."
            },
            workflowId: {
              type: "string",
              description: "Optional workflow ID for context-specific pricing."
            }
          },
          required: ["stepType"]
        }
      },
      {
        name: "changeName",
        description: "Update the display name of the authenticated agent. Useful for agents to set their own name after connecting.",
        inputSchema: {
          type: "object",
          properties: {
            displayName: {
              type: "string",
              description: "The new display name."
            }
          },
          required: ["displayName"]
        }
      },
      {
        name: "changeProfilePicture",
        description: "Update the profile picture of the authenticated agent. Useful for agents to set their own avatar after connecting.",
        inputSchema: {
          type: "object",
          properties: {
            profilePictureUrl: {
              type: "string",
              description: "URL of the new profile picture."
            }
          },
          required: ["profilePictureUrl"]
        }
      },
      {
        name: "uploadFile",
        description: "Upload a local file to the account media CDN. Returns the permanent public URL. Deprecated for app file storage \u2014 prefer the files store; kept for account-level assets like an agent avatar.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Absolute or relative path to the file to upload."
            }
          },
          required: ["filePath"]
        }
      },
      {
        name: "executeBatch",
        description: "Execute multiple actions in parallel in a single request. All steps run in parallel on the server. Results are returned in the same order as the input. Individual step failures do not affect other steps \u2014 partial success is possible. Maximum 50 steps per batch.",
        inputSchema: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              description: "Array of steps to execute.",
              minItems: 1,
              maxItems: 50,
              items: {
                type: "object",
                properties: {
                  stepType: {
                    type: "string",
                    description: 'The action type name (e.g. "generateImage", "textToSpeech").'
                  },
                  step: {
                    type: "object",
                    description: "Action input parameters.",
                    additionalProperties: true
                  }
                },
                required: ["stepType", "step"]
              }
            }
          },
          required: ["steps"]
        }
      },
      {
        name: "listAgents",
        description: "List all pre-built agents in the organization along with org metadata.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "runAgent",
        description: "Run a pre-built agent and wait for the result. Uses async polling internally.",
        inputSchema: {
          type: "object",
          properties: {
            appId: {
              type: "string",
              description: "The agent/app ID to run."
            },
            variables: {
              type: "object",
              description: "Input variables as key-value pairs.",
              additionalProperties: true
            },
            workflow: {
              type: "string",
              description: "Workflow name to execute. Omit for the app default."
            },
            version: {
              type: "string",
              description: 'App version override (e.g. "draft"). Defaults to "live".'
            }
          },
          required: ["appId"]
        }
      }
    ];
  }
});

// src/cli.ts
var cli_exports = {};
import { parseArgs } from "util";
import { execSync } from "child_process";
import { readFileSync as readFileSync3 } from "fs";
import { basename as basename2, extname as extname2 } from "path";
function camelToKebab(s) {
  return s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}
function kebabToCamel2(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function parseJson5(input) {
  try {
    return JSON.parse(input);
  } catch {
  }
  let s = input;
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(s);
}
function coerce(value) {
  if (typeof value !== "string") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && !isNaN(Number(value))) return Number(value);
  if (value.startsWith("{") && value.endsWith("}") || value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch {
    }
  }
  return value;
}
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from(
    { length: m + 1 },
    () => Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
function printHelp() {
  process.stderr.write(HELP);
}
function fatal(message) {
  process.stderr.write(JSON.stringify({ error: { message } }) + "\n");
  process.exit(1);
}
function usageBlock(lines) {
  process.stderr.write("\n" + lines.map((l) => "  " + l).join("\n") + "\n\n");
  process.exit(1);
}
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}
function resolveMethodOrFail(name, metadataKeys) {
  if (metadataKeys.has(name)) return name;
  const camel = kebabToCamel2(name);
  if (metadataKeys.has(camel)) return camel;
  const kebab = name.includes("-") ? name : camelToKebab(name);
  let bestDist = Infinity;
  let bestMatch = "";
  for (const key of metadataKeys) {
    const d = levenshtein(kebab, camelToKebab(key));
    if (d < bestDist) {
      bestDist = d;
      bestMatch = camelToKebab(key);
    }
  }
  const suggestion = bestDist <= 3 ? ` Did you mean '${bestMatch}'?` : "";
  fatal(
    `Unknown action: ${name}.${suggestion} Run 'mindstudio list-actions' to see available actions.`
  );
}
async function getAllMethodKeys() {
  const { stepMetadata: stepMetadata2 } = await Promise.resolve().then(() => (init_metadata(), metadata_exports));
  return new Set(Object.keys(stepMetadata2));
}
function buildSummary(stepMetadata2) {
  const summary = {};
  for (const [name, meta] of Object.entries(stepMetadata2)) {
    summary[name] = meta.description;
  }
  return summary;
}
async function cmdList(asJson, asSummary) {
  const { stepMetadata: stepMetadata2 } = await Promise.resolve().then(() => (init_metadata(), metadata_exports));
  if (asSummary) {
    process.stdout.write(JSON.stringify(buildSummary(stepMetadata2)) + "\n");
  } else if (asJson) {
    const entries = Object.entries(stepMetadata2).map(([name, meta]) => ({
      method: camelToKebab(name),
      description: meta.description,
      stepType: meta.stepType,
      inputSchema: meta.inputSchema,
      outputSchema: meta.outputSchema
    }));
    process.stdout.write(JSON.stringify(entries, null, 2) + "\n");
  } else {
    const entries = Object.entries(stepMetadata2);
    const kebabEntries = entries.map(
      ([name, meta]) => [camelToKebab(name), meta]
    );
    const maxLen = Math.min(
      35,
      kebabEntries.reduce((m, [k]) => Math.max(m, k.length), 0)
    );
    for (const [name, meta] of kebabEntries) {
      const desc = meta.description || "(no description)";
      process.stdout.write(`${name.padEnd(maxLen)}  ${desc}
`);
    }
  }
}
async function cmdInfo(rawMethod) {
  const allKeys = await getAllMethodKeys();
  const method = resolveMethodOrFail(rawMethod, allKeys);
  const { stepMetadata: stepMetadata2 } = await Promise.resolve().then(() => (init_metadata(), metadata_exports));
  const meta = stepMetadata2[method];
  const out = [];
  out.push("");
  out.push(`  ${camelToKebab(method)}`);
  out.push("");
  if (meta.description) out.push(`  ${meta.description}`);
  if (meta.usageNotes) {
    out.push("");
    for (const line of meta.usageNotes.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) out.push(`  ${trimmed}`);
    }
  }
  const schema = meta.inputSchema;
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  if (Object.keys(props).length > 0) {
    out.push("");
    out.push("  Parameters:");
    for (const [key, prop] of Object.entries(props)) {
      const req = required.has(key) ? " (required)" : "";
      const type = formatPropType(prop);
      const desc = prop.description ? `  ${prop.description}` : "";
      out.push(`    --${camelToKebab(key)}  ${type}${req}${desc}`);
    }
  }
  const outSchema = meta.outputSchema;
  if (outSchema?.properties) {
    out.push("");
    out.push("  Output keys:");
    const outRequired = new Set(outSchema.required ?? []);
    for (const [key, prop] of Object.entries(outSchema.properties)) {
      const type = formatPropType(prop);
      const opt = outRequired.has(key) ? "" : " (optional)";
      out.push(`    ${key}  ${type}${opt}`);
    }
  }
  out.push("");
  process.stderr.write(out.join("\n") + "\n");
}
function formatPropType(prop) {
  if (prop.enum)
    return prop.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (prop.type === "array") return "array";
  if (prop.type === "object") return "object";
  if (typeof prop.type === "string")
    return prop.type === "integer" ? "number" : prop.type;
  return "string";
}
async function cmdExec(method, input, options) {
  const { MindStudioAgent: MindStudioAgent2 } = await init_client().then(() => client_exports);
  await Promise.resolve().then(() => (init_steps(), steps_exports)).then(
    (m) => m.applyStepMethods(MindStudioAgent2)
  );
  const agent = new MindStudioAgent2({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });
  const { stepMetadata: stepMetadata2 } = await Promise.resolve().then(() => (init_metadata(), metadata_exports));
  const meta = stepMetadata2[method];
  if (!meta) {
    fatal(
      `Unknown action: ${method}. Run 'mindstudio list-actions' to see available actions.`
    );
  }
  let onLog;
  if (options.jsonLogs) {
    onLog = (log) => {
      process.stderr.write(
        JSON.stringify({ type: "log", value: log.value, tag: log.tag, ts: log.ts }) + "\n"
      );
    };
  } else if (process.stderr.isTTY) {
    onLog = (log) => {
      process.stderr.write(
        `  ${ansi2.cyan("\u27E1")} ${ansi2.gray(log.value)}
`
      );
    };
  }
  const result = await agent.executeStep(meta.stepType, input, {
    appId: options.appId,
    threadId: options.threadId,
    onLog
  });
  if (options.outputKey) {
    const val = result[options.outputKey];
    if (typeof val === "string") {
      process.stdout.write(val + "\n");
    } else {
      process.stdout.write(JSON.stringify(val, null, 2) + "\n");
    }
  } else if (options.noMeta) {
    const filtered = {};
    for (const [k, v] of Object.entries(result)) {
      if (!k.startsWith("$")) filtered[k] = v;
    }
    process.stdout.write(JSON.stringify(filtered, null, 2) + "\n");
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }
}
async function cmdAgents(asJson, options) {
  const { MindStudioAgent: MindStudioAgent2 } = await init_client().then(() => client_exports);
  const agent = new MindStudioAgent2({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });
  const result = await agent.listAgents();
  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stderr.write(`
  ${result.orgName} (${result.orgId})

`);
    if (result.apps.length === 0) {
      process.stderr.write("  No agents found.\n\n");
      return;
    }
    const maxLen = Math.min(
      35,
      result.apps.reduce((m, a) => Math.max(m, a.name.length), 0)
    );
    for (const app of result.apps) {
      const desc = app.description || "(no description)";
      process.stdout.write(`${app.name.padEnd(maxLen)}  ${app.id}  ${desc}
`);
    }
  }
}
function createAgent(options) {
  return init_client().then(() => client_exports).then(
    ({ MindStudioAgent: MindStudioAgent2 }) => new MindStudioAgent2({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl
    })
  );
}
function jsonOut(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}
async function cmdListModels(options) {
  const agent = await createAgent(options);
  if (options.summary) {
    const result = options.type ? await agent.listModelsSummaryByType(options.type) : await agent.listModelsSummary();
    jsonOut(result);
  } else {
    const result = options.type ? await agent.listModelsByType(options.type) : await agent.listModels();
    jsonOut(result);
  }
}
async function cmdListConnectors(args, options) {
  const agent = await createAgent(options);
  if (args.length >= 2) {
    const result = await agent.getConnectorAction(args[0], args[1]);
    jsonOut(result);
  } else if (args.length === 1) {
    const result = await agent.getConnector(args[0]);
    jsonOut(result);
  } else {
    const result = await agent.listConnectors();
    jsonOut(result);
  }
}
async function cmdListConnections(options) {
  const agent = await createAgent(options);
  const result = await agent.listConnections();
  jsonOut(result);
}
async function cmdListPackagedWorkflows(options) {
  const agent = await createAgent(options);
  const result = await agent.listPackagedWorkflows();
  jsonOut(result);
}
async function cmdEstimateStepCost(method, input, options) {
  const agent = await createAgent(options);
  const result = await agent.estimateStepCost(method, input);
  jsonOut(result);
}
async function cmdChangeName(name, options) {
  const agent = await createAgent(options);
  await agent.changeName(name);
  process.stderr.write(`  Display name updated to: ${name}
`);
}
async function cmdChangeProfilePicture(url, options) {
  const agent = await createAgent(options);
  await agent.changeProfilePicture(url);
  process.stderr.write(`  Profile picture updated.
`);
}
async function cmdRun(appId, variables, options) {
  const { MindStudioAgent: MindStudioAgent2 } = await init_client().then(() => client_exports);
  const agent = new MindStudioAgent2({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });
  const result = await agent.runAgent({
    appId,
    variables: Object.keys(variables).length > 0 ? variables : void 0,
    workflow: options.workflow,
    version: options.version
  });
  const obj = result;
  if (options.outputKey) {
    const val = obj[options.outputKey];
    if (typeof val === "string") {
      process.stdout.write(val + "\n");
    } else {
      process.stdout.write(JSON.stringify(val, null, 2) + "\n");
    }
  } else if (options.noMeta) {
    const filtered = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!k.startsWith("$")) filtered[k] = v;
    }
    process.stdout.write(JSON.stringify(filtered, null, 2) + "\n");
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }
}
async function cmdBatch(input, options) {
  if (!Array.isArray(input)) {
    fatal(
      `Batch input must be a JSON array of { stepType, step } objects.
Example: mindstudio batch '[{"stepType":"generateImage","step":{"prompt":"a cat"}}]'`
    );
  }
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    if (!item || typeof item !== "object" || !item.stepType || !item.step) {
      fatal(
        `Invalid step at index ${i}: each entry must have "stepType" and "step" fields.`
      );
    }
  }
  const { stepMetadata: stepMetadata2 } = await Promise.resolve().then(() => (init_metadata(), metadata_exports));
  const metaByName = new Map(
    Object.entries(stepMetadata2).map(([name, m]) => [name, m])
  );
  const steps = input.map(
    (item, i) => {
      let meta = metaByName.get(item.stepType);
      if (!meta) {
        const camel = item.stepType.replace(
          /-([a-z])/g,
          (_, c) => c.toUpperCase()
        );
        meta = metaByName.get(camel);
      }
      if (meta) {
        return { stepType: meta.stepType, step: item.step };
      }
      return { stepType: item.stepType, step: item.step };
    }
  );
  const agent = await createAgent(options);
  const result = await agent.executeStepBatch(steps, {
    appId: options.appId,
    threadId: options.threadId
  });
  if (options.noMeta) {
    process.stdout.write(JSON.stringify(result.results, null, 2) + "\n");
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }
}
async function cmdUpload(filePath, options) {
  const ext = extname2(filePath).slice(1).toLowerCase();
  if (!ext) fatal("Cannot determine file extension. Please provide a file with an extension.");
  const content = readFileSync3(filePath);
  const mimeType = MIME_TYPES2[ext];
  const { MindStudioAgent: MindStudioAgent2 } = await init_client().then(() => client_exports);
  const agent = new MindStudioAgent2({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl
  });
  const { url } = await agent.uploadFile(content, {
    extension: ext,
    filename: basename2(filePath),
    ...mimeType && { type: mimeType }
  });
  process.stdout.write(url + "\n");
}
function isNewerVersion(current, latest) {
  const c = current.split(".").map(Number);
  const l = latest.split(".").map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}
async function checkForUpdate() {
  const currentVersion = "0.1.100-jewel.1";
  if (!currentVersion) return null;
  try {
    const { loadConfig: loadConfig2, saveConfig: saveConfig2 } = await Promise.resolve().then(() => (init_config(), config_exports));
    const config = loadConfig2();
    if (config._updateCheck) {
      const age = Date.now() - config._updateCheck.checkedAt;
      if (age < UPDATE_CHECK_INTERVAL) {
        return isNewerVersion(currentVersion, config._updateCheck.latestVersion) ? config._updateCheck.latestVersion : null;
      }
    }
    const res = await fetch(
      "https://registry.npmjs.org/@mindstudio-ai/agent/latest",
      { signal: AbortSignal.timeout(5e3) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const latestVersion = data.version;
    if (!latestVersion) return null;
    saveConfig2({
      ...config,
      _updateCheck: { latestVersion, checkedAt: Date.now() }
    });
    return isNewerVersion(currentVersion, latestVersion) ? latestVersion : null;
  } catch {
    return null;
  }
}
function printUpdateNotice(latestVersion) {
  const currentVersion = "0.1.100-jewel.1";
  process.stderr.write(
    `
  ${ansi2.cyanBright("Update available")} ${ansi2.gray(currentVersion + " \u2192")} ${ansi2.cyanBold(latestVersion)}
  ${ansi2.gray("Run")} mindstudio update ${ansi2.gray("to update")}
`
  );
}
function isStandaloneBinary() {
  const argv1 = process.argv[1] ?? "";
  return !argv1.includes("node_modules");
}
async function cmdUpdate() {
  const currentVersion = "0.1.100-jewel.1";
  process.stderr.write(
    `  ${ansi2.gray("Current version:")} ${currentVersion}
`
  );
  process.stderr.write(`  ${ansi2.gray("Checking for updates...")}
`);
  let latestVersion;
  try {
    const res = await fetch(
      "https://registry.npmjs.org/@mindstudio-ai/agent/latest",
      { signal: AbortSignal.timeout(1e4) }
    );
    if (!res.ok) {
      fatal("Failed to check for updates. Please try again later.");
    }
    const data = await res.json();
    latestVersion = data.version ?? "";
    if (!latestVersion) {
      fatal("Failed to check for updates. Please try again later.");
    }
  } catch {
    fatal(
      "Failed to check for updates. Please check your internet connection."
    );
  }
  if (!isNewerVersion(currentVersion, latestVersion)) {
    process.stderr.write(
      `  ${ansi2.greenBold("Already up to date!")} ${ansi2.gray("(" + currentVersion + ")")}
`
    );
    return;
  }
  process.stderr.write(
    `  ${ansi2.cyanBright("Updating")} ${ansi2.gray(currentVersion + " \u2192")} ${ansi2.cyanBold(latestVersion)}
`
  );
  if (isStandaloneBinary()) {
    const platform = process.platform;
    try {
      if (platform === "win32") {
        execSync(
          'powershell -Command "irm https://msagent.ai/install.ps1 | iex"',
          { stdio: "inherit" }
        );
      } else {
        execSync("curl -fsSL https://msagent.ai/install.sh | bash", {
          stdio: "inherit"
        });
      }
      process.stderr.write(
        `
  ${ansi2.greenBold("Updated to " + latestVersion)}
`
      );
    } catch {
      fatal("Update failed. Try running the install command manually.");
    }
  } else {
    process.stderr.write(
      `
  ${ansi2.gray("Run the following command to update:")}

  npm install -g @mindstudio-ai/agent@latest
`
    );
  }
}
function printLogo() {
  const lines = LOGO.split("\n");
  for (const line of lines) {
    const colored = line.replace(
      /[^\s]/g,
      (ch) => ch === "." || ch === ":" || ch === "-" || ch === "+" || ch === "=" ? `\x1B[36m${ch}\x1B[0m` : `\x1B[96;1m${ch}\x1B[0m`
    );
    process.stderr.write(`  ${colored}
`);
  }
}
function openBrowser(url) {
  try {
    if (process.platform === "darwin") execSync(`open "${url}"`);
    else if (process.platform === "win32") execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {
  }
}
function sleep4(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function waitForKeypress() {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}
function maskKey(key) {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
async function cmdLogin(options) {
  const baseUrl = options.baseUrl ?? process.env.MINDSTUDIO_BASE_URL ?? process.env.REMOTE_HOSTNAME ?? DEFAULT_BASE_URL3;
  process.stderr.write("\x1B[2J\x1B[H");
  process.stderr.write("\n");
  printLogo();
  process.stderr.write("\n");
  const ver = "0.1.100-jewel.1";
  process.stderr.write(
    `  ${ansi2.bold("MindStudio Agent")} ${ver ? " " + ansi2.gray("v" + ver) : ""}
`
  );
  process.stderr.write(
    `  ${ansi2.gray("Connect your MindStudio account to get started.")}

`
  );
  process.stderr.write(
    `  ${ansi2.cyanBright("Press any key to open the browser...")}



`
  );
  await waitForKeypress();
  process.stderr.write("\x1B[4A\r\x1B[J");
  process.stderr.write(`  ${ansi2.gray("Requesting authorization...")}
`);
  const authRes = await fetch(
    `${baseUrl}/developer/v2/request-auth-url?agent=true`,
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "@mindstudio-ai/agent"
      }
    }
  );
  if (!authRes.ok) {
    fatal(
      `Failed to request auth URL: ${authRes.status} ${authRes.statusText}`
    );
  }
  const { url, token } = await authRes.json();
  openBrowser(url);
  process.stderr.write(
    `  ${ansi2.cyanBright("Opening browser to authenticate...")}

  ${ansi2.gray("If the browser didn't open, visit:")}
  ${ansi2.cyan(url)}

`
  );
  const POLL_INTERVAL = 2e3;
  const MAX_ATTEMPTS = 60;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep4(POLL_INTERVAL);
    const frame = SPINNER_FRAMES[attempt % SPINNER_FRAMES.length];
    const remaining = Math.ceil(
      MAX_ATTEMPTS * POLL_INTERVAL / 1e3 - (attempt + 1) * POLL_INTERVAL / 1e3
    );
    process.stderr.write(
      `\r  ${ansi2.cyan(frame)} Waiting for browser authorization... ${ansi2.gray(`(${remaining}s)`)}`
    );
    const pollRes = await fetch(`${baseUrl}/developer/v2/poll-auth-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "@mindstudio-ai/agent"
      },
      body: JSON.stringify({ token })
    });
    if (!pollRes.ok) {
      process.stderr.write("\n");
      fatal(`Poll request failed: ${pollRes.status} ${pollRes.statusText}`);
    }
    const result = await pollRes.json();
    if (result.status === "completed" && result.apiKey) {
      process.stderr.write("\r\x1B[K");
      const { saveConfig: saveConfig2, getConfigPath: getConfigPath2 } = await Promise.resolve().then(() => (init_config(), config_exports));
      const config = {
        apiKey: result.apiKey
      };
      if (baseUrl !== DEFAULT_BASE_URL3) {
        config.baseUrl = baseUrl;
      }
      saveConfig2(config);
      process.stderr.write(
        `  ${ansi2.greenBold("\u2714")} Authenticated successfully!
  ${ansi2.gray("Credentials saved to")} ${getConfigPath2()}

  ${ansi2.bold("Using with Claude Code?")} Run once to enable the MCP server:
  ${ansi2.cyan("claude mcp add mindstudio -- mindstudio mcp")}

  ${ansi2.bold("Need help?")} Ask the SDK anything:
  ${ansi2.cyan('mindstudio ask "how do I generate an image?"')}

`
      );
      return;
    }
    if (result.status === "expired") {
      process.stderr.write("\r\x1B[K");
      fatal("Authorization expired. Please try again.");
    }
  }
  process.stderr.write("\r\x1B[K");
  fatal("Authorization timed out. Please try again.");
}
async function cmdLogout() {
  const { loadConfig: loadConfig2, clearConfig: clearConfig2, getConfigPath: getConfigPath2 } = await Promise.resolve().then(() => (init_config(), config_exports));
  const config = loadConfig2();
  if (!config.apiKey) {
    process.stderr.write(`  ${ansi2.gray("Not currently logged in.")}
`);
    return;
  }
  clearConfig2();
  process.stderr.write(
    `  ${ansi2.greenBold("\u2714")} Logged out. Credentials removed from ${ansi2.gray(getConfigPath2())}
`
  );
}
async function cmdWhoami(options) {
  let source;
  let detail = [];
  if (options.apiKey) {
    source = `${ansi2.bold("--api-key flag")} ${ansi2.gray("(CLI argument)")}`;
  } else if (process.env.MINDSTUDIO_API_KEY) {
    source = `${ansi2.bold("MINDSTUDIO_API_KEY")} ${ansi2.gray("(environment variable)")}`;
    detail.push(
      `  ${ansi2.gray("Key:")}  ${maskKey(process.env.MINDSTUDIO_API_KEY)}`
    );
  } else {
    const { loadConfig: loadConfig2, getConfigPath: getConfigPath2 } = await Promise.resolve().then(() => (init_config(), config_exports));
    const config = loadConfig2();
    if (config.apiKey) {
      source = `${ansi2.bold("config file")} ${ansi2.gray("(mindstudio login)")}`;
      detail.push(`  ${ansi2.gray("File:")} ${getConfigPath2()}`);
      detail.push(`  ${ansi2.gray("Key:")}  ${maskKey(config.apiKey)}`);
      if (config.baseUrl) {
        detail.push(`  ${ansi2.gray("URL:")}  ${config.baseUrl}`);
      }
    } else if (process.env.CALLBACK_TOKEN) {
      source = `${ansi2.bold("CALLBACK_TOKEN")} ${ansi2.gray("(managed/internal mode)")}`;
    } else {
      process.stderr.write(
        `  ${ansi2.gray("\u25CB")} Not authenticated. Run ${ansi2.cyan("mindstudio login")} to get started.
`
      );
      return;
    }
  }
  process.stderr.write(`  ${ansi2.gray("Auth:")} ${source}
`);
  for (const line of detail) process.stderr.write(line + "\n");
  process.stderr.write(`  ${ansi2.gray("Verifying...")} `);
  try {
    const { MindStudioAgent: MindStudioAgent2 } = await init_client().then(() => client_exports);
    const agent = new MindStudioAgent2({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl
    });
    const info = await agent.getUserInfo();
    process.stderr.write(
      `\r\x1B[K  ${ansi2.greenBold("\u25CF")} ${ansi2.green("Connected")}

`
    );
    process.stderr.write(`  ${ansi2.bold("User")}
`);
    process.stderr.write(
      `  ${ansi2.gray("Name:")}  ${info.displayName}
`
    );
    process.stderr.write(
      `  ${ansi2.gray("ID:")}    ${ansi2.gray(info.userId)}
`
    );
    process.stderr.write(`
  ${ansi2.bold("Organization")}
`);
    process.stderr.write(
      `  ${ansi2.gray("Name:")}  ${info.organizationName}
`
    );
    process.stderr.write(
      `  ${ansi2.gray("ID:")}    ${ansi2.gray(info.organizationId)}
`
    );
    if (info.members && info.members.length > 0) {
      process.stderr.write(`
  ${ansi2.bold("Members")}
`);
      const nameWidth = Math.max(
        4,
        ...info.members.map((m) => m.displayName.length)
      );
      const roleWidth = Math.max(
        4,
        ...info.members.map((m) => m.role.length)
      );
      process.stderr.write(
        `  ${ansi2.gray("Name".padEnd(nameWidth))}  ${ansi2.gray("Role".padEnd(roleWidth))}  ${ansi2.gray("Type")}
`
      );
      process.stderr.write(
        `  ${ansi2.gray("\u2500".repeat(nameWidth))}  ${ansi2.gray("\u2500".repeat(roleWidth))}  ${ansi2.gray("\u2500".repeat(5))}
`
      );
      for (const member of info.members) {
        const type = member.isAgent ? ansi2.cyan("agent") : "user";
        process.stderr.write(
          `  ${member.displayName.padEnd(nameWidth)}  ${ansi2.gray(member.role.padEnd(roleWidth))}  ${type}
`
        );
      }
    }
    process.stderr.write("\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `\r\x1B[K  ${ansi2.dim("\u25CF")} ${ansi2.dim("Not connected")} ${ansi2.gray("\u2014")} ${message}
`
    );
  }
}
function parseStepFlags(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    if (GLOBAL_BOOLEAN_FLAGS.has(arg)) continue;
    if (GLOBAL_STRING_FLAGS.has(arg)) {
      i++;
      continue;
    }
    if (i + 1 < argv.length) {
      const key = arg.slice(2);
      result[kebabToCamel2(key)] = coerce(argv[++i]);
    }
  }
  return result;
}
function findMethodSplit(argv) {
  let startIdx = 0;
  let hasRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      if (GLOBAL_STRING_FLAGS.has(arg)) i++;
      continue;
    }
    if (arg === "run") {
      hasRun = true;
      startIdx = i + 1;
    } else {
      startIdx = i;
    }
    break;
  }
  for (let i = startIdx; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      if (GLOBAL_STRING_FLAGS.has(arg)) i++;
      continue;
    }
    if (hasRun || i === startIdx) {
      return { rawMethod: arg, stepArgv: argv.slice(i + 1) };
    }
    break;
  }
  return null;
}
async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      "api-key": { type: "string" },
      "base-url": { type: "string" },
      "app-id": { type: "string" },
      "thread-id": { type: "string" },
      "output-key": { type: "string" },
      "no-meta": { type: "boolean", default: false },
      "json-logs": { type: "boolean", default: false },
      workflow: { type: "string" },
      version: { type: "string" },
      type: { type: "string" },
      json: { type: "boolean", default: false },
      summary: { type: "boolean", default: false },
      help: { type: "boolean", default: false }
    }
  });
  if (values.help) {
    printHelp();
    process.exit(0);
  }
  if (positionals.length === 0) {
    const hasAuth = values["api-key"] || process.env.MINDSTUDIO_API_KEY || process.env.CALLBACK_TOKEN;
    if (!hasAuth) {
      const { loadConfig: loadConfig2 } = await Promise.resolve().then(() => (init_config(), config_exports));
      const config = loadConfig2();
      if (!config.apiKey) {
        await cmdLogin({
          baseUrl: values["base-url"]
        });
        return;
      }
    }
    printHelp();
    process.exit(1);
  }
  const command = positionals[0];
  const updatePromise = command !== "mcp" && command !== "login" && command !== "update" ? checkForUpdate() : Promise.resolve(null);
  try {
    if (command === "version" || command === "-v") {
      process.stdout.write(
        "0.1.100-jewel.1\n"
      );
      return;
    }
    if (command === "login") {
      await cmdLogin({
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "logout") {
      await cmdLogout();
      return;
    }
    if (command === "whoami") {
      await cmdWhoami({
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "update") {
      await cmdUpdate();
      return;
    }
    if (command === "ask") {
      let question = positionals.slice(1).join(" ");
      if (!question && !process.stdin.isTTY) {
        question = (await readStdin()).trim();
      }
      if (!question) {
        usageBlock([
          "ask \u2014 Built-in SDK assistant",
          "",
          "Returns working code with real model IDs, config options,",
          "and correct types. Knows every action, model, and connector.",
          "",
          "Usage:",
          '  mindstudio ask "your question here"',
          '  echo "your question" | mindstudio ask',
          "",
          "Examples:",
          '  mindstudio ask "generate an image with FLUX"',
          '  mindstudio ask "what models support vision?"',
          '  mindstudio ask "how do I send a Slack message with an attachment?"',
          '  mindstudio ask "what connectors could I configure?"',
          '  mindstudio ask "what are the config options for flux-max-2?"',
          '  mindstudio ask "give me code to transcribe an audio file"',
          `  mindstudio ask "what's the difference between generateText and userMessage?"`
        ]);
      }
      const { cmdAsk: cmdAsk2 } = await init_ask().then(() => ask_exports);
      await cmdAsk2(question, {
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "list-actions") {
      await cmdList(values.json, values.summary);
      return;
    }
    if (command === "agents") {
      await cmdAgents(values.json, {
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "batch") {
      let input2;
      const firstArg = positionals[1];
      if (firstArg && firstArg.startsWith("[")) {
        try {
          input2 = parseJson5(firstArg);
        } catch {
          fatal(`Invalid JSON input: ${firstArg}`);
        }
      } else if (!process.stdin.isTTY) {
        const raw = (await readStdin()).trim();
        if (raw) {
          try {
            input2 = parseJson5(raw);
          } catch {
            fatal(`Invalid JSON on stdin: ${raw}`);
          }
        }
      }
      if (input2 === void 0) {
        usageBlock([
          "batch \u2014 Execute multiple actions in parallel",
          "",
          "Usage:",
          `  mindstudio batch '[{ "stepType": "<action>", "step": { ... } }, ...]'`,
          "  cat steps.json | mindstudio batch",
          "",
          'Each entry needs "stepType" (action name) and "step" (input object).',
          "Maximum 50 steps per batch. Results come back in the same order.",
          "Individual failures don't affect other steps.",
          "",
          "Options:",
          "  --app-id <id>      App ID for thread context",
          "  --thread-id <id>   Thread ID for state persistence",
          "  --no-meta          Strip top-level metadata from output",
          "",
          "Examples:",
          "  mindstudio batch '[",
          '    { "stepType": "generateImage", "step": { "prompt": "a sunset" } },',
          '    { "stepType": "textToSpeech", "step": { "text": "hello world" } }',
          "  ]'",
          "",
          `  echo '[{"stepType":"searchGoogle","step":{"query":"cats"}}]' | mindstudio batch`
        ]);
      }
      await cmdBatch(input2, {
        apiKey: values["api-key"],
        baseUrl: values["base-url"],
        appId: values["app-id"],
        threadId: values["thread-id"],
        noMeta: values["no-meta"]
      });
      return;
    }
    if (command === "run-agent") {
      const appId = positionals[1];
      if (!appId)
        usageBlock([
          "run-agent \u2014 Run a pre-built agent and wait for the result",
          "",
          "Usage:",
          "  mindstudio run-agent <appId> [json | --flags]",
          "",
          "Options:",
          "  --workflow <name>  Workflow to execute (default: app default)",
          '  --version <ver>    App version, e.g. "draft" (default: "live")',
          "  --output-key <key> Extract a single field from the result",
          "  --no-meta          Strip metadata from output",
          "",
          "Examples:",
          '  mindstudio run-agent abc123 --query "hello"',
          `  mindstudio run-agent abc123 '{"query": "hello"}'`,
          "  mindstudio run-agent abc123 --workflow summarize --version draft",
          "",
          'Tip: run "mindstudio agents" to list available agent IDs.'
        ]);
      const runArgv = process.argv.slice(process.argv.indexOf("run-agent") + 2);
      const stepArgs = [];
      for (let i = 0; i < runArgv.length; i++) {
        const arg = runArgv[i];
        if (GLOBAL_STRING_FLAGS.has(arg) || arg === "--workflow" || arg === "--version") {
          i++;
        } else if (arg === "--no-meta" || arg === "--json" || arg === "--help") {
        } else if (arg === appId) {
        } else {
          stepArgs.push(arg);
        }
      }
      let variables;
      const firstArg = stepArgs[0];
      if (firstArg && firstArg.startsWith("{")) {
        try {
          variables = parseJson5(firstArg);
        } catch {
          fatal(`Invalid JSON input: ${firstArg}`);
        }
      } else {
        const flagInput = parseStepFlags(stepArgs);
        if (Object.keys(flagInput).length > 0) {
          variables = flagInput;
        } else if (!process.stdin.isTTY) {
          const raw = await readStdin();
          try {
            variables = parseJson5(raw);
          } catch {
            fatal(`Invalid JSON on stdin: ${raw}`);
          }
        } else {
          variables = {};
        }
      }
      await cmdRun(appId, variables, {
        apiKey: values["api-key"],
        baseUrl: values["base-url"],
        workflow: values.workflow,
        version: values.version,
        outputKey: values["output-key"],
        noMeta: values["no-meta"]
      });
      return;
    }
    if (command === "upload" || command === "upload-file") {
      const filePath = positionals[1];
      if (!filePath)
        usageBlock([
          "upload \u2014 Upload a file to the MindStudio CDN (alias: upload-file)",
          "",
          "Usage:",
          "  mindstudio upload <filepath>",
          "",
          "Returns the permanent public URL for the uploaded file.",
          "Use this to host a local file (e.g. a generated icon) and get a",
          "URL \u2014 no need to write or trigger an app method.",
          "",
          "Examples:",
          "  mindstudio upload photo.png",
          "  mindstudio upload-file /path/to/document.pdf"
        ]);
      await cmdUpload(filePath, {
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "list-models" || command === "list-models-by-type" || command === "list-models-summary" || command === "list-models-summary-by-type") {
      const authOpts = {
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      };
      let type;
      let summary = false;
      if (command === "list-models-by-type" || command === "list-models-summary-by-type") {
        type = positionals[1];
        if (!type)
          usageBlock([
            `${command} \u2014 List AI models filtered by type`,
            "",
            "Usage:",
            `  mindstudio ${command} <type>`,
            "",
            "Types:",
            "  llm_chat, image_generation, video_generation,",
            "  video_analysis, text_to_speech, vision, transcription",
            "",
            "Examples:",
            `  mindstudio ${command} image_generation`,
            `  mindstudio ${command} llm_chat`
          ]);
      }
      if (command === "list-models-summary" || command === "list-models-summary-by-type") {
        summary = true;
      }
      if (command === "list-models") {
        const typeFlag = values.type;
        if (typeFlag) type = typeFlag;
        if (values.summary) summary = true;
      }
      await cmdListModels({ ...authOpts, type, summary });
      return;
    }
    if (command === "list-connectors") {
      await cmdListConnectors(positionals.slice(1), {
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "list-connections") {
      await cmdListConnections({
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "list-packaged-workflows") {
      await cmdListPackagedWorkflows({
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "estimate-cost") {
      const stepMethod = positionals[1];
      if (!stepMethod)
        usageBlock([
          "estimate-cost \u2014 Estimate the cost of an action before running it",
          "",
          "Usage:",
          "  mindstudio estimate-cost <action> [json | --flags]",
          "",
          "Examples:",
          '  mindstudio estimate-cost generate-image --prompt "a sunset"',
          `  mindstudio estimate-cost generate-text '{"message": "hello"}'`,
          "",
          'Tip: run "mindstudio list-actions" to see available actions.'
        ]);
      const allKeys2 = await getAllMethodKeys();
      const resolvedMethod = resolveMethodOrFail(stepMethod, allKeys2);
      const { stepMetadata: stepMetadata2 } = await Promise.resolve().then(() => (init_metadata(), metadata_exports));
      const meta = stepMetadata2[resolvedMethod];
      const costArgv = positionals.slice(2);
      let costInput;
      const firstArg = costArgv[0];
      if (firstArg && firstArg.startsWith("{")) {
        try {
          costInput = parseJson5(firstArg);
        } catch {
          fatal(`Invalid JSON input: ${firstArg}`);
        }
      } else {
        costInput = parseStepFlags(costArgv);
      }
      await cmdEstimateStepCost(meta.stepType, costInput, {
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "change-name") {
      const name = positionals[1];
      if (!name)
        usageBlock([
          "change-name \u2014 Update your display name",
          "",
          "Usage:",
          "  mindstudio change-name <name>",
          "",
          "Examples:",
          '  mindstudio change-name "My Agent"'
        ]);
      await cmdChangeName(name, {
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "change-profile-picture") {
      const url = positionals[1];
      if (!url)
        usageBlock([
          "change-profile-picture \u2014 Update your profile picture",
          "",
          "Usage:",
          "  mindstudio change-profile-picture <url>",
          "",
          "Examples:",
          "  mindstudio change-profile-picture https://example.com/avatar.png",
          "",
          'Tip: use "mindstudio upload" to host an image first.'
        ]);
      await cmdChangeProfilePicture(url, {
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "mcp") {
      const { startMcpServer: startMcpServer2 } = await init_mcp().then(() => mcp_exports);
      await startMcpServer2({
        apiKey: values["api-key"],
        baseUrl: values["base-url"]
      });
      return;
    }
    if (command === "info") {
      const rawMethod2 = positionals[1];
      if (!rawMethod2)
        usageBlock([
          "info \u2014 Show action details and parameters",
          "",
          "Usage:",
          "  mindstudio info <action>",
          "",
          "Shows the description, input parameters (with types and",
          "defaults), and output fields for an action.",
          "",
          "Examples:",
          "  mindstudio info generate-image",
          "  mindstudio info search-google",
          "",
          'Tip: run "mindstudio list-actions" to see available actions.'
        ]);
      await cmdInfo(rawMethod2);
      return;
    }
    const split = findMethodSplit(process.argv.slice(2));
    if (!split)
      usageBlock([
        "Run an action directly",
        "",
        "Usage:",
        "  mindstudio <action> [json | --flags]",
        "  mindstudio run <action> [json | --flags]",
        "",
        "Input can be inline JSON, --flags, or piped via stdin.",
        "",
        "Options:",
        "  --app-id <id>      App ID for thread context",
        "  --thread-id <id>   Thread ID for state persistence",
        "  --output-key <key> Extract a single field from the result",
        "  --no-meta          Strip $-prefixed metadata from output",
        "",
        "Examples:",
        '  mindstudio generate-image --prompt "a sunset"',
        `  mindstudio search-google '{"query": "cats"}'`,
        `  echo '{"message":"hello"}' | mindstudio generate-text`,
        "",
        'Tip: run "mindstudio list-actions" to see available actions.'
      ]);
    const { rawMethod, stepArgv } = split;
    const allKeys = await getAllMethodKeys();
    const method = resolveMethodOrFail(rawMethod, allKeys);
    let input;
    const firstStepArg = stepArgv[0];
    if (firstStepArg && firstStepArg.startsWith("{")) {
      try {
        input = parseJson5(firstStepArg);
      } catch {
        fatal(`Invalid JSON input: ${firstStepArg}`);
      }
    } else {
      const flagInput = parseStepFlags(stepArgv);
      if (Object.keys(flagInput).length > 0) {
        input = flagInput;
      } else if (!process.stdin.isTTY) {
        const raw = await readStdin();
        try {
          input = parseJson5(raw);
        } catch {
          fatal(`Invalid JSON on stdin: ${raw}`);
        }
      } else {
        input = {};
      }
    }
    await cmdExec(method, input, {
      apiKey: values["api-key"],
      baseUrl: values["base-url"],
      appId: values["app-id"],
      threadId: values["thread-id"],
      outputKey: values["output-key"],
      noMeta: values["no-meta"],
      jsonLogs: values["json-logs"]
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    fatal(message);
  } finally {
    const latestVersion = await updatePromise;
    if (latestVersion) printUpdateNotice(latestVersion);
  }
}
var HELP, MIME_TYPES2, ansi2, UPDATE_CHECK_INTERVAL, LOGO, DEFAULT_BASE_URL3, SPINNER_FRAMES, GLOBAL_STRING_FLAGS, GLOBAL_BOOLEAN_FLAGS;
var init_cli = __esm({
  "src/cli.ts"() {
    "use strict";
    HELP = `Usage: mindstudio <command> [options]

Ask:
  ask "<question>"                     Ask about actions, models, connectors
                                       Returns working code with real model IDs

Run actions:
  <action> [json | --flags]            Run an action directly
  run <action> [json | --flags]        Run an action (explicit form)
  estimate-cost <action> [json]        Estimate cost before running

Discover:
  list-actions [--json] [--summary]    List all available actions
  info <action>                        Show action details and parameters
  list-models [--type <t>] [--summary] List available AI models
  list-packaged-workflows              List packaged workflows

Batch:
  batch [json]                         Execute multiple actions in parallel

Pre-built agents:
  agents [--json]                      List agents in your organization
  run-agent <appId> [json | --flags]   Run an agent and wait for result

Account:
  login                                Authenticate with MindStudio
  logout                               Clear stored credentials
  whoami                               Show current user and organization
  change-name <name>                   Update your display name
  change-profile-picture <url>         Update your profile picture
  upload <filepath>                    Upload a file to the CDN, print its URL (alias: upload-file)
  update                               Update to the latest version

OAuth integrations:
  list-connectors [<id> [<actionId>]]  Browse OAuth connector services
  list-connections                     List your OAuth connections

Other:
  mcp                                  Start MCP server (JSON-RPC over stdio)

Options:
  --api-key <key>    API key (or set MINDSTUDIO_API_KEY env var)
  --base-url <url>   API base URL override
  --app-id <id>      App ID for thread context
  --thread-id <id>   Thread ID for state persistence
  --output-key <key> Extract a single field from the result
  --no-meta          Strip $-prefixed metadata from output
  --json-logs        Stream debug logs as JSONL to stderr
  --workflow <name>  Workflow to execute (run-agent only)
  --version <ver>    App version, e.g. "draft" (run-agent only)
  --json             Output as JSON
  --summary          Compact output (list-actions, list-models)
  --type <type>      Filter by model type (list-models)
  --help             Show this help

Examples:
  mindstudio ask "generate an image with FLUX"
  mindstudio ask "what models support vision?"
  mindstudio generate-image --prompt "a sunset"
  mindstudio generate-text --message "hello" --no-meta
  mindstudio generate-image '{"prompt":"a sunset"}' --output-key imageUrl
  echo '{"query":"test"}' | mindstudio search-google
  mindstudio estimate-cost generate-image --prompt "a sunset"
  mindstudio list-actions --summary
  mindstudio info generate-image
  mindstudio list-models --type image_generation
  mindstudio batch '[{"stepType":"generateImage","step":{"prompt":"a cat"}}]'
  mindstudio run-agent <appId> --query "hello"
  mindstudio agents
  mindstudio mcp
`;
    MIME_TYPES2 = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      pdf: "application/pdf",
      json: "application/json",
      txt: "text/plain",
      csv: "text/csv"
    };
    ansi2 = {
      cyan: (s) => `\x1B[36m${s}\x1B[0m`,
      cyanBright: (s) => `\x1B[96m${s}\x1B[0m`,
      cyanBold: (s) => `\x1B[96;1m${s}\x1B[0m`,
      dim: (s) => `\x1B[2m${s}\x1B[0m`,
      green: (s) => `\x1B[32m${s}\x1B[0m`,
      greenBold: (s) => `\x1B[32;1m${s}\x1B[0m`,
      gray: (s) => `\x1B[90m${s}\x1B[0m`,
      bold: (s) => `\x1B[1m${s}\x1B[0m`
    };
    UPDATE_CHECK_INTERVAL = 60 * 60 * 1e3;
    LOGO = `       .=+-.     :++.
      *@@@@@+  :%@@@@%:
    .%@@@@@@#..@@@@@@@=
  .*@@@@@@@--@@@@@@@#.**.
  *@@@@@@@.-@@@@@@@@.#@@*
.#@@@@@@@-.@@@@@@@* #@@@@%.
=@@@@@@@-.@@@@@@@#.-@@@@@@+
:@@@@@@:  +@@@@@#. .@@@@@@:
  .++:     .-*-.     .++:`;
    DEFAULT_BASE_URL3 = "https://v1.mindstudio-api.com";
    SPINNER_FRAMES = [
      "\u28FE",
      "\u28FD",
      "\u28FB",
      "\u28BF",
      "\u287F",
      "\u28DF",
      "\u28EF",
      "\u28F7"
    ];
    GLOBAL_STRING_FLAGS = /* @__PURE__ */ new Set([
      "--api-key",
      "--base-url",
      "--app-id",
      "--thread-id",
      "--output-key",
      "--workflow",
      "--version"
    ]);
    GLOBAL_BOOLEAN_FLAGS = /* @__PURE__ */ new Set([
      "--no-meta",
      "--json-logs",
      "--json",
      "--summary",
      "--help"
    ]);
    main();
  }
});

// src/postinstall.ts
if (process.env.npm_config_global !== "true" || !process.stderr.isTTY || !process.stdin.isTTY) {
  process.exit(0);
}
await Promise.resolve().then(() => (init_cli(), cli_exports));
