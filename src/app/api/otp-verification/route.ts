import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { userId, otp } = await req.json();
    const optVerification = await prismaClient.optVerification.findFirst({
        where: {
            userId: userId,
            opt: parseInt(otp) as number,
        },
    });
    if (!optVerification) {
        return NextResponse.json({ success: false, message: "Invalid OTP" }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "OTP verified" }, { status: 200 });
}