import { describe, expect, it } from "vitest";
import path from "node:path";

import { getPublishedEntries, readEntries } from "@/lib/content";
import { checkStaleness, MAX_AGE_DAYS } from "@/lib/guards/staleness";
import { checkAttribution } from "@/lib/guards/attribution";
import { assertNoDrafts, publishedOnly } from "@/lib/guards/published";
import { checkLinks } from "@/lib/guards/links";
import { checkRequiredFields } from "@/lib/guards/required-fields";
import type { Entry } from "@/lib/schema";

const fixture = (name: string) =>
  path.join(process.cwd(), "tests", "fixtures", name);

/** Fixed clock — a test that hardcodes "today" becomes a time bomb. */
const NOW = new Date("2026-08-19T00:00:00Z");

const entry = (over: Partial<Entry> = {}): Entry => ({
  slug: "x",
  filePath: "x.mdx",
  title: "X",
  type: "tool",
  status: "published",
  depth: "showcase",
  body: "",
  ...over,
});

describe("schema validation (spec §10: malformed entry fails loudly)", () => {
  it("accepts a well-formed entry", () => {
    const entries = readEntries(fixture("valid"));
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("Good Tool");
  });

  it("normalizes an unquoted YAML date instead of rejecting it", () => {
    // YAML parses `2026-08-19` into a Date. Quoting must not change behaviour.
    expect(readEntries(fixture("valid"))[0].verifiedOn).toBe("2026-08-19");
  });

  it("throws on a malformed entry, and reports EVERY problem at once", () => {
    let message = "";
    try {
      readEntries(fixture("bad-shape"));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("title");
    expect(message).toContain("depth");
    // 2026-02-31 parses in JS and rolls forward to March — it must not pass.
    expect(message).toContain("verifiedOn");
  });
});

describe("guard 1 — nothing renders unless published", () => {
  it("filters drafts out", () => {
    const kept = publishedOnly([
      entry({ slug: "a", status: "published" }),
      entry({ slug: "b", status: "draft" }),
    ]);
    expect(kept.map((e) => e.slug)).toEqual(["a"]);
  });

  it("throws if a draft reaches render by some other path", () => {
    // The spec §10 failure: someone bypasses publishedOnly in a refactor.
    expect(() =>
      assertNoDrafts([entry({ status: "draft" })], "test"),
    ).toThrowError(/Draft leak/);
  });
});

describe("guard 2 — attribution", () => {
  it("fails a published tool missing source/sourceUrl/license", () => {
    const errors = checkAttribution(readEntries(fixture("unattributed")));
    expect(errors.join(" ")).toMatch(/source/);
    expect(errors.join(" ")).toMatch(/sourceUrl/);
  });

  it("rejects `license: unverified` at publish time", () => {
    const errors = checkAttribution([
      entry({ source: "S", sourceUrl: "https://e.com", license: "unverified" }),
    ]);
    expect(errors.join(" ")).toMatch(/unverified/);
  });

  it("ignores drafts — a draft is allowed to be incomplete", () => {
    expect(checkAttribution([entry({ status: "draft" })])).toEqual([]);
  });

  it("does not demand attribution from a build (R21's own work)", () => {
    expect(
      checkAttribution([entry({ type: "build", verifiedOn: "2026-08-19" })]),
    ).toEqual([]);
  });
});

describe("spec §3 — required fields per type", () => {
  it("accepts a build with liveUrl but no repo (either satisfies)", () => {
    expect(
      checkRequiredFields([
        entry({ type: "build", liveUrl: "https://x.com", stack: "Next", problem: "p" }),
      ]),
    ).toEqual([]);
  });

  it("fails a build with neither repo nor liveUrl", () => {
    expect(
      checkRequiredFields([entry({ type: "build", stack: "Next", problem: "p" })])
        .join(" "),
    ).toMatch(/at least one of/);
  });

  it("fails a stack entry with an EMPTY integrations array", () => {
    // The nasty case: the key is present, so a naive "is it defined" check passes.
    expect(
      checkRequiredFields([entry({ type: "stack", integrations: [] })]).join(" "),
    ).toMatch(/integrations/);
  });

  it("leaves drafts alone — half-written is what draft means", () => {
    expect(checkRequiredFields([entry({ type: "build", status: "draft" })])).toEqual([]);
  });
});

describe("guard 3 — staleness", () => {
  it("fails an entry verified more than six months ago", () => {
    const errors = checkStaleness(readEntries(fixture("stale")), NOW);
    expect(errors.join(" ")).toMatch(new RegExp(`limit ${MAX_AGE_DAYS}`));
  });

  it("fails a published entry with no verifiedOn at all", () => {
    expect(checkStaleness([entry({ verifiedOn: undefined })], NOW).join(" "))
      .toMatch(/needs a real `verifiedOn`/);
  });

  it("rejects a future date — that is a typo, not freshness", () => {
    expect(checkStaleness([entry({ verifiedOn: "2027-01-01" })], NOW).join(" "))
      .toMatch(/FUTURE/);
  });

  it("passes an entry verified today", () => {
    expect(checkStaleness([entry({ verifiedOn: "2026-08-19" })], NOW)).toEqual([]);
  });
});

describe("guard 4 — dead links", () => {
  const ok = async () => new Response(null, { status: 200 });

  it("reports a 404 as dead", async () => {
    const errors = await checkLinks(
      [entry({ sourceUrl: "https://example.com/gone" })],
      { fetchImpl: async () => new Response(null, { status: 404 }) },
    );
    expect(errors.join(" ")).toMatch(/HTTP 404/);
  });

  it("retries with GET when HEAD is rejected, and does not report a live URL", async () => {
    // Plenty of hosts answer 405/403 to HEAD but serve GET fine. Reporting
    // those as dead would train people to disable the guard.
    let calls = 0;
    const errors = await checkLinks(
      [entry({ sourceUrl: "https://example.com/head-hostile" })],
      {
        fetchImpl: async (_url, init) => {
          calls += 1;
          return new Response(null, {
            status: (init as RequestInit)?.method === "HEAD" ? 405 : 200,
          });
        },
      },
    );
    expect(calls).toBe(2);
    expect(errors).toEqual([]);
  });

  it("reports an unreachable host rather than throwing", async () => {
    const errors = await checkLinks(
      [entry({ sourceUrl: "https://example.invalid" })],
      {
        fetchImpl: async () => {
          throw new Error("ENOTFOUND");
        },
      },
    );
    expect(errors.join(" ")).toMatch(/unreachable/);
  });

  it("never touches the network for a draft", async () => {
    let called = false;
    const errors = await checkLinks(
      [entry({ status: "draft", sourceUrl: "https://example.com/x" })],
      {
        fetchImpl: async () => {
          called = true;
          return new Response(null, { status: 200 });
        },
      },
    );
    expect(called).toBe(false);
    expect(errors).toEqual([]);
  });

  it("requests a duplicated URL only once", async () => {
    let calls = 0;
    await checkLinks(
      [
        entry({ slug: "a", filePath: "a.mdx", sourceUrl: "https://example.com/same" }),
        entry({ slug: "b", filePath: "b.mdx", sourceUrl: "https://example.com/same" }),
      ],
      {
        fetchImpl: async () => {
          calls += 1;
          return ok();
        },
      },
    );
    expect(calls).toBe(1);
  });
});

describe("the real content directory", () => {
  // This used to assert ZERO published entries, which was true in Phase 2 and
  // went stale the moment Phase 4 published two. Replaced with invariants that
  // stay true as content grows — a test pinned to a count is a test that has to
  // be edited every time real work happens, and gets disabled instead.
  it("passes every publishing guard", () => {
    expect(() => getPublishedEntries()).not.toThrow();
  });

  it("gives every published entry a verification date", () => {
    for (const entry of getPublishedEntries()) {
      expect(entry.verifiedOn, `${entry.filePath} has no verifiedOn`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
    }
  });

  it("still has at least one draft, so the draft-leak test is not vacuous", () => {
    const drafts = readEntries().filter((entry) => entry.status !== "published");
    expect(drafts.length).toBeGreaterThan(0);
  });
});
