/**
 * Deterministic scatter for the hero field.
 *
 * The obvious one-liner — `((i * K) % 2 ** 31) / 2 ** 31` — is a multiplicative
 * lattice, and drawing a point's x and y from it at a fixed index offset puts
 * every point on the same line: `y = x + c (mod 1)`. Wrapped across the
 * viewport that reads as a set of parallel diagonal stripes rather than a
 * scatter. Mixing the bits (murmur3's finalizer) decorrelates the streams, so
 * `hash01(i, "x")` and `hash01(i, "y")` are independent.
 *
 * Still pure and index-addressed, so the hero looks identical on every load —
 * which is what makes it a stable thing to screenshot for a launch post.
 */

const SALT = {
  x: 0x1f83d9ab,
  y: 0x5be0cd19,
  speed: 0x9b05688c,
  size: 0x1f6ea9e3,
  alpha: 0x510e527f,
};

export type Channel = keyof typeof SALT;

/** A stable value in [0, 1) for point `index` on one channel. */
export function hash01(index: number, channel: Channel): number {
  let h = Math.imul(index ^ SALT[channel], 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}
