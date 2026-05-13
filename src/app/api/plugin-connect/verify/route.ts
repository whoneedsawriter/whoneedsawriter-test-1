import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  verifyPluginConnectToken,
  getPluginConnectSecret,
} from "@/libs/plugin-connect";

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * POST { "token": "<connect_token from redirect>" }
 * Header: X-Plugin-Connect-Secret — must match PLUGIN_CONNECT_SECRET or NEXTAUTH_SECRET on the server.
 *
 * Lets the WordPress plugin resolve userId + email without reimplementing base64url HMAC in PHP.
 */
export async function POST(req: Request) {
  const secret = getPluginConnectSecret();
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const headerSecret = req.headers.get("x-plugin-connect-secret") ?? "";
  if (!timingSafeStringEqual(headerSecret, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token =
    body &&
    typeof body === "object" &&
    "token" in body &&
    typeof (body as { token: unknown }).token === "string"
      ? (body as { token: string }).token
      : null;

  if (!token || token.length > 8192) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const payload = verifyPluginConnectToken(token, secret);
  if (!payload) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json({
    userId: payload.sub,
    email: payload.email,
  });
}
