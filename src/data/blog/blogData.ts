import { prismaClient } from "@/prisma/db";
import readingTime from "reading-time";
import { API, ArticleType } from "@/app/blog/blog.types";

// Legacy function for compatibility - no longer used with database
function getRawArticleBySlug(slug: string): any {
  throw new Error("getRawArticleBySlug is deprecated - use database instead");
}

async function getAllSlugs(): Promise<Array<string>> {
  try {
    // @ts-ignore - BlogPost model exists in schema but TypeScript may not recognize it yet
    const posts = await prismaClient.blogPost.findMany({
      where: { published: true },
      select: { slug: true }
    });
    return posts.map(post => `${post.slug}.mdx`); // Keep .mdx format for compatibility
  } catch (error) {
    console.error('Error fetching slugs:', error);
    return [];
  }
}

async function getArticleBySlug(slug: string, fields: string[] = []): Promise<ArticleType> {
  const realSlug = slug.replace(/\.mdx$/, "");
  
  try {
    // @ts-ignore - BlogPost model exists in schema but TypeScript may not recognize it yet
    const post = await prismaClient.blogPost.findUnique({
      where: { slug: realSlug }
    });

    if (!post) {
      throw new Error(`Blog post with slug "${realSlug}" not found`);
    }

    const timeReading: any = readingTime(post.content);
    const items: Partial<ArticleType> = {};

    fields.forEach((field) => {
      if (field === "slug") {
        items[field] = realSlug;
      }
      if (field === "content") {
        items[field] = post.content;
      }
      if (field === "timeReading") {
        items[field] = timeReading;
      }
      if (field === "title") {
        items[field] = post.title;
      }
      if (field === "description") {
        items[field] = post.description;
      }
      if (field === "date") {
        items[field] = post.date;
      }
      if (field === "ogImage") {
        items[field] = {
          url: post.ogImageUrl || '/images/og-image.png'
        };
      }
      if (field === "coverImage") {
        items[field] = post.ogImageUrl || '/images/og-image.png';
      }
      if (field === "excerpt") {
        // Generate excerpt from content (first 150 characters)
        items[field] = post.content.replace(/[#*`]/g, '').substring(0, 150) + '...';
      }
      if (field === "author") {
        // Default author - you can make this dynamic later
        items[field] = {
          name: "Admin",
          picture: "/default-author.jpg"
        };
      }
      if (field === "tags") {
        // Default empty tags - you can add a tags field to your schema later
        items[field] = [];
      }
    });

    return items as ArticleType;
  } catch (error) {
    console.error('Error fetching article by slug:', error);
    throw error;
  }
}

async function getAllArticles(fields: string[] = []): Promise<Array<ArticleType>> {
  try {
    const slugs = await getAllSlugs();
    const articles = await Promise.all(
      slugs.map((slug) => getArticleBySlug(slug, fields))
    );
    
    // Sort by date (newest first)
    return articles.sort((article1, article2) => 
      new Date(article2.date).getTime() - new Date(article1.date).getTime()
    );
  } catch (error) {
    console.error('Error fetching all articles:', error);
    return [];
  }
}

async function getArticlesByTag(
  tag: string,
  fields: string[] = []
): Promise<Array<ArticleType>> {
  const articles = await getAllArticles(fields);
  return articles.filter((article) => {
    const tags = article.tags ?? [];
    return tags.includes(tag);
  });
}

async function getAllTags(): Promise<Array<string>> {
  const articles = await getAllArticles(["tags"]);
  const allTags = new Set<string>();
  articles.forEach((article) => {
    const tags = article.tags as Array<string>;
    tags.forEach((tag) => allTags.add(tag));
  });
  return Array.from(allTags);
}

export const api: API = {
  getRawArticleBySlug,
  getAllSlugs,
  getAllArticles,
  getArticlesByTag,
  getArticleBySlug,
  getAllTags,
};
