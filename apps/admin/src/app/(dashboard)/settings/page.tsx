import type { Metadata } from "next";

export { SettingsPage as default } from "@/features/settings/components/settings-page";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";
