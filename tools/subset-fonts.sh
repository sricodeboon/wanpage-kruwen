#!/usr/bin/env bash
# สร้าง Kanit 500/700 แบบ subset (thai + latin) เป็น woff2 ลง site/assets/fonts/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/.venv-fonts"
OUT="$ROOT/site/assets/fonts"
SRC="$ROOT/.venv-fonts/src"
BASE=https://github.com/google/fonts/raw/main/ofl/kanit
THAI='U+0E00-0E7F,U+200B,U+2013,U+2014'
LATIN='U+0020-007E,U+00A0,U+2026'

[ -d "$VENV" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q fonttools brotli
mkdir -p "$SRC" "$OUT"
for w in Medium Bold; do
  [ -s "$SRC/Kanit-$w.ttf" ] || curl -fsSL "$BASE/Kanit-$w.ttf" -o "$SRC/Kanit-$w.ttf"
done
[ -s "$OUT/OFL.txt" ] || curl -fsSL "$BASE/OFL.txt" -o "$OUT/OFL.txt"

sub() { # weight-name weight-num set unicodes
  "$VENV/bin/pyftsubset" "$SRC/Kanit-$1.ttf" --unicodes="$4" --flavor=woff2 \
    --layout-features='*' --output-file="$OUT/kanit-$2-$3.woff2"
}
sub Medium 500 thai "$THAI"; sub Medium 500 latin "$LATIN"
sub Bold 700 thai "$THAI";   sub Bold 700 latin "$LATIN"
ls -l "$OUT"
