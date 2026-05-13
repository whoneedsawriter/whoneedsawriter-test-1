import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isRedirectUriAllowed,
  PLUGIN_CONNECT_REDIRECT_COOKIE,
  PLUGIN_CONNECT_STATE_COOKIE,
} from "@/libs/plugin-connect";

const COOKIE_MAX_AGE = 600;
const MAX_STATE_LEN = 512;
const MAX_REDIRECT_LEN = 2048;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { redirect_uri: redirectUri, state } = body as Record<
    string,
    unknown
  >;

  if (typeof redirectUri !== "string" || redirectUri.length === 0) {
    return NextResponse.json({ error: "redirect_uri required" }, { status: 400 });
  }
  if (redirectUri.length > MAX_REDIRECT_LEN) {
    return NextResponse.json({ error: "redirect_uri too long" }, { status: 400 });
  }

  const stateStr =
    typeof state === "string" ? state : state === undefined ? "" : null;
  if (stateStr === null) {
    return NextResponse.json({ error: "state must be a string" }, { status: 400 });
  }
  if (stateStr.length > MAX_STATE_LEN) {
    return NextResponse.json({ error: "state too long" }, { status: 400 });
  }

  if (!isRedirectUriAllowed(redirectUri)) {
    return NextResponse.json({ error: "redirect_uri not allowed" }, { status: 403 });
  }

  const cookieStore = cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(PLUGIN_CONNECT_REDIRECT_COOKIE, redirectUri, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  cookieStore.set(PLUGIN_CONNECT_STATE_COOKIE, stateStr, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
