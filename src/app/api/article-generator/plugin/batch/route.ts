import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/config/auth";

export async function GET(req: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session?.user.id as string;
    const batch = await prismaClient.batch.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ batch });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

// creating unique batch
export async function POST(request: Request) {
  
    const { batch, articleType, total_keywords, userId, websiteToPublish, saveOption, scheduleTime } = await request.json();
  
    if (!batch) {
      return NextResponse.json({ error: "Batch is not there" }, { status: 401 });
    }
  
    try{
      let finalBatchName = batch.trim();
      let suffix = 1;
  
      // Check if the batch name exists
      let exists = await prismaClient.batch.findFirst({
          where: { name: finalBatchName }
      });
  
      // If exists, keep incrementing a suffix until it's unique
      while (exists) {
          finalBatchName = `${batch}${suffix}`;
          suffix++;
  
          exists = await prismaClient.batch.findFirst({
              where: { name: finalBatchName }
          });
      }
  
      let batch_created = await prismaClient.batch.create({
        data: {
          userId,
          name: finalBatchName,
          articleType: articleType,
          articles: total_keywords,
          completed_articles: 0,
          pending_articles: total_keywords,
          failed_articles: 0,
          status: 0,
          websiteToPublish: websiteToPublish || null,
          saveOption: saveOption || null,
          scheduleTime: scheduleTime || null,
        },
     });
  
      return NextResponse.json({ status: 200, assignedBatch: batch_created.id });
    } catch (error) {
      console.error("Error creating batch:", error);
      return NextResponse.json(
        { error: "Failed to create batch" },
        { status: 500 }
      );
    }
  }

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
    }

    // First delete all articles associated with this batch
    await prismaClient.godmodeArticles.deleteMany({
      where: { batchId: id },
    });

    // Then delete the batch itself
    await prismaClient.batch.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Batch and its articles deleted successfully" });
  } catch (error) {
    console.error("Error deleting batch:", error);
    return NextResponse.json(
      { error: "Failed to delete batch" },
      { status: 500 }
    );
  }
}
