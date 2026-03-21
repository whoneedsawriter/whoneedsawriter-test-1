import { prismaClient } from "@/prisma/db";
import { NextResponse } from 'next/server';
import { sendTransactionalEmail } from "@/libs/loops";
import { PendingGodmodeArticles } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  console.log("🕑 Vercel cron job ran!");
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const candidateBatches = await prismaClient.batch.findMany({
    where: {
      articleType: 'godmode',
      status: 0,
      startProcess: 1,
      updatedAt: { lt: fifteenMinutesAgo }
    },
    orderBy: {
      updatedAt: 'asc'
    },
    take: 1
  });

  console.log(`Found ${candidateBatches.length} batches to process (>20 mins since last update)`);

  for (const batch of candidateBatches) {
    const timeSinceUpdate = Math.round((now.getTime() - batch.updatedAt.getTime()) / (1000 * 60));
    console.log(`Processing batch ${batch.id} (${batch.name}) - Last updated ${timeSinceUpdate} minutes ago`);

    const user = await prismaClient.user.findUnique({ where: { id: batch.userId } });
    if (!user || !user.email) {
      console.error(`User ID ${batch.userId} not found or has no email for batch ${batch.id}. Skipping batch.`);
      continue;
    }

    const pendingArticlesInDB = await prismaClient.pendingGodmodeArticles.findMany({
      where: { batchId: batch.id },
    });

    if (pendingArticlesInDB.length === 0) {
      console.log(`Batch ${batch.id}: No pending articles found. Marking as complete.`);
      await prismaClient.batch.update({
        where: { id: batch.id },
        data: {
          status: 1,
          pending_articles: 0,
          completed_articles: batch.articles,
          updatedAt: now,
        },
      });

      continue;
    }

    const articlesWithContentStatus = await Promise.all(
      pendingArticlesInDB.map(async (pa) => {
        const godmodeArticle = await prismaClient.godmodeArticles.findUnique({
          where: { id: pa.godmodeArticleId },
          select: { content: true, id: true, model: true },
        });
        return {
          pendingArticle: pa,
          godmodeArticleId: godmodeArticle?.id,
          hasContent: !!godmodeArticle?.content,
          model: godmodeArticle?.model,
        };
      })
    );

    const readyArticles = articlesWithContentStatus.filter(a => a.hasContent);
    const notReadyArticles = articlesWithContentStatus.filter(a => !a.hasContent);
    const hasPreviouslyAttemptedAllPending = notReadyArticles.length > 0 && notReadyArticles.every(p => p.pendingArticle.cronRequest === 1);

    // If all pending articles have been attempted, force completion
    if (hasPreviouslyAttemptedAllPending) {
      console.log(`Batch ${batch.id}: All pending articles have been attempted. Forcing completion.`);
      let finalCompleted = 0;
      let failedCount = 0;

      await prismaClient.$transaction(async (tx) => {
        const newlyCompletedCount = readyArticles.length;
        failedCount = notReadyArticles.length;

        // Refund logic based on user's plan and article model
        // Note: All failed articles in a batch have the same model
        if (failedCount > 0) {
          const user = await tx.user.findUnique({ where: { id: batch.userId } });
          if (user) {
            // Calculate credits per model
            const getCreditsPerModel = (model: string | null | undefined): number => {
              switch (model) {
                case '1a-lite': return 0.1;
                case '1a-core': return 1;
                case '1a-pro': return 2;
                default: return 1; // Default to 1 credit for unknown models
              }
            };

            // Since all failed articles in a batch have the same model,
            // get the model from the first failed article
            const failedModel = notReadyArticles[0]?.model || null;
            const creditPerArticle = getCreditsPerModel(failedModel);
            const totalRefundCredits = creditPerArticle * failedCount;
            
            console.log(`Batch ${batch.id}: Refunding ${failedCount} failed articles (model: ${failedModel || 'unknown'}, ${creditPerArticle} credits each) = ${totalRefundCredits} total credits`);
            
            if (user.monthyPlan > 0) {
              await tx.user.update({
                where: { id: batch.userId },
                data: { monthyBalance: user.monthyBalance + totalRefundCredits }
              });
            } else if (user.lifetimePlan > 0) {
              await tx.user.update({
                where: { id: batch.userId },
                data: { lifetimeBalance: user.lifetimeBalance + totalRefundCredits }
              });
            } else {
              await tx.user.update({
                where: { id: batch.userId },
                data: { freeCredits: user.freeCredits + totalRefundCredits }
              });
            }
          }
        }

        await tx.batch.update({
          where: { id: batch.id },
          data: {
            status: 1,
            completed_articles: batch.completed_articles + newlyCompletedCount,
            pending_articles: 0,
            failed_articles: batch.failed_articles + failedCount,
            updatedAt: now,
          },
        });

        if (newlyCompletedCount > 0) {
          await tx.godmodeArticles.updateMany({
            where: { id: { in: readyArticles.map(a => a.godmodeArticleId).filter(id => id) as string[] } },
            data: { status: 1 },
          });
        }

        // Update failed articles status to 2
        if (failedCount > 0) {
          await tx.godmodeArticles.updateMany({
            where: { id: { in: notReadyArticles.map(a => a.godmodeArticleId).filter(id => id) as string[] } },
            data: { status: 2 },
          });
        }

        await tx.pendingGodmodeArticles.deleteMany({
          where: { batchId: batch.id },
        });

        finalCompleted = batch.completed_articles + newlyCompletedCount;
      });

      // Send email for forced completion
      if (user.email) {
        try {
          await sendTransactionalEmail({
            transactionalId: "cmb2jl0ijc6ea430in4xiowyv",
            email: user.email,
            dataVariables: {
              text1: `Here is the final status of articles generated in ${batch.name}`,
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
                <td>${finalCompleted}</td>
                <td>0</td>
                <td>${failedCount}</td>
               </tr>
              </tbody>
              </table>`,
              subject: `Final status of articles generated in ${batch.name}`,
              batch: batch.id
            },
          });
          console.log(`Successfully sent forced completion email to ${user.email} for batch ${batch.id}`);
        } catch (error) {
          console.error(`Failed to send forced completion email to ${user.email} for batch ${batch.id}:`, error);
        }
      }

      // Send separate refund email if there are failed articles
      if (notReadyArticles.length > 0 && user.email) {
        try {
          await sendTransactionalEmail({
            transactionalId: "cmb2jl0ijc6ea430in4xiowyv",
            email: user.email,
            dataVariables: {
              text1: `${notReadyArticles.length} articles of god mode failed to generate and balance has been refunded to your account. Please retry generation after 20 minutes.`,
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
                <td>${finalCompleted}</td>
                <td>0</td>
                <td>${failedCount}</td>
               </tr>
              </tbody>
              </table>`,
              subject: 'Balance Refund Completed - God mode',
              batch: batch.id
            },
          });
          console.log(`Successfully sent refund email to ${user.email} for batch ${batch.id}`);
        } catch (error) {
          console.error(`Failed to send refund email to ${user.email} for batch ${batch.id}:`, error);
        }
      }
      continue;
    }


    // SCENARIO 2: Partially ready
    if (readyArticles.length > 0 && notReadyArticles.length > 0) {
      console.log(`Batch ${batch.id}: ${readyArticles.length} ready, ${notReadyArticles.length} not ready.`);
      let newApiCallsMade = false;
      let currentTotalCompleted = 0;
      let articlesToCall: Array<{
        pendingArticle: PendingGodmodeArticles;
        godmodeArticleId: string | undefined;
        hasContent: boolean;
      }> = [];

      await prismaClient.$transaction(async (tx) => {
        await tx.batch.update({
          where: { id: batch.id },
          data: {
            completed_articles: batch.completed_articles + readyArticles.length,
            pending_articles: notReadyArticles.length,
          },
        });

        await tx.godmodeArticles.updateMany({
          where: { id: { in: readyArticles.map(a => a.godmodeArticleId).filter(id => id) as string[] } },
          data: { status: 1 },
        });

        await tx.pendingGodmodeArticles.deleteMany({
          where: { id: { in: readyArticles.map(a => a.pendingArticle.id) } },
        });

        // Collect articles that need API calls
        for (const articleData of notReadyArticles) {
          if (articleData.pendingArticle.cronRequest === 0) {
            await tx.pendingGodmodeArticles.update({
              where: { id: articleData.pendingArticle.id },
              data: { cronRequest: 1 },
            });
            newApiCallsMade = true;
            articlesToCall.push(articleData);
          }
        }

        if (newApiCallsMade) {
          await tx.batch.update({ 
            where: { id: batch.id }, 
            data: { updatedAt: now } 
          });
        }

        currentTotalCompleted = batch.completed_articles + readyArticles.length;
      });

      // Make API calls outside transaction
      for (const articleData of articlesToCall) {
        if (!articleData.pendingArticle.godmodeArticleId) {
          console.error(`Batch ${batch.id}: Missing godmodeArticleId for pending article ${articleData.pendingArticle.id}. Skipping API call.`);
          continue;
        }

        // Get full article data for dynamic parameters
        const fullArticle = await prismaClient.godmodeArticles.findUnique({
          where: { id: articleData.pendingArticle.godmodeArticleId },
          select: {
            model: true,
            featuredImageRequired: true,
            additionalImageRequired: true,
            links: true,
            wordLimit: true,
            comment: true,
            toneChoice: true,
            perspective: true,
            description: true,
            references: true,
          }
        });

        let webhookUrl = '';
        if (fullArticle?.model === '1a-core') {
          webhookUrl = 'https://hook.eu2.make.com/vso0bspbhsfe96133qtjcv18gmzkfdjp';
        } 
        if (fullArticle?.model === '1a-pro') {
          webhookUrl = 'https://hook.eu2.make.com/u0yss4lheap5qezqxgo3bcmhnhif517x';
        }
         if (fullArticle?.model === '1a-lite') {
          webhookUrl = 'https://hook.eu2.make.com/w6wafhcbrnvlmz8jiedqgztbl4onqb5v';
        }

        console.log(webhookUrl);

        const params = new URLSearchParams();
        params.append('keyword', articleData.pendingArticle.keywordId);
        params.append('id', articleData.pendingArticle.godmodeArticleId);
        params.append('userId', articleData.pendingArticle.userId);
        params.append('batchId', articleData.pendingArticle.batchId);
        params.append('articleType', 'godmode');
        params.append('status', '0');
        params.append('featured_image_required', fullArticle?.featuredImageRequired || 'No');
        params.append('additional_image_required', fullArticle?.additionalImageRequired || 'No');
        params.append('expand_article', 'No');
        params.append('links', fullArticle?.links || 'No');
        params.append('tone_choice', fullArticle?.toneChoice || 'Neutral');
        params.append('perspective', fullArticle?.perspective || 'Individual (I)');
        params.append('description', fullArticle?.description || '');
        params.append('references', fullArticle?.references || 'No');
        params.append('secret_key', 'kdfmnids9fds0fi4nrjr(*^nII');

        //params.append('secret_key', 'kdfmnids9fds0fi4nrjr');
        
        // Add optional fields
        if (fullArticle?.wordLimit) {
          params.append('word_limit', fullArticle.wordLimit.toString());
        }
        
        if (fullArticle?.comment) {
          params.append('comment', fullArticle.comment);
        } else {
          params.append('comment', '.');
        }

        console.log(params.toString());

        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });

        console.log(`Batch ${batch.id}: Made API call for pending article ${articleData.pendingArticle.godmodeArticleId} (keyword: ${articleData.pendingArticle.keywordId})`);
      }

      if (user.email) {
        try {
          await sendTransactionalEmail({
            transactionalId: "cmb2jl0ijc6ea430in4xiowyv",
            email: user.email,
            dataVariables: {
              text1: `Here is the current status of godemode articles in batch ${batch.name}. We will update you again in 15 minutes.`,
              subject: `Articles generated in ${batch.name} are partially completed`,
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
                <td>${currentTotalCompleted}</td>
                <td>${notReadyArticles.length}</td>
                <td>${batch.failed_articles}</td>
               </tr>
              </tbody>
              </table>`,
              batch: batch.id
            },
          });
          console.log(`Successfully sent partial completion email to ${user.email} for batch ${batch.id}`);
        } catch (error) {
          console.error(`Failed to send partial completion email to ${user.email} for batch ${batch.id}:`, error);
        }
      }
      continue;
    }

    // SCENARIO 3: No *currently* pending articles are ready
    if (notReadyArticles.length > 0 && readyArticles.length === 0) {
      console.log(`Batch ${batch.id}: None of the ${notReadyArticles.length} pending articles are ready yet.`);
      let newApiCallsMade = false;
      const articlesToRequestApiFor = notReadyArticles.filter(a => a.pendingArticle.cronRequest === 0);
      let articlesToCall: Array<{
        pendingArticle: PendingGodmodeArticles;
        godmodeArticleId: string | undefined;
        hasContent: boolean;
      }> = [];

      if (articlesToRequestApiFor.length > 0) {
        await prismaClient.$transaction(async (tx) => {
          // Update database records
          for (const articleData of articlesToRequestApiFor) {
            await tx.pendingGodmodeArticles.update({
              where: { id: articleData.pendingArticle.id },
              data: { cronRequest: 1 },
            });
            newApiCallsMade = true;
            articlesToCall.push(articleData);
          }

          if (newApiCallsMade) {
            await tx.batch.update({ 
              where: { id: batch.id }, 
              data: { updatedAt: now } 
            });
          }
        });

        // Make API calls outside transaction
        for (const articleData of articlesToCall) {
          if (!articleData.pendingArticle.godmodeArticleId) {
            console.error(`Batch ${batch.id}: Missing godmodeArticleId for pending article ${articleData.pendingArticle.id}. Skipping API call.`);
            continue;
          }

          // Get full article data for dynamic parameters
          const fullArticle = await prismaClient.godmodeArticles.findUnique({
            where: { id: articleData.pendingArticle.godmodeArticleId },
            select: {
              model: true,
              featuredImageRequired: true,
              additionalImageRequired: true,
              links: true,
              wordLimit: true,
              comment: true,
              toneChoice: true,
              perspective: true,
              description: true,
              references: true,
            }
          });

          let webhookUrl = '';
          if (fullArticle?.model === '1a-core') {
            webhookUrl = 'https://hook.eu2.make.com/vso0bspbhsfe96133qtjcv18gmzkfdjp';
          } 
          if (fullArticle?.model === '1a-pro') {
            webhookUrl = 'https://hook.eu2.make.com/u0yss4lheap5qezqxgo3bcmhnhif517x';
          }
          if (fullArticle?.model === '1a-lite') {
            webhookUrl = 'https://hook.eu2.make.com/w6wafhcbrnvlmz8jiedqgztbl4onqb5v';
          }

          console.log(webhookUrl);

          const params = new URLSearchParams();
          params.append('keyword', articleData.pendingArticle.keywordId);
          params.append('id', articleData.pendingArticle.godmodeArticleId);
          params.append('userId', articleData.pendingArticle.userId);
          params.append('batchId', articleData.pendingArticle.batchId);
          params.append('articleType', 'godmode');
          params.append('status', '0');
          params.append('featured_image_required', fullArticle?.featuredImageRequired || 'No');
          params.append('additional_image_required', fullArticle?.additionalImageRequired || 'No');
          params.append('expand_article', 'No');
          params.append('links', fullArticle?.links || 'No');
          params.append('tone_choice', fullArticle?.toneChoice || 'Neutral');
          params.append('perspective', fullArticle?.perspective || 'Individual (I)');
          params.append('description', fullArticle?.description || '');
          params.append('references', fullArticle?.references || 'No');
          params.append('secret_key', 'kdfmnids9fds0fi4nrjr(*^nII');

        //  params.append('secret_key', 'kdfmnids9fds0fi4nrjr');
          
          // Add optional fields
          if (fullArticle?.wordLimit) {
            params.append('word_limit', fullArticle.wordLimit.toString());
          }
          
          if (fullArticle?.comment) {
            params.append('comment', fullArticle.comment);
          } else {
            params.append('comment', '.');
          }

          console.log(params.toString());

          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
          });

          console.log(`Batch ${batch.id}: Made API call for pending article ${articleData.pendingArticle.godmodeArticleId} (keyword: ${articleData.pendingArticle.keywordId})`);
        }
      } else {
        console.log(`Batch ${batch.id}: All pending articles already have API request sent. Waiting for content or 20-min timeout.`);
      }

      if (user.email) {
        try {
          await sendTransactionalEmail({
            transactionalId: "cmb2jl0ijc6ea430in4xiowyv",
            email: user.email,
            dataVariables: {
              text1: `${notReadyArticles.length} Articles Generated on God mode will be completed in another 15 minutes`,
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
                <td>0</td>
                <td>${notReadyArticles.length}</td>
                <td>${batch.failed_articles}</td>
               </tr>
              </tbody>
              </table>`,
              subject: `Article Generation for ${batch.name} is taking longer than expected`,
              batch: batch.id
            },
          });
          console.log(`Successfully sent processing email to ${user.email} for batch ${batch.id}`);
        } catch (error) {
          console.error(`Failed to send processing email to ${user.email} for batch ${batch.id}:`, error);
        }
      }
      continue;
    }

    console.log(`Batch ${batch.id}: No specific scenario met. Pending: ${pendingArticlesInDB.length}, Ready: ${readyArticles.length}, NotReady: ${notReadyArticles.length}`);
  }

  return NextResponse.json({ ok: true });
} 