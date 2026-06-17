import { authOptions } from "@/config/auth";
import { prismaClient } from "@/prisma/db";
import { HttpStatusCode } from "axios";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export interface UserPlanStatusResponse {
  planName: string;
  godModeCredits: number;
  validUntil?: string;
  status?: string;
  hasUsablePlan: boolean;
  badgeLabel?: string;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  try {
    const user = await prismaClient.user.findFirst({
      where: {
        email: session.user.email,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: HttpStatusCode.NotFound }
      );
    }

    let planName = "Free";
    let godModeCredits = 0;
    let validUntil: string | undefined;

    // First check UserPlan table using userId
    const userPlan = await prismaClient.userPlan.findFirst({
      where: {
        userId: user.id,
      },
    });

    const isFutureDate = (value?: Date | null) =>
      Boolean(value && value.getTime() > Date.now());

    const hasUsablePlan =
      !!userPlan?.planId &&
      userPlan.status !== "checkout_pending" &&
      userPlan.status !== "expired" &&
      userPlan.status !== "past_due" &&
      (
        userPlan.status === "trialing"
          ? isFutureDate(userPlan.trialEndsAt)
          : userPlan.status === "canceled"
            ? isFutureDate(userPlan.validUntil)
            : !userPlan.validUntil || isFutureDate(userPlan.validUntil)
      );

    if (hasUsablePlan && userPlan?.planId) {
      const subscriptionPlan = await prismaClient.subscriptionPlan.findFirst({
        where: {
          id: userPlan.planId,
        },
      });

      if (subscriptionPlan) {
        planName = subscriptionPlan.name;
        godModeCredits = user.monthyBalance;

        // Get subscription expiry date
        if (userPlan.validUntil) {
          validUntil = userPlan.validUntil.toISOString();
        }
      }
    }
    // Free plan (no active subscription or UserPlan)
    else {
      planName = "Free";
      godModeCredits = user.freeCredits || 0;
    }

    const response: UserPlanStatusResponse = {
      planName,
      godModeCredits,
      validUntil,
      status: userPlan?.status || undefined,
      hasUsablePlan,
      badgeLabel: hasUsablePlan
        ? userPlan?.status === "trialing"
          ? "Trial"
          : planName
        : undefined,
    };

    return NextResponse.json(response, { status: HttpStatusCode.Ok });
  } catch (error) {
    console.error("Error fetching user plan status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: HttpStatusCode.InternalServerError }
    );
  }
}
