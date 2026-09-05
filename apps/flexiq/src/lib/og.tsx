import { ImageResponse } from "next/og";
import { site } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * One brand-locked card behind every social preview, so a link posted to X,
 * LinkedIn or Reddit is recognisably the same product each time. Rendered with
 * the runtime's default font: the brand faces ship as woff2, which satori
 * cannot parse, and a build that fails on a missing glyph is worse than a
 * preview in a neutral face.
 */
export function ogImage({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(140deg, #11111c 0%, #08080c 55%)",
        padding: "72px 80px",
        color: "#ececf4",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 44, height: 6, background: "#1f9d54", borderRadius: 999 }} />
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#8c8ca3",
          }}
        >
          {eyebrow}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", fontSize: 74, lineHeight: 1.05, letterSpacing: -2 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ display: "flex", fontSize: 30, color: "#8c8ca3", lineHeight: 1.4 }}>
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
        <div style={{ display: "flex", color: "#3bbf72" }}>{site.name}</div>
        <div style={{ display: "flex", color: "#5c5c70" }}>{site.domain}</div>
      </div>
    </div>,
    OG_SIZE,
  );
}
