import { prismaClient } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PluginBatchForPublish = {
  id: string;
  websiteToPublish: string | null;
  saveOption: string | null;
  scheduleTime: string | null;
  publishedStartDateTime: Date | null;
};

type GodmodeArticleForPublish = {
  id: string;
  createdAt: Date;
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
  title: string;
  content: string;
  imageUrl: string | null;
  category: string | null;
  author: string | null;
  saveOption: string | null;
  scheduleTime: string | null;
  publishedStartDateTime: Date | null;
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
    publishedStartDateTime,
    metaTitle,
    metaDescription,
  } = params;

  console.log('[publish-plugin] publishToWordpress args:', {
    scheduleTime,
    publishedStartDateTime: publishedStartDateTime?.toISOString() ?? null,
  });

  const plugin = await prismaClient.plugin.findFirst({
    select: { version: true },
  });

  const createPostUrl = `${wordpressSite}/wp-json/apf/v1/create-post`;
  const payload = {
    title,
    content,
    image_url: imageUrl,
    category,
    author,
    plugin_version: plugin?.version,
    status: saveOption,
    schedule_time: scheduleTime,
    published_start_date_time: publishedStartDateTime?.toISOString() ?? null,
    meta_title: metaTitle,
    meta_description: metaDescription,
    add_featured_image: true,
    add_meta_content: true,
  };

  console.log(`[publish-plugin] POST ${createPostUrl} payload:`, {
    schedule_time: payload.schedule_time,
    published_start_date_time: payload.published_start_date_time,
  });

  const response = await fetch(createPostUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
        publishedStartDateTime: true,
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

    const statusOneCount = await prismaClient.godmodeArticles.count({
      where: {
        batchId: candidateBatch.id,
        status: 1,
      } as any,
    });

    if (statusOneCount === 0) {
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

    const article = (await prismaClient.godmodeArticles.findFirst({
      where: {
        batchId: candidateBatch.id,
        status: 1,
        isPublished: false,
        publishFailed: false,
      } as any,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        createdAt: true,
        title: true,
        content: true,
        featuredImage: true,
        category: true,
        author: true,
        metaTitle: true,
        metaDescription: true,
      } as any,
    })) as GodmodeArticleForPublish | null;

    if (!article) {
      await prismaClient.batch.update({
        where: { id: candidateBatch.id },
        data: { isPublished: true } as any,
      });

      return NextResponse.json({
        success: true,
        message: `Batch ${candidateBatch.id} has no pending articles; marked as published`,
        published: 0,
        batchId: candidateBatch.id,
      });
    }

    const slotIndex = await prismaClient.godmodeArticles.count({
      where: {
        batchId: candidateBatch.id,
        status: 1,
        OR: [
          { createdAt: { lt: article.createdAt } },
          {
            AND: [{ createdAt: article.createdAt }, { id: { lt: article.id } }],
          },
        ],
      } as any,
    });

    const schedule_time =
      candidateBatch.saveOption === 'future'
        ? candidateBatch.scheduleTime === 'one_post_per_day'
          ? `+${slotIndex * 24} hours`
          : candidateBatch.scheduleTime === 'one_post_per_monthly'
            ? `+${slotIndex * 30} days`
            : `+${slotIndex * 7} days`
        : candidateBatch.scheduleTime || null;

    const title = (article.title ?? '').trim();
    const content = (article.content ?? '').trim();

    if (!title || !content) {
      console.log(`[publish-plugin] Article ${article.id} is missing title/content, skipping for now`);
      return NextResponse.json({
        success: true,
        message: `Article ${article.id} is missing a valid title/content; skipped, will retry next run`,
        published: 0,
        articleId: article.id,
        batchId: candidateBatch.id,
      });
    }

    console.log('[publish-plugin] calling publishToWordpress:', {
      batchId: candidateBatch.id,
      articleId: article.id,
      scheduleTime: schedule_time,
      publishedStartDateTime: candidateBatch.publishedStartDateTime?.toISOString() ?? null,
    });

    // Fire WordPress publish in background — response returns immediately
    waitUntil(
      (async () => {
        try {
          await publishToWordpress({
            wordpressSite,
            title,
            content,
            imageUrl: article.featuredImage,
            category: article.category,
            author: article.author,
            saveOption: candidateBatch.saveOption,
            scheduleTime: schedule_time,
            publishedStartDateTime: candidateBatch.publishedStartDateTime,
            metaTitle: article.metaTitle,
            metaDescription: article.metaDescription,
          });

          await prismaClient.godmodeArticles.update({
            where: { id: article.id },
            data: { isPublished: true } as any,
          });

          const pendingCount = await prismaClient.godmodeArticles.count({
            where: {
              batchId: candidateBatch.id,
              status: 1,
              isPublished: true,
              publishFailed: false,
            } as any,
          });

          if (pendingCount === 0) {
            await prismaClient.batch.update({
              where: { id: candidateBatch.id },
              data: { isPublished: true } as any,
            });
          }

          console.log(`[publish-plugin] ✅ Article ${article.id} published successfully`);
        } catch (error) {
          console.error(`[publish-plugin] ❌ Background publish failed for article ${article.id}:`, error);
          await prismaClient.godmodeArticles.update({
            where: { id: article.id },
            data: { publishFailed: true } as any,
          }).catch(() => {});
        }
      })()
    );

    return NextResponse.json({
      success: true,
      message: `Publishing article for batch ${candidateBatch.id} (background)`,
      published: 1,
      articleId: article.id,
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
