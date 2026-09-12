/**
 * The one email the visitor receives.
 *
 * Called from inside `after()`, so it runs once the notification to R21 has already
 * succeeded and the HTTP response has gone out. Nothing here can change what the
 * visitor's browser was told, and a composer outage cannot touch the submission path.
 *
 * Exactly one email is sent, always: the composed reply when it succeeds and passes
 * the filter, the fixed template otherwise. None at all when the submission carries
 * no address -- `suggestion` makes the email field optional.
 *
 * It never throws. An `after()` callback that rejects is an unhandled rejection in a
 * serverless function, which is a noisy way to fail at something nobody can see.
 */
import { sendNotification } from "./email";
import type { Submission } from "./forms";
import { LABS_BRAND, LABS_FACTS, fallbackReply, replyRecipient } from "./reply-facts";
import { renderShell } from "./reply-shell";

type Composed = { ok: true; subject: string; text: string } | { ok: false };

/** A fake "Re:" / "Fwd:" is a spam tell -- this is the first message in the thread. */
function cleanSubject(subject: string): string {
  return subject.replace(/^(?:\s*(?:re|fwd?)\s*:\s*)+/i, "").trim();
}

/**
 * True when the composed reply repeats text the visitor typed into a suggestion.
 *
 * The reply goes to whatever address was typed, so repeated text is a stranger's words sent
 * from a verified R21 domain. The model is told not to (LABS_BRAND.forbid); this is the
 * guarantee, and it falls back to the template rather than editing the draft.
 *
 * Suggestion fields only. A contact reply greeting someone by name is the point of it; the
 * per-IP rate limit on /api/submit is what bounds that lane.
 */
function repeatsVisitorText(s: Submission, subject: string, text: string): boolean {
  if (s.kind !== "suggestion") return false;
  const hay = `${subject}\n${text}`.toLowerCase();
  return [s.toolName, s.toolUrl, s.replaces]
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length >= 3)
    .some((v) => hay.includes(v));
}

async function callComposer(submission: Submission): Promise<Composed> {
  const url = process.env.REPLY_COMPOSE_URL;
  const token = process.env.REPLY_COMPOSE_TOKEN;
  if (!url || !token) return { ok: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        kind: submission.kind,
        submission,
        brand: {
          name: LABS_BRAND.name,
          replyTo: LABS_BRAND.replyTo,
          facts: LABS_FACTS,
          urlHosts: LABS_BRAND.urlHosts,
          phone: LABS_BRAND.phone,
          forbid: LABS_BRAND.forbid,
        },
        locale: "en",
      }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as { ok?: boolean; subject?: string; text?: string };
    if (!json.ok || !json.subject || !json.text) return { ok: false };
    return { ok: true, subject: json.subject, text: json.text };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendVisitorReply(
  submission: Submission,
  deps: { composeImpl?: (s: Submission) => Promise<Composed> } = {},
): Promise<void> {
  const to = replyRecipient(submission);
  if (!to) return;

  const compose = deps.composeImpl ?? callComposer;

  let body: { subject: string; text: string };
  try {
    const composed = await compose(submission);
    const subject = composed.ok ? cleanSubject(composed.subject) : "";
    body =
      composed.ok && subject && !repeatsVisitorText(submission, subject, composed.text)
        ? { subject, text: composed.text }
        : fallbackReply(submission);
  } catch {
    body = fallbackReply(submission);
  }

  try {
    const result = await sendNotification({
      to,
      brand: LABS_BRAND.name,
      replyTo: LABS_BRAND.replyTo,
      // R21 receives the exact text the visitor got. Not a second alert email --
      // a blind copy of the one that was already going out.
      bcc: process.env.ALERT_BCC,
      subject: body.subject,
      text: body.text,
      html: renderShell({
        kind: submission.kind,
        preheader: body.text.slice(0, 90),
        text: body.text,
      }),
    });
    if (!result.ok) {
      console.error("[r21-labs] visitor reply not delivered", {
        kind: submission.kind,
        error: result.error,
      });
    }
  } catch (e) {
    console.error("[r21-labs] visitor reply threw", { kind: submission.kind, error: e });
  }
}
