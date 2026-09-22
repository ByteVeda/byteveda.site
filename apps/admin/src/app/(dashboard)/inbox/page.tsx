import type { Metadata } from "next";

export { InboxPage as default } from "@/features/inbox";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";
