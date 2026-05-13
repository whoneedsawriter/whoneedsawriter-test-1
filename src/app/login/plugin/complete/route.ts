import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";
import { authOptions } from "@/config/auth";
import {
  signPluginConnectToken,
  getPluginConnectSecret,
  PLUGIN_CONNECT_REDIRECT_COOKIE,
  PLUGIN_CONNECT_STATE_COOKIE,
} from "@/libs/plugin-connect";

export const dynamic = "force-dynamic";

function sameOriginRedirect(request: Request, pathnameWithQuery: string) {
  const url = new URL(pathnameWithQuery, new URL(request.url).origin);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const cookieStore = cookies();
  const redirectUri = cookieStore.get(PLUGIN_CONNECT_REDIRECT_COOKIE)?.value;
  const state = cookieStore.get(PLUGIN_CONNECT_STATE_COOKIE)?.value ?? "";

  const secret = getPluginConnectSecret();

  if (!secret) {
    const res = sameOriginRedirect(request, "/login/plugin?error=config");
    res.cookies.delete(PLUGIN_CONNECT_REDIRECT_COOKIE);
    res.cookies.delete(PLUGIN_CONNECT_STATE_COOKIE);
    return res;
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return sameOriginRedirect(request, "/login/plugin?error=session");
  }

  if (!redirectUri) {
    return sameOriginRedirect(request, "/login/plugin?error=missing_context");
  }

  const email = session.user.email || "";
  const token = signPluginConnectToken(
    session.user.id as string,
    email,
    secret
  );

  const target = new URL(redirectUri);
  target.searchParams.set("connect_token", token);
  target.searchParams.set("state", state);

  const res = NextResponse.redirect(target);
  res.cookies.delete(PLUGIN_CONNECT_REDIRECT_COOKIE);
  res.cookies.delete(PLUGIN_CONNECT_STATE_COOKIE);
  return res;
}
