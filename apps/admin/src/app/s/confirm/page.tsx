import type { Metadata } from "next";

export { ConfirmPage as default } from "@/features/subscribers";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false } };
export const dynamic = "force-dynamic";
