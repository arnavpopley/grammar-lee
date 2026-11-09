// Combines Harper (bundled WASM, always on) with an optional local LanguageTool server.
import { LocalLinter, Dialect, createBinaryModuleFromUrl } from 'harper.js';
import { harperCategory, harperLabel } from './categories.js';
import { ltCheck } from './languagetool.js';
import { SpellRanker, autocorrectable, isKnownMisspelling, isWrittenWord, regionalTwins, freqOf, slipOfCommonWord } from './spell.js';

// Harper rules that mostly produce false alarms on well-edited British text (measured with `npm run eval`):
//   CompoundNouns             "front line" -> "frontline", "north Western" -> "northWestern"
//   DisjointPrefixes          "non-recurring" -> "nonrecurring" (British keeps the hyphen)
//   QuantifierNumeralConflict flags the normal idiom "some 30 people"
//   RoadMap                   "roadmap" -> "road map" (roadmap is standard in tech and business writing)
export const DEFAULT_OFF_RULES = ['CompoundNouns', 'DisjointPrefixes', 'QuantifierNumeralConflict', 'RoadMap'];

// Run-together slips worth flagging. Harper's SplitWords rule also fires on real compounds it doesn't know
// ("wellbeing", "underreported", "biofuels"), so only these are kept.
const RUN_TOGETHER = new Set([
  'alot', 'atleast', 'atleat', 'eachother', 'aswell', 'aswel', 'infront', 'incase', 'everytime', 'thankyou',
  'alittle', 'inspite', 'infact', 'ofcourse', 'eventhough', 'inorder', 'atall', 'aslong', 'abit', 'nomatter', 'ontop',
]);


export function ignoreKey(issue) {
  return `${issue.ruleId}::${issue.problem.toLowerCase()}`;
}

export class Engine {
  constructor(wasmUrl) {
    this.wasmUrl = wasmUrl;
    this.linter = null;
    this.dialect = null;
    this.wordsKey = '';
    this.rulesKey = null;
    this.ready = null;
    this.cache = new Map(); // text+settings -> issues (small LRU)
    this.wordInfoCache = new Map();
    this.words = new Set();
    this.ranker = new SpellRanker({
      isValidWord: async (w) => (await this.wordInfo(w)).valid,
      contextPenalty: (sentence, start, end, cand) => this.contextPenalty(sentence, start, end, cand),
    });
  }

  // Is this a real word for the current dialect + personal dictionary? Also returns Harper's suggestions.
  async wordInfo(word) {
    const key = word;
    if (this.wordInfoCache.has(key)) return this.wordInfoCache.get(key);
    let info;
    if (this.words.has(word.toLowerCase())) info = { valid: true, suggestions: [] };
    else if (isKnownMisspelling(word)) info = { valid: false, suggestions: [] };
    else {
      const lints = await this.linter.lint(word, { language: 'plaintext' });
      const sp = lints.find((l) => {
        const k = l.lint_kind();
        return k === 'Spelling' || k === 'Typo';
      });
      info = sp
        ? { valid: false, suggestions: sp.suggestions().map((x) => x.get_replacement_text()) }
        : { valid: true, suggestions: [] };
    }
    this.wordInfoCache.set(key, info);
    if (this.wordInfoCache.size > 5000) this.wordInfoCache.delete(this.wordInfoCache.keys().next().value);
    return info;
  }

  // How many grammar problems appear around a candidate once it is put into the sentence?
  async contextPenalty(sentence, start, end, cand) {
    const text = sentence.slice(0, start) + cand + sentence.slice(end);
    const lints = await this.linter.lint(text, { language: 'plaintext' });
    const lo = start - 25;
    const hi = start + cand.length + 25;
    let n = 0;
    for (const l of lints) {
      const k = l.lint_kind();
      if (k === 'Spelling' || k === 'Typo' || k === 'Style' || k === 'Readability') continue;
      const sp = l.span();
      if (sp.start < hi && sp.end > lo) n++;
    }
    return n;
  }

  async rerankSpelling(issues, text, settings) {
    const learned = settings.learned || {};
    for (const i of issues) {
      if (!/^[A-Za-z']+$/.test(i.problem)) continue;
      // Some rules misfire on plain misspellings (Harper calls "untill" a wrong negative of "till").
      if (!i.isSpelling && isKnownMisspelling(i.problem) && !this.words.has(i.problem.toLowerCase())) {
        Object.assign(i, { isSpelling: true, label: 'Spelling', category: 'correctness', message: `“${i.problem}” looks misspelt.`, suggestions: [] });
      }
      if (!i.isSpelling) continue;
      if (i.suggestions.some((x) => x !== i.problem && x.toLowerCase() === i.problem.toLowerCase())) {
        Object.assign(i, { label: 'Capitalisation', isSpelling: false });
        continue;
      }
      const { sentence, offset } = sentenceAround(text, i.start, i.end);
      const properNoun = /^[A-Z]/.test(i.problem) && !atSentenceStart(text, i.start);
      const ranked = await this.ranker.rank(i.problem, { harper: i.suggestions, sentence, start: i.start - offset, learned, properNoun });
      if (ranked.length) {
        i.suggestions = ranked.map((r) => r.word);
        i.confidence = ranked[0].p;
      }
      // A capitalised unknown word at the start of a sentence is usually a name ("Rosser said..."), unless it is
      // a very close slip of a common word ("Becuase", "Teh").
      if (/^[A-Z]/.test(i.problem) && !isKnownMisspelling(i.problem)) i.drop = !capitalisedTypo(i.problem, ranked[0], atSentenceStart(text, i.start));
    }
    return issues;
  }

  async autocorrect(word, sentence, start, settings) {
    await this.configure(settings);
    if (!settings.autocorrect) return null;
    const lower = word.toLowerCase();
    if ((settings.noAutocorrect || []).includes(lower)) return null;
    const info = await this.wordInfo(word);
    if (info.valid) return null;
    // Real words Harper doesn't know (or the other dialect's spelling) are only ever underlined, never changed.
    if (isWrittenWord(word) && !(settings.learned || {})[lower]) return null;
    const midSentenceCapital = /[A-Z]/.test(word[0]) && !atSentenceStart(sentence, start);
    const ranked = await this.ranker.rank(word, {
      harper: info.suggestions, sentence, start, learned: settings.learned || {}, properNoun: midSentenceCapital,
    });
    let fix = autocorrectable(word, ranked, { midSentenceCapital });
    // Capitalised words are often names: only change them when it is clearly a slip of a common word.
    if (fix && /^[A-Z]/.test(word)) {
      const b = ranked[0];
      const trusted = b.sources.includes('learned') || b.sources.includes('common');
      if (!trusted && !(b.cost <= 0.5 && freqOf(b.word) >= 10000)) fix = null;
    }
    return fix ? { replacement: fix, confidence: ranked[0].p } : null;
  }

  async configure(settings) {
    if (!this.linter) {
      const binary = createBinaryModuleFromUrl(this.wasmUrl, 'slim');
      this.linter = new LocalLinter({ binary, dialect: Dialect[settings.dialect] ?? Dialect.British });
      this.dialect = settings.dialect;
      this.ready = this.linter.setup();
    }
    await this.ready;

    if (this.dialect !== settings.dialect) {
      await this.linter.setDialect(Dialect[settings.dialect] ?? Dialect.British);
      this.dialect = settings.dialect;
      this.cache.clear();
      this.wordInfoCache.clear();
      this.rulesKey = null; // Harper rebuilds its linter on dialect change; rule switches must be reapplied
    }

    const wordsKey = settings.words.join('\n');
    if (wordsKey !== this.wordsKey) {
      await this.linter.clearWords();
      if (settings.words.length) await this.linter.importWords(settings.words);
      this.wordsKey = wordsKey;
      this.words = new Set(settings.words.map((w) => w.toLowerCase()));
      this.cache.clear();
      this.wordInfoCache.clear();
      this.rulesKey = null;
    }

    const rulesKey = settings.disabledRules.join(',');
    if (rulesKey !== this.rulesKey) {
      const cfg = await this.linter.getDefaultLintConfig();
      for (const r of [...DEFAULT_OFF_RULES, ...settings.disabledRules]) if (r in cfg) cfg[r] = false;
      await this.linter.setLintConfig(cfg);
      this.rulesKey = rulesKey;
      this.cache.clear();
    }
  }

  async harperCheck(text) {
    const groups = await this.linter.organizedLints(text, { language: 'plaintext' });
    const out = [];
    for (const [ruleId, lints] of Object.entries(groups)) {
      for (const lint of lints) {
        const span = lint.span();
        let start = span.start;
        let end = span.end;
        const problem = lint.get_problem_text();
        // Defensive: if offsets ever come back as code points rather than UTF-16 units, convert.
        if (text.slice(start, end) !== problem) {
          const cps = Array.from(text);
          start = cps.slice(0, span.start).join('').length;
          end = start + cps.slice(span.start, span.end).join('').length;
          if (text.slice(start, end) !== problem) continue;
        }
        const kind = lint.lint_kind();
        out.push({
          source: 'harper',
          ruleId,
          start,
          end,
          problem,
          category: harperCategory(kind),
          label: harperLabel(kind),
          message: lint.message(),
          suggestions: uniq(
            lint.suggestions().map((s) => {
              const r = s.get_replacement_text();
              if (s.kind() === 1) return ''; // Remove
              if (s.kind() === 2) return problem + r; // InsertAfter
              return r;
            }),
          ).slice(0, 5),
          isSpelling: ruleId === 'SpellCheck', // unknown words only; targeted rules like ToLoseTooLoose stay grammar
        });
      }
    }
    return out;
  }

  async check(text, settings) {
    await this.configure(settings);
    const key = `${settings.languageTool.enabled}|${settings.languageTool.picky}|${Object.keys(settings.learned || {}).length}|${text}`;
    let issues = this.cache.get(key);
    if (!issues) {
      const [h, lt] = await Promise.all([
        this.harperCheck(text),
        settings.languageTool.enabled ? ltCheck(text, settings) : Promise.resolve([]),
      ]);
      issues = merge(precise([...h, ...firstWordCapital(text, h)], text), precise(lt, text));
      await this.rerankSpelling(issues, text, settings);
      issues = issues.filter((i) => !i.drop);
      this.cache.set(key, issues);
      if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value);
    }
    return filter(issues, settings);
  }
}

// Should a capitalised unknown word be flagged, given its best suggestion? Names far outnumber typos here.
function capitalisedTypo(word, best, sentenceStart) {
  if (!best) return false;
  if (best.sources.includes('learned')) return true;
  if (freqOf(best.word) < 10000) return false; // only slips of common words
  if (sentenceStart) return best.cost <= (word.length <= 4 ? 0.5 : 0.8); // short ones are mostly names: Ord, Bas, Meer
  return best.cost <= 0.5 || (best.cost <= 1.0 && word.length >= 7 && freqOf(best.word) >= 20000);
}

// Is position `start` the first word of a sentence (ignoring opening quotes and brackets)?
export function atSentenceStart(text, start) {
  const before = text.slice(0, start).replace(/["'“‘(\[]+$/, '').trimEnd();
  return before.length === 0 || /[.!?:\n]$/.test(before) || /\n\s*$/.test(text.slice(0, start));
}

// Harper never checks the very first word of a text box; Grammarly does ("the meeting starts at noon.").
// Only for sentence-like text (3+ words), so search boxes and one-word replies stay quiet.
export function firstWordCapital(text, existing) {
  const m = text.match(/^(\s*)([a-z][a-z']*)\b/);
  if (!m || (text.match(/[A-Za-z']+/g) || []).length < 3) return [];
  const word = m[2];
  const start = m[1].length;
  if (!isWrittenWord(word) || existing.some((i) => i.start <= start && i.end > start)) return [];
  return [{
    source: 'harper',
    ruleId: 'FirstWordCapital',
    start,
    end: start + word.length,
    problem: word,
    category: 'correctness',
    label: 'Capitalisation',
    message: 'Start the sentence with a capital letter.',
    suggestions: [word[0].toUpperCase() + word.slice(1)],
    isSpelling: false,
  }];
}

// Drop spelling flags that are almost always wrong in practice, before any expensive ranking.
export function precise(issues, text) {
  return issues.filter((i) => {
    if (i.ruleId === 'SplitWords') return RUN_TOGETHER.has(i.problem.toLowerCase());
    if (!i.isSpelling) return true;
    const w = i.problem;
    if (i.suggestions.some((s) => s !== w && s.toLowerCase() === w.toLowerCase())) return true; // monday -> Monday
    if (/[^A-Za-z'’-]/.test(w)) return false; // digits, symbols: codes, handles, units
    if (/^[A-Z]{2,}(['’]?s)?$/.test(w)) return false; // acronyms: IUCN, NASA's
    if (/[a-z][A-Z]/.test(w)) return false; // camelCase brand names: OpenSRE, iPhone
    if (isKnownMisspelling(w)) return true;
    if (/^[a-z]/.test(w)) {
      // A real word Harper's dictionary lacks: only keep it if Harper is pointing at the other dialect's spelling.
      if (isWrittenWord(w) && !i.suggestions.some((s) => regionalTwins(s, w))) return false;
      return true;
    }
    // Capitalised: usually a name, unless it is one slip away from a common word ("Prime Minsiter").
    return atSentenceStart(text, i.start) || slipOfCommonWord(w);
  });
}

// The sentence containing [start, end), used as context for ranking spelling suggestions.
export function sentenceAround(text, start, end) {
  let a = start;
  while (a > 0 && start - a < 200 && !/[.!?\n]/.test(text[a - 1])) a--;
  let b = end;
  while (b < text.length && b - end < 200 && !/[.!?\n]/.test(text[b])) b++;
  if (b < text.length && /[.!?]/.test(text[b])) b++;
  return { sentence: text.slice(a, b), offset: a };
}

function uniq(list) {
  const seen = new Set();
  return list.filter((s) => {
    const k = s.trimEnd();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Harper first; LanguageTool fills the gaps it does not cover.
export function merge(harper, lt) {
  const out = [...harper];
  for (const m of lt) {
    if (!out.some((h) => overlaps(h, m))) out.push(m);
  }
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  // Drop nested overlaps so underlines never stack.
  const clean = [];
  for (const i of out) {
    const prev = clean[clean.length - 1];
    if (prev && overlaps(prev, i)) continue;
    clean.push(i);
  }
  return clean.map((i, n) => ({ ...i, id: `${i.source}-${i.start}-${i.end}-${n}` }));
}

function filter(issues, settings) {
  const words = new Set(settings.words.map((w) => w.toLowerCase()));
  const ignored = new Set(settings.ignored);
  const disabled = new Set(settings.disabledRules);
  return issues.filter((i) => {
    if (!settings.showClarity && i.category === 'clarity') return false;
    if (disabled.has(i.ruleId)) return false;
    if (ignored.has(ignoreKey(i))) return false;
    if (i.isSpelling && words.has(i.problem.toLowerCase())) return false;
    return true;
  });
}
