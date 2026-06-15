import { authOptions } from "@/config/auth";
import { prismaClient } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import TrialCheckoutClient from "./trial-checkout-client";
import { BILLING_TERMS_VERSION, getTrialDates } from "@/libs/trial";

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
  searchParams: { planId?: string };
}) {
  const session = await getServerSession(authOptions);
  const planId = Number(searchParams.planId);

  if (!session?.user?.email) {
    redirect(`/signup?trial=1${planId ? `&planId=${planId}` : ""}`);
  }

  if (!planId || Number.isNaN(planId)) {
    redirect("/pricing");
  }

  const plan = await prismaClient.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    redirect("/pricing");
  }

  if (plan.name.toLowerCase() !== "starter") {
    const starterPlan = await prismaClient.subscriptionPlan.findFirst({
      where: {
        name: {
          equals: "Starter",
          mode: "insensitive",
        },
        currency: plan.currency || "USD",
      },
      orderBy: { price: "asc" },
    });

    if (!starterPlan) {
      redirect("/pricing");
    }

    redirect(`/checkout/trial?planId=${starterPlan.id}`);
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
    />
  );
}
