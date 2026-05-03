import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

type ApiError = { error: string };

export type PluginUserBalanceResponse = {
  freeCredits: number;
  monthyBalance: number;
  monthyPlan: number;
  lifetimeBalance: number;
  lifetimePlan: number;
  SubscriptionDetails: any;
  SubscriptionPlan: any;
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<PluginUserBalanceResponse | ApiError>> {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id")?.trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required query param: id" },
        { status: 400 }
      );
    }

    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        freeCredits: true,
        monthyBalance: true,
        monthyPlan: true,
        lifetimeBalance: true,
        lifetimePlan: true,
      },
    });

    const SubscriptionPlan = await prismaClient.userPlan.findFirst({
      where: { userId: userId }
    });
    let SubscriptionDetails;
    if(SubscriptionPlan && SubscriptionPlan.planId !== null){
        SubscriptionDetails = await prismaClient.subscriptionPlan.findFirst({
          where: { id : SubscriptionPlan.planId }
        });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        freeCredits: user.freeCredits,
        monthyBalance: user.monthyBalance,
        monthyPlan: user.monthyPlan,
        lifetimeBalance: user.lifetimeBalance,
        lifetimePlan: user.lifetimePlan,
        SubscriptionDetails: SubscriptionDetails,
        SubscriptionPlan: SubscriptionPlan,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching plugin user balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
