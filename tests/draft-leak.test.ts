import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { readEntries } from "@/lib/content";

/**
 * Spec §10 — the draft-leak test.
 *
 * "The whole curation model rests on drafts staying invisible, and that is the
 * assumption most likely to break quietly during a refactor."
 *
 * So this asserts against BUILT OUTPUT, not against the functions. The unit
 * tests in guards.test.ts prove `publishedOnly` filters; this proves the
 * shipped bytes do not contain a draft, which is the claim that actually
 * matters and the only one a route-level mistake cannot fake.
 */

const BUILD_DIR = path.join(process.cwd(), ".next", "server", "app");

function builtTextFiles(): string[] {
  if (!fs.existsSync(BUILD_DIR)) return [];
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) return walk(full);
      // .html today; sitemap.xml and rss.xml arrive in Phase 4 and are picked
      // up automatically — the test grows with the site rather than needing a
      // reminder to extend it.
      return /\.(html|xml|txt)$/.test(item.name) ? [full] : [];
    });
  return walk(BUILD_DIR);
}

describe("draft leak (spec §10)", () => {
  const files = builtTextFiles();

  it("has build output to inspect", () => {
    // Deliberately a FAILURE, not a skip. A skipped test reads green in CI and
    // would make this whole file decorative.
    expect(
      files.length,
      "No build output found — run `npm run build` before `npm test`. " +
        "This test is worthless without it.",
    ).toBeGreaterThan(0);
  });

  it("ships no draft entry in any rendered file", () => {
    const drafts = readEntries().filter((entry) => entry.status !== "published");

    // If nothing is a draft the assertion below is vacuous, and a vacuously
    // passing guard test is how §10's failure hides. Say so.
    expect(
      drafts.length,
      "No draft entries exist, so this test proves nothing. Keep at least one " +
        "draft in content/ while the site has unpublished candidates.",
    ).toBeGreaterThan(0);

    for (const draft of drafts) {
      for (const file of files) {
        const contents = fs.readFileSync(file, "utf8");
        expect(
          contents.includes(draft.title),
          `Draft "${draft.title}" (${draft.filePath}) leaked into ${path.relative(process.cwd(), file)}`,
        ).toBe(false);
      }
    }
  });
});
