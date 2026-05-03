import { Footer } from "@/components/Footer/Footer";
import { Header } from "@/components/Header/Header";
import { Pricing } from "@/components/Pricing/Pricing";
import { PricingPlugin } from "@/components/PricingPlugin/Pricing";
import { brandName } from "@/config";

export const metadata = {
    title: `Pricing | ${brandName}`,
    description: `Pricing | ${brandName}`,
  };

function normalizeSearchParam(
  value: string | string[] | undefined
): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return value[0] ?? "";
}

export default function PricingPage({
  searchParams,
}: {
  searchParams: { userId?: string | string[]; website?: string | string[] };
}) {
  const userId = normalizeSearchParam(searchParams.userId).trim();
  const website = normalizeSearchParam(searchParams.website).trim();
  const usePlugin = userId.length > 0;

  return (
    <>
      <Header />
      <main className="">
        {usePlugin ? (
          <PricingPlugin
            userId={userId}
            {...(website ? { website } : {})}
          />
        ) : (
          <Pricing />
        )}
      </main>
      <Footer />
    </>
  );
}
