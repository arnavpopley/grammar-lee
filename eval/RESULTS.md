# grammar-lee evaluation results

Run with `./eval/fetch-data.sh && EVAL_LIMIT=1500 EVAL_WORDS=20000 npm run eval`. Same samples for both versions.
v1.0.0 is commit `6840400`; v1.1.0 is this release. LanguageTool off in both (Harper only).

## Spelling

Real misspellings with known corrections. Pairs that appear in grammar-lee's own typo lists are held out, so this
measures the ranker on typos it has never seen.

| Dataset | Pairs | Right first suggestion | Autocorrect fires | Autocorrect right when it fires |
|---|---|---|---|---|
| Birkbeck (British spelling errors) | 427 | 70.4% → **73.6%** | 29.3% → **32.5%** | 95.1% → **98.5%** |
| codespell (typos found in code and docs) | 1,314 | 67.2% → **78.7%** | 37.0% → **46.1%** | 94.8% → **98.8%** |
| SymSpell (synthetic random noise) | 667 | 45.7% → 44.6% | 9.0% → 8.9% | 76.8% → **83.6%** |

Autocorrect precision is the number that matters most: a wrong autocorrect silently changes what you wrote.
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

## Your own writing

Put finished pieces of your own writing (emails, reports, applications) as `.txt` or `.md` files in `eval/private/`
(git-ignored, never committed) and run `npm run eval -- private`. Every underline it reports is either a real
mistake you shipped or a false alarm worth fixing.
