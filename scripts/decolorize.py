#!/usr/bin/env python3
"""One-shot class-name migration to the semantic token system.

Usage: python3 scripts/decolorize.py <file> [<file> ...]

Maps status colors (green/amber/red) to success/warning/danger tokens and
decorative accents (blue/sky/violet/rose/teal/zinc/orange/yellow/emerald)
to neutrals. Hex colors and chart props are untouched on purpose.
"""
import re
import sys
import pathlib

SPECIALS = [
    # filled primary buttons hand-rolled with green
    ("bg-green-500 hover:bg-green-400 text-green-950",
     "bg-primary hover:bg-primary/90 text-primary-foreground"),
    ("bg-green-600 hover:bg-green-500 text-white",
     "bg-primary hover:bg-primary/90 text-primary-foreground"),
    ("text-amber-600 dark:text-amber-400", "text-warning-fg"),
    ("text-green-600 dark:text-green-400", "text-success-fg"),
    ("text-red-600 dark:text-red-400", "text-danger-fg"),
    ("bg-red-500/[0.07]", "bg-danger-bg"),
    ("focus:border-green-500/40", "focus:border-ring"),
    ("focus:ring-green-500/30", "focus:ring-ring"),
    ("border-green-500 ", "border-primary "),
]

RULES = [
    # status: green -> success
    (r"text-green-[0-9]{3}", "text-success-fg"),
    (r"bg-green-[0-9]{3}/(?:5|\[0\.0[0-9]+\]|10|15)\b", "bg-success-bg"),
    (r"bg-green-[0-9]{3}/(\d+)", r"bg-success/\1"),
    (r"bg-green-[0-9]{3}\b", "bg-success"),
    (r"border-green-[0-9]{3}/\d+", "border-success/25"),
    (r"border-green-[0-9]{3}\b", "border-success"),
    # status: amber/orange/yellow -> warning
    (r"text-(?:amber|orange|yellow)-[0-9]{3}", "text-warning-fg"),
    (r"bg-(?:amber|orange|yellow)-[0-9]{3}/(?:5|\[0\.0[0-9]+\]|10|15)\b", "bg-warning-bg"),
    (r"bg-(?:amber|orange|yellow)-[0-9]{3}/(\d+)", r"bg-warning/\1"),
    (r"bg-(?:amber|orange|yellow)-[0-9]{3}\b", "bg-warning"),
    (r"border-(?:amber|orange|yellow)-[0-9]{3}/\d+", "border-warning/25"),
    (r"border-(?:amber|orange|yellow)-[0-9]{3}\b", "border-warning"),
    # status: red/rose -> danger
    (r"text-(?:red|rose)-[0-9]{3}", "text-danger-fg"),
    (r"bg-(?:red|rose)-[0-9]{3}/(?:5|\[0\.0[0-9]+\]|10|15)\b", "bg-danger-bg"),
    (r"bg-(?:red|rose)-[0-9]{3}/(\d+)", r"bg-danger/\1"),
    (r"bg-(?:red|rose)-[0-9]{3}\b", "bg-danger"),
    (r"border-(?:red|rose)-[0-9]{3}/\d+", "border-danger/25"),
    (r"border-(?:red|rose)-[0-9]{3}\b", "border-danger"),
    # emerald used as accent -> primary
    (r"text-emerald-[0-9]{3}", "text-primary"),
    (r"bg-emerald-[0-9]{3}/(\d+)", r"bg-primary/\1"),
    (r"bg-emerald-[0-9]{3}\b", "bg-primary"),
    (r"border-emerald-[0-9]{3}/\d+", "border-primary/25"),
    # decorative accents -> neutral
    (r"text-(?:blue|sky|violet|purple|teal|cyan|indigo|pink|fuchsia|zinc|slate)-[0-9]{3}", "text-muted-foreground"),
    (r"bg-(?:blue|sky|violet|purple|teal|cyan|indigo|pink|fuchsia)-[0-9]{3}/\d+", "bg-muted"),
    (r"bg-(?:blue|sky|violet|purple|teal|cyan|indigo|pink|fuchsia)-[0-9]{3}\b", "bg-muted"),
    (r"border-(?:blue|sky|violet|purple|teal|cyan|indigo|pink|fuchsia|zinc|slate)-[0-9]{3}/\d+", "border-border"),
    (r"border-(?:blue|sky|violet|purple|teal|cyan|indigo|pink|fuchsia|zinc|slate)-[0-9]{3}\b", "border-border"),
    # stray whites
    (r"bg-white/\[0\.0[0-9]+\]", "bg-muted"),
    (r"border-white/\[0\.0[0-9]+\]", "border-border"),
    (r"border-white/10", "border-border"),
]

def migrate(path: pathlib.Path) -> int:
    t = path.read_text()
    orig = t
    for a, b in SPECIALS:
        t = t.replace(a, b)
    for pat, rep in RULES:
        t = re.sub(pat, rep, t)
    if t != orig:
        path.write_text(t)
    return sum(1 for _ in re.finditer(r"(text|bg|border)-(green|blue|amber|red|violet|rose|sky|teal)-[0-9]", t))

if __name__ == "__main__":
    for f in sys.argv[1:]:
        p = pathlib.Path(f)
        left = migrate(p)
        print(f"{p.name}: {left} colored classes remain")
