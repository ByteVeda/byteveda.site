import type { Metadata } from "next";

export { OverviewPage as default } from "@/features/overview/components/overview-page";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";
