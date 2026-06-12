export function ProductProof() {
  return (
    <section className="w-full px-4 py-10 sm:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-5 md:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-800 bg-[#0b1120] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Example keyword</p>
          <p className="mt-2 text-2xl font-bold text-white">
            best standing desk for small apartments
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Who Needs a Writer builds the article plan, drafts the post, and prepares publishing assets from a single keyword.
          </p>
        </div>

        <div className="rounded-lg border border-cyan-400/30 bg-slate-950 p-5 text-white shadow-[0_18px_50px_rgba(34,211,238,0.12)]">
          <p className="text-xs font-semibold uppercase text-cyan-300">Generated output preview</p>
          <h2 className="mt-2 text-2xl font-bold">
            Best Standing Desks for Small Apartments: Space-Saving Picks That Still Feel Premium
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-white/8 p-3">
              <p className="text-xs text-slate-400">Word count</p>
              <p className="font-semibold">2,200+</p>
            </div>
            <div className="rounded-md bg-white/8 p-3">
              <p className="text-xs text-slate-400">Readability</p>
              <p className="font-semibold">Easy to scan</p>
            </div>
            <div className="rounded-md bg-white/8 p-3">
              <p className="text-xs text-slate-400">Publish signals</p>
              <p className="font-semibold">Images, meta, WordPress</p>
            </div>
          </div>
          <ol className="mt-4 space-y-2 text-sm text-slate-200">
            <li>1. Small-apartment desk buying criteria</li>
            <li>2. Foldable, wall-mounted, and compact electric options</li>
            <li>3. Comparison table, FAQ, and featured snippet answer</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
