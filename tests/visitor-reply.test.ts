import { describe, it, expect, afterEach } from "vitest";
import { __setTransportForTests, type Outbound } from "../lib/email";
import { sendVisitorReply } from "../lib/visitor-reply";

afterEach(() => __setTransportForTests(null));

function capture() {
  const seen: Outbound[] = [];
  __setTransportForTests(async (mail) => {
    seen.push(mail);
    return { ok: true, id: "t", transport: "log" as const };
  });
  return seen;
}

const contact = {
  kind: "contact" as const,
  name: "Ana Rivera",
  email: "ana@example.com",
  organization: "",
  message: "What do you build?",
};

describe("sendVisitorReply", () => {
  it("sends the composed body when the composer succeeds", async () => {
    const seen = capture();
    await sendVisitorReply(contact, {
      composeImpl: async () => ({ ok: true, subject: "Composed", text: "Composed body." }),
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].subject).toBe("Composed");
    expect(seen[0].to).toBe("ana@example.com");
    expect(seen[0].brand).toBe("R21 Labs");
    expect(seen[0].replyTo).toBe("info@r21digital.com");
    expect(seen[0].html).toContain("<table");
  });

  it("sends the fallback exactly once when the composer fails", async () => {
    const seen = capture();
    await sendVisitorReply(contact, { composeImpl: async () => ({ ok: false }) });
    expect(seen).toHaveLength(1);
    expect(seen[0].text).toContain("Thanks for writing to R21 Labs");
  });

  it("sends the fallback when the composer throws", async () => {
    const seen = capture();
    await sendVisitorReply(contact, {
      composeImpl: async () => {
        throw new Error("network");
      },
    });
    expect(seen).toHaveLength(1);
  });

  it("sends nothing when the submission carries no address", async () => {
    const seen = capture();
    await sendVisitorReply(
      { kind: "suggestion", toolName: "T", toolUrl: "u", replaces: "", why: "w", email: "" },
      { composeImpl: async () => ({ ok: true, subject: "s", text: "t" }) },
    );
    expect(seen).toHaveLength(0);
  });

  // Live test 2026-09-12, right after the subject fix: the composed body said "We've got
  // PLANTED-TOOLNAME-TEST and the link." The reply goes to whatever address was typed, so text
  // the visitor chose must not ride out in it from a verified R21 domain. Asking the model is
  // not a guarantee; this is.
  it("sends the fallback when a composed suggestion reply repeats what the visitor typed", async () => {
    const seen = capture();
    await sendVisitorReply(
      {
        kind: "suggestion",
        toolName: "PLANTED-TOOLNAME-TEST",
        toolUrl: "https://example.com/tool",
        replaces: "",
        why: "w",
        email: "ana@example.com",
      },
      {
        composeImpl: async () => ({
          ok: true,
          subject: "Thanks",
          text: "We've got PLANTED-TOOLNAME-TEST and the link.",
        }),
      },
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].text).not.toContain("PLANTED-TOOLNAME-TEST");
    expect(seen[0].subject).toBe("Thanks for the suggestion — R21 Labs");
  });

  // Same live test: the composed contact subject read "Re: Turning intake submissions into
  // scheduled jobs". This is the first message in the thread; a fake "Re:" is a spam tell.
  it("drops a fake Re: or Fwd: from a composed subject", async () => {
    const seen = capture();
    await sendVisitorReply(contact, {
      composeImpl: async () => ({ ok: true, subject: "Re: Fwd: Turning intake into jobs", text: "Body." }),
    });
    expect(seen[0].subject).toBe("Turning intake into jobs");
  });

  it("never throws, so an after() caller cannot crash", async () => {
    __setTransportForTests(async () => {
      throw new Error("SES down");
    });
    await expect(
      sendVisitorReply(contact, { composeImpl: async () => ({ ok: false }) }),
    ).resolves.toBeUndefined();
  });
});
