import type { Metadata } from "next";
import { Mark } from "@/components/mark";
import { confirm } from "@/lib/subscribers/service";

export const metadata: Metadata = { title: "Subscription", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ConfirmPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const result = await confirm(token ?? "");

  return (
    <main className="login">
      <div className="login-card">
        <span className="mark">
          <Mark size={20} />
        </span>
        <h1>{result.ok ? "Subscribed" : "That link did not work"}</h1>
        <p>{result.message}</p>
        <a className="abtn abtn-quiet" href="https://byteveda.org">
          Back to byteveda.org
        </a>
      </div>
    </main>
  );
}
