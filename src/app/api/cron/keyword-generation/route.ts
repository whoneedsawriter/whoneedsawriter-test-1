import { prismaClient } from "@/prisma/db";
import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/libs/loops";
import { Routes } from "@/data/routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAKE_COM_KEYWORD_RESEARCH_WEBHOOK_URL =
  process.env.MAKE_COM_KEYWORD_RESEARCH_WEBHOOK_URL ||
  "https://hook.eu2.make.com/7afh5k1xkl5sv305uwrgkvxdsqu1x6el";

const APP_BASE_URL = process.env.NEXTAUTH_URL || "";

// Run via Vercel cron every minute
export async function GET() {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // 1) Send webhook requests for new keyword generations
    const pendingKeywords = await prismaClient.keywords.findMany({
      where: {
        requestProcess: 0,
        status: 0,
      } as any,
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    for (const record of pendingKeywords) {
      const user = await prismaClient.user.findUnique({
        where: { id: record.userId },
        select: { email: true },
      });

      const userEmail = user?.email || "";

      if (MAKE_COM_KEYWORD_RESEARCH_WEBHOOK_URL) {
        const params = new URLSearchParams();
        params.append("id", record.id);
        params.append("website_url", record.website_url || "");
        params.append("topic", record.seedKeyword || "");
        params.append("description", record.description || "");
        params.append("goal", record.goal || "");
        params.append("user_id", record.userId);
        params.append("user_email", userEmail);

        try {
          await fetch(MAKE_COM_KEYWORD_RESEARCH_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
          });
          console.log(
            `✅ Sent keyword research webhook for keyword id ${record.id}`
          );
        } catch (error) {
          console.error(
            `❌ Failed to call keyword research webhook for id ${record.id}:`,
            error
          );
        }
      }

      // Mark as requested so we don't send duplicate webhooks
      await prismaClient.keywords.update({
        where: { id: record.id },
        data: {
          requestProcess: 1,
        } as any,
      });
    }

    // 2) Finalize completed generations after 5 minutes and notify user
    const readyKeywords = await prismaClient.keywords.findMany({
      where: {
        requestProcess: 1,
        status: 0,
        createdAt: { lt: fiveMinutesAgo },
        NOT: { json: null },
      } as any,
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    for (const record of readyKeywords) {
      if (!record.json) continue;

      let count = 0;
      try {
        const parsed: any = JSON.parse(record.json);
        if (Array.isArray(parsed)) {
          count = parsed.length;
        } else if (Array.isArray(parsed?.keywords)) {
          count = parsed.keywords.length;
        } else if (Array.isArray(parsed?.data)) {
          count = parsed.data.length;
        }
      } catch {
        // ignore JSON parse errors, treat as 0
        count = 0;
      }

      // Only mark completed and send email if we have at least one keyword
      if (count > 0) {
        await prismaClient.keywords.update({
          where: { id: record.id },
          data: {
            status: 1,
          } as any,
        });

        const user = await prismaClient.user.findUnique({
          where: { id: record.userId },
          select: { email: true },
        });

        const email = user?.email;
        if (email) {
          const viewUrl =
            APP_BASE_URL &&
            `${APP_BASE_URL}${Routes.keywordDetails}?id=${record.id}`;

          const text1 = `${count} keywords are generated on the topic ${record.seedKeyword}.`;

          try {
            await sendTransactionalEmail({
              transactionalId: "cmmahzt1f2rme0i38cmqz5hum",
              email,
              dataVariables: {
                text1,
                url: viewUrl,
                subject: `Your keyword research for ${record.seedKeyword} is ready`,
              },
            });
            console.log(
              `📧 Sent keyword completion email to ${email} for keyword id ${record.id}`
            );
          } catch (error) {
            console.error(
              `❌ Failed to send keyword completion email to ${email} for id ${record.id}:`,
              error
            );
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      processedNew: pendingKeywords.length,
      finalized: readyKeywords.length,
    });
  } catch (error) {
    console.error("keyword-generation cron error:", error);
    return NextResponse.json(
      { ok: false, error: "keyword-generation cron failed" },
      { status: 500 }
    );
  }
}

