import AuroraWash from "./AuroraWash";
import Wordmark from "./Wordmark";

/**
 * The loading-screen treatment. Spec §5 wants this reusable across R21 apps, so
 * it imports nothing from lib/ and needs no provider — drop it in with
 * globals.css and it works.
 *
 * Gate result, run through `animate` before writing any of it:
 *
 *   Frequency  — occasional. A visitor sees it once a session; an app user sees
 *                it on cold start. NOT the 100+/day tier, so motion is allowed.
 *   Purpose    — STATE INDICATION. It signals the app is working rather than
 *                frozen. That is why this survives the gate; "it looks cool"
 *                would not have.
 *
 * Ingredients:
 *   Tool       — CSS animation (not transition, not JS). Predetermined motion
 *                that must stay smooth while the page is busy loading runs off
 *                the main thread; a rAF entrance drops frames exactly when this
 *                is on screen.
 *   Properties — transform + opacity only. Starts at scale(0.98), never 0.
 *   Curve      — var(--ease-out), cubic-bezier(0.23, 1, 0.32, 1). Never ease-in
 *                on an entrance: it delays the moment being watched.
 *   Duration   — var(--dur-section) 500ms, 60ms stagger across the three parts.
 *   Reduced    — gentler, not zero: the fade survives, the movement is dropped.
 *
 * DELIBERATELY NOT A LOOP. A spinner or pulse that runs until load completes
 * would be seen on every cold start and is the kind of always-on motion the
 * frequency gate exists to reject. This plays once and settles. If an app needs
 * to indicate a genuinely long load, that belongs in the app, not in the mark.
 */

export interface IntroAnimationProps {
  word?: string;
  /** Full-viewport loading screen, or inline within a page. */
  fullscreen?: boolean;
  className?: string;
}

export function IntroAnimation({
  word = "LABS",
  fullscreen = true,
  className = "",
}: IntroAnimationProps) {
  return (
    <div
      className={[
        "relative isolate grid place-items-center overflow-hidden bg-canvas",
        fullscreen ? "min-h-dvh" : "min-h-[40vh]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <AuroraWash />
      <Wordmark word={word} animated className="relative text-5xl sm:text-6xl" />
    </div>
  );
}

export default IntroAnimation;
