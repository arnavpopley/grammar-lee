// grammar-lee evaluation. Runs the exact engine the extension uses, in Node.
//
//   npm run eval                      everything
//   npm run eval -- spelling          one suite (spelling | grammar | clean | private)
//   npm run eval -- --lt              also use a LanguageTool server on localhost:8081
//   npm run eval -- --json out.json   write raw numbers
//
// Suites
//   spelling  Public misspelling lists. Pairs that appear in grammar-lee's own lookup lists are held out,
//             so the number measures the ranker, not memorisation.
//   grammar   eval/grammar-cases.txt: caught / fixed / false alarm on the corrected sentence.
//   clean     Professionally edited news text. Every underline here is (almost always) a false alarm.
//   private   Your own finished writing in eval/private/ (.txt / .md). Never committed.
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Engine } from '../src/engine/engine.js';
import { DEFAULTS } from '../src/shared/settings.js';
import { isKnownMisspelling } from '../src/engine/spell.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'data');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const suites = args.filter((a) => !a.startsWith('--') && !a.endsWith('.json'));
const want = (s) => !suites.length || suites.includes(s);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const LIMIT = Number(process.env.EVAL_LIMIT || 1500);

const engine = new Engine(pathToFileURL(join(HERE, '../node_modules/harper.js/dist/harper_wasm_slim_bg.wasm')).href);
const settingsFor = (dialect, extraWords = []) => ({
  ...DEFAULTS,
  words: [...DEFAULTS.words, ...extraWords],
  dialect,
  languageTool: { ...DEFAULTS.languageTool, enabled: flag('--lt') },
});

// Deterministic sample so runs are comparable.
function sample(arr, n, seed = 7) {
  const a = [...arr];
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');
const results = {};

// ---------------------------------------------------------------- spelling
function loadSpelling() {
  const sets = {};
  const bb = readFileSync(join(DATA, 'birkbeck.csv'), 'utf8').replace(/^﻿/, '');
  sets.birkbeck = {
    dialect: 'British',
    pairs: bb
      .trim()
      .split('\n')
      .map((l) => l.match(/"([^"]+)","([^"]+)"/))
      .filter(Boolean)
      .map((m) => [m[2], m[1]]),
  };
  const cs = readFileSync(join(DATA, 'codespell.txt'), 'utf8');
  sets.codespell = {
    dialect: 'American',
    pairs: cs
      .split('\n')
      .map((l) => l.split('->'))
      .filter(([t, c]) => t && c && !c.includes(',') && /^[a-z]{3,}$/.test(t) && /^[a-z']+$/.test(c.trim()))
      .map(([t, c]) => [t, c.trim()]),
  };
  const sy = readFileSync(join(DATA, 'symspell.txt'), 'utf8');
  sets.symspell = {
    dialect: 'American',
    pairs: sy
      .trim()
      .split('\n')
      .map((l) => l.trim().split(/\s+/))
      .filter((p) => p.length >= 2 && p[0] !== p[1] && /^[a-z]+$/.test(p[0]))
      .map((p) => [p[0], p[1]]),
  };
  return sets;
}

async function spellingSuite() {
  const out = {};
  for (const [name, { dialect, pairs }] of Object.entries(loadSpelling())) {
    const settings = settingsFor(dialect);
    await engine.configure(settings);
    const s = { name, dialect, total: 0, heldOutLookup: 0, realWordTypo: 0, invalidTarget: 0, n: 0, detected: 0, top1: 0, top3: 0, acFired: 0, acRight: 0, acWrong: [] };
    for (const [typo, correct] of sample(pairs, LIMIT)) {
      s.total++;
      if (isKnownMisspelling(typo)) {
        s.heldOutLookup++;
        continue;
      }
      if (!(await engine.wordInfo(correct)).valid) {
        s.invalidTarget++;
        continue;
      }
      const info = await engine.wordInfo(typo);
      s.n++;
      if (info.valid) {
        s.realWordTypo++; // a real word: can't be caught without context
        continue;
      }
      s.detected++;
      const issues = await engine.check(typo, settings);
      const sug = (issues.find((i) => i.isSpelling)?.suggestions || []).map((x) => x.toLowerCase());
      if (sug[0] === correct) s.top1++;
      if (sug.slice(0, 3).includes(correct)) s.top3++;
      const ac = await engine.autocorrect(typo, typo, 0, settings);
      if (ac) {
        s.acFired++;
        if (ac.replacement.toLowerCase() === correct) s.acRight++;
        else if (s.acWrong.length < 12) s.acWrong.push(`${typo}→${ac.replacement} (want ${correct})`);
      }
    }
    out[name] = s;
    console.log(
      `  ${name.padEnd(10)} n=${s.n}  caught ${pct(s.detected, s.n)}  top-1 ${pct(s.top1, s.detected)}  top-3 ${pct(s.top3, s.detected)}` +
        `  autocorrect fires ${pct(s.acFired, s.detected)}, right ${pct(s.acRight, s.acFired)}` +
        `   [held out ${s.heldOutLookup} in lookup lists, ${s.realWordTypo} real-word typos]`,
    );
    if (s.acWrong.length) console.log(`             wrong autocorrects: ${s.acWrong.join(', ')}`);
  }
  results.spelling = out;
}

// ---------------------------------------------------------------- grammar
function diffRegion(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  // widen to whole words
  let start = p;
  while (start > 0 && /\w/.test(a[start - 1])) start--;
  let end = a.length - s;
  while (end < a.length && /\w/.test(a[end])) end++;
  return [start, Math.max(end, start + 1)];
}

function applyTop(text, issues) {
  let t = text;
  for (const i of [...issues].sort((x, y) => y.start - x.start)) {
    if (!i.suggestions.length) continue;
    t = t.slice(0, i.start) + i.suggestions[0] + t.slice(i.end);
  }
  return t;
}

async function grammarSuite() {
  const settings = settingsFor('British');
  const lines = readFileSync(join(HERE, 'grammar-cases.txt'), 'utf8').split('\n');
  let cat = 'misc';
  const byCat = {};
  const misses = [];
  const alarms = [];
  const unfixed = [];
  for (const line of lines) {
    if (line.startsWith('## ')) cat = line.slice(3).trim();
    if (!line.includes('||') || line.startsWith('#')) continue;
    const [bad, good] = line.split('||').map((x) => x.trim());
    const c = (byCat[cat] ||= { n: 0, caught: 0, fixed: 0, alarm: 0 });
    c.n++;
    const [rs, re] = diffRegion(bad, good);
    const issues = await engine.check(bad, settings);
    const hit = issues.some((i) => i.start < re && i.end > rs);
    if (hit) c.caught++;
    else misses.push(bad);
    const applied = applyTop(bad, issues);
    if (applied === good) c.fixed++;
    else if (hit) unfixed.push(`${bad}  →  ${applied}`);
    const fa = await engine.check(good, settings);
    if (fa.length) {
      c.alarm++;
      alarms.push(`${good}  ←  ${fa.map((i) => `${i.ruleId}:"${i.problem}"`).join(', ')}`);
    }
  }
  const tot = Object.values(byCat).reduce((a, c) => ({ n: a.n + c.n, caught: a.caught + c.caught, fixed: a.fixed + c.fixed, alarm: a.alarm + c.alarm }), { n: 0, caught: 0, fixed: 0, alarm: 0 });
  for (const [k, c] of Object.entries(byCat)) console.log(`  ${k.padEnd(28)} caught ${c.caught}/${c.n}  fixed ${c.fixed}/${c.n}  false alarms ${c.alarm}`);
  console.log(`  ${'TOTAL'.padEnd(28)} caught ${pct(tot.caught, tot.n)}  fixed ${pct(tot.fixed, tot.n)}  false alarms on corrected sentences ${pct(tot.alarm, tot.n)}`);
  if (flag('--verbose')) {
    console.log('  missed:\n    ' + misses.join('\n    '));
    console.log('  caught but wrong fix:\n    ' + unfixed.join('\n    '));
    console.log('  false alarms:\n    ' + alarms.join('\n    '));
  } else if (alarms.length) console.log('  false alarms:\n    ' + alarms.slice(0, 15).join('\n    '));
  results.grammar = { total: tot, byCat, misses, alarms };
}

// ---------------------------------------------------------------- clean text
function readCorpus(name) {
  if (name === 'abc') {
    // one sentence per line; blank-free, headlines have no full stop
    const text = ['rural.txt', 'science.txt'].map((f) => readFileSync(join(DATA, 'abc', f), 'latin1')).join('\n');
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 40 && /[.?!]$/.test(l));
    return { dialect: 'Australian', paras: groupLines(lines) };
  }
  if (name === 'reuters') {
    const dir = join(DATA, 'reuters', 'training');
    const paras = [];
    for (const f of readdirSync(dir).sort((a, b) => a - b).slice(0, 4000)) {
      const raw = readFileSync(join(dir, f), 'latin1');
      const body = raw.split('\n').slice(1).join('\n'); // drop ALL-CAPS headline
      for (const p of body.split(/\n\s{4,}/)) {
        const t = p.replace(/\s+/g, ' ').trim();
        if (t.length > 60 && /[a-z]/.test(t) && /[.?!"]$/.test(t) && !/&lt;|Reuter$/.test(t)) paras.push(t.replace(/&amp;/g, '&'));
      }
    }
    return { dialect: 'American', paras };
  }
  throw new Error(name);
}
function groupLines(lines, per = 4) {
  const out = [];
  for (let i = 0; i < lines.length; i += per) out.push(lines.slice(i, i + per).join(' '));
  return out;
}
const words = (t) => (t.match(/[A-Za-z']+/g) || []).length;

// Reuters' house abbreviations are not English words; leaving them in would just measure Reuters style.
const REUTERS_ABBR = ['dlrs', 'dlr', 'mln', 'pct', 'cts', 'shr', 'shrs', 'qtr', 'qtrly', 'revs', 'avg', 'oper', 'bln', 'mths', 'yr', 'div', 'prev', 'nil', 'vs'];

async function falseAlarms(label, paras, dialect, targetWords, extraWords = []) {
  const settings = settingsFor(dialect, extraWords);
  let w = 0;
  const byRule = {};
  let total = 0;
  let spellCap = 0;
  let spellLower = 0;
  for (const p of paras) {
    if (w >= targetWords) break;
    w += words(p);
    const issues = await engine.check(p, settings);
    for (const i of issues) {
      total++;
      const k = `${i.source === 'languagetool' ? 'LT:' : ''}${i.ruleId}`;
      const r = (byRule[k] ||= { n: 0, label: i.label, category: i.category, ex: [] });
      r.n++;
      if (r.ex.length < 4) r.ex.push(`"${i.problem}"${i.suggestions[0] !== undefined ? `→"${i.suggestions[0]}"` : ''}`);
      if (i.isSpelling) /^[A-Z]/.test(i.problem) ? spellCap++ : spellLower++;
    }
  }
  const per1k = (n) => ((1000 * n) / w).toFixed(1);
  console.log(`  ${label.padEnd(10)} ${w} words, ${dialect}: ${per1k(total)} underlines per 1,000 words  (spelling on capitalised words ${per1k(spellCap)}, other spelling ${per1k(spellLower)})`);
  const top = Object.entries(byRule).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  for (const [k, r] of top) console.log(`     ${per1k(r.n).padStart(5)}  ${k.padEnd(34)} ${r.category.padEnd(11)} ${r.ex.join('  ')}`);
  return { words: w, total, per1k: Number(per1k(total)), spellCap, spellLower, byRule };
}

async function cleanSuite() {
  const out = {};
  for (const name of ['abc', 'reuters']) {
    const { dialect, paras } = readCorpus(name);
    out[name] = await falseAlarms(name, sample(paras, paras.length, 3), dialect, Number(process.env.EVAL_WORDS || 20000), name === 'reuters' ? REUTERS_ABBR : []);
  }
  results.clean = out;
}

async function privateSuite() {
  const dir = join(HERE, 'private');
  if (!existsSync(dir)) {
    console.log('  (skipped: put your own finished writing in eval/private/*.txt or *.md)');
    return;
  }
  const paras = [];
  for (const f of readdirSync(dir)) {
    if (!/\.(txt|md)$/.test(f) || !statSync(join(dir, f)).isFile()) continue;
    for (const p of readFileSync(join(dir, f), 'utf8').split(/\n\s*\n/)) {
      const t = p.replace(/\s+/g, ' ').trim();
      if (words(t) >= 6) paras.push(t);
    }
  }
  results.private = await falseAlarms('private', paras, 'British', Infinity);
}

const t0 = Date.now();
console.log(`grammar-lee eval  (LanguageTool ${flag('--lt') ? 'ON' : 'off'})`);
if (want('spelling')) {
  console.log('\nSpelling (public misspelling lists, held-out pairs only)');
  await spellingSuite();
}
if (want('grammar')) {
  console.log('\nGrammar (eval/grammar-cases.txt)');
  await grammarSuite();
}
if (want('clean')) {
  console.log('\nFalse alarms on professionally edited text');
  await cleanSuite();
}
if (want('private')) {
  console.log('\nFalse alarms on your own writing (eval/private)');
  await privateSuite();
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2));
