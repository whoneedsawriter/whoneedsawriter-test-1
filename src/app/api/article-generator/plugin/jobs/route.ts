import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

type ApiError = { error: string };

export type PluginJobArticleRow = {
  keyword: string;
  title: string | null;
  status: number;
  model: string | null;
  category: string | null;
  author: string | null;
  isPublished: boolean;
};

export type PluginJobsResponse = {
  articles: PluginJobArticleRow[];
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<PluginJobsResponse | ApiError>> {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id")?.trim();

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

    const rows = await prismaClient.godmodeArticles.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        keyword: true,
        title: true,
        status: true,
        model: true,
        category: true,
        author: true,
        isPublished: true,
      },
    });

    return NextResponse.json({ articles: rows }, { status: 200 });
  } catch (error) {
    console.error("Error fetching plugin jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}
