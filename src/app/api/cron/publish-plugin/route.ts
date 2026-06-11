import { prismaClient } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PluginBatchForPublish = {
  id: string;
  name: string;
  websiteToPublish: string | null;
  saveOption: string | null;
  scheduleTime: string | null;
  publishedStartDateTime: Date | null;
};

type GodmodeArticleForPublish = {
  id: string;
  createdAt: Date;
  keyword: string;
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
  keyword: string;
  title: string;
  content: string;
  imageUrl: string | null;
  category: string | null;
  author: string | null;
  saveOption: string | null;
  scheduleTime: string | null;
  publishedStartDateTime: Date | null;
  batchId: string;
  batchName: string;
  articleId: string;
  articleIndex: number;
  metaTitle: string | null;
  metaDescription: string | null;
}) {
  const {
    wordpressSite,
    keyword,
    title,
    content,
    imageUrl,
    category,
    author,
    saveOption,
    scheduleTime,
    publishedStartDateTime,
    batchId,
    batchName,
    articleId,
    articleIndex,
    metaTitle,
    metaDescription,
  } = params;

  const idempotencyKey = `wnaw:${batchId}:${articleId}`;

  console.log('[publish-plugin] publishToWordpress args:', {
    scheduleTime,
    publishedStartDateTime: publishedStartDateTime?.toISOString() ?? null,
  });

  const plugin = await prismaClient.plugin.findFirst({
    select: { version: true },
  });

  const createPostUrl = `${wordpressSite}/wp-json/apf/v1/create-post`;
  const payload = {
    keyword: keyword,
    title,
    content,
    image_url: imageUrl,
    category,
    author,
    plugin_version: plugin?.version,
    status: saveOption,
    schedule_time: scheduleTime,
    published_start_date_time: publishedStartDateTime?.toISOString() ?? null,
    batch_id: batchId,
    batchId,
    batch_name: batchName,
    batchName,
    article_id: articleId,
    articleId,
    article_index: articleIndex,
    articleIndex,
    idempotency_key: idempotencyKey,
    idempotencyKey,
    meta_title: metaTitle,
    meta_description: metaDescription,
    add_featured_image: true,
    add_meta_content: true,
  };

  console.log(`[publish-plugin] POST ${createPostUrl} payload:`, {
    article_id: payload.article_id,
    batch_id: payload.batch_id,
    idempotency_key: payload.idempotency_key,
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

function buildScheduleTime(batch: PluginBatchForPublish, slotIndex: number): string | null {
  if (batch.saveOption !== 'future') {
    return batch.scheduleTime || null;
  }
  if (batch.scheduleTime === 'one_post_per_day') {
    return `+${slotIndex * 24} hours`;
  }
  if (batch.scheduleTime === 'one_post_per_monthly') {
    return `+${slotIndex * 30} days`;
  }
  return `+${slotIndex * 7} days`;
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
        name: true,
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

    const articles = (await prismaClient.godmodeArticles.findMany({
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
        keyword: true,
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
        message: `Batch ${candidateBatch.id} has no pending articles; marked as published`,
        published: 0,
        batchId: candidateBatch.id,
      });
    }

    const orderedStatusOne = await prismaClient.godmodeArticles.findMany({
      where: {
        batchId: candidateBatch.id,
        status: 1,
      } as any,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const slotIndexById = new Map(orderedStatusOne.map((row, index) => [row.id, index]));

    const publishableArticles = articles.filter(
      (a) => (a.title ?? '').trim() && (a.content ?? '').trim()
    );

    if (publishableArticles.length === 0) {
      console.log(
        `[publish-plugin] Batch ${candidateBatch.id}: ${articles.length} pending article(s) missing title/content`
      );
      return NextResponse.json({
        success: true,
        message: `All pending articles are missing valid title/content; skipped, will retry next run`,
        published: 0,
        articleIds: articles.map((a) => a.id),
        batchId: candidateBatch.id,
      });
    }

    console.log('[publish-plugin] queuing publish for batch:', {
      batchId: candidateBatch.id,
      articleCount: publishableArticles.length,
      publishedStartDateTime: candidateBatch.publishedStartDateTime?.toISOString() ?? null,
    });

    // Publish all articles in background — response returns immediately
    waitUntil(
      (async () => {
        for (const article of publishableArticles) {
          const keyword = article.keyword || '';
          const title = (article.title ?? '').trim();
          const content = (article.content ?? '').trim();
          const slotIndex = slotIndexById.get(article.id) ?? 0;
          const schedule_time = buildScheduleTime(candidateBatch, slotIndex);

          try {
            const claim = await prismaClient.godmodeArticles.updateMany({
              where: {
                id: article.id,
                status: 1,
                isPublished: false,
                publishFailed: false,
              } as any,
              data: { publishFailed: true } as any,
            });

            if (claim.count === 0) {
              console.log(`[publish-plugin] Article ${article.id} already claimed or processed; skipping`);
              continue;
            }

            console.log('[publish-plugin] calling publishToWordpress:', {
              batchId: candidateBatch.id,
              articleId: article.id,
              scheduleTime: schedule_time,
            });

            await publishToWordpress({
              wordpressSite,
              keyword,
              title,
              content,
              imageUrl: article.featuredImage,
              category: article.category,
              author: article.author,
              saveOption: candidateBatch.saveOption,
              scheduleTime: schedule_time,
              publishedStartDateTime: candidateBatch.publishedStartDateTime,
              batchId: candidateBatch.id,
              batchName: candidateBatch.name,
              articleId: article.id,
              articleIndex: slotIndex,
              metaTitle: article.metaTitle,
              metaDescription: article.metaDescription,
            });

            await prismaClient.godmodeArticles.update({
              where: { id: article.id },
              data: { isPublished: true, publishFailed: false } as any,
            });

            console.log(`[publish-plugin] ✅ Article ${article.id} published successfully`);
          } catch (error) {
            console.error(
              `[publish-plugin] ❌ Background publish failed for article ${article.id}:`,
              error
            );
            await prismaClient.godmodeArticles
              .update({
                where: { id: article.id },
                data: { publishFailed: true } as any,
              })
              .catch(() => {});
          }
        }

        const pendingCount = await prismaClient.godmodeArticles.count({
          where: {
            batchId: candidateBatch.id,
            status: 1,
            isPublished: false,
            publishFailed: false,
          } as any,
        });

        if (pendingCount === 0) {
          await prismaClient.batch.update({
            where: { id: candidateBatch.id },
            data: { isPublished: true } as any,
          });
          console.log(`[publish-plugin] ✅ Batch ${candidateBatch.id} fully published`);
        }
      })()
    );

    return NextResponse.json({
      success: true,
      message: `Publishing ${publishableArticles.length} article(s) for batch ${candidateBatch.id} (background)`,
      published: publishableArticles.length,
      articleIds: publishableArticles.map((a) => a.id),
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
