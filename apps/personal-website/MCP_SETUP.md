# MCP Server Setup - Quick Start

This guide will help you quickly set up the MCP server to expose your blog content to AI tools like Claude Desktop.

## What is This?

The MCP (Model Context Protocol) server allows AI assistants to:
- ✅ Read your published blog posts
- ✅ Search your content by tags, keywords, or series
- ✅ Understand your expertise and knowledge domains
- ✅ Provide context-aware assistance based on your writing

## Quick Setup (Claude Desktop)

### 1. Ensure Dependencies are Installed
```bash
cd apps/personal-website
pnpm install
```

### 2. Configure Claude Desktop

**Find your config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Add this configuration** (replace `/path/to/rainforest-monorepo` with your actual path):

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

💡 **Pro tip**: To get your full path, run:
```bash
pwd
```
in the `/rainforest-monorepo` directory.

### 3. Restart Claude Desktop

Completely quit and restart Claude Desktop for the changes to take effect.

### 4. Verify It's Working

In Claude Desktop, try asking:
> "What blog posts do I have available?"

> "List all tags I write about"

> "Show me posts about Astro"

If it works, Claude will be able to access and search through your blog content!

## What You Can Do Now

### Discover Your Content
- "What topics do I write about?"
- "List my most recent blog posts"
- "Show me all my quick posts"

### Search
- "Find posts about accessibility"
- "Show me articles in the deconstruct-personal-website series"
- "Search for content about Tailwind CSS"

### Get Full Content
- "Read my Web AI blog post"
- "Show me the content of project-init in my deconstruct series"

### Context-Aware Help
- "Based on my blog, help me write about Astro routing"
- "Reference my existing posts when explaining Material Design 3"
- "What do I already know about web components?"

## Troubleshooting

### MCP Server Not Showing Up?
1. ✅ Double-check the path in your config is absolute (no `~`)
2. ✅ Make sure you completely restarted Claude Desktop
3. ✅ Verify pnpm is in your PATH: `which pnpm`
4. ✅ Test manually: `cd apps/personal-website && pnpm mcp`

### Server Errors?
Run the server manually to see error messages:
```bash
cd apps/personal-website
pnpm mcp
```

Press `Ctrl+C` to stop the server.

## Alternative Configuration (using tsx directly)

If pnpm isn't in your PATH or you prefer using Node directly:

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

## Learn More

📖 For detailed documentation, see [src/mcp/README.md](src/mcp/README.md)

This includes:
- Complete API reference for all tools
- Architecture details
- Development guide
- Advanced configuration options

## Available Resources & Tools

### Resources
- Each blog post as `blog://post/{id}`
- Includes full content, metadata, and author info

### Tools
- `list_blog_posts` - List posts with filtering
- `search_blog_posts` - Search by keyword, tag, or series
- `get_blog_post` - Get full post content
- `get_author_info` - Author details
- `get_all_tags` - List all tags with counts

## Next Steps

Once working, your AI assistant will automatically have context about:
- Your technical skills and expertise
- Technologies you work with (Astro, Nx, Lit, Tailwind, etc.)
- Your writing style and communication preferences
- Specific projects and series you've documented

This makes AI assistance much more personalized and relevant to your actual experience and knowledge!

---

**Need help?** See the detailed guide at [src/mcp/README.md](src/mcp/README.md)
