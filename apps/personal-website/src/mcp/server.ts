#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  readAllBlogPosts,
  readAllAuthors,
  filterPostsByTag,
  filterPostsBySeries,
  searchPosts,
  getQuickPosts,
  getRegularPosts,
  readBlogPost,
} from './blog-reader.js';
import type { BlogPost } from './types.js';

// Get the directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = dirname(__dirname);
const dataDir = join(srcDir, 'data');
const blogDir = join(dataDir, 'blog');
const authorsDir = join(dataDir, 'authors');

// Initialize data
let allPosts: BlogPost[] = [];
const authors = new Map<string, { name: string; portfolio?: string }>();

/**
 * Loads all blog posts and authors
 */
function loadBlogData() {
  console.error('Loading blog data...');
  allPosts = readAllBlogPosts(blogDir);
  const authorsMap = readAllAuthors(authorsDir);
  authors.clear();
  authorsMap.forEach((author, id) => authors.set(id, author));
  console.error(`Loaded ${allPosts.length} blog posts and ${authors.size} authors`);
}

// Create server instance
const server = new Server(
  {
    name: 'personal-website-blog',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * List available resources (blog posts)
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: allPosts.map((post) => ({
      uri: `blog://post/${post.id}`,
      name: post.title,
      description: post.description,
      mimeType: 'text/markdown',
    })),
  };
});

/**
 * Read a specific resource (blog post content)
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri.toString();

  if (!uri.startsWith('blog://post/')) {
    throw new Error(`Unsupported URI scheme: ${uri}`);
  }

  const postId = uri.replace('blog://post/', '');
  const post = allPosts.find((p) => p.id === postId);

  if (!post) {
    throw new Error(`Blog post not found: ${postId}`);
  }

  // Get author information
  const author = authors.get(post.author);
  const authorInfo = author
    ? `**Author:** ${author.name}${author.portfolio ? ` (${author.portfolio})` : ''}`
    : '';

  // Format metadata
  const metadata = `---
**Title:** ${post.title}
**Published:** ${post.pubDate.toISOString().split('T')[0]}
${post.updatedDate ? `**Updated:** ${post.updatedDate.toISOString().split('T')[0]}` : ''}
${authorInfo}
**Tags:** ${post.tags.join(', ')}
${post.image ? `**Image:** ${post.image.src} (${post.image.alt})` : ''}
---

**Description:** ${post.description}

`;

  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: metadata + post.content,
      },
    ],
  };
});

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_blog_posts',
        description:
          'List all blog posts with metadata (title, description, tags, publication date). Returns a summary of available posts.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['all', 'regular', 'quick'],
              description:
                'Filter posts by type: "all" (default), "regular" (excludes quick posts), or "quick" (only quick posts)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of posts to return (default: all)',
            },
          },
        },
      },
      {
        name: 'search_blog_posts',
        description:
          'Search blog posts by keyword, tag, or series. Searches in title, description, and content.',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Keyword to search for in title, description, and content',
            },
            tag: {
              type: 'string',
              description: 'Filter by specific tag (e.g., "astro", "accessibility")',
            },
            series: {
              type: 'string',
              description:
                'Filter by series name (e.g., "deconstruct-personal-website")',
            },
          },
        },
      },
      {
        name: 'get_blog_post',
        description: 'Get the full content of a specific blog post by its ID',
        inputSchema: {
          type: 'object',
          properties: {
            post_id: {
              type: 'string',
              description:
                'Post ID (e.g., "en/quick-posts/keyboard-enter", "web-ai")',
            },
          },
          required: ['post_id'],
        },
      },
      {
        name: 'get_author_info',
        description: 'Get information about an author',
        inputSchema: {
          type: 'object',
          properties: {
            author_id: {
              type: 'string',
              description: 'Author ID (e.g., "rainforest")',
            },
          },
          required: ['author_id'],
        },
      },
      {
        name: 'get_all_tags',
        description:
          'Get a list of all tags used across blog posts with their usage counts',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

/**
 * Format a blog post summary for tool responses
 */
function formatPostSummary(post: BlogPost): string {
  const author = authors.get(post.author);
  const authorName = author ? author.name : post.author;

  return `**${post.title}** (${post.id})
  - Published: ${post.pubDate.toISOString().split('T')[0]}
  - Author: ${authorName}
  - Tags: ${post.tags.join(', ')}
  - Description: ${post.description}
  - Read: blog://post/${post.id}`;
}

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_blog_posts': {
        const type = (args?.type as string) || 'all';
        const limit = args?.limit as number | undefined;

        let posts: BlogPost[];
        if (type === 'quick') {
          posts = getQuickPosts(allPosts);
        } else if (type === 'regular') {
          posts = getRegularPosts(allPosts);
        } else {
          posts = allPosts;
        }

        if (limit) {
          posts = posts.slice(0, limit);
        }

        const summary = posts.map(formatPostSummary).join('\n\n');
        return {
          content: [
            {
              type: 'text',
              text: `Found ${posts.length} blog posts:\n\n${summary}`,
            },
          ],
        };
      }

      case 'search_blog_posts': {
        const keyword = args?.keyword as string | undefined;
        const tag = args?.tag as string | undefined;
        const series = args?.series as string | undefined;

        let posts = allPosts;

        if (series) {
          posts = filterPostsBySeries(posts, series);
        } else if (tag) {
          posts = filterPostsByTag(posts, tag);
        } else if (keyword) {
          posts = searchPosts(posts, keyword);
        } else {
          return {
            content: [
              {
                type: 'text',
                text: 'Please provide at least one search parameter: keyword, tag, or series',
              },
            ],
          };
        }

        const summary = posts.map(formatPostSummary).join('\n\n');
        return {
          content: [
            {
              type: 'text',
              text: `Found ${posts.length} matching blog posts:\n\n${summary}`,
            },
          ],
        };
      }

      case 'get_blog_post': {
        const postId = args?.post_id as string;
        if (!postId) {
          throw new Error('post_id is required');
        }

        const post = allPosts.find((p) => p.id === postId);
        if (!post) {
          throw new Error(`Blog post not found: ${postId}`);
        }

        const author = authors.get(post.author);
        const authorInfo = author
          ? `${author.name}${author.portfolio ? ` (${author.portfolio})` : ''}`
          : post.author;

        const metadata = `# ${post.title}

**Published:** ${post.pubDate.toISOString().split('T')[0]}
${post.updatedDate ? `**Updated:** ${post.updatedDate.toISOString().split('T')[0]}` : ''}
**Author:** ${authorInfo}
**Tags:** ${post.tags.join(', ')}

**Description:** ${post.description}

---

`;

        return {
          content: [
            {
              type: 'text',
              text: metadata + post.content,
            },
          ],
        };
      }

      case 'get_author_info': {
        const authorId = args?.author_id as string;
        if (!authorId) {
          throw new Error('author_id is required');
        }

        const author = authors.get(authorId);
        if (!author) {
          throw new Error(`Author not found: ${authorId}`);
        }

        const info = `**Name:** ${author.name}
${author.portfolio ? `**Portfolio:** ${author.portfolio}` : ''}`;

        return {
          content: [
            {
              type: 'text',
              text: info,
            },
          ],
        };
      }

      case 'get_all_tags': {
        const tagCounts = new Map<string, number>();

        for (const post of allPosts) {
          for (const tag of post.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }

        const sortedTags = Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([tag, count]) => `- **${tag}**: ${count} post${count > 1 ? 's' : ''}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${tagCounts.size} unique tags:\n\n${sortedTags}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  // Load blog data
  loadBlogData();

  // Create transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Personal Website Blog MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
