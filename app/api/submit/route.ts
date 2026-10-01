import { NextResponse, after } from "next/server";

import { isDeployed, missingEmailEnv, sendNotification } from "@/lib/email";
import { parseSubmission, renderNotification, type Submission } from "@/lib/forms";
import { card, emailField, field } from "@/lib/lead-card";
import { sendVisitorReply } from "@/lib/visitor-reply";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * The one server route on an otherwise fully static site.
 *
 * It is listed by name in `tests/boundary.test.ts`. That test asserts every
 * app route is prerendered, and it is the reason the OpenGraph card stopped
 * being rendered on demand — so weakening it to "unless it's under /api" would
 * quietly give back the guarantee it was written to protect. Instead the
 * allowlist names this route, which means adding a second dynamic route is a
 * deliberate edit to a test rather than something that slips in.
 *
 * There is no GET. A form endpoint that answers GET invites people to probe it
 * from a browser bar, and there is nothing here worth reading.
 */
export const dynamic = "force-dynamic";

/** What the client is told, in every outcome that is not a validation failure. */
const ACCEPTED = { ok: true } as const;

/**
 * Read the body in whichever encoding actually arrived.
 *
 * 🔴 Adversarial review 2026-08-24. This route called `request.json()` and
 * nothing else, while `SubmitForm` carried a comment claiming that without
 * JavaScript "the failure mode is a full page POST, not a dead button." A
 * browser posting a plain `<form>` sends `application/x-www-form-urlencoded`,
 * so that path returned "Malformed request" every single time.
 *
 * The comment was the defect. A documented fallback that has never been
 * exercised is worse than no fallback, because it stops anyone looking.
 */
async function readBody(request: Request): Promise<{ body: unknown; wasForm: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    const body: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") body[key] = value;
    }
    return { body, wasForm: true };
  }
  return { body: await request.json(), wasForm: false };
}

/**
 * The no-JS path gets a real page, not a JSON blob.
 *
 * Someone whose script did not load is the last person who should be shown
 * `{"ok":true}`. A redirect back to the form's own page with a query flag lets
 * the page render an ordinary confirmation, and keeps the POST out of history.
 */
function redirectTo(request: Request, status: "sent" | "error"): NextResponse {
  const referer = request.headers.get("referer");
  const base = new URL(referer ?? "/", new URL(request.url).origin);
  base.searchParams.set("submitted", status);
  base.hash = "form";
  return NextResponse.redirect(base, { status: 303 });
}

/**
 * The card for the "Leads - R21 Digital" WhatsApp group.
 *
 * The builder is the fleet's shared `lib/lead-card.ts`; the titles and labels are this
 * site's, in English. No spam verdict is passed: this site's spam handling is the honeypot
 * in `parseSubmission`, which drops before anything is sent, so there is nothing to flag.
 * Links go through `emailField` rather than `field`, which would strip the underscores out
 * of a real URL.
 */
/** The kinds that post a card. Newsletter sign-ups stay email-only (Carlos, 2026-09-30):
 *  the leads group is for enquiries, and a subscriber is not one. */
type Enquiry = Exclude<Submission, { kind: "subscribe" }>;

function whatsappCard(submission: Enquiry): string {
  if (submission.kind === "suggestion") {
    return card({
      lang: "en",
      title: "🛠️ *Tool suggestion, R21 Labs*",
      rows: [
        ["Tool", field(submission.toolName)],
        ["Link", emailField(submission.toolUrl)],
        ["Replaces", field(submission.replaces)],
        ["Email", emailField(submission.email)],
      ],
      message: submission.why,
    });
  }
  return card({
    lang: "en",
    title: "✉️ *New enquiry, R21 Labs*",
    rows: [
      ["Name", field(submission.name)],
      ["Email", emailField(submission.email)],
      ["Organization", field(submission.organization)],
    ],
    message: submission.message,
  });
}

/**
 * True when the card keeps every character the visitor typed.
 *
 * The shared lead card cuts the message at 2,000 characters and each one-line field at 120
 * (its defaults), while `parseSubmission` accepts up to 4,000 and 500. The email carries the
 * whole text; the card may not. So when email failed, a card that was cut is not a capture,
 * because nothing complete was delivered. `tests/submit-route.test.ts` pins these two numbers
 * against the real card, so a change to the shared lib fails a test instead of drifting.
 */
const CARD_MESSAGE_MAX = 2000;
const CARD_FIELD_MAX = 120;

function cardKeepsEverything(submission: Enquiry): boolean {
  const fits = (value: string, max: number) => Array.from(value).length <= max;
  if (submission.kind === "suggestion") {
    return (
      [submission.toolName, submission.toolUrl, submission.replaces, submission.email].every((v) =>
        fits(v, CARD_FIELD_MAX),
      ) && fits(submission.why, CARD_MESSAGE_MAX)
    );
  }
  return (
    [submission.name, submission.email, submission.organization].every((v) =>
      fits(v, CARD_FIELD_MAX),
    ) && fits(submission.message, CARD_MESSAGE_MAX)
  );
}

export async function POST(request: Request) {
  let body: unknown;
  let wasForm = false;
  try {
    ({ body, wasForm } = await readBody(request));
  } catch {
    return NextResponse.json({ ok: false, errors: ["Malformed request."] }, { status: 400 });
  }

  const parsed = parseSubmission(body);

  if (!parsed.ok) {
    // A bot gets the same answer a person gets, and nothing is sent. Telling it
    // which field gave it away is how you train the next attempt.
    if ("rejected" in parsed) {
      return wasForm ? redirectTo(request, "sent") : NextResponse.json(ACCEPTED);
    }
    if (wasForm) return redirectTo(request, "error");
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const submission = parsed.submission;
  const mail = renderNotification(submission);

  // Email and the "Leads - R21 Digital" WhatsApp group at once: neither waits on, or is
  // lost to, the other, and a throw from one cannot skip the other. A newsletter sign-up
  // sends no card (Carlos, 2026-09-30), so for it email is the only channel, as before.
  const wantsCard = submission.kind !== "subscribe";
  const [emailResult, whatsappResult] = await Promise.allSettled([
    sendNotification(mail),
    submission.kind === "subscribe" ? Promise.resolve(null) : sendWhatsApp(whatsappCard(submission)),
  ]);
  const sent = emailResult.status === "fulfilled" ? emailResult.value : null;
  const emailOk = sent?.ok === true;
  const whatsappOk = whatsappResult.status === "fulfilled" && whatsappResult.value?.ok === true;

  if (!emailOk) {
    console.error("[r21-labs] notification email not delivered", {
      kind: parsed.submission.kind,
      error:
        emailResult.status === "rejected"
          ? "transport threw"
          : sent && !sent.ok
            ? sent.error
            : "unknown",
    });
  }
  if (wantsCard && !whatsappOk) {
    // A category only. The helper's own `error` text is deliberately not logged: a bad
    // GREENAPI_HOST makes fetch reject with the whole request URL, and that URL contains the
    // API token. The helper logs the green-api status itself.
    console.error("[r21-labs] WhatsApp alert not delivered", {
      kind: parsed.submission.kind,
      reason:
        whatsappResult.status === "rejected"
          ? "helper threw"
          : whatsappResult.value?.skipped
            ? "not configured"
            : "send failed",
    });
  }

  // Captured if EITHER channel reached us. A WhatsApp card that cut the visitor's text is
  // not a capture on its own, because then the email was the only complete copy.
  const whatsappComplete =
    whatsappOk && submission.kind !== "subscribe" && cardKeepsEverything(submission);
  if (whatsappOk && !whatsappComplete && !emailOk) {
    console.error("[r21-labs] WhatsApp card was truncated and email failed", {
      kind: parsed.submission.kind,
    });
  }
  if (!emailOk && !whatsappComplete) {
    // 🔴 Do NOT answer 200 here. The whole point of the guard in lib/email.ts
    // is that an unconfigured or failing sender is visible. R21 has shipped
    // forms that thanked people for submissions nobody ever received.
    if (wasForm) return redirectTo(request, "error");
    return NextResponse.json(
      {
        ok: false,
        errors: [
          "We could not deliver that just now. Please email info@r21digital.com instead.",
        ],
      },
      { status: 503 },
    );
  }

  if (sent?.ok && sent.transport === "log" && isDeployed()) {
    // Unreachable by construction — `sendNotification` refuses the log
    // transport on any deployment, preview included. Asserted anyway, because
    // the failure it guards against is silent by nature and this is the last
    // place to catch it.
    console.error("[r21-labs] log transport reached a deployment", {
      missing: missingEmailEnv(),
    });
  }

  // The visitor's own reply. Scheduled once the lead is captured and after the response is
  // decided, so nothing here can affect what the submitter is told or whether R21 receives
  // the lead. sendVisitorReply never throws out.
  after(async () => {
    await sendVisitorReply(parsed.submission);
  });

  return wasForm ? redirectTo(request, "sent") : NextResponse.json(ACCEPTED);
}
