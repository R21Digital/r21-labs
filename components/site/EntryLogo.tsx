import Image from "next/image";

import { logoFor, monogram } from "@/lib/logos";
import type { Entry } from "@/lib/schema";

/**
 * The mark for an entry.
 *
 * 🔴 The single biggest reason the site read as empty before 2026-08-23: every
 * card was text on a dark rectangle, ten times over, with nothing to look at.
 * A directory of software with no product marks cannot be scanned — the eye
 * has no anchor and every row weighs the same.
 *
 * Three cases, in priority order:
 *
 * 1. **R21's own work** (`type: build`) gets the R21 mark, always — even when a
 *    GitHub avatar exists for it. The first version did not special-case this
 *    and rendered **Carlos's personal avatar, twice**, on FTTHelper MCP and
 *    Practice Fusion MCP, because those repos sit under his `CDVolvik` account.
 *    A photograph of the owner is the wrong identity for R21's own software on
 *    R21's own site. Typographic, not a raster: the same call the plan made for
 *    the wordmark, and it scales to any tile size.
 * 2. **A third-party mark** from the committed manifest. Shape carries meaning:
 *    a **circle** is a person (the GitHub owner is a user, so the avatar is an
 *    author's face) and a **rounded square** is an organisation's product mark.
 *    GitHub's own convention; without it a face in a grid of logos looks like a
 *    mistake.
 * 3. **A monogram**, for anything with neither.
 *
 * Dimensions are fixed and explicit at every size so the grid cannot shift
 * while images decode. CLS on this site is 0 and it stays that way.
 */
export default function EntryLogo({ entry, size = 40 }: { entry: Entry; size?: number }) {
  const tile =
    "flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border";

  if (entry.type === "build") {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`${tile} self-start border-[var(--hairline-strong)] bg-surface font-display font-black leading-none tracking-tight`}
      >
        <span style={{ fontSize: Math.round(size * 0.34) }}>
          <span className="text-ink">R</span>
          <span className="text-accent">21</span>
        </span>
      </span>
    );
  }

  const logo = logoFor(entry.slug);

  if (!logo) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`${tile} self-start border-[var(--hairline-strong)] bg-surface font-display font-bold text-ink-dim`}
      >
        <span style={{ fontSize: Math.round(size * 0.36) }}>{monogram(entry.title)}</span>
      </span>
    );
  }

  return (
    <Image
      src={`/logos/${logo.file}`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      // A dark product mark on a near-black canvas disappears into it, so every
      // mark sits on its own light tile. Cheaper and more predictable than
      // per-logo background detection, and it is what makes a row of mismatched
      // avatars look like one set.
      className={`aspect-square shrink-0 self-start bg-white/95 object-contain p-[3px] ${
        logo.shape === "circle" ? "rounded-full" : "rounded-[var(--radius-control)]"
      }`}
      style={{ width: size, height: size }}
    />
  );
}
