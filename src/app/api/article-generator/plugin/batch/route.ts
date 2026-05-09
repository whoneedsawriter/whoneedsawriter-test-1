import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/config/auth";

/** MMDDYY in UTC, e.g. 052026 → May 20, 2026 */
function formatPluginBatchDatePart(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
  return `${mm}${dd}${yy}`;
}

async function generateUniquePluginBatchName(): Promise<string> {
  const datePart = formatPluginBatchDatePart(new Date());
  const prefix = `#WNAW-${datePart}-`;
  let seq = 1;
  let candidate = `${prefix}${seq}`;

  let exists = await prismaClient.batch.findFirst({
    where: { name: candidate },
  });

  while (exists) {
    seq++;
    candidate = `${prefix}${seq}`;
    exists = await prismaClient.batch.findFirst({
      where: { name: candidate },
    });
  }

  return candidate;
}

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
  const { articleType, total_keywords, userId, websiteToPublish, saveOption, scheduleTime } =
    await request.json();

  try {
    const finalBatchName = await generateUniquePluginBatchName();

    const batch_created = await prismaClient.batch.create({
      data: {
        userId,
        name: finalBatchName,
        articleType: articleType,
        articles: total_keywords,
        completed_articles: 0,
        pending_articles: total_keywords,
        failed_articles: 0,
        status: 0,
        createdBy: "plugin",
        websiteToPublish: websiteToPublish || "",
        saveOption: saveOption || "",
        scheduleTime: scheduleTime || "",
      } as any,
    });

    return NextResponse.json({
      status: 200,
      assignedBatch: batch_created.id,
      batchName: batch_created.name,
    });
  } catch (error) {
    console.error("Error creating batch:", error);
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
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
