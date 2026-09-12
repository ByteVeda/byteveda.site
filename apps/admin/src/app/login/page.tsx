import type { Metadata } from "next";

export { LoginPage as default } from "@/views/login";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
