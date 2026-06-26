import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { site } from "@/lib/site";
import { ThemeProvider } from "@/providers/theme-provider";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
