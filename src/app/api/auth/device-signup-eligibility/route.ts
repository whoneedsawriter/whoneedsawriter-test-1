import {
  createSignedDeviceCookieValue,
  getDeviceSignupEligibilityForCookie,
} from "@/libs/device-free-credits";
import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
} from "@/libs/device-cookie";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({ email: null }));
  let deviceCookieValue = cookies().get(DEVICE_COOKIE_NAME)?.value;

  if (!deviceCookieValue) {
    deviceCookieValue = createSignedDeviceCookieValue() || undefined;
  }

  const result = await getDeviceSignupEligibilityForCookie(
    typeof email === "string" ? email : null,
    deviceCookieValue
  );

  const response = NextResponse.json({
    ...result,
    message: result.allowed
      ? "Signup allowed"
      : "An account already exists. Please log in with your existing account.",
  });

  if (deviceCookieValue && !cookies().get(DEVICE_COOKIE_NAME)?.value) {
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
