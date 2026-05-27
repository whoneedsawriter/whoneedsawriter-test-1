import { prismaClient } from "@/prisma/db";
import { NextResponse } from 'next/server';
import { sendTransactionalEmail } from "@/libs/loops";
import { PendingGodmodeArticles } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isArticleReady(article: {
  content: string | null;
  featuredImage: string | null;
  featuredImageRequired: string | null;
}) {
  const featuredImageRequired = article.featuredImageRequired === 'Yes';
  const hasContent = !!article.content;
  const hasFeaturedImage = !featuredImageRequired || !!article.featuredImage;
  return hasContent && hasFeaturedImage;
}

export async function GET() {
  console.log("🕑 Vercel cron job ran!");
  const now = new Date();

  // Check all batches with status = 0, startProcess = 1, and articleType = 'godmode'
  const candidateBatches = await prismaClient.batch.findMany({
    where: {
      articleType: 'godmode',
      status: 0,
      startProcess: 1
    },
    orderBy: {
      updatedAt: 'asc'
    }
  });

  console.log(`Found ${candidateBatches.length} batches to process`);

  for (const batch of candidateBatches) {
    console.log(`Processing batch ${batch.id} (${batch.name})`);

    const user = await prismaClient.user.findUnique({ where: { id: batch.userId } });
    if (!user || !user.email) {
      console.error(`User ID ${batch.userId} not found or has no email for batch ${batch.id}. Skipping batch.`);
      continue;
    }

    // Get all godmode articles for this batch
    const godmodeArticlesForBatch = await prismaClient.godmodeArticles.findMany({
      where: { 
        batchId: batch.id
      },
      select: {
        content: true,
        featuredImage: true,
        featuredImageRequired: true,
        id: true,
      },
    });

    const allArticlesReady =
      godmodeArticlesForBatch.length > 0 &&
      godmodeArticlesForBatch.every(isArticleReady);

    if (allArticlesReady) {
      console.log(`Batch ${batch.id}: All ${godmodeArticlesForBatch.length} articles are ready. Completing batch.`);
      
      await prismaClient.$transaction(async (tx) => {
        // Update batch status
        await tx.batch.update({
          where: { id: batch.id },
          data: {
            status: 1,
            completed_articles: batch.articles,
            pending_articles: 0,
            failed_articles: 0,
            updatedAt: now,
          },
        });

        // Update godmode articles status to 1 (completed)
        // Instead of using individual article IDs, update by batchId
        const readyArticleIds = godmodeArticlesForBatch
          .filter(isArticleReady)
          .map((article) => article.id);

        await tx.godmodeArticles.updateMany({
          where: {
            id: { in: readyArticleIds },
            status: { not: 1 },
          },
          data: { status: 1 },
        });

        // Delete all pending articles for this batch
        await tx.pendingGodmodeArticles.deleteMany({
          where: { batchId: batch.id },
        });
      });

      // Send email for completion
      if (user.email) {
        try {
          await sendTransactionalEmail({
            transactionalId: "cmb2jl0ijc6ea430in4xiowyv",
            email: user.email,
            dataVariables: {
              text1: `Here is the status of articles in batch ${batch.name}`,
              text2: `<table border="1" cellspacing="0" cellpadding="8" style="margin: 0 auto;">
              <thead>
               <tr>
                <th>Total Articles</th>
                <th>Completed Articles</th>
                <th>Pending Articles</th>
                <th>Failed Articles</th>
               </tr>
              </thead>
              <tbody>
               <tr>
                <td>${batch.articles}</td>
                <td>${batch.articles}</td>
                <td>0</td>
                <td>0</td>
               </tr>
              </tbody>
              </table>`,
              subject: `Articles generated in ${batch.name} are now completed`,
              viewLink: batch.websiteToPublish
                ? `${batch.websiteToPublish}/wp-admin/admin.php?page=whoneedsawriter-jobs&job_id=${batch.id}`
                : `https://whoneedsawriter.com/articles?batchId=${batch.id}`
            },
          });
          console.log(`Successfully sent completion email to ${user.email} for batch ${batch.id}`);
        } catch (error) {
          console.error(`Failed to send completion email to ${user.email} for batch ${batch.id}:`, error);
        }
      }
    } else {
      const readyArticles = godmodeArticlesForBatch.filter(isArticleReady);
      console.log(
        `Batch ${batch.id}: ${readyArticles.length}/${godmodeArticlesForBatch.length} articles are ready. Waiting for all articles to be ready.`
      );
    }
  }

  // Check all articles with status 0 that are ready (content + featured image when required)
  const candidateArticles = await prismaClient.godmodeArticles.findMany({
    where: {
      status: 0,
      content: { not: null },
    },
    select: {
      id: true,
      content: true,
      featuredImage: true,
      featuredImageRequired: true,
    },
  });

  const readyArticles = candidateArticles.filter(isArticleReady);

  console.log(`Found ${readyArticles.length} ready articles with status 0`);

  for (const article of readyArticles) {
    console.log(`Processing article ${article.id} and updating status to 1`);
    await prismaClient.godmodeArticles.update({
      where: { id: article.id },
      data: { status: 1 },
    });
    console.log(`Updated status to 1 for article ${article.id}`);
  }

  return NextResponse.json({ ok: true });
} 