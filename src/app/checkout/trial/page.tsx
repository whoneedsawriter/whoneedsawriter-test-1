import { authOptions } from "@/config/auth";
import { prismaClient } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import TrialCheckoutClient from "./trial-checkout-client";
import { BILLING_TERMS_VERSION, getTrialDates } from "@/libs/trial";
import { verifyPluginBillingToken } from "@/libs/plugin-billing-auth";

export const metadata = {
  title: "Start your 7-day trial | Who Needs a Writer",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TrialCheckoutPage({
  searchParams,
}: {
  searchParams: { planId?: string; source?: string; userId?: string; website?: string; token?: string };
}) {
  const session = await getServerSession(authOptions);
  const planId = searchParams.planId ? Number(searchParams.planId) : null;
  const pluginBillingToken = String(searchParams.token || "").trim();
  const pluginBilling = pluginBillingToken
    ? await verifyPluginBillingToken(pluginBillingToken, ["trial"])
    : null;
  const isPlugin = Boolean(pluginBilling);

  if (searchParams.source === "plugin" && !isPlugin) {
    redirect("/pricing");
  }

  if (!isPlugin && !session?.user?.email) {
    redirect(`/signup?trial=1${planId ? `&planId=${planId}` : ""}`);
  }

  let plan = planId && !Number.isNaN(planId)
    ? await prismaClient.subscriptionPlan.findUnique({
        where: { id: planId },
      })
    : null;

  if (!plan) {
    const countryCode = headers().get("x-vercel-ip-country");
    const preferredCurrency = countryCode === "IN" ? "INR" : "USD";
    plan =
      (await prismaClient.subscriptionPlan.findFirst({
        where: {
          name: {
            equals: "Starter",
            mode: "insensitive",
          },
          currency: preferredCurrency,
        },
        orderBy: { price: "asc" },
      })) ||
      (await prismaClient.subscriptionPlan.findFirst({
        where: {
          name: {
            equals: "Starter",
            mode: "insensitive",
          },
        },
        orderBy: { price: "asc" },
      }));

    if (!plan) {
      redirect("/pricing");
    }
  }

  const { trialEndsAt, firstChargeDate } = getTrialDates();

  return (
    <TrialCheckoutClient
      plan={{
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency || "USD",
      }}
      trialEndsAt={trialEndsAt.toISOString()}
      firstChargeDate={firstChargeDate.toISOString()}
      billingTermsVersion={BILLING_TERMS_VERSION}
      stripePublishableKey={process.env.STRIPE_PUBLIC_KEY || ""}
      source={isPlugin ? "plugin" : "app"}
      pluginBillingToken={isPlugin ? pluginBillingToken : ""}
    />
  );
}
