import { ThemeProvider } from "@byteveda/ui";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { JsonLd } from "@/components/json-ld";
import { Footer, Navbar } from "@/components/layout";
import { site } from "@/lib/site";
import "./globals.css";

// Fonts come from @fontsource rather than `next/font/google` so builds never
// depend on Google's font CDN, which intermittently 404s during CI.
const plexSans = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
      style: "normal",
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
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "task queue",
    "background jobs",
    "job queue",
    "celery alternative",
    "bullmq alternative",
    "rust",
    "python",
    "node.js",
    "java",
    "sqlite",
    "cron",
    "workflow engine",
    "FlexiQ",
  ],
  authors: [{ name: site.org, url: site.orgUrl }],
  creator: site.org,
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: site.url },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#08080c" },
  ],
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Linux, macOS, Windows",
  url: site.url,
  description: site.description,
  license: "https://opensource.org/licenses/MIT",
  codeRepository: site.repoUrl,
  author: { "@type": "Organization", name: site.org, url: site.orgUrl },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* motion renders its `initial` styles during SSR, so a reveal would stay
            invisible if the JS never arrives. This is the escape hatch. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="grain" aria-hidden />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
        <JsonLd data={softwareSchema} />
      </body>
    </html>
  );
}
