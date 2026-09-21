import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { readEntriesUnguarded } from "@/lib/content";
import { readNotesUnguarded } from "@/lib/notes";

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
      /**
       * 🔴 `.body` and `.rsc`, not just `.html`.
       *
       * This used to read `/\.(html|xml|txt)$/` with a comment promising that
       * "sitemap.xml and rss.xml arrive in Phase 4 and are picked up
       * automatically — the test grows with the site". It does not. Next emits
       * a metadata route as `sitemap.xml.body`, `feed.xml.body`,
       * `llms.txt.body` — the extension is a payload marker, not the served
       * name — so the pattern matched none of them. When those routes shipped
       * on 2026-08-22 the test stayed green while scanning nothing new, which
       * is the precise shape of failure §10 warns about.
       *
       * `.rsc` is the React Server Component payload served on soft
       * navigation. It is rendered content by another name, and a leak there
       * is as real as a leak in HTML.
       */
      return /\.(html|xml|txt|body|rsc)$/.test(item.name) ? [full] : [];
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
    const all = readEntriesUnguarded();
    const drafts = all.filter((entry) => entry.status !== "published");

    // Everything the published entries legitimately say, as one haystack.
    const publishedCorpus = all
      .filter((entry) => entry.status === "published")
      .map((entry) => JSON.stringify(entry))
      .join(" ");

    // If nothing is a draft the assertion below is vacuous, and a vacuously
    // passing guard test is how §10's failure hides. Say so.
    expect(
      drafts.length,
      "No draft entries exist, so this test proves nothing. Keep at least one " +
        "draft in content/ while the site has unpublished candidates.",
    ).toBeGreaterThan(0);

    // Adversarial review 2026-08-20: this checked only draft TITLES, so body
    // text, metadata, or an integration list could leak and still pass. Every
    // distinctive string on a draft is now a marker.
    for (const draft of drafts) {
      const markers: Array<[string, string]> = [
        ["title", draft.title] as [string, string],
        ["slug", draft.slug] as [string, string],
        ...(draft.source ? ([["source", draft.source]] as Array<[string, string]>) : []),
        ...(draft.sourceUrl ? ([["sourceUrl", draft.sourceUrl]] as Array<[string, string]>) : []),
        ...(draft.problem ? ([["problem", draft.problem]] as Array<[string, string]>) : []),
        ...(draft.situation ? ([["situation", draft.situation]] as Array<[string, string]>) : []),
        ...(draft.integrations ?? []).map(
          (value) => ["integration", value] as [string, string],
        ),
        // Opening of the body text.
        ...(draft.body.trim().length >= 8
          ? ([["body", draft.body.trim().slice(0, 60)]] as Array<[string, string]>)
          : []),
      ]
        .filter(([, value]) => value && value.length >= 8)
        // A marker only proves a leak if it is DISTINCTIVE to the draft.
        // Generic technology names are not: the first run flagged "Supabase"
        // in civicapr.html, where it legitimately appears in that PUBLISHED
        // entry's own `stack` field. A substring collision is not a leak, and a
        // test that cries wolf gets deleted. So anything the published corpus
        // already contains is dropped as a marker.
        .filter(([, value]) => !publishedCorpus.includes(value));

      for (const file of files) {
        const contents = fs.readFileSync(file, "utf8");
        for (const [field, marker] of markers) {
          expect(
            contents.includes(marker),
            `Draft "${draft.title}" leaked its ${field} ("${marker}") into ${path.relative(process.cwd(), file)}`,
          ).toBe(false);
        }
      }
    }
  });

  it("ships no draft note in any rendered file", () => {
    const notes = readNotesUnguarded();
    const drafts = notes.filter((note) => note.status !== "published");
    if (drafts.length === 0) return;

    for (const draft of drafts) {
      const markers = [draft.title, draft.slug, draft.summary].filter(
        (value) => value && value.length >= 8,
      );
      for (const file of files) {
        const contents = fs.readFileSync(file, "utf8");
        for (const marker of markers) {
          expect(
            contents.includes(marker),
            `Draft note "${draft.title}" leaked "${marker}" into ${path.relative(process.cwd(), file)}`,
          ).toBe(false);
        }
      }
    }
  });
});
