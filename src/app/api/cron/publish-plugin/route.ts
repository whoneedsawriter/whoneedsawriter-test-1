import { prismaClient } from '@/prisma/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PluginBatchForPublish = {
  id: string;
  websiteToPublish: string | null;
  saveOption: string | null;
  scheduleTime: string | null;
};

type GodmodeArticleForPublish = {
  id: string;
  title: string | null;
  content: string | null;
  featuredImage: string | null;
  category: string | null;
  author: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

async function publishToWordpress(params: {
  wordpressSite: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  category: string | null;
  author: string | null;
  saveOption: string | null;
  scheduleTime: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}) {
  const {
    wordpressSite,
    title,
    content,
    imageUrl,
    category,
    author,
    saveOption,
    scheduleTime,
    metaTitle,
    metaDescription,
  } = params;

  const plugin = await prismaClient.plugin.findFirst({
    select: { version: true },
  });

  const response = await fetch(`${wordpressSite}/wp-json/apf/v1/create-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content,
      image_url: imageUrl,
      category,
      author,
      plugin_version: plugin?.version,
      status: saveOption,
      schedule_time: scheduleTime,
      meta_title: metaTitle,
      meta_description: metaDescription,
      add_featured_image: true,
      add_meta_content: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData?.code === 'plugin_version_outdated') {
      throw new Error(errorData?.message || 'Plugin version is outdated');
    }
    throw new Error(errorData?.message || `Failed to publish to ${wordpressSite}`);
  }
}

export async function GET() {
  console.log('🕑 Publish plugin cron job ran!');

  try {
    // NOTE: The Prisma Client types in this workspace may be out of sync with `schema.prisma`.
    // We keep runtime behavior correct while allowing compilation by using a narrow local type.
    const candidateBatch = (await prismaClient.batch.findFirst({
      where: {
        createdBy: 'plugin',
        isPublished: false,
        status: 1,
      } as any,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        websiteToPublish: true,
        saveOption: true,
        scheduleTime: true,
      } as any,
    })) as PluginBatchForPublish | null;

    if (!candidateBatch) {
      return NextResponse.json({
        success: true,
        message: 'No eligible plugin batches to publish',
        published: 0,
      });
    }

    const wordpressSite = candidateBatch.websiteToPublish?.trim() || '';
    if (!wordpressSite) {
      return NextResponse.json(
        {
          success: false,
          message: `Batch ${candidateBatch.id} has no websiteToPublish`,
        },
        { status: 400 }
      );
    }

    const articles = (await prismaClient.godmodeArticles.findMany({
      where: {
        batchId: candidateBatch.id,
        status: 1,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        title: true,
        content: true,
        featuredImage: true,
        category: true,
        author: true,
        metaTitle: true,
        metaDescription: true,
      } as any,
    })) as unknown as GodmodeArticleForPublish[];

    if (articles.length === 0) {
      await prismaClient.batch.update({
        where: { id: candidateBatch.id },
        data: { isPublished: true } as any,
      });

      return NextResponse.json({
        success: true,
        message: `Batch ${candidateBatch.id} had no articles to publish; marked as published`,
        published: 0,
      });
    }

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      const schedule_time =
        candidateBatch.saveOption === 'future'
          ? candidateBatch.scheduleTime === 'one_post_per_day'
            ? `+${i * 24} hours`
            : `+${i * 7} days`
          : candidateBatch.scheduleTime || null;

      await publishToWordpress({
        wordpressSite,
        title: article.title,
        content: article.content,
        imageUrl: article.featuredImage,
        category: article.category,
        author: article.author,
        saveOption: candidateBatch.saveOption,
        scheduleTime: schedule_time,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
      });
    }

    await prismaClient.batch.update({
      where: { id: candidateBatch.id },
      data: { isPublished: true } as any,
    });

    return NextResponse.json({
      success: true,
      message: `Published ${articles.length} articles for batch ${candidateBatch.id}`,
      published: articles.length,
      batchId: candidateBatch.id,
      websiteToPublish: candidateBatch.websiteToPublish,
    });
  } catch (error) {
    console.error('❌ Publish plugin cron failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to publish plugin batch',
      },
      { status: 500 }
    );
  }
}
