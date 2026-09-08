import type { Metadata } from "next";
import { Mark } from "@/components/mark";
import { unsubscribe } from "@/lib/subscribers/service";

export const metadata: Metadata = { title: "Unsubscribed", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

/**
 * One click, no confirmation step.
 *
 * Asking someone to confirm that they meant to unsubscribe is the pattern that
 * gets mail marked as spam. The link does the thing.
 */
export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;
  const result = await unsubscribe(token ?? "");

  return (
    <main className="login">
      <div className="login-card">
        <span className="mark">
          <Mark size={20} />
        </span>
        <h1>{result.ok ? "Unsubscribed" : "That link did not work"}</h1>
        <p>{result.message}</p>
        <a className="abtn abtn-quiet" href="https://byteveda.org">
          Back to byteveda.org
        </a>
      </div>
    </main>
  );
}
