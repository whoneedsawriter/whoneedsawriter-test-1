import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function  POST(req: NextRequest) {

    try {
        const { email } = await req.json();
        // check if user exists
        const userExists = await prismaClient.user.findFirst({
          where: {
            email: email,
          },
        });
        if (!userExists) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 400 });
        }
        
       return NextResponse.json({ success: true, message: "User logged in successfully" }, { status: 200 });
   } catch (error) {
       console.error("Error logging in user:", error);
       return NextResponse.json({ success: false, message: "User login failed" }, { status: 500 });
   }
}