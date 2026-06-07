import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { HttpStatusCode } from "axios";
import { prismaClient } from "@/prisma/db";
import { authOptions } from "@/config/auth";
import { User } from "@prisma/client";
import { ApiError } from "@/types/api.types";
import {
  applyDeviceFreeCreditPolicyForCookie,
  createSignedDeviceCookieValue,
} from "@/libs/device-free-credits";
import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
} from "@/libs/device-cookie";
import { cookies } from "next/headers";

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
      let deviceCookieValue = cookies().get(DEVICE_COOKIE_NAME)?.value;
      const shouldSetDeviceCookie = !deviceCookieValue;

      if (!deviceCookieValue) {
        deviceCookieValue = createSignedDeviceCookieValue() || undefined;
      }

      try {
        const result = await applyDeviceFreeCreditPolicyForCookie(
          user.id,
          deviceCookieValue
        );

        if (result === "duplicate_device_free_credits_removed") {
          user.freeCredits = 0;
        }
      } catch (error) {
        console.error("Failed to apply device free-credit policy:", error);
      }

      const response = NextResponse.json(
        { user },
        { status: HttpStatusCode.Ok }
      );

      if (shouldSetDeviceCookie && deviceCookieValue) {
        response.cookies.set(DEVICE_COOKIE_NAME, deviceCookieValue, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
        });
      }

      return response;
    }
  }

  return NextResponse.json(
    { error: "Unauthorized" },
    { status: HttpStatusCode.Unauthorized }
  );
}
