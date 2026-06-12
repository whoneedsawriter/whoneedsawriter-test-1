import { CtaBox } from "@/components/CtaBox/CtaBox";
import { FAQ } from "@/components/FAQ/FAQ";
import { Features } from "@/components/Features/Features";
import { Footer } from "@/components/Footer/Footer";
import { Header } from "@/components/Header/Header";
import { Hero } from "@/components/Hero/Hero";
import { Pricing } from "@/components/Pricing/Pricing";
//import { ExplainerVideo } from "@/components/ExplainerVideo/ExplainerVideo";
import { getSEOTags } from "@/components/SEOTags/SEOTags";
import { Testimonials } from "@/components/Testimonials/Testimonials";
import { Metadata } from "next";
import SampleArticles from "@/components/SampleArticles/SampleArticles";
import { ProductProof } from "@/components/Homepage/ProductProof";
import { HomeSeoSections } from "@/components/Homepage/HomeSeoSections";
import { websiteUrl, openGraphImageUrl } from "@/config";

export const metadata: Metadata = getSEOTags({
  metadataBase: new URL(websiteUrl),
  title: "AI Blog Post Generator for SEO Articles | Who Needs a Writer",
  description:
    "Use Who Needs a Writer, an AI blog post generator that turns one keyword into researched SEO articles with outlines, images, and WordPress-ready formatting.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "AI Blog Post Generator for SEO Articles | Who Needs a Writer",
    description:
      "Use Who Needs a Writer, an AI blog post generator that turns one keyword into researched SEO articles with outlines, images, and WordPress-ready formatting.",
    url: websiteUrl,
    type: "website",
    images: [{ url: openGraphImageUrl, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [openGraphImageUrl],
  },
});

export default function Home() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Who Needs a Writer",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "AI blog post generator for researched SEO articles, outlines, images, and WordPress-ready formatting.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "7-day free trial with 5 credits, then selected plan price per month.",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Who Needs a Writer",
      url: websiteUrl,
      logo: `${websiteUrl}/logo.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Who Needs a Writer",
      url: websiteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is an AI blog post generator?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "An AI blog post generator turns a keyword or topic into a structured draft with headings, search intent coverage, and publishing assets.",
          },
        },
        {
          "@type": "Question",
          name: "Does Who Needs a Writer include a trial?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The card-upfront trial lasts 7 days and includes 5 credits before the selected plan renews unless canceled.",
          },
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: websiteUrl,
        },
      ],
    },
  ];

  return (
    <>
      <Header />
      <main className="">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Hero />
        <ProductProof />
        {/* <ExplainerVideo /> */}
        <HomeSeoSections />
        <Features />
        <Testimonials />
        <Pricing />
        <FAQ />
        <SampleArticles />
        <CtaBox />
      </main>
      <Footer />
    </>
  );
}
