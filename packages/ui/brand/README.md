# Brand source artwork

`byteveda-mark-source.png` is the mark as supplied — 1254×1254 RGBA, untouched,
sha256 `8c3243a1bef278d01985a2c6b5bf7953a5d5b048855f879172061a5bc9d27701`. It
lives here rather than in `src/` so no bundler ever picks it up; nothing imports
it. Edit the derived asset, never this file.

`src/assets/byteveda-mark.png` is what `Wordmark` renders. It was derived from
the source by three steps, in this order:

1. **Alpha snapped to opaque above 250.** The supplied file had 432,046 pixels
   at alpha 250–254 and only 1,103 at 255 — the whole mark was very slightly
   translucent and picked up whatever was behind it. Values below 250 are the
   genuine soft edge and were left alone.
2. **Tight-cropped** to the alpha bounding box, `(210, 64)–(1053, 1190)`,
   giving 843×1126.
3. **Resized to 84px tall** (Lanczos) — three times the 28px the nav renders,
   so a retina screen has pixels to work with. `next/image` derives 1x and 2x
   from it at build time.

What looks like green fringing around the small squares at thumbnail size is
the design's own cream outline, and the pale shape near the centre is part of
the swoosh. Neither is an artifact; leave both.

To re-derive after a new supply, repeat the three steps above. There is no
script checked in on purpose: it was a one-off that needed Pillow, and a Python
toolchain is not worth carrying in this repo for it.
