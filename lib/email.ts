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
 *    `vercel env ls`, and invisible in the logs — only the runtime rejects it,
 *    and R21 lost an afternoon to one sitting in an AWS region string. Trimming
 *    and stripping the BOM costs nothing and removes the whole class.
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
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "LABS_EMAIL_FROM",
  "LABS_EMAIL_TO",
] as const;

/** Which of the required variables are absent — named, so the 503 can say. */
export function missingEmailEnv(): string[] {
  return REQUIRED.filter((name) => env(name) === undefined);
}

export function isEmailConfigured(): boolean {
  return missingEmailEnv().length === 0;
}

/**
 * True only on a real production deployment.
 *
 * `VERCEL_ENV` is `production` only for the production deployment; previews get
 * `preview` and local gets nothing. Checking it rather than `NODE_ENV` matters
 * because `next build` runs with `NODE_ENV=production` on every machine,
 * including a laptop with no AWS credentials, and that build must not fail.
 */
export function isProduction(): boolean {
  return env("VERCEL_ENV") === "production";
}

let client: SESv2Client | null = null;
function ses(): SESv2Client {
  if (!client) client = new SESv2Client({ region: env("AWS_REGION") });
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
    if (isProduction()) {
      return {
        ok: false,
        error: `Email is not configured: missing ${missingEmailEnv().join(", ")}`,
      };
    }
    // Dev and preview: print it and say which transport handled it, so a local
    // run can never be mistaken for a delivered message.
    console.info("[r21-labs] form submission (log transport, nothing sent)", {
      subject: mail.subject,
      replyTo: mail.replyTo,
      text: mail.text,
    });
    return { ok: true, id: `log-${Date.now()}`, transport: "log" };
  }

  try {
    const out = await ses().send(
      new SendEmailCommand({
        FromEmailAddress: env("LABS_EMAIL_FROM"),
        Destination: { ToAddresses: [env("LABS_EMAIL_TO")!] },
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
    return { ok: true, id: out.MessageId ?? "unknown", transport: "ses" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
