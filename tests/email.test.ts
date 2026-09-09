import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildSendInput, type Outbound } from "../lib/email";

// The transport override short-circuits before SES, so a test that swaps it can only
// observe the object it was handed -- which is true whatever the implementation does.
// The first version of this file did exactly that and passed before the feature
// existed. buildSendInput is the mapping itself, so asserting on it is asserting on
// the behaviour that actually reaches Amazon.

const base: Outbound = { subject: "s", text: "t", html: "<p>t</p>" };

const saved = { ...process.env };
beforeEach(() => {
  process.env.ALERT_FROM = "no-reply@r21digital.com";
  process.env.ALERT_TO = "info@r21digital.com";
});
afterEach(() => {
  process.env = { ...saved };
});

describe("buildSendInput — recipient", () => {
  it("uses ALERT_TO when the caller names no recipient", () => {
    expect(buildSendInput(base).Destination?.ToAddresses).toEqual(["info@r21digital.com"]);
  });

  it("uses an explicit recipient when given", () => {
    expect(buildSendInput({ ...base, to: "visitor@example.com" }).Destination?.ToAddresses).toEqual(
      ["visitor@example.com"],
    );
  });
});

describe("buildSendInput — sender", () => {
  it("sends the bare ALERT_FROM when no brand is given", () => {
    expect(buildSendInput(base).FromEmailAddress).toBe("no-reply@r21digital.com");
  });

  it("prefixes the brand display name onto a bare address", () => {
    expect(buildSendInput({ ...base, brand: "R21 Labs" }).FromEmailAddress).toBe(
      "R21 Labs <no-reply@r21digital.com>",
    );
  });

  it("leaves an ALERT_FROM that already carries a display name alone", () => {
    process.env.ALERT_FROM = "Someone Else <no-reply@r21digital.com>";
    expect(buildSendInput({ ...base, brand: "R21 Labs" }).FromEmailAddress).toBe(
      "Someone Else <no-reply@r21digital.com>",
    );
  });
});

describe("buildSendInput — bcc", () => {
  it("omits Bcc entirely when none is given", () => {
    expect(buildSendInput(base).Destination?.BccAddresses).toBeUndefined();
  });

  it("splits a comma-separated bcc and trims it", () => {
    expect(
      buildSendInput({ ...base, bcc: "a@example.com, b@example.com" }).Destination?.BccAddresses,
    ).toEqual(["a@example.com", "b@example.com"]);
  });
});

describe("buildSendInput — content", () => {
  it("carries both the text and html parts", () => {
    const c = buildSendInput(base).Content?.Simple;
    expect(c?.Body?.Text?.Data).toBe("t");
    expect(c?.Body?.Html?.Data).toBe("<p>t</p>");
  });

  it("sets Reply-To only when given", () => {
    expect(buildSendInput(base).ReplyToAddresses).toBeUndefined();
    expect(buildSendInput({ ...base, replyTo: "x@example.com" }).ReplyToAddresses).toEqual([
      "x@example.com",
    ]);
  });
});
