import { BILLING_TERMS_VERSION, TRIAL_CREDITS, TRIAL_DAYS, addDays, formatPlanPrice } from "@/libs/trial";
import { sendCancellationEmail, sendPaymentFailedEmail, sendSubscriptionStartedEmail, sendTrialStartEmail } from "@/libs/billing-emails";
import { grantTrialCredits } from "@/libs/credits";
import { prismaClient } from "@/prisma/db";
import { HttpStatusCode } from "axios";
import { NextResponse } from "next/server";

type SimulatorAction =
  | "start_trial"
  | "activate"
  | "cancel"
  | "expire"
  | "payment_failed";

type SimulatorRequest = {
  action?: SimulatorAction;
  email?: string;
  planId?: number;
  provider?: "stripe" | "lemon-squeezy";
  monthlyCredits?: number;
  sendEmails?: boolean;
};

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: HttpStatusCode.NotFound });
}

function authorize(request: Request) {
  const configuredSecret = process.env.QA_TRIAL_SIMULATOR_SECRET;

  if (!configuredSecret) {
    return false;
  }

  const providedSecret = request.headers.get("x-qa-trial-simulator-secret");
  return providedSecret === configuredSecret;
}

function inferProvider(currency?: string | null) {
  return currency === "INR" ? "stripe" : "lemon-squeezy";
}

function inferMonthlyCredits(planName: string, explicitCredits?: number) {
  if (typeof explicitCredits === "number" && explicitCredits >= 0) {
    return explicitCredits;
  }

  const normalizedName = planName.toLowerCase();
  if (normalizedName.includes("pro")) return 200;
  if (normalizedName.includes("core")) return 60;
  if (normalizedName.includes("lite") || normalizedName.includes("basic")) return 20;

  return 0;
}

function providerData({
  provider,
  userId,
  planId,
  productId,
  priceId,
}: {
  provider: "stripe" | "lemon-squeezy";
  userId: string;
  planId: number;
  productId: string;
  priceId: string;
}) {
  const subscriptionId = `qa_${provider.replace(/[^a-z]/g, "_")}_${userId}_${planId}`;

  if (provider === "stripe") {
    return {
      provider,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: `qa_customer_${userId}`,
      stripePriceId: priceId,
      lemonSubscriptionId: null,
      lemonProductId: null,
      lemonVariantId: null,
    };
  }

  return {
    provider,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    stripePriceId: null,
    lemonSubscriptionId: subscriptionId,
    lemonProductId: productId,
    lemonVariantId: priceId,
  };
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return notFound();
  }

  const body = (await request.json().catch(() => ({}))) as SimulatorRequest;
  const action = body.action;
  const email = body.email?.trim().toLowerCase();
  const planId = Number(body.planId);

  if (!action || !email || !planId || Number.isNaN(planId)) {
    return NextResponse.json(
      { error: "action, email, and planId are required." },
      { status: HttpStatusCode.BadRequest }
    );
  }

  const user = await prismaClient.user.findUnique({
    where: { email },
    include: { UserPlan: true },
  });

  if (!user?.email) {
    return NextResponse.json(
      { error: "User not found." },
      { status: HttpStatusCode.NotFound }
    );
  }

  const plan = await prismaClient.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return NextResponse.json(
      { error: "Subscription plan not found." },
      { status: HttpStatusCode.NotFound }
    );
  }

  const provider = body.provider || inferProvider(plan.currency);
  const providerFields = providerData({
    provider,
    userId: user.id,
    planId: plan.id,
    productId: plan.productId,
    priceId: plan.priceId,
  });
  const subscriptionId =
    provider === "stripe"
      ? providerFields.stripeSubscriptionId!
      : providerFields.lemonSubscriptionId!;
  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DAYS);
  const nextPeriodEnd = addDays(now, 30);

  if (action === "start_trial") {
    await prismaClient.userPlan.upsert({
      where: { userId: user.id },
      update: {
        planId: plan.id,
        ...providerFields,
        status: "trialing",
        validUntil: trialEndsAt,
        currentPeriodEnd: trialEndsAt,
        trialStartedAt: now,
        trialEndsAt,
        trialCreditsGranted: TRIAL_CREDITS,
        trialCreditsUsed: 0,
        billingTermsAcceptedAt: now,
        billingTermsVersion: BILLING_TERMS_VERSION,
        paymentMethodFingerprint: `qa_fingerprint_${user.id}`,
        cancelAtPeriodEnd: false,
        cancelled: 0,
      },
      create: {
        userId: user.id,
        planId: plan.id,
        ...providerFields,
        status: "trialing",
        validUntil: trialEndsAt,
        currentPeriodEnd: trialEndsAt,
        trialStartedAt: now,
        trialEndsAt,
        trialCreditsGranted: TRIAL_CREDITS,
        trialCreditsUsed: 0,
        billingTermsAcceptedAt: now,
        billingTermsVersion: BILLING_TERMS_VERSION,
        paymentMethodFingerprint: `qa_fingerprint_${user.id}`,
        cancelAtPeriodEnd: false,
        cancelled: 0,
      },
    });

    await grantTrialCredits(user.id, `qa_trial_credit_grant:${user.id}:${subscriptionId}`);
    await prismaClient.trialUsage.upsert({
      where: { email },
      update: {
        provider,
        subscriptionId,
        paymentMethodFingerprint: `qa_fingerprint_${user.id}`,
      },
      create: {
        userId: user.id,
        email,
        provider,
        subscriptionId,
        paymentMethodFingerprint: `qa_fingerprint_${user.id}`,
      },
    });

    if (body.sendEmails) {
      await sendTrialStartEmail({
        email,
        subject: "[QA] Your 7-day trial has started",
        text: `Your 7-day trial includes 5 credits and renews at ${formatPlanPrice(plan)}/month unless you cancel before the trial ends.`,
        planName: plan.name,
        renewalPrice: `${formatPlanPrice(plan)}/month`,
        trialEndsAt: trialEndsAt.toISOString(),
      });
    }
  }

  if (action === "activate") {
    const monthlyCredits = inferMonthlyCredits(plan.name, body.monthlyCredits);

    await prismaClient.userPlan.upsert({
      where: { userId: user.id },
      update: {
        planId: plan.id,
        ...providerFields,
        status: "active",
        validUntil: nextPeriodEnd,
        currentPeriodEnd: nextPeriodEnd,
        cancelAtPeriodEnd: false,
        cancelled: 0,
      },
      create: {
        userId: user.id,
        planId: plan.id,
        ...providerFields,
        status: "active",
        validUntil: nextPeriodEnd,
        currentPeriodEnd: nextPeriodEnd,
        cancelAtPeriodEnd: false,
        cancelled: 0,
      },
    });

    await prismaClient.user.update({
      where: { id: user.id },
      data: {
        monthyBalance: monthlyCredits,
        monthyPlan: monthlyCredits,
      },
    });

    await prismaClient.creditLedger.upsert({
      where: { idempotencyKey: `qa_subscription_credit:${user.id}:${subscriptionId}` },
      update: {},
      create: {
        userId: user.id,
        eventType: "subscription_credit_renewal",
        amount: monthlyCredits,
        balanceBucket: "monthyBalance",
        idempotencyKey: `qa_subscription_credit:${user.id}:${subscriptionId}`,
        metadata: {
          action,
          planId: plan.id,
          provider,
          source: "qa_trial_simulator",
        },
      },
    });

    if (body.sendEmails) {
      await sendSubscriptionStartedEmail({
        email,
        subject: "[QA] Your subscription is active",
        text: `Your ${plan.name} subscription is active.`,
        planName: plan.name,
        renewalPrice: `${formatPlanPrice(plan)}/month`,
      });
    }
  }

  if (action === "cancel") {
    await prismaClient.userPlan.upsert({
      where: { userId: user.id },
      update: {
        planId: plan.id,
        ...providerFields,
        status: "canceled",
        cancelAtPeriodEnd: true,
        cancelled: 1,
        validUntil: user.UserPlan?.validUntil || trialEndsAt,
      },
      create: {
        userId: user.id,
        planId: plan.id,
        ...providerFields,
        status: "canceled",
        cancelAtPeriodEnd: true,
        cancelled: 1,
        validUntil: trialEndsAt,
      },
    });

    if (body.sendEmails) {
      await sendCancellationEmail({
        email,
        subject: "[QA] Your trial or subscription was canceled",
        text: "Your cancellation has been recorded. Your generated articles will remain available.",
      });
    }
  }

  if (action === "expire") {
    const currentFreeCredits = Number(user.freeCredits || 0);

    await prismaClient.userPlan.upsert({
      where: { userId: user.id },
      update: {
        planId: plan.id,
        ...providerFields,
        status: "expired",
        validUntil: now,
        currentPeriodEnd: now,
        trialEndsAt: now,
        cancelAtPeriodEnd: true,
        cancelled: 1,
      },
      create: {
        userId: user.id,
        planId: plan.id,
        ...providerFields,
        status: "expired",
        validUntil: now,
        currentPeriodEnd: now,
        trialEndsAt: now,
        cancelAtPeriodEnd: true,
        cancelled: 1,
      },
    });

    await prismaClient.user.update({
      where: { id: user.id },
      data: { freeCredits: 0 },
    });

    if (currentFreeCredits > 0) {
      await prismaClient.creditLedger.upsert({
        where: { idempotencyKey: `qa_trial_credit_expire:${user.id}:${subscriptionId}` },
        update: {},
        create: {
          userId: user.id,
          eventType: "trial_credit_expire",
          amount: -currentFreeCredits,
          balanceBucket: "freeCredits",
          idempotencyKey: `qa_trial_credit_expire:${user.id}:${subscriptionId}`,
          metadata: {
            action,
            planId: plan.id,
            provider,
            source: "qa_trial_simulator",
          },
        },
      });
    }
  }

  if (action === "payment_failed") {
    await prismaClient.userPlan.upsert({
      where: { userId: user.id },
      update: {
        planId: plan.id,
        ...providerFields,
        status: "past_due",
        cancelled: 0,
      },
      create: {
        userId: user.id,
        planId: plan.id,
        ...providerFields,
        status: "past_due",
        cancelled: 0,
      },
    });

    if (body.sendEmails) {
      await sendPaymentFailedEmail({
        email,
        subject: "[QA] Payment failed for your subscription",
        text: "We could not process your subscription payment. Please update your billing details to keep generation access active.",
      });
    }
  }

  const refreshedUser = await prismaClient.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      freeCredits: true,
      monthyBalance: true,
      monthyPlan: true,
    },
  });
  const userPlan = await prismaClient.userPlan.findUnique({
    where: { userId: user.id },
  });
  const ledger = await prismaClient.creditLedger.findMany({
    where: {
      userId: user.id,
      metadata: {
        path: ["source"],
        equals: "qa_trial_simulator",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    ok: true,
    action,
    provider,
    plan: {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      productId: plan.productId,
      priceId: plan.priceId,
    },
    user: refreshedUser,
    userPlan,
    ledger,
  });
}
