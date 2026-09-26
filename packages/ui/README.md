# @byteveda/ui

The ByteVeda design system: primitives, theme tokens and hero effects, as used
on [byteveda.org](https://byteveda.org). Built for Next.js 16+ with Tailwind CSS 4.

## Install

```sh
pnpm add @byteveda/ui next-themes
```

`next`, `react`, `react-dom` and `next-themes` are peer dependencies.

## Styles

Import the design system straight after Tailwind in your global stylesheet:

```css
@import "tailwindcss";
@import "@byteveda/ui/styles/index.css";
```

This brings the tokens, base styles and component classes, registers the
package with Tailwind's source scanning, and maps the tokens onto utilities
(`bg-background`, `text-accent`, `border-border`, …).

The tokens expect two font variables, `--font-plex-sans` and `--font-plex-mono`,
and fall back to system fonts without them:

```tsx
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

const sans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });
```

## Theme

Light and dark are driven by `data-theme` on `<html>`:

```tsx
import { ThemeProvider } from "@byteveda/ui";

<html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
  <body>
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
      {children}
    </ThemeProvider>
  </body>
</html>
```

## Components

```tsx
import { Button, Section, SectionHeader, ThemeToggle, Wordmark } from "@byteveda/ui";
```

| Export | What it is |
| --- | --- |
| `Button` | Link or button in `primary` / `ghost` variants; external hrefs open in a new tab. |
| `Badge`, `TerminalChip` | Inline labels. |
| `ExternalLink` | Off-site link: new tab, `noopener noreferrer`, trailing arrow icon. |
| `Section`, `SectionHeader`, `NotebookSection` | Page section layouts. |
| `Marquee` | Infinite horizontal scroller over a list of items. |
| `MobileMenu` | Drawer navigation for small screens. *(client)* |
| `Wordmark`, `BrandMark` | The ByteVeda lockup and leaf mark. |
| `ThemeProvider`, `ThemeToggle` | `next-themes` wrapper and toggle button. *(client)* |
| `HeroNet`, `SiteEffects` | Canvas network behind `[data-hero-fx]`; sticky-nav and aurora parallax behaviour. *(client)* |
| `RelativeTime` | `<time>` rendered as "3d ago". |
| `GithubIcon`, `OctocatIcon`, `ArrowRight`, … | Icons. |

Components marked *(client)* ship with `"use client"`; everything else renders
on the server.

## License

MIT
