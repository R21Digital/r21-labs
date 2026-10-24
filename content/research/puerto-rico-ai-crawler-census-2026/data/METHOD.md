# Method note: Puerto Rico AI crawler census (issue 1)

Measured 2026-10-22 by Carlos Jimenez, R21 Digital. This note describes how the
published data files were collected and classified, and how to rebuild every
figure in the report from them.

## Files

The report offers these files for download:

| File | What it is |
|---|---|
| `results.csv` | One row per retained website (271 rows). No domain, business name, URL, category or timestamp. |
| `stats.json` | Every percentage and range the report quotes, with counts and denominators, computed from `results.csv`. |
| `build_stats.py` | The script that writes `stats.json` from `results.csv`. Python 3, standard library only. |
| `METHOD.md` | This note. |

One more file sits next to them in the site's source repository, which is
public, but is not offered as a download: `denylist.sha256`, keyed hashes
(HMAC-SHA256) of the 300 sampled domains, with and without `www.`. The site's
build uses it to make sure no sampled domain is ever named in the report or in
these files. The key is private, so the file cannot be used to check whether a
given domain was sampled.

Rebuild the figures:

```
python build_stats.py --csv results.csv --out stats.json
```

The output should be identical to the published `stats.json`. Two funnel numbers,
300 drawn and 29 removed after the draw, describe rows that are not published, so
they are constants in the script rather than counts from the file.

## Sources

1. **OpenStreetMap**, queried through the Overpass API. Every Puerto Rico feature
   with a `website` tag and a business-type tag (shop, craft, office, healthcare,
   and selected amenity, tourism and leisure tags). OpenStreetMap data as of
   2026-10-22T20:19Z. Map data © OpenStreetMap contributors, available under the
   Open Database License (https://www.openstreetmap.org/copyright).
2. **Puerto Rico Chamber of Commerce, "New Members" page**
   (https://camarapr.org/new-members/), list dated 2026-05-27. It was the only
   public member list we could find.

## Building the frame

- One row per registered domain.
- From OpenStreetMap we removed social-media and shared hosting addresses (13),
  government and education domains (15), domains attached to five or more map
  features, treated as likely chains (21), and addresses that could not be parsed (2).
- From the Chamber page we removed social-media and vendor links, the Chamber's
  own domains, and 26 large corporate or government domains.
- None of the sites R21 builds or hosts for clients appeared in the frame.
- Result: 908 domains, 211 from the Chamber page and 697 found only in OpenStreetMap.
  A domain on both lists counts as Chamber.

## The draw

- 150 domains drawn at random from each source with a fixed seed, 300 in all.
  We do not publish the seed or the frame file: together with the two public
  lists they would give back the list of sampled businesses. A researcher who
  wants to check the draw can ask us.
- The sample is stratified by source only. Pooled figures describe these 246
  sites; they are not estimates for all Puerto Rico businesses.
- After the draw, 29 domains were removed as clearly not local businesses. They
  are not published and are left out of every percentage. In our internal check,
  keeping them in moved no headline figure by more than a few tenths of a point.

## Fetching

- Between 20:24 and 20:46 UTC on 2026-10-22.
- One request at a time, at least 1.2 seconds apart.
- Every request identified itself with the user agent
  `R21Digital-research/1.0 (+https://r21digital.com)`.
- For each domain: `GET /robots.txt`, then `GET /` to read platform, CDN and
  bot-challenge hints from the headers and page. The homepage request was skipped
  for the 3 sites whose robots.txt disallows `/` for every crawler.
- We did not fetch as GPTBot or as any other company's crawler. Pretending to be
  another company's bot is not honest research, so what a site does to those bots
  at the network level is outside this data.

## Classification

- **robots.txt rules** are matched the way RFC 9309
  (https://www.rfc-editor.org/rfc/rfc9309) says: a crawler obeys the group that
  names it, otherwise the `*` group; the longest matching path wins, and `Allow`
  wins a tie. A crawler counts as blocked when the rules that apply to it
  disallow the site root, `/`. A file that only closes off some folders is not
  counted as a block.
- **Redirects were not followed** on the `/robots.txt` request, although RFC 9309
  says crawlers should follow them. A redirect is recorded as `error`.
- **The eight AI crawlers checked:** GPTBot, ChatGPT-User, OAI-SearchBot,
  ClaudeBot, PerplexityBot, Google-Extended, CCBot, Bytespider.
- **robots.txt status:** HTTP 404 or 410 means no robots.txt (`missing`); a 200
  that returns an HTML page, an empty file, or a file with no user-agent lines is
  `unusable`; 401, 403 or 429 is `denied` (all 22 denied responses in this sample were 403); any other status is
  `error` (the 9 in this sample: 3 redirects, 307, 307 and 301; 4 server errors,
  502, 502, 521 and 500; and 2 conflicts, 409); no
  response at all (DNS failure, TLS failure, connection reset) is `unreachable`.
- **Homepage refused:** the homepage answered 403 or 429, or served a bot
  challenge, to our user agent.
- **Cloudflare managed robots.txt:** the file contains the section Cloudflare
  writes for its customers ("BEGIN Cloudflare Managed content"). It counts as an
  active managed AI block when that section blocks at least one of the eight crawlers.
- **Platform** is a guess from response headers and homepage markup. 94 of the
  246 sites could not be identified.

## Funnel

300 drawn → 29 removed after the draw → 271 retained → 25 unreachable (23 DNS,
1 TLS, 1 connection reset) → 246 responding. Of those, 170 have a robots.txt with
user-agent rules.

## `results.csv` columns

| Column | Values | Meaning |
|---|---|---|
| `id` | 12 hex characters | Salted hash of the domain. The salt is kept private, so the id alone does not give the domain away. It is a pseudonym, not anonymity: someone who already knows a site's robots.txt, platform and CDN may be able to match it to a row. |
| `source_frame` | `chamber`, `osm` | Which list the domain was drawn from. |
| `platform` | `wordpress`, `wix`, `godaddy_builder`, `shopify`, `squarespace`, `webflow`, `nextjs`, `custom_php_joomla`, `unidentified` | Platform guess. |
| `cdn_or_challenge` | `challenge`, a CDN name, `none` | `challenge` when the homepage refused our user agent; otherwise the CDN seen in the headers. |
| `robots_status` | `ok`, `missing`, `unusable`, `denied`, `error`, `unreachable` | See Classification. `ok` means a robots.txt with user-agent rules. |
| `gptbot`, `chatgpt_user`, `oai_searchbot`, `claudebot`, `perplexitybot`, `google_extended`, `ccbot`, `bytespider` | `allow`, `block`, `no_rule` | The effective result for that crawler. `no_rule` means there was no usable robots.txt to judge by; it does not mean blocked. |
| `blanket_disallow` | `0`, `1` | `User-agent: *` with `Disallow: /`. That blocks every crawler without a group of its own, which normally includes search engines. On the three such sites in this sample, the file has no other group. |
| `posthoc_excluded` | `0` | Always 0 here: removed rows are not published. Kept so later issues share the same columns. |
| `cdn` | CDN name, `none` | CDN seen in the headers, kept even when the homepage refused us. |
| `cloudflare_managed_robots` | `0`, `1` | robots.txt carries Cloudflare's managed section. |
| `cloudflare_managed_ai_block` | `0`, `1` | That section blocks at least one of the eight crawlers. |
| `named_block` | crawler columns separated by `;`, or empty | Crawlers blocked by a rule that names them, not by the `*` group. |
| `named_allow` | crawler columns separated by `;`, or empty | Crawlers explicitly allowed by a rule that names them. |

## Figures

The denominator is the 246 responding sites unless the figure says otherwise.
Intervals are Wilson 95 percent confidence intervals, rounded to one decimal. They
express how far a figure could move between random draws from these two lists, and
nothing about businesses on neither list. The equal draw of 150 per list gives the
Chamber list more weight in pooled figures than its share of the frame (141 of the
246 responding sites).
Each figure in `stats.json` carries `value`, `n`, `count`, `ci95` and the exact
labels the report is allowed to print, in English (`3.3%`) and Spanish (`3,3 %`)
formats.

## Limits

- Not representative of Puerto Rico. OpenStreetMap leans toward what volunteers
  map (restaurants, lodging, health, shops); the Chamber list leans toward
  dues-paying professional and business-to-business firms; businesses with only
  a Facebook page are absent.
- robots.txt is one layer. Firewalls, bot protection and rate limits can turn a
  crawler away without any robots.txt line.
- For 31 responding sites (22 denied, 9 error) robots.txt could not be read. Their
  crawler columns are `no_rule` and they count as not blocking, so block figures are
  blocks detected, not a full count.
- RFC 9309 does not read those answers the same way. After a 5xx (4 sites here) a
  compliant crawler must treat the whole site as closed; after a 4xx (the 22
  denied and the 2 conflicts) it may crawl everything. The 3 redirects were not
  followed, so what they lead to is unknown.
- A refusal to our user agent says nothing direct about how a site treats
  OpenAI's or any other company's crawlers.
- One pass, on one day. Intent cannot be read from outside: a blanket disallow
  may be deliberate, and a missing robots.txt means there is no robots.txt restriction,
  not that every crawler gets in.
- Small counts and wide intervals. The headline is about 3 in 100.
