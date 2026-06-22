import { prismaClient } from "@/prisma/db";
import {
  GENERATION_ACCESS_REQUIRED_MESSAGE,
  TRIAL_ENDED_UPGRADE_MESSAGE,
  hasGenerationAccess,
  isTrialCreditsExhausted,
} from "@/libs/generation-access";
import {
  signVerifiedPluginBillingToken,
  verifyPluginSiteSecret,
} from "@/libs/plugin-billing-auth";
import { normalizePluginWebsite } from "@/libs/plugin-return-url";

type PluginUserPlan = {
  status?: string | null;
  validUntil?: Date | string | null;
  trialEndsAt?: Date | string | null;
  planId?: number | null;
  trialCreditsGranted?: number | null;
  trialCreditsUsed?: number | null;
};

type PluginAccessUser = {
  id: string;
  email: string | null;
  freeCredits: number;
  monthyBalance: number;
  monthyPlan: number;
  lifetimeBalance: number;
  lifetimePlan: number;
};

function isFutureDate(value?: Date | string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function isPastDate(value?: Date | string | null) {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function normalizeStatus(status?: string | null) {
  const value = String(status || "").trim().toLowerCase();
  if (
    value === "trialing" ||
    value === "active" ||
    value === "canceled" ||
    value === "expired" ||
    value === "past_due" ||
    value === "checkout_pending"
  ) {
    return value;
  }
  return "none";
}

function normalizePlanLabel(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "pro") return "Starter";
  if (lower === "starter") return "Starter";
  if (lower === "premium") return "Premium";
  if (lower === "ultimate") return "Ultimate";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function inferLegacyPlanName(user: PluginAccessUser) {
  if (Number(user.lifetimePlan || 0) >= 200 || Number(user.monthyPlan || 0) >= 200) return "Ultimate";
  if (Number(user.lifetimePlan || 0) >= 60 || Number(user.monthyPlan || 0) >= 60) return "Premium";
  if (Number(user.lifetimePlan || 0) > 0 || Number(user.monthyPlan || 0) > 0) return "Starter";
  return null;
}

function buildPluginTrialUrl(token: string, planId?: number | null) {
  if (!token) return "";
  const params = new URLSearchParams();
  params.set("token", token);
  if (planId) params.set("planId", String(planId));
  return `/checkout/trial?${params.toString()}`;
}

function buildPluginPricingUrl(token: string) {
  if (!token) return "";
  const params = new URLSearchParams();
  params.set("token", token);
  return `/pricing?${params.toString()}`;
}

export async function getPluginAccountAccess(userId: string, website = "", siteSecret = "") {
  const normalizedWebsite = normalizePluginWebsite(website);
  const verifiedSite = normalizedWebsite && siteSecret
    ? await verifyPluginSiteSecret(userId, normalizedWebsite, siteSecret)
    : null;
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      freeCredits: true,
      monthyBalance: true,
      monthyPlan: true,
      lifetimeBalance: true,
      lifetimePlan: true,
    },
  });

  if (!user) return null;

  const userPlan = await prismaClient.userPlan.findUnique({
    where: { userId },
  });

  const subscriptionPlan = userPlan?.planId
    ? await prismaClient.subscriptionPlan.findUnique({ where: { id: userPlan.planId } })
    : null;
  const lifetimePlan = userPlan?.planId && !subscriptionPlan
    ? await prismaClient.lifetimePlan.findUnique({ where: { id: userPlan.planId } })
    : null;
  const trialUsage = user.email
    ? await prismaClient.trialUsage.findUnique({
        where: { email: user.email.toLowerCase() },
      })
    : null;

  const accessUser = {
    monthyBalance: user.monthyBalance,
    lifetimeBalance: user.lifetimeBalance,
    UserPlan: userPlan as PluginUserPlan | null,
  };
  const normalizedStatus = normalizeStatus(userPlan?.status);
  const hasPaidBalance = Number(user.monthyBalance || 0) > 0 || Number(user.lifetimeBalance || 0) > 0;
  const canGenerate = hasGenerationAccess(accessUser) || hasPaidBalance;
  const trialCreditsExhausted = isTrialCreditsExhausted(userPlan as PluginUserPlan | null);
  const trialExpired = normalizedStatus === "trialing" && isPastDate(userPlan?.trialEndsAt);
  const trialEnded =
    trialCreditsExhausted || trialExpired;
  const hasActivePaidPlan =
    normalizedStatus === "active" ||
    (normalizedStatus === "canceled" && isFutureDate(userPlan?.validUntil)) ||
    (!userPlan && hasPaidBalance) ||
    (normalizedStatus === "none" && hasPaidBalance);
  const activePlanName =
    normalizePlanLabel(subscriptionPlan?.name || lifetimePlan?.name || userPlan?.lemonPlanName) ||
    inferLegacyPlanName(user);
  const trialEligible = Boolean(
    user.email &&
      !trialUsage &&
      !canGenerate &&
      !hasActivePaidPlan &&
      normalizedStatus !== "checkout_pending"
  );

  const trialToken = verifiedSite
    ? await signVerifiedPluginBillingToken(userId, normalizedWebsite, siteSecret, "trial")
    : "";
  const pricingToken = verifiedSite
    ? await signVerifiedPluginBillingToken(userId, normalizedWebsite, siteSecret, "pricing")
    : "";
  const pluginAuthMissing = Boolean(normalizedWebsite && !verifiedSite);

  let ctaLabel = "Buy Credits";
  let ctaKind = "credits";
  let ctaUrl = buildPluginPricingUrl(pricingToken);
  let ctaDisabled = pluginAuthMissing;
  let accessMessage = pluginAuthMissing
    ? "Reconnect this WordPress site before managing billing."
    : "";

  if (trialEligible) {
    ctaLabel = "Start Trial";
    ctaKind = "trial";
    ctaUrl = buildPluginTrialUrl(trialToken, subscriptionPlan?.id || null);
  } else if (trialEnded) {
    ctaLabel = "Upgrade";
    ctaKind = "upgrade";
    ctaUrl = buildPluginPricingUrl(pricingToken);
    accessMessage = TRIAL_ENDED_UPGRADE_MESSAGE;
  } else if (normalizedStatus === "trialing") {
    ctaLabel = "Trial";
    ctaKind = "plan";
  } else if (activePlanName) {
    ctaLabel = activePlanName;
    ctaKind = "plan";
  } else if (
    normalizedStatus === "expired" ||
    normalizedStatus === "past_due" ||
    (normalizedStatus === "canceled" && !isFutureDate(userPlan?.validUntil))
  ) {
    ctaLabel = "Upgrade";
    ctaKind = "upgrade";
    ctaUrl = buildPluginPricingUrl(pricingToken);
  }

  if (!ctaUrl && !["trialing", "active"].includes(normalizedStatus)) {
    ctaDisabled = true;
  }

  return {
    user,
    userPlan,
    subscriptionPlan,
    lifetimePlan,
    trialUsage,
    credits: Number(user.freeCredits || 0) + Number(user.monthyBalance || 0) + Number(user.lifetimeBalance || 0),
    balance_type:
      Number(user.monthyBalance || 0) > 0
        ? "monthyBalance"
        : Number(user.lifetimeBalance || 0) > 0
          ? "lifetimeBalance"
          : "freeCredits",
    access: {
      status: normalizedStatus,
      hasGenerationAccess: canGenerate,
      trialEligible,
      activePlanName,
      trialEndsAt: userPlan?.trialEndsAt ? new Date(userPlan.trialEndsAt).toISOString() : null,
      trialCreditsGranted: Number(userPlan?.trialCreditsGranted || 0),
      trialCreditsUsed: Number(userPlan?.trialCreditsUsed || 0),
      message: accessMessage,
    },
    cta: {
      label: ctaLabel,
      kind: ctaKind,
      url: ctaUrl,
      trialUrl: buildPluginTrialUrl(trialToken, subscriptionPlan?.id || null),
      pricingUrl: buildPluginPricingUrl(pricingToken),
      disabled: ctaDisabled,
    },
    creditsLoaded: true,
    generationError: trialEnded
      ? { error: TRIAL_ENDED_UPGRADE_MESSAGE, code: "TRIAL_ENDED" as const }
      : { error: GENERATION_ACCESS_REQUIRED_MESSAGE, code: "TRIAL_REQUIRED" as const },
  };
}

export async function getPluginGenerationAccessFailure(userId: string) {
  const account = await getPluginAccountAccess(userId);
  if (!account) {
    return { error: "User not found", code: "USER_NOT_FOUND" as const, status: 404 };
  }
  if (account.access.hasGenerationAccess) {
    return null;
  }
  return { ...account.generationError, status: 403 };
}
