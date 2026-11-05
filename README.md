# grammar-lee

A Grammarly-style spelling and grammar checker that runs entirely on your Mac. No account, no cloud and nothing you type leaves the machine.

- **Harper** (Automattic's open-source grammar engine, compiled to WebAssembly) runs inside the extension and is always on.
- **LanguageTool** (optional) runs as a local server at `http://localhost:8081` for a second, deeper set of grammar rules. grammar-lee refuses any non-localhost address.

British English by default, with a personal dictionary pre-loaded with your names, projects, societies, and finance and engineering terms.

## Install (2 minutes)

1. Unzip this folder somewhere permanent, e.g. `~/grammar-lee` (Chrome loads it from there, so don't delete it).
2. Open `chrome://extensions`, switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `dist` folder.
4. Pin grammar-lee from the puzzle-piece menu.

Works in Chrome, Arc, Brave, Edge and any Chromium browser (version 116+).

## Using it

- **Autocorrect as you type.** Finish a word with a space, punctuation or Enter and confident typos are fixed on the spot (adn → and, teh → the, recieve → receive, im → I'm). A small toast shows what changed with **Undo**, and ⌘Z works too. Once you undo a word it is never autocorrected again. Names, acronyms, URLs, emails and ambiguous typos (wich could be *which* or *with*) are only underlined, never changed. Toggle it in the toolbar popup.

- Click into any text box. Mistakes get underlined: **red** = correctness (spelling, grammar, punctuation, word choice), **blue** = clarity (style, redundancy, Oxford comma).
- **Hover** an underline to see the fix. Click the green button to apply it. Fixes go through the browser's normal editing path, so **⌘Z undoes them** and sites like Gmail, LinkedIn and Notion register the change.
- The **round badge** in the corner of a field shows the count. Click it for the full list and **Fix all correctness**.
- **Add to dictionary** stops a word being flagged anywhere. **Ignore** dismisses that exact issue everywhere. **Turn off rule** kills a rule you find noisy.
- **Editor** (toolbar popup → Open editor) is a full-page writing space with a suggestions sidebar, word count and autosave. Right-click selected text → *Check selected text in grammar-lee editor* to send text there.
- Turn it off per site from the toolbar popup.

## Deeper checks with LanguageTool (recommended)

Harper is fast and catches the common mistakes. LanguageTool adds thousands more grammar rules, for example subject–verb agreement across long clauses, *its/it's* in context and *your/you're*.

```bash
cd ~/grammar-lee
./setup-languagetool.sh            # installs Java if needed, LanguageTool, and a login item
./setup-languagetool.sh --ngrams   # optional: +8 GB of n-gram data for confused words
./setup-languagetool.sh --uninstall
```

Then open grammar-lee settings → **Use LanguageTool** → **Test**. It runs at login and binds to localhost only. It uses about 1 GB of RAM.

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
src/data/                 word frequencies + common misspellings (built by scripts/build-data.mjs)
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

## How suggestions are ranked

Spelling suggestions use a noisy-channel model, the same idea behind Grammarly and phone keyboards:

```
score(candidate) = log P(candidate)            how common the word is (SUBTLEX word frequencies)
                 - 3.2 x typo cost             how likely you were to make this typo (keyboard-aware edit distance)
                 + context check               candidate put back in the sentence and re-checked; new grammar errors lose
                 + bonuses                     Wikipedia common-misspellings list, fixes you accepted before
```

Typo cost is a weighted Damerau-Levenshtein distance. Swapped letters (adn/and), neighbouring keys, doubled or missed double letters and a missing apostrophe are cheap. Random substitutions are expensive. That is why *adn* now ranks *and* above *ad*. Scores become probabilities. Alternatives far below the best one are hidden (precision over recall), and autocorrect only fires when the best answer clearly wins.

Every fix you accept is learned and ranked first next time (Settings → Learned corrections).

## How it works

Textareas and inputs get an invisible mirror element with identical font metrics drawn over them, carrying the underlines and kept in sync with scrolling and resizing. Rich-text editors (Gmail, LinkedIn, Notion and so on) use the CSS Custom Highlight API, so underlines are painted without touching the page's DOM, which is why they don't break editors. Text is checked about 0.45 s after you stop typing. Results are cached, and when both engines flag the same words Harper's suggestion wins and the overlapping LanguageTool one is dropped.

## Data credits

Word frequencies come from SUBTLEX-US via the `subtlex-word-frequencies` package (ISC). Common misspellings come from Wikipedia's list via the `misspellings` package (GPL-3.0). That licence only matters if you ever publish grammar-lee publicly.
