/**
 * The three things a visitor can send this site.
 *
 * Kept as one file, and as plain functions with no validation dependency,
 * because that is genuinely all three forms need: nine fields between them and
 * no conditional shapes. Reaching for a schema library here would add a
 * dependency to a site whose README lists exactly how few it has.
 *
 * The important property is that `parseSubmission` is the ONLY way a request
 * body becomes a `Submission`. The route handler never reads `body.email`
 * directly, so there is no path where an unvalidated field reaches an email
 * template — which is the same choke-point idea `getPublishedEntries()` uses
 * for content, enforced the same way in `tests/boundary.test.ts`.
 */

export const SUBMISSION_KINDS = ["suggestion", "subscribe", "contact"] as const;
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];

export type Submission =
  | {
      kind: "suggestion";
      toolName: string;
      toolUrl: string;
      replaces: string;
      why: string;
      email: string;
    }
  | { kind: "subscribe"; email: string }
  | {
      kind: "contact";
      name: string;
      email: string;
      organization: string;
      message: string;
    };

export type ParseResult =
  | { ok: true; submission: Submission }
  | { ok: false; errors: string[] }
  /**
   * A honeypot hit is NOT an error.
   *
   * Returning `{ ok: false }` for a bot would render the form's error state to
   * anything that scripted it, which tells the author of the script exactly
   * which field to stop filling in. `rejected` lets the route answer 200 with
   * the same body a real submission gets, and simply not send anything.
   */
  | { ok: false; rejected: "honeypot"; errors: [] };

/** Longest value we will accept in any single field. */
const MAX_FIELD = 4000;

/**
 * Deliberately permissive. This address is a reply-to on an internal
 * notification, not a login, so the cost of rejecting a real unusual address is
 * higher than the cost of accepting a typo — a bounced reply is visible, a
 * silently refused submission is not.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function required(
  errors: string[],
  value: string,
  label: string,
  max = MAX_FIELD,
): string {
  if (value.length === 0) errors.push(`${label} is required.`);
  else if (value.length > max) errors.push(`${label} is too long.`);
  return value;
}

/**
 * The length cap is here, not only in `required()`.
 *
 * Caught by `tests/forms.test.ts` on the first run: the subscribe form has one
 * field and it never went through `required()`, so a 5,000-character address
 * passed the regex and would have gone straight into an email subject line.
 * The cap is tighter than MAX_FIELD because 254 is the actual RFC limit for an
 * address, and a field with a real limit should use it.
 */
const MAX_EMAIL = 254;

function requiredEmail(errors: string[], value: string, label = "Email"): string {
  if (value.length === 0) errors.push(`${label} is required.`);
  else if (value.length > MAX_EMAIL) errors.push(`${label} is too long.`);
  else if (!EMAIL.test(value)) errors.push(`${label} does not look like an email address.`);
  return value;
}

function optionalUrl(errors: string[], value: string, label: string): string {
  if (value.length === 0) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      errors.push(`${label} must be an http or https link.`);
    }
  } catch {
    errors.push(`${label} must be a full link, including https://`);
  }
  return value;
}

export function isSubmissionKind(value: unknown): value is SubmissionKind {
  return (
    typeof value === "string" && (SUBMISSION_KINDS as readonly string[]).includes(value)
  );
}

/**
 * The honeypot field.
 *
 * Named `website` rather than something like `_hp` on purpose: an autofilling
 * bot fills fields whose names it recognises, and "website" is one of the most
 * commonly filled. A real person never sees it — it is hidden from layout AND
 * from the accessibility tree, and carries `tabIndex={-1}` so keyboard users
 * cannot land in it by accident.
 */
export const HONEYPOT_FIELD = "website";

export function parseSubmission(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["Malformed submission."] };
  }
  const body = raw as Record<string, unknown>;

  if (str(body[HONEYPOT_FIELD]).length > 0) {
    return { ok: false, rejected: "honeypot", errors: [] };
  }

  const kind = body.kind;
  if (!isSubmissionKind(kind)) {
    return { ok: false, errors: ["Unknown submission type."] };
  }

  const errors: string[] = [];

  if (kind === "subscribe") {
    const email = requiredEmail(errors, str(body.email));
    return errors.length > 0
      ? { ok: false, errors }
      : { ok: true, submission: { kind, email } };
  }

  if (kind === "suggestion") {
    const toolName = required(errors, str(body.toolName), "Tool name", 200);
    const toolUrl = required(errors, str(body.toolUrl), "Link", 500);
    optionalUrl(errors, toolUrl, "Link");
    const why = required(errors, str(body.why), "What it does for you");
    const replaces = str(body.replaces);
    // Optional: someone can suggest a tool without wanting a reply.
    const email = str(body.email);
    if (email.length > 0 && (email.length > MAX_EMAIL || !EMAIL.test(email))) {
      errors.push("Email does not look like an email address.");
    }
    return errors.length > 0
      ? { ok: false, errors }
      : { ok: true, submission: { kind, toolName, toolUrl, replaces, why, email } };
  }

  const name = required(errors, str(body.name), "Name", 200);
  const email = requiredEmail(errors, str(body.email));
  const message = required(errors, str(body.message), "Message");
  const organization = str(body.organization);
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, submission: { kind: "contact", name, email, organization, message } };
}

/** Keeps a submitted value from closing a tag in the notification email. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Rendered = { subject: string; text: string; html: string; replyTo?: string };

/**
 * The notification R21 receives.
 *
 * `replyTo` is set to the submitter wherever one was given, so answering a
 * suggestion or a contact is a plain reply rather than a copy-paste. FTTHelper
 * shipped every email it had ever sent with no reply-to and only found out
 * months later; the capability existing is not the same as a caller using it.
 */
export function renderNotification(submission: Submission): Rendered {
  const rows: [string, string][] = [];
  let subject: string;
  let replyTo: string | undefined;

  if (submission.kind === "subscribe") {
    subject = `R21 Labs — new subscriber: ${submission.email}`;
    rows.push(["Email", submission.email]);
    replyTo = submission.email;
  } else if (submission.kind === "suggestion") {
    subject = `R21 Labs — suggested tool: ${submission.toolName}`;
    rows.push(["Tool", submission.toolName], ["Link", submission.toolUrl]);
    if (submission.replaces) rows.push(["Replaces", submission.replaces]);
    rows.push(["Why", submission.why]);
    if (submission.email) {
      rows.push(["From", submission.email]);
      replyTo = submission.email;
    }
  } else {
    subject = `R21 Labs — enquiry from ${submission.name}`;
    rows.push(["Name", submission.name], ["Email", submission.email]);
    if (submission.organization) rows.push(["Organization", submission.organization]);
    rows.push(["Message", submission.message]);
    replyTo = submission.email;
  }

  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = [
    '<table cellpadding="6" style="font:14px/1.5 -apple-system,Segoe UI,sans-serif">',
    ...rows.map(
      ([label, value]) =>
        `<tr><td style="color:#6c6c6c;vertical-align:top">${esc(label)}</td>` +
        `<td style="white-space:pre-wrap">${esc(value)}</td></tr>`,
    ),
    "</table>",
  ].join("");

  return { subject, text, html, replyTo };
}
