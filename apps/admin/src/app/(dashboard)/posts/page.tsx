import type { Metadata } from "next";

export { PostsPage as default } from "@/views/posts";

export const metadata: Metadata = { title: "Posts" };
export const dynamic = "force-dynamic";
