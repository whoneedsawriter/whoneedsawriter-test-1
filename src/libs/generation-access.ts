type GenerationAccessUserPlan = {
  status?: string | null;
  validUntil?: Date | string | null;
  trialEndsAt?: Date | string | null;
  planId?: number | null;
  trialCreditsGranted?: number | null;
  trialCreditsUsed?: number | null;
};

type GenerationAccessUser = {
  monthyBalance?: number | null;
  lifetimeBalance?: number | null;
  UserPlan?: GenerationAccessUserPlan | null;
};

function isFutureDate(value?: Date | string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

export function hasGenerationAccess(user?: GenerationAccessUser | null) {
  const userPlan = user?.UserPlan;

  if (!userPlan) {
    return false;
  }

  if (userPlan.status === "trialing") {
    const granted = Number(userPlan.trialCreditsGranted || 0);
    const used = Number(userPlan.trialCreditsUsed || 0);
    return isFutureDate(userPlan.trialEndsAt) && granted - used > 0;
  }

  if (userPlan.status === "active") {
    return !userPlan.validUntil || isFutureDate(userPlan.validUntil);
  }

  if (userPlan.status === "canceled") {
    return isFutureDate(userPlan.validUntil);
  }

  if (userPlan.status === "checkout_pending" || userPlan.status === "expired" || userPlan.status === "past_due") {
    return false;
  }

  const hasLegacyPaidBalance =
    Number(user?.monthyBalance || 0) > 0 || Number(user?.lifetimeBalance || 0) > 0;

  return Boolean(
    userPlan.planId &&
      hasLegacyPaidBalance &&
      (!userPlan.validUntil || isFutureDate(userPlan.validUntil))
  );
}

export const GENERATION_ACCESS_REQUIRED_MESSAGE =
  "Start a trial or choose a paid plan before generating articles.";

export function isTrialCreditsExhausted(userPlan?: GenerationAccessUserPlan | null) {
  if (!userPlan || userPlan.status !== "trialing") {
    return false;
  }

  const granted = Number(userPlan.trialCreditsGranted || 0);
  const used = Number(userPlan.trialCreditsUsed || 0);

  return isFutureDate(userPlan.trialEndsAt) && granted > 0 && granted - used <= 0;
}

export const TRIAL_ENDED_UPGRADE_MESSAGE =
  "Your trial has ended. Upgrade your plan to continue generating articles.";
