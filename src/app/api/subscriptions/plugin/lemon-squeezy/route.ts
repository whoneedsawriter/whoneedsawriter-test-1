import { NextRequest, NextResponse } from "next/server";
import { HttpStatusCode } from "axios";
import { prismaClient } from "@/prisma/db";

export async function POST(req: NextRequest) {
  try {
    const { userId, variantId, name, website } = await req.json();

    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: HttpStatusCode.Unauthorized }
      );
    }

    // Validate required fields
    if (!variantId) {
      return NextResponse.json(
        { error: "Variant ID is required" },
        { status: HttpStatusCode.BadRequest }
      );
    }

    // Get user from database
    const user = await prismaClient.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: HttpStatusCode.NotFound }
      );
    }

    // Check if user already has an active subscription
    const existingPlan = await prismaClient.userPlan.findFirst({
      where: {
        userId: user.id,
        cancelled: 0, // Not cancelled
        AND: [
          {
            OR: [
              { validUntil: null }, // No expiration date
              { validUntil: { gt: new Date() } }, // Not expired
            ],
          },
        ],
      },
    });

    if (existingPlan) {
      return NextResponse.json(
        { error: "User already has an active subscription" },
        { status: HttpStatusCode.Conflict }
      );
    }

    // Create checkout using direct API call instead of SDK
    const apiUrl = "https://api.lemonsqueezy.com/v1/checkouts";
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return NextResponse.json(
        { error: "Missing LemonSqueezy configuration" },
        { status: HttpStatusCode.InternalServerError }
      );
    }

    const requestBody = {
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: `https://${website}/wp-admin/admin.php?page=whoneedsawriter-dashboard?payment=success&type=subscription&plan=${name}`,
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
          },
          checkout_data: {
            email: user.email as string,
            name: user.name as string,
            custom: {
              user_id: user.id.toString(),
            },
          },
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: variantId,
            },
          },
        },
      },
    };

    console.log("LemonSqueezy API request:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LemonSqueezy API error:", errorText);
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: HttpStatusCode.InternalServerError }
      );
    }

    const checkout = await response.json();

    if (!checkout || !checkout.data) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: HttpStatusCode.InternalServerError }
      );
    }

    // Return checkout URL
    return NextResponse.json(
      {
        checkoutUrl: checkout.data.attributes.url,
        checkoutId: checkout.data.id,
      },
      { status: HttpStatusCode.Ok }
    );

  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HttpStatusCode.InternalServerError }
    );
  }
} 