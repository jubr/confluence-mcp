# Confluence MCP

A Model Context Protocol (MCP) server for Confluence, enabling AI assistants to interact with Confluence content through a standardized interface.

ℹ️ There is a separate MCP server [for Jira](https://github.com/cosmix/jira-mcp)

## Features

- Authenticate to Confluence using a personal API token
- Retrieve and search Confluence pages and spaces
- Create and update Confluence content
- Clean and transform Confluence content for AI consumption
- Handle API communication, error handling, and data transformation

## Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or higher)
- JIRA account with API access

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/confluence-mcp.git
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

Retrieve a Confluence page by ID. Format refers to the return format of the content and can be `text` or `markdown`.

```json
{
  "pageId": "123456",
  "format": "text"
}
```

### search_pages

Search for Confluence pages using CQL (Confluence Query Language). Format refers to the return format of the content and can be `text` or `markdown`.

```json
{
  "query": "space = DEV and label = documentation",
  "limit": 10,
  "format": "text"
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
  "parentId": "123456" 
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

## LICENCE

This project is licensed under the MIT License - see the [LICENCE](LICENCE) file for details.
