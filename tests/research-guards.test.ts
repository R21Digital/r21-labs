import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  readReportDenylist,
  readResearchUnguarded,
  runResearchGuards,
  type Report,
} from "@/lib/research";
import { checkResearchCompleteness } from "@/lib/guards/research-completeness";
import {
  checkResearchDenylist,
  denylistHash,
  domainForms,
  domainTokens,
} from "@/lib/guards/research-denylist";
import { checkResearchNumbers, figureTokens } from "@/lib/guards/research-numbers";
import { checkResearchPairing } from "@/lib/guards/research-pairing";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "research");
const fixture = (name: string) => path.join(FIXTURES, name);

// HMAC-SHA256 of "example.org" under TEST_KEY, the hash in tests/fixtures/research/denylisted.
const TEST_KEY = "test-denylist-key";
const EXAMPLE_ORG_HASH = "84161cf5cda647d229b39c7cd76daab40fc8ba910d700b5ae71e46507abed8b3";
// The key-check line every denylist carries, under TEST_KEY; also in every fixture denylist.
const KEY_CHECK_HASH = "3fb122efee188f9f7ee584f723c4b7765f6880fcef397503ec9b45235da86a15";

function runAll(dir: string): string[] {
  const published = readResearchUnguarded(dir).filter((r) => r.status === "published");
  return runResearchGuards(published, TEST_KEY);
}

function esReport(body: string, overrides: Partial<Report> = {}): Report {
  return {
    slug: "unit",
    dir: FIXTURES,
    filePath: "unit/index.es.mdx",
    lang: "es",
    kind: "measurement",
    title: "Unidad",
    status: "published",
    publishedOn: "2026-10-05",
    summary: "Un resumen de prueba lo bastante largo para pasar la forma.",
    author: "Carlos Jimenez, R21 Digital",
    pair: "index.en.mdx",
    issue: 1,
    measuredOn: "2026-10-01",
    dataFiles: [],
    body,
    ...overrides,
  };
}

describe("research guards, fixtures", () => {
  it("passes the valid measurement fixture", () => {
    expect(runAll(fixture("valid"))).toEqual([]);
  });

  it("fails a measurement without a Method heading", () => {
    const errors = runAll(fixture("no-method"));
    expect(errors).toHaveLength(1);
    expect(errors.join()).toMatch(/Method/);
    expect(errors[0]).toContain("census/index.en.mdx");
  });

  it("fails a figure not in stats", () => {
    const errors = runAll(fixture("stray-number"));
    expect(errors).toHaveLength(1);
    expect(errors.join()).toMatch(/4\.1%/);
  });

  it("fails a denylisted domain even inside a URL with mixed case, without printing it", () => {
    const errors = runAll(fixture("denylisted"));
    expect(errors).toHaveLength(1);
    expect(errors.join()).toMatch(/denylist/);
    expect(errors[0]).toContain("census/index.en.mdx");
    expect(errors.join().toLowerCase()).not.toContain("example.org");
    expect(errors.join()).toContain(EXAMPLE_ORG_HASH.slice(0, 8));
  });

  it("fails a denylisted domain inside downloadable JSON metadata, with clean prose and CSV", () => {
    // stats.json is offered for download, so a domain in its metadata ships
    // as surely as one in the prose. One error per language file.
    const errors = runAll(fixture("denylisted-download"));
    expect(errors).toHaveLength(2);
    for (const error of errors) expect(error).toMatch(/data files/);
    expect(errors.join().toLowerCase()).not.toContain("example.org");
    expect(errors.join()).toContain(EXAMPLE_ORG_HASH.slice(0, 8));
  });

  it("fails a published report whose twin is draft", () => {
    const errors = runAll(fixture("draft-twin"));
    expect(errors).toHaveLength(1);
    expect(errors.join()).toMatch(/twin/);
  });

  it("fails a pair whose measuredOn differs", () => {
    const errors = runAll(fixture("mismatched-pair"));
    expect(errors).toHaveLength(1);
    expect(errors.join()).toMatch(/measuredOn/);
  });

  it("passes a field note with sourced figures", () => {
    expect(runAll(fixture("field-note-valid"))).toEqual([]);
  });

  it("fails a field note with an unsourced figure", () => {
    const errors = runAll(fixture("field-note-unsourced"));
    expect(errors).toHaveLength(1);
    expect(errors.join()).toMatch(/40%/);
    expect(errors[0]).toContain("note/index.en.mdx");
  });

  it("runResearchGuards concatenates the four guards", () => {
    expect(runResearchGuards(readResearchUnguarded(fixture("valid")), TEST_KEY)).toEqual([]);
    expect(
      runResearchGuards(readResearchUnguarded(fixture("no-method")), TEST_KEY).length,
    ).toBeGreaterThan(0);
  });
});

describe("figureTokens", () => {
  it("ignores years, dates and issue numbers", () => {
    expect(figureTokens("In 2026, on 2026-10-22, issue 1: n = 246 and 3.3%")).toEqual([
      "n = 246",
      "3.3%",
    ]);
  });

  it("ignores Spanish edición numbers", () => {
    expect(figureTokens("Edición 3, n = 12 y 4,5 %")).toEqual(["n = 12", "4,5 %"]);
  });

  it("reads an emphasised n as one count token", () => {
    expect(figureTokens("*n* = 412")).toHaveLength(1);
    expect(figureTokens("Muestra _n_ = 412 y **n** = 5")).toHaveLength(2);
  });

  it("reports a range as one token, with en dash or hyphen", () => {
    expect(figureTokens("Between 1.7–6.3% of sites")).toEqual(["1.7–6.3%"]);
    expect(figureTokens("Between 1.7-6.3% of sites")).toEqual(["1.7-6.3%"]);
  });

  it("does not swallow a trailing comma or full stop into a count", () => {
    expect(figureTokens("We sampled n = 246, then n = 1,234.")).toEqual([
      "n = 246",
      "n = 1,234",
    ]);
  });
});

describe("checkResearchNumbers", () => {
  it("accepts a Spanish decimal comma for an English label", () => {
    expect(
      checkResearchNumbers([esReport("Solo 3,3 % bloquean")], () => ({ labels: ["3.3%"] })),
    ).toEqual([]);
  });

  it("accepts spacing and thousands-separator variants of a count", () => {
    const stats = () => ({ labels: ["n = 1234"] });
    expect(checkResearchNumbers([esReport("Muestra n=1,234 sitios")], stats)).toEqual([]);
    expect(checkResearchNumbers([esReport("Muestra n = 1.234 sitios")], stats)).toEqual([]);
  });

  it("matches a hyphen range against an en dash label", () => {
    expect(
      checkResearchNumbers([esReport("Entre 1,7-6,3 % de los sitios")], () => ({
        labels: ["1.7–6.3%"],
      })),
    ).toEqual([]);
  });

  it("does not also report the trailing percent of a range", () => {
    const errors = checkResearchNumbers([esReport("Entre 1.7–6.3% de sitios")], () => ({
      labels: [],
    }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("1.7–6.3%");
  });

  it("fails a figure that appears only in the summary", () => {
    const errors = checkResearchNumbers(
      [esReport("limpio", { summary: "Bloqueado: 9,9 % de los sitios en la muestra de prueba." })],
      () => ({ labels: ["3.3%"] }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("9,9 %");
  });

  it("fails an italic n count that is not in stats", () => {
    const errors = checkResearchNumbers([esReport("Muestra *n* = 999 sitios")], () => ({
      labels: ["n = 412"],
    }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("999");
  });

  it("accepts an emphasised n that matches a label", () => {
    const stats = () => ({ labels: ["n = 412"] });
    expect(checkResearchNumbers([esReport("Muestra _n_ = 412 sitios")], stats)).toEqual([]);
    expect(checkResearchNumbers([esReport("Muestra **n** = 412 sitios")], stats)).toEqual([]);
  });

  it("fails a measurement that has no stats file", () => {
    const errors = checkResearchNumbers([esReport("Solo 3,3 % bloquean")], () => null);
    expect(errors.join()).toMatch(/stats\.json/);
  });
});

describe("domainTokens", () => {
  it("lowercases and extracts hostnames from URLs and bare domains", () => {
    expect(domainTokens("see https://Example.com/x and www.example.com")).toEqual([
      "example.com",
      "www.example.com",
    ]);
  });
});

describe("checkResearchDenylist", () => {
  // A non-empty denylist carries the key-check line, as make_denylist.py writes it.
  const deny = (...hashes: string[]) => () => ({
    hashes: new Set(hashes.length > 0 ? [KEY_CHECK_HASH, ...hashes] : []),
    malformedLines: [],
  });
  const shipsCsv = { dataFiles: ["data/results.csv", "data/stats.json"] };

  it("hashes the www-stripped form too", () => {
    const errors = checkResearchDenylist(
      [esReport("Visite WWW.Example.org hoy")],
      deny(EXAMPLE_ORG_HASH),
      () => "",
      TEST_KEY,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/denylist/);
  });

  it("catches a subdomain of a denylisted domain in the prose", () => {
    const errors = checkResearchDenylist(
      [esReport("Compre en https://shop.Example.org/ofertas hoy")],
      deny(EXAMPLE_ORG_HASH),
      () => "",
      TEST_KEY,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/in the text/);
    expect(errors[0]).toContain(EXAMPLE_ORG_HASH.slice(0, 8));
    expect(errors[0].toLowerCase()).not.toContain("example.org");
  });

  it("catches a deeper subdomain in a downloadable data file", () => {
    const errors = checkResearchDenylist(
      [esReport("limpio")],
      deny(EXAMPLE_ORG_HASH),
      () => '{"labels": [], "note": "see a.shop.example.org"}',
      TEST_KEY,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/data files/);
  });

  it("does not treat a bare public suffix as a parent domain", () => {
    expect(domainForms("a.shop.example.org")).toEqual([
      "a.shop.example.org",
      "shop.example.org",
      "example.org",
    ]);
    expect(domainForms("www.example.org")).toEqual(["www.example.org", "example.org"]);
  });

  it("checks the title as published text", () => {
    const errors = checkResearchDenylist(
      [esReport("limpio", { title: "Qué pasa en Example.org" })],
      deny(EXAMPLE_ORG_HASH),
      () => "",
      TEST_KEY,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/denylist/);
  });

  it("checks the summary as published text", () => {
    const errors = checkResearchDenylist(
      [esReport("limpio", { summary: "Un resumen que nombra a https://example.org por error." })],
      deny(EXAMPLE_ORG_HASH),
      () => "",
      TEST_KEY,
    );
    expect(errors).toHaveLength(1);
  });

  it("checks the data text (METHOD.md, results.csv) as well", () => {
    const errors = checkResearchDenylist(
      [esReport("limpio")],
      deny(EXAMPLE_ORG_HASH),
      () => "domain\nexample.org,blocked\n",
      TEST_KEY,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/data/);
  });

  it("fails a published measurement that ships results.csv with no denylist", () => {
    const errors = checkResearchDenylist([esReport("limpio", shipsCsv)], deny(), () => "", TEST_KEY);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/denylist\.sha256 is missing or empty/);
  });

  it("fails a missing denylist file read from disk", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denylist-"));
    const report = esReport("limpio", { ...shipsCsv, dir });
    const errors = checkResearchDenylist([report], readReportDenylist, () => "", TEST_KEY);
    expect(errors.join()).toMatch(/missing or empty/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does not ask a field note or a report without results.csv for a denylist", () => {
    expect(
      checkResearchDenylist([esReport("limpio", { ...shipsCsv, kind: "field-note" })], deny(), () => "", TEST_KEY),
    ).toEqual([]);
    expect(checkResearchDenylist([esReport("limpio")], deny(), () => "", TEST_KEY)).toEqual([]);
  });

  it("fails a malformed denylist line by line number, without printing the line", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denylist-"));
    fs.mkdirSync(path.join(dir, "data"));
    fs.writeFileSync(
      path.join(dir, "data", "denylist.sha256"),
      `${KEY_CHECK_HASH}\n${EXAMPLE_ORG_HASH}\nexample.org\n${EXAMPLE_ORG_HASH.toUpperCase()}\n`,
    );
    const report = esReport("limpio", { ...shipsCsv, dir });
    const errors = checkResearchDenylist([report], readReportDenylist, () => "", TEST_KEY);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/lines 3, 4 are not an HMAC-SHA256/);
    expect(errors[0].toLowerCase()).not.toContain("example.org");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fails closed when the key is missing, without hashing anything", () => {
    for (const key of [undefined, ""]) {
      const errors = checkResearchDenylist(
        [esReport("Visite example.org")],
        deny(EXAMPLE_ORG_HASH),
        () => "",
        key,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/RESEARCH_DENYLIST_KEY is not set/);
    }
  });

  it("fails a wrong key instead of passing a check that matches nothing", () => {
    const errors = checkResearchDenylist(
      [esReport("Visite example.org")],
      deny(EXAMPLE_ORG_HASH),
      () => "",
      "not-the-key",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/RESEARCH_DENYLIST_KEY is not the key/);
    expect(errors[0]).not.toContain("not-the-key");
  });

  it("fails a denylist that has no key-check line", () => {
    const errors = checkResearchDenylist(
      [esReport("limpio")],
      () => ({ hashes: new Set([EXAMPLE_ORG_HASH]), malformedLines: [] }),
      () => "",
      TEST_KEY,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/RESEARCH_DENYLIST_KEY is not the key/);
  });

  it("uses the HMAC of the check label under TEST_KEY as the fixtures' key-check line", () => {
    expect(denylistHash(TEST_KEY, "r21-labs-denylist-key-check")).toBe(KEY_CHECK_HASH);
  });

  it("does not match a plain SHA-256 of the domain", () => {
    const plain = "bfabc37432958b063360d3ad6461c9c4735ae7f8edd46592a5e0f01452b2e4b5";
    expect(
      checkResearchDenylist([esReport("Visite example.org")], deny(plain), () => "", TEST_KEY),
    ).toEqual([]);
  });

  it("passes a valid CRLF denylist and ignores blank lines", () => {
    const other = "a".repeat(64);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denylist-"));
    fs.mkdirSync(path.join(dir, "data"));
    fs.writeFileSync(
      path.join(dir, "data", "denylist.sha256"),
      `${KEY_CHECK_HASH}\r\n${EXAMPLE_ORG_HASH}\r\n\r\n  ${other} \r\n`,
    );
    const report = esReport("limpio", { ...shipsCsv, dir });
    const denylist = readReportDenylist(report);
    expect([...denylist.hashes]).toEqual([KEY_CHECK_HASH, EXAMPLE_ORG_HASH, other]);
    expect(denylist.malformedLines).toEqual([]);
    expect(checkResearchDenylist([report], readReportDenylist, () => "", TEST_KEY)).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("checkResearchCompleteness", () => {
  const withFiles = (dataFiles: string[]) =>
    esReport("## Método\n", { dir: path.join(FIXTURES, "valid", "census"), dataFiles });

  it("passes when every data file exists", () => {
    expect(checkResearchCompleteness([withFiles(["data/stats.json"])])).toEqual([]);
  });

  it("fails a missing, escaping or absolute data file", () => {
    const missing = checkResearchCompleteness([withFiles(["data/nope.csv"])]);
    const escaping = checkResearchCompleteness([withFiles(["../../no-method/census/data/stats.json"])]);
    const absolute = checkResearchCompleteness([
      withFiles([path.join(FIXTURES, "valid", "census", "data", "stats.json")]),
    ]);
    expect(missing.join()).toMatch(/does not exist/);
    expect(escaping.join()).toMatch(/outside/);
    expect(absolute.join()).toMatch(/absolute/);
  });

  it("fails a sampleSize that differs from the top-level n in stats.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sample-size-"));
    fs.mkdirSync(path.join(dir, "data"));
    fs.writeFileSync(path.join(dir, "data", "stats.json"), JSON.stringify({ n: 246, labels: [] }));
    const report = (sampleSize?: number) => esReport("## Método\n", { dir, sampleSize });

    expect(checkResearchCompleteness([report(246)])).toEqual([]);
    expect(checkResearchCompleteness([report(245)]).join()).toMatch(/sampleSize.*n = 246/);
    expect(checkResearchCompleteness([report()]).join()).toMatch(/sampleSize/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does not ask for a sampleSize when stats.json has no top-level n", () => {
    expect(checkResearchCompleteness([withFiles(["data/stats.json"])])).toEqual([]);
  });

  it("requires Sources / Fuentes on a field note", () => {
    const errors = checkResearchCompleteness([esReport("sin fuentes", { kind: "field-note" })]);
    expect(errors.join()).toMatch(/Fuentes/);
  });
});

describe("checkResearchPairing", () => {
  it("fails when `pair` names the wrong file", () => {
    const all = readResearchUnguarded(fixture("valid"));
    const broken = all.map((r) => (r.lang === "en" ? { ...r, pair: "index.fr.mdx" } : r));
    expect(checkResearchPairing(broken).join()).toMatch(/pair/);
  });

  it("fails a pair whose dataFiles differ, and passes when they match", () => {
    const all = readResearchUnguarded(fixture("valid"));
    expect(checkResearchPairing(all)).toEqual([]);
    const broken = all.map((r) =>
      r.lang === "es" ? { ...r, dataFiles: [...r.dataFiles, "data/METHOD.md"] } : r,
    );
    const errors = checkResearchPairing(broken);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/`dataFiles` differs/);
  });
});
