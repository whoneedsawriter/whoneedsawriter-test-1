import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/config/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;

    const keywords = await prismaClient.keywords.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      {
        keywords,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching keyword history:", error);
    return NextResponse.json(
      { error: "Failed to fetch keyword history" },
      { status: 500 }
    );
  }
}

