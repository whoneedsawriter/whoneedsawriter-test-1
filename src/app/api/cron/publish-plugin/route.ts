/**
 * SaaS publish-plugin cron (Next.js App Router route).
 *
 * Copy to your SaaS app, e.g. `app/api/cron/publish-plugin/route.ts`
 *
 * Prisma (optional but recommended for parallel-cron safety):
 *   publishClaimedAt DateTime?  // null = unclaimed; stale claims expire after 10 min
 */

import { prismaClient } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STALE_CLAIM_MS = 10 * 60 * 1000;

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
  keyword: string;
  title: string | null;
  content: string | null;
  featuredImage: string | null;
  category: string | null;
  author: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publishClaimedAt?: Date | null;
};

type CreatePostResponse = {
  post_id?: number;
  status?: string;
  duplicate?: boolean;
  message?: string;
  code?: string;
};

type PublishResult =
  | { ok: true; postId: number; duplicate: boolean }
  | { ok: false; retryable: boolean; message: string };

async function publishToWordpress(params: {
  wordpressSite: string;
  batchId: string;
  articleId: string;
  keyword: string;
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
  pluginVersion: string | null;
}): Promise<PublishResult> {
  const {
    wordpressSite,
    batchId,
    articleId,
    keyword,
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
    pluginVersion,
  } = params;

  const createPostUrl = `${wordpressSite.replace(/\/$/, '')}/wp-json/apf/v1/create-post`;
  const payload = {
    batchId,
    batch_id: batchId,
    articleId,
    keyword,
    title,
    content,
    image_url: imageUrl,
    category,
    author,
    plugin_version: pluginVersion,
    status: saveOption,
    schedule_time: scheduleTime,
    published_start_date_time: publishedStartDateTime?.toISOString() ?? null,
    meta_title: metaTitle,
    meta_description: metaDescription,
    add_featured_image: true,
    add_meta_content: true,
  };

  console.log(`[publish-plugin] POST ${createPostUrl}`, {
    batchId,
    articleId,
    keyword,
    schedule_time: payload.schedule_time,
    published_start_date_time: payload.published_start_date_time,
  });

  let response: Response;
  try {
    response = await fetch(createPostUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      message: error instanceof Error ? error.message : 'Network error calling WordPress',
    };
  }

  const data = (await response.json().catch(() => ({}))) as CreatePostResponse;

  if (response.status === 409) {
    return {
      ok: false,
      retryable: true,
      message: data?.message || 'Publish already in progress on WordPress',
    };
  }

  if (!response.ok) {
    if (data?.code === 'plugin_version_outdated') {
      return {
        ok: false,
        retryable: false,
        message: data?.message || 'Plugin version is outdated',
      };
    }

    return {
      ok: false,
      retryable: false,
      message: data?.message || `Failed to publish to ${wordpressSite} (${response.status})`,
    };
  }

  const postId = Number(data?.post_id ?? 0);
  if (!Number.isFinite(postId) || postId <= 0) {
    return {
      ok: false,
      retryable: true,
      message: 'WordPress responded OK but no post_id was returned',
    };
  }

  return {
    ok: true,
    postId,
    duplicate: Boolean(data?.duplicate),
  };
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

function isClaimStale(claimedAt: Date | null | undefined): boolean {
  if (!claimedAt) {
    return true;
  }
  return Date.now() - claimedAt.getTime() > STALE_CLAIM_MS;
}

/**
 * Atomically claim an article so overlapping cron invocations do not publish twice.
 * Requires `publishClaimedAt DateTime?` on godmodeArticles (recommended).
 */
async function tryClaimArticle(articleId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);

  const claimed = await prismaClient.godmodeArticles.updateMany({
    where: {
      id: articleId,
      isPublished: false,
      publishFailed: false,
      OR: [{ publishClaimedAt: null }, { publishClaimedAt: { lt: staleBefore } }],
    } as any,
    data: { publishClaimedAt: new Date() } as any,
  });

  return claimed.count > 0;
}

async function releaseArticleClaim(articleId: string): Promise<void> {
  await prismaClient.godmodeArticles
    .update({
      where: { id: articleId },
      data: { publishClaimedAt: null } as any,
    })
    .catch(() => {});
}

async function markArticlePublished(articleId: string): Promise<boolean> {
  const updated = await prismaClient.godmodeArticles.updateMany({
    where: {
      id: articleId,
      isPublished: false,
    } as any,
    data: {
      isPublished: true,
      publishClaimedAt: null,
    } as any,
  });

  return updated.count > 0;
}

async function markArticlePublishFailed(articleId: string, message: string): Promise<void> {
  console.error(`[publish-plugin] marking publishFailed article=${articleId}: ${message}`);

  await prismaClient.godmodeArticles
    .update({
      where: { id: articleId },
      data: {
        publishFailed: true,
        publishClaimedAt: null,
      } as any,
    })
    .catch(() => {});
}

async function isArticleStillPending(articleId: string): Promise<boolean> {
  const row = await prismaClient.godmodeArticles.findFirst({
    where: {
      id: articleId,
      isPublished: false,
      publishFailed: false,
    } as any,
    select: { id: true },
  });

  return Boolean(row);
}

async function publishArticlesInBackground(params: {
  batch: PluginBatchForPublish;
  wordpressSite: string;
  articles: GodmodeArticleForPublish[];
  slotIndexById: Map<string, number>;
  pluginVersion: string | null;
}): Promise<void> {
  const { batch, wordpressSite, articles, slotIndexById, pluginVersion } = params;

  for (const article of articles) {
    const title = (article.title ?? '').trim();
    const content = (article.content ?? '').trim();
    const keyword = (article.keyword ?? '').trim();

    if (!title || !content) {
      console.log(`[publish-plugin] skip article ${article.id}: missing title/content`);
      continue;
    }

    if (!(await isArticleStillPending(article.id))) {
      console.log(`[publish-plugin] skip article ${article.id}: already handled`);
      continue;
    }

    const hasClaimColumn = Object.prototype.hasOwnProperty.call(article, 'publishClaimedAt');
    let claimed = true;

    if (hasClaimColumn) {
      claimed = await tryClaimArticle(article.id);
      if (!claimed) {
        console.log(`[publish-plugin] skip article ${article.id}: claimed by another run`);
        continue;
      }
    }

    const slotIndex = slotIndexById.get(article.id) ?? 0;
    const scheduleTime = buildScheduleTime(batch, slotIndex);

    try {
      console.log('[publish-plugin] publishing', {
        batchId: batch.id,
        articleId: article.id,
        keyword,
        scheduleTime,
      });

      const result = await publishToWordpress({
        wordpressSite,
        batchId: batch.id,
        articleId: article.id,
        keyword,
        title,
        content,
        imageUrl: article.featuredImage,
        category: article.category,
        author: article.author,
        saveOption: batch.saveOption,
        scheduleTime,
        publishedStartDateTime: batch.publishedStartDateTime,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        pluginVersion,
      });

      if (!result.ok) {
        if (result.retryable) {
          if (hasClaimColumn) {
            await releaseArticleClaim(article.id);
          }
          console.warn(`[publish-plugin] retryable failure article ${article.id}: ${result.message}`);
        } else {
          await markArticlePublishFailed(article.id, result.message);
        }
        continue;
      }

      const marked = await markArticlePublished(article.id);
      if (!marked) {
        console.log(
          `[publish-plugin] article ${article.id} already marked published (post_id=${result.postId}, duplicate=${result.duplicate})`
        );
      } else {
        console.log(
          `[publish-plugin] article ${article.id} published post_id=${result.postId} duplicate=${result.duplicate}`
        );
      }
    } catch (error) {
      console.error(`[publish-plugin] unexpected error article ${article.id}:`, error);
      if (hasClaimColumn) {
        await releaseArticleClaim(article.id);
      }
    }
  }

  const pendingCount = await prismaClient.godmodeArticles.count({
    where: {
      batchId: batch.id,
      status: 1,
      isPublished: false,
      publishFailed: false,
    } as any,
  });

  if (pendingCount === 0) {
    await prismaClient.batch.update({
      where: { id: batch.id },
      data: { isPublished: true } as any,
    });
    console.log(`[publish-plugin] batch ${batch.id} fully published`);
  }
}

export async function GET() {
  console.log('[publish-plugin] cron started');

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

    const plugin = await prismaClient.plugin.findFirst({
      select: { version: true },
    });

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
        publishClaimedAt: true,
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
      (article) => (article.title ?? '').trim() && (article.content ?? '').trim()
    );

    if (publishableArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All pending articles are missing valid title/content; will retry next run',
        published: 0,
        articleIds: articles.map((article) => article.id),
        batchId: candidateBatch.id,
      });
    }

    waitUntil(
      publishArticlesInBackground({
        batch: candidateBatch,
        wordpressSite,
        articles: publishableArticles,
        slotIndexById,
        pluginVersion: plugin?.version ?? null,
      })
    );

    return NextResponse.json({
      success: true,
      message: `Publishing ${publishableArticles.length} article(s) for batch ${candidateBatch.id} (background)`,
      queued: publishableArticles.length,
      articleIds: publishableArticles.map((article) => article.id),
      batchId: candidateBatch.id,
      websiteToPublish: candidateBatch.websiteToPublish,
    });
  } catch (error) {
    console.error('[publish-plugin] cron failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to publish plugin batch',
      },
      { status: 500 }
    );
  }
}
