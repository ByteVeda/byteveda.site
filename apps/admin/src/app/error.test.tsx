import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ConsoleError from "./error";

/**
 * The boundary only ever renders when something else has already gone wrong, so
 * it is the one component that cannot be checked by using the console. A crash
 * in here shows the operator Next's fallback — a black page and a number, which
 * is exactly what this exists to replace.
 */
describe("ConsoleError", () => {
  const failed = Object.assign(new Error("connection terminated"), { digest: "4192300726" });

  it("says what happened without repeating the exception", () => {
    const markup = renderToStaticMarkup(<ConsoleError error={failed} reset={() => {}} />);

    expect(markup).toContain("This page did not load");
    // The message can carry a connection string or a row out of the database.
    expect(markup).not.toContain("connection terminated");
  });

  it("shows the digest, which is what finds the stack trace", () => {
    const markup = renderToStaticMarkup(<ConsoleError error={failed} reset={() => {}} />);

    expect(markup).toContain("4192300726");
  });

  it("offers both a retry and a way out", () => {
    const markup = renderToStaticMarkup(<ConsoleError error={failed} reset={() => {}} />);

    expect(markup).toContain("Try again");
    expect(markup).toContain("Back to the dashboard");
  });

  it("renders without a digest, which is what a client-side throw has", () => {
    const markup = renderToStaticMarkup(
      <ConsoleError error={new Error("boom")} reset={() => {}} />,
    );

    expect(markup).toContain("This page did not load");
    expect(markup).not.toContain("Logged as");
  });
});
