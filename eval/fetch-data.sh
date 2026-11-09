#!/usr/bin/env bash
# Downloads the public test data used by `npm run eval` into eval/data (not committed).
set -euo pipefail
cd "$(dirname "$0")/data"
get() { [[ -s "$2" ]] || curl -fsSL "$1" -o "$2"; }
RAW=https://raw.githubusercontent.com
# Spelling: real misspellings with corrections
get "$RAW/clips/pattern/master/test/corpora/spelling-birkbeck.csv" birkbeck.csv          # Birkbeck corpus sample (British)
get "$RAW/codespell-project/codespell/main/codespell_lib/data/dictionary.txt" codespell.txt # typos found in code and docs
get "$RAW/wolfgarbe/SymSpell/master/SymSpell.Benchmark/test_data/noisy_query_en_1000.txt" symspell.txt
# Clean edited text for false-alarm rates
get "$RAW/nltk/nltk_data/gh-pages/packages/corpora/abc.zip" abc.zip          # Australian Broadcasting Commission
get "$RAW/nltk/nltk_data/gh-pages/packages/corpora/reuters.zip" reuters.zip  # Reuters newswire (American)
[[ -d abc ]] || unzip -q abc.zip
[[ -d reuters ]] || unzip -q reuters.zip
echo "eval data ready in $(pwd)"
