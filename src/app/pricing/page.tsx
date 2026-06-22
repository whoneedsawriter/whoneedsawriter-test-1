import { Footer } from "@/components/Footer/Footer";
import { Header } from "@/components/Header/Header";
import { Pricing } from "@/components/Pricing/Pricing";
import { PricingPlugin } from "@/components/PricingPlugin/Pricing";
import { brandName } from "@/config";
import { verifyPluginBillingToken } from "@/libs/plugin-billing-auth";

export const metadata = {
    title: `Pricing | ${brandName}`,
    description: `Pricing | ${brandName}`,
    alternates: {
      canonical: "/pricing",
    },
  };

function normalizeSearchParam(
  value: string | string[] | undefined
): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return value[0] ?? "";
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: { userId?: string | string[]; website?: string | string[]; token?: string | string[] };
}) {
  const token = normalizeSearchParam(searchParams.token).trim();
  const pluginBilling = token ? await verifyPluginBillingToken(token, ["pricing"]) : null;

  return (
    <>
      <Header />
      <main className="">
        {pluginBilling ? (
          <PricingPlugin
            userId={pluginBilling.userId}
            website={pluginBilling.website}
            billingToken={token}
          />
        ) : (
          <Pricing />
        )}
      </main>
      <Footer />
    </>
  );
}
