import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/config/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Extract data from request body
    const {
      generationId,
    } = body;

    // Validate required fields
    if (!generationId) {
      return NextResponse.json(
        { error: "Generation ID is required" },
        { status: 400 }
      );
    }

    // Insert data into keywords table
    const keywordRecord = await prismaClient.keywords.findFirst({
      where: {
        id: generationId,
      },
      select: {
        json: true,
      },
    });

    if (keywordRecord?.json) {
      return NextResponse.json({
        success: true,
        message: "completed",
      }, { status: 200 });
    }

    return NextResponse.json({ message: "not completed" }, { status: 200 });
  } catch (error) {
    console.error("Error checking keyword research:", error);
    return NextResponse.json(
      { error: "Failed to check keyword research" },
      { status: 500 }
    );
  }
}
