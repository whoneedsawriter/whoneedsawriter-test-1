import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { email, opt } = await req.json();
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpVerification = await prismaClient.otpVerification.create({
        data: {
            email,
            opt,
        },
    });
    return NextResponse.json({ otpVerification });
}