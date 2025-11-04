# Personal Website Blog MCP Server

This MCP (Model Context Protocol) server exposes your blog content to AI tools like Claude Desktop, enabling them to access and search through your published articles and knowledge base.

## Overview

The MCP server provides:
- **Resources**: Direct access to individual blog posts via URIs like `blog://post/{id}`
- **Tools**: Query and search capabilities for finding relevant content

This allows AI assistants to:
- Learn about your technical expertise from your blog posts
- Reference specific articles when answering questions
- Understand your knowledge domains through tags and topics
- Provide context-aware assistance based on your published content

## Features

### Resources
Each blog post is exposed as a resource with:
- Full markdown/MDX content
- Metadata (title, description, publication date, tags)
- Author information
- Images and related posts

### Tools

1. **`list_blog_posts`** - List all blog posts with metadata
   - Filter by type: all, regular, or quick posts
   - Limit number of results

2. **`search_blog_posts`** - Search for posts
   - By keyword (searches title, description, and content)
   - By tag (e.g., "astro", "accessibility", "ai")
   - By series (e.g., "deconstruct-personal-website")

3. **`get_blog_post`** - Get full content of a specific post
   - Returns complete markdown with metadata

4. **`get_author_info`** - Get author information
   - Name and portfolio URL

5. **`get_all_tags`** - List all tags with usage counts
   - Helps discover topics you write about

## Installation & Configuration

### Prerequisites
- Node.js 18+
- pnpm package manager
- Claude Desktop or another MCP-compatible client

### Setup

1. **Install dependencies** (already included in personal-website):
```bash
cd apps/personal-website
pnpm install
```

2. **Configure Claude Desktop** (or other MCP client)

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "personal-website-blog": {
      "command": "node",
      "args": [
        "/path/to/rainforest-monorepo/apps/personal-website/node_modules/.bin/tsx",
        "/path/to/rainforest-monorepo/apps/personal-website/src/mcp/server.ts"
      ]
    }
  }
}
```

**Important**: Replace `/path/to/rainforest-monorepo` with the actual absolute path to your monorepo.

Alternative using pnpm:
```json
{
  "mcpServers": {
    "personal-website-blog": {
      "command": "pnpm",
      "args": [
        "--dir",
        "/path/to/rainforest-monorepo/apps/personal-website",
        "mcp"
      ]
    }
  }
}
```

3. **Restart Claude Desktop**

The MCP server will automatically start when Claude Desktop launches.

## Usage Examples

Once configured, you can ask Claude:

### Discover Content
> "What blog posts do I have?"
> "List all my quick posts"
> "What tags do I write about most?"

### Search
> "Find posts about Astro"
> "Show me articles in the deconstruct-personal-website series"
> "Search for posts about accessibility"

### Read Content
> "Show me the full content of my Web AI blog post"
> "What did I write about in my keyboard-enter quick post?"

### Context-Aware Help
> "Based on my blog posts, what technologies do I know?"
> "Reference my blog when helping me with Astro development"

## Architecture

```
src/mcp/
├── server.ts           # Main MCP server implementation
├── blog-reader.ts      # Blog post parsing and querying utilities
├── types.ts            # TypeScript type definitions
└── README.md          # This file
```

### How It Works

1. **Data Loading**: On startup, the server reads all markdown files from `src/data/blog/`
2. **Frontmatter Parsing**: Uses `gray-matter` to extract metadata (title, tags, dates, etc.)
3. **Resource Exposure**: Each post becomes a resource accessible via `blog://post/{id}`
4. **Tool Handlers**: Implements search and query tools using the MCP protocol
5. **Communication**: Uses stdio transport to communicate with MCP clients

## Blog Post Structure

The server reads blog posts from:
```
src/data/blog/
├── en/                           # Language-specific posts
│   ├── deconstruct-personal-website/
│   │   ├── project-init.md
│   │   └── theming.md
│   └── quick-posts/              # Short-form posts
│       ├── keyboard-enter.mdx
│       └── tailwindcss-lit.mdx
└── web-ai.mdx                    # Root-level posts
```

### Frontmatter Schema
```yaml
---
title: "Post Title"
pubDate: 2024-12-19
updatedDate: 2024-12-20  # Optional
description: "Post description"
author: rainforest
image:                    # Optional
  src: "/images/blog/thumbnail.jpeg"
  alt: "Alt text"
tags:
  - astro
  - nx
  - series:deconstruct-personal-website  # Series grouping
  - type:quick-post                      # Special type marker
relatedPosts:             # Optional
  - en/quick-posts/keyboard-enter
---
```

## Troubleshooting

### Server Not Appearing in Claude Desktop
1. Check the configuration file path is correct
2. Verify the absolute paths in the config
3. Restart Claude Desktop completely
4. Check Claude Desktop's logs for errors

### No Posts Showing Up
1. Ensure blog posts are in `src/data/blog/`
2. Verify frontmatter is valid YAML
3. Check file permissions
4. Run manually: `pnpm mcp` to see error messages

### Path Issues
- Always use **absolute paths** in Claude Desktop config
- Use forward slashes even on Windows
- Don't use `~` or environment variables

## Development

### Testing the Server
Run the server manually to test:
```bash
cd apps/personal-website
pnpm mcp
```

The server will output diagnostic info to stderr (won't interfere with MCP communication).

### Modifying the Server
After making changes:
1. Save your modifications
2. Restart Claude Desktop to reload the server
3. Test the new functionality

### Adding New Tools
Edit `server.ts`:
1. Add tool definition in `ListToolsRequestSchema` handler
2. Implement tool logic in `CallToolRequestSchema` handler
3. Update this README with the new tool's documentation

## Related Files

- Blog content: `src/data/blog/`
- Author data: `src/data/authors/`
- Astro content config: `src/content/config.ts`
- Website routes: `src/pages/blog/[...slug].astro`

## Learn More

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Claude Desktop MCP Guide](https://docs.anthropic.com/claude/docs/model-context-protocol)
