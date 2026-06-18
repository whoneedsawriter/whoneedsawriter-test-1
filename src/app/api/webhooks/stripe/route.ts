import { stripeClient } from "@/libs/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { prismaClient } from "@/prisma/db";
import { grantTrialCredits } from "@/libs/credits";
import { TRIAL_CREDITS, formatPlanPrice } from "@/libs/trial";
import { sendPaymentFailedEmail, sendSubscriptionStartedEmail, sendTrialStartEmail } from "@/libs/billing-emails";

export async function POST(req: NextRequest): Promise<Response> {
  const headersList = headers();
  const stripeSignature = headersList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  if (!stripeSignature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing Webhook secret." },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    // Get the raw body for signature verification
    const body = await req.text();
    event = stripeClient.webhooks.constructEvent(
      body,
      stripeSignature,
      webhookSecret
    );
  } catch (error: any) {
    console.error("Webhook signature verification failed:", error.message);
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 }
    );
  }

  // Handle Stripe events
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      break;

    case "setup_intent.succeeded": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      const subscriptionId = setupIntent.metadata?.subscriptionId;
      const setupUserId = setupIntent.metadata?.userId;
      const setupPlanId = Number(setupIntent.metadata?.planId);

      if (setupIntent.metadata?.checkoutType !== "trial" || !subscriptionId || !setupUserId || !setupPlanId) {
        break;
      }

      const setupUser = await prismaClient.user.findUnique({
        where: { id: setupUserId },
      });

      if (!setupUser?.email) {
        console.error("Event: setup_intent.succeeded — User not found", setupUserId);
        break;
      }

      const setupPlan = await prismaClient.subscriptionPlan.findUnique({
        where: { id: setupPlanId },
      });

      if (!setupPlan) {
        console.error("Event: setup_intent.succeeded — Subscription plan not found", setupPlanId);
        break;
      }

      const setupSubscription = await stripeClient.subscriptions.retrieve(subscriptionId);
      const setupTrialStartedAt = setupSubscription.trial_start
        ? new Date(setupSubscription.trial_start * 1000)
        : new Date();
      const setupTrialEndsAt = setupSubscription.trial_end
        ? new Date(setupSubscription.trial_end * 1000)
        : null;
      const setupCurrentPeriodEnd = new Date(setupSubscription.current_period_end * 1000);
      let setupPaymentMethodFingerprint: string | null = null;

      if (setupIntent.payment_method) {
        try {
          const paymentMethod = await stripeClient.paymentMethods.retrieve(
            setupIntent.payment_method as string
          );
          setupPaymentMethodFingerprint = paymentMethod.card?.fingerprint || null;
        } catch (error) {
          console.error("Unable to fetch Stripe setup payment method fingerprint:", error);
        }
      }

      if (setupPaymentMethodFingerprint) {
        const existingPaymentTrial = await prismaClient.trialUsage.findUnique({
          where: { paymentMethodFingerprint: setupPaymentMethodFingerprint },
        });

        if (existingPaymentTrial && existingPaymentTrial.email !== setupUser.email.toLowerCase()) {
          await stripeClient.subscriptions.cancel(subscriptionId).catch((error) => {
            console.error("Unable to cancel duplicate-payment-method trial:", error);
          });
          await prismaClient.userPlan.updateMany({
            where: { userId: setupUser.id, stripeSubscriptionId: subscriptionId },
            data: {
              status: "expired",
              cancelled: 1,
              cancelAtPeriodEnd: true,
            },
          });
          console.warn("Duplicate payment method trial blocked", {
            userId: setupUser.id,
            subscriptionId,
          });
          break;
        }
      }

      await prismaClient.userPlan.upsert({
        where: {
          userId: setupUser.id,
        },
        update: {
          planId: setupPlan.id,
          provider: "stripe",
          stripeSubscriptionId: setupSubscription.id,
          stripeCustomerId: setupSubscription.customer as string,
          stripePriceId: setupSubscription.items.data[0].price.id,
          validUntil: setupCurrentPeriodEnd,
          currentPeriodEnd: setupCurrentPeriodEnd,
          status: "trialing",
          trialStartedAt: setupTrialStartedAt,
          trialEndsAt: setupTrialEndsAt,
          trialCreditsGranted: TRIAL_CREDITS,
          trialCreditsUsed: 0,
          cancelAtPeriodEnd: setupSubscription.cancel_at_period_end,
          paymentMethodFingerprint: setupPaymentMethodFingerprint,
          billingTermsAcceptedAt: new Date(),
          billingTermsVersion: setupIntent.metadata.billingTermsVersion || null,
          cancelled: 0,
        },
        create: {
          userId: setupUser.id,
          planId: setupPlan.id,
          provider: "stripe",
          stripeSubscriptionId: setupSubscription.id,
          stripeCustomerId: setupSubscription.customer as string,
          stripePriceId: setupSubscription.items.data[0].price.id,
          validUntil: setupCurrentPeriodEnd,
          currentPeriodEnd: setupCurrentPeriodEnd,
          status: "trialing",
          trialStartedAt: setupTrialStartedAt,
          trialEndsAt: setupTrialEndsAt,
          trialCreditsGranted: TRIAL_CREDITS,
          trialCreditsUsed: 0,
          cancelAtPeriodEnd: setupSubscription.cancel_at_period_end,
          paymentMethodFingerprint: setupPaymentMethodFingerprint,
          billingTermsAcceptedAt: new Date(),
          billingTermsVersion: setupIntent.metadata.billingTermsVersion || null,
        },
      });

      await grantTrialCredits(setupUser.id, `trial_credit_grant:${setupUser.id}:${setupSubscription.id}`);
      await prismaClient.trialUsage.upsert({
        where: { email: setupUser.email.toLowerCase() },
        update: {
          paymentMethodFingerprint: setupPaymentMethodFingerprint,
          provider: "stripe",
          subscriptionId: setupSubscription.id,
        },
        create: {
          userId: setupUser.id,
          email: setupUser.email.toLowerCase(),
          paymentMethodFingerprint: setupPaymentMethodFingerprint,
          provider: "stripe",
          subscriptionId: setupSubscription.id,
        },
      });
      await sendTrialStartEmail({
        email: setupUser.email,
        subject: "Your 7-day trial has started",
        text: `Your 7-day trial includes 5 credits and renews at ${formatPlanPrice(setupPlan)}/month unless you cancel before the trial ends.`,
        planName: setupPlan.name,
        renewalPrice: `${formatPlanPrice(setupPlan)}/month`,
        trialEndsAt: setupTrialEndsAt?.toISOString() || "",
      });

      break;
    }

    case "checkout.session.completed":
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      let customer_email = checkoutSession.customer_email;
      
      const user1 = await prismaClient.user.findFirst({
        where: {
          email: customer_email as string,
        },
      });

      if (!user1) {
        return NextResponse.json({ error: "User not found" }, { status: 400 });
      }

      // handle stripe subscription
      if(checkoutSession.mode == 'subscription') {
        const subscription = await stripeClient.subscriptions.retrieve(checkoutSession.subscription as string);
      
        const stripeProductId = subscription.items.data[0].price.product as string;

      const subscriptionPlan = await prismaClient.subscriptionPlan.findFirst({
        where: {
          productId: stripeProductId,
        },
      });

      if (!subscriptionPlan) {
        console.error(
          "Event: customer.subscription.created — Subscription plan not found",
          JSON.stringify(event, null, 2)
        );
        return NextResponse.json(
          { error: "Subscription plan not found" },
          {
            status: 400,
          }
        );
      }
      
      var monthyBalance:number = 0;
      var monthyPlan:number = 0;

switch (stripeProductId) {
  case 'prod_TblYpKYBAelZhk':
    monthyBalance = 5;
    monthyPlan = 5;
    break;

  case 'prod_SNpzHYxK73pcMz':
    monthyBalance = 20;
    monthyPlan = 20;
    break;

  case 'prod_SNpyVYxA6fTEE7':
    monthyBalance = 60;
    monthyPlan = 60;
    break;

  case 'prod_SNpyaI8RYkPnd9':
    monthyBalance = 200;
    monthyPlan = 200;
    break;

  case 'prod_SZigsQFIGhkCr0':
    monthyBalance = 20;
    monthyPlan = 20;
    break;

  case 'prod_SZihMgQLGeNXb4':
    monthyBalance = 60;
    monthyPlan = 60;
    break;

  case 'prod_SZiiSgAIWqKLAJ':
    monthyBalance = 200;
    monthyPlan = 200;
    break;  
}

      const isTrialing = subscription.status === "trialing";
      const trialStartedAt = subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null;
      const trialEndsAt = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null;
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      let paymentMethodFingerprint: string | null = null;

      if (subscription.default_payment_method) {
        try {
          const paymentMethod = await stripeClient.paymentMethods.retrieve(
            subscription.default_payment_method as string
          );
          paymentMethodFingerprint = paymentMethod.card?.fingerprint || null;
        } catch (error) {
          console.error("Unable to fetch Stripe payment method fingerprint:", error);
        }
      }

      const previousUserPlan = await prismaClient.userPlan.findUnique({
        where: { userId: user1.id },
      });

      await prismaClient.userPlan.upsert({
        where: {
          userId: user1?.id,
        },
        update: {
          planId: subscriptionPlan.id,
          provider: "stripe",
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: subscription.items.data[0].price.id,
          validUntil: currentPeriodEnd,
          currentPeriodEnd,
          status: isTrialing ? "trialing" : "active",
          trialStartedAt,
          trialEndsAt,
          trialCreditsGranted: isTrialing ? TRIAL_CREDITS : 0,
          trialCreditsUsed: 0,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          paymentMethodFingerprint,
          cancelled: 0,
        },
        create: {
          userId: user1?.id,
          planId: subscriptionPlan?.id,
          provider: "stripe",
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: subscription.items.data[0].price.id,
          validUntil: currentPeriodEnd,
          currentPeriodEnd,
          status: isTrialing ? "trialing" : "active",
          trialStartedAt,
          trialEndsAt,
          trialCreditsGranted: isTrialing ? TRIAL_CREDITS : 0,
          trialCreditsUsed: 0,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          paymentMethodFingerprint,
        },
      });

      if (isTrialing) {
        await grantTrialCredits(user1.id, `trial_credit_grant:${user1.id}:${subscription.id}`);
        await prismaClient.trialUsage.upsert({
          where: { email: user1.email!.toLowerCase() },
          update: {
            paymentMethodFingerprint,
            provider: "stripe",
            subscriptionId: subscription.id,
          },
          create: {
            userId: user1.id,
            email: user1.email!.toLowerCase(),
            paymentMethodFingerprint,
            provider: "stripe",
            subscriptionId: subscription.id,
          },
        });
        await sendTrialStartEmail({
          email: user1.email!,
          subject: "Your 7-day trial has started",
          text: `Your 7-day trial includes 5 credits and renews at ${formatPlanPrice(subscriptionPlan)}/month unless you cancel before the trial ends.`,
          planName: subscriptionPlan.name,
          renewalPrice: `${formatPlanPrice(subscriptionPlan)}/month`,
          trialEndsAt: trialEndsAt?.toISOString() || "",
        });
      } else {
        if (
          previousUserPlan?.status === "trialing" &&
          previousUserPlan.stripeSubscriptionId &&
          previousUserPlan.stripeSubscriptionId !== subscription.id
        ) {
          await stripeClient.subscriptions.cancel(previousUserPlan.stripeSubscriptionId).catch((error) => {
            console.error("Unable to cancel superseded Stripe trial:", error);
          });
        }
        if (
          previousUserPlan?.status === "trialing" &&
          previousUserPlan.lemonSubscriptionId
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

        await prismaClient.user.update({
          where: {
            id: user1?.id,
          },
          data: {
            monthyBalance: monthyBalance,
            monthyPlan: monthyPlan,
          }
        });
        await sendSubscriptionStartedEmail({
          email: user1.email!,
          subject: "Your subscription is active",
          text: `Your ${subscriptionPlan.name} subscription is active.`,
          planName: subscriptionPlan.name,
          renewalPrice: `${formatPlanPrice(subscriptionPlan)}/month`,
        });
      }
      }

     // handle lifetime stripe payment if the checkout session is a payment
    if(checkoutSession.mode == 'payment') {
              
      let amount_total_real = (checkoutSession.amount_total ?? 0) / 100;
      var lifetimeBalance:number = 0;
      var lifetimePlan:number = 0;
      switch (amount_total_real) {
        case 45:
          lifetimeBalance = 30;
          lifetimePlan = 30;
          break;
          
        case 120:
          lifetimeBalance = 75;
          lifetimePlan = 75;
          break;
        
        case 300:
          lifetimeBalance = 250;
          lifetimePlan = 250;
          break;

        case 3700:
          lifetimeBalance = 30;
          lifetimePlan = 30;
          break;
            
        case 10000:
          lifetimeBalance = 75;
          lifetimePlan = 75;
          break;
          
        case 25000:
          lifetimeBalance = 250;
          lifetimePlan = 250;
          break;
      }

        await prismaClient.user.update({
          where: {
            id: user1?.id,
          },
          data: {
            lifetimeBalance: lifetimeBalance,
            lifetimePlan: lifetimePlan,
          }
        });
      }

      break;

    case "payment_intent.payment_failed":
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
      break;

    case "invoice.payment_failed":
      const failedInvoice = event.data.object as Stripe.Invoice;
      if (failedInvoice.customer_email) {
        await sendPaymentFailedEmail({
          email: failedInvoice.customer_email,
          subject: "Payment failed for your subscription",
          text: "We could not process your subscription payment. Please update your billing details to keep generation access active.",
        });
      }
      break;

    case "customer.subscription.updated":
      const subscription = event.data.object as Stripe.Subscription;

      // get the customer email using the customer id
      const customer = await stripeClient.customers.retrieve(
        subscription.customer as string
      );

      if (!customer || customer.deleted) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 400 }
        );
      }

      const user = await prismaClient.user.findFirst({
        where: {
          email: customer.email as string,
        },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 400 });
      }

      const currentStripeUserPlan = await prismaClient.userPlan.findFirst({
        where: {
          stripeSubscriptionId: subscription.id,
        },
      });
      const shouldKeepCheckoutPending =
        currentStripeUserPlan?.status === "checkout_pending" &&
        subscription.status === "trialing" &&
        !subscription.default_payment_method;
      let updatedPaymentMethodFingerprint: string | null = null;

      if (subscription.status === "trialing" && subscription.default_payment_method) {
        try {
          const paymentMethod = await stripeClient.paymentMethods.retrieve(
            subscription.default_payment_method as string
          );
          updatedPaymentMethodFingerprint = paymentMethod.card?.fingerprint || null;
        } catch (error) {
          console.error("Unable to fetch Stripe payment method fingerprint:", error);
        }
      }

      await prismaClient.userPlan.updateMany({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          status: shouldKeepCheckoutPending ? "checkout_pending" : subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          validUntil: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          cancelled: subscription.cancel_at_period_end ? 1 : 0,
        },
      });

      if (
        currentStripeUserPlan &&
        subscription.status === "trialing" &&
        !shouldKeepCheckoutPending
      ) {
        await prismaClient.userPlan.update({
          where: { userId: currentStripeUserPlan.userId },
          data: {
            trialStartedAt: subscription.trial_start
              ? new Date(subscription.trial_start * 1000)
              : currentStripeUserPlan.trialStartedAt,
            trialEndsAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : currentStripeUserPlan.trialEndsAt,
            trialCreditsGranted: TRIAL_CREDITS,
            trialCreditsUsed:
              Number(currentStripeUserPlan.trialCreditsGranted || 0) > 0
                ? undefined
                : 0,
            paymentMethodFingerprint: updatedPaymentMethodFingerprint,
            billingTermsAcceptedAt: currentStripeUserPlan.billingTermsAcceptedAt || new Date(),
          },
        });
        await grantTrialCredits(user.id, `trial_credit_grant:${user.id}:${subscription.id}`);
        if (user.email) {
          await prismaClient.trialUsage.upsert({
            where: { email: user.email.toLowerCase() },
            update: {
              paymentMethodFingerprint: updatedPaymentMethodFingerprint,
              provider: "stripe",
              subscriptionId: subscription.id,
            },
            create: {
              userId: user.id,
              email: user.email.toLowerCase(),
              paymentMethodFingerprint: updatedPaymentMethodFingerprint,
              provider: "stripe",
              subscriptionId: subscription.id,
            },
          });
        }
      }

      break;

    case "invoice.paid":
      const invoice = event.data.object as Stripe.Invoice;

      const _subscription = await stripeClient.subscriptions.retrieve(
        invoice.subscription as string
      );
      const userPlan = await prismaClient.userPlan.findFirst({
        where: {
          stripeSubscriptionId: _subscription.id,
        },
      });

      if (!userPlan) {
        console.error(
          "Event: invoice.paid — User plan not found",
          JSON.stringify(event, null, 2)
        );
        return NextResponse.json("User plan not found", { status: 400 });
      }

      // Get the user to update their balances
      const renewalUser = await prismaClient.user.findUnique({
        where: {
          id: userPlan.userId,
        },
      });

      if (!renewalUser) {
        console.error(
          "Event: invoice.paid — User not found",
          JSON.stringify(event, null, 2)
        );
        return NextResponse.json("User not found", { status: 400 });
      }

      if (_subscription.status === "trialing") {
        const keepPendingUntilSetupSucceeds =
          userPlan.status === "checkout_pending" && !_subscription.default_payment_method;
        let invoicePaymentMethodFingerprint: string | null = null;

        if (_subscription.default_payment_method) {
          try {
            const paymentMethod = await stripeClient.paymentMethods.retrieve(
              _subscription.default_payment_method as string
            );
            invoicePaymentMethodFingerprint = paymentMethod.card?.fingerprint || null;
          } catch (error) {
            console.error("Unable to fetch Stripe payment method fingerprint:", error);
          }
        }

        await prismaClient.userPlan.update({
          where: {
            userId: renewalUser.id,
          },
          data: {
            status: keepPendingUntilSetupSucceeds ? "checkout_pending" : "trialing",
            validUntil: new Date(_subscription.current_period_end * 1000),
            currentPeriodEnd: new Date(_subscription.current_period_end * 1000),
            trialStartedAt: _subscription.trial_start
              ? new Date(_subscription.trial_start * 1000)
              : userPlan.trialStartedAt,
            trialEndsAt: _subscription.trial_end
              ? new Date(_subscription.trial_end * 1000)
              : userPlan.trialEndsAt,
            trialCreditsGranted: keepPendingUntilSetupSucceeds ? 0 : TRIAL_CREDITS,
            trialCreditsUsed:
              keepPendingUntilSetupSucceeds || Number(userPlan.trialCreditsGranted || 0) > 0
                ? undefined
                : 0,
            paymentMethodFingerprint: invoicePaymentMethodFingerprint,
            billingTermsAcceptedAt: userPlan.billingTermsAcceptedAt || new Date(),
          },
        });
        if (!keepPendingUntilSetupSucceeds) {
          await grantTrialCredits(renewalUser.id, `trial_credit_grant:${renewalUser.id}:${_subscription.id}`);
          if (renewalUser.email) {
            await prismaClient.trialUsage.upsert({
              where: { email: renewalUser.email.toLowerCase() },
              update: {
                paymentMethodFingerprint: invoicePaymentMethodFingerprint,
                provider: "stripe",
                subscriptionId: _subscription.id,
              },
              create: {
                userId: renewalUser.id,
                email: renewalUser.email.toLowerCase(),
                paymentMethodFingerprint: invoicePaymentMethodFingerprint,
                provider: "stripe",
                subscriptionId: _subscription.id,
              },
            });
          }
        }
        break;
      }

      // Refresh monthly balances based on the subscription plan
      const stripeProductId = _subscription.items.data[0].price.product as string;
      var monthyBalance: number = 0;
      var monthyPlan: number = 0;

      switch (stripeProductId) {
        case 'prod_TblYpKYBAelZhk':
          monthyBalance = 5;
          monthyPlan = 5;
          break;

        case 'prod_SNpzHYxK73pcMz':
          monthyBalance = 20;
          monthyPlan = 20;
          break;

        case 'prod_SNpyVYxA6fTEE7':
          monthyBalance = 60;
          monthyPlan = 60;
          break;

        case 'prod_SNpyaI8RYkPnd9':
          monthyBalance = 200;
          monthyPlan = 200;
          break;

        case 'prod_SZigsQFIGhkCr0':
          monthyBalance = 20;
          monthyPlan = 20;
          break;
          
        case 'prod_SZihMgQLGeNXb4':
          monthyBalance = 60;
          monthyPlan = 60;
          break;
          
          
        case 'prod_SZiiSgAIWqKLAJ':
          monthyBalance = 200;
          monthyPlan = 200;
          break;
      }

      await prismaClient.userPlan.update({
        where: {
          userId: renewalUser.id,
        },
        data: {
          validUntil: new Date(_subscription.current_period_end * 1000),
          currentPeriodEnd: new Date(_subscription.current_period_end * 1000),
          status: "active",
          cancelled: 0,
        },
      });

      // Update user's monthly balances for the renewal
      await prismaClient.user.update({
        where: {
          id: renewalUser.id,
        },
        data: {
          monthyBalance: monthyBalance,
          monthyPlan: monthyPlan,
        }
      });
      if (renewalUser.email) {
        await sendSubscriptionStartedEmail({
          email: renewalUser.email,
          subject: "Your subscription is active",
          text: "Your paid subscription renewal is complete and your monthly credits have been refreshed.",
        });
      }

      break;

    case "customer.subscription.deleted":
      const deletedSubscription = event.data.object as Stripe.Subscription;

      // Find the user plan associated with this subscription
      const deletedUserPlan = await prismaClient.userPlan.findFirst({
        where: {
          stripeSubscriptionId: deletedSubscription.id,
        },
      });

      if (!deletedUserPlan) {
        console.error(
          "Event: customer.subscription.deleted — User plan not found",
          JSON.stringify(event, null, 2)
        );
        return NextResponse.json("User plan not found", { status: 400 });
      }

      // Get the user to update their subscription status
      const cancelledUser = await prismaClient.user.findUnique({
        where: {
          id: deletedUserPlan.userId,
        },
      });

      if (!cancelledUser) {
        console.error(
          "Event: customer.subscription.deleted — User not found",
          JSON.stringify(event, null, 2)
        );
        return NextResponse.json("User not found", { status: 400 });
      }

      // Update user plan to reflect cancellation
      await prismaClient.userPlan.update({
        where: {
          id: deletedUserPlan.id,
        },
        data: {
          cancelled: 1,
          status: "canceled",
          cancelAtPeriodEnd: true,
        },
      });

      break;

    default:
      console.warn(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
