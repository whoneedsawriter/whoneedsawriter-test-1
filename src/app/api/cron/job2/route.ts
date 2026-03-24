import { prismaClient } from "@/prisma/db";
import { NextResponse } from 'next/server';
import { sendTransactionalEmail } from "@/libs/loops";
import { PendingGodmodeArticles } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      select: { content: true, id: true },
    });

    // Check if all articles have content
    const allArticlesHaveContent = godmodeArticlesForBatch.length > 0 && 
      godmodeArticlesForBatch.every(article => !!article.content);

    if (allArticlesHaveContent) {
      console.log(`Batch ${batch.id}: All ${godmodeArticlesForBatch.length} articles have content. Completing batch.`);
      
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
        await tx.godmodeArticles.updateMany({
          where: { 
            batchId: batch.id,
            content: { not: null }, // Only update articles that have content
            status: { not: 1 }      // Only update articles not already completed
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
              text1: `Here is the status of godemode articles in batch ${batch.name}`,
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
              batch: batch.id
            },
          });
          console.log(`Successfully sent completion email to ${user.email} for batch ${batch.id}`);
        } catch (error) {
          console.error(`Failed to send completion email to ${user.email} for batch ${batch.id}:`, error);
        }
      }
    } else {
      // Some articles don't have content yet
      const articlesWithContent = godmodeArticlesForBatch.filter(article => !!article.content);
      console.log(`Batch ${batch.id}: ${articlesWithContent.length}/${godmodeArticlesForBatch.length} articles have content. Waiting for all articles to be ready.`);
    }
  }

  // check all artilces with status 0 and have content
  const articlesWithContent = await prismaClient.godmodeArticles.findMany({
    where: {
      status: 0,
      content: { not: null }
    }
  });

  console.log(`Found ${articlesWithContent.length} articles with content and status 0 and 15 minutes old created at`);

  for (const article of articlesWithContent) {
    console.log(`Processing article ${article.id} and updating status to 1`);
    await prismaClient.godmodeArticles.update({
      where: { id: article.id },
      data: { status: 1 }
    });
    console.log(`Updated status to 1 for article ${article.id}`);
  }

  return NextResponse.json({ ok: true });
} 