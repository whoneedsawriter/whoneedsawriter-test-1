import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

type ApiError = { error: string };

export type PluginDashboardResponse = {
  articlesGenerated: number;
  articlesPublished: number;
  activeJobs: number;
  failedJobs: number;
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<PluginDashboardResponse | ApiError>> {
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

    const whereUser = { userId };

    const [
      articlesGenerated,
      articlesPublished,
      activeJobs,
      failedJobs,
    ] = await Promise.all([
      prismaClient.godmodeArticles.count({
        where: { ...whereUser, status: 1 },
      }),
      prismaClient.godmodeArticles.count({
        where: { ...whereUser, isPublished: true },
      }),
      prismaClient.godmodeArticles.count({
        where: { ...whereUser, status: 0 },
      }),
      prismaClient.godmodeArticles.count({
        where: { ...whereUser, status: 2 },
      }),
    ]);

    return NextResponse.json(
      {
        articlesGenerated,
        articlesPublished,
        activeJobs,
        failedJobs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching plugin dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
