/**
 * Aurora wash — the brand's "colour as light, never a flat fill" rule.
 *
 * This is the resolution of the conflict recorded in the plan: the chosen
 * direction bans glowing orbs, particle fields and neon gradients, but permits
 * "one restrained spectral treatment". So the aurora appears in exactly two
 * places on the site — behind the hero trace, and on the chapter-handoff
 * hairline — and nowhere else.
 *
 * CSS radial gradients, NOT canvas and NOT WebGL. LCP is the fleet's weakest
 * point and this site's job is credibility, not spectacle. A shader hero would
 * cost the one thing the page is selling.
 *
 * If it reads as an object rather than as light, the opacity is too high.
 */

export interface AuroraWashProps {
  /** 0–1. Above ~0.25 it stops being light and becomes decoration. */
  intensity?: number;
  className?: string;
}

export function AuroraWash({ intensity = 0.18, className = "" }: AuroraWashProps) {
  return (
    <div
      // Decorative. Nothing here carries meaning, so it is hidden from the
      // accessibility tree and cannot swallow a click.
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity: intensity }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: [
            // Stops widened so the falloff itself does the softening. The blur
            // filter is a top-up, not the mechanism.
            "radial-gradient(85% 65% at 18% 12%, var(--color-aurora-blue) 0%, transparent 78%)",
            "radial-gradient(75% 60% at 62% 4%, var(--color-aurora-violet) 0%, transparent 80%)",
            "radial-gradient(70% 58% at 88% 26%, var(--color-aurora-magenta) 0%, transparent 82%)",
          ].join(","),
          // 16px, under the 20px ceiling in review-animations/STANDARDS.md.
          // This was blur(48px) — 2.4x over — on a full-viewport layer sitting
          // behind the LCP content, on a site whose stated weak point is LCP.
          // Heavy blur is expensive to paint, Safari especially.
          filter: "blur(16px)",
        }}
      />
    </div>
  );
}

export default AuroraWash;
