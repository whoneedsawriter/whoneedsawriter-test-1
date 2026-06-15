import { authOptions } from "@/config/auth";
import { stripeClient } from "@/libs/stripe";
import { BILLING_TERMS_VERSION, TRIAL_DAYS, getTrialDates } from "@/libs/trial";
import { prismaClient } from "@/prisma/db";
import { HttpStatusCode } from "axios";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import Stripe from "stripe";

async function validateStarterTrial(planId: unknown, userId: string) {
  const plan = await prismaClient.subscriptionPlan.findUnique({
    where: { id: Number(planId) },
  });

  if (!plan || plan.name.toLowerCase() !== "starter" || plan.currency !== "INR") {
    return {
      error: NextResponse.json(
        { error: "Starter trial plan was not found." },
        { status: HttpStatusCode.BadRequest }
      ),
    };
  }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    include: { UserPlan: true },
  });

  if (!user?.email) {
    return {
      error: NextResponse.json(
        { error: "User not found." },
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
    user.UserPlan &&
    user.UserPlan.cancelled === 0 &&
    user.UserPlan.status !== "checkout_pending" &&
    (!user.UserPlan.validUntil || user.UserPlan.validUntil > new Date());

  if (hasActivePlan) {
    return {
      error: NextResponse.json(
        { error: "You already have an active subscription." },
        { status: HttpStatusCode.Conflict }
      ),
    };
  }

  return { plan, user };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  const { planId, billingTermsVersion } = await request.json().catch(() => ({
    planId: null,
    billingTermsVersion: null,
  }));

  if (billingTermsVersion !== BILLING_TERMS_VERSION) {
    return NextResponse.json(
      { error: "Billing terms are out of date. Please refresh and try again." },
      { status: HttpStatusCode.BadRequest }
    );
  }

  const validated = await validateStarterTrial(planId, session.user.id);
  if (validated.error) return validated.error;

  const { plan, user } = validated;
  const existingStripeCustomerId = user.UserPlan?.stripeCustomerId || undefined;
  const customerId =
    existingStripeCustomerId ||
    (
      await stripeClient.customers.create({
        email: user.email!,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
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
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    trial_settings: {
      end_behavior: {
        missing_payment_method: "cancel",
      },
    },
    metadata: {
      userId: user.id,
      planId: String(plan.id),
      checkoutType: "trial",
      billingTermsVersion,
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
  });
}
