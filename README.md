# grammar-lee

A Grammarly-style spelling and grammar checker that runs entirely on your Mac. No account, no cloud and nothing you type leaves the machine.

- **Harper** (Automattic's open-source grammar engine, compiled to WebAssembly) runs inside the extension and is always on.
- **LanguageTool** (optional) runs as a local server at `http://localhost:8081` for a second, deeper set of grammar rules. grammar-lee refuses any non-localhost address.

British English by default, with a personal dictionary pre-loaded with your names, projects, societies, and finance and engineering terms.

## Install (2 minutes)

```bash
cd ~ && git clone https://github.com/arnavpopley/grammar-lee.git
```

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. **Remove any older grammar-lee or Proofline** card first. Two copies underline the same words with different suggestions.
3. Click **Load unpacked** and pick `~/grammar-lee/dist`.
4. Pin grammar-lee from the puzzle-piece menu.

Works in Chrome, Arc, Brave, Edge and any Chromium browser (version 116+).

## Updating

```bash
cd ~/grammar-lee && git pull
```

Then click the reload arrow on the grammar-lee card in `chrome://extensions` and refresh open tabs. The toolbar popup shows the version and build time at the bottom, so you can confirm the new build is the one running.

grammar-lee always has the extension ID `kbdjkpglljjppinjnnloomfgabnmjmaj`, wherever the folder lives. If it spots another copy (an old Proofline or an older grammar-lee) running on the same page, it shows a warning on the page and in the popup.

Your dictionary and learned corrections survive reloads and `git pull`. **Removing** the extension deletes them, so use Settings → **Back up settings** → Export first.

## Using it

- **Autocorrect as you type.** Finish a word with a space, punctuation or Enter and confident typos are fixed on the spot (adn → and, teh → the, recieve → receive, im → I'm). A small toast shows what changed with **Undo**, and ⌘Z works too. Once you undo a word it is never autocorrected again. Names, acronyms, URLs, emails and ambiguous typos (wich could be *which* or *with*) are only underlined, never changed. Toggle it in the toolbar popup.

- Click into any text box. Mistakes get underlined: **red** = correctness (spelling, grammar, punctuation, word choice), **blue** = clarity (style, redundancy, Oxford comma).
- **Hover** an underline to see the fix. Click the green button to apply it. Fixes go through the browser's normal editing path, so **⌘Z undoes them** and sites like Gmail, LinkedIn and Notion register the change.
- The **round badge** in the corner of a field shows the count. Click it for the full list and **Fix all correctness**.
- **Add to dictionary** stops a word being flagged anywhere. **Ignore** dismisses that exact issue everywhere. **Turn off rule** kills a rule you find noisy.
- **Editor** (toolbar popup → Open editor) is a full-page writing space with a suggestions sidebar, word count and autosave. Right-click selected text → *Check selected text in grammar-lee editor* to send text there.
- Turn it off per site from the toolbar popup.

## Deeper checks with LanguageTool (recommended)

Harper is fast and catches the common mistakes. LanguageTool adds thousands more grammar rules, for example *its/it's* and *your/you're* in context, which Harper alone misses (see `eval/RESULTS.md`).

```bash
cd ~/grammar-lee
./setup-languagetool.sh              # Homebrew install + login service on localhost:8081
./setup-languagetool.sh --status
./setup-languagetool.sh --uninstall
```

grammar-lee notices the server and switches LanguageTool on by itself. The popup then shows **LanguageTool: Connected**. It uses Homebrew's `languagetool` package (which brings its own Java), listens on localhost only, and uses about 1 GB of RAM.

## What it doesn't do

- **Google Docs' main editor** draws text on a canvas, so a local extension cannot read it. grammar-lee switches itself off on Docs, Sheets and Slides; write in the grammar-lee editor and paste across.
- Code editors (VS Code web, CodeMirror, Monaco) are skipped on purpose.
- Fields marked `data-gramm="false"` and textareas with `spellcheck="false"` are respected. Login, email, search, phone and payment inputs are skipped.
- No AI rewriting: this is spelling and grammar only.

## Project layout

```
dist/                     load this in Chrome (built output)
src/background.js         service worker: runs the engines
src/engine/               Harper wrapper, LanguageTool client, category mapping, merge logic
src/content/              field detection, underlines, suggestion card, badge, applying fixes
src/engine/spell.js       spelling ranker (error model, frequency model, confidence)
src/content/autocorrect.js  autocorrect as you type, undo, toast
src/content/duplicates.js   warns when another copy of the extension runs on the page
src/data/                 word frequencies + common misspellings (built by scripts/build-data.mjs)
eval/                     quality benchmarks (npm run eval) and RESULTS.md
src/shared/dictionary.js  seed personal dictionary
src/editor.js, options.js, popup.js
static/                   HTML, CSS, manifest, icons
setup-languagetool.sh     local LanguageTool installer (macOS)
```

## Rebuilding after edits

```bash
npm install
npm run build      # outputs to dist/, then hit reload on chrome://extensions
```

## Measuring quality

Every change to the engine should move a number. `npm run eval` runs the extension's own engine against:

- **Spelling:** 2,400 real misspellings (Birkbeck corpus, codespell, SymSpell), with typos already in grammar-lee's lookup lists held out. The key figure is how often autocorrect is right when it fires.
- **Grammar:** 93 typical mistakes in `eval/grammar-cases.txt`. Measures caught, fixed exactly, and false alarms on the corrected sentence.
- **False alarms:** underlines per 1,000 words of professionally edited news text, where almost every underline is wrong.
- **Your writing:** drop finished `.txt`/`.md` files into `eval/private/` (git-ignored) and run `npm run eval -- private`.

```bash
./eval/fetch-data.sh      # once: downloads the public test data
npm run eval              # ~4 minutes; add --lt to include a running LanguageTool server
```

v1.1.0 cut false alarms by about 80% and raised autocorrect accuracy to 98.5–98.8% on real misspellings. Full numbers are in `eval/RESULTS.md`.

## How suggestions are ranked

Spelling suggestions use a noisy-channel model, the same idea behind Grammarly and phone keyboards:

```
score(candidate) = log P(candidate)            how common the word is in written English (82k-word list), spoken as fallback
                 - 3.2 x typo cost             how likely you were to make this typo (keyboard-aware edit distance)
                 + context check               candidate put back in the sentence and re-checked; new grammar errors lose
                 + bonuses                     Wikipedia common-misspellings list, fixes you accepted before
```

Typo cost is a weighted Damerau-Levenshtein distance. Swapped letters (adn/and), neighbouring keys, doubled or missed double letters and a missing apostrophe in a contraction are cheap. Random substitutions are expensive. That is why *adn* ranks *and* above *ad*. Scores become probabilities. Alternatives far below the best one are hidden (precision over recall).

Autocorrect only fires when the best answer clearly wins. If another common word is about as close a slip, nothing is changed and the options are shown instead (*ther* → the / there / their).

Capitalised unknown words are treated as names and left alone unless they are one slip from a common word (*Minsiter*, *Wednsday*). Acronyms, camelCase brands and words with digits are never flagged.

Every fix you accept is learned and ranked first next time (Settings → Learned corrections).

## How it works

Textareas and inputs get an invisible mirror element with identical font metrics drawn over them, carrying the underlines and kept in sync with scrolling and resizing. Rich-text editors (Gmail, LinkedIn, Notion and so on) use the CSS Custom Highlight API, so underlines are painted without touching the page's DOM, which is why they don't break editors. Text is checked about 0.45 s after you stop typing. Results are cached, and when both engines flag the same words Harper's suggestion wins and the overlapping LanguageTool one is dropped.

## Data credits

Written-English word frequencies come from the SymSpell frequency dictionary (MIT, Wolf Garbe; Google Books n-grams intersected with the SCOWL word list). Spoken frequencies come from SUBTLEX-US via the `subtlex-word-frequencies` package (ISC). Common misspellings come from Wikipedia's list via the `misspellings` package (GPL-3.0); because this repo is public and ships that list, the GPL applies to grammar-lee as a whole.

Evaluation data is downloaded at test time and not redistributed: Birkbeck spelling error corpus sample (via the `pattern` project), codespell's dictionary (GPL-2.0), SymSpell's noisy query set (MIT), and the NLTK ABC and Reuters corpora.
