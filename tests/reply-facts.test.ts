import { describe, it, expect } from "vitest";
import { LABS_BRAND, LABS_FACTS, fallbackReply, replyRecipient } from "../lib/reply-facts";
import { renderShell } from "../lib/reply-shell";

describe("replyRecipient", () => {
  it("is the subscriber's address", () => {
    expect(replyRecipient({ kind: "subscribe", email: "a@b.com" })).toBe("a@b.com");
  });

  it("is null for a suggestion with no email — that field is optional", () => {
    expect(
      replyRecipient({
        kind: "suggestion",
        toolName: "t",
        toolUrl: "u",
        replaces: "",
        why: "w",
        email: "",
      }),
    ).toBeNull();
  });

  it("is the enquirer's address on a contact", () => {
    expect(
      replyRecipient({
        kind: "contact",
        name: "A",
        email: "a@b.com",
        organization: "",
        message: "m",
      }),
    ).toBe("a@b.com");
  });
});

describe("fallbackReply", () => {
  it("never promises that a suggested tool will be listed", () => {
    const r = fallbackReply({
      kind: "suggestion",
      toolName: "Thing",
      toolUrl: "u",
      replaces: "",
      why: "w",
      email: "a@b.com",
    });
    expect(r.text).not.toMatch(/we will (add|list|publish|include) it/i);
  });

  it("returns a subject and body for every kind", () => {
    const kinds = [
      { kind: "subscribe", email: "a@b.com" },
      { kind: "suggestion", toolName: "T", toolUrl: "u", replaces: "", why: "w", email: "a@b.com" },
      { kind: "contact", name: "A", email: "a@b.com", organization: "", message: "m" },
    ] as const;
    for (const s of kinds) {
      const r = fallbackReply(s);
      expect(r.subject.length).toBeGreaterThan(0);
      expect(r.text.length).toBeGreaterThan(0);
      expect(r.text).not.toContain("undefined");
    }
  });

  it("names no price in any variant", () => {
    const kinds = [
      { kind: "subscribe", email: "a@b.com" },
      { kind: "suggestion", toolName: "T", toolUrl: "u", replaces: "", why: "w", email: "a@b.com" },
      { kind: "contact", name: "A", email: "a@b.com", organization: "", message: "m" },
    ] as const;
    for (const s of kinds) expect(fallbackReply(s).text).not.toMatch(/\$\s?\d/);
  });
});

describe("LABS_BRAND / LABS_FACTS", () => {
  it("allows no phone number, because R21 Labs publishes none", () => {
    expect(LABS_BRAND.phone).toBeNull();
  });

  it("allows links only to R21's own hosts", () => {
    expect(LABS_BRAND.urlHosts).toEqual(["r21labs.com", "r21digital.com"]);
  });

  it("states the curation rule, which is what stops a reply promising inclusion", () => {
    expect(LABS_FACTS).toMatch(/not a commitment to publish/i);
  });
});

describe("renderShell", () => {
  it("carries a preheader and escapes the body", () => {
    const html = renderShell({ brand: "R21 Labs", preheader: "p", text: "a < b" });
    expect(html).toContain("a &lt; b");
    expect(html).toContain("p");
  });

  it("keeps paragraphs as separate blocks", () => {
    const html = renderShell({ brand: "R21 Labs", preheader: "p", text: "one\n\ntwo" });
    expect(html.match(/<p /g)?.length).toBeGreaterThanOrEqual(2);
  });
});
