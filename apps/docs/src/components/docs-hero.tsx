export function DocsHero() {
  return (
    <section className="relative overflow-hidden border-border border-b">
      <div
        aria-hidden
        className="dot-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="fade-up max-w-3xl">
          <p className="mb-4 font-mono text-muted-foreground text-xs uppercase tracking-widest">
            Documentation
          </p>
          <h1 className="font-semibold text-4xl text-foreground tracking-tight sm:text-5xl md:text-6xl md:leading-[1.05]">
            Everything ByteVeda,
            <br />
            documented in one place.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 md:text-lg">
            Each library has its own full documentation hosted under this domain. Pick a tool below
            to jump straight to its guide, API reference, and examples.
          </p>
        </div>
      </div>
    </section>
  );
}
