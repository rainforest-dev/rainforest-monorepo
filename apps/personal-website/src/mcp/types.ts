/**
 * Blog post metadata structure matching Astro Content Collections schema
 */
export interface BlogPostMetadata {
  title: string;
  pubDate: Date;
  updatedDate?: Date;
  description: string;
  author: string;
  image?: {
    src: string;
    alt: string;
  };
  tags: string[];
  relatedPosts?: string[];
}

/**
 * Complete blog post with content
 */
export interface BlogPost extends BlogPostMetadata {
  id: string; // File path relative to data/blog (e.g., "en/quick-posts/keyboard-enter")
  content: string; // Full markdown/mdx content
}

/**
 * Author information
 */
export interface Author {
  name: string;
  portfolio?: string;
}

/**
 * Organization (company or educational institution)
 */
export interface Organization {
  id: string; // File path (e.g., "en/codegreen")
  name: string;
  language: string;
  department?: string;
  link?: string;
}

/**
 * Experience entry (job or education)
 */
export interface Experience {
  id: string; // File path (e.g., "en/6")
  type: 'job' | 'education';
  language: string;
  organization: string; // Reference to organization ID
  position: string;
  startAt: Date;
  endAt?: Date;
  technologies?: string[];
  projects?: string[]; // References to project IDs
  content: string; // Markdown description
}

/**
 * Project entry
 */
export interface Project {
  id: string; // File path (e.g., "en/hashgreen-dex")
  name: string;
  language: string;
  technologies: string[];
  organization: string; // Reference to organization ID
  experience: string; // Reference to experience ID
  content: string; // Markdown description
}

/**
 * Skill entry
 */
export interface Skill {
  id: string; // File path (e.g., "en/nextjs")
  name: string;
  icon: string;
  tags?: string[];
  content: string; // Markdown description
}
