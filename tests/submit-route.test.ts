import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The submit route, end to end, with the network swapped out.
 *
 * Each submission is handed to two channels at once: the SES email to R21 and a card in the
 * "Leads - R21 Digital" WhatsApp group. A lead counts as captured when EITHER reaches us.
 * Neither reaching us is a 503, because R21 has shipped forms that thanked people for
 * messages nobody received. Everything below pins one side of that rule.
 *
 * Nothing here can reach green-api or Amazon: `sendWhatsApp` is mocked, and the email
 * transport is replaced through `__setTransportForTests`.
 */

const { afterQueue, sendWhatsApp, sendVisitorReply } = vi.hoisted(() => ({
  afterQueue: [] as Array<() => Promise<void> | void>,
  sendWhatsApp: vi.fn(),
  sendVisitorReply: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  // `after()` only works inside a request scope. Queue the callback so a test can run it.
  return { ...actual, after: (fn: () => Promise<void> | void) => void afterQueue.push(fn) };
});
vi.mock("@/lib/whatsapp", () => ({ sendWhatsApp }));
vi.mock("@/lib/visitor-reply", () => ({ sendVisitorReply }));

import { POST } from "@/app/api/submit/route";
import { __setTransportForTests, type Outbound } from "@/lib/email";
import { card, emailField, field } from "@/lib/lead-card";

const contact = {
  kind: "contact",
  name: "Ana Rivera",
  email: "ana@example.com",
  organization: "Rivera Dental",
  message: "What do you build?\nCan you help with our booking flow?",
};

function post(body: unknown, init?: { form?: boolean }): Request {
  if (init?.form) {
    return new Request("https://r21labs.com/api/submit", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        referer: "https://r21labs.com/contact",
      },
      body: new URLSearchParams(body as Record<string, string>).toString(),
    });
  }
  return new Request("https://r21labs.com/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function emailSucceeds() {
  const seen: Outbound[] = [];
  __setTransportForTests(async (mail) => {
    seen.push(mail);
    return { ok: true, id: "ses-1", transport: "ses" as const };
  });
  return seen;
}

function emailFails() {
  __setTransportForTests(async () => ({ ok: false, error: "SES down" }));
}

beforeEach(() => {
  afterQueue.length = 0;
  sendWhatsApp.mockReset();
  sendVisitorReply.mockReset();
  sendWhatsApp.mockResolvedValue({ ok: true, id: "wa-1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  __setTransportForTests(null);
  vi.restoreAllMocks();
});

describe("a valid submission", () => {
  it("emails R21 and pushes exactly one WhatsApp card built with the shared lead card", async () => {
    const seen = emailSucceeds();
    const res = await POST(post(contact));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(seen).toHaveLength(1);
    expect(sendWhatsApp).toHaveBeenCalledTimes(1);

    const card = sendWhatsApp.mock.calls[0][0] as string;
    expect(card).toContain("R21 Labs");
    expect(card).toContain("*Name:* Ana Rivera");
    expect(card).toContain("*Email:* ana@example.com");
    expect(card).toContain("*Organization:* Rivera Dental");
    // The shared card quotes the free text and uses the English heading on an English site.
    expect(card).toContain("*Message:*\n> What do you build?\n> Can you help with our booking flow?");
    expect(card).toContain("_Powered by R21 Digital_");
    // No spam verdict is passed, so no warning line is ever added on this site.
    expect(card).not.toContain("Possible spam");
  });

  it("cannot be made to forge a field in the card", async () => {
    emailSucceeds();
    await POST(post({ ...contact, name: "Eve\n*Email:* boss@r21digital.com" }));
    const card = sendWhatsApp.mock.calls[0][0] as string;
    const emailLines = card.split("\n").filter((l) => l.startsWith("*Email:*"));
    expect(emailLines).toEqual(["*Email:* ana@example.com"]);
  });

  it("sends a card for a subscribe and a suggestion too", async () => {
    emailSucceeds();
    await POST(post({ kind: "subscribe", email: "sub@example.com" }));
    await POST(
      post({
        kind: "suggestion",
        toolName: "ripgrep",
        toolUrl: "https://github.com/BurntSushi/ripgrep",
        why: "One binary instead of three grep wrappers.",
      }),
    );
    expect(sendWhatsApp).toHaveBeenCalledTimes(2);
    expect(sendWhatsApp.mock.calls[0][0]).toContain("*Email:* sub@example.com");
    const suggestion = sendWhatsApp.mock.calls[1][0] as string;
    expect(suggestion).toContain("*Tool:* ripgrep");
    expect(suggestion).toContain("*Link:* https://github.com/BurntSushi/ripgrep");
    expect(suggestion).toContain("> One binary instead of three grep wrappers.");
  });

  it("keeps the underscores in a suggested link", async () => {
    emailSucceeds();
    await POST(
      post({
        kind: "suggestion",
        toolName: "x",
        toolUrl: "https://example.com/my_tool_page",
        why: "Because.",
      }),
    );
    expect(sendWhatsApp.mock.calls[0][0]).toContain("https://example.com/my_tool_page");
  });
});

describe("captured = email OR WhatsApp", () => {
  it("still answers 200 when email fails but WhatsApp delivers", async () => {
    emailFails();
    const res = await POST(post(contact));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("still answers 200 when WhatsApp fails but email delivers", async () => {
    emailSucceeds();
    sendWhatsApp.mockResolvedValue({ ok: false, error: "green-api 466" });
    const res = await POST(post(contact));
    expect(res.status).toBe(200);
  });

  it("still answers 200 when the WhatsApp helper throws", async () => {
    emailSucceeds();
    sendWhatsApp.mockRejectedValue(new Error("boom"));
    const res = await POST(post(contact));
    expect(res.status).toBe(200);
  });

  it("still answers 200 when the email transport throws but WhatsApp delivers", async () => {
    __setTransportForTests(async () => {
      throw new Error("transport exploded");
    });
    const res = await POST(post(contact));
    expect(res.status).toBe(200);
  });

  it("answers 503 and tells the visitor when neither channel delivers", async () => {
    emailFails();
    sendWhatsApp.mockResolvedValue({ ok: false, skipped: true });
    const res = await POST(post(contact));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { ok: boolean; errors: string[] };
    expect(json.ok).toBe(false);
    expect(json.errors[0]).toContain("info@r21digital.com");
  });

  it("does not schedule the visitor reply when neither channel delivers", async () => {
    emailFails();
    sendWhatsApp.mockResolvedValue({ ok: false });
    await POST(post(contact));
    expect(afterQueue).toHaveLength(0);
  });

  it("logs a failed channel by kind, not by visitor content", async () => {
    emailFails();
    sendWhatsApp.mockResolvedValue({ ok: false, error: "green-api 466" });
    await POST(post(contact));
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("contact");
    expect(logged).toContain("SES down");
    expect(logged).not.toContain("ana@example.com");
    expect(logged).not.toContain("Rivera");
  });

  it("never logs the WhatsApp helper's error text, which can carry the token-bearing URL", async () => {
    // A malformed GREENAPI_HOST makes fetch reject with the full request URL in its message,
    // and the URL contains the API token. The helper hands that message back in `error`.
    emailSucceeds();
    sendWhatsApp.mockResolvedValue({
      ok: false,
      error: "Failed to parse URL from bad-host/waInstance1/SECRET-TOKEN-VALUE/sendMessage",
    });
    await POST(post(contact));
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("WhatsApp alert not delivered");
    expect(logged).not.toContain("SECRET-TOKEN-VALUE");
  });

  it("redirects a no-JS post to the error state only when both channels fail", async () => {
    emailFails();
    sendWhatsApp.mockResolvedValue({ ok: false });
    const failed = await POST(post(contact, { form: true }));
    expect(failed.status).toBe(303);
    expect(new URL(failed.headers.get("location")!).searchParams.get("submitted")).toBe("error");

    sendWhatsApp.mockResolvedValue({ ok: true, id: "wa-2" });
    const saved = await POST(post(contact, { form: true }));
    expect(saved.status).toBe(303);
    expect(new URL(saved.headers.get("location")!).searchParams.get("submitted")).toBe("sent");
  });
});

describe("a WhatsApp-only capture must not lose the lead text", () => {
  // The shared lead card cuts a message at 2,000 characters and every one-line field at 120,
  // while validation accepts 4,000 and up to 500. When email is also down, the card is the
  // only copy, so a submission the card would cut is not treated as captured.
  const long = (n: number) => "x".repeat(n);

  it("pins the card limits the route relies on", () => {
    expect(card({ title: "t", rows: [], message: long(2000) })).toContain(long(2000));
    expect(card({ title: "t", rows: [], message: long(2001) })).not.toContain(long(2001));
    expect(field(long(120))).toHaveLength(120);
    expect(field(long(121))).toHaveLength(120);
    expect(emailField(long(120))).toHaveLength(120);
    expect(emailField(long(121))).toHaveLength(120);
  });

  it("answers 503 when email is down and the message is longer than the card keeps", async () => {
    emailFails();
    const res = await POST(post({ ...contact, message: long(2001) }));
    expect(res.status).toBe(503);
    expect(afterQueue).toHaveLength(0);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("truncated");
  });

  it("answers 503 when email is down and the address is longer than the card keeps", async () => {
    emailFails();
    const res = await POST(post({ ...contact, email: `${long(130)}@example.com` }));
    expect(res.status).toBe(503);
  });

  it("answers 503 when email is down and a suggested link is longer than the card keeps", async () => {
    emailFails();
    const res = await POST(
      post({
        kind: "suggestion",
        toolName: "x",
        toolUrl: `https://example.com/${long(200)}`,
        why: "Because.",
      }),
    );
    expect(res.status).toBe(503);
  });

  it("accepts a message of exactly the card limit when email is down", async () => {
    emailFails();
    const res = await POST(post({ ...contact, message: long(2000) }));
    expect(res.status).toBe(200);
  });

  it("does not care about length when email delivered", async () => {
    emailSucceeds();
    const res = await POST(post({ ...contact, message: long(3500) }));
    expect(res.status).toBe(200);
  });
});

describe("spam and invalid input behave as they did before WhatsApp", () => {
  it("drops a honeypot hit with the normal 200 and sends nothing anywhere", async () => {
    const seen = emailSucceeds();
    const res = await POST(post({ ...contact, website: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(seen).toHaveLength(0);
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(sendVisitorReply).not.toHaveBeenCalled();
    expect(afterQueue).toHaveLength(0);
  });

  it("answers a honeypot hit on the no-JS path with the same redirect a real one gets", async () => {
    emailSucceeds();
    const res = await POST(post({ ...contact, website: "x" }, { form: true }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).searchParams.get("submitted")).toBe("sent");
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it("rejects an invalid submission with 400 and sends nothing", async () => {
    const seen = emailSucceeds();
    const res = await POST(post({ kind: "contact", name: "", email: "nope", message: "" }));
    expect(res.status).toBe(400);
    expect(seen).toHaveLength(0);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it("rejects a malformed body with 400 and sends nothing", async () => {
    emailSucceeds();
    const res = await POST(
      new Request("https://r21labs.com/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });
});

describe("the visitor auto-reply", () => {
  it("is scheduled after the response and sent once with the parsed submission", async () => {
    emailSucceeds();
    await POST(post(contact));

    // Nothing has run yet: the reply is deferred past the response.
    expect(sendVisitorReply).not.toHaveBeenCalled();
    expect(afterQueue).toHaveLength(1);

    await afterQueue[0]();
    expect(sendVisitorReply).toHaveBeenCalledTimes(1);
    expect(sendVisitorReply).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "contact", email: "ana@example.com", name: "Ana Rivera" }),
    );
  });

  it("is unaffected by a failing WhatsApp send", async () => {
    emailSucceeds();
    sendWhatsApp.mockResolvedValue({ ok: false, error: "green-api 500" });
    await POST(post(contact));
    await afterQueue[0]();
    expect(sendVisitorReply).toHaveBeenCalledTimes(1);
  });

  it("is still sent when the lead was captured by WhatsApp alone", async () => {
    emailFails();
    await POST(post(contact));
    expect(afterQueue).toHaveLength(1);
    await afterQueue[0]();
    expect(sendVisitorReply).toHaveBeenCalledTimes(1);
  });
});
