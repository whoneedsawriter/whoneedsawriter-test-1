"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { TRIAL_CREDITS, TRIAL_DAYS, formatPlanPrice } from "@/libs/trial";
import { trackFunnelEvent } from "@/libs/analytics";

type TrialCheckoutClientProps = {
  plan: {
    id: number;
    name: string;
    price: number;
    currency: string;
  };
  trialEndsAt: string;
  firstChargeDate: string;
  billingTermsVersion: string;
  stripePublishableKey: string;
};

type LemonWindow = Window & {
  createLemonSqueezy?: () => void;
  LemonSqueezy?: {
    Setup?: (options: { eventHandler: (event: { event: string }) => void }) => void;
    Url?: {
      Open?: (url: string) => void;
    };
  };
};

function formatZeroCharge(currency: string) {
  return currency === "INR" ? "Rs. 0" : "$0.00";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function loadLemonScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    const lemonWindow = window as LemonWindow;
    if (lemonWindow.LemonSqueezy?.Url?.Open) return resolve();

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://app.lemonsqueezy.com/js/lemon.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load Lemon Squeezy.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://app.lemonsqueezy.com/js/lemon.js";
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Lemon Squeezy."));
    document.body.appendChild(script);
  });
}

export default function TrialCheckoutClient({
  plan,
  trialEndsAt,
  firstChargeDate,
  billingTermsVersion,
  stripePublishableKey,
}: TrialCheckoutClientProps) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [isPreparingStripe, setIsPreparingStripe] = useState(plan.currency === "INR");
  const [isOpeningLemon, setIsOpeningLemon] = useState(false);
  const [setupError, setSetupError] = useState("");
  const preparedStripeRef = useRef(false);
  const provider = plan.currency === "INR" ? "stripe" : "lemon";
  const renewalPrice = formatPlanPrice(plan);
  const trialEndLabel = formatDate(trialEndsAt);
  const firstChargeLabel = formatDate(firstChargeDate);
  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    [stripePublishableKey]
  );

  useEffect(() => {
    if (provider !== "stripe" || preparedStripeRef.current) return;

    preparedStripeRef.current = true;

    async function prepareStripe() {
      if (!stripePublishableKey) {
        setSetupError("Stripe publishable key is missing.");
        setIsPreparingStripe(false);
        return;
      }

      try {
        const response = await fetch("/api/checkout/trial/stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            billingTermsVersion,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to prepare the secure card form.");
        }

        setStripeClientSecret(data.clientSecret);
      } catch (error: any) {
        setSetupError(error.message || "Unable to prepare the secure card form.");
      } finally {
        setIsPreparingStripe(false);
      }
    }

    prepareStripe();
  }, [billingTermsVersion, plan.id, provider, stripePublishableKey]);

  async function openLemonTrial() {
    if (!accepted) {
      toast.error("Please accept the trial and renewal terms to continue.");
      return;
    }

    setIsOpeningLemon(true);
    try {
      const response = await fetch("/api/checkout/trial/lemon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          billingTermsVersion,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to open checkout.");
      }

      await loadLemonScript();
      const lemonWindow = window as LemonWindow;
      lemonWindow.createLemonSqueezy?.();
      lemonWindow.LemonSqueezy?.Setup?.({
        eventHandler: (event) => {
          if (event.event === "Checkout.Success") {
            trackFunnelEvent("trial_payment_method_added", { planId: plan.id, provider });
            router.push(`/dashboard?trial=started&plan=${encodeURIComponent(plan.name)}`);
          }
        },
      });

      if (!lemonWindow.LemonSqueezy?.Url?.Open) {
        throw new Error("Lemon Squeezy overlay is not ready.");
      }

      lemonWindow.LemonSqueezy.Url.Open(data.checkoutUrl);
    } catch (error: any) {
      toast.error(error.message || "Unable to open checkout.");
    } finally {
      setIsOpeningLemon(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080a0f] text-white lg:h-screen lg:overflow-hidden">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:h-screen lg:min-h-0 lg:grid-cols-[1.05fr_.95fr]">
        <section className="px-4 py-6 sm:px-8 sm:py-8 lg:flex lg:h-screen lg:min-h-0 lg:items-center lg:px-12 lg:py-4 xl:px-14">
          <div className="w-full">
          <Link href="/pricing" className="text-sm font-medium text-[#33d6e2] hover:text-[#4cf0ff]">
            Back to pricing
          </Link>

          <div className="mt-5 max-w-xl lg:mt-4">
            <h1 className="text-3xl font-extrabold tracking-normal text-white lg:text-[34px]">Subscribing to</h1>

            <div className="mt-5 flex items-start justify-between gap-5 border-b border-white/10 pb-4 lg:mt-4">
              <div>
                <p className="text-lg font-bold text-[#33d6e2] sm:text-xl">
                  {plan.name} {TRIAL_DAYS}-day free trial
                </p>
                <p className="mt-1 text-sm text-[#8990a5]">
                  {TRIAL_CREDITS} credits included for your trial.
                </p>
              </div>
              <p className="shrink-0 text-lg font-semibold text-white sm:text-xl">{renewalPrice}/mo</p>
            </div>

            <dl className="mt-4 space-y-3 text-base sm:text-lg lg:space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#8990a5]">Next charge</dt>
                <dd className="font-semibold text-white">{renewalPrice}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#8990a5]">Next charge date</dt>
                <dd className="font-semibold text-white">{firstChargeLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#8990a5]">Billing</dt>
                <dd className="font-semibold text-white">Every month</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-2xl border border-white/10 bg-[#0b1120] p-4 shadow-2xl lg:mt-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#33d6e2]">
                Secure payment details
              </p>

              {provider === "stripe" ? (
                <>
                  {isPreparingStripe && (
                    <div className="rounded-xl border border-white/10 bg-[#111827] p-4 text-sm text-[#cbd5f5]">
                      Preparing secure Stripe card fields...
                    </div>
                  )}
                  {setupError && (
                    <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                      {setupError}
                    </div>
                  )}
                  {stripeClientSecret && stripePromise && (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret: stripeClientSecret,
                        appearance: {
                          theme: "night",
                          variables: {
                            colorPrimary: "#33d6e2",
                            colorBackground: "#0b1120",
                            colorText: "#eef2f7",
                            colorDanger: "#fb7185",
                            borderRadius: "10px",
                          },
                        },
                      }}
                    >
                      <StripeTrialForm
                        accepted={accepted}
                        planId={plan.id}
                        planName={plan.name}
                        provider={provider}
                      />
                    </Elements>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-white/10 bg-[#111827] p-4 text-sm leading-6 text-[#cbd5f5]">
                  Your card details will open in a secure Lemon Squeezy overlay on this page. You will not be sent to a separate hosted checkout page.
                </div>
              )}
            </div>

            <label className="mt-4 flex cursor-pointer gap-3 rounded-xl border border-[#33d6e2]/40 bg-[#33d6e2]/10 p-3.5 text-sm leading-6 text-[#dbeafe]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#33d6e2]"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                I understand my {TRIAL_DAYS}-day trial includes {TRIAL_CREDITS} credits and will renew at {renewalPrice}/month on {firstChargeLabel} unless I cancel before the trial ends.
              </span>
            </label>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-[#8990a5]">Today&apos;s charge</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{formatZeroCharge(plan.currency)}</p>
              </div>

              {provider === "lemon" && (
                <button
                  type="button"
                  onClick={openLemonTrial}
                  disabled={isOpeningLemon}
                  className="rounded-xl bg-[#33d6e2] px-7 py-3 font-bold text-[#020617] transition hover:bg-[#4cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isOpeningLemon ? "Opening..." : "Start trial"}
                </button>
              )}
            </div>

            <p className="mt-4 text-sm leading-6 text-[#8990a5]">
              All prices include applicable tax where required. You can cancel from Account/Billing before the trial ends.
            </p>
          </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#101925] px-4 py-8 sm:px-8 lg:flex lg:h-screen lg:min-h-0 lg:items-center lg:border-l lg:border-t-0 lg:px-12 lg:py-4 xl:px-14">
          <div className="mx-auto max-w-xl">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl lg:text-[32px]">How your free trial works</h2>

            <div className="mt-6 space-y-0 lg:mt-7">
              <TimelineItem active title="Today: Instant access">
                Activate your trial and explore the AI blog post generator free of charge.
              </TimelineItem>
              <TimelineItem title={`Day 1-${TRIAL_DAYS}: Generate with trial credits`}>
                Use your {TRIAL_CREDITS} included credits to create article drafts, SEO sections, and publishing assets.
              </TimelineItem>
              <TimelineItem title={`Day ${TRIAL_DAYS}: End of trial`} last>
                Your {plan.name} subscription starts and you are charged {renewalPrice} unless you cancel first.
              </TimelineItem>
            </div>

            <div className="mt-5 border-t border-white/10 pt-5 text-base leading-7 text-[#cbd5f5] lg:mt-4">
              You can cancel the trial or your subscription anytime from your account billing page.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StripeTrialForm({
  accepted,
  planId,
  planName,
  provider,
}: {
  accepted: boolean;
  planId: number;
  planName: string;
  provider: string;
}) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accepted) {
      toast.error("Please accept the trial and renewal terms to continue.");
      return;
    }

    if (!stripe || !elements) {
      toast.error("Secure payment form is still loading.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard?trial=started&plan=${encodeURIComponent(planName)}`,
      },
      redirect: "if_required",
    });

    if (error) {
      toast.error(error.message || "Unable to start trial.");
      setIsSubmitting(false);
      return;
    }

    trackFunnelEvent("trial_payment_method_added", { planId, provider });
    router.push(`/dashboard?trial=started&plan=${encodeURIComponent(planName)}`);
  }

  return (
    <form onSubmit={submitTrial}>
      <PaymentElement />
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 w-full rounded-xl bg-[#33d6e2] px-7 py-3 font-bold text-[#020617] transition hover:bg-[#4cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Starting trial..." : "Start trial"}
      </button>
    </form>
  );
}

function TimelineItem({
  active = false,
  title,
  children,
  last = false,
}: {
  active?: boolean;
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className="grid grid-cols-[24px_1fr] gap-4">
      <div className="flex flex-col items-center">
        <span className={`mt-1 h-4 w-4 rounded-full ${active ? "bg-[#00cfae]" : "bg-[#64748b]"}`} />
        {!last && <span className={`mt-2 h-14 w-1 rounded-full sm:h-16 ${active ? "bg-[#00cfae]" : "bg-[#64748b]"}`} />}
      </div>
      <div className="pb-5 lg:pb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-base leading-7 text-[#cbd5f5]">{children}</p>
      </div>
    </div>
  );
}
