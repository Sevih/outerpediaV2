"""Count LangMap entries where fr is identical to en (i.e. still untranslated) per file."""
import os, re, sys

ROOT = r"c:\Users\Sevih\Documents\Projet perso\outerpedia-v2\src\app\[lang]\guides\_contents\general-guides"

dirs = ["core-fusion", "daily-stamina", "ether-income", "free-heroes-start-banner",
        "premium-limited", "shop-purchase-priorities", "timegate-resource", "unlock-content"]

# Match { en: '...', jp: ..., kr: ..., zh: ..., fr: '...' }
# We extract en string and fr string and compare.
# Pattern allows " or ' for quote.

def strip_quotes(s):
    if not s:
        return s
    s = s.strip()
    if len(s) >= 2 and s[0] in ("'", '"') and s[-1] == s[0]:
        return s[1:-1]
    return s

# Use a simpler heuristic: find all "fr: '...'" entries and the preceding "en: '...'" within ~600 chars
PAT = re.compile(
    r"en:\s*('(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\")"  # en value
    r".{0,2000}?"
    r"fr:\s*('(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\")",  # fr value
    re.DOTALL,
)

for d in dirs:
    folder = os.path.join(ROOT, d)
    if not os.path.isdir(folder):
        print(f"  [missing] {d}")
        continue
    print(f"\n=== {d} ===")
    for fname in sorted(os.listdir(folder)):
        if not (fname.endswith(".tsx") or fname.endswith(".ts")):
            continue
        path = os.path.join(folder, fname)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        matches = PAT.findall(content)
        total = len(matches)
        same = sum(1 for en, fr in matches if strip_quotes(en) and strip_quotes(en) == strip_quotes(fr))
        print(f"  {fname:30s}  total={total:3d}  fr=en={same:3d}")
