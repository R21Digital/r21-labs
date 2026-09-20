import path from "node:path";
import { describe, expect, it } from "vitest";

import { getPublishedNotes, readNotesUnguarded } from "@/lib/notes";

const VALID = path.join(process.cwd(), "tests", "fixtures", "notes", "valid");
const DRAFTS = path.join(process.cwd(), "tests", "fixtures", "notes", "drafts");
const MIXED = path.join(process.cwd(), "tests", "fixtures", "notes");

describe("notes reader", () => {
  it("publishes a complete note", () => {
    const notes = getPublishedNotes(VALID);
    expect(notes).toHaveLength(1);
    expect(notes[0].slug).toBe("published");
    expect(notes[0].title).toBe("A published note");
  });

  it("keeps drafts out of getPublishedNotes", () => {
    const raw = readNotesUnguarded(DRAFTS);
    expect(raw).toHaveLength(1);
    expect(raw[0].status).toBe("draft");
    expect(getPublishedNotes(DRAFTS)).toEqual([]);
  });

  it("does not let a draft in a mixed folder leak", () => {
    const published = getPublishedNotes(MIXED);
    expect(published.map((n) => n.slug)).toEqual(["published"]);
  });
});
