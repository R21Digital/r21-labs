import type { ReactNode } from "react";

/**
 * Frosted card — the brand's literal card rule: "semi-opaque surface + subtle
 * border" over the dark canvas, so #13131f reads as a surface rather than a
 * flat block.
 *
 * Hairline border rather than a solid one: the chosen direction's structural
 * signature is hard grid lines and minimal shadow, and a hairline does a
 * border's job at lower visual weight.
 *
 * `backdrop-blur` is what makes it frosted rather than merely translucent —
 * it only shows where the card sits over the aurora wash, which is the point.
 */

export interface FrostedCardProps {
  children: ReactNode;
  /** Lift on hover. Gated behind a real pointer inside globals.css. */
  interactive?: boolean;
  className?: string;
}

export function FrostedCard({
  children,
  interactive = false,
  className = "",
}: FrostedCardProps) {
  return (
    <div
      className={[
        "rounded-[var(--radius-card)] border p-5",
        "border-[var(--hairline)] bg-surface/80 backdrop-blur-sm",
        // Low radii and minimal shadow are the direction's rules; the depth
        // comes from the surface and the border, not from a drop shadow.
        interactive ? "hover-lift" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export default FrostedCard;
