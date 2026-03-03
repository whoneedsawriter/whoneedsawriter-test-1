import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/config/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Generation ID is required" },
        { status: 400 }
      );
    }

    const record = await prismaClient.keywords.findFirst({
      where: { id, userId },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Keyword generation not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ keyword: record }, { status: 200 });
  } catch (error) {
    console.error("Error fetching keyword generation:", error);
    return NextResponse.json(
      { error: "Failed to fetch keyword generation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Generation ID is required" },
        { status: 400 }
      );
    }

    const record = await prismaClient.keywords.findFirst({
      where: { id, userId },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Keyword generation not found or access denied" },
        { status: 404 }
      );
    }

    await prismaClient.keywords.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, message: "Keyword generation deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting keyword generation:", error);
    return NextResponse.json(
      { error: "Failed to delete keyword generation" },
      { status: 500 }
    );
  }
}
