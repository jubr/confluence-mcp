# Confluence MCP

A Model Context Protocol (MCP) server for Confluence, enabling AI assistants to interact with Confluence content through a standardized interface.

ℹ️ There is a separate MCP server [for Jira](https://github.com/cosmix/jira-mcp)

## Features

- Authenticate to Confluence using a personal API token
- Retrieve and search Confluence pages and spaces
- Create and update Confluence content
- Retrieve and add comments to pages
- Retrieve and add attachments to pages
- Clean and transform Confluence content for AI consumption
- Handle API communication, error handling, and data transformation
- Basic rate limiting to prevent API abuse
- **Page Management**: Create, read, update pages
- **Search**: Search pages with CQL (Confluence Query Language)
- **Comments**: Retrieve and add comments to pages
- **Attachments**: Get and add attachments to pages
- **Spaces**: List available spaces
- **Editor Control**: Control which editor version is used for new pages

## Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or higher)
- Confluence account with API access

## Installation

```bash
# Clone the repository
git clone https://github.com/cosmix/confluence-mcp.git
cd confluence-mcp

# Install dependencies
bun install

# Build the project
bun run build
```

## Configuration

To use this MCP server, you need to set the following environment variables:

```
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_BASE_URL=your_confluence_instance_url  # e.g., https://your-domain.atlassian.net/wiki
CONFLUENCE_USER_EMAIL=your_email
CONFLUENCE_REQUEST_DELAY=100  # Optional: delay between requests in ms
```

### Claude Desktop / Cline Configuration

Add this configuration to your settings file:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "bun",
      "args": ["/absolute/path/to/confluence-mcp/dist/index.js"],
      "env": {
        "CONFLUENCE_API_TOKEN": "your_api_token",
        "CONFLUENCE_BASE_URL": "your_confluence_instance_url/wiki",
        "CONFLUENCE_USER_EMAIL": "your_email"
      }
    }
  }
}
```

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test
```

## Available Tools

The Confluence MCP server exposes the following tools:

### get_page

Retrieve a Confluence page by ID. Format refers to the return format of the content and can be `text` or `markdown`. The `includeMarkup` parameter allows retrieving the original Confluence Storage Format (XHTML) markup, which is useful for updating pages while preserving formatting.

```json
{
  "pageId": "123456",
  "format": "text",
  "includeMarkup": true
}
```

### search_pages

Search for Confluence pages using CQL (Confluence Query Language). Format refers to the return format of the content and can be `text` or `markdown`. The `includeMarkup` parameter allows retrieving the original Confluence Storage Format (XHTML) markup for each page.

```json
{
  "query": "space = DEV and label = documentation",
  "limit": 10,
  "format": "text",
  "includeMarkup": true
}
```

### get_spaces

List all available Confluence spaces.

```json
{
  "limit": 50
}
```

### create_page

Create a new Confluence page. The `parentId` is optional and can be used to create a child page under an existing page.

```json
{
  "spaceKey": "DEV",
  "title": "New Page Title",
  "content": "<p>Page content in Confluence Storage Format (XHTML)</p>",
  "parentId": "123456",
  "editorMode": "v2"
}
```

### update_page

Update an existing Confluence page.

```json
{
  "pageId": "123456",
  "title": "Updated Page Title",
  "content": "<p>Updated content in Confluence Storage Format (XHTML)</p>",
  "version": 1
}
```

### get_comments

Retrieve comments for a specific Confluence page. Format refers to the return format of the content and can be `text` or `markdown`.

```json
{
  "pageId": "123456",
  "limit": 25,
  "format": "text"
}
```

### add_comment

Add a comment to a Confluence page. The `parentId` is optional for creating threaded replies.

```json
{
  "pageId": "123456",
  "content": "<p>This is a new comment.</p>",
  "parentId": "789012"
}
```

### get_attachments

Retrieve attachments for a specific Confluence page.

```json
{
  "pageId": "123456",
  "limit": 25
}
```

### add_attachment

Add an attachment to a Confluence page.

**Parameters:**
- `pageId` (required): ID of the page to attach the file to
- `filename` (required): Desired remote filename for the attachment
- `fileContentBase64` (optional): Base64 encoded content of the file
- `fileContentFromPath` (optional): Path to file on disk (relative or absolute)
- `comment` (optional): Comment for the attachment version

**Note:** Exactly one of `fileContentBase64` or `fileContentFromPath` must be provided.

**Examples:**

Using base64 content:
```bash
# First, encode your file to base64
base64 /path/to/your/file.pdf > encoded.txt

# Then use the MCP tool
{
  "pageId": "123456789",
  "filename": "document.pdf", 
  "fileContentBase64": "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSA...",
  "comment": "Latest version of the document"
}
```

Using file path (simpler approach):
```bash
{
  "pageId": "123456789",
  "filename": "document.pdf",
  "fileContentFromPath": "/path/to/your/file.pdf",
  "comment": "Latest version of the document"
}
```

The tool supports both relative and absolute paths. Relative paths are resolved from the current working directory.

## LICENCE

This project is licensed under the MIT License - see the [LICENCE](LICENCE) file for details.
