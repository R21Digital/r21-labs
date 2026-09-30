/**
 * Bot filter for R21 client contact forms.
 *
 * CANONICAL v2 (2026-09-29). This file, lead-card.ts and whatsapp.ts are copied
 * BYTE-FOR-BYTE to every client site; do not edit a copy in place. Anything specific to
 * one site (brand, group name, recipients, the Sheet) lives in that site's route.
 *
 * The form fires several side effects per submission (business email, visitor
 * auto-reply, WhatsApp push, Sheet row), so an unfiltered POST is both a
 * notification-spam problem and an outbound-mail problem: the auto-reply goes to
 * whatever address the caller supplies, which lets a bot push mail through R21's
 * shared SES identity. Everything here runs BEFORE the first side effect.
 *
 * Principle: a silently dropped real lead is worse than a spam line in the client's
 * WhatsApp group. So only five signals drop silently, and each is near-certain:
 *   honeypot        a hidden input was filled
 *   too-fast        a PRESENT elapsedMs under 2.5s (or negative)
 *   missing-timing  elapsedMs absent or not a number, unless the route opts out with
 *                   allowMissingTiming
 *   markup-link     real HTML/BBCode links (<a href, [url=, [link=, closed [url]...[/url]),
 *                   not a bare "[link]" or "[URL]"
 *   many-links      3+ links to hosts off the allowlist, or 1+ off the list among 4+ links.
 *                   A message whose links are all allowlisted is NEVER dropped.
 * Everything else that looks off is FLAGGED: the route delivers the lead with a warning
 * line on top (lead-card.ts flagLine turns the reason into es/en text):
 *   link-in-message    a link to a host not on the allowlist (any count the drop rule spares)
 *   many-links-listed  3+ links, every one allowlisted
 *   script:<Name>      2+ characters of a non-Latin script in the name or message
 *   keyword:<word>     a spam keyword as a whole word
 *
 * Usage in a route:
 *   const v = checkSpam({ honeypot, elapsedMs: data.elapsedMs, name, message });
 *                                              // or , { allowMissingTiming: true }
 *   if (v.action === "drop") { console.warn("[contact] blocked:", v.reason); return ok200; }
 *   const flag = flagLine(v);                  // "" when action is "pass"; pass v to card()
 * Pass the raw request-body value as elapsedMs: null, "", undefined, non-numeric text and
 * non-finite numbers all count as missing; numeric strings are read as numbers.
 *
 * 2026-09-15: keywords match WHOLE WORDS. This file used to match substrings, so ordinary
 * Spanish was dropped as spam ("Deseo una cita" contains "seo", "Paseo" contains "seo",
 * "especialista" contains "cialis") and a dropped lead answers 200, so the visitor saw the
 * thank-you and the lead reached nobody. spam.test.ts carries Spanish that must pass.
 */

/** What a route does with a submission. `reason` is machine-readable; wording lives in lead-card.ts. */
export type SpamVerdict =
  | { action: "drop"; reason: string }
  | { action: "flag"; reason: string }
  | { action: "pass" };

export type SpamOptions = {
  /** Default false: a missing/NaN elapsedMs is a hard drop. Set true only on a site whose
   *  form has not shipped the timing field to every open tab yet. */
  allowMissingTiming?: boolean;
};

/** Minimum time a human needs to fill the form. Bots post in well under 1s. */
const MIN_ELAPSED_MS = 2500;

const URL_PATTERN = /(https?:\/\/|www\.)[^\s]*/gi;
const MARKUP_LINK = /\[(url|link)=|\[url\][^\[]*\[\/url\]|<a\s[^>]*href/i;

/**
 * Hosts a real lead links to: file shares (artwork, plans, documents), a Maps pin, an
 * Instagram/Facebook/Canva/YouTube/TikTok/LinkedIn reference, a wa.me contact. Flagging
 * those would bury real leads under a warning.
 * Matched against the parsed HOSTNAME (exact, or a subdomain of it), never the raw text:
 * `evil.com/?x=instagram.com` and `instagram.com.evil.com` must not pass. `path` limits a
 * host that is only trusted for one section (goo.gl/maps, google.com/maps).
 */
const ALLOWED_HOSTS: { host: string; path?: string }[] = [
  ...[
    "drive.google.com",
    "docs.google.com",
    "dropbox.com",
    "db.tt",
    "wetransfer.com",
    "we.tl",
    "onedrive.live.com",
    "1drv.ms",
    "icloud.com",
    "box.com",
    "mega.nz",
    "sharepoint.com",
    "maps.app.goo.gl",
    "photos.app.goo.gl",
    "maps.google.com",
    "instagram.com",
    "facebook.com",
    "fb.me",
    "canva.com",
    "wa.me",
    "youtube.com",
    "youtu.be",
    "tiktok.com",
    "linkedin.com",
  ].map((host) => ({ host })),
  { host: "goo.gl", path: "/maps" },
  { host: "google.com", path: "/maps" },
  { host: "google.com.pr", path: "/maps" },
];

/** Redirect wrappers on otherwise-allowed hosts: l.facebook.com/l.php?u=<anything> sends the
 *  visitor to any site, so a link through one is no better than its target. Never allowed. */
const REDIRECT_HOSTS = ["l.facebook.com", "lm.facebook.com", "l.instagram.com"];

/** Trailing sentence punctuation is not part of the link ("mira https://instagram.com."). */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

function isAllowedLink(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw);
  } catch {
    return false; // unparseable: not allowed, so the lead is flagged rather than dropped
  }
  const hostname = url.hostname;
  if (REDIRECT_HOSTS.includes(hostname)) return false;
  return ALLOWED_HOSTS.some(
    ({ host, path }) =>
      (hostname === host || hostname.endsWith(`.${host}`)) &&
      (!path || url.pathname === path || url.pathname.startsWith(`${path}/`)),
  );
}

/** Scripts these sites do not serve (they serve Spanish/English). Built with the RegExp
 *  constructor for the same reason as KEYWORD_PATTERNS below. */
const NON_LATIN_SCRIPTS = [
  "Cyrillic",
  "Greek",
  "Han",
  "Hiragana",
  "Katakana",
  "Hangul",
  "Arabic",
  "Hebrew",
  "Devanagari",
  "Thai",
].map((script) => ({ script, re: new RegExp(`\\p{Script=${script}}`, "gu") }));

/** One stray character (the "μ" in "5 μg", an "Ω") is a unit symbol, not a language. */
const MIN_SCRIPT_CHARS = 2;

const KEYWORDS = [
  "seo",
  "backlink",
  "guest post",
  "crypto",
  "bitcoin",
  "casino",
  "viagra",
  "cialis",
  "payday",
  "loan offer",
  "make money",
  "rank higher",
  "web design services",
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A keyword, optionally plural, with no letter or digit on either side. Built with the
 *  RegExp constructor: lookbehind and \p{…} are fine at runtime (this runs server-side)
 *  but newer than some tsconfig targets, which type-check regex literals. */
const KEYWORD_PATTERNS = KEYWORDS.map((keyword) => ({
  keyword,
  re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(keyword)}(?:e?s)?(?![\\p{L}\\p{N}])`, "iu"),
}));

type Submission = {
  /** Honeypot field value: any content means a bot filled a hidden input. */
  honeypot: string;
  /** ms since navigation start at submit (performance.now()), straight from the request body.
   *  Anything that is not a finite number or a numeric string counts as missing. */
  elapsedMs: unknown;
  name: string;
  message: string;
};

const flag = (reason: string): SpamVerdict => ({ action: "flag", reason });

/** The elapsed time as a finite number, or undefined when it is missing. Number("") and
 *  Number(null) are 0, which would read as "instant", so those are screened out first. */
function toElapsedMs(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const countMatches = (re: RegExp, text: string) => (text.match(re) ?? []).length;

export function checkSpam(
  { honeypot, elapsedMs, name, message }: Submission,
  { allowMissingTiming = false }: SpamOptions = {},
): SpamVerdict {
  // --- Silent hard drops ---
  if (honeypot.trim()) return { action: "drop", reason: "honeypot" };

  const elapsed = toElapsedMs(elapsedMs);
  if (elapsed !== undefined) {
    if (elapsed < MIN_ELAPSED_MS) return { action: "drop", reason: "too-fast" };
  } else if (!allowMissingTiming) {
    return { action: "drop", reason: "missing-timing" };
  }

  if (MARKUP_LINK.test(message)) return { action: "drop", reason: "markup-link" };

  const urls = (message.match(URL_PATTERN) ?? []).map((u) => u.replace(TRAILING_PUNCTUATION, ""));
  const unlisted = urls.filter((u) => !isAllowedLink(u)).length;
  if (unlisted >= 3 || (unlisted >= 1 && urls.length >= 4)) {
    return { action: "drop", reason: "many-links" };
  }

  // --- Delivered, flagged. A link outranks a script, which outranks a keyword. ---
  if (unlisted > 0) return flag("link-in-message");
  if (urls.length >= 3) return flag("many-links-listed");

  const text = `${name} ${message}`;
  const script = NON_LATIN_SCRIPTS.find(({ re }) => countMatches(re, text) >= MIN_SCRIPT_CHARS);
  if (script) return flag(`script:${script.script}`);

  const hit = KEYWORD_PATTERNS.find(({ re }) => re.test(text));
  if (hit) return flag(`keyword:${hit.keyword}`);

  return { action: "pass" };
}
