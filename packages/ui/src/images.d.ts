/**
 * Static image imports.
 *
 * Apps get this from the `next-env.d.ts` Next writes for them; a package that
 * imports an asset of its own has to say so itself. `StaticImageData` is what
 * `import mark from "./x.png"` resolves to — the URL plus the intrinsic size,
 * which is where `Wordmark` gets its width and height from.
 */

/// <reference types="next/image-types/global" />
