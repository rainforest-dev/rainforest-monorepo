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
import {
  readAllExperiences,
  readAllOrganizations,
  readAllProjects,
  readAllSkills,
  filterExperiencesByType,
  filterExperiencesByTechnology,
  filterProjectsByTechnology,
  filterSkillsByTag,
  getAllTechnologies,
  resolveOrganization,
  resolveProjects,
} from './personal-data-reader.js';
import type { BlogPost, Experience, Organization, Project, Skill } from './types.js';

// Get the directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = dirname(__dirname);
const dataDir = join(srcDir, 'data');
const blogDir = join(dataDir, 'blog');
const authorsDir = join(dataDir, 'authors');
const experiencesDir = join(dataDir, 'experiences');
const organizationsDir = join(dataDir, 'organizations');
const projectsDir = join(dataDir, 'projects');
const skillsDir = join(dataDir, 'skills');

// Initialize data
let allPosts: BlogPost[] = [];
const authors = new Map<string, { name: string; portfolio?: string }>();
let allExperiences: Experience[] = [];
let allOrganizations: Organization[] = [];
let allProjects: Project[] = [];
let allSkills: Skill[] = [];

/**
 * Loads all blog posts, personal data, and authors
 */
function loadAllData() {
  console.error('Loading personal data...');

  // Load blog data
  allPosts = readAllBlogPosts(blogDir);
  const authorsMap = readAllAuthors(authorsDir);
  authors.clear();
  authorsMap.forEach((author, id) => authors.set(id, author));

  // Load personal data
  allExperiences = readAllExperiences(experiencesDir);
  allOrganizations = readAllOrganizations(organizationsDir);
  allProjects = readAllProjects(projectsDir);
  allSkills = readAllSkills(skillsDir);

  console.error(
    `Loaded ${allPosts.length} blog posts, ${allExperiences.length} experiences, ` +
    `${allOrganizations.length} organizations, ${allProjects.length} projects, ` +
    `${allSkills.length} skills, and ${authors.size} authors`
  );
}

// Create server instance
const server = new Server(
  {
    name: 'personal-website',
    version: '2.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * List available resources (blog posts and personal data)
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [
    // Blog posts
    ...allPosts.map((post) => ({
      uri: `blog://post/${post.id}`,
      name: `Blog: ${post.title}`,
      description: post.description,
      mimeType: 'text/markdown',
    })),
    // Experiences
    ...allExperiences.map((exp) => ({
      uri: `profile://experience/${exp.id}`,
      name: `${exp.type === 'job' ? 'Work' : 'Education'}: ${exp.position}`,
      description: `${exp.position} (${exp.startAt.toISOString().slice(0, 7)})`,
      mimeType: 'text/markdown',
    })),
    // Projects
    ...allProjects.map((proj) => ({
      uri: `profile://project/${proj.id}`,
      name: `Project: ${proj.name}`,
      description: `Technologies: ${proj.technologies.join(', ')}`,
      mimeType: 'text/markdown',
    })),
    // Skills
    ...allSkills.map((skill) => ({
      uri: `profile://skill/${skill.id}`,
      name: `Skill: ${skill.name}`,
      description: skill.tags?.join(', ') || 'Technical skill',
      mimeType: 'text/markdown',
    })),
  ];

  return { resources };
});

/**
 * Read a specific resource (blog post, experience, project, or skill)
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri.toString();

  // Handle blog posts
  if (uri.startsWith('blog://post/')) {
    const postId = uri.replace('blog://post/', '');
    const post = allPosts.find((p) => p.id === postId);

    if (!post) {
      throw new Error(`Blog post not found: ${postId}`);
    }

    const author = authors.get(post.author);
    const authorInfo = author
      ? `**Author:** ${author.name}${author.portfolio ? ` (${author.portfolio})` : ''}`
      : '';

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
  }

  // Handle experiences
  if (uri.startsWith('profile://experience/')) {
    const expId = uri.replace('profile://experience/', '');
    const exp = allExperiences.find((e) => e.id === expId);

    if (!exp) {
      throw new Error(`Experience not found: ${expId}`);
    }

    const org = resolveOrganization(allOrganizations, exp.organization);
    const orgName = org ? org.name + (org.department ? ` - ${org.department}` : '') : exp.organization;
    const endDate = exp.endAt ? exp.endAt.toISOString().slice(0, 7) : 'Present';

    const metadata = `---
**${exp.type === 'job' ? 'Work Experience' : 'Education'}**
**Position:** ${exp.position}
**Organization:** ${orgName}${org?.link ? ` (${org.link})` : ''}
**Duration:** ${exp.startAt.toISOString().slice(0, 7)} - ${endDate}
${exp.technologies && exp.technologies.length > 0 ? `**Technologies:** ${exp.technologies.join(', ')}` : ''}
${exp.projects && exp.projects.length > 0 ? `**Projects:** ${exp.projects.join(', ')}` : ''}
---

`;

    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: metadata + exp.content,
        },
      ],
    };
  }

  // Handle projects
  if (uri.startsWith('profile://project/')) {
    const projId = uri.replace('profile://project/', '');
    const proj = allProjects.find((p) => p.id === projId);

    if (!proj) {
      throw new Error(`Project not found: ${projId}`);
    }

    const org = resolveOrganization(allOrganizations, proj.organization);
    const orgName = org ? org.name : proj.organization;

    const metadata = `---
**Project:** ${proj.name}
**Organization:** ${orgName}${org?.link ? ` (${org.link})` : ''}
**Technologies:** ${proj.technologies.join(', ')}
---

`;

    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: metadata + proj.content,
        },
      ],
    };
  }

  // Handle skills
  if (uri.startsWith('profile://skill/')) {
    const skillId = uri.replace('profile://skill/', '');
    const skill = allSkills.find((s) => s.id === skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const metadata = `---
**Skill:** ${skill.name}
**Icon:** ${skill.icon}
${skill.tags && skill.tags.length > 0 ? `**Tags:** ${skill.tags.join(', ')}` : ''}
---

`;

    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: metadata + skill.content,
        },
      ],
    };
  }

  throw new Error(`Unsupported URI scheme: ${uri}`);
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
      // Personal profile tools
      {
        name: 'get_profile_summary',
        description:
          'Get a comprehensive summary of the person including work experience, education, skills, and recent projects. Perfect for understanding who this person is and their expertise.',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['en', 'zh'],
              description: 'Language preference (default: "en")',
            },
          },
        },
      },
      {
        name: 'get_work_experience',
        description: 'Get detailed work experience history',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['en', 'zh'],
              description: 'Language preference (default: "en")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of experiences to return',
            },
          },
        },
      },
      {
        name: 'get_education',
        description: 'Get education history',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['en', 'zh'],
              description: 'Language preference (default: "en")',
            },
          },
        },
      },
      {
        name: 'get_projects',
        description: 'Get portfolio projects with optional technology filtering',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['en', 'zh'],
              description: 'Language preference (default: "en")',
            },
            technology: {
              type: 'string',
              description:
                'Filter by technology (e.g., "nextjs", "react", "tailwindcss")',
            },
          },
        },
      },
      {
        name: 'get_skills',
        description: 'Get technical skills with optional tag filtering',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['en', 'zh'],
              description: 'Language preference (default: "en")',
            },
            tag: {
              type: 'string',
              description:
                'Filter by tag (e.g., "prioritized", "frontend", "languages")',
            },
          },
        },
      },
      {
        name: 'search_by_technology',
        description:
          'Search for experiences and projects that used a specific technology',
        inputSchema: {
          type: 'object',
          properties: {
            technology: {
              type: 'string',
              description:
                'Technology to search for (e.g., "nextjs", "react", "python")',
            },
            language: {
              type: 'string',
              enum: ['en', 'zh'],
              description: 'Language preference (default: "en")',
            },
          },
          required: ['technology'],
        },
      },
      {
        name: 'get_all_technologies',
        description:
          'Get a list of all technologies/tools used across experiences and projects',
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

      case 'get_profile_summary': {
        const language = (args?.language as string) || 'en';

        // Filter by language
        const experiences = allExperiences.filter((e) => e.language === language);
        const projects = allProjects.filter((p) => p.language === language);
        const skills = allSkills.filter((s) => s.id.startsWith(`${language}/`));

        // Get work experience (top 3)
        const work = filterExperiencesByType(experiences, 'job').slice(0, 3);
        const education = filterExperiencesByType(experiences, 'education');

        // Get prioritized skills
        const prioritizedSkills = filterSkillsByTag(skills, 'prioritized');

        // Get all technologies
        const technologies = getAllTechnologies(experiences, projects);

        // Format author info
        const author = Array.from(authors.values())[0];
        const authorInfo = author
          ? `**Name:** ${author.name}\n**Portfolio:** ${author.portfolio || 'N/A'}`
          : '';

        let summary = `# Professional Profile\n\n${authorInfo}\n\n`;

        // Work Experience
        summary += `## Work Experience (${work.length} most recent)\n\n`;
        for (const exp of work) {
          const org = resolveOrganization(allOrganizations, exp.organization);
          const orgName = org ? org.name : exp.organization;
          const endDate = exp.endAt ? exp.endAt.toISOString().slice(0, 7) : 'Present';
          summary += `### ${exp.position} @ ${orgName}\n`;
          summary += `**Duration:** ${exp.startAt.toISOString().slice(0, 7)} - ${endDate}\n`;
          if (exp.technologies && exp.technologies.length > 0) {
            summary += `**Technologies:** ${exp.technologies.join(', ')}\n`;
          }
          summary += `\n`;
        }

        // Education
        if (education.length > 0) {
          summary += `\n## Education\n\n`;
          for (const edu of education) {
            const org = resolveOrganization(allOrganizations, edu.organization);
            const orgName = org
              ? org.name + (org.department ? ` - ${org.department}` : '')
              : edu.organization;
            summary += `- **${edu.position}** at ${orgName} (${edu.startAt.toISOString().slice(0, 7)})\n`;
          }
        }

        // Skills
        if (prioritizedSkills.length > 0) {
          summary += `\n## Key Skills\n\n`;
          summary += prioritizedSkills.map((s) => `- ${s.name}`).join('\n');
        }

        // Technologies
        summary += `\n\n## Technologies & Tools\n\n`;
        summary += `${technologies.join(', ')}`;

        // Projects
        if (projects.length > 0) {
          summary += `\n\n## Projects (${projects.length} total)\n\n`;
          for (const proj of projects.slice(0, 5)) {
            summary += `- **${proj.name}** (${proj.technologies.join(', ')})\n`;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        };
      }

      case 'get_work_experience': {
        const language = (args?.language as string) || 'en';
        const limit = args?.limit as number | undefined;

        let experiences = filterExperiencesByType(allExperiences, 'job').filter(
          (e) => e.language === language
        );

        if (limit) {
          experiences = experiences.slice(0, limit);
        }

        let result = `# Work Experience (${experiences.length} positions)\n\n`;

        for (const exp of experiences) {
          const org = resolveOrganization(allOrganizations, exp.organization);
          const orgName = org ? org.name : exp.organization;
          const orgLink = org?.link ? ` (${org.link})` : '';
          const endDate = exp.endAt ? exp.endAt.toISOString().slice(0, 7) : 'Present';

          result += `## ${exp.position}\n`;
          result += `**Organization:** ${orgName}${orgLink}\n`;
          result += `**Duration:** ${exp.startAt.toISOString().slice(0, 7)} - ${endDate}\n`;

          if (exp.technologies && exp.technologies.length > 0) {
            result += `**Technologies:** ${exp.technologies.join(', ')}\n`;
          }

          if (exp.projects && exp.projects.length > 0) {
            result += `**Projects:** ${exp.projects.join(', ')}\n`;
          }

          result += `\n${exp.content}\n\n---\n\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'get_education': {
        const language = (args?.language as string) || 'en';

        const education = filterExperiencesByType(allExperiences, 'education').filter(
          (e) => e.language === language
        );

        let result = `# Education (${education.length} entries)\n\n`;

        for (const edu of education) {
          const org = resolveOrganization(allOrganizations, edu.organization);
          const orgName = org ? org.name : edu.organization;
          const department = org?.department ? ` - ${org.department}` : '';
          const orgLink = org?.link ? ` (${org.link})` : '';
          const endDate = edu.endAt ? edu.endAt.toISOString().slice(0, 7) : 'Present';

          result += `## ${edu.position}\n`;
          result += `**Institution:** ${orgName}${department}${orgLink}\n`;
          result += `**Duration:** ${edu.startAt.toISOString().slice(0, 7)} - ${endDate}\n\n`;
          result += `${edu.content}\n\n---\n\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'get_projects': {
        const language = (args?.language as string) || 'en';
        const technology = args?.technology as string | undefined;

        let projects = allProjects.filter((p) => p.language === language);

        if (technology) {
          projects = filterProjectsByTechnology(projects, technology);
        }

        let result = `# Projects (${projects.length} total)\n\n`;

        for (const proj of projects) {
          const org = resolveOrganization(allOrganizations, proj.organization);
          const orgName = org ? org.name : proj.organization;

          result += `## ${proj.name}\n`;
          result += `**Organization:** ${orgName}\n`;
          result += `**Technologies:** ${proj.technologies.join(', ')}\n`;
          result += `**URI:** profile://project/${proj.id}\n\n`;
          result += `${proj.content}\n\n---\n\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'get_skills': {
        const language = (args?.language as string) || 'en';
        const tag = args?.tag as string | undefined;

        let skills = allSkills.filter((s) => s.id.startsWith(`${language}/`));

        if (tag) {
          skills = filterSkillsByTag(skills, tag);
        }

        let result = `# Skills (${skills.length} total)\n\n`;

        for (const skill of skills) {
          result += `## ${skill.name}\n`;
          if (skill.tags && skill.tags.length > 0) {
            result += `**Tags:** ${skill.tags.join(', ')}\n`;
          }
          result += `**URI:** profile://skill/${skill.id}\n\n`;
          result += `${skill.content}\n\n---\n\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'search_by_technology': {
        const technology = args?.technology as string;
        if (!technology) {
          throw new Error('technology is required');
        }

        const language = (args?.language as string) || 'en';

        const experiences = filterExperiencesByTechnology(
          allExperiences.filter((e) => e.language === language),
          technology
        );

        const projects = filterProjectsByTechnology(
          allProjects.filter((p) => p.language === language),
          technology
        );

        let result = `# Results for technology: "${technology}"\n\n`;

        if (experiences.length > 0) {
          result += `## Experiences (${experiences.length})\n\n`;
          for (const exp of experiences) {
            const org = resolveOrganization(allOrganizations, exp.organization);
            const orgName = org ? org.name : exp.organization;
            const endDate = exp.endAt ? exp.endAt.toISOString().slice(0, 7) : 'Present';
            result += `- **${exp.position}** @ ${orgName} (${exp.startAt.toISOString().slice(0, 7)} - ${endDate})\n`;
          }
        }

        if (projects.length > 0) {
          result += `\n## Projects (${projects.length})\n\n`;
          for (const proj of projects) {
            const org = resolveOrganization(allOrganizations, proj.organization);
            const orgName = org ? org.name : proj.organization;
            result += `- **${proj.name}** @ ${orgName}\n`;
          }
        }

        if (experiences.length === 0 && projects.length === 0) {
          result += `\nNo experiences or projects found using "${technology}".`;
        }

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'get_all_technologies': {
        const technologies = getAllTechnologies(allExperiences, allProjects);

        const techList = technologies.map((tech) => `- ${tech}`).join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `# All Technologies (${technologies.length} total)\n\n${techList}`,
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
  // Load all data
  loadAllData();

  // Create transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Personal Website MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
