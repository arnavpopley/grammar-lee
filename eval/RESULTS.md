# grammar-lee evaluation results

Run with `./eval/fetch-data.sh && EVAL_LIMIT=1500 EVAL_WORDS=20000 npm run eval`. Same samples for both versions.
v1.0.0 is commit `6840400`; v1.1.0 is this release. LanguageTool off in both (Harper only).

## Spelling

Real misspellings with known corrections. Pairs that appear in grammar-lee's own typo lists are held out, so this
measures the ranker on typos it has never seen.

| Dataset | Pairs | Right first suggestion | Autocorrect fires | Autocorrect right when it fires |
|---|---|---|---|---|
| Birkbeck (British spelling errors) | 551 | 72.4% → **73.1%** | 36.9% → **39.0%** | 96.0% → **98.1%** |
| codespell (typos found in code and docs) | 1,314 | 67.2% → **78.7%** | 37.0% → **46.1%** | 94.8% → **98.8%** |
| SymSpell (synthetic random noise) | 667 | 45.7% → 44.6% | 9.0% → 8.9% | 76.8% → **83.6%** |

Autocorrect precision is the number that matters most: a wrong autocorrect silently changes what you wrote.
One small regression: on Birkbeck the right word is in the top three suggestions slightly less often (85.2% → 82.0%).

(Birkbeck figures corrected 9 Nov 2026: the first version of the harness read rows holding several misspellings,
e.g. "accomodation acommodation", as one typo. Both versions re-measured with the fixed parser.)
SymSpell's random-noise typos (e.g. `cjaring` for *clearing*) are not how people actually mistype, so it is the
least representative set.

## Grammar

`eval/grammar-cases.txt`: 93 sentences with one typical mistake each, plus their corrected versions.

| | v1.0.0 | v1.1.0 |
|---|---|---|
| Mistake underlined | 52.7% | **53.8%** |
| Fixed exactly by the top suggestion | 45.2% | **51.6%** |
| Correct sentences wrongly underlined | 1.1% | **0%** |

Still weak (Harper alone): your/you're 0/4, then/than 1/3, confused words like accept/except and advice/advise
10/27, and real-word typos like *form* for *from* 0/4. These need context, either LanguageTool or a word-pair
model, which is the next step.

## False alarms on professionally edited text

Underlines per 1,000 words of edited news text, where almost every underline is wrong.
Red = correctness, blue = clarity (style suggestions such as long sentences and the Oxford comma, kept on purpose).

| Corpus | v1.0.0 red | v1.1.0 red | Blue (unchanged) |
|---|---|---|---|
| ABC news (Australian) | 27.8 | **5.2** | 3.4 |
| Reuters (American) | 32.8 | **7.0** | 3.7 |

About 80% fewer false alarms. What changed:

- **Names are no longer flagged.** A capitalised unknown word is only underlined when it is one slip from a common
  word (*Minsiter*, *Goverment*, *Wednsday*). Before: *Rosser* → "Tosser", *IUCN* → "Ice", *Xstrata* → "Strata".
- **Acronyms, camelCase brands (OpenSRE, iPhone) and words with digits are skipped.**
- **Real words missing from Harper's dictionary are accepted** if they are in an 82,000-word list of correctly spelt
  English (*graphically*, *repository*, *moratoria*), unless Harper is pointing at the other dialect's spelling.
- **Noisy rules switched off by default:** CompoundNouns (*north Western* → "northWestern"), DisjointPrefixes
  (*non-recurring* → "nonrecurring"), QuantifierNumeralConflict (*some 30 people*), RoadMap (*roadmap*).
- **Compound splitting only for known run-togethers** (*alot*, *atleast*, *eachother*), not *wellbeing* or *biofuels*.

What remains is mostly genuinely rare words, Reuters abbreviations (*bpd*) and British spellings inside American
text (*subsidised*), which is correct behaviour for that dialect setting.

## Reproducibility and stability (re-run 9 Nov 2026)

- A fresh clone of the GitHub repo (`npm ci`, `./eval/fetch-data.sh`, `npm run build`, `npm run eval`) reproduces every
  number above exactly, and its rebuilt `dist/` is byte-identical to the committed one apart from the build stamp.
- Two further random samples (`EVAL_SEED=1`, `EVAL_SEED=2`): autocorrect right 98.5–99.7% when it fires;
  false alarms 7.4–11.4 underlines per 1,000 words. The headline numbers are not sample luck.

## Speed (`npm run eval -- speed`, 2-core cloud machine)

| | Time |
|---|---|
| Engine start-up (Chrome restarts the background worker after ~30 s idle) | 824 ms |
| Check a 75-word email | 5 ms median |
| Autocorrect one word | 5 ms median, 22 ms p90 |
| Check a 6,600-word document, warm | 204 ms |
| Check a 6,600-word document, cold | 4.4 s |

Harper takes about 250 ms per 1,000 words, and grammar-lee re-checks the whole text box after each pause in typing,
so long documents are slow on every edit. Ranking suggestions for unknown words adds ~70 ms each when cold
(18 words in the long document = 1.2 s).

## Measured ideas for the next version (prototypes, not shipped)

| Idea | Measured effect |
|---|---|
| Word-pair model for confused words (SymSpell's 243k Google Books bigrams, contraction bias corrected) | Catches 8 of the 43 grammar cases Harper misses (53.8% → ~62%) for +0.19 underlines per 1,000 words of news text, some of which are real errors in the news (*better then his colleagues*, *though its facing*). 11 of 43 at a looser threshold for +0.49. |
| Check only the paragraph being edited | Typing in a 3,000-word document: ~1–2.5 s per pause → tens of ms |
| Rank suggestions lazily (when the card opens) | Cold check of a long document: −1.2 s |
| Refit error-model weights + estimate missing plurals/adverbs (fit on half of codespell, tested on the other half and Birkbeck) | First suggestion right: codespell 81.9% → 83.9%, Birkbeck 79.8% → 81.1%. Autocorrect fires 49% → 56% and 39% → 46%. Right when it fires: 98.4% → 98.6% (codespell) but 98.1% → 97.2% (Birkbeck). |
| Loosen autocorrect to one missing/extra letter at ≥95% confidence, words of 5+ letters | Fires 39.5% → 46.9% (Birkbeck), 48.5% → 52.8% (codespell); right 98.1% → 97.6%, 98.3% → 98.2% |
| Show more suggestions when unsure | Top-3 82.0% → 82.2%: not worth it; the right word is usually not a candidate at all |

Not measurable here: LanguageTool (its download is blocked in the build environment) and false alarms on your own
writing (needs your files).

## Your own writing

Put finished pieces of your own writing (emails, reports, applications) as `.txt` or `.md` files in `eval/private/`
(git-ignored, never committed) and run `npm run eval -- private`. Every underline it reports is either a real
mistake you shipped or a false alarm worth fixing.
