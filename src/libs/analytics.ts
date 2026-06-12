type FunnelEvent =
  | "homepage_cta_click"
  | "signup_started"
  | "trial_payment_method_added"
  | "trial_started"
  | "first_article_generated"
  | "trial_credits_exhausted"
  | "upgrade_payment_success"
  | "trial_canceled"
  | "first_paid_renewal";

declare global {
  interface Window {
    clarity?: (event: string, name: string, data?: Record<string, unknown>) => void;
  }
}

export function trackFunnelEvent(event: FunnelEvent, data: Record<string, unknown> = {}) {
  if (typeof window !== "undefined") {
    window.clarity?.("event", event, data);
  }

  if (typeof window === "undefined") {
    console.log("funnel_event", event, data);
  }
}
