export const brandName = "Who Needs a Writer";
export const landingPageTitle = "Who Needs A Writer";
export const landingPageDescription = "Generate Articles with Keywords Using AI";

/* 
Only if you are using Supabase for authentication
configure your website URL on Supabase https://docs.shipped.club/features/supabase#supabase-get-started
*/
export const websiteUrl = process.env.WEBSITE_URL || "https://whoneedsawriter.com";

export const supportEmail = "support@whoneedsawriter.com";
export const openGraphImageUrl = "https://whoneedsawriter.com/images/og-image.png";
export const blogOpenGraphImageUrl = "https://whoneedsawriter.com/images/og-image.png";

// the users will be redirected to this page after sign in
export const signInCallbackUrl = "/article-generator";

// only needed if you have the "talk to us" button in the landing page
export const demoCalendlyLink = "https://calendly.com/whoneedsawriter/15min";

// used by MailChimp, Loops, and MailPace
export const emailFrom = "no-reply@whoneedsawriter.com";

// social links
export const discordLink = "https://discord.gg/whoneedsawriter";
export const twitterLink = "https://x.com/whoneedsawriter";
export const youTubeLink = "https://youtube.com/@whoneedsawriter";

export const affiliateProgramLink =
  "https://whoneedsawritermerchant.lemonsqueezy.com/affiliates";

export const twitterHandle = "@whoneedsawriter";
export const twitterMakerHandle = "@whoneedsawriter";

export const cannyUrl = "https://whoneedsawriter.canny.io";

type PaymentProvider = "lemon-squeezy" | "stripe";
export const paymentProvider: PaymentProvider = "stripe";

/* 
  do not edit this
*/
export { pricingPlans } from "./pricing.constants";
export { lifetimeDeals } from "./lifetime.constants";
