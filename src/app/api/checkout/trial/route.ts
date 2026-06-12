import { authOptions } from "@/config/auth";
import { stripeClient } from "@/libs/stripe";
import { BILLING_TERMS_VERSION, TRIAL_DAYS, getTrialDates } from "@/libs/trial";
import { prismaClient } from "@/prisma/db";
import { HttpStatusCode } from "axios";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

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

  const plan = await prismaClient.subscriptionPlan.findUnique({
    where: { id: Number(planId) },
  });

  if (!plan) {
    return NextResponse.json(
      { error: "Selected plan was not found." },
      { status: HttpStatusCode.NotFound }
    );
  }

  const user = await prismaClient.user.findUnique({
    where: { id: session.user.id },
    include: { UserPlan: true },
  });

  if (!user?.email) {
    return NextResponse.json(
      { error: "User not found." },
      { status: HttpStatusCode.NotFound }
    );
  }

  const existingTrial = await prismaClient.trialUsage.findUnique({
    where: { email: user.email.toLowerCase() },
  });

  if (existingTrial) {
    return NextResponse.json(
      { error: "A trial has already been used for this email." },
      { status: HttpStatusCode.Conflict }
    );
  }

  const hasActivePlan =
    user.UserPlan &&
    user.UserPlan.cancelled === 0 &&
    (!user.UserPlan.validUntil || user.UserPlan.validUntil > new Date());

  if (hasActivePlan && user.UserPlan?.status !== "checkout_pending") {
    return NextResponse.json(
      { error: "You already have an active subscription." },
      { status: HttpStatusCode.Conflict }
    );
  }

  const provider = plan.currency === "INR" ? "stripe" : "lemon-squeezy";
  const { trialEndsAt } = getTrialDates();

  await prismaClient.userPlan.upsert({
    where: { userId: user.id },
    update: {
      planId: plan.id,
      provider,
      status: "checkout_pending",
      billingTermsAcceptedAt: new Date(),
      billingTermsVersion,
      trialEndsAt,
      trialCreditsGranted: 0,
      trialCreditsUsed: 0,
      cancelled: 0,
    },
    create: {
      userId: user.id,
      planId: plan.id,
      provider,
      status: "checkout_pending",
      billingTermsAcceptedAt: new Date(),
      billingTermsVersion,
      trialEndsAt,
      trialCreditsGranted: 0,
      trialCreditsUsed: 0,
      cancelled: 0,
    },
  });

  if (provider === "stripe") {
    const checkoutSession = await stripeClient.checkout.sessions.create({
      billing_address_collection: "auto",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      mode: "subscription",
      customer_email: user.email,
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          userId: user.id,
          planId: String(plan.id),
          billingTermsVersion,
        },
      },
      metadata: {
        userId: user.id,
        planId: String(plan.id),
        checkoutType: "trial",
        billingTermsVersion,
      },
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?trial=started&plan=${encodeURIComponent(plan.name)}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/checkout/trial?planId=${plan.id}`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;

  if (!apiKey || !storeId) {
    return NextResponse.json(
      { error: "Missing Lemon Squeezy configuration." },
      { status: HttpStatusCode.InternalServerError }
    );
  }

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: `${process.env.NEXTAUTH_URL}/dashboard?trial=started&plan=${encodeURIComponent(plan.name)}`,
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
          },
          checkout_data: {
            email: user.email,
            ...(user.name && { name: user.name }),
            custom: {
              user_id: user.id,
              plan_id: String(plan.id),
              checkout_type: "trial",
              billing_terms_version: billingTermsVersion,
            },
          },
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: plan.priceId,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    console.error("Lemon Squeezy checkout error:", await response.text());
    return NextResponse.json(
      { error: "Failed to create checkout." },
      { status: HttpStatusCode.InternalServerError }
    );
  }

  const checkout = await response.json();
  return NextResponse.json({ url: checkout.data.attributes.url });
}
