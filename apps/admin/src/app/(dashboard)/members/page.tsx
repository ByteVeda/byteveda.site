import type { Metadata } from "next";

export { MembersPage as default } from "@/views/members";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";
