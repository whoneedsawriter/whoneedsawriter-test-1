"use client";

import Link from "next/link";
import { Routes } from "@/data/routes";
import { trackFunnelEvent } from "@/libs/analytics";
import { useIsLogged } from "@/hooks/useIsLogged";

const sections = [
  {
    title: "What an AI blog post generator does",
    body: "An AI blog post generator helps turn a topic or keyword into a complete draft with structure, headings, search intent coverage, and publishing assets. Who Needs a Writer focuses on researched SEO articles instead of thin filler copy.",
  },
  {
    title: "How Who Needs a Writer works from one keyword",
    body: "Enter a keyword, choose Lite, Core, or Pro, and the app prepares an outline, draft, meta title, meta description, and optional images. The workflow is built for marketers, founders, and publishers who need article production without a blank page.",
  },
  {
    title: "Lite vs Core vs Pro",
    body: "Lite is best for faster simple drafts. Core is built for researched SEO articles with stronger structure. Pro is designed for deeper research, richer article planning, and more comprehensive long-form output.",
  },
  {
    title: "AI blog post generator for WordPress",
    body: "Generated articles can be prepared for WordPress-ready formatting, so your team can move from draft to publish with fewer manual formatting steps.",
  },
  {
    title: "AI blog post generator with images",
    body: "Plans can include image and infographic options for article assets, helping posts feel more complete before they reach your CMS.",
  },
  {
    title: "Built for SEO and featured snippets",
    body: "The article structure supports search intent, scannable sections, direct answers, FAQ-style coverage, and metadata that helps each post target the right query.",
  },
  {
    title: "Pricing and credits in plain language",
    body: "Start with a 7-day trial that includes 5 credits. After the trial, the selected monthly plan renews at its listed price unless you cancel before the first charge.",
  },
  {
    title: "Generated output examples",
    body: "Review public sample articles to see the kind of titles, outlines, and formatting a finished article can include before you choose a plan.",
  },
];

export function HomeSeoSections() {
  const { isLogged, isLoading } = useIsLogged();
  const ctaHref = isLogged
    ? `${Routes.pricing}#pricing`
    : `${Routes.signUp}?trial=1&source=seo-section`;

  return (
    <section className="w-full px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">SEO article workflow</p>
          <h2 className="mt-2 text-3xl font-bold leading-tight text-white sm:text-4xl">
            The AI blog post generator for researched, publish-ready articles
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Who Needs a Writer is built for teams that want practical SEO content production from a single keyword, with clear pricing and a card-upfront trial.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-lg border border-slate-800 bg-[#0b1120] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
            >
              <h2 className="text-xl font-semibold text-white">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {section.body}
              </p>
            </article>
          ))}
        </div>
        <Link
          href={isLoading ? "#pricing" : ctaHref}
          onClick={() =>
            trackFunnelEvent("homepage_cta_click", {
              location: "seo_section",
              destination: isLogged ? "pricing" : "signup",
            })
          }
          className="mt-8 inline-flex rounded-xl bg-cyan-300 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          {isLogged ? "Choose a plan to start the trial" : "Start the AI blog post generator trial"}
        </Link>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          5 credits included. Then your selected plan price/month. Cancel anytime. Card required.
        </p>
      </div>
    </section>
  );
}
