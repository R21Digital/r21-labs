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
import { checkResearchDenylist, domainTokens } from "@/lib/guards/research-denylist";
import { checkResearchNumbers, figureTokens } from "@/lib/guards/research-numbers";
import { checkResearchPairing } from "@/lib/guards/research-pairing";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "research");
const fixture = (name: string) => path.join(FIXTURES, name);

// sha256("example.org"), the hash in tests/fixtures/research/denylisted.
const EXAMPLE_ORG_HASH = "bfabc37432958b063360d3ad6461c9c4735ae7f8edd46592a5e0f01452b2e4b5";

function runAll(dir: string): string[] {
  const published = readResearchUnguarded(dir).filter((r) => r.status === "published");
  return runResearchGuards(published);
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
    expect(runResearchGuards(readResearchUnguarded(fixture("valid")))).toEqual([]);
    expect(
      runResearchGuards(readResearchUnguarded(fixture("no-method"))).length,
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
  it("hashes the www-stripped form too", () => {
    const errors = checkResearchDenylist(
      [esReport("Visite WWW.Example.org hoy")],
      () => new Set([EXAMPLE_ORG_HASH]),
      () => "",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/denylist/);
  });

  it("checks the title as published text", () => {
    const errors = checkResearchDenylist(
      [esReport("limpio", { title: "Qué pasa en Example.org" })],
      () => new Set([EXAMPLE_ORG_HASH]),
      () => "",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/denylist/);
  });

  it("checks the summary as published text", () => {
    const errors = checkResearchDenylist(
      [esReport("limpio", { summary: "Un resumen que nombra a https://example.org por error." })],
      () => new Set([EXAMPLE_ORG_HASH]),
      () => "",
    );
    expect(errors).toHaveLength(1);
  });

  it("checks the data text (METHOD.md, results.csv) as well", () => {
    const errors = checkResearchDenylist(
      [esReport("limpio")],
      () => new Set([EXAMPLE_ORG_HASH]),
      () => "domain\nexample.org,blocked\n",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/data/);
  });

  it("reads a CRLF denylist and ignores blank lines", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denylist-"));
    fs.mkdirSync(path.join(dir, "data"));
    fs.writeFileSync(path.join(dir, "data", "denylist.sha256"), "aaa\r\n\r\nbbb\r\n");
    expect([...readReportDenylist(esReport("x", { dir }))]).toEqual(["aaa", "bbb"]);
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
});
