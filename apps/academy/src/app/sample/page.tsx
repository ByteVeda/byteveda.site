import type { Metadata } from "next";

import { SamplePage } from "@/features/sample/sample-page";

export const metadata: Metadata = {
  title: "Request samples",
  description: "Have a sample sheet of the chapters you picked emailed to you.",
  // One visitor's shortlist. There is nothing here for a crawler to keep.
  robots: { index: false, follow: true },
};

export default function Sample() {
  return (
    <section className="wrap sample-page">
      <SamplePage />
    </section>
  );
}
