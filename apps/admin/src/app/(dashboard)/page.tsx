import type { Metadata } from "next";

export { OverviewPage as default } from "@/views/dashboard";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";
