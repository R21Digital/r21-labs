import fs from "node:fs";
import path from "node:path";

/**
 * The logo manifest, read once at build time.
 *
 * Written by `npm run logos`, committed to the repo. Nothing here touches the
 * network — the whole point of committing the images is that what was reviewed
 * is what ships.
 *
 * The manifest exists rather than the components guessing `logos/<slug>.png`,
 * because that guess is wrong: `github.com/<owner>.png` returns JPEG about as
 * often as PNG, so the extension has to be recorded, and the circle/square
 * shape is only knowable from the GitHub API.
 */
export interface LogoRecord {
  file: string;
  shape: "circle" | "square";
  owner: string;
}

const MANIFEST_PATH = path.join(process.cwd(), "public", "logos", "manifest.json");

let cache: Record<string, LogoRecord> | null = null;

function manifest(): Record<string, LogoRecord> {
  if (cache) return cache;
  if (!fs.existsSync(MANIFEST_PATH)) {
    cache = {};
    return cache;
  }

  /**
   * 🔴 Strip a leading BOM before parsing.
   *
   * `JSON.parse` rejects U+FEFF with `Unexpected token '﻿'`, and a BOM is
   * invisible in every editor, in `git diff`, and in the terminal — the file
   * looks perfect and only the runtime disagrees. This build broke exactly that
   * way after the manifest was rewritten from Windows PowerShell, where
   * `Set-Content -Encoding utf8` means *with* BOM.
   *
   * Tolerated rather than merely fixed once, because the file is hand-editable
   * and the next person on Windows will reintroduce it.
   */
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8").replace(/^﻿/, "");
  cache = JSON.parse(raw) as Record<string, LogoRecord>;
  return cache;
}

export function logoFor(slug: string): LogoRecord | null {
  return manifest()[slug] ?? null;
}

/**
 * Initials for the monogram fallback.
 *
 * R21's own builds have no public GitHub owner, so they have no mark. A
 * monogram is honest about that — it is clearly a placeholder shape rather
 * than a pretend logo, and it keeps every card the same height, which is what
 * stops the grid looking broken.
 */
export function monogram(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
