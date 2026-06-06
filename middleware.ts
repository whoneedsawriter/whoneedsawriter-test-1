import { NextRequest, NextResponse } from "next/server";
import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
} from "@/libs/device-cookie";

function getDeviceCookieSecret() {
  return process.env.DEVICE_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function toBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...Array.from(new Uint8Array(bytes)));

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signDeviceId(deviceId: string) {
  const secret = getDeviceCookieSecret();

  if (!secret) {
    return "";
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(deviceId)
  );

  return toBase64Url(signature);
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (request.cookies.has(DEVICE_COOKIE_NAME)) {
    return response;
  }

  const deviceId = crypto.randomUUID();
  const signature = await signDeviceId(deviceId);

  if (!signature) {
    return response;
  }

  response.cookies.set(DEVICE_COOKIE_NAME, `${deviceId}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|favicon-16x16.png|favicon-32x32.png|site.webmanifest|safari-pinned-tab.svg|images|api/webhooks).*)",
  ],
};

