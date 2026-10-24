"""Build stats.json from the anonymized results.csv.

Every percentage, `n =` count and confidence interval that appears in the
published report must match a label listed here (a build guard checks it).
Denominator is the responding sites (robots_status != unreachable) unless a
figure says otherwise. Intervals are Wilson 95%, rounded to one decimal.

    python -X utf8 build_stats.py --csv <path to results.csv> --out <path to write stats.json>

Run on the published results.csv, the output is identical to the published
stats.json. See METHOD.md for the columns and the method.
"""
import argparse
import csv
import json
import math
import sys
from pathlib import Path

MEASURED_ON = "2026-10-22"
# Issue 1 funnel numbers that the published rows cannot show: 300 drawn, and
# 29 removed after the draw, which are not published. R21 checks them against
# its unpublished sample file when it prepares the data; see METHOD.md.
ISSUE_1_DRAWN = 300
ISSUE_1_EXCLUDED = 29

BOT_COLUMNS = ["gptbot", "chatgpt_user", "oai_searchbot", "claudebot",
               "perplexitybot", "google_extended", "ccbot", "bytespider"]
Z = 1.96


def wilson(count, n):
    """Wilson 95% interval as percentages rounded to one decimal."""
    p = count / n
    denom = 1 + Z * Z / n
    center = (p + Z * Z / (2 * n)) / denom
    half = Z * math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)) / denom
    return (round(max(0.0, center - half) * 100, 1), round(min(1.0, center + half) * 100, 1))


def _en(x):
    return f"{x:.1f}"


def _es(x):
    return f"{x:.1f}".replace(".", ",")


def figure(count, n, ci=True):
    value = round(100 * count / n, 1)
    labels = [f"{_en(value)}%", f"{_es(value)} %"]
    fig = {"value": value, "n": n, "count": count}
    if ci:
        lo, hi = wilson(count, n)
        fig["ci95"] = [lo, hi]
        labels += [f"{_en(lo)}–{_en(hi)}%", f"{_es(lo)}–{_es(hi)} %"]
    labels += [f"n = {n}", f"n = {count}"]
    fig["labels"] = list(dict.fromkeys(labels))
    return fig


def _named(row, key):
    return bool(row[key])


def build_stats(anon_csv, drawn=None, excluded=None):
    with open(anon_csv, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    resp = [r for r in rows if r["robots_status"] != "unreachable"]
    n = len(resp)

    def blocks_any(r):
        return any(r[c] == "block" for c in BOT_COLUMNS)

    def count(rs, pred):
        return sum(1 for r in rs if pred(r))

    measures = {
        "blocks_any_ai_bot": blocks_any,
        "blocks_named_ai_bot": lambda r: _named(r, "named_block"),
        "blanket_disallow": lambda r: r["blanket_disallow"] == "1",
        "blocks_oai_searchbot": lambda r: r["oai_searchbot"] == "block",
        "blocks_gptbot": lambda r: r["gptbot"] == "block",
        "gptbot_not_searchbot": lambda r: r["gptbot"] == "block" and r["oai_searchbot"] != "block",
        "no_robots": lambda r: r["robots_status"] == "missing",
        "no_usable_robots": lambda r: r["robots_status"] in ("missing", "unusable"),
        "robots_403": lambda r: r["robots_status"] == "denied",
        "homepage_denied": lambda r: r["cdn_or_challenge"] == "challenge",
        "cloudflare_managed": lambda r: r["cloudflare_managed_robots"] == "1",
        "cloudflare_managed_ai_block": lambda r: r["cloudflare_managed_ai_block"] == "1",
        "cloudflare_front": lambda r: r["cdn"] == "cloudflare",
        "names_any_bot": lambda r: _named(r, "named_block") or _named(r, "named_allow"),
        "explicit_allow_only": lambda r: _named(r, "named_allow") and not _named(r, "named_block"),
    }
    figures = {k: figure(count(resp, p), n) for k, p in measures.items()}

    # Among the sites with a robots.txt that has user-agent rules.
    with_rules = [r for r in resp if r["robots_status"] == "ok"]
    figures["among_rules_named_block"] = figure(count(with_rules, measures["blocks_named_ai_bot"]), len(with_rules))
    figures["among_rules_blanket"] = figure(count(with_rules, measures["blanket_disallow"]), len(with_rules))
    figures["robots_with_rules"] = figure(len(with_rules), n)
    figures["unreachable"] = figure(len(rows) - n, len(rows))

    # Per bot: effective block, and block from a rule that names the bot.
    for col in BOT_COLUMNS:
        figures[f"per_bot.{col}"] = figure(count(resp, lambda r, c=col: r[c] == "block"), n)
        figures[f"per_bot_named.{col}"] = figure(
            count(resp, lambda r, c=col: c in r["named_block"].split(";")), n)

    # By source frame: denominators are the responding sites in that frame.
    for frame in sorted({r["source_frame"] for r in rows}):
        in_frame = [r for r in rows if r["source_frame"] == frame]
        fr = [r for r in in_frame if r["robots_status"] != "unreachable"]
        figures[f"source.{frame}.responding"] = figure(len(fr), len(in_frame))
        for k in ("blocks_any_ai_bot", "blocks_oai_searchbot", "no_robots", "robots_403"):
            figures[f"source.{frame}.{k}"] = figure(count(fr, measures[k]), len(fr))

    # By platform guess: share of responding sites, then three counts within the platform.
    by_size = sorted({r["platform"] for r in resp},
                     key=lambda p: (-count(resp, lambda r: r["platform"] == p), p))
    for name in by_size:
        sites = [r for r in resp if r["platform"] == name]
        figures[f"platform.{name}"] = figure(len(sites), n)
        for k in ("blocks_any_ai_bot", "no_robots", "cloudflare_front"):
            figures[f"platform.{name}.{k}"] = figure(count(sites, measures[k]), len(sites))

    funnel = {"retained": len(rows), "unreachable": len(rows) - n, "responding": n, "with_rules": len(with_rules)}
    if drawn is not None:
        funnel = {"drawn": drawn, "excluded": excluded, **funnel}

    labels = [f"n = {n}"] + [f"n = {v}" for v in funnel.values()]
    for fig in figures.values():
        labels.extend(fig["labels"])
    return {
        "measuredOn": MEASURED_ON,
        "n": n,
        "funnel": funnel,
        "figures": figures,
        "labels": list(dict.fromkeys(labels)),
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--csv", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--drawn", type=int, default=ISSUE_1_DRAWN)
    p.add_argument("--excluded", type=int, default=ISSUE_1_EXCLUDED)
    a = p.parse_args(argv)
    stats = build_stats(a.csv, a.drawn, a.excluded)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {a.out}: n={stats['n']}, {len(stats['figures'])} figures, {len(stats['labels'])} labels")
    return 0


if __name__ == "__main__":
    sys.exit(main())
