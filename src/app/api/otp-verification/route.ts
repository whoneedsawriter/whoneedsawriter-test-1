import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { userId, email } = await req.json();
    const otp = Math.floor(100000 + Math.random() * 900000);
    const optVerification = await prismaClient.optVerification.create({
        data: {
            userId,
            email: email,
            opt: otp,
            status: false,
        },
    });
    return NextResponse.json({ optVerification });
}