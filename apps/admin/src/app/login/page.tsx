import type { Metadata } from "next";

export { LoginPage as default } from "@/features/auth/components/login-page";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
