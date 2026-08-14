import { SiteEffects, ThemeProvider } from "@byteveda/ui";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site } from "@/lib/site";
import "./globals.css";

// Fonts come from @fontsource rather than `next/font/google` so builds never depend
// on Google's font CDN, which intermittently serves URLs that 404 during CI builds.
const plexSans = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-italic.woff2",
      style: "italic",
    },
  ],
  weight: "100 700",
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} Docs — ${site.tagline}`,
    template: `%s — ${site.name} Docs`,
  },
  description: site.description,
  applicationName: `${site.name} Docs`,
  keywords: [
    "ByteVeda",
    "documentation",
    "open source",
    "rust",
    "python",
    "java",
    "libraries",
    "developer tools",
  ],
  authors: [{ name: site.name, url: site.homeUrl }],
  creator: site.name,
  openGraph: {
    type: "website",
    url: site.url,
    siteName: `${site.name} Docs`,
    title: `${site.name} Docs — ${site.tagline}`,
    description: site.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} Docs — ${site.tagline}`,
    description: site.description,
  },
  alternates: { canonical: site.url },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#08080c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="grain" aria-hidden />
          {children}
          <SiteEffects />
        </ThemeProvider>
      </body>
    </html>
  );
}
