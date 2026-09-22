import type { Metadata } from "next";

export { UnsubscribePage as default } from "@/features/subscribers";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";
