import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HONEYPOT_FIELD,
  parseSubmission,
  renderNotification,
  type Submission,
} from "@/lib/forms";
import { isEmailConfigured, missingEmailEnv, sendNotification } from "@/lib/email";

/**
 * The forms, asserted where they actually fail.
 *
 * The interesting failure for a contact form is never "the regex rejected a
 * valid address". It is the form that accepts everything, thanks the visitor,
 * and delivers nothing — which is the failure R21 has already shipped three
 * times, on three client sites, each one returning a cheerful success message
 * while capturing zero leads. So the load-bearing test in this file is the last
 * one: in production, an unconfigured sender must FAIL rather than fall back.
 */

const ENV_KEYS = [
  "AWS_SES_REGION",
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "ALERT_FROM",
  "ALERT_TO",
  "VERCEL_ENV",
] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) vi.stubEnv(key, values[key] ?? "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("parseSubmission", () => {
  it("accepts a complete suggestion", () => {
    const result = parseSubmission({
      kind: "suggestion",
      toolName: "ripgrep",
      toolUrl: "https://github.com/BurntSushi/ripgrep",
      why: "Replaced three grep wrappers with one binary.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.submission.kind).toBe("suggestion");
  });

  it("names every missing field at once rather than one at a time", () => {
    // A form that reveals its requirements one reload at a time is a form
    // people abandon on the second try.
    const result = parseSubmission({ kind: "contact" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBe(3);
  });

  it("rejects a link that is not a link", () => {
    const result = parseSubmission({
      kind: "suggestion",
      toolName: "x",
      toolUrl: "github.com/x",
      why: "y",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a javascript: link", () => {
    const result = parseSubmission({
      kind: "suggestion",
      toolName: "x",
      toolUrl: "javascript:alert(1)",
      why: "y",
    });
    expect(result.ok).toBe(false);
  });

  it("treats an unknown kind as invalid rather than defaulting to one", () => {
    expect(parseSubmission({ kind: "newsletter", email: "a@b.co" }).ok).toBe(false);
  });

  it("caps field length", () => {
    const result = parseSubmission({
      kind: "subscribe",
      email: `${"a".repeat(5000)}@b.co`,
    });
    expect(result.ok).toBe(false);
  });

  describe("the honeypot", () => {
    it("rejects a filled honeypot", () => {
      const result = parseSubmission({
        kind: "subscribe",
        email: "bot@example.com",
        [HONEYPOT_FIELD]: "https://spam.example",
      });
      expect(result.ok).toBe(false);
    });

    it("reports no errors when it fires, so the response is indistinguishable", () => {
      // Telling a script which field gave it away is how you train the next
      // attempt. The route answers 200 with the normal body; this is the
      // property that lets it.
      const result = parseSubmission({
        kind: "subscribe",
        email: "bot@example.com",
        [HONEYPOT_FIELD]: "x",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect("rejected" in result && result.rejected).toBe("honeypot");
        expect(result.errors).toEqual([]);
      }
    });

    it("does not fire on a normal submission", () => {
      // Vacuity guard: without this, a honeypot that fired on EVERYTHING would
      // pass both tests above and silently drop every real submission.
      const result = parseSubmission({ kind: "subscribe", email: "real@example.com" });
      expect(result.ok).toBe(true);
    });
  });
});

describe("renderNotification", () => {
  it("sets reply-to to the submitter so answering is a plain reply", () => {
    const submission: Submission = {
      kind: "contact",
      name: "A",
      email: "a@example.com",
      organization: "",
      message: "hello",
    };
    expect(renderNotification(submission).replyTo).toBe("a@example.com");
  });

  it("leaves reply-to unset when a suggestion carried no address", () => {
    const submission: Submission = {
      kind: "suggestion",
      toolName: "t",
      toolUrl: "https://example.com",
      replaces: "",
      why: "w",
      email: "",
    };
    expect(renderNotification(submission).replyTo).toBeUndefined();
  });

  it("escapes submitted values in the HTML body", () => {
    const submission: Submission = {
      kind: "contact",
      name: "</td><script>alert(1)</script>",
      email: "a@example.com",
      organization: "",
      message: "m",
    };
    expect(renderNotification(submission).html).not.toContain("<script>");
  });
});

describe("email configuration", () => {
  it("names what is missing rather than reporting a bare false", () => {
    withEnv({ AWS_SES_REGION: "us-east-1" });
    expect(isEmailConfigured()).toBe(false);
    expect(missingEmailEnv()).toContain("ALERT_FROM");
  });

  it("treats a BOM-prefixed value as configured", () => {
    // A UTF-8 BOM in a Vercel env var is invisible in the dashboard, in
    // `vercel env ls` and in the logs. Only the runtime rejects it, and R21 has
    // already lost an afternoon to one sitting in an AWS region string.
    withEnv({
      AWS_SES_REGION: "﻿us-east-1",
      AWS_SES_ACCESS_KEY_ID: "k",
      AWS_SES_SECRET_ACCESS_KEY: "s",
      ALERT_FROM: "no-reply@r21digital.com",
      ALERT_TO: "cjimenez@r21digital.com",
    });
    expect(missingEmailEnv()).toEqual([]);
  });

  it("treats a whitespace-only value as missing, not as set", () => {
    withEnv({
      AWS_SES_REGION: "us-east-1",
      AWS_SES_ACCESS_KEY_ID: "k",
      AWS_SES_SECRET_ACCESS_KEY: "s",
      ALERT_FROM: "   ",
      ALERT_TO: "cjimenez@r21digital.com",
    });
    expect(missingEmailEnv()).toEqual(["ALERT_FROM"]);
  });
});

describe("the silent-capture guard", () => {
  const mail = { subject: "s", text: "t", html: "<p>t</p>" };

  it("falls back to a log transport OFF production, and says which it used", async () => {
    withEnv({});
    const result = await sendNotification(mail);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.transport).toBe("log");
  });

  it("🔴 REFUSES to fall back in production", async () => {
    /**
     * This is the test that matters.
     *
     * The obvious implementation — log in dev, send in prod, fall back to log
     * if env is missing — is precisely how three R21 client sites shipped
     * contact forms that captured nothing while thanking every visitor. The
     * fallback is a development convenience and it must not survive contact
     * with production.
     */
    withEnv({ VERCEL_ENV: "production" });
    const result = await sendNotification(mail);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ALERT_TO");
  });

  it("still allows the fallback on a preview deployment", async () => {
    // Preview builds run on every PR with no AWS credentials attached. If the
    // production rule applied here, every preview would answer 503 and the form
    // would be untestable in the one place it is safe to test.
    withEnv({ VERCEL_ENV: "preview" });
    const result = await sendNotification(mail);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.transport).toBe("log");
  });
});
