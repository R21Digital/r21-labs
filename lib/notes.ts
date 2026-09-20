import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { isIsoDate } from "./schema";

/**
 * First-party notes. A different surface from the catalog.
 *
 * Catalog entries are third-party tools with source, licence and a verification
 * date. Notes are R21 writing about tools it actually runs. Mixing the two
 * would let a generated post skip the attribution guard by sitting next to
 * Playwright. So this reader is separate, the files live in `content/notes/`,
 * and `lib/content.ts` never walks that folder.
 *
 * Same choke-point shape as entries: routes call `getPublishedNotes()`. Drafts
 * stay on disk until someone flips `status: published`.
 */

export const NOTES_DIR = path.join(process.cwd(), "content", "notes");

export interface Note {
  slug: string;
  filePath: string;
  title: string;
  status: "draft" | "published";
  publishedOn: string;
  summary: string;
  body: string;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) return walk(full);
    return item.isFile() && full.endsWith(".mdx") ? [full] : [];
  });
}

function validateNote(
  data: Record<string, unknown>,
  filePath: string,
): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`${filePath}: ${msg}`);

  if (typeof data.title !== "string" || data.title.trim() === "") {
    fail("`title` is required and must be a non-empty string");
  }
  if (data.status !== "draft" && data.status !== "published") {
    fail("`status` must be `draft` or `published`");
  }
  if (data.status === "published") {
    if (!isIsoDate(data.publishedOn)) {
      fail("`publishedOn` is required on a published note (YYYY-MM-DD)");
    }
    if (typeof data.summary !== "string" || data.summary.trim().length < 40) {
      fail("`summary` is required on a published note (one sentence, ≥40 chars)");
    }
  }
  return errors;
}

function normalize(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (out.publishedOn instanceof Date && !Number.isNaN(out.publishedOn.getTime())) {
    out.publishedOn = out.publishedOn.toISOString().slice(0, 10);
  }
  return out;
}

/**
 * Raw reader. Returns DRAFTS. Not for routes, sitemaps, feeds, or handlers.
 * tests/boundary.test.ts fails the suite if anything under app/ imports this.
 */
export function readNotesUnguarded(dir: string = NOTES_DIR): Note[] {
  const files = walk(dir);
  const notes: Note[] = [];
  const errors: string[] = [];

  for (const filePath of files) {
    const relative = path.relative(dir, filePath).split(path.sep).join("/");
    const parsed = matter(fs.readFileSync(filePath, "utf8"));
    const data = normalize(parsed.data);
    const shapeErrors = validateNote(data, relative);
    if (shapeErrors.length > 0) {
      errors.push(...shapeErrors);
      continue;
    }
    notes.push({
      slug: path.basename(filePath, ".mdx"),
      filePath: relative,
      title: data.title as string,
      status: data.status as Note["status"],
      publishedOn: (data.publishedOn as string) ?? "",
      summary: (data.summary as string) ?? "",
      body: parsed.content,
    });
  }

  if (errors.length > 0) {
    throw new Error(
      `Note schema validation failed (${errors.length}):\n  - ${errors.join("\n  - ")}`,
    );
  }

  const duplicates = notes
    .map((note) => note.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate note slugs: ${[...new Set(duplicates)].join(", ")}`,
    );
  }

  return notes;
}

export function getPublishedNotes(dir: string = NOTES_DIR): Note[] {
  const published = readNotesUnguarded(dir).filter((note) => note.status === "published");
  const leaked = published.filter((note) => note.status !== "published");
  if (leaked.length > 0) {
    throw new Error(`Draft leak in getPublishedNotes: ${leaked.map((n) => n.filePath).join(", ")}`);
  }
  return [...published].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
}

export function notePath(note: Note): string {
  return `/blog/${note.slug}`;
}
