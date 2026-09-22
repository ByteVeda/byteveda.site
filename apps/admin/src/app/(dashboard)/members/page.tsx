import type { Metadata } from "next";

export { MembersPage as default } from "@/features/members";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";
