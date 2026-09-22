import type { Metadata } from "next";

export { MembersPage as default } from "@/features/members/components/members-page";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";
