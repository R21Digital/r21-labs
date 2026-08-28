/**
 * Outbound mail for the three forms. AWS SES, matching the R21 standard.
 *
 * Two things here are not the obvious implementation, and both come from
 * failures this workspace has already paid for:
 *
 * 1. **In production, an unconfigured sender is a 503, not a shrug.** The
 *    tempting shape — log in dev, send in prod, fall back to log if env is
 *    missing — is exactly how R21 shipped three client sites whose contact
 *    forms captured nothing at all. Every one of them returned a cheerful
 *    success message. A form that silently discards submissions is worse than
 *    no form, because it also consumes the visitor's goodwill. So the fallback
 *    is allowed in dev and in tests and REFUSED in production.
 *
 * 2. **Env values are cleaned before use.** A UTF-8 BOM in a Vercel
 *    environment variable is invisible in the dashboard, invisible in
 *    `vercel env ls`, and invisible in the logs — only the runtime rejects it.
 *    This is not hypothetical: one site's lead email was dead for an unknown
 *    stretch because `AWS_SES_REGION` held `﻿us-east-1`, written there by a
 *    PowerShell pipe. Fixing it exposed a second control character in an
 *    address underneath. Trimming and stripping the BOM costs nothing and
 *    removes the whole class.
 *
 * The variable names match the rest of R21's fleet (`AWS_SES_*`, `ALERT_*`)
 * rather than the AWS SDK's own defaults. That is deliberate: the ops runbooks
 * sweep for those names, and a site using different ones is a site the sweep
 * silently skips. It means credentials are passed to the client explicitly
 * instead of being picked up from the environment.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

export type SendResult =
  | { ok: true; id: string; transport: "ses" | "log" }
  | { ok: false; error: string };

export type Outbound = {
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

/** Strips a BOM and surrounding whitespace. See note 2 above. */
function env(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const cleaned = raw.replace(/^﻿/, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

const REQUIRED = [
  "AWS_SES_REGION",
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "ALERT_FROM",
  "ALERT_TO",
] as const;

/** Which of the required variables are absent — named, so the 503 can say. */
export function missingEmailEnv(): string[] {
  return REQUIRED.filter((name) => env(name) === undefined);
}

export function isEmailConfigured(): boolean {
  return missingEmailEnv().length === 0;
}

/**
 * True on ANY deployment — production or preview.
 *
 * 🔴 Corrected 2026-08-24 by adversarial review. This used to be
 * `isProduction()`, testing `VERCEL_ENV === "production"`, which left previews
 * on the log transport. That is a hole in the exact guarantee this file exists
 * to provide, and it failed in two ways at once:
 *
 * - A preview has a real, reachable URL. Anyone submitting through one got the
 *   normal "Sent." state while nothing was delivered.
 * - The log transport printed the whole submission, so names, addresses and
 *   message bodies were written into deployment logs.
 *
 * The rule is now about whether the code is DEPLOYED, not about which
 * deployment it is. `VERCEL_ENV` is set on production and preview alike and is
 * unset locally, so its mere presence is the test.
 *
 * Checking this rather than `NODE_ENV` still matters: `next build` runs with
 * `NODE_ENV=production` on every laptop, and that build must not fail.
 */
export function isDeployed(): boolean {
  return env("VERCEL_ENV") !== undefined;
}

let client: SESv2Client | null = null;
function ses(): SESv2Client {
  if (!client) {
    client = new SESv2Client({
      region: env("AWS_SES_REGION"),
      credentials: {
        accessKeyId: env("AWS_SES_ACCESS_KEY_ID")!,
        secretAccessKey: env("AWS_SES_SECRET_ACCESS_KEY")!,
      },
    });
  }
  return client;
}

// Tests swap the transport instead of setting AWS credentials.
let override: ((mail: Outbound) => Promise<SendResult>) | null = null;
export function __setTransportForTests(
  fn: ((mail: Outbound) => Promise<SendResult>) | null,
): void {
  override = fn;
  client = null;
}

export async function sendNotification(mail: Outbound): Promise<SendResult> {
  if (override) return override(mail);

  if (!isEmailConfigured()) {
    if (isDeployed()) {
      return {
        ok: false,
        error: `Email is not configured: missing ${missingEmailEnv().join(", ")}`,
      };
    }
    // Local development and tests only — never a deployment. The submission
    // body is deliberately NOT logged even here: a dev log is still a file on
    // disk, and there is no version of "print the visitor's message" worth the
    // habit it builds.
    console.info("[r21-labs] submission accepted (log transport, nothing sent)", {
      subject: mail.subject,
    });
    return { ok: true, id: `log-${Date.now()}`, transport: "log" };
  }

  try {
    const out = await ses().send(
      new SendEmailCommand({
        FromEmailAddress: env("ALERT_FROM"),
        Destination: { ToAddresses: [env("ALERT_TO")!] },
        ReplyToAddresses: mail.replyTo ? [mail.replyTo] : undefined,
        Content: {
          Simple: {
            Subject: { Data: mail.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: mail.text, Charset: "UTF-8" },
              Html: { Data: mail.html, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
    // The MessageId is logged, not just returned. It is the only thread back
    // from "the form said it sent" to a specific SES message, and a bounce
    // investigation with no id has nothing to search on. This is a trail, not a
    // durable outbox — see the README's known limits for what it does not cover.
    const id = out.MessageId ?? "unknown";
    console.info("[r21-labs] submission handed to SES", { id });
    return { ok: true, id, transport: "ses" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
