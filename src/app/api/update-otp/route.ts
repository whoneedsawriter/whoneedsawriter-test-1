import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, message: "userId is required" },
        { status: 400 },
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    const existingOtp = await prismaClient.optVerification.findFirst({
      where: { userId },
    });

    if (existingOtp) {
      await prismaClient.optVerification.update({
        where: { id: existingOtp.id },
        data: {
          opt: otp,
          status: false,
          ...(typeof email === "string" ? { email } : {}),
        },
      });
    }

    return NextResponse.json({ success: true, otp });
  } catch (error) {
    console.error("Error updating otp:", error);
    return NextResponse.json(
      { success: false, message: "OTP update failed" },
      { status: 500 },
    );
  }
}

