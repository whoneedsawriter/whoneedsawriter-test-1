import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { upsertPluginSite } from "@/libs/plugin-billing-auth";

export async function POST(req: NextRequest) {
    const { userId, otp, website, siteSecret } = await req.json();
    const optVerification = await prismaClient.optVerification.findFirst({
        where: {
            userId: userId,
            opt: parseInt(otp) as number,
        },
    });
    if (!optVerification) {
        return NextResponse.json({ success: false, message: "Invalid OTP" }, { status: 400 });
    }

    await prismaClient.optVerification.update({
        where: { id: optVerification.id },
        data: { status: true },
    });

    if (website && siteSecret) {
        await upsertPluginSite(String(userId || ""), String(website || ""), String(siteSecret || ""));
    }

    return NextResponse.json({ success: true, message: "OTP verified" }, { status: 200 });
}
