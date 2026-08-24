import { NextResponse } from "next/server";

import { isProduction, missingEmailEnv, sendNotification } from "@/lib/email";
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

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Malformed request."] }, { status: 400 });
  }

  const parsed = parseSubmission(body);

  if (!parsed.ok) {
    // A bot gets the same answer a person gets, and nothing is sent. Telling it
    // which field gave it away is how you train the next attempt.
    if ("rejected" in parsed) return NextResponse.json(ACCEPTED);
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

  if (sent.transport === "log" && isProduction()) {
    // Unreachable by construction — `sendNotification` refuses the log
    // transport in production. Asserted anyway, because the failure it guards
    // against is silent by nature and this is the last place to catch it.
    console.error("[r21-labs] log transport reached production", {
      missing: missingEmailEnv(),
    });
  }

  return NextResponse.json(ACCEPTED);
}
