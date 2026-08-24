import { NextResponse } from "next/server";

import { isDeployed, missingEmailEnv, sendNotification } from "@/lib/email";
import { parseSubmission, renderNotification } from "@/lib/forms";

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
  const sent = await sendNotification(mail);

  if (!sent.ok) {
    // 🔴 Do NOT answer 200 here. The whole point of the guard in lib/email.ts
    // is that an unconfigured or failing sender is visible. R21 has shipped
    // forms that thanked people for submissions nobody ever received.
    console.error("[r21-labs] submission not delivered", {
      kind: parsed.submission.kind,
      error: sent.error,
    });
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

  if (sent.transport === "log" && isDeployed()) {
    // Unreachable by construction — `sendNotification` refuses the log
    // transport on any deployment, preview included. Asserted anyway, because
    // the failure it guards against is silent by nature and this is the last
    // place to catch it.
    console.error("[r21-labs] log transport reached a deployment", {
      missing: missingEmailEnv(),
    });
  }

  return wasForm ? redirectTo(request, "sent") : NextResponse.json(ACCEPTED);
}
