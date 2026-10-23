import { describe, expect, it } from "vitest";

import { apaLine, bibtexEntry } from "@/lib/citation";
import type { Report } from "@/lib/research";

const report: Report = {
  slug: "ai-crawlers",
  dir: "/unused",
  filePath: "ai-crawlers/index.en.mdx",
  lang: "en",
  kind: "measurement",
  title: "R&D in AI_crawlers",
  status: "published",
  publishedOn: "2026-10-05",
  summary: "A fixture report used to test the citation text for special characters.",
  author: "Carlos Jimenez, R21 Digital",
  pair: "index.es.mdx",
  issue: 1,
  measuredOn: "2026-10-01",
  dataFiles: [],
  body: "",
};

describe("citation text", () => {
  it("escapes BibTeX special characters in the title", () => {
    const entry = bibtexEntry(report);
    expect(entry).toContain("title = {R\\&D in AI\\_crawlers},");
    expect(entry).not.toContain("title = {R&D");
  });

  it("leaves the URL and the entry key alone", () => {
    const entry = bibtexEntry(report);
    expect(entry).toContain("@misc{r21labs_ai-crawlers_en,");
    expect(entry).toContain("url = {https://r21labs.com/research/ai-crawlers}");
    expect(entry).toContain("year = {2026},");
    expect(entry).toContain("month = oct,");
  });

  it("writes the APA line with the raw title and the Spanish URL for a Spanish report", () => {
    expect(apaLine(report)).toBe(
      "Carlos Jimenez, R21 Digital (2026, October 5). R&D in AI_crawlers. R21 Labs. https://r21labs.com/research/ai-crawlers",
    );
    expect(apaLine({ ...report, lang: "es" })).toContain(
      "https://r21labs.com/es/research/ai-crawlers",
    );
  });
});
