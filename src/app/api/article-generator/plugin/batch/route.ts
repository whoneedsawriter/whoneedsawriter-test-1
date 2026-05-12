import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/config/auth";

/** e.g. May 09, 2026 at 10:30 AM (server local time) */
function formatPluginBatchCreatedAt(d: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ] as const;
  const month = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${month} ${day}, ${year} at ${hour}:${minute} ${ampm}`;
}

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

function toPluginBatchPayload(batch: {
  name: string;
  id: string;
  articles: number;
  completed_articles: number;
  pending_articles: number;
  failed_articles: number;
  status: number;
  createdAt: Date;
}) {
  return {
    name: batch.name,
    id: batch.id,
    articles: batch.articles,
    completed_articles: batch.completed_articles,
    pending_articles: batch.pending_articles,
    failed_articles: batch.failed_articles,
    status: batch.status,
    createdAt: formatPluginBatchCreatedAt(new Date(batch.createdAt)),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId =
      searchParams.get("userId")?.trim() || req.headers.get("x-user-id")?.trim() || "";
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 401 });
    }

    const batchId = searchParams.get("batchId")?.trim();

    if (batchId) {
      const batch = await prismaClient.batch.findFirst({
        where: { id: batchId, userId },
      });
      if (!batch) {
        return NextResponse.json({ error: "Batch not found" }, { status: 404 });
      }
      return NextResponse.json(toPluginBatchPayload(batch), { status: 200 });
    }

    const batches = await prismaClient.batch.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      batch: batches.map(toPluginBatchPayload),
    }, { status: 200 });
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
  const { articleType, total_keywords, userId, websiteToPublish, saveOption, scheduleTime, publishedStartDateTime } =
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
        publishedStartDateTime: publishedStartDateTime || null,
      } as any,
    });

    return NextResponse.json({
      status: 200,
      assignedBatch: batch_created.id
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
