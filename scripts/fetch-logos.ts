/**
 * Fetch each entry's logo ONCE and commit it.
 *
 * Run manually: `npm run logos`. It is deliberately NOT part of `prebuild`.
 *
 * 🔴 The build must never depend on this. Two reasons:
 *
 * 1. A build that fetches images from github.com cannot compile offline, and a
 *    dependency R21 does not control must not be able to block a deploy — the
 *    same reasoning that made the link guard's indeterminate failures
 *    non-fatal (adversarial review 2026-08-20).
 * 2. A fetch that fails mid-build is the silent-fallback trap. R21 has already
 *    shipped 35 live cards in the wrong typeface because a build-time font
 *    fetch lost a race and rendered a plausible substitute with exit code 0.
 *    Logos are committed bytes, so what is reviewed is what ships.
 *
 * Every failure here is LOUD and the file is never written half-formed.
 */
import fs from "node:fs";
import path from "node:path";

import { readEntriesUnguarded } from "../lib/content";
import type { Entry } from "../lib/schema";

const OUT_DIR = path.join(process.cwd(), "public", "logos");

/**
 * A GitHub owner avatar is the mark the project itself publishes, which is why
 * it beats scraping a favicon: it is served at a predictable size, it is what
 * the project uses to identify itself, and it needs no HTML parsing.
 *
 * Entries with no GitHub URL get no file, and the UI falls back to a monogram.
 * That is correct rather than a gap — R21's own builds are the ones without a
 * public repo, and inventing a logo for them would be decoration.
 */
function githubOwner(entry: Entry): string | null {
  const source = entry.sourceUrl ?? entry.repo;
  if (!source) return null;
  return /^https?:\/\/github\.com\/([^/]+)/.exec(source)?.[1] ?? null;
}

/**
 * Is the owner a person or an organisation?
 *
 * Worth one extra request because it decides the SHAPE the mark is rendered in,
 * and getting it wrong looks careless. A grid of product marks with one
 * photograph of a face in it reads as a mistake; the same photograph in a
 * circle reads as an author credit. GitHub itself uses exactly this convention.
 *
 * Unauthenticated and best-effort: on any failure the mark falls back to the
 * org shape, which is the safe default because it is what most entries are.
 */
async function ownerShape(owner: string): Promise<"circle" | "square"> {
  try {
    const response = await fetch(`https://api.github.com/users/${owner}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return "square";
    const data = (await response.json()) as { type?: string };
    return data.type === "User" ? "circle" : "square";
  } catch {
    return "square";
  }
}

/**
 * Identify the image by its MAGIC BYTES and name the file after what it
 * actually is, rather than after what the URL implied.
 *
 * `github.com/<owner>.png` does NOT reliably return a PNG. The first run of
 * this script rejected three avatars whose first bytes were `ffd8ffdb` — JPEG.
 * GitHub serves the stored upload and the `.png` in the path is a route, not a
 * promise about the encoding.
 *
 * Worth keeping the strictness: the check was written to catch an HTML error
 * page saved with an image extension, and on its first run it caught a wrong
 * assumption of mine instead. Both are the same bug — trusting a filename over
 * the bytes. Returning null still fails loudly.
 */
function imageExtension(bytes: Buffer): "png" | "jpg" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = readEntriesUnguarded().filter((e) => e.status === "published");
  let fetched = 0;
  let skipped = 0;
  const failures: string[] = [];
  const noSource: string[] = [];

  /**
   * The manifest is what the UI reads. It exists so a component never has to
   * guess a filename or touch the network: the extension varies (GitHub serves
   * both PNG and JPEG) and the shape is only knowable from the API.
   */
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  const manifest: Record<string, { file: string; shape: "circle" | "square"; owner: string }> =
    fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
      : {};

  for (const entry of entries) {
    /**
     * 🔴 Never fetch a mark for R21's own work.
     *
     * `type: build` renders the typographic R21 mark. Without this skip the
     * script pulled Carlos's `CDVolvik` avatar for FTTHelper MCP and Practice
     * Fusion MCP — his personal photograph, twice, representing R21 software on
     * R21's own site. Deleting the files would not have been enough; the next
     * run would have fetched them straight back.
     */
    if (entry.type === "build") {
      noSource.push(entry.slug);
      delete manifest[entry.slug];
      continue;
    }

    const owner = githubOwner(entry);
    if (!owner) {
      noSource.push(entry.slug);
      delete manifest[entry.slug];
      continue;
    }
    const url = `https://github.com/${owner}.png?size=160`;

    const existing = (["png", "jpg"] as const)
      .map((ext) => `${entry.slug}.${ext}`)
      .find((name) => {
        const file = path.join(OUT_DIR, name);
        return fs.existsSync(file) && fs.statSync(file).size > 0;
      });
    if (existing) {
      // Backfill the manifest for files fetched before it existed.
      if (!manifest[entry.slug]) {
        manifest[entry.slug] = { file: existing, shape: await ownerShape(owner), owner };
      }
      skipped += 1;
      continue;
    }

    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        failures.push(`${entry.slug}: ${url} returned HTTP ${response.status}`);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());

      // Verify before writing, never after. A file that exists is treated as
      // done by the skip check above, so a bad write would be permanent.
      const ext = imageExtension(bytes);
      if (!ext) {
        failures.push(
          `${entry.slug}: ${url} returned neither PNG nor JPEG (first bytes ${bytes.subarray(0, 4).toString("hex")}) — probably an error page`,
        );
        continue;
      }
      if (bytes.length < 256) {
        failures.push(`${entry.slug}: ${url} returned only ${bytes.length} bytes`);
        continue;
      }

      fs.writeFileSync(path.join(OUT_DIR, `${entry.slug}.${ext}`), bytes);
      manifest[entry.slug] = {
        file: `${entry.slug}.${ext}`,
        shape: await ownerShape(owner),
        owner,
      };
      console.log(`  fetched ${entry.slug}.${ext} (${bytes.length} bytes)`);
      fetched += 1;
    } catch (error) {
      failures.push(
        `${entry.slug}: ${url} — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\nlogos: ${fetched} fetched, ${skipped} already present, ${noSource.length} with no GitHub source (monogram fallback: ${noSource.join(", ") || "none"})`,
  );

  if (failures.length > 0) {
    console.error(`\nFAILED (${failures.length}):\n  - ${failures.join("\n  - ")}\n`);
    process.exit(1);
  }
}

await main();
