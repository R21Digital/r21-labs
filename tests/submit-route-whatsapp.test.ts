import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The route wired to the REAL `lib/whatsapp.ts`, with only `fetch` stubbed.
 *
 * `whatsapp.ts` reads its env at module load, so each test sets the environment first and
 * then imports a fresh copy of the route. `fetch` is a stub, so this file cannot reach the
 * real service.
 */

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: () => {} };
});
vi.mock("@/lib/visitor-reply", () => ({ sendVisitorReply: vi.fn() }));

// Fake values throughout. None of these is a real instance, token or group.
const GREEN = {
  GREENAPI_ID_INSTANCE: "1100000000",
  GREENAPI_API_TOKEN: "test-token-not-real",
  GREENAPI_CHAT_ID: "120363000000000000@g.us",
};

const contact = {
  kind: "contact",
  name: "Ana Rivera",
  email: "ana@example.com",
  organization: "",
  message: "Hello.",
};

function req(): Request {
  return new Request("https://r21labs.com/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(contact),
  });
}

async function load(env: Partial<typeof GREEN>, emailOk: boolean) {
  vi.resetModules();
  for (const key of Object.keys(GREEN)) vi.stubEnv(key, "");
  vi.stubEnv("GREENAPI_HOST", "");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const email = await import("@/lib/email");
  email.__setTransportForTests(async () =>
    emailOk ? { ok: true, id: "ses-1", transport: "ses" as const } : { ok: false, error: "SES down" },
  );
  const { POST } = await import("@/app/api/submit/route");
  return POST;
}

let fetchStub: ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchStub = vi.fn();
  vi.stubGlobal("fetch", fetchStub);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("route with the real whatsapp helper", () => {
  it("posts one card to the configured group through green-api", async () => {
    fetchStub.mockResolvedValue(new Response(JSON.stringify({ idMessage: "BAE5" }), { status: 200 }));
    const POST = await load(GREEN, true);

    const res = await POST(req());

    expect(res.status).toBe(200);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.green-api.com/waInstance1100000000/sendMessage/test-token-not-real",
    );
    const sent = JSON.parse(init.body as string) as { chatId: string; message: string };
    expect(sent.chatId).toBe("120363000000000000@g.us");
    expect(sent.message).toContain("*Name:* Ana Rivera");
  });

  it("keeps the email path working and logs it when the WhatsApp env is missing", async () => {
    const POST = await load({}, true);

    const res = await POST(req());

    expect(res.status).toBe(200);
    expect(fetchStub).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("green-api not configured"));
  });

  it("returns 503 when the WhatsApp env is missing AND email fails", async () => {
    const POST = await load({}, false);
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("does not count a 200 without idMessage as delivered", async () => {
    fetchStub.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const POST = await load(GREEN, false);
    const res = await POST(req());
    expect(res.status).toBe(503);
  });

  it("does not count a green-api error as delivered, and email still carries the lead", async () => {
    fetchStub.mockResolvedValue(new Response("nope", { status: 466 }));
    const POST = await load(GREEN, true);
    const res = await POST(req());
    expect(res.status).toBe(200);
  });

  it("treats a network failure to green-api as not delivered, and email still carries the lead", async () => {
    fetchStub.mockRejectedValue(new Error("fetch failed"));
    const POST = await load(GREEN, true);
    const res = await POST(req());
    expect(res.status).toBe(200);
  });
});
