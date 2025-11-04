# MCP Server Setup - Quick Start

This guide will help you quickly set up the MCP server to expose your complete personal and professional context to AI tools like Claude Desktop.

## What is This?

The MCP (Model Context Protocol) server allows AI assistants to:
- ✅ Read your published blog posts
- ✅ Access your work experience and education history
- ✅ Understand your skills and technologies you know
- ✅ Learn about your projects and portfolio
- ✅ Search your content by tags, keywords, technologies, or series
- ✅ Provide highly personalized, context-aware assistance
- ✅ Respond as if they truly know you and your expertise

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
    "personal-website": {
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
> "Get my profile summary"

> "What's my work experience?"

> "What technologies do I know?"

If it works, Claude will have full access to your professional profile and can respond in a highly personalized way!

## What You Can Do Now

### Get to Know You
- **"Get my profile summary"** - Comprehensive overview of your experience, skills, and projects
- **"What's my work experience?"** - Detailed work history
- **"What's my education background?"** - Academic credentials
- **"What are my key skills?"** - Technical skills and expertise
- **"What projects have I worked on?"** - Portfolio of projects

### Search Your Knowledge
- **"What technologies do I know?"** - List all technologies you've used
- **"Find all my experience with Next.js"** - Search by specific technology
- **"Show me posts about Astro"** - Search blog by keyword
- **"What articles are in my deconstruct-personal-website series?"** - Filter by series

### Context-Aware Assistance
- **"Help me build a new React app using technologies I already know"**
- **"Based on my experience, suggest what I should learn next"**
- **"Reference my blog posts when explaining web components to me"**
- **"You know my background - help me write a technical article about Nx"**
- **"Speak to me like you know my skill level"**

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
    "personal-website": {
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
- Complete API reference for all tools and resources
- Architecture details
- Development guide
- Advanced configuration options

## Available Resources & Tools

### Resources (Direct Access)
- **Blog posts**: `blog://post/{id}` - Full blog content with metadata
- **Experiences**: `profile://experience/{id}` - Work and education history
- **Projects**: `profile://project/{id}` - Portfolio projects with descriptions
- **Skills**: `profile://skill/{id}` - Technical skills with detailed info

### Tools (Query & Search)

**Blog Tools:**
- `list_blog_posts` - List posts with filtering
- `search_blog_posts` - Search by keyword, tag, or series
- `get_blog_post` - Get full post content
- `get_all_tags` - List all tags with counts

**Personal Profile Tools:**
- `get_profile_summary` - Comprehensive professional overview
- `get_work_experience` - Detailed work history
- `get_education` - Academic background
- `get_projects` - Portfolio projects (with tech filtering)
- `get_skills` - Technical skills (with tag filtering)
- `search_by_technology` - Find experiences/projects by technology
- `get_all_technologies` - List all technologies used

**Author Tools:**
- `get_author_info` - Author details and portfolio

## Next Steps

Once working, your AI assistant will automatically have deep context about:
- **Professional Background**: Your complete work history and roles
- **Education**: Your academic credentials and degrees
- **Technical Skills**: All technologies and tools you know
- **Project Portfolio**: Everything you've built and shipped
- **Blog Content**: Your technical writing and knowledge sharing
- **Communication Style**: How you explain and teach concepts
- **Expertise Level**: Your depth of knowledge in various domains

**The Result:** AI assistance that feels like it comes from someone who truly knows you, your experience, and your skill level. Every response will be personalized to your actual knowledge and background!

---

**Need help?** See the detailed guide at [src/mcp/README.md](src/mcp/README.md)
