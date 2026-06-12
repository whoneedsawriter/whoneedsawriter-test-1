import { SubscriptionPlan } from "@prisma/client";

export const TRIAL_DAYS = 7;
export const TRIAL_CREDITS = 5;
export const BILLING_TERMS_VERSION = "card-upfront-trial-2026-06-07";

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function getTrialDates(now = new Date()) {
  const trialEndsAt = addDays(now, TRIAL_DAYS);

  return {
    trialStartedAt: now,
    trialEndsAt,
    firstChargeDate: trialEndsAt,
  };
}

export function formatPlanPrice(plan: Pick<SubscriptionPlan, "currency" | "price">) {
  const symbol = plan.currency === "INR" ? "Rs. " : "$";
  return `${symbol}${plan.price}`;
}

export function getTrialRenewalCopy(plan: Pick<SubscriptionPlan, "currency" | "price">) {
  return `5 credits included. Then ${formatPlanPrice(plan)}/month. Cancel anytime. Card required. You will be charged the selected plan price after the trial unless you cancel.`;
}

export function isTrialActive(userPlan?: { status?: string | null; trialEndsAt?: Date | string | null } | null) {
  if (!userPlan || userPlan.status !== "trialing" || !userPlan.trialEndsAt) {
    return false;
  }

  return new Date(userPlan.trialEndsAt).getTime() > Date.now();
}
