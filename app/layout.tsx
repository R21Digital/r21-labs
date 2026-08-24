import type { Metadata } from "next";
import { Montserrat, Open_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import Footer from "@/components/site/Footer";
import JsonLd from "@/components/site/JsonLd";
import { ORGANIZATION, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/* Type families are brand-locked (brand-r21 "Midnight AI"):
   Montserrat for headings, Open Sans for body, JetBrains Mono for eyebrows,
   labels and technical metadata — the mono is the brand's "AI/tech" register,
   which is also where the direction wants its utility labelling. */

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * 🔴 `metadataBase` is the load-bearing line here.
 *
 * Without it Next emits RELATIVE `og:image` URLs, and every scraper — Slack,
 * LinkedIn, iMessage, X — ignores a relative OpenGraph image. The tags look
 * complete in view-source and the card renders blank, which is why this is
 * asserted in tests/discovery.test.ts rather than trusted.
 *
 * `title.template` gives entry pages "<Entry> · R21 Labs" without each page
 * having to remember the suffix. Until 2026-08-22 all eleven entry pages
 * inherited the bare site title, so a search result page showed eleven rows
 * reading "R21 Labs".
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — the tools we build and run on`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": `${SITE_URL}/feed.xml` },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    title: `${SITE_NAME} — the tools we build and run on`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  authors: [{ name: ORGANIZATION.name, url: ORGANIZATION.url }],
  creator: ORGANIZATION.name,
  publisher: ORGANIZATION.legalName,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${openSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Organization identity, on every page. The publisher is the LLC and
            the brand is the DBA — stating both is what lets a crawler connect
            this site to R21 Digital rather than treating it as an orphan. */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            inLanguage: "en",
            publisher: {
              "@type": "Organization",
              name: ORGANIZATION.name,
              legalName: ORGANIZATION.legalName,
              url: ORGANIZATION.url,
              // Entity disambiguation. "R21 Labs" collides by name with AI21
              // Labs, Bio21, InfoLab21, CrunchLabs and the R21 malaria vaccine;
              // sameAs is the property that resolves which entity this is.
              sameAs: [...ORGANIZATION.sameAs],
            },
          }}
        />
        {children}
        <Footer />
      </body>
    </html>
  );
}
