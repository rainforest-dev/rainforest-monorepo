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
