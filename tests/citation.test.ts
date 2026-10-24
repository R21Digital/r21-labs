import { describe, expect, it } from "vitest";

import { apaLine, apaParts, bibtexEntry, parseAuthor } from "@/lib/citation";
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

  it("splits the author into person and organization in BibTeX", () => {
    const entry = bibtexEntry(report);
    expect(entry).toContain("author = {Jimenez, Carlos},");
    expect(entry).toContain("organization = {R21 Digital},");
    expect(entry).not.toContain("Carlos Jimenez, R21 Digital");
  });

  it("writes the APA line with the person as Family, I. and the raw title", () => {
    expect(apaLine(report)).toBe(
      "Jimenez, C. (2026, October 5). R&D in AI_crawlers. R21 Labs. https://r21labs.com/research/ai-crawlers",
    );
  });

  it("adds no full stop after a title that ends in ? or !", () => {
    const question = { ...report, title: "How many sites block AI crawlers?" };
    expect(apaLine(question)).toBe(
      "Jimenez, C. (2026, October 5). How many sites block AI crawlers? R21 Labs. https://r21labs.com/research/ai-crawlers",
    );
    expect(apaLine({ ...report, title: "Blocked!" })).toContain("Blocked! R21 Labs.");
    expect(apaLine(question)).not.toContain("?.");
  });

  it("uses a Spanish APA date and the Spanish URL on a Spanish report", () => {
    const es = {
      ...report,
      lang: "es" as const,
      publishedOn: "2026-11-10",
      title: "¿Cuántos sitios bloquean a los bots de IA?",
    };
    expect(apaLine(es)).toBe(
      "Jimenez, C. (2026, 10 de noviembre). ¿Cuántos sitios bloquean a los bots de IA? R21 Labs. https://r21labs.com/es/research/ai-crawlers",
    );
    expect(apaParts(es)).toEqual({
      text: "Jimenez, C. (2026, 10 de noviembre). ¿Cuántos sitios bloquean a los bots de IA? R21 Labs.",
      url: "https://r21labs.com/es/research/ai-crawlers",
    });
  });

  it("parses authors with and without an organization", () => {
    expect(parseAuthor("Carlos Jimenez, R21 Digital")).toEqual({
      family: "Jimenez",
      given: ["Carlos"],
      organization: "R21 Digital",
    });
    expect(parseAuthor("Ana María Rivera")).toEqual({ family: "Rivera", given: ["Ana", "María"] });
    expect(apaLine({ ...report, author: "Ana María Rivera" })).toMatch(/^Rivera, A\. M\. \(2026/);
    expect(bibtexEntry({ ...report, author: "Ana María Rivera" })).not.toContain("organization");
  });
});
