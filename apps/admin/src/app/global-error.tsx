"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * The last resort: the root layout itself threw.
 *
 * This replaces the layout rather than rendering inside it, so it has to supply
 * its own `<html>` and `<body>` — and it deliberately imports nothing. No
 * stylesheet, no font, no component from the app, because whatever broke is
 * upstream of all three and a boundary that depends on the thing it is
 * reporting on shows a blank page instead of a message.
 *
 * Hence the inline styles. `color-scheme` gets the form controls right in
 * either theme without a stylesheet to ask.
 */
export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#08080c",
          color: "#e8e6df",
          colorScheme: "dark",
          font: '400 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <h1
            style={{ margin: "0 0 10px", font: "600 19px/1.3 inherit", letterSpacing: "-0.02em" }}
          >
            The console did not start
          </h1>
          <p style={{ margin: "0 0 20px", color: "#9b978c" }}>
            Something failed before any page could render. Nothing was lost.
          </p>

          {error.digest && (
            <p style={{ margin: "0 0 20px", color: "#9b978c", fontSize: 13 }}>
              Logged as{" "}
              <code style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                {error.digest}
              </code>
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              padding: "9px 16px",
              border: "1px solid #2a2a33",
              borderRadius: 8,
              background: "#16161c",
              color: "inherit",
              font: "500 14px/1 inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
