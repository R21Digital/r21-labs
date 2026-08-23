import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";
import { getPublishedEntries } from "@/lib/content";
import { isStale } from "@/lib/guards/staleness";

export const alt = "R21 Labs — the tools we build and run on";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * The site-level share card.
 *
 * The count is a `count()` over published content, matching the homepage stat
 * row rather than restating a number. A share card that advertises "18 entries"
 * while the site shows 11 is the same class of defect as the client site that
 * advertised 8 cemeteries while serving 130 — and a share card is the copy that
 * gets cached longest by everyone who scrapes it.
 */
export default function Image() {
  const fresh = getPublishedEntries().filter((entry) => !isStale(entry));

  return ogImage({
    eyebrow: "R21 Digital",
    title: "We build the tools we run on.",
    subtitle:
      "Tools we tested, software we built, and the playbooks that tie them together. Every entry says where it came from and when we last checked it.",
    meta: `${fresh.length} verified ${fresh.length === 1 ? "entry" : "entries"}`,
  });
}
