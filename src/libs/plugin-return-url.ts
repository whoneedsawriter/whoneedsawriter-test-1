export function normalizePluginWebsite(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let withoutScheme = raw.replace(/^https?:\/\//i, "");
  withoutScheme = withoutScheme.split(/[?#]/)[0] || "";
  withoutScheme = withoutScheme.replace(/^\/+|\/+$/g, "");

  if (!withoutScheme || withoutScheme.includes("@")) return "";
  if (!/^[a-z0-9.-]+(?::\d+)?(?:\/[a-z0-9._~!$&'()*+,;=:@%/-]*)?$/i.test(withoutScheme)) {
    return "";
  }

  return withoutScheme;
}

export function buildPluginTrialReturnUrl(website: string, planName: string) {
  const normalized = normalizePluginWebsite(website);
  if (!normalized) return "";

  const url = new URL(`https://${normalized}/wp-admin/admin.php`);
  url.searchParams.set("page", "whoneedsawriter-generate");
  url.searchParams.set("wnaw_trial", "started");
  url.searchParams.set("type", "trial");
  url.searchParams.set("plan", planName);
  return url.toString();
}

export function buildPluginBillingReturnUrl(
  website: string,
  status: "success" | "failed",
  type?: "subscription" | "lifetime",
  planName = ""
) {
  const normalized = normalizePluginWebsite(website);
  if (!normalized) return "";

  const url = new URL(`https://${normalized}/wp-admin/admin.php`);
  url.searchParams.set("page", "whoneedsawriter-dashboard");
  url.searchParams.set("payment", status);
  if (status === "success" && type) {
    url.searchParams.set("type", type);
  }
  if (status === "success" && planName) {
    url.searchParams.set("plan", planName);
  }
  return url.toString();
}
