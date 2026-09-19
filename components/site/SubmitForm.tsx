"use client";

import { useId, useState, useSyncExternalStore } from "react";

import { HONEYPOT_FIELD, type SubmissionKind } from "@/lib/forms";

/**
 * The one form component. All three forms are the same nine-field problem in
 * different arrangements, so they are one component driven by a field list
 * rather than three hand-built forms that drift apart.
 *
 * It posts JSON to `/api/submit`, and it works as a plain `<form>` first: real
 * inputs with real labels inside a real form element, with `method` and
 * `action` set, so the JS handler only intercepts submit to keep the visitor on
 * the page.
 *
 * 🔴 That last sentence used to be a claim rather than a fact. The route parsed
 * JSON only, so a native browser POST — which sends
 * `application/x-www-form-urlencoded` — returned "Malformed request" every
 * time. Adversarial review caught it on 2026-08-24. The route now reads either
 * encoding and answers a native post with a 303 back to this page carrying
 * `?submitted=`, which `useSyncExternalStore` below turns into the same
 * confirmation a scripted submit gets.
 *
 * The query is read from `window.location` rather than through
 * `useSearchParams`, deliberately: the pages hosting this form are prerendered,
 * and `useSearchParams` would pull them toward a Suspense boundary or a
 * client-side bail for a value that only matters after a redirect.
 *
 * The success state REPLACES the form rather than sitting above it. A thank-you
 * message next to a still-filled form is the shape that produces duplicate
 * submissions, and duplicates are indistinguishable from a retry after a
 * failure — which matters here because a retry is exactly what someone does
 * when they are not sure it went through.
 */

export type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "url" | "textarea";
  required?: boolean;
  placeholder?: string;
  /** Shown under the input. Use for the thing the label cannot say briefly. */
  hint?: string;
};

export type SubmitFormProps = {
  kind: SubmissionKind;
  fields: Field[];
  submitLabel: string;
  /** Shown in place of the form once it has been accepted. */
  successTitle: string;
  successBody: string;
  /** Compact layout for the footer subscribe box. */
  inline?: boolean;
};

type State = "idle" | "sending" | "sent";

const controlClass =
  "w-full rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-canvas/60 px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink-dim focus:border-accent focus:outline-none focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-60";

export default function SubmitForm({
  kind,
  fields,
  submitLabel,
  successTitle,
  successBody,
  inline = false,
}: SubmitFormProps) {
  const [state, setState] = useState<State>("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const formId = useId();

  /**
   * The no-JS return path — the `?submitted=` flag the route redirects back
   * with after a native form post.
   *
   * `useSyncExternalStore` rather than an effect that calls `setState`. The
   * value exists only on the client, and the effect version is both a lint
   * error (`react-hooks/set-state-in-effect`) and the wrong shape: this is not
   * state that changes, it is a value the server cannot see. The third argument
   * is the server snapshot, so hydration starts from `null` on both sides and
   * React reconciles once, instead of rendering one thing and correcting it.
   *
   * `subscribe` is a no-op because the flag never changes after load — a second
   * submission goes through the scripted path and never lands here.
   */
  const submitted = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("submitted"),
    () => null,
  );

  const showSent = state === "sent" || (state === "idle" && submitted === "sent");
  const shownErrors =
    errors.length > 0
      ? errors
      : state === "idle" && submitted === "error"
        ? ["That did not go through. Please check the fields and try again."]
        : [];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setErrors([]);

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, kind }),
      });
      const result = (await response.json()) as { ok: boolean; errors?: string[] };

      if (result.ok) {
        setState("sent");
        return;
      }
      setErrors(result.errors ?? ["Something went wrong. Please try again."]);
      setState("idle");
    } catch {
      // Network-level failure. Naming the alternative matters more than the
      // apology — the visitor came here to say something.
      setErrors(["We could not reach the server. Please email info@r21digital.com."]);
      setState("idle");
    }
  }

  if (showSent) {
    return (
      <div role="status" className={inline ? "" : "py-2"}>
        <p className="font-display text-base font-semibold text-ink">{successTitle}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{successBody}</p>
      </div>
    );
  }

  return (
    <form
      id="form"
      method="post"
      action="/api/submit"
      onSubmit={handleSubmit}
      // `sm:flex-wrap` is what lets the full-width error region below take its
      // own line. Without it that region sat in the row, claimed the width, and
      // squeezed the input to its padding: 26px wide, placeholder never shown.
      className={
        inline ? "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start" : "space-y-4"
      }
    >
      <input type="hidden" name="kind" value={kind} />

      {/* Honeypot. Hidden from layout AND from assistive tech, and unreachable
          by keyboard — a field a screen-reader user could fill in is a trap for
          the wrong audience. */}
      <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
        <label htmlFor={`${formId}-${HONEYPOT_FIELD}`}>Website</label>
        <input
          id={`${formId}-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {fields.map((field) => {
        const id = `${formId}-${field.name}`;
        const hintId = field.hint ? `${id}-hint` : undefined;
        return (
          <div key={field.name} className={inline ? "flex-1" : ""}>
            <label
              htmlFor={id}
              className={
                inline
                  ? "sr-only"
                  : "tabular block font-mono text-[11px] uppercase tracking-widest text-ink-muted"
              }
            >
              {field.label}
              {field.required ? <span className="ml-1 text-accent">*</span> : null}
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={id}
                name={field.name}
                rows={5}
                required={field.required}
                placeholder={field.placeholder}
                aria-describedby={hintId}
                disabled={state === "sending"}
                className={`${controlClass} ${inline ? "" : "mt-2"} resize-y`}
              />
            ) : (
              <input
                id={id}
                name={field.name}
                type={field.type ?? "text"}
                required={field.required}
                placeholder={field.placeholder}
                aria-describedby={hintId}
                disabled={state === "sending"}
                className={`${controlClass} ${inline ? "" : "mt-2"}`}
              />
            )}
            {field.hint ? (
              <p id={hintId} className="mt-1.5 text-xs text-ink-dim">
                {field.hint}
              </p>
            ) : null}
          </div>
        );
      })}

      {/* One live region for the whole form. Screen readers announce the errors
          on arrival; sighted users get them next to the button that caused
          them, rather than at the top of a page they have scrolled past. */}
      <div aria-live="polite" className={inline ? "sm:order-last sm:w-full" : ""}>
        {shownErrors.length > 0 ? (
          <ul className="space-y-1 rounded-[var(--radius-control)] border border-accent/40 bg-accent/[0.07] px-3 py-2 text-sm text-ink">
            {shownErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={state === "sending"}
        className="tabular inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-accent bg-accent/[0.12] px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-ink transition-colors duration-[var(--dur-control)] hover:bg-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
