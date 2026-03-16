import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/config/auth";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;
    const userEmail = session.user.email as string;
    const body = await req.json();

    // Extract data from request body
    const {
      websiteUrl,
      topic,
      description,
      goal,
    } = body;

    // Validate required fields
    if (!description || !goal) {
      return NextResponse.json(
        { error: "Description and goal are required" },
        { status: 400 }
      );
    }

    // Insert data into keywords table
    const keywordRecord = await prismaClient.keywords.create({
      data: {
        userId,
        website_url: websiteUrl || null,
        seedKeyword: topic || null,
        description: description || null,
        goal: goal || null,
      },
    });

// deduct balance 0.1 credit for keyword research
const user = await prismaClient.user.findUnique({ where: { id: userId } });
if(user && user?.monthyBalance > 0) {
  await prismaClient.user.update({
    where: { id: userId },
    data: { monthyBalance: user?.monthyBalance - 0.1 },
  });
} else if(user && user.lifetimeBalance > 0){
  await prismaClient.user.update({
    where: { id: userId },
    data: { lifetimeBalance: user?.lifetimeBalance - 0.1 },
  });
} else {
  await prismaClient.user.update({
    where: { id: userId },
    data: { freeCredits: (user?.freeCredits || 0) - 0.1 },
  });
  }
  
  return NextResponse.json({
    success: true,
    message: "Keyword research request created successfully",
    id: keywordRecord.id,
  }, { status: 200 });

} catch (error) {
  console.error("Error creating keyword research:", error);
  return NextResponse.json({ error: "Failed to deduct balance" }, { status: 400 });
}
}