import type { Ecosystem } from "@byteveda/db";

/**
 * How each registry names a package, shown while adding one.
 *
 * Kept apart from the adapters so a client component can show the hint without
 * pulling collection code — and its credentials — into the browser bundle.
 */
export const adapterHints: Record<Ecosystem, string> = {
  pypi: "flexiq",
  npm: "@byteveda/flexiq",
  crates: "flexiq",
  maven: "org.byteveda.agenteval:agenteval-junit5",
};
