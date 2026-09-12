import type { Metadata } from "next";

export { UnsubscribePage as default } from "@/views/subscription";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";
