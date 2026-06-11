import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

type ApiError = { error: string };

export type PluginJobArticleRow = {
  id: string;
  batchId: string;
  articleIndex: number;
  keyword: string;
  title: string | null;
  status: number;
  model: string | null;
  category: string | null;
  author: string | null;
  isPublished: boolean;
  scheduleTime: string | null;
  publishedStartDateTime: string | null;
  batchName: string | null;
};

export type PluginJobsResponse = {
  articles: PluginJobArticleRow[];
};

type PluginArticleDbRow = Pick<
  PluginJobArticleRow,
  "id" | "batchId" | "keyword" | "title" | "status" | "model" | "category" | "author" | "isPublished"
>;

type PluginBatchScheduleRow = {
  id: string;
  name: string;
  scheduleTime: string | null;
  publishedStartDateTime: Date | null;
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<PluginJobsResponse | ApiError>> {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId")?.trim();
    const batchId = searchParams.get("batchId")?.trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required query param: id" },
        { status: 400 }
      );
    }

    const userExists = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    let rows: PluginArticleDbRow[];
    if (batchId) {
      rows = await prismaClient.godmodeArticles.findMany({
        where: { userId, batchId: batchId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          batchId: true,
          keyword: true,
          title: true,
          status: true,
          model: true,
          category: true,
          author: true,
          isPublished: true,
        },
      });
    }else{
      rows = await prismaClient.godmodeArticles.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          batchId: true,
          keyword: true,
          title: true,
          status: true,
          model: true,
          category: true,
          author: true,
          isPublished: true,
        },
      });
    }

    const batchIds = Array.from(new Set(rows.map((row) => row.batchId).filter(Boolean)));
    const batchRows: PluginBatchScheduleRow[] = batchIds.length
      ? await prismaClient.batch.findMany({
          where: { id: { in: batchIds }, userId },
          select: {
            id: true,
            name: true,
            scheduleTime: true,
            publishedStartDateTime: true,
          },
        })
      : [];
    const batchById = new Map(
      batchRows.map((batch) => [
        batch.id,
        {
          name: batch.name,
          scheduleTime: batch.scheduleTime ?? null,
          publishedStartDateTime: batch.publishedStartDateTime
            ? batch.publishedStartDateTime.toISOString()
            : null,
        },
      ])
    );

    const orderedArticles: Array<Pick<PluginArticleDbRow, "id" | "batchId">> = batchIds.length
      ? await prismaClient.godmodeArticles.findMany({
          where: { userId, batchId: { in: batchIds } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, batchId: true },
        })
      : [];
    const articleIndexById = new Map<string, number>();
    const nextIndexByBatch = new Map<string, number>();
    for (const article of orderedArticles) {
      const nextIndex = nextIndexByBatch.get(article.batchId) ?? 0;
      articleIndexById.set(article.id, nextIndex);
      nextIndexByBatch.set(article.batchId, nextIndex + 1);
    }

    const articles: PluginJobArticleRow[] = rows.map((row) => {
      const batch = batchById.get(row.batchId);

      return {
        ...row,
        articleIndex: articleIndexById.get(row.id) ?? 0,
        scheduleTime: batch?.scheduleTime ?? null,
        publishedStartDateTime: batch?.publishedStartDateTime ?? null,
        batchName: batch?.name ?? null,
      };
    });

    return NextResponse.json({ articles }, { status: 200 });
  } catch (error) {
    console.error("Error fetching plugin jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}
