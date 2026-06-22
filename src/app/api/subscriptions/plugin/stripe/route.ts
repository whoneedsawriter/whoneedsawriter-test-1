import { NextResponse } from "next/server";
import { HttpStatusCode } from "axios";
import { stripeClient } from "@/libs/stripe";
import { verifyPluginBillingToken } from "@/libs/plugin-billing-auth";
import { buildPluginBillingReturnUrl } from "@/libs/plugin-return-url";

export async function POST(request: Request) {
    const { priceId, name, billingToken } = await request.json();

  const pluginBilling = await verifyPluginBillingToken(String(billingToken || ""), ["pricing"]);
  if (!pluginBilling) {
    return NextResponse.json(
      { error: "Invalid or expired plugin billing token." },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  const user = pluginBilling.user;
  const successUrl = buildPluginBillingReturnUrl(pluginBilling.website, "success", "subscription", String(name || ""));
  const cancelUrl = buildPluginBillingReturnUrl(pluginBilling.website, "failed");
  if (!successUrl || !cancelUrl) {
    return NextResponse.json(
      { error: "A valid WordPress site is required." },
      { status: HttpStatusCode.BadRequest }
    );
  }

try{
  let session1:any = await stripeClient.checkout.sessions.create({
    billing_address_collection: "auto",
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    customer_email: user.email as string,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return NextResponse.json({ url: session1.url });
}catch(error:any){
  console.log(error);
  return NextResponse.json({ error: error.message }, { status: 500 });
}
}
