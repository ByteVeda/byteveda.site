import { Cta, Hero, Interop, Lab, Ledger, SdkProvider, Source } from "@/features/home";
import { getVersion } from "@/lib/version";

/**
 * One argument, in five moves: the broker is the part you can delete (hero),
 * here is what that is worth in things you operate (ledger), here is the queue
 * failing on purpose so you can judge it yourself (lab), here is the capability
 * that has no equivalent elsewhere (interop), and here is the source for the
 * claim most likely to be hand-waved (source).
 *
 * Deliberately not a feature grid and a comparison table. The docs site already
 * has that page, and a second copy of it on a second domain persuades nobody.
 */
export default async function Home() {
  const version = await getVersion();

  return (
    <SdkProvider>
      <Hero />
      <Ledger />
      <Lab />
      <Interop />
      <Source />
      <Cta version={version} />
    </SdkProvider>
  );
}
