import type { Metadata } from "next";

export { StatsPage as default } from "@/features/stats/components/stats-page";

export const metadata: Metadata = { title: "Downloads" };
export const dynamic = "force-dynamic";
