import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Overview" };

function greeting(at = new Date()): string {
  const hour = at.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage() {
  const { user } = await requireSession();
  const name = user.name?.split(" ")[0] ?? user.login;

  return (
    <>
      <PageHeader title="Overview" />
      <div className="content content-narrow">
        <p style={{ color: "var(--text-dim)" }}>
          {greeting()}, {name}.
        </p>
      </div>
    </>
  );
}
