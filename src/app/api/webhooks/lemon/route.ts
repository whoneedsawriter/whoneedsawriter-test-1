import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prismaClient } from "@/prisma/db";
import crypto from "crypto";
import { grantTrialCredits } from "@/libs/credits";
import { stripeClient } from "@/libs/stripe";
import { TRIAL_CREDITS, formatPlanPrice } from "@/libs/trial";
import { sendCancellationEmail, sendPaymentFailedEmail, sendSubscriptionStartedEmail, sendTrialStartEmail } from "@/libs/billing-emails";

// LemonSqueezy webhook event types
interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: {
      user_id: string;
      plan_id?: string;
      checkout_type?: string;
      billing_terms_version?: string;
    };
  };
  data: {
    type: string;
    id: string;
    attributes: {
      store_id: number;
      customer_id: number;
      order_id: number;
      product_id: number;
      variant_id: number;
      product_name: string;
      variant_name: string;
      user_email: string;
      status: string;
      trial_ends_at: string | null;
      billing_anchor: number;
      renews_at: string;
      ends_at: string | null;
      created_at: string;
      updated_at: string;
      test_mode: boolean;
      urls?: {
        update_payment_method: string;
        customer_portal: string;
      };
    };
  };
}

// Function to get balance based on variant ID (similar to your Stripe product mapping)
function getBalanceFromVariantId(variantId: number) {
  let monthyBalance = 0;
  let monthyPlan = 0;
  let lifetimeBalance = 0;
  let lifetimePlan = 0;

  // Map your LemonSqueezy variant IDs to balances
  // You'll need to replace these with your actual variant IDs from LemonSqueezy
  switch (variantId.toString()) { 
    case '1150108':
      monthyBalance = 5;
      monthyPlan = 5;
      break;

    // Basic Monthly Plan
    case '914683':
      monthyBalance = 20;
      monthyPlan = 20;
      break;

    case '914698':
      monthyBalance = 60;
      monthyPlan = 60;
      break;

    case '914704':
     monthyBalance = 200;
     monthyPlan = 200;
     break;

     // Basic Lifetime Plan
    case '914711':
     lifetimeBalance = 30;
     lifetimePlan = 30;
     break;

    case '914712':
     lifetimeBalance = 75;
     lifetimePlan = 75;
     break;

    case '914714':
    lifetimeBalance = 250;
     lifetimePlan = 250;
     break;

    default:
      console.warn(`Unknown variant ID is: ${variantId}`);
  }

  return {
    monthyBalance,
    monthyPlan,
    lifetimeBalance,
    lifetimePlan,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const headersList = headers();
  const lemonSignature = headersList.get("x-signature");
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";

  if (!lemonSignature) {
    return NextResponse.json(
      { error: "Missing LemonSqueezy signature." },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing Webhook secret." },
      { status: 500 }
    );
  }

  let event: LemonSqueezyWebhookEvent;

  try {
    // Get the raw body for signature verification
    const body = await req.text();
    
    // Verify the webhook signature using HMAC SHA256
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = hmac.update(body).digest('hex');

    if (digest !== lemonSignature) {
      throw new Error('Invalid signature.');
    }

    event = JSON.parse(body);
  } catch (error: any) {
    console.error("LemonSqueezy webhook signature verification failed:", error.message);
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 }
    );
  }

  console.log("LemonSqueezy webhook event:", event.meta.event_name);

  // Handle LemonSqueezy events
  switch (event.meta.event_name) {
    case "subscription_created":
      try {
        const subscription = event.data;
        const userEmail = subscription.attributes.user_email;
        const customUserId = event.meta.custom_data?.user_id;

        // Find user by email or custom user_id
        let user;
        if (customUserId) {
          user = await prismaClient.user.findFirst({
            where: { id: customUserId },
          });
        } else {
          user = await prismaClient.user.findFirst({
            where: { email: userEmail },
          });
        }

        if (!user) {
          console.error("User not found for subscription creation:", userEmail);
          return NextResponse.json({ error: "User not found" }, { status: 400 });
        }

        // Get balance configuration based on variant ID
        const balances = getBalanceFromVariantId(subscription.attributes.variant_id);

        // Find the subscription plan based on variant ID (you may need to add a field to map variant_id to plan)
        // For now, we'll look up by product_id or create a mapping
        const subscriptionPlan = event.meta.custom_data?.plan_id
          ? await prismaClient.subscriptionPlan.findUnique({
              where: { id: Number(event.meta.custom_data.plan_id) },
            })
          : await prismaClient.subscriptionPlan.findFirst({
              where: {
                productId: subscription.attributes.product_id.toString(),
              },
            });

        // Create or update user plan
        // Note: You need to add these fields to your UserPlan model:
        // - lemonSubscriptionId: String?
        // - lemonCustomerId: String?  
        // - lemonVariantId: String?
        const isTrialing =
          subscription.attributes.status === "on_trial" ||
          Boolean(subscription.attributes.trial_ends_at);
        const trialEndsAt = subscription.attributes.trial_ends_at
          ? new Date(subscription.attributes.trial_ends_at)
          : null;
        const currentPeriodEnd = new Date(subscription.attributes.renews_at);
        const previousUserPlan = await prismaClient.userPlan.findUnique({
          where: { userId: user.id },
        });

        await prismaClient.userPlan.upsert({
          where: {
            userId: user.id,
          },
          update: {
             planId: subscriptionPlan?.id || null,
             provider: "lemon-squeezy",
             lemonSubscriptionId: subscription.id,
             lemonVariantId: subscription.attributes.variant_id.toString(),
             validUntil: isTrialing && trialEndsAt ? trialEndsAt : currentPeriodEnd,
             currentPeriodEnd,
             status: isTrialing ? "trialing" : "active",
             trialStartedAt: isTrialing ? new Date(subscription.attributes.created_at) : null,
             trialEndsAt,
             trialCreditsGranted: isTrialing ? TRIAL_CREDITS : 0,
             trialCreditsUsed: 0,
             cancelAtPeriodEnd: Boolean(subscription.attributes.ends_at),
             cancelUrl: subscription.attributes.urls?.customer_portal,
             updateUrl: subscription.attributes.urls?.update_payment_method,
             billingTermsAcceptedAt: isTrialing ? new Date() : undefined,
             billingTermsVersion: event.meta.custom_data?.billing_terms_version,
             cancelled: 0,
          },
          create: {
            userId: user.id,
            planId: subscriptionPlan?.id || null,
            provider: "lemon-squeezy",
            lemonSubscriptionId: subscription.id,
            lemonVariantId: subscription.attributes.variant_id.toString(),
            validUntil: isTrialing && trialEndsAt ? trialEndsAt : currentPeriodEnd,
            currentPeriodEnd,
            status: isTrialing ? "trialing" : "active",
            trialStartedAt: isTrialing ? new Date(subscription.attributes.created_at) : null,
            trialEndsAt,
            trialCreditsGranted: isTrialing ? TRIAL_CREDITS : 0,
            trialCreditsUsed: 0,
            cancelAtPeriodEnd: Boolean(subscription.attributes.ends_at),
            cancelUrl: subscription.attributes.urls?.customer_portal,
            updateUrl: subscription.attributes.urls?.update_payment_method,
            billingTermsAcceptedAt: isTrialing ? new Date() : undefined,
            billingTermsVersion: event.meta.custom_data?.billing_terms_version,
          },
        });

        if (isTrialing) {
          await grantTrialCredits(user.id, `trial_credit_grant:${user.id}:${subscription.id}`);
          await prismaClient.trialUsage.upsert({
            where: { email: user.email!.toLowerCase() },
            update: {
              provider: "lemon-squeezy",
              subscriptionId: subscription.id,
            },
            create: {
              userId: user.id,
              email: user.email!.toLowerCase(),
              provider: "lemon-squeezy",
              subscriptionId: subscription.id,
            },
          });
          if (subscriptionPlan && user.email) {
            await sendTrialStartEmail({
              email: user.email,
              subject: "Your 7-day trial has started",
              text: `Your 7-day trial includes 5 credits and renews at ${formatPlanPrice(subscriptionPlan)}/month unless you cancel before the trial ends.`,
              planName: subscriptionPlan.name,
              renewalPrice: `${formatPlanPrice(subscriptionPlan)}/month`,
              trialEndsAt: trialEndsAt?.toISOString() || "",
              cancelUrl: subscription.attributes.urls?.customer_portal,
            });
          }
        } else {
          if (
            previousUserPlan?.status === "trialing" &&
            previousUserPlan.lemonSubscriptionId &&
            previousUserPlan.lemonSubscriptionId !== subscription.id
          ) {
            const apiKey = process.env.LEMONSQUEEZY_API_KEY;
            if (apiKey) {
              await fetch(
                `https://api.lemonsqueezy.com/v1/subscriptions/${previousUserPlan.lemonSubscriptionId}`,
                {
                  method: "DELETE",
                  headers: {
                    Accept: "application/vnd.api+json",
                    "Content-Type": "application/vnd.api+json",
                    Authorization: `Bearer ${apiKey}`,
                  },
                }
              ).catch((error) => {
                console.error("Unable to cancel superseded Lemon trial:", error);
              });
            }
          }
          if (
            previousUserPlan?.status === "trialing" &&
            previousUserPlan.stripeSubscriptionId
          ) {
            await stripeClient.subscriptions.cancel(previousUserPlan.stripeSubscriptionId).catch((error) => {
              console.error("Unable to cancel superseded Stripe trial:", error);
            });
          }

          // Update user balances
          await prismaClient.user.update({
            where: {
              id: user.id,
            },
            data: {
              monthyBalance: balances.monthyBalance,
              monthyPlan: balances.monthyPlan,
            },
          });
        }

        console.log(`Subscription created for user: ${user.email}`);
      } catch (error) {
        console.error("Error handling subscription_created:", error);
        return NextResponse.json(
          { error: "Failed to process subscription creation" },
          { status: 500 }
        );
      }
      break;

    case "subscription_updated":
      console.log("Subscription updated: triggered");
      break;

    case "subscription_cancelled":
    case "subscription_expired":
      try {
        const subscription = event.data;

        // Find user plan by subscription ID  
        const customUserId = event.meta.custom_data?.user_id;
        const userPlan = await prismaClient.userPlan.findFirst({
          where: {
            // lemonSubscriptionId: subscription.id, // Uncomment when field is added
            userId: customUserId, // Temporary fallback
          },
        });

        if (!userPlan) {
          console.error("User plan not found for subscription cancellation:", subscription.id);
          return NextResponse.json(
            { error: "User plan not found" },
            { status: 400 }
          );
        }

        // Mark subscription as cancelled
        await prismaClient.userPlan.update({
          where: {
            id: userPlan.id,
          },
          data: {
            cancelled: 1,
            status: "canceled",
            cancelAtPeriodEnd: true,
            validUntil: subscription.attributes.ends_at ? new Date(subscription.attributes.ends_at) : new Date(),
          },
        });
        const canceledUser = await prismaClient.user.findUnique({
          where: { id: userPlan.userId },
        });
        if (canceledUser?.email) {
          await sendCancellationEmail({
            email: canceledUser.email,
            subject: "Your trial or subscription was canceled",
            text: "Your cancellation has been recorded. Your generated articles will remain available.",
            cancelUrl: subscription.attributes.urls?.customer_portal,
          });
        }

        console.log(`Subscription cancelled: ${subscription.id}`);
      } catch (error) {
        console.error("Error handling subscription cancellation:", error);
        return NextResponse.json(
          { error: "Failed to process subscription cancellation" },
          { status: 500 }
        );
      }
      break;

    case "subscription_resumed":
      try {
        const subscription = event.data;

        // Find user plan by subscription ID  
        const customUserId = event.meta.custom_data?.user_id;
        const userPlan = await prismaClient.userPlan.findFirst({
          where: {
            // lemonSubscriptionId: subscription.id, // Uncomment when field is added
            userId: customUserId, // Temporary fallback
          },
        });

        if (!userPlan) {
          console.error("User plan not found for subscription resumption:", subscription.id);
          return NextResponse.json(
            { error: "User plan not found" },
            { status: 400 }
          );
        }

        // Reactivate subscription
        await prismaClient.userPlan.update({
          where: {
            id: userPlan.id,
          },
          data: {
            cancelled: 0,
            status: "active",
            cancelAtPeriodEnd: false,
            validUntil: new Date(subscription.attributes.renews_at),
            currentPeriodEnd: new Date(subscription.attributes.renews_at),
          },
        });

        // Restore user balances
        const balances = getBalanceFromVariantId(subscription.attributes.variant_id);

        await prismaClient.user.update({
          where: {
            id: userPlan.userId,
          },
          data: {
            monthyBalance: balances.monthyBalance,
            monthyPlan: balances.monthyPlan,
          },
        });

        console.log(`Subscription resumed: ${subscription.id}`);
      } catch (error) {
        console.error("Error handling subscription resumption:", error);
        return NextResponse.json(
          { error: "Failed to process subscription resumption" },
          { status: 500 }
        );
      }
      break;

    case "subscription_payment_success":
      try {
        const invoice = event.data;
        // Invoice structure differs from subscription - use type assertion
        const invoiceAttributes = invoice.attributes as any;
        const subscriptionId = invoiceAttributes.subscription_id;
        const customUserId = event.meta.custom_data?.user_id;
        const userEmail = invoiceAttributes.user_email;

        // Find user plan by subscription ID or user ID
        let userPlan;
        if (subscriptionId) {
          userPlan = await prismaClient.userPlan.findFirst({
            where: {
              lemonSubscriptionId: subscriptionId.toString(),
            },
          });
        }

        // Fallback: find by user_id if subscription ID lookup fails
        if (!userPlan && customUserId) {
          userPlan = await prismaClient.userPlan.findFirst({
            where: {
              userId: customUserId,
            },
          });
        }

        // Fallback: find by user email if still not found
        if (!userPlan && userEmail) {
          const user = await prismaClient.user.findFirst({
            where: { email: userEmail },
          });
          if (user) {
            userPlan = await prismaClient.userPlan.findFirst({
              where: { userId: user.id },
            });
          }
        }

        if (!userPlan) {
          console.error("User plan not found for subscription renewal:", subscriptionId);
          return NextResponse.json(
            { error: "User plan not found" },
            { status: 400 }
          );
        }

        // Get variant_id from existing userPlan to refresh balances
        const variantId = userPlan.lemonVariantId 
          ? parseInt(userPlan.lemonVariantId) 
          : null;

        if (!variantId) {
          console.error("Variant ID not found in user plan for renewal:", userPlan.id);
          return NextResponse.json(
            { error: "Variant ID not found" },
            { status: 400 }
          );
        }

        // Calculate new renewal date (add 1 month to current validUntil or use current date + 1 month)
        const currentValidUntil = userPlan.validUntil || new Date();
        const newValidUntil = new Date(currentValidUntil);
        newValidUntil.setMonth(newValidUntil.getMonth() + 1);

        // Update subscription renewal date
        await prismaClient.userPlan.update({
          where: {
            id: userPlan.id,
          },
          data: {
            validUntil: newValidUntil,
            lemonSubscriptionId: subscriptionId.toString(), // Ensure subscription ID is stored
            currentPeriodEnd: newValidUntil,
            status: "active",
            cancelled: 0,
          },
        });

        // Refresh user balances for the renewed subscription
        const balances = getBalanceFromVariantId(variantId);

        await prismaClient.user.update({
          where: {
            id: userPlan.userId,
          },
          data: {
            monthyBalance: balances.monthyBalance,
            monthyPlan: balances.monthyPlan,
          },
        });
        const renewalUser = await prismaClient.user.findUnique({
          where: { id: userPlan.userId },
        });
        if (renewalUser?.email) {
          await sendSubscriptionStartedEmail({
            email: renewalUser.email,
            subject: "Your subscription is active",
            text: "Your paid subscription renewal is complete and your monthly credits have been refreshed.",
          });
        }

        console.log(`Subscription renewed successfully: ${subscriptionId} (Invoice: ${invoice.id})`);
      } catch (error) {
        console.error("Error handling subscription renewal:", error);
        return NextResponse.json(
          { error: "Failed to process subscription renewal" },
          { status: 500 }
        );
      }
      break;

    case "subscription_payment_failed":
      try {
        const failed = event.data;
        if (failed.attributes.user_email) {
          await sendPaymentFailedEmail({
            email: failed.attributes.user_email,
            subject: "Payment failed for your subscription",
            text: "We could not process your subscription payment. Please update your billing details to keep generation access active.",
            cancelUrl: failed.attributes.urls?.update_payment_method,
          });
        }
      } catch (error) {
        console.error("Error handling Lemon payment failure:", error);
      }
      break;

    case "order_created":
      try {
        // Handle one-time payments (lifetime plans)
        const order = event.data;
        const userEmail = order.attributes.user_email;
        const customUserId = event.meta.custom_data?.user_id;

        // Find user by email or custom user_id
        let user;
        if (customUserId) {
          user = await prismaClient.user.findFirst({
            where: { id: customUserId },
          });
        } else {
          user = await prismaClient.user.findFirst({
            where: { email: userEmail },
          });
        }

        if (!user) {
          console.error("User not found for order creation:", userEmail);
          return NextResponse.json({ error: "User not found" }, { status: 400 });
        }

        // Get balance configuration for lifetime purchase
        const balances = getBalanceFromVariantId(order.attributes.variant_id);

        // Find the lifetime plan based on product_id
        const lifetimePlan = await prismaClient.lifetimePlan.findFirst({
          where: {
            productId: order.attributes.product_id.toString(),
          },
        });

        // Create or update user plan for lifetime purchase
        if (lifetimePlan) {
          await prismaClient.userPlan.upsert({
            where: {
              userId: user.id,
            },
            update: {
              planId: lifetimePlan.id,
              lemonOrderId: order.id,
              lemonProductId: order.attributes.product_id.toString(),
              lemonVariantId: order.attributes.variant_id.toString(),
              validUntil: null, // Lifetime plans don't expire
            },
            create: {
              userId: user.id,
              planId: lifetimePlan.id,
              lemonOrderId: order.id,
              lemonProductId: order.attributes.product_id.toString(),
              lemonVariantId: order.attributes.variant_id.toString(),
              validUntil: null, // Lifetime plans don't expire
            },
          });
        }

        // Update user with lifetime balances
        await prismaClient.user.update({
          where: {
            id: user.id,
          },
          data: {
            lifetimeBalance: balances.lifetimeBalance,
            lifetimePlan: balances.lifetimePlan,
          },
        });

        console.log(`Lifetime order created for user: ${user.email}`);
      } catch (error) {
        console.error("Error handling order_created:", error);
        return NextResponse.json(
          { error: "Failed to process order creation" },
          { status: 500 }
        );
      }
      break;

    default:
      console.warn(`Unhandled LemonSqueezy event type: ${event.meta.event_name}`);
  }

  return NextResponse.json({ received: true });
}
