import type { Metadata } from "next";

export { InboxPage as default } from "@/features/inbox/components/inbox-page";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";
