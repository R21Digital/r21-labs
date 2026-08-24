# R21 Labs

A public record of the AI tools R21 tested and recommends, the software R21 built, and the playbooks that tie them together.

It is a curation site, not a republishing platform. R21 credits and links third-party tools; it never hosts or redistributes them.

## Who it's for

Engineers and prospective clients evaluating whether R21 knows what it is doing. The scope rule is one line:

> A website or marketing service goes on `r21digital.com`. Software, an agent, an MCP, or a developer tool goes here.

## The problem it solves

Directory sites make claims nobody checks. Stars go stale, licences change, repos move, authors get miscredited by a secondhand blog post. This site's product **is** the accuracy of its attributions — so accuracy is enforced by the build rather than by good intentions.

Four guards fail `next build`. They do not warn.

| Guard | Rejects |
|---|---|
| `published` | Anything without `status: published` — including its route |
| `required-fields` | An entry missing the fields spec §3 requires for its type |
| `attribution` | A published tool with no `source`, `sourceUrl`, or `license` |
| `staleness` | A `verifiedOn` older than 183 days, missing, or in the future |
| `links` | A dead outbound link on a published entry — **including links written in prose**, not just frontmatter |
| `internal-links` | A link to a path this site does not publish. Offline, so a broken internal link is never masked by the network being down |

There is deliberately **no skip flag**. An env var to bypass a guard gets set once during a bad afternoon and never unset.

## Run it

```bash
npm install
npm run verify
```

`verify` is the real check: link guard → build → tests. `npm run dev` for local work.

Node 22+. No database and no CMS. The content layer needs no credentials at all — clone it, build
it, and every page renders.

### Environment

| Variable | Needed for | If unset |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonicals, sitemap, feed, OG image URLs | Defaults to `https://r21labs.com`. Set it only on a fork or a staging deploy that should not claim to be production. |
| `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY` | Sending form submissions via SES | Forms log instead of sending — **in dev and preview only**, see below |
| `ALERT_FROM` | The SES-verified sender identity, e.g. `no-reply@r21digital.com` | as above |
| `ALERT_TO` | Where submissions land | as above |

The names match the rest of R21's site fleet rather than the AWS SDK's own defaults, so the ops
sweeps that grep for `AWS_SES_*` see this project too. The credentials themselves are R21 Labs' own
IAM user, not shared with another R21 project — a workspace rule rather than a preference, because a
key reused across projects cannot be rotated for one of them.

## Discovery

Every page carries its own `<title>`, description, canonical, OpenGraph card and JSON-LD, and the site publishes `/sitemap.xml`, `/robots.txt`, `/feed.xml` and `/llms.txt`.

That is worth stating because until 2026-08-22 none of it existed: robots and sitemap both 404'd, and all eleven entry pages shipped the *same* title and description — eleven identical rows in a search result, on a site whose second stated goal is SEO. It was invisible because two files were written expecting a sitemap and a feed nobody had been assigned to build. `tests/discovery.test.ts` now fails the build on a duplicate title, a duplicate description, a missing canonical, a relative `og:image`, or a draft in the feed.

`robots.txt` allows the AI crawlers deliberately. R21 sells getting clients cited by AI search; a site that blocked GPTBot would be arguing against its own product.

## Forms

Three, all posting to one endpoint (`app/api/submit/route.ts`): suggest a tool, subscribe, and a
scoped work-with-us enquiry. They share one component and one validator, because between them they
are nine fields and three hand-built forms would drift.

**`/api/submit` is the only route on this site that is not prerendered.** `tests/boundary.test.ts`
asserts that every route is, which is what stopped the OpenGraph card being rendered on demand — so
rather than weaken that rule to "unless it's under `/api`", the test names this route explicitly and
separately asserts that an allowlisted route imports no content. Adding a second dynamic route means
editing a test on purpose.

**In production, an unconfigured sender returns 503.** The obvious implementation — log in dev, send
in prod, fall back to log when env is missing — is exactly how R21 shipped three client sites whose
contact forms captured nothing while thanking every visitor. The fallback is a development
convenience and `lib/email.ts` refuses it when `VERCEL_ENV=production`. That refusal has its own
test, and it is the one in this repo most worth keeping green.

**The forms work without JavaScript.** Not as an aspiration — the route reads
`application/x-www-form-urlencoded` as well as JSON and answers a native post with a 303 back to the
page, which renders the same confirmation. This is called out because the first version *claimed* it
in a code comment while the route parsed JSON only, so every no-JS submission returned "Malformed
request". A documented fallback nobody has exercised is worse than none, because it stops anyone
looking.

Spam handling is a honeypot field and length caps, nothing more. A filled honeypot gets the same 200
and the same response body a real submission gets, and sends nothing — telling a script which field
gave it away is how you train the next attempt.

### What the forms do NOT do

Adversarial review on 2026-08-24 raised four gaps. Two were fixed; these are the two that were
deliberately not built, recorded here rather than left for someone to discover:

- **No durable outbox.** A submission is handed to SES and the visitor is told it sent. The
  MessageId is logged, so a bounce can be traced — but nothing is persisted, so a message SES accepts
  and later bounces is gone, and a retry after a 503 can duplicate. Building the outbox means adding
  a datastore to a site whose stated architecture is that it has none. That trade is worth revisiting
  if volume ever justifies it; today it does not.
- **No rate limiting.** The honeypot stops naive bots and stops nothing else — a scripted JSON post
  that omits the field walks past it. Serverless functions have no shared memory to count against, so
  the real control belongs at the edge (Vercel's firewall), not in this route. Stated plainly because
  a honeypot is easy to mistake for abuse protection.

## Three architecture decisions

**MDX files in git, not a database.** At ~18 hand-curated entries a database is pure overhead, and git gives an audit trail of who changed which claim and when — which matters more than usual on a site whose product is claim accuracy.

**Guards run inside `getPublishedEntries()`, not in a lint step.** A guard that lives in a script someone has to remember to invoke is a guard that eventually is not consulted. Putting them in the read path means no page can render without them having run. Link checking is the one exception, because it is async and network-bound, so it runs at `prebuild` — and only against published entries, so it costs nothing until something is actually published.

**Every number is a `count()` over content; none is typed.** R21 has shipped a client site that advertised 8 cemeteries while serving 130, because the figure came from a status enum instead of the store. The corollary is that a stat can be unavailable and must say so: the homepage currently renders `—  pending verification` for integrations because that list is still a draft. The site declines to print a number it cannot stand behind.

## Known limits

- **15 published entries of ~18 planned.** Release 1 is not complete.
- **Four release-1 builds are drafts with no public artifact** — `pf-mcp-jwks`, `r21-paid-ads-mcp`, `r21-google-tooling`, `whisper-local`. Each draft records the registry searches that came up empty (2026-08-22) instead of guessing.
- **Karpathy Skills has no LICENSE file upstream**, and the repo moved from `forrestchang` to `multica-ai`. The entry publishes with that finding stated rather than a borrowed licence value.
- **Only the two playbooks use markdown structure.** They were published 2026-08-23 at 1,508 and 1,101 words, with headings and real tables — the first content to use the renderer in `components/site/EntryBody.tsx`. The other thirteen published entries are still flat paragraphs totalling about 1,040 words between them, roughly 80 words each. **This, not the design, is what stands between the site and its SEO goal.**
- **The OpenGraph card is not set in Montserrat.** Satori cannot read woff2, so matching the brand typeface would mean fetching a TTF over the network at build time — and when that fetch fails `ImageResponse` renders a valid card in a fallback face with no error. The dependency is removed rather than risked; the card carries the brand through colour and structure. Fix properly by committing a Montserrat TTF (OFL permits it) and reading from disk.

## AI assistance

Built with Claude Code. The design direction, the guard model, and the copy were reviewed against R21's own skills — `r21-design` for the visual system, `review-animations` for the motion, `humanizer` for the prose — and several of those reviews overturned earlier decisions rather than rubber-stamping them. Carlos owns the result and the decisions in it.

## Reference

Spec and plan live in the workspace repo:
`docs/superpowers/specs/2026-08-19-r21-labs-design.md` · `docs/superpowers/plans/2026-08-19-r21-labs-implementation.md`
