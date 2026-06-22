import { stripeClient } from "@/libs/stripe";
import { BILLING_TERMS_VERSION, TRIAL_DAYS, getTrialDates } from "@/libs/trial";
import { buildPluginTrialReturnUrl } from "@/libs/plugin-return-url";
import { prismaClient } from "@/prisma/db";
import { HttpStatusCode } from "axios";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyPluginBillingToken } from "@/libs/plugin-billing-auth";

async function validatePluginStripeTrial(planId: unknown, userId: string) {
  const plan = await prismaClient.subscriptionPlan.findUnique({
    where: { id: Number(planId) },
  });

  if (!plan || plan.currency !== "INR" || !plan.priceId) {
    return {
      error: NextResponse.json(
        { error: "Selected Stripe trial plan was not found." },
        { status: HttpStatusCode.BadRequest }
      ),
    };
  }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
  });
  const userPlan = await prismaClient.userPlan.findUnique({ where: { userId } });

  if (!user?.email) {
    return {
      error: NextResponse.json(
        { error: "Plugin user was not found." },
        { status: HttpStatusCode.NotFound }
      ),
    };
  }

  const existingTrial = await prismaClient.trialUsage.findUnique({
    where: { email: user.email.toLowerCase() },
  });

  if (existingTrial) {
    return {
      error: NextResponse.json(
        { error: "A trial has already been used for this email." },
        { status: HttpStatusCode.Conflict }
      ),
    };
  }

  const hasActivePlan =
    userPlan &&
    userPlan.cancelled === 0 &&
    userPlan.status !== "checkout_pending" &&
    (!userPlan.validUntil || userPlan.validUntil > new Date());

  if (hasActivePlan) {
    return {
      error: NextResponse.json(
        { error: "You already have an active subscription." },
        { status: HttpStatusCode.Conflict }
      ),
    };
  }

  return { plan, user, userPlan };
}

export async function POST(request: Request) {
  const { planId, billingTermsVersion, billingToken } = await request.json().catch(() => ({
    planId: null,
    billingTermsVersion: null,
    billingToken: "",
  }));

  if (billingTermsVersion !== BILLING_TERMS_VERSION) {
    return NextResponse.json(
      { error: "Billing terms are out of date. Please refresh and try again." },
      { status: HttpStatusCode.BadRequest }
    );
  }

  const pluginBilling = await verifyPluginBillingToken(String(billingToken || ""), ["trial"]);
  if (!pluginBilling) {
    return NextResponse.json(
      { error: "Invalid or expired plugin billing token." },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  const returnUrl = buildPluginTrialReturnUrl(pluginBilling.website, "");
  if (!returnUrl) {
    return NextResponse.json(
      { error: "A valid WordPress site is required." },
      { status: HttpStatusCode.BadRequest }
    );
  }

  const validated = await validatePluginStripeTrial(planId, pluginBilling.userId);
  if (validated.error) return validated.error;

  const { plan, user, userPlan } = validated;
  const existingStripeCustomerId = userPlan?.stripeCustomerId || undefined;
  const customerId =
    existingStripeCustomerId ||
    (
      await stripeClient.customers.create({
        email: user.email!,
        name: user.name || undefined,
        metadata: { userId: user.id },
      })
    ).id;

  const { trialEndsAt } = getTrialDates();

  await prismaClient.userPlan.upsert({
    where: { userId: user.id },
    update: {
      planId: plan.id,
      provider: "stripe",
      status: "checkout_pending",
      stripeCustomerId: customerId,
      stripePriceId: plan.priceId,
      billingTermsVersion,
      trialEndsAt,
      trialCreditsGranted: 0,
      trialCreditsUsed: 0,
      cancelled: 0,
    },
    create: {
      userId: user.id,
      planId: plan.id,
      provider: "stripe",
      status: "checkout_pending",
      stripeCustomerId: customerId,
      stripePriceId: plan.priceId,
      billingTermsVersion,
      trialEndsAt,
      trialCreditsGranted: 0,
      trialCreditsUsed: 0,
      cancelled: 0,
    },
  });

  const subscription = await stripeClient.subscriptions.create({
    customer: customerId,
    items: [{ price: plan.priceId }],
    trial_period_days: TRIAL_DAYS,
    payment_settings: { save_default_payment_method: "on_subscription" },
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: {
      userId: user.id,
      planId: String(plan.id),
      checkoutType: "trial",
      billingTermsVersion,
      source: "plugin",
      website: pluginBilling.website,
    },
    expand: ["pending_setup_intent"],
  });

  const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null;
  if (!setupIntent?.client_secret) {
    return NextResponse.json(
      { error: "Unable to prepare the secure card form." },
      { status: HttpStatusCode.InternalServerError }
    );
  }

  await stripeClient.setupIntents.update(setupIntent.id, {
    metadata: {
      userId: user.id,
      planId: String(plan.id),
      subscriptionId: subscription.id,
      checkoutType: "trial",
      billingTermsVersion,
      source: "plugin",
      website: pluginBilling.website,
    },
  });

  await prismaClient.userPlan.update({
    where: { userId: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      validUntil: new Date(subscription.current_period_end * 1000),
    },
  });

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    subscriptionId: subscription.id,
    returnUrl: buildPluginTrialReturnUrl(pluginBilling.website, plan.name),
  });
}
