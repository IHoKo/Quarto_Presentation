#!/usr/bin/env bash
# Build every deliverable, in an order that does not clobber anything.
#
# Quarto deletes the supporting-files directory (ticker_files/) after any
# self-contained render, even one written to dist/. So the standalone build
# has to run FIRST and the normal build LAST, otherwise `ticker.html` is left
# pointing at assets that no longer exist.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> standalone (single file, for sharing)"
quarto render ticker.qmd --profile share

echo "==> presentation build (chalkboard, split assets)"
quarto render ticker.qmd

echo "==> pdf backup"
python3 export-pdf.py ticker.html ticker.pdf

echo
echo "Done:"
echo "  ticker.html        present from this  (needs ticker_files/ + libs/)"
echo "  dist/ticker.html   single file, email or drop on a static host"
echo "  ticker.pdf         backup if all else fails"
