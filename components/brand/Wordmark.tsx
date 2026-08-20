/**
 * R21 Labs wordmark.
 *
 * TYPOGRAPHIC, not the PNG, and that is deliberate. Spec §1 goal 1 wants this
 * reusable as a wordmark on app loading screens — a raster does not scale to
 * arbitrary loading-screen sizes, and `clients/r21/Logos/` ships no SVG.
 *
 * The existing identity's structure is [R] + [accent 21] + [word]: the white
 * horizontal lockup reads white "R", accent "21", white "DIGITAL". "LABS"
 * takes the slot "DIGITAL" occupies, so this is the same mark with the right
 * word rather than a new one.
 *
 * 🔴 Note on the white-chip rule: `brand-r21` says the wordmark is
 * navy-on-transparent and must sit on a white chip over dark. That applies to
 * the NAVY asset. `R21Digital_white_horizontal.png` exists and works directly
 * on #0a0a14 — and this typographic version sidesteps the question entirely.
 * A white chip on a near-black canvas is a bright rectangle fighting the
 * design; avoid it where a white or typographic mark will do.
 *
 * Depends on nothing but CSS custom properties. Drop it into any R21 app.
 */

export interface WordmarkProps {
  /** The word after "R21". "LABS" here; "DIGITAL" on the agency site. */
  word?: string;
  /** Staggered entrance. Off by default — a mark that animates everywhere is noise. */
  animated?: boolean;
  className?: string;
}

/** 30–80ms is the sanctioned stagger band; everything arriving at once is a block. */
const STAGGER_MS = 60;

export function Wordmark({
  word = "LABS",
  animated = false,
  className = "",
}: WordmarkProps) {
  const part = (index: number) =>
    animated
      ? { className: "reveal", style: { animationDelay: `${index * STAGGER_MS}ms` } }
      : {};

  return (
    <span
      className={`inline-flex items-baseline font-display font-black tracking-tight ${className}`}
      // One accessible name for the whole lockup — a screen reader should hear
      // "R21 LABS", not three fragments.
      role="img"
      aria-label={`R21 ${word}`}
    >
      <span aria-hidden="true" className="text-ink" {...part(0)}>
        R
      </span>
      <span aria-hidden="true" className="text-accent" {...part(1)}>
        21
      </span>
      <span
        aria-hidden="true"
        className="ml-[0.35em] font-semibold tracking-[0.18em] text-ink"
        {...part(2)}
      >
        {word}
      </span>
    </span>
  );
}

export default Wordmark;
