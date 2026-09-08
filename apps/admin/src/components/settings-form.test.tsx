import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaults } from "@/lib/settings/registry";
import { SettingsForm } from "./settings-form";

/**
 * A smoke test, because a client component that throws while rendering leaves
 * an empty container and a console error rather than anything a screenshot can
 * explain. Server-rendering it here is the cheapest way to see the markup.
 */
describe("SettingsForm", () => {
  const markup = renderToStaticMarkup(<SettingsForm initial={defaults()} emailReady={true} />);

  it("renders something at all", () => {
    expect(markup.length).toBeGreaterThan(0);
  });

  it("renders a control for every setting", () => {
    expect(markup).toContain("Accept newsletter signups");
    expect(markup).toContain("Email the list when a post is published");
    expect(markup).toContain("From name");
    expect(markup).toContain("From address");
    expect(markup).toContain("Reply-to address");
  });

  it("shows both panels", () => {
    expect(markup).toContain("panel-head");
    expect(markup).toContain("panel-body");
  });

  it("warns only when Resend is unconfigured", () => {
    expect(markup).not.toContain("RESEND_API_KEY is not set");
    expect(
      renderToStaticMarkup(<SettingsForm initial={defaults()} emailReady={false} />),
    ).toContain("RESEND_API_KEY is not set");
  });
});
