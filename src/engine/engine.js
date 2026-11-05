// Combines Harper (bundled WASM, always on) with an optional local LanguageTool server.
import { LocalLinter, Dialect, createBinaryModuleFromUrl } from 'harper.js';
import { harperCategory, harperLabel } from './categories.js';
import { ltCheck } from './languagetool.js';
import { SpellRanker, autocorrectable, isKnownMisspelling } from './spell.js';

export function ignoreKey(issue) {
  return `${issue.ruleId}::${issue.problem.toLowerCase()}`;
}

export class Engine {
  constructor(wasmUrl) {
    this.wasmUrl = wasmUrl;
    this.linter = null;
    this.dialect = null;
    this.wordsKey = '';
    this.rulesKey = '';
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
      const { sentence, offset } = sentenceAround(text, i.start, i.end);
      const before = text.slice(offset, i.start).trimEnd();
      const properNoun = /^[A-Z]/.test(i.problem) && before.length > 0 && !/[.!?:]$/.test(before);
      const ranked = await this.ranker.rank(i.problem, { harper: i.suggestions, sentence, start: i.start - offset, learned, properNoun });
      if (ranked.length) {
        i.suggestions = ranked.map((r) => r.word);
        i.confidence = ranked[0].p;
      }
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
    const before = sentence.slice(0, start).trimEnd();
    const midSentenceCapital = /[A-Z]/.test(word[0]) && before.length > 0 && !/[.!?:]$/.test(before);
    const ranked = await this.ranker.rank(word, {
      harper: info.suggestions, sentence, start, learned: settings.learned || {}, properNoun: midSentenceCapital,
    });
    const fix = autocorrectable(word, ranked, { midSentenceCapital });
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
    }

    const wordsKey = settings.words.join('\n');
    if (wordsKey !== this.wordsKey) {
      await this.linter.clearWords();
      if (settings.words.length) await this.linter.importWords(settings.words);
      this.wordsKey = wordsKey;
      this.words = new Set(settings.words.map((w) => w.toLowerCase()));
      this.cache.clear();
      this.wordInfoCache.clear();
    }

    const rulesKey = settings.disabledRules.join(',');
    if (rulesKey !== this.rulesKey) {
      const cfg = await this.linter.getDefaultLintConfig();
      for (const r of settings.disabledRules) if (r in cfg) cfg[r] = false;
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
          isSpelling: kind === 'Spelling' || kind === 'Typo',
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
      issues = merge(h, lt);
      await this.rerankSpelling(issues, text, settings);
      this.cache.set(key, issues);
      if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value);
    }
    return filter(issues, settings);
  }
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
