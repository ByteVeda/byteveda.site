import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Makes a static image import look the way `next build` makes it look.
 *
 * Next turns `import mark from "./mark.png"` into `{ src, width, height }`,
 * and components use the dimensions — the brand mark derives its width from
 * the artwork's ratio. Vite hands back a URL string instead, so those reads
 * are `undefined`, the ratio is `NaN`, and `next/image` throws inside any test
 * that renders a page with the logo on it.
 *
 * The size is read from the PNG header rather than faked, so a test is looking
 * at the same aspect ratio the browser will.
 */
function nextStaticImages(): Plugin {
  return {
    name: "next-static-images",
    enforce: "pre",
    load(id) {
      const path = id.split("?")[0];
      if (!/\.(png|jpe?g|gif|webp|avif)$/i.test(path)) return null;

      // PNG: 8-byte signature, then the IHDR chunk with width and height as
      // big-endian 32-bit integers at byte 16 and byte 20.
      let width = 1;
      let height = 1;
      if (path.toLowerCase().endsWith(".png")) {
        const header = readFileSync(path).subarray(0, 24);
        width = header.readUInt32BE(16);
        height = header.readUInt32BE(20);
      }

      return `export default ${JSON.stringify({ src: path, width, height })};`;
    },
  };
}

export default defineConfig({
  plugins: [nextStaticImages()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Unit tests only. Anything that needs a browser or a database belongs in
    // the Playwright suite, which runs against a built app.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
