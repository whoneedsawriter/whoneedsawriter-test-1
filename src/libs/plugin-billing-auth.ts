import { createHash, createHmac, timingSafeEqual } from "crypto";
import { prismaClient } from "@/prisma/db";
import { normalizePluginWebsite } from "@/libs/plugin-return-url";

export type PluginBillingAction = "trial" | "pricing" | "subscription" | "lifetime";

export type PluginBillingTokenPayload = {
  sub: string;
  website: string;
  action: PluginBillingAction;
  iat: number;
  exp: number;
};

function getBillingTokenSecret() {
  return (
    process.env.PLUGIN_BILLING_TOKEN_SECRET ||
    process.env.PLUGIN_CONNECT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""
  );
}

function base64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function timingSafeStringEqual(a: string, b: string) {
  try {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(new Uint8Array(ab), new Uint8Array(bb));
  } catch {
    return false;
  }
}

export function hashPluginSiteSecret(siteSecret: string) {
  return createHash("sha256").update(String(siteSecret || ""), "utf8").digest("hex");
}

export async function upsertPluginSite(userId: string, website: string, siteSecret: string) {
  const safeUserId = String(userId || "").trim();
  const safeWebsite = normalizePluginWebsite(website);
  const safeSecret = String(siteSecret || "").trim();

  if (!safeUserId || !safeWebsite || safeSecret.length < 32) {
    return null;
  }

  return prismaClient.pluginSite.upsert({
    where: {
      userId_website: {
        userId: safeUserId,
        website: safeWebsite,
      },
    },
    update: {
      siteSecretHash: hashPluginSiteSecret(safeSecret),
      lastSeenAt: new Date(),
    },
    create: {
      userId: safeUserId,
      website: safeWebsite,
      siteSecretHash: hashPluginSiteSecret(safeSecret),
      lastSeenAt: new Date(),
    },
  });
}

export async function verifyPluginSiteSecret(userId: string, website: string, siteSecret: string) {
  const safeUserId = String(userId || "").trim();
  const safeWebsite = normalizePluginWebsite(website);
  const safeSecret = String(siteSecret || "").trim();

  if (!safeUserId || !safeWebsite || safeSecret.length < 32) {
    return null;
  }

  const site = await prismaClient.pluginSite.findUnique({
    where: {
      userId_website: {
        userId: safeUserId,
        website: safeWebsite,
      },
    },
  });

  if (!site) return null;
  if (!timingSafeStringEqual(site.siteSecretHash, hashPluginSiteSecret(safeSecret))) {
    return null;
  }

  await prismaClient.pluginSite.update({
    where: { id: site.id },
    data: { lastSeenAt: new Date() },
  });

  return site;
}

export function signPluginBillingToken(
  userId: string,
  website: string,
  action: PluginBillingAction,
  ttlSeconds = 15 * 60
) {
  const secret = getBillingTokenSecret();
  const safeUserId = String(userId || "").trim();
  const safeWebsite = normalizePluginWebsite(website);

  if (!secret || !safeUserId || !safeWebsite) {
    return "";
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: PluginBillingTokenPayload = {
    sub: safeUserId,
    website: safeWebsite,
    action,
    iat: now,
    exp: now + ttlSeconds,
  };
  const body = base64urlJson(payload);
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export async function verifyPluginBillingToken(
  token: string,
  allowedActions: PluginBillingAction[] = ["trial", "pricing", "subscription", "lifetime"]
) {
  const secret = getBillingTokenSecret();
  const safeToken = String(token || "").trim();
  if (!secret || !safeToken || safeToken.length > 8192) {
    return null;
  }

  const dot = safeToken.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = safeToken.slice(0, dot);
  const sig = safeToken.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }

  if (actual.length !== expected.length || !timingSafeEqual(new Uint8Array(actual), new Uint8Array(expected))) {
    return null;
  }

  let payload: PluginBillingTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const website = normalizePluginWebsite(payload.website);
  if (
    !payload.sub ||
    !website ||
    !allowedActions.includes(payload.action) ||
    typeof payload.exp !== "number" ||
    payload.exp < now
  ) {
    return null;
  }

  const site = await prismaClient.pluginSite.findUnique({
    where: {
      userId_website: {
        userId: payload.sub,
        website,
      },
    },
  });

  if (!site) return null;

  const user = await prismaClient.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user?.email) return null;

  return {
    user,
    site,
    userId: payload.sub,
    website,
    action: payload.action,
  };
}

export async function signVerifiedPluginBillingToken(
  userId: string,
  website: string,
  siteSecret: string,
  action: PluginBillingAction
) {
  const site = await verifyPluginSiteSecret(userId, website, siteSecret);
  if (!site) return "";
  return signPluginBillingToken(userId, site.website, action);
}
