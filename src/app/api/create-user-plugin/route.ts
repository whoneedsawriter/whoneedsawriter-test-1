import { prismaClient } from "@/prisma/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function  POST(req: NextRequest) {

    const { email, name } = await req.json();
    const user = await prismaClient.user.create({
        data: {
            email,
            name,
        },
    });
    return NextResponse.json({ user });
}