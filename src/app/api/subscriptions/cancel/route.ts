import { authOptions } from "@/config/auth";
import { sendCancellationEmail } from "@/libs/billing-emails";
import { stripeClient } from "@/libs/stripe";
import { prismaClient } from "@/prisma/db";
import { HttpStatusCode } from "axios";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  const userPlan = await prismaClient.userPlan.findUnique({
    where: { userId: session.user.id },
  });

  if (!userPlan) {
    return NextResponse.json(
      { error: "No active subscription found." },
      { status: HttpStatusCode.NotFound }
    );
  }

  if (userPlan.stripeSubscriptionId) {
    const subscription = await stripeClient.subscriptions.update(
      userPlan.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    await prismaClient.userPlan.update({
      where: { id: userPlan.id },
      data: {
        status: "canceled",
        cancelled: 1,
        cancelAtPeriodEnd: true,
        validUntil: new Date(subscription.current_period_end * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  } else if (userPlan.lemonSubscriptionId) {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Lemon Squeezy configuration." },
        { status: HttpStatusCode.InternalServerError }
      );
    }

    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${userPlan.lemonSubscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Lemon Squeezy cancellation error:", await response.text());
      return NextResponse.json(
        { error: "Failed to cancel subscription." },
        { status: HttpStatusCode.InternalServerError }
      );
    }

    const cancellation = await response.json();
    const endsAt = cancellation.data.attributes.ends_at
      ? new Date(cancellation.data.attributes.ends_at)
      : userPlan.validUntil || new Date();

    await prismaClient.userPlan.update({
      where: { id: userPlan.id },
      data: {
        status: "canceled",
        cancelled: 1,
        cancelAtPeriodEnd: true,
        validUntil: endsAt,
        currentPeriodEnd: endsAt,
        cancelUrl: cancellation.data.attributes.urls?.customer_portal,
      },
    });
  } else {
    return NextResponse.json(
      { error: "No provider subscription found." },
      { status: HttpStatusCode.NotFound }
    );
  }

  await sendCancellationEmail({
    email: session.user.email,
    subject: "Your trial or subscription was canceled",
    text: "Your cancellation has been recorded. Your generated articles will remain available until your access period ends.",
  });

  return NextResponse.json({ ok: true });
}
