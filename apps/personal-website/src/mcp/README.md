# Personal Website MCP Server

This MCP (Model Context Protocol) server exposes your complete professional profile, including blog content, work experience, education, skills, and projects, to AI tools like Claude Desktop. This enables deeply personalized, context-aware AI assistance that understands your background and expertise.

## Overview

The MCP server provides:
- **Resources**: Direct access to blog posts, experiences, projects, and skills via URIs
- **Tools**: Comprehensive query and search capabilities across all personal data

This allows AI assistants to:
- **Understand you completely**: Access your full professional background
- **Know your expertise**: Learn your skills, technologies, and experience level
- **Reference your work**: Cite your projects and blog posts
- **Personalize responses**: Tailor advice to your actual knowledge and experience
- **Save context**: No need to repeatedly explain your background

## Features

### Resources

**Blog Posts** (`blog://post/{id}`):
- Full markdown/MDX content
- Metadata (title, description, publication date, tags)
- Author information
- Images and related posts

**Experiences** (`profile://experience/{id}`):
- Work history and education
- Job titles and positions
- Organizations and duration
- Technologies used
- Related projects

**Projects** (`profile://project/{id}`):
- Project names and descriptions
- Technologies and tools used
- Associated organizations
- Full markdown content

**Skills** (`profile://skill/{id}`):
- Skill names and categories
- Detailed descriptions
- Tags (prioritized, frontend, languages, etc.)
- Experience level context

### Tools

#### Blog Tools

1. **`list_blog_posts`** - List all blog posts with metadata
   - Filter by type: all, regular, or quick posts
   - Limit number of results

2. **`search_blog_posts`** - Search for posts
   - By keyword (searches title, description, and content)
   - By tag (e.g., "astro", "accessibility", "ai")
   - By series (e.g., "deconstruct-personal-website")

3. **`get_blog_post`** - Get full content of a specific post
   - Returns complete markdown with metadata

4. **`get_all_tags`** - List all tags with usage counts
   - Helps discover topics you write about

#### Personal Profile Tools

5. **`get_profile_summary`** - Comprehensive professional overview
   - Top work experiences
   - Education background
   - Key skills and technologies
   - Recent projects
   - Perfect for "tell me about yourself" queries

6. **`get_work_experience`** - Detailed work history
   - Chronological job history
   - Positions and organizations
   - Technologies used in each role
   - Related projects
   - Optional language and limit filters

7. **`get_education`** - Academic background
   - Degrees and institutions
   - Departments and specializations
   - Duration and dates

8. **`get_projects`** - Portfolio projects
   - All projects with descriptions
   - Filter by technology
   - Organization context
   - Full markdown content

9. **`get_skills`** - Technical skills
   - All skills with descriptions
   - Filter by tag (prioritized, frontend, languages)
   - Detailed experience context

10. **`search_by_technology`** - Find by technology
    - Search experiences using a specific technology
    - Search projects using a specific technology
    - See your complete history with any tech stack

11. **`get_all_technologies`** - List all technologies
    - Complete list of technologies used
    - Derived from experiences and projects

#### Author Tools

12. **`get_author_info`** - Get author information
    - Name and portfolio URL

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

**Important**: Replace `/path/to/rainforest-monorepo` with the actual absolute path to your monorepo.

Alternative using pnpm:
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

3. **Restart Claude Desktop**

The MCP server will automatically start when Claude Desktop launches.

## Usage Examples

Once configured, you can ask Claude:

### Get to Know You
> "Get my profile summary"
> "What's my work experience?"
> "What's my education background?"
> "What are my key skills?"
> "What projects have I worked on?"

### Search by Technology
> "What technologies do I know?"
> "Find all my experience with Next.js"
> "Show me projects that used React"
> "What have I built with Tailwind CSS?"

### Discover Blog Content
> "What blog posts do I have?"
> "List all my quick posts"
> "What tags do I write about most?"
> "Find posts about Astro"
> "Show me articles in the deconstruct-personal-website series"

### Read Specific Content
> "Show me the full content of my Web AI blog post"
> "What did I write about in my keyboard-enter quick post?"
> "Tell me about my Hashgreen Dex project"
> "What do I know about Python?"

### Highly Personalized Assistance
> "Help me build a new app using technologies I already know"
> "Based on my experience, suggest what I should learn next"
> "Reference my blog posts when explaining this concept"
> "You know my background - help me write about Nx"
> "Speak to me like you understand my skill level"
> "What would be a good next project for someone with my experience?"

## Architecture

```
src/mcp/
├── server.ts                # Main MCP server implementation
├── blog-reader.ts          # Blog post parsing and querying utilities
├── personal-data-reader.ts # Personal data (experiences, projects, skills) parsing
├── types.ts                # TypeScript type definitions
└── README.md              # This file
```

### How It Works

1. **Data Loading**: On startup, the server reads all content from multiple sources:
   - Blog posts from `src/data/blog/`
   - Experiences from `src/data/experiences/`
   - Organizations from `src/data/organizations/`
   - Projects from `src/data/projects/`
   - Skills from `src/data/skills/`
   - Authors from `src/data/authors/`

2. **Parsing**: Uses `gray-matter` to extract frontmatter from markdown files and parses JSON for structured data

3. **Resource Exposure**: All content becomes accessible via URI schemes:
   - `blog://post/{id}` - Blog posts
   - `profile://experience/{id}` - Work/education experiences
   - `profile://project/{id}` - Projects
   - `profile://skill/{id}` - Skills

4. **Tool Handlers**: Implements comprehensive search and query tools using the MCP protocol

5. **Communication**: Uses stdio transport to communicate with MCP clients

## Data Structure

The server reads from multiple data collections:
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
