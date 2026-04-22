import { prismaClient } from "@/prisma/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    // accept request from any domain
    const headersList = await headers();
    headersList.set("Access-Control-Allow-Origin", "*");
    headersList.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headersList.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headersList.set("Access-Control-Allow-Credentials", "true");

    const { email, name } = await req.json();
    const user = await prismaClient.user.create({
        data: {
            email,
            name,
        },
    });
    return NextResponse.json({ user });
}