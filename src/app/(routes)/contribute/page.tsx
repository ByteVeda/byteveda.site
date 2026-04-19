import type { Metadata } from "next";
import { Contribute } from "@/features/contribute";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contribute",
  description: `How to contribute to ${site.name} — maintainers, a five-minute onboarding, and where to ask for help.`,
  alternates: { canonical: `${site.url}/contribute` },
};

export default function ContributePage() {
  return <Contribute />;
}
