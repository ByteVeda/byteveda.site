import type { Metadata } from "next";

export { StatsPage as default } from "@/views/stats";

export const metadata: Metadata = { title: "Downloads" };
export const dynamic = "force-dynamic";
