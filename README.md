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
| `links` | A dead outbound link on a published entry |

There is deliberately **no skip flag**. An env var to bypass a guard gets set once during a bad afternoon and never unset.

## Run it

```bash
npm install
npm run verify
```

`verify` is the real check: link guard → build → tests. `npm run dev` for local work.

Node 22+. No env vars, no database, no CMS.

## Discovery

Every page carries its own `<title>`, description, canonical, OpenGraph card and JSON-LD, and the site publishes `/sitemap.xml`, `/robots.txt` and `/feed.xml`.

That is worth stating because until 2026-08-22 none of it existed: robots and sitemap both 404'd, and all eleven entry pages shipped the *same* title and description — eleven identical rows in a search result, on a site whose second stated goal is SEO. It was invisible because two files were written expecting a sitemap and a feed nobody had been assigned to build. `tests/discovery.test.ts` now fails the build on a duplicate title, a duplicate description, a missing canonical, a relative `og:image`, or a draft in the feed.

`robots.txt` allows the AI crawlers deliberately. R21 sells getting clients cited by AI search; a site that blocked GPTBot would be arguing against its own product.

## Three architecture decisions

**MDX files in git, not a database.** At ~18 hand-curated entries a database is pure overhead, and git gives an audit trail of who changed which claim and when — which matters more than usual on a site whose product is claim accuracy.

**Guards run inside `getPublishedEntries()`, not in a lint step.** A guard that lives in a script someone has to remember to invoke is a guard that eventually is not consulted. Putting them in the read path means no page can render without them having run. Link checking is the one exception, because it is async and network-bound, so it runs at `prebuild` — and only against published entries, so it costs nothing until something is actually published.

**Every number is a `count()` over content; none is typed.** R21 has shipped a client site that advertised 8 cemeteries while serving 130, because the figure came from a status enum instead of the store. The corollary is that a stat can be unavailable and must say so: the homepage currently renders `—  pending verification` for integrations because that list is still a draft. The site declines to print a number it cannot stand behind.

## Known limits

- **11 published entries of ~18 planned.** Release 1 is not complete.
- **Four release-1 builds are drafts with no public artifact** — `pf-mcp-jwks`, `r21-paid-ads-mcp`, `r21-google-tooling`, `whisper-local`. Each draft records the registry searches that came up empty (2026-08-22) instead of guessing.
- **Karpathy Skills has no LICENSE file upstream**, and the repo moved from `forrestchang` to `multica-ai`. The entry publishes with that finding stated rather than a borrowed licence value.
- **Both playbooks are drafts pending Carlos's review** — deep-method disclosure is his call, not the build's.
- **No entry uses markdown structure yet.** Bodies now render headings, lists, tables, code and links (`components/site/EntryBody.tsx`), but every one of the 17 entries is currently flat paragraphs — so the capability is real and the visible change today is zero. Published bodies total roughly 1,100 words across 11 pages, about 100 words each. **This, not the design, is what stands between the site and its SEO goal.**
- **The OpenGraph card is not set in Montserrat.** Satori cannot read woff2, so matching the brand typeface would mean fetching a TTF over the network at build time — and when that fetch fails `ImageResponse` renders a valid card in a fallback face with no error. The dependency is removed rather than risked; the card carries the brand through colour and structure. Fix properly by committing a Montserrat TTF (OFL permits it) and reading from disk.

## AI assistance

Built with Claude Code. The design direction, the guard model, and the copy were reviewed against R21's own skills — `r21-design` for the visual system, `review-animations` for the motion, `humanizer` for the prose — and several of those reviews overturned earlier decisions rather than rubber-stamping them. Carlos owns the result and the decisions in it.

## Reference

Spec and plan live in the workspace repo:
`docs/superpowers/specs/2026-08-19-r21-labs-design.md` · `docs/superpowers/plans/2026-08-19-r21-labs-implementation.md`
