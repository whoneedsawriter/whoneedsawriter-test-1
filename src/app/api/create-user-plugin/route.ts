import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/libs/loops";

export async function  POST(req: NextRequest) {

    try {
        const { email, name } = await req.json();

        const existingUser = await prismaClient.user.findFirst({
          where: { email },
        });

        const result = await prismaClient.$transaction(async (tx) => {
          const userId = existingUser
            ? existingUser.id
            : (
                await tx.user.create({
                  data: { email, name },
                })
              ).id;

          const otp = Math.floor(100000 + Math.random() * 900000);

          await tx.optVerification.upsert({
            where: { userId },
            update: { opt: otp, status: false, email },
            create: { userId, email, opt: otp },
          });

          await sendTransactionalEmail({
            transactionalId: "cmo9ycy231zpc0i24smepuw9c",
            email: email,
            dataVariables: {
              otp: otp.toString(),
            },
          });

          return { userId };
       });

       if (result instanceof Error) {
           return NextResponse.json({ success: false, message: result.message }, { status: 500 });
       }

       return NextResponse.json({ success: true, message: "OTP sent successfully", userId: result.userId }, { status: 200 });
   } catch (error) {
       console.error("Error creating user:", error);
       return NextResponse.json({ success: false, message: "User creation failed" }, { status: 500 });
   }
}