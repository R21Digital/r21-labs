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
function whatsappCard(submission: Submission): string {
  if (submission.kind === "subscribe") {
    return card({
      lang: "en",
      title: "📬 *New subscriber, R21 Labs*",
      rows: [["Email", emailField(submission.email)]],
    });
  }
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

  const mail = renderNotification(parsed.submission);

  // Email and the "Leads - R21 Digital" WhatsApp group at once: neither waits on, or is
  // lost to, the other, and a throw from one cannot skip the other.
  const [emailResult, whatsappResult] = await Promise.allSettled([
    sendNotification(mail),
    sendWhatsApp(whatsappCard(parsed.submission)),
  ]);
  const sent = emailResult.status === "fulfilled" ? emailResult.value : null;
  const emailOk = sent?.ok === true;
  const whatsappOk = whatsappResult.status === "fulfilled" && whatsappResult.value.ok;

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
  if (!whatsappOk) {
    // The helper already logs why; this ties the failure to the kind of lead.
    console.error("[r21-labs] WhatsApp alert not delivered", {
      kind: parsed.submission.kind,
      error:
        whatsappResult.status === "fulfilled"
          ? (whatsappResult.value.error ?? (whatsappResult.value.skipped ? "not configured" : "unknown"))
          : "helper threw",
    });
  }

  // Captured if EITHER channel reached us.
  if (!emailOk && !whatsappOk) {
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
