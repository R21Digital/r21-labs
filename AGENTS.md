<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:r21-labs-project-rules -->

# R21 Labs — project rules

**Spec**: `R21-Brain/docs/superpowers/specs/2026-08-19-r21-labs-design.md`
**Plan**: `R21-Brain/docs/superpowers/plans/2026-08-19-r21-labs-implementation.md`
**Design router**: `R21-Brain/.claude/skills/r21-design/SKILL.md` — plain markdown, readable
from any tool. Read it before any UI work.

## Locked decisions — do not relitigate

- **Brand is `brand-r21` "Midnight AI"**, and it outranks the visual direction on colour and
  type. Canvas `#0a0a14`, card `#13131f`, ONE accent `#E94560`. Aurora is used as **light**, never
  as a flat fill.
  🔴 **Never take tokens from `clients/r21/templates/design/`** — it still ships the retired
  pre-2026 navy `#1A1A2E` / blue `#0F3460` palette. Tokens live in `app/globals.css` only.
- **Whole-page system is `operational-enterprise-ai`.** Exactly one system; do not blend a second.
  Details (hairline grid, frosted card, mono labels) layer on top.
- **Motion**: controls `--dur-control` 180ms, section entrances `--dur-section` 500ms, strong
  custom `--ease-out`. Reduced motion is **gentler, not zero**. Rationale and the resolved
  direction-vs-`review-animations` conflict are in `app/globals.css`.
- **Static only.** Every route must prerender as `○ Static`. No nonce-based CSP — it forces every
  response dynamic and wrecks LCP.

## The site's premise constrains the code

Every claim on this site must be checkable. That is not a content rule, it is why the build guards
exist: an entry missing `source`/`sourceUrl`/`license`, or with a `verifiedOn` older than six
months, **fails the build** rather than warning. Never soften a guard to get a build green — fix
the entry. Star counts and similar figures are fetched live or omitted, never hardcoded.

## MDX

Remark plugins are configured as **strings**, not imported functions (`next.config.ts`). Turbopack
serializes loader options across a worker boundary and a function reference cannot make that trip.

<!-- END:r21-labs-project-rules -->
