/**
 * The branded container both the composed reply and the fallback template ride in,
 * so a fallback still looks like R21 Labs rather than a plain-text apology.
 *
 * It is the site, in email: the Midnight AI canvas and card, the single #E94560 accent,
 * the aurora used once as a hairline, the mono labels, and the R/21/LABS wordmark -- whose
 * structure IS the mark, so it survives the loss of the typeface. lib/og.tsx makes the same
 * bet for the same reason.
 *
 * Email HTML constraints, each with a cause: tables for layout because Outlook's Word
 * rendering engine has no flexbox or grid; inline styles because Gmail strips <style>
 * blocks in several contexts, so the one <style> here only tightens padding on phones and
 * nothing depends on it; `bgcolor` beside every background because Outlook ignores CSS
 * backgrounds on cells; alpha colours flattened to hex because Outlook cannot composite
 * them; 600px because it is the width that survives every client. Brand faces are named
 * first in each stack and never relied on -- most clients will not load a webfont.
 *
 * Dark on purpose, and declared dark: the site has no light mode, and `color-scheme: dark`
 * tells Apple Mail and Outlook.com the design is already dark so they leave it alone.
 * Gmail's apps may invert it anyway; every text colour sits on a cell that sets its own
 * background, so an inversion flips pairs rather than stranding light text on light.
 *
 * 🔴 Nothing the visitor submitted is echoed here beyond what the reply body already says.
 * The address is untrusted -- anyone can type someone else's -- and quoting a message back
 * would make the form a relay for arbitrary text from a verified R21 domain.
 */
import type { SubmissionKind } from "./forms";

/**
 * Held here rather than imported from lib/site.ts, deliberately. site.ts type-imports
 * lib/schema, and tests/boundary.test.ts walks /api/submit's whole import graph to prove the
 * one dynamic route never reaches the content layer. Importing it for three strings trips
 * that guard -- and the guard is right -- so they live here, as LABS_BRAND's hosts do.
 */
const SITE_URL = "https://r21labs.com";
const SITE_NAME = "R21 Labs";
const ORGANIZATION = {
  name: "R21 Digital",
  legalName: "R21 Media Group, LLC",
  url: "https://r21digital.com",
};

// Tokens from app/globals.css -- the only source. Never clients/r21/templates/design/.
const CANVAS = "#0a0a14";
const SURFACE = "#13131f";
const ACCENT = "#e94560";
const INK = "#ffffff";
/** Footer and fine print. Same hex as --color-ink-muted / the raised ink-dim. */
const INK_MUTED = "#9aa0b4";
/** --hairline-strong (white at 12%) flattened over SURFACE. */
const HAIRLINE = "#2f2f3a";
/** The site's button fill, `bg-accent/[0.12]`, flattened over SURFACE. */
const ACCENT_WASH = "#2d1927";
/** The aurora, used as light: one hairline across the top of the card and nowhere else. */
const AURORA = "linear-gradient(90deg,#3b82f6 0%,#7c3aed 50%,#e94560 100%)";

const DISPLAY = "Montserrat,'Segoe UI',Helvetica,Arial,sans-serif";
const SANS = "'Open Sans','Segoe UI',-apple-system,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',SFMono-Regular,Menlo,Consolas,monospace";

type Cta = { label: string; href: string };

/**
 * What the label says happened, and where the one button goes.
 *
 * 🔴 A contact reply gets NO button. On 2026-09-10 a composed reply answered a build
 * enquiry by pointing at the tool list and lost the lead. The next step for someone who
 * wrote in is a reply; a "browse the tools" button would repeat that deflection in markup.
 *
 * The subscribe label says "received", not "you're on the list": there is no list -- a
 * person adds each address by hand (see the footer's subscribe copy).
 */
const KIND: Record<SubmissionKind, { eyebrow: string; cta?: Cta }> = {
  contact: { eyebrow: "Message received" },
  subscribe: {
    eyebrow: "Subscription received",
    cta: { label: "Browse R21 Labs", href: `${SITE_URL}/` },
  },
  suggestion: {
    eyebrow: "Suggestion received",
    cta: { label: "Suggest another tool", href: `${SITE_URL}/suggest` },
  },
};

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A closing "— R21 Labs" line is set as a signature rather than as body copy. */
function paragraph(p: string, isLast: boolean): string {
  const body = esc(p).replace(/\n/g, "<br>");
  return isLast && /^[—–]\s*\S/.test(p)
    ? `<p style="margin:10px 0 0;font-family:${DISPLAY};font-size:15px;font-weight:700;letter-spacing:.01em;color:${INK}">${body}</p>`
    : `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK}">${body}</p>`;
}

/** A 1-cell table, because Outlook will not give an empty div a height. */
function rule(width: string, height: number, color: string, extra = ""): string {
  return (
    `<table role="presentation" width="${width === "100%" ? "100%" : width.replace("px", "")}" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td height="${height}" bgcolor="${color}" style="height:${height}px;font-size:0;line-height:0;background:${color};${extra}">&nbsp;</td></tr></table>`
  );
}

function button({ label, href }: Cta): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    `<td bgcolor="${ACCENT_WASH}" style="background:${ACCENT_WASH};border:1px solid ${ACCENT};border-radius:4px">`,
    `<a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font-family:${MONO};font-size:12px;line-height:1;letter-spacing:.14em;text-transform:uppercase;color:${INK};text-decoration:none">${esc(label)}&nbsp;&rarr;</a>`,
    "</td></tr></table>",
  ].join("");
}

export function renderShell(input: {
  kind: SubmissionKind;
  preheader: string;
  text: string;
}): string {
  const { eyebrow, cta } = KIND[input.kind];

  const blocks = input.text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const paragraphs = blocks.map((p, i) => paragraph(p, i === blocks.length - 1)).join("");

  const footerLink = (href: string, label: string) =>
    `<a href="${esc(href)}" style="color:${INK_MUTED};text-decoration:none">${esc(label)}</a>`;

  return [
    "<!doctype html>",
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="supported-color-schemes" content="dark">',
    `<title>${esc(SITE_NAME)}</title>`,
    "<style>@media (max-width:620px){.px{padding-left:24px!important;padding-right:24px!important}}</style>",
    "</head>",
    `<body bgcolor="${CANVAS}" style="margin:0;padding:0;background:${CANVAS}">`,

    // Preview text, then padding so the client does not pull the label in after it.
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(input.preheader)}${"&#8199;&#847; ".repeat(40)}</div>`,

    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CANVAS}" style="background:${CANVAS}">`,
    '<tr><td align="center" style="padding:40px 12px 48px">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">',

    // Wordmark: [R][accent 21][LABS].
    '<tr><td style="padding:0 4px 22px">',
    `<span style="font-family:${DISPLAY};font-size:26px;font-weight:800;letter-spacing:-.5px;color:${INK}">R</span>`,
    `<span style="font-family:${DISPLAY};font-size:26px;font-weight:800;letter-spacing:-.5px;color:${ACCENT}">21</span>`,
    `<span style="font-family:${DISPLAY};font-size:17px;font-weight:600;letter-spacing:4px;color:${INK};padding-left:8px">LABS</span>`,
    "</td></tr>",

    // The card.
    `<tr><td bgcolor="${SURFACE}" style="background:${SURFACE};border:1px solid ${HAIRLINE};border-radius:6px">`,
    rule("100%", 3, ACCENT, `background-image:${AURORA};border-radius:5px 5px 0 0`),

    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">',
    '<tr><td class="px" style="padding:34px 40px 0">',
    `<div style="font-family:${MONO};font-size:11px;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;color:${ACCENT}">${esc(eyebrow)}</div>`,
    '<div style="height:14px;line-height:14px;font-size:0">&nbsp;</div>',
    rule("32px", 2, ACCENT),
    "</td></tr>",

    `<tr><td class="px" style="padding:26px 40px 8px">${paragraphs}</td></tr>`,

    cta ? `<tr><td class="px" style="padding:18px 40px 6px">${button(cta)}</td></tr>` : "",

    '<tr><td class="px" style="padding:28px 40px 34px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">',
    `<tr><td style="border-top:1px solid ${HAIRLINE};padding-top:20px;font-family:${SANS};font-size:14px;line-height:1.55;color:${INK_MUTED}">`,
    "You can reply directly to this email.",
    "</td></tr></table>",
    "</td></tr>",
    "</table>",
    "</td></tr>",

    // Footer, mirroring the site's: the two properties, then brand · DBA · legal entity.
    `<tr><td style="padding:26px 4px 0;font-family:${MONO};font-size:11px;line-height:1.9;letter-spacing:.14em;text-transform:uppercase;color:${INK_MUTED}">`,
    `${footerLink(`${SITE_URL}/`, "r21labs.com")}&nbsp;&nbsp;·&nbsp;&nbsp;${footerLink(ORGANIZATION.url, "r21digital.com")}<br>`,
    `${esc(SITE_NAME)} — ${esc(ORGANIZATION.name)} · ${esc(ORGANIZATION.legalName)}`,
    "</td></tr>",

    "</table></td></tr></table>",
    "</body></html>",
  ].join("");
}
