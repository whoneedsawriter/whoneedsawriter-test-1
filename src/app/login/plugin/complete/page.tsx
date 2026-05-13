import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "@/config/auth";
import {
  signPluginConnectToken,
  getPluginConnectSecret,
  PLUGIN_CONNECT_REDIRECT_COOKIE,
  PLUGIN_CONNECT_STATE_COOKIE,
} from "@/libs/plugin-connect";

export const dynamic = "force-dynamic";

export default async function PluginLoginCompletePage() {
  const session = await getServerSession(authOptions);
  const cookieStore = cookies();
  const redirectUri = cookieStore.get(PLUGIN_CONNECT_REDIRECT_COOKIE)?.value;
  const state = cookieStore.get(PLUGIN_CONNECT_STATE_COOKIE)?.value ?? "";

  const secret = getPluginConnectSecret();

  if (!secret) {
    cookieStore.delete(PLUGIN_CONNECT_REDIRECT_COOKIE);
    cookieStore.delete(PLUGIN_CONNECT_STATE_COOKIE);
    redirect("/login/plugin?error=config");
  }

  if (!session?.user?.id) {
    redirect("/login/plugin?error=session");
  }

  if (!redirectUri) {
    redirect("/login/plugin?error=missing_context");
  }

  const email = session.user.email || "";
  const token = signPluginConnectToken(session.user.id as string, email, secret);

  cookieStore.delete(PLUGIN_CONNECT_REDIRECT_COOKIE);
  cookieStore.delete(PLUGIN_CONNECT_STATE_COOKIE);

  const target = new URL(redirectUri);
  target.searchParams.set("connect_token", token);
  target.searchParams.set("state", state);

  redirect(target.toString());
}
