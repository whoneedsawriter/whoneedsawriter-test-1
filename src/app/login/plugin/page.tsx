import { brandName } from "@/config";
import { getSEOTags } from "@/components/SEOTags/SEOTags";
import { Metadata } from "next";
import { cookies } from "next/headers";
import LoginPlugin from "@/components/pages/Login/LoginPlugin";
import {
  PLUGIN_CONNECT_REDIRECT_COOKIE,
  PLUGIN_CONNECT_STATE_COOKIE,
} from "@/libs/plugin-connect";

export const dynamic = "force-dynamic";

export const metadata: Metadata = getSEOTags({
  title: `Connect WordPress | ${brandName}`,
  description: `Sign in to link your WordPress site | ${brandName}`,
});

const ERROR_HELP: Record<string, string> = {
  session:
    "Sign-in was interrupted. Use “Continue with Google” again to finish linking your site.",
  config:
    "This environment is missing plugin connect configuration. Contact support.",
  missing_context:
    "The connect session expired. Open the link from your WordPress plugin again.",
};

export default function PluginLoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const cookieStore = cookies();
  let redirectUri =
    typeof searchParams.redirect_uri === "string"
      ? searchParams.redirect_uri
      : "";
  let state =
    typeof searchParams.state === "string" ? searchParams.state : "";

  if (!redirectUri) {
    redirectUri =
      cookieStore.get(PLUGIN_CONNECT_REDIRECT_COOKIE)?.value || "";
  }
  if (!state) {
    state = cookieStore.get(PLUGIN_CONNECT_STATE_COOKIE)?.value || "";
  }

  const errorKey =
    typeof searchParams.error === "string" ? searchParams.error : "";
  const initialError = errorKey
    ? ERROR_HELP[errorKey] || `Something went wrong (${errorKey}).`
    : null;

  return (
    <LoginPlugin
      redirectUri={redirectUri}
      initialState={state}
      initialError={initialError}
    />
  );
}
