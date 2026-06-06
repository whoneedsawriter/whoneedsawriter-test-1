import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { HttpStatusCode } from "axios";
import { prismaClient } from "@/prisma/db";
import { authOptions } from "@/config/auth";
import { User } from "@prisma/client";
import { ApiError } from "@/types/api.types";
import { applyDeviceFreeCreditPolicy } from "@/libs/device-free-credits";

export type UserResponse = {
  user: User;
};

export async function GET(): Promise<NextResponse<UserResponse | ApiError>> {
  const session = await getServerSession(authOptions);

  if (!session || !session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  if (session && session?.user?.email) {
    const user = await prismaClient.user.findFirst({
      where: {
        email: session?.user?.email,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: HttpStatusCode.Unauthorized }
      );
    }

    if (user) {
      try {
        const result = await applyDeviceFreeCreditPolicy(user.id);

        if (result === "duplicate_device_free_credits_removed") {
          user.freeCredits = 0;
        }
      } catch (error) {
        console.error("Failed to apply device free-credit policy:", error);
      }

      return NextResponse.json({ user }, { status: HttpStatusCode.Ok });
    }
  }

  return NextResponse.json(
    { error: "Unauthorized" },
    { status: HttpStatusCode.Unauthorized }
  );
}
