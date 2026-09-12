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

  // Codex 2026-09-12: the reply goes to whatever address was typed, so any visitor-typed
  // text in it is text a stranger chose, sent from a verified R21 domain. The subject is the
  // part a recipient reads without opening -- it carries none.
  it("puts no visitor-typed text in any subject", () => {
    const planted = "BUY-CHEAP-PILLS-NOW";
    const kinds = [
      { kind: "subscribe", email: "a@b.com" },
      { kind: "suggestion", toolName: planted, toolUrl: "u", replaces: "", why: "w", email: "a@b.com" },
      { kind: "contact", name: planted, email: "a@b.com", organization: planted, message: planted },
    ] as const;
    for (const s of kinds) expect(fallbackReply(s).subject).not.toContain(planted);
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
  const KINDS = ["contact", "subscribe", "suggestion"] as const;

  it("carries a preheader and escapes the body", () => {
    const html = renderShell({ kind: "contact", preheader: "p", text: "a < b" });
    expect(html).toContain("a &lt; b");
    expect(html).toContain("p");
  });

  it("keeps paragraphs as separate blocks", () => {
    const html = renderShell({ kind: "contact", preheader: "p", text: "one\n\ntwo" });
    expect(html.match(/<p /g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("is a whole document that declares itself dark, so clients do not re-colour it", () => {
    const html = renderShell({ kind: "contact", preheader: "p", text: "t" });
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<meta name="color-scheme" content="dark">');
    expect(html).toContain("#0a0a14");
  });

  it("labels each kind for what actually happened", () => {
    expect(renderShell({ kind: "contact", preheader: "p", text: "t" })).toContain("Message received");
    expect(renderShell({ kind: "subscribe", preheader: "p", text: "t" })).toContain(
      "Subscription received",
    );
    expect(renderShell({ kind: "suggestion", preheader: "p", text: "t" })).toContain(
      "Suggestion received",
    );
  });

  it("links only to R21's own hosts", () => {
    for (const kind of KINDS) {
      const html = renderShell({ kind, preheader: "p", text: "t" });
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(LABS_BRAND.urlHosts).toContain(new URL(href).hostname.replace(/^www\./, ""));
      }
    }
  });

  it("points a subscriber at the catalog and a suggester at the suggest form", () => {
    expect(renderShell({ kind: "subscribe", preheader: "p", text: "t" })).toContain(
      'href="https://r21labs.com/"',
    );
    expect(renderShell({ kind: "suggestion", preheader: "p", text: "t" })).toContain(
      'href="https://r21labs.com/suggest"',
    );
  });

  // The 2026-09-10 lost lead again, one layer up: a build enquiry pointed at the tool list.
  // A contact reply's only call to action is replying.
  it("gives a contact reply no button — the next step is a reply, not the tool list", () => {
    const html = renderShell({ kind: "contact", preheader: "p", text: "t" });
    expect(html).not.toContain("Browse R21 Labs");
    expect(html).not.toContain("Suggest another tool");
  });
});

// There is no list. An address is emailed to R21 and a person adds it by hand -- the footer's
// subscribe copy was cut back to say so after adversarial review 2026-08-24, and the fallback
// subject went on promising "the list" anyway.
describe("fallbackReply — subscribe", () => {
  it("never tells a subscriber they are on a list", () => {
    const r = fallbackReply({ kind: "subscribe", email: "a@b.com" });
    expect(`${r.subject}\n${r.text}`).not.toMatch(/on the .*list/i);
  });
});

// The composed reply can only know what LABS_FACTS says. Without this fact a model is free
// to write "you're on the list" -- the same promise the fallback above was just cured of.
describe("LABS_FACTS — subscribing", () => {
  it("says an address is added by hand and there is no automated list", () => {
    expect(LABS_FACTS).toMatch(/added by hand/i);
    expect(LABS_FACTS).toMatch(/no automated (mailing )?list/i);
  });
});

// 2026-09-10 live test: asked whether R21 builds a custom internal tool, the composed reply
// said Labs covers "publicly available tools, not custom internal tools" and pointed at the
// tool list -- from a page titled "Work with R21". Every guard passed; the facts never said
// R21 builds software, so the model safely declined the sale. A reply can only say what
// this sheet says, so the sheet is what these tests pin.
describe("LABS_FACTS — build enquiries", () => {
  it("states that R21 builds custom software for clients", () => {
    expect(LABS_FACTS).toMatch(/builds custom software/i);
  });

  it("routes someone who wants something built to a conversation, not the tool list", () => {
    expect(LABS_FACTS).toMatch(/describes something they want built/i);
    expect(LABS_FACTS).toMatch(/scope it/i);
  });
});
