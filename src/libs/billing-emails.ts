import { sendTransactionalEmail } from "@/libs/loops";

const TRANSACTIONAL_ID = "cmb2jl0ijc6ea430in4xiowyv";

type BillingEmailArgs = {
  email: string;
  subject: string;
  text: string;
  planName?: string;
  renewalPrice?: string;
  trialEndsAt?: string;
  cancelUrl?: string;
};

async function sendBillingEmail({
  email,
  subject,
  text,
  planName = "",
  renewalPrice = "",
  trialEndsAt = "",
  cancelUrl = "",
}: BillingEmailArgs) {
  try {
    await sendTransactionalEmail({
      transactionalId: TRANSACTIONAL_ID,
      email,
      dataVariables: {
        subject,
        text1: text,
        text2: cancelUrl ? `Manage billing or cancel here: ${cancelUrl}` : "",
        plan: planName,
        renewalPrice,
        trialEndsAt,
      },
    });
  } catch (error) {
    console.error("Failed to send billing lifecycle email:", error);
  }
}

export const sendTrialStartEmail = (args: BillingEmailArgs) =>
  sendBillingEmail({
    ...args,
    subject: args.subject || "Your 7-day trial has started",
  });

export const sendSubscriptionStartedEmail = (args: BillingEmailArgs) =>
  sendBillingEmail({
    ...args,
    subject: args.subject || "Your subscription is active",
  });

export const sendCancellationEmail = (args: BillingEmailArgs) =>
  sendBillingEmail({
    ...args,
    subject: args.subject || "Your trial or subscription was canceled",
  });

export const sendPaymentFailedEmail = (args: BillingEmailArgs) =>
  sendBillingEmail({
    ...args,
    subject: args.subject || "Payment failed for your subscription",
  });
