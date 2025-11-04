import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import type { Author, BlogPost, BlogPostMetadata } from './types';

/**
 * Recursively finds all markdown files in a directory
 */
function findMarkdownFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findMarkdownFiles(fullPath, baseDir));
      } else if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
        // Store relative path from baseDir
        files.push(relative(baseDir, fullPath));
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}

/**
 * Reads and parses a single blog post
 */
export function readBlogPost(blogDir: string, relativePath: string): BlogPost | null {
  try {
    const fullPath = join(blogDir, relativePath);
    const fileContent = readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(fileContent);

    // Convert relative path to post ID (remove extension)
    const id = relativePath.replace(/\.(md|mdx)$/, '');

    // Parse dates
    const pubDate = data.pubDate ? new Date(data.pubDate) : new Date();
    const updatedDate = data.updatedDate ? new Date(data.updatedDate) : undefined;

    const post: BlogPost = {
      id,
      title: data.title || 'Untitled',
      pubDate,
      updatedDate,
      description: data.description || '',
      author: typeof data.author === 'string' ? data.author : 'unknown',
      image: data.image,
      tags: Array.isArray(data.tags) ? data.tags : [],
      relatedPosts: Array.isArray(data.relatedPosts) ? data.relatedPosts : [],
      content,
    };

    return post;
  } catch (error) {
    console.error(`Error reading blog post ${relativePath}:`, error);
    return null;
  }
}

/**
 * Reads all blog posts from the data/blog directory
 */
export function readAllBlogPosts(blogDir: string): BlogPost[] {
  const markdownFiles = findMarkdownFiles(blogDir);
  const posts: BlogPost[] = [];

  for (const file of markdownFiles) {
    const post = readBlogPost(blogDir, file);
    if (post) {
      posts.push(post);
    }
  }

  // Sort by publication date (newest first)
  return posts.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

/**
 * Reads author information from JSON file
 */
export function readAuthor(authorsDir: string, authorId: string): Author | null {
  try {
    const filePath = join(authorsDir, `${authorId}.json`);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Author;
  } catch (error) {
    console.error(`Error reading author ${authorId}:`, error);
    return null;
  }
}

/**
 * Reads all authors
 */
export function readAllAuthors(authorsDir: string): Map<string, Author> {
  const authors = new Map<string, Author>();

  try {
    const files = readdirSync(authorsDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const authorId = file.replace('.json', '');
      const author = readAuthor(authorsDir, authorId);
      if (author) {
        authors.set(authorId, author);
      }
    }
  } catch (error) {
    console.error(`Error reading authors directory:`, error);
  }

  return authors;
}

/**
 * Filters blog posts by tags
 */
export function filterPostsByTag(posts: BlogPost[], tag: string): BlogPost[] {
  return posts.filter((post) => post.tags.includes(tag));
}

/**
 * Filters blog posts by series
 */
export function filterPostsBySeries(posts: BlogPost[], series: string): BlogPost[] {
  return filterPostsByTag(posts, `series:${series}`);
}

/**
 * Searches blog posts by keyword (searches in title, description, and content)
 */
export function searchPosts(posts: BlogPost[], keyword: string): BlogPost[] {
  const lowerKeyword = keyword.toLowerCase();

  return posts.filter(
    (post) =>
      post.title.toLowerCase().includes(lowerKeyword) ||
      post.description.toLowerCase().includes(lowerKeyword) ||
      post.content.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Gets quick posts only
 */
export function getQuickPosts(posts: BlogPost[]): BlogPost[] {
  return filterPostsByTag(posts, 'type:quick-post');
}

/**
 * Gets regular posts (excludes quick posts)
 */
export function getRegularPosts(posts: BlogPost[]): BlogPost[] {
  return posts.filter((post) => !post.tags.includes('type:quick-post'));
}
