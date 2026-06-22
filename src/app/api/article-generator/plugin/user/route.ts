import { getPluginAccountAccess } from "@/libs/plugin-account-access";
import { verifyPluginBillingToken } from "@/libs/plugin-billing-auth";
import { NextRequest, NextResponse } from "next/server";

type ApiError = { error: string };

export type PluginUserBalanceResponse = {
  freeCredits: number;
  monthyBalance: number;
  monthyPlan: number;
  lifetimeBalance: number;
  lifetimePlan: number;
  credits: number;
  balance_type: string;
  SubscriptionDetails: any;
  SubscriptionPlan: any;
  access: {
    status: string;
    hasGenerationAccess: boolean;
    trialEligible: boolean;
    activePlanName: string | null;
    trialEndsAt: string | null;
    trialCreditsGranted: number;
    trialCreditsUsed: number;
    message: string;
  };
  cta: {
    label: string;
    kind: string;
    url: string;
    trialUrl: string;
    pricingUrl: string;
    disabled: boolean;
  };
  creditsLoaded: boolean;
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<PluginUserBalanceResponse | ApiError>> {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim() || "";
    const pluginBilling = token ? await verifyPluginBillingToken(token, ["pricing", "trial"]) : null;
    const userId = pluginBilling?.userId || searchParams.get("id")?.trim();
    const website = searchParams.get("website")?.trim() || "";
    const siteSecret = req.headers.get("x-wnaw-site-secret")?.trim() || "";

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required query param: id" },
        { status: 400 }
      );
    }

    const account = pluginBilling
      ? await getPluginAccountAccess(userId, pluginBilling.website)
      : await getPluginAccountAccess(userId, website, siteSecret);

    if (!account) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        freeCredits: account.user.freeCredits,
        monthyBalance: account.user.monthyBalance,
        monthyPlan: account.user.monthyPlan,
        lifetimeBalance: account.user.lifetimeBalance,
        lifetimePlan: account.user.lifetimePlan,
        credits: account.credits,
        balance_type: account.balance_type,
        SubscriptionDetails: account.subscriptionPlan || account.lifetimePlan,
        SubscriptionPlan: account.userPlan,
        access: account.access,
        cta: account.cta,
        creditsLoaded: account.creditsLoaded,
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
