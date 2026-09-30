/**
 * WhatsApp lead-card helpers. Pure functions, no I/O.
 *
 * CANONICAL v2 (2026-09-29). Copied BYTE-FOR-BYTE to every client site alongside spam.ts
 * and whatsapp.ts; do not edit a copy in place. The brand, title, field labels and any
 * per-site note (e.g. "wrote in English") belong to the route that calls these.
 *
 * Visitor text lands inside a WhatsApp message, where *bold*, _italic_, ~strike~ and
 * `mono` are live markup and a newline starts a new line. Untreated, a name with a
 * newline and a fake "*Teléfono:* 000" after it forges a field. So one-line fields are
 * flattened and stripped, and the free-text message is quoted line by line ("> ") so
 * nothing in it can pose as a field or as the footer.
 */
import type { SpamVerdict } from "./spam";

export type Lang = "es" | "en";

/** Cut to `max` characters (code points, so an emoji at the boundary is never split). */
const cap = (s: string, max: number) => Array.from(s).slice(0, max).join("");

/** A one-line value: WhatsApp markup removed, whitespace collapsed, trimmed, capped. */
export function field(v: string, max = 120): string {
  return cap(v.replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim(), max);
}

/**
 * An email address: whitespace removed, nothing else. * _ ~ and ` are KEPT on purpose:
 * they are all legal in an address (john_doe@x.com, a*b@x.com), so stripping them would
 * corrupt a real one. The address sits after a fixed "*Correo:*" label on one line, so
 * it cannot forge a field, and WhatsApp only styles markup that opens and closes.
 */
export function emailField(v: string): string {
  return cap(v.replace(/\s+/g, ""), 120);
}

/** A social @handle: same treatment as an email, for the same reason. */
export function handleField(v: string): string {
  return emailField(v);
}

/** Any line break: CRLF, CR, LF, and the Unicode line/paragraph separators (Zl, Zp). */
const LINE_BREAK = /\r\n|[\r\n\p{Zl}\p{Zp}]/u;

/** The free-text message: capped (by code point), then every line prefixed "> ". */
export function quote(message: string, max = 2000): string {
  const chars = Array.from(message);
  const clipped = chars.length > max ? `${chars.slice(0, max).join("")}…` : message;
  return clipped
    .split(LINE_BREAK)
    .map((l) => `> ${l}`)
    .join("\n");
}

const FLAG_TEXT: Record<Lang, { prefix: string; link: string; links: string; language: string; word: string }> = {
  es: { prefix: "⚠️ Posible spam", link: "enlace", links: "enlaces", language: "idioma", word: "palabra" },
  en: { prefix: "⚠️ Possible spam", link: "link", links: "links", language: "language", word: "word" },
};

/** The warning line for a flagged lead in `lang` (default Spanish), "" for pass and drop. */
export function flagLine(verdict: SpamVerdict, lang: Lang = "es"): string {
  if (verdict.action !== "flag") return "";
  const t = FLAG_TEXT[lang];
  const { reason } = verdict;
  const what = reason.startsWith("keyword:")
    ? `${t.word}: ${reason.slice("keyword:".length)}`
    : reason.startsWith("script:")
      ? t.language
      : reason === "link-in-message"
        ? t.link
        : reason === "many-links-listed"
          ? t.links
          : "";
  return what ? `${t.prefix} (${what})` : t.prefix;
}

/**
 * Assemble the card. `title` is the ready-made headline (emoji and *bold* included).
 * `rows` are [label, value]; a row with an empty/undefined value is skipped. `notes` are
 * extra pre-formatted lines placed right after the rows. Values must already be passed
 * through field / emailField / handleField by the caller. `verdict` adds the warning line
 * when it is a flag; `lang` (default "es") sets that line and the message heading.
 */
export function card({
  verdict,
  lang = "es",
  title,
  rows,
  notes = [],
  message,
  footer = "_Powered by R21 Digital_",
}: {
  verdict?: SpamVerdict;
  lang?: Lang;
  title: string;
  rows: Array<[label: string, value: string | undefined]>;
  notes?: string[];
  message?: string;
  footer?: string;
}): string {
  const flag = verdict ? flagLine(verdict, lang) : "";
  return [
    ...(flag ? [flag] : []),
    title,
    "",
    ...rows.filter(([, value]) => value).map(([label, value]) => `*${label}:* ${value}`),
    ...notes,
    ...(message !== undefined ? ["", lang === "en" ? "*Message:*" : "*Mensaje:*", quote(message)] : []),
    "",
    footer,
  ].join("\n");
}
