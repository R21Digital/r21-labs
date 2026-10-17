import { describe, expect, it } from "vitest";

import { relatedPages, relatedPool } from "@/lib/related";

/**
 * "Keep reading" under every entry and note (lib/related.ts).
 *
 * The real-content block is the reason the feature exists: on 2026-10-16 the
 * site's only note had no inbound link from any other page and sat unindexed.
 */

describe("relatedPages against the published content", () => {
  const pool = relatedPool();

  it("has entries and at least one note in the pool", () => {
    expect(pool.some((p) => p.path.startsWith("/blog/"))).toBe(true);
    expect(pool.some((p) => !p.path.startsWith("/blog/"))).toBe(true);
  });

  it("keys every page on a unique path", () => {
    const paths = pool.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every page three other pages, never itself, never twice", () => {
    for (const page of pool) {
      const picks = relatedPages(page, pool);
      expect(picks).toHaveLength(Math.min(3, pool.length - 1));
      expect(picks.some((p) => p.path === page.path)).toBe(false);
      expect(new Set(picks.map((p) => p.path)).size).toBe(picks.length);
    }
  });

  it("links every page from at least one other page", () => {
    const linked = new Set(pool.flatMap((page) => relatedPages(page, pool).map((p) => p.path)));
    expect(pool.filter((p) => !linked.has(p.path)).map((p) => p.path)).toEqual([]);
  });
});

describe("relatedPages rules", () => {
  const page = (path: string, date: string, tags: string[]) => ({ path, date, tags });

  it("prefers a shared tag, ignoring case", () => {
    const all = [
      page("/tools/a", "2026-10-01", ["MCP"]),
      page("/tools/b", "2026-09-01", ["mcp"]),
      page("/tools/c", "2026-10-02", ["tool"]),
      page("/tools/d", "2026-08-01", ["tool"]),
    ];
    expect(relatedPages(all[0], all)[0].path).toBe("/tools/b");
  });

  it("treats the same slug in two folders as two pages", () => {
    const all = [
      page("/tools/x", "2026-10-01", ["tool"]),
      page("/builds/x", "2026-09-01", ["tool"]),
    ];
    expect(relatedPages(all[0], all).map((p) => p.path)).toEqual(["/builds/x"]);
  });

  it("returns nothing for a pool of one", () => {
    const only = page("/blog/a", "2026-10-01", ["note"]);
    expect(relatedPages(only, [only])).toEqual([]);
  });

  it("never links a page missing from the pool to itself", () => {
    const all = [page("/tools/a", "2026-10-01", ["tool"]), page("/tools/b", "2026-09-01", ["tool"])];
    const ghost = page("/tools/ghost", "2026-10-02", ["tool"]);
    const picks = relatedPages(ghost, all);
    expect(picks.some((p) => p.path === ghost.path)).toBe(false);
    expect(picks.length).toBeLessThanOrEqual(all.length);
  });
});
