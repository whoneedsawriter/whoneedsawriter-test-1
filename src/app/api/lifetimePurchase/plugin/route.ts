import { NextRequest, NextResponse } from "next/server";
import { HttpStatusCode } from "axios";
import { prismaClient } from "@/prisma/db";
import { stripeClient } from "@/libs/stripe";

export async function POST(request: Request) {
  console.log("lifetimePurchase stared");
  const { userId, priceId, name, website } = await request.json();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  const user = await prismaClient.user.findFirst({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HttpStatusCode.Unauthorized }
    );
  }

try{
  let session1:any = await stripeClient.checkout.sessions.create({
    billing_address_collection: "auto",
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "payment",
    customer_email: user.email as string,
    success_url: `https://${website}/wp-admin/admin.php?page=whoneedsawriter-dashboard&payment=success&type=lifetime&plan=${name}`, 
    cancel_url: `https://${website}/wp-admin/admin.php?page=whoneedsawriter-dashboard&payment=failed`,
  });
  return NextResponse.json({ url: session1.url });
}catch(error:any){
  console.log("lifetimePurchase error", error);
  return NextResponse.json({ error: error.message }, { status: 500 });
}

}
