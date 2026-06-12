import React from "react";
import readingTime from "reading-time";
import { Metadata } from "next";
import Article from "@/components/Blog/Article/Article";
import { Footer } from "@/components/Footer/Footer";
import {
  openGraphImageUrl,
  twitterHandle,
  twitterMakerHandle,
  websiteUrl,
} from "@/config";
import { getOpenGraph } from "@/components/OpenGraph/OpenGraph";
import { getSEOTags } from "@/components/SEOTags/SEOTags";

const getBlogData = async (slug: string) => {
  // Get the blog post from database
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
  const response = await fetch(`${baseUrl}/api/admin/blog-posts/${slug}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch blog post');
  }

  const article = await response.json();
  const content = article.content;
  const readTime = readingTime(content);

  return {
    readTime,
    frontMatter: {
      title: article.title,
      description: article.description,
      date: article.date,
      ogImage: {
        url: article.ogImageUrl || '/images/og-image.png'
      }
    },
    content
  };
};

type Props = {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.slug;
  const { frontMatter } = await getBlogData(slug);

  return {
    ...getSEOTags({
      metadataBase: new URL(websiteUrl),
      title: frontMatter.title,
      description: frontMatter.description,
      alternates: {
        canonical: `/blog/${slug}`,
      },
    }),
    ...getOpenGraph({
      websiteUrl: `/blog/${slug}`,
      title: frontMatter.title,
      description: frontMatter.description,
      imageUrl: frontMatter.ogImage.url,
      twitterImageUrl: openGraphImageUrl,
      twitterHandle: twitterHandle,
      twitterMakerHandle: twitterMakerHandle,
    }),
  };
}

const BlogPage = async ({ params }: Props) => {
  const slug = params.slug;
  const { readTime, frontMatter, content } = await getBlogData(slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: frontMatter.title,
    description: frontMatter.description,
    datePublished: frontMatter.date,
    image: frontMatter.ogImage.url.startsWith("http")
      ? frontMatter.ogImage.url
      : `${websiteUrl}${frontMatter.ogImage.url}`,
    url: `${websiteUrl}/blog/${slug}`,
    author: {
      "@type": "Organization",
      name: "Who Needs a Writer",
    },
    publisher: {
      "@type": "Organization",
      name: "Who Needs a Writer",
      logo: {
        "@type": "ImageObject",
        url: `${websiteUrl}/logo.png`,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Article
        readingTime={readTime}
        title={frontMatter.title}
        description={frontMatter.description}
        date={frontMatter.date}
        content={content}
        ogImage={frontMatter.ogImage}
        slug={slug}
      />
      <Footer />
    </>
  );
};

export default BlogPage;
