/**
 * The branded container both the composed reply and the fallback template ride in,
 * so a fallback still looks like R21 rather than a plain-text apology.
 *
 * Email HTML constraints, each with a cause: tables for layout because Outlook's Word
 * rendering engine has no flexbox or grid; inline styles because Gmail strips <style>
 * blocks in several contexts; 600px because it is the width that survives every
 * client; system fonts because webfonts do not load in email. No contrast depends on
 * a white ground -- Gmail and Apple Mail invert aggressively in dark mode.
 */
function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderShell(input: { brand: string; preheader: string; text: string }): string {
  const paragraphs = input.text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#1a1a1a">${esc(
          p,
        ).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  return [
    `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(input.preheader)}</span>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2">',
    '<tr><td align="center" style="padding:32px 16px">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e3e0d8">',
    '<tr><td style="padding:32px 32px 8px">',
    `<div style="font:600 15px/1.4 Georgia,serif;letter-spacing:.02em;color:#1a1a1a">${esc(input.brand)}</div>`,
    '<div style="height:2px;width:40px;background:#1a1a1a;margin:12px 0 24px"></div>',
    "</td></tr>",
    `<tr><td style="padding:0 32px 8px">${paragraphs}</td></tr>`,
    '<tr><td style="padding:8px 32px 32px;font:13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#6b675e">',
    "You can reply directly to this email.",
    "</td></tr>",
    "</table></td></tr></table>",
  ].join("");
}
