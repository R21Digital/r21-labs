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

  it("never throws, so an after() caller cannot crash", async () => {
    __setTransportForTests(async () => {
      throw new Error("SES down");
    });
    await expect(
      sendVisitorReply(contact, { composeImpl: async () => ({ ok: false }) }),
    ).resolves.toBeUndefined();
  });
});
