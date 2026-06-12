"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
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
};

export default function TrialCheckoutClient({
  plan,
  trialEndsAt,
  firstChargeDate,
  billingTermsVersion,
}: TrialCheckoutClientProps) {
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trialEndLabel = new Date(trialEndsAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const firstChargeLabel = new Date(firstChargeDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const renewalPrice = formatPlanPrice(plan);

  async function startCheckout() {
    if (!accepted) {
      toast.error("Please accept the trial and renewal terms to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/checkout/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          billingTermsVersion,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to start checkout");
      }

      trackFunnelEvent("trial_payment_method_added", { planId: plan.id });
      window.location.href = data.url;
    } catch (error: any) {
      toast.error(error.message || "Unable to start checkout");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080a0f] px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-lg border border-white/10 bg-[#111827] p-6 shadow-2xl">
        <Link href="/pricing" className="text-sm text-cyan-300 hover:text-cyan-200">
          Back to pricing
        </Link>

        <h1 className="mt-6 text-3xl font-bold">Start your 7-day trial</h1>
        <p className="mt-3 text-slate-300">
          Confirm your selected plan before adding a card. The renewal amount is based on this plan.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-[#0b1120] p-4">
            <p className="text-xs uppercase text-slate-400">Selected plan</p>
            <p className="mt-1 text-xl font-semibold">{plan.name}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-[#0b1120] p-4">
            <p className="text-xs uppercase text-slate-400">Renews at</p>
            <p className="mt-1 text-xl font-semibold">{renewalPrice}/month</p>
          </div>
          <div className="rounded-md border border-white/10 bg-[#0b1120] p-4">
            <p className="text-xs uppercase text-slate-400">Trial</p>
            <p className="mt-1 text-xl font-semibold">{TRIAL_DAYS} days free</p>
          </div>
          <div className="rounded-md border border-white/10 bg-[#0b1120] p-4">
            <p className="text-xs uppercase text-slate-400">Credits included</p>
            <p className="mt-1 text-xl font-semibold">{TRIAL_CREDITS} credits</p>
          </div>
          <div className="rounded-md border border-white/10 bg-[#0b1120] p-4">
            <p className="text-xs uppercase text-slate-400">Trial ends</p>
            <p className="mt-1 text-xl font-semibold">{trialEndLabel}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-[#0b1120] p-4">
            <p className="text-xs uppercase text-slate-400">First charge date</p>
            <p className="mt-1 text-xl font-semibold">{firstChargeLabel}</p>
          </div>
        </div>

        <label className="mt-6 flex cursor-pointer gap-3 rounded-md border border-cyan-300/40 bg-cyan-300/10 p-4 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            I understand my 7-day trial includes 5 credits and will renew on the selected plan at {renewalPrice}/month unless I cancel before {firstChargeLabel}.
          </span>
        </label>

        <p className="mt-4 text-sm text-slate-400">
          You can cancel from Account/Billing before the trial ends. Canceling does not delete generated articles.
        </p>

        <button
          type="button"
          onClick={startCheckout}
          disabled={!accepted || isSubmitting}
          className="mt-6 w-full rounded-md bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Opening secure checkout..." : "Add card and start trial"}
        </button>
      </div>
    </main>
  );
}
