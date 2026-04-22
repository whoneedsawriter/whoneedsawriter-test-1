import { prismaClient } from "@/prisma/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function  POST(req: NextRequest) {

    try {
    // transaction start
    const result = await prismaClient.$transaction(async (tx) => {
        const { email, name } = await req.json();
        const user = await tx.user.create({
            data: {
                email,
                name,
            },
        });

        // create OTP
        const otp = Math.floor(100000 + Math.random() * 900000);
        await tx.optVerification.create({
            data: {
                userId: user.id,
                email: email,
                opt: otp,
            },
        });

        return user;
    });

    if (result instanceof Error) {
        return NextResponse.json({ success: false, message: result.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "User created successfully" }, { status: 200 });
} catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ success: false, message: "User creation failed" }, { status: 500 });
    }
}