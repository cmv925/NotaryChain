#!/usr/bin/env python3
"""
Theme migration script — sweeps legacy dark-theme tokens into the
Corporate Trust Notary palette (cream / navy / coral / slate).

Usage:
    python migrate_theme.py --dry-run [file_or_glob ...]
    python migrate_theme.py --apply [file_or_glob ...]

Token mapping rationale:
    - Page-bg dark hex (#0a0f1a, #0d1b2a, etc.)  →  bg-cream-100
    - Card-bg dark hex (#1a2332, #1a2540)        →  bg-white
    - Teal accent (#00d4aa, #00b894)             →  coral-500 / coral-600
    - Dark borders (#1a2540, #1e293b, gray-700/800)  →  border-slate-200
    - text-gray-300/400/500 (muted on dark)       →  text-slate-500
    - text-gray-600/700                            →  text-slate-700
    - text-gray-200                                →  text-slate-400
    - text-white: LEFT ALONE (only used with bg-navy-900 in current codebase)
"""
import argparse
import re
import sys
from pathlib import Path

# (regex pattern, replacement) — order matters, more specific first
# All patterns use word-boundaries via the surrounding `\b` or explicit chars
# so we don't accidentally match inside other token names.
RULES = [
    # ── Dark page backgrounds → cream-100 ────────────────────────────────────
    (r"\bbg-\[#0a0f1a\]",   "bg-cream-100"),
    (r"\bbg-\[#0a0a0a\]",   "bg-cream-100"),
    (r"\bbg-\[#030712\]",   "bg-cream-100"),
    (r"\bbg-\[#080c14\]",   "bg-cream-100"),
    (r"\bbg-\[#0c1018\]",   "bg-cream-100"),
    (r"\bbg-\[#0a1520\]",   "bg-cream-100"),
    (r"\bbg-\[#0f1520\]",   "bg-cream-100"),
    (r"\bbg-\[#0d1420\]",   "bg-cream-100"),
    (r"\bbg-\[#0d1520\]",   "bg-cream-100"),
    (r"\bbg-\[#0d1b2a\]",   "bg-cream-100"),
    (r"\bbg-\[#0f1825\]",   "bg-cream-100"),
    (r"\bbg-\[#111827\]",   "bg-cream-100"),
    (r"\bbg-\[#162032\]",   "bg-cream-100"),
    # ── Dark card backgrounds → white ────────────────────────────────────────
    (r"\bbg-\[#1a2332\]",   "bg-white"),
    (r"\bbg-\[#1a1a2e\]",   "bg-white"),
    (r"\bbg-\[#1a2540\]",   "bg-white"),
    (r"\bbg-\[#1a2740\]",   "bg-white"),
    (r"\bbg-\[#1e293b\]",   "bg-white"),
    (r"\bbg-\[#060a12\]",   "bg-navy-900"),  # rare — kept dark (footer accent)
    # ── Teal accent → coral ──────────────────────────────────────────────────
    (r"\bbg-\[#00d4aa\]",   "bg-coral-500"),
    (r"\bbg-\[#00b894\]",   "bg-coral-600"),
    (r"\btext-\[#00d4aa\]", "text-coral-600"),
    (r"\bborder-\[#00d4aa\]", "border-coral-500"),
    (r"\bfrom-\[#00d4aa\]", "from-coral-500"),
    (r"\bto-\[#00d4aa\]",   "to-coral-500"),
    (r"\bto-\[#00b894\]",   "to-coral-600"),
    # ── Gradients on dark hex → solid cream backgrounds ──────────────────────
    (r"\bfrom-\[#1a2332\]", "from-white"),
    (r"\bto-\[#0f1825\]",   "to-cream-100"),
    (r"\bto-\[#0d1b2a\]",   "to-cream-100"),
    (r"\bfrom-\[#0d1b2a\]", "from-cream-100"),
    (r"\bfrom-\[#1a1a2e\]", "from-white"),
    (r"\bto-\[#16213e\]",   "to-cream-200"),
    (r"\bto-\[#0d2b1a\]",   "to-emerald-100"),
    # ── Dark border hex → slate-200 ──────────────────────────────────────────
    (r"\bborder-\[#1a2540\]", "border-slate-200"),
    (r"\bborder-\[#1e293b\]", "border-slate-200"),
    (r"\bborder-\[#1a1a2e\]", "border-slate-200"),
    (r"\bborder-\[#334155\]", "border-slate-200"),
    (r"\bborder-\[#333\]",    "border-slate-200"),
    (r"\bborder-\[#555\]",    "border-slate-300"),
    (r"\bbg-\[#333\]",        "bg-slate-200"),
    # ── Legacy gray-* text on dark bg → slate-* on light ─────────────────────
    (r"\btext-gray-200\b", "text-slate-500"),
    (r"\btext-gray-300\b", "text-slate-500"),
    (r"\btext-gray-400\b", "text-slate-500"),
    (r"\btext-gray-500\b", "text-slate-500"),
    (r"\btext-gray-600\b", "text-slate-600"),
    (r"\btext-gray-700\b", "text-slate-700"),
    # ── Legacy gray borders → slate ──────────────────────────────────────────
    (r"\bborder-gray-800\b", "border-slate-200"),
    (r"\bborder-gray-700\b", "border-slate-200"),
    (r"\bborder-gray-600\b", "border-slate-200"),
    (r"\bborder-gray-500\b", "border-slate-300"),
    (r"\bborder-gray-400\b", "border-slate-300"),
    (r"\bborder-gray-300\b", "border-slate-300"),
    (r"\bborder-gray-200\b", "border-slate-200"),
]

# Compile once
COMPILED = [(re.compile(p), r) for p, r in RULES]


def migrate_text(text: str) -> tuple[str, dict]:
    """Apply all rules to text. Returns (new_text, per_rule_counts)."""
    counts = {}
    out = text
    for pat, rep in COMPILED:
        n = 0
        def _sub(m):
            nonlocal n
            n += 1
            return rep
        out = pat.sub(_sub, out)
        if n:
            counts[pat.pattern] = (n, rep)
    return out, counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write changes to disk")
    ap.add_argument("--dry-run", action="store_true", help="Print summary, don't write")
    ap.add_argument("paths", nargs="*", default=["/app/frontend/src/pages"])
    args = ap.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    # Resolve files
    files = []
    for p in args.paths:
        path = Path(p)
        if path.is_dir():
            files.extend(path.rglob("*.jsx"))
        elif path.is_file():
            files.append(path)
        else:
            print(f"skip: {p}", file=sys.stderr)

    total_changes = 0
    files_changed = 0
    grand_counts = {}
    for f in sorted(files):
        try:
            src = f.read_text(encoding="utf-8")
        except Exception as e:
            print(f"!! {f}: {e}", file=sys.stderr)
            continue
        new, counts = migrate_text(src)
        if not counts:
            continue
        n = sum(c for c, _ in counts.values())
        files_changed += 1
        total_changes += n
        for pat, (c, rep) in counts.items():
            grand_counts[pat] = grand_counts.get(pat, [0, rep])
            grand_counts[pat][0] += c
        print(f"  {f.name}: {n} replacements")
        if args.apply:
            f.write_text(new, encoding="utf-8")

    print()
    print(f"FILES touched: {files_changed}")
    print(f"TOTAL replacements: {total_changes}")
    print()
    print("Per-rule:")
    for pat, (c, rep) in sorted(grand_counts.items(), key=lambda x: -x[1][0]):
        print(f"  {c:5d}  {pat!s:40s} -> {rep}")

    if args.dry_run:
        print("\n(dry run — no files written. Re-run with --apply.)")


if __name__ == "__main__":
    main()
