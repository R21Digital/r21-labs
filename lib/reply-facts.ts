/**
 * R21 Labs' verified facts and fallback copy.
 *
 * Hand-maintained on purpose. R21 Labs' own curation rule is that the manifest is
 * written by a person and never generated from whatever happens to be in a repo; the
 * same rule applies to what the site is allowed to claim in an email.
 *
 * 🔴 Everything the auto-reply may assert lives in LABS_FACTS. Adding a capability
 * here is the act that lets the model mention it. Carlos approves this file.
 */
import type { Submission } from "./forms";

export const LABS_BRAND = {
  name: "R21 Labs",
  replyTo: "info@r21digital.com",
  urlHosts: ["r21labs.com", "r21digital.com"],
  /** R21 Labs publishes no phone number, so the reply may contain none. */
  phone: null as string | null,
  forbid: [
    "any price, rate or cost",
    "any promise about when someone will reply",
    "any statement or implication that a suggested tool will be added to the site",
  ],
};

export const LABS_FACTS = `
R21 Labs (r21labs.com) is R21 Digital's public resource site. It covers software,
agents, MCP servers and developer tools that R21 has built or actively recommends.

What is on the site: a hand-picked list of tools with a note on what each is for, the
software R21 has built, and long-form playbooks.

How entries are chosen: every entry is added by hand by a person at R21 after they
have used the tool. Nothing is added automatically, and a suggestion is a candidate
for that review -- not a queue position and not a commitment to publish.

R21 Labs covers software and developer tooling. Websites, marketing, SEO and
advertising are R21 Digital's side, at r21digital.com.

R21 also builds custom software for clients: AI agents, internal tools, integrations
and apps. The contact form on r21labs.com is how that work starts, and someone at R21
replies personally to scope it.

If someone describes something they want built, do not point them to the tool list.
Invite them to reply to this email so R21 can scope it with them.

Contact: replying to this email reaches R21 directly.
`.trim();

/** The address to reply to, or null when the submission carries none. */
export function replyRecipient(s: Submission): string | null {
  const email = "email" in s ? s.email.trim() : "";
  return email.includes("@") ? email : null;
}

/** Sent whenever the composer times out, errors, or its draft is refused. */
export function fallbackReply(s: Submission): { subject: string; text: string } {
  if (s.kind === "subscribe") {
    return {
      subject: "You are on the R21 Labs list",
      text: [
        "Thanks for subscribing to R21 Labs.",
        "You will hear from us when something is genuinely worth your time — a new tool we have actually used, a build we have shipped, or a playbook. Not on a schedule, and not often.",
        "— R21 Labs",
      ].join("\n\n"),
    };
  }

  if (s.kind === "suggestion") {
    return {
      subject: `Thanks for the suggestion — ${s.toolName}`,
      text: [
        `Thanks for sending ${s.toolName} our way.`,
        "Every entry on R21 Labs is added by hand, by someone here who has actually used the tool. So your suggestion goes into that review rather than into a publishing queue — we look at it properly, and we only list things we can stand behind.",
        "If we do end up using it, you will see it on the site.",
        "— R21 Labs",
      ].join("\n\n"),
    };
  }

  const first = s.name.trim().split(/\s+/)[0] || s.name.trim();
  return {
    subject: "We got your message — R21 Labs",
    text: [
      first ? `Hi ${first},` : "Hi,",
      "Thanks for writing to R21 Labs. Your message reached us and a person is reading it — reply to this email if you want to add anything in the meantime.",
      "— R21 Labs",
    ].join("\n\n"),
  };
}
