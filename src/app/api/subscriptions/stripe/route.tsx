import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { HttpStatusCode } from "axios";
import { prismaClient } from "@/prisma/db";
import { authOptions } from "@/config/auth";
import { stripeClient } from "@/libs/stripe";
import { BILLING_TERMS_VERSION, TRIAL_DAYS } from "@/libs/trial";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  const user = await prismaClient.user.findFirst({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

const { priceId, name, planId, billingTermsVersion } = await request.json();
const selectedPlan = planId
  ? await prismaClient.subscriptionPlan.findUnique({ where: { id: Number(planId) } })
  : null;
const checkoutPriceId = selectedPlan?.priceId || priceId;
const checkoutPlanName = selectedPlan?.name || name;
const startTrial = Boolean(selectedPlan && billingTermsVersion === BILLING_TERMS_VERSION);

if (!checkoutPriceId) {
  return NextResponse.json(
    { error: "Missing selected plan" },
    { status: HttpStatusCode.BadRequest }
  );
}

try{
  let session1:any = await stripeClient.checkout.sessions.create({
    billing_address_collection: "auto",
    line_items: [{ price: checkoutPriceId, quantity: 1 }],
    mode: "subscription",
    customer_email: session.user.email,
    payment_method_collection: startTrial ? "always" : undefined,
    subscription_data: startTrial
      ? {
          trial_period_days: TRIAL_DAYS,
          metadata: {
            userId: user.id,
            planId: String(selectedPlan?.id),
            billingTermsVersion,
          },
        }
      : undefined,
    metadata: selectedPlan
      ? {
          userId: user.id,
          planId: String(selectedPlan.id),
          checkoutType: startTrial ? "trial" : "subscription",
          billingTermsVersion: billingTermsVersion || "",
        }
      : undefined,
    success_url: `${process.env.NEXTAUTH_URL}/article-generator?payment=success&type=subscription&plan=${checkoutPlanName}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/article-generator?payment=failed`,
  });
  return NextResponse.json({ url: session1.url });
}catch(error:any){
  console.log(error);
  return NextResponse.json({ error: error.message }, { status: 500 });
}


}
