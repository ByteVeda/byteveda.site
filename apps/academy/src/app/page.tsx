import { Delivery, Hero, Sets, Strip } from "@/components/sections";
import { CustomSection } from "@/features/custom/components";
import { InventorySection } from "@/features/inventory/components";

/**
 * The shop: what we stock, what we will set, and what happens next.
 *
 * Picking happens here and only here — the shortlist travels down the page with
 * the reader, and `/sample` is the one step that leaves it. Buying is not open
 * yet, so every place the prototype asked for money now says so instead.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Strip />
      <InventorySection />
      <Sets />
      <CustomSection />
      <Delivery />
    </>
  );
}
