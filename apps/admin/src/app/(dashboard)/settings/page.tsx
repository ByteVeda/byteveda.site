import type { Metadata } from "next";

export { SettingsPage as default } from "@/views/settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";
