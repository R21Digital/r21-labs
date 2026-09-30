/**
 * green-api WhatsApp helper: instant lead alert to a WhatsApp group.
 *
 * CANONICAL v2 (2026-09-29). Copied BYTE-FOR-BYTE to every client site alongside spam.ts
 * and lead-card.ts; do not edit a copy in place. The contact form pushes each lead to the
 * client's own group the instant it is submitted. The green-api sender number must be a
 * member; the group id goes in GREENAPI_CHAT_ID. Set it to the client's own group, and
 * never reuse another client's group id: that sends one client's leads to another.
 *
 * Env (set per project in Vercel):
 *   GREENAPI_ID_INSTANCE   green-api instance id
 *   GREENAPI_API_TOKEN     green-api API token
 *   GREENAPI_CHAT_ID       destination chat/group id (ends in @g.us)
 *
 * If any are absent the helper LOGS + no-ops (never throws): the form keeps working
 * and the alert email still sends, so a missing WhatsApp config can't break submissions.
 */
const ID_INSTANCE = process.env.GREENAPI_ID_INSTANCE;
const API_TOKEN = process.env.GREENAPI_API_TOKEN;
const CHAT_ID = process.env.GREENAPI_CHAT_ID;
const HOST = (process.env.GREENAPI_HOST || "https://api.green-api.com").replace(/\/+$/, "");

export async function sendWhatsApp(
  message: string,
): Promise<{ ok: boolean; id?: string; skipped?: boolean; error?: string }> {
  if (!ID_INSTANCE || !API_TOKEN || !CHAT_ID) {
    console.log("[whatsapp] green-api not configured — WhatsApp alert not sent");
    return { ok: false, skipped: true };
  }
  try {
    const url = `${HOST}/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: CHAT_ID, message }),
      // A stalled green-api must not hold the visitor's request open; the catch below
      // turns the abort into { ok: false }.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[whatsapp] green-api non-200:", res.status, body);
      return { ok: false, error: `green-api ${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { idMessage?: string };
    // A 200 with no idMessage means green-api did not queue the message.
    if (!data.idMessage) {
      console.error("[whatsapp] green-api 200 without idMessage");
      return { ok: false, error: "no idMessage" };
    }
    return { ok: true, id: data.idMessage };
  } catch (e) {
    console.error("[whatsapp] green-api send threw:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
