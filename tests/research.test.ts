import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPublishedReports,
  readResearchUnguarded,
  reportPath,
  twinOf,
} from "@/lib/research";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "research");
const VALID = path.join(FIXTURES, "valid");
const DRAFT_TWIN = path.join(FIXTURES, "draft-twin");
const ALL_DRAFT = path.join(FIXTURES, "all-draft");
const BAD_SHAPE = path.join(FIXTURES, "bad-shape");
const LANG_MISMATCH = path.join(FIXTURES, "lang-mismatch");
const MISSING = path.join(FIXTURES, "does-not-exist");

describe("research reader", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads a valid bilingual report and returns only the asked language", () => {
    // The valid fixture ships a denylist, so the guard needs the key.
    vi.stubEnv("RESEARCH_DENYLIST_KEY", "test-denylist-key");
    const en = getPublishedReports("en", VALID);
    const es = getPublishedReports("es", VALID);
    expect(en.map((r) => r.slug)).toEqual(["census"]);
    expect(es[0].lang).toBe("es");
    expect(en[0].author).toBe("Carlos Jimenez, R21 Digital");
    expect(en[0].issue).toBe(1);
    expect(en[0].measuredOn).toBe("2026-10-01");
    expect(en[0].dataFiles).toEqual(["data/results.csv", "data/stats.json"]);
    expect(reportPath(en[0])).toBe("/research/census");
    expect(reportPath(es[0])).toBe("/es/research/census");
    expect(twinOf(en[0], readResearchUnguarded(VALID))?.lang).toBe("es");
  });

  it("rejects a file whose name does not match its lang", () => {
    expect(() => readResearchUnguarded(LANG_MISMATCH)).toThrow(/lang/);
  });

  it("throws on a published report without author", () => {
    expect(() => readResearchUnguarded(BAD_SHAPE)).toThrow(/author/);
  });

  it("keeps drafts out of getPublishedReports", () => {
    expect(getPublishedReports("es", ALL_DRAFT)).toEqual([]);
    expect(getPublishedReports("en", ALL_DRAFT)).toEqual([]);
  });

  it("returns drafts from the unguarded reader with their status", () => {
    const raw = readResearchUnguarded(DRAFT_TWIN);
    expect(raw.map((r) => [r.lang, r.status]).sort()).toEqual([
      ["en", "published"],
      ["es", "draft"],
    ]);
  });

  it("returns no reports when the folder does not exist yet", () => {
    expect(readResearchUnguarded(MISSING)).toEqual([]);
    expect(getPublishedReports("en", MISSING)).toEqual([]);
  });
});
