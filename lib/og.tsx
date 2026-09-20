import { ImageResponse } from "next/og";

/**
 * The shared OpenGraph card.
 *
 * 🔴 NO WEBFONT IS LOADED HERE, and that is a decision rather than an omission.
 *
 * Satori cannot read woff2, so using Montserrat would mean fetching a TTF over
 * the network at build time from a URL Google does not guarantee. When that
 * fetch fails, `ImageResponse` does not error — it renders the same card in a
 * fallback face. The image is valid, the build is green, and the card is
 * silently off-brand.
 *
 * R21 has already paid for that exact failure: on 2026-08-20 a screenshot job
 * beat its Google Fonts fetch and shipped 35 live cards in the wrong typeface,
 * valid PNGs, exit code 0, reviewed by eye without anyone catching it. The
 * lesson recorded from it was to remove the dependency and byte-compare.
 * So the dependency is removed.
 *
 * The brand still reads without Montserrat, because on this card the brand is
 * carried by colour and structure: the `#0a0a14` canvas, the single `#E94560`
 * accent, the aurora used as light rather than fill, and the hairline grid.
 *
 * Upgrade path, if the typeface matters more than the risk: commit a Montserrat
 * TTF into the repo (it is OFL, so redistribution is permitted) and read it
 * from disk. That removes the network entirely rather than trading one remote
 * source for another. Recorded as a known limit in the README.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const CANVAS = "#0a0a14";
const ACCENT = "#e94560";
const INK = "#ffffff";
const INK_MUTED = "#9aa0b4";
const INK_DIM = "#9aa0b4";
const HAIRLINE = "rgba(255,255,255,0.10)";

export interface OgCard {
  /** Small mono label above the title — the entry type, or the site tagline. */
  eyebrow: string;
  title: string;
  /** One supporting line. Truncated by the caller if it needs to be. */
  subtitle?: string;
  /** Bottom-right metadata, e.g. "verified 2026-08-22". */
  meta?: string;
}

export function ogImage({ eyebrow, title, subtitle, meta }: OgCard): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CANVAS,
          padding: 72,
          position: "relative",
        }}
      >
        {/* Aurora as light, not as an object — the one restrained spectral
            treatment the direction permits.

            Tuned by looking at the rendered PNG rather than by matching the
            site's number. The hero wash sits at 0.16 over a full viewport with
            type and a system trace in front of it; at 1200×630 with the same
            value the card rendered as flat near-black and the brand's only
            spectral signature was gone. Light needs a shorter throw and more
            of it to survive at this size. Blur is deliberately absent — Satori
            does not support `filter`, and asking for one silently does
            nothing, which is how the site's value got copied here in the first
            place. */}
        <div
          style={{
            position: "absolute",
            // 🔴 EXPLICIT top/left/width/height, not `inset: 0`.
            //
            // Satori does not resolve the `inset` shorthand. With `inset: 0`
            // this layer got no box, painted nothing, and the card rendered
            // flat near-black — with no error, no warning, and a perfectly
            // valid PNG. Changing the opacity from 0.17 to 0.32 produced a
            // BYTE-IDENTICAL file, which is the only reason it was caught:
            // an unchanged hash after a deliberate change means the change was
            // never applied. Deleting .next and rebuilding gave the same hash
            // again, ruling out caching.
            top: 0,
            left: 0,
            width: OG_SIZE.width,
            height: OG_SIZE.height,
            display: "flex",
            background:
              "radial-gradient(105% 85% at 5% -15%, #3b82f6 0%, transparent 62%), radial-gradient(95% 80% at 48% -20%, #7c3aed 0%, transparent 64%), radial-gradient(95% 90% at 100% 8%, #e94560 0%, transparent 66%)",
            opacity: 0.32,
          }}
        />

        {/* Wordmark: [R][accent 21][LABS] — the identity's structure, which
            survives the loss of the typeface because the structure IS the mark. */}
        <div style={{ display: "flex", alignItems: "baseline", position: "relative" }}>
          <span style={{ color: INK, fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            R
          </span>
          <span style={{ color: ACCENT, fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            21
          </span>
          <span
            style={{
              color: INK,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 5,
              marginLeft: 12,
            }}
          >
            LABS
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <div
            style={{
              color: INK_DIM,
              fontSize: 20,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              color: INK,
              // Long entry titles must not overflow the card; step the size
              // down rather than clipping, which is what a fixed size does.
              fontSize: title.length > 46 ? 58 : 74,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                color: INK_MUTED,
                fontSize: 26,
                lineHeight: 1.4,
                marginTop: 22,
                maxWidth: 900,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {/* The accent hairline — the chapter-handoff rule, reused as the card's
            base rule so the share image and the site share a signature. */}
        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", height: 2, background: ACCENT, width: 120 }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: `1px solid ${HAIRLINE}`,
              marginTop: 22,
              paddingTop: 22,
            }}
          >
            <span style={{ color: INK_DIM, fontSize: 20, letterSpacing: 1 }}>
              r21labs.com
            </span>
            {meta ? (
              <span style={{ color: INK_DIM, fontSize: 20, letterSpacing: 1 }}>{meta}</span>
            ) : null}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
