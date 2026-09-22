import { BrandMark } from "@byteveda/ui";

/**
 * The ByteVeda logo, as the public sites draw it.
 *
 * This used to be an inline bracket glyph — a single white path that needed
 * the accent tile behind it to be legible, and which was never the logo. The
 * real mark is a multi-tone leaf: it cannot take `currentColor`, there is
 * nothing for one path to carry, and it brings its own colour, so the tile it
 * used to sit on comes off with it.
 *
 * Wrapping `BrandMark` rather than importing it at each of the five call sites
 * keeps the console's sizes in one place, and keeps "which artwork is the
 * logo" a question with one answer and one import to change.
 */
export function Mark({ size = 30 }: { size?: number }) {
  return <BrandMark height={size} />;
}
