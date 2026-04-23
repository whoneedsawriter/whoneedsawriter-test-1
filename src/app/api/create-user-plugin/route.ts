import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/libs/loops";

export async function  POST(req: NextRequest) {

    try {
        const { email, name } = await req.json();
        // check if user already exists
        const userExists = await prismaClient.user.findFirst({
          where: {
            email: email,
          },
        });
        if (userExists) {
            return NextResponse.json({ success: false, message: "User already exists" }, { status: 400 });
        }
        
        // transaction start
        const result = await prismaClient.$transaction(async (tx) => {
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

          // send email
          await sendTransactionalEmail({
            transactionalId: "cmo9ycy231zpc0i24smepuw9c",
            email: email,
            dataVariables: {
              otp: otp.toString(),
            },
          });
          
          return { userId: user.id };
       });

       if (result instanceof Error) {
           return NextResponse.json({ success: false, message: result.message }, { status: 500 });
       }

       return NextResponse.json({ success: true, message: "User created successfully", userId: result.userId }, { status: 200 });
   } catch (error) {
       console.error("Error creating user:", error);
       return NextResponse.json({ success: false, message: "User creation failed" }, { status: 500 });
   }
}