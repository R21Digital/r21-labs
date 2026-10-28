import type { NextConfig } from "next";
import createMDX from "@next/mdx";

/**
 * Baseline security headers. Vercel added none of these (only HSTS), and HSTS
 * becomes a zone setting on Cloudflare, so the rest live here.
 *
 * CSP WITHOUT a nonce, deliberately: a nonce makes every response unique and
 * forces every route dynamic (see AGENTS.md, "Static only"). The policy still
 * buys frame-ancestors, form-action, base-uri and object-src. next/font
 * self-hosts the three families at build time, so font-src stays 'self'.
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://*.googletagmanager.com https://*.google-analytics.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https:`,
  `font-src 'self'`,
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com`,
  `frame-ancestors 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/**
 * Any host other than the canonical one is noindex, at the edge. The same build
 * serves r21labs.com, the workers.dev preview and the old vercel.app alias; a
 * crawlable duplicate would compete with the real domain. A header rather than
 * a robots.txt disallow: a disallowed URL is never fetched, so the crawler
 * never sees the noindex.
 */
const canonicalHosts = ["r21labs.com", "www.r21labs.com"];

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/:path*",
        missing: canonicalHosts.map((value) => ({ type: "host" as const, value })),
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  // Vercel redirects www to the apex (308) at the project level. That does not
  // travel with the code, so it is stated here for the Worker.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "www.r21labs.com" }],
        destination: "https://r21labs.com/:path*",
        permanent: true,
      },
    ];
  },
};

// Plugins are named as STRINGS, not imported functions. Turbopack serializes
// loader options across a worker boundary and a function reference cannot make
// that trip — passing `remarkFrontmatter` directly fails the build with
// "does not have serializable options".
//
// remark-frontmatter parses the YAML block and keeps it OUT of the rendered
// body. The values are read from disk by gray-matter in lib/content.ts, so the
// guards can reject an entry without compiling its MDX first.
const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-frontmatter"]],
  },
});

export default withMDX(nextConfig);
