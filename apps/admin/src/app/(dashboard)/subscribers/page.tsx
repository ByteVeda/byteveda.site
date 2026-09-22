import type { Metadata } from "next";

export { SubscribersPage as default } from "@/features/subscribers/components/subscribers-page";

export const metadata: Metadata = { title: "Subscribers" };
export const dynamic = "force-dynamic";
