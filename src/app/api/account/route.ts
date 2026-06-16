import { authOptions } from "@/config/auth";
import { prismaClient } from "@/prisma/db";
import { HttpStatusCode } from "axios";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  try {
    const rawSubscriptionPlan = await prismaClient.userPlan.findFirst({
      where: { userId: session?.user?.id },
    });

    const isFutureDate = (value?: Date | null) =>
      Boolean(value && value.getTime() > Date.now());

    const hasVisibleSubscription =
      !!rawSubscriptionPlan?.planId &&
      rawSubscriptionPlan.status !== "checkout_pending" &&
      rawSubscriptionPlan.status !== "expired" &&
      rawSubscriptionPlan.status !== "past_due" &&
      (
        rawSubscriptionPlan.status === "trialing"
          ? isFutureDate(rawSubscriptionPlan.trialEndsAt)
          : rawSubscriptionPlan.status === "canceled"
            ? isFutureDate(rawSubscriptionPlan.validUntil)
            : !rawSubscriptionPlan.validUntil || isFutureDate(rawSubscriptionPlan.validUntil)
      );

    const SubscriptionPlan = hasVisibleSubscription ? rawSubscriptionPlan : null;
    let SubscriptionDetails;

    if (SubscriptionPlan && SubscriptionPlan.planId !== null) {
        SubscriptionDetails = await prismaClient.subscriptionPlan.findFirst({
          where: { id : SubscriptionPlan.planId }
        });
    }

    return NextResponse.json({ SubscriptionPlan, SubscriptionDetails }, { status: HttpStatusCode.Ok });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: HttpStatusCode.InternalServerError }
    );
  }
}
