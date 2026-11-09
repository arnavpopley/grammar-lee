// Noisy-channel spelling ranker.
//
//   score(c | typo, context) = log P(c)                       language model (word frequency)
//                            + log P(typo | c)                 error model (how people actually mistype)
//                            + context adjustment              does c fit the sentence? (re-checked with Harper)
//                            + personal adjustment             fixes you accepted before
//
// Candidates come from Harper, from every 1-edit (and if needed 2-edit) variant of the typo that is a
// known word, from a list of common misspellings, and from what you have accepted before.
// Then the scores are turned into probabilities, so we know how *confident* the top answer is:
// only confident answers are used for autocorrect, and weak alternatives are hidden.
import FREQ from '../data/freq.json' with { type: 'json' };
import MISSPELLINGS from '../data/misspellings.json' with { type: 'json' };

const WIKI = MISSPELLINGS.wiki; // Wikipedia's list of common misspellings
const CURATED = MISSPELLINGS.curated; // fast-typing slips and contractions without apostrophes

export function isKnownMisspelling(word) {
  const w = word.toLowerCase();
  return w in CURATED || w in WIKI;
}

// ---------- keyboard model (QWERTY) ----------
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const ROW_OFFSET = [0, 0.25, 0.75];
const KEY = {};
ROWS.forEach((row, r) => [...row].forEach((ch, i) => (KEY[ch] = [i + ROW_OFFSET[r], r])));
function adjacent(a, b) {
  const p = KEY[a];
  const q = KEY[b];
  if (!p || !q) return false;
  return Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.3;
}
const VOWELS = new Set('aeiouy');

// ---------- error model: weighted Damerau-Levenshtein (optimal string alignment) ----------
// Costs are in "typo units": lower = more common way to slip.
const COST = {
  transpose: 0.5, // teh -> the, adn -> and
  subAdjacent: 0.7, // keys next to each other
  subVowel: 0.9, // seperate -> separate
  sub: 1.5,
  insDouble: 0.5, // untill -> until (typed a letter twice)
  insAdjacent: 0.8, // fat-fingered a neighbour key
  ins: 1.2,
  delDouble: 0.5, // ocur -> occur (missed a double letter)
  delApostrophe: 0.15, // dont -> don't
  delPossessive: 0.6, // companys -> company's
  del: 1.0,
};

export function errorCost(typoIn, candIn) {
  const t = typoIn.toLowerCase();
  const c = candIn.toLowerCase();
  const n = t.length;
  const m = c.length;
  const d = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) {
    const ch = t[i - 1];
    const dbl = i > 1 && t[i - 2] === ch;
    d[i][0] = d[i - 1][0] + (dbl ? COST.insDouble : COST.ins);
  }
  for (let j = 1; j <= m; j++) {
    const ch = c[j - 1];
    d[0][j] = d[0][j - 1] + (ch === "'" ? (c.slice(j) === 's' ? COST.delPossessive : COST.delApostrophe) : COST.del);
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const a = t[i - 1];
      const b = c[j - 1];
      if (a === b) {
        d[i][j] = d[i - 1][j - 1];
        continue;
      }
      // typo has an extra char a
      const extraDouble = (i > 1 && t[i - 2] === a) || (i < n && t[i] === a);
      const extraAdj = (j > 0 && adjacent(a, c[j - 1])) || (j < m && adjacent(a, c[j]));
      const ins = d[i - 1][j] + (extraDouble ? COST.insDouble : extraAdj ? COST.insAdjacent : COST.ins);
      // typo is missing char b
      const missDouble = (j > 1 && c[j - 2] === b) || (j < m && c[j] === b);
      // A missing apostrophe is cheap in contractions (dont -> don't) but not in possessives (classrooms -> classroom's).
      const apos = b === "'" ? (c.slice(j) === 's' ? COST.delPossessive : COST.delApostrophe) : null;
      const del = d[i][j - 1] + (apos ?? (missDouble ? COST.delDouble : COST.del));
      const subCost = adjacent(a, b) ? COST.subAdjacent : VOWELS.has(a) && VOWELS.has(b) ? COST.subVowel : COST.sub;
      let best = Math.min(ins, del, d[i - 1][j - 1] + subCost);
      if (i > 1 && j > 1 && a === c[j - 2] && t[i - 2] === b) best = Math.min(best, d[i - 2][j - 2] + COST.transpose);
      d[i][j] = best;
    }
  }
  return d[n][m];
}

// ---------- language model: word frequency, British spellings scored like their American twins ----------
const US_VARIANTS = [
  [/our$/, 'or'],
  [/ise$/, 'ize'],
  [/ised$/, 'ized'],
  [/ising$/, 'izing'],
  [/isation$/, 'ization'],
  [/yse$/, 'yze'],
  [/tre$/, 'ter'],
  [/ogue$/, 'og'],
  [/ence$/, 'ense'],
  [/lled$/, 'led'],
  [/lling$/, 'ling'],
];
const WRITTEN = FREQ.written; // per billion words of edited writing (only real words)
const SPOKEN = FREQ.spoken; // per billion words of subtitles (has contractions, chat words, some typos)
const has = (m, k) => Object.prototype.hasOwnProperty.call(m, k);
function rawFreq(w) {
  const a = has(WRITTEN, w) ? WRITTEN[w] : 0;
  const b = has(SPOKEN, w) ? SPOKEN[w] * 0.5 : 0; // spoken counts are a weaker signal for writing
  return Math.max(a, b);
}

// A word in the written list is a real, correctly spelt English word (any dialect).
export function isWrittenWord(word) {
  return has(WRITTEN, word.toLowerCase());
}

export function freqOf(word) {
  const w = word.toLowerCase();
  // Possessives: much rarer than the bare word, and never as common as the plural ("classroom's" vs "classrooms").
  if (/'s$/.test(w)) return rawFreq(w) || rawFreq(w.slice(0, -2)) * 0.15;
  const key = w.replace(/'/g, ''); // contractions are stored without the apostrophe (dont -> don't)
  let f = rawFreq(w) || rawFreq(key);
  for (const [re, rep] of US_VARIANTS) {
    if (re.test(key)) f = Math.max(f, rawFreq(key.replace(re, rep)));
  }
  return f;
}

// colour/color, organise/organize, travelled/traveled: same word, different dialect.
export function regionalTwins(a, b) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return false;
  for (const [re, rep] of US_VARIANTS) {
    if (x.replace(re, rep) === y || y.replace(re, rep) === x) return true;
  }
  return false;
}

// ---------- candidate generation ----------
const ALPHA = "abcdefghijklmnopqrstuvwxyz'";
function edits1(w) {
  const out = new Set();
  for (let i = 0; i <= w.length; i++) {
    const L = w.slice(0, i);
    const R = w.slice(i);
    if (R) out.add(L + R.slice(1)); // delete
    if (R.length > 1) out.add(L + R[1] + R[0] + R.slice(2)); // transpose
    for (const ch of ALPHA) {
      if (R) out.add(L + ch + R.slice(1)); // replace
      out.add(L + ch + R); // insert
    }
  }
  out.delete(w);
  return out;
}
const known = (w) => freqOf(w) > 0;
const knownFast = (w) => has(WRITTEN, w) || has(SPOKEN, w);
const COMMON = 1000; // per billion: roughly the 20,000 most frequent words

// Is this (capitalised) word one cheap slip away from a common word? "Minsiter" -> minister (swapped letters),
// "Tommorow" -> tomorrow. Names almost never are ("Rosser", "Xstrata"), so this separates typos from names.
export function slipOfCommonWord(word) {
  const lower = word.toLowerCase();
  for (const e of edits1(lower)) {
    const f = freqOf(e);
    if (f < 10000) continue;
    const c = errorCost(lower, e);
    if (c <= 0.5) return true; // swapped or doubled letters
    if (c <= 1.0 && lower.length >= 7 && f >= 20000 && e[0] === lower[0]) return true; // "Wednsday": one missed letter in a long common word
  }
  return false;
}

function matchCase(typo, cand) {
  if (cand === "I'm" || cand === "I've" || cand === 'I') return cand;
  if (typo.length > 1 && typo === typo.toUpperCase()) return cand.toUpperCase();
  if (typo[0] === typo[0].toUpperCase() && typo[0] !== typo[0].toLowerCase()) return cand[0].toUpperCase() + cand.slice(1);
  return cand;
}

const K_ERROR = 3.2; // weight of the error model vs the language model (natural-log units)

export class SpellRanker {
  constructor({ isValidWord, contextPenalty }) {
    this.isValidWord = isValidWord; // async (word) => boolean (Harper, respects dialect + personal dictionary)
    this.contextPenalty = contextPenalty; // async (sentence, start, end, candidate) => number of new grammar issues
    this.cache = new Map();
  }

  async rank(typo, { harper = [], sentence = null, start = 0, learned = {}, limit = 3, properNoun = false } = {}) {
    const lower = typo.toLowerCase();
    const cacheKey = `${lower}|${sentence ?? ''}|${start}|${learned[lower] ?? ''}|${harper.join(',')}|${properNoun}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const cands = new Map(); // lowercase -> { word, bonus, sources }
    const add = (w, bonus = 0, src = '') => {
      if (!w || w.toLowerCase() === lower) return;
      // Apostrophes only in real contraction shapes (you're, don't), never "your'".
      if (w.includes("'") && !/^[a-z]+'(t|m|re|ve|ll|s|d)$/i.test(w)) return;
      const k = w.toLowerCase();
      const cur = cands.get(k);
      if (cur) {
        cur.bonus += bonus;
        cur.sources.add(src);
      } else cands.set(k, { word: w, bonus, sources: new Set([src]) });
    };

    if (learned[lower]) add(learned[lower], 12, 'learned');
    if (CURATED[lower]) add(CURATED[lower], 9, 'common');
    else if (WIKI[lower]) add(WIKI[lower], 6, 'common');
    harper.forEach((h, i) => add(h, 0.6 - i * 0.1, 'harper'));
    const e1 = [...edits1(lower)].filter(known);
    e1.forEach((w) => add(w, 0, 'edit1'));
    const strongE1 = e1.some((w) => freqOf(w) >= COMMON);
    if (!strongE1 && lower.length >= 4 && lower.length <= 14) {
      for (const w1 of edits1(lower)) for (const w2 of edits1(w1)) if (knownFast(w2)) add(w2, -0.5, 'edit2');
    }

    // Score
    let scored = [];
    for (const [, c] of cands) {
      const cost = errorCost(lower, c.word);
      const trusted = c.sources.has('learned') || c.sources.has('common');
      // Unknown capitalised words are usually names: only suggest very close matches, never junk like Arjun -> Run.
      const maxCost = properNoun ? 1.2 : 3.2;
      if (cost > maxCost && !trusted) continue;
      const lm = Math.log(freqOf(c.word) + 1);
      scored.push({ ...c, cost, score: lm - K_ERROR * cost + c.bonus });
    }
    scored.sort((a, b) => b.score - a.score);
    scored = scored.slice(0, 12);

    // Must be a real word in the chosen dialect (drops "color" for British, slang not in Harper's dictionary).
    const valid = [];
    for (const s of scored) {
      if (s.sources.has('harper') || s.sources.has('learned') || (await this.isValidWord(s.word))) valid.push(s);
      if (valid.length >= 6) break;
    }

    // Context: put the top few back into the sentence; a candidate that creates new grammar errors loses.
    if (sentence && this.contextPenalty && valid.length > 1) {
      for (const s of valid.slice(0, 4)) {
        const bad = await this.contextPenalty(sentence, start, start + typo.length, matchCase(typo, s.word));
        s.score -= 2.5 * bad;
      }
      valid.sort((a, b) => b.score - a.score);
    }

    // Confidence: softmax over scores.
    const top = valid[0]?.score ?? 0;
    const z = valid.reduce((acc, s) => acc + Math.exp(s.score - top), 0) || 1;
    // Rivals: other common words that are about as close a slip as the best one ("ther" -> the / there / their).
    // Frequency alone would always pick "the"; when there are rivals we show them and never autocorrect.
    const best = valid[0];
    const isRival = (s) => s !== best && s.cost <= best.cost + 0.35 && freqOf(s.word) >= COMMON;
    const rivals = best ? valid.filter(isRival).length : 0;
    const out = valid
      .map((s) => ({ word: matchCase(typo, s.word), p: Math.exp(s.score - top) / z, cost: s.cost, sources: [...s.sources], rival: isRival(s) }))
      // Precision over recall: hide alternatives that are far less likely than the best one, unless they are rivals.
      .filter((s, i) => i === 0 || s.p >= 0.04 || s.rival)
      .slice(0, limit);
    if (out[0]) out[0].rivals = rivals;
    this.cache.set(cacheKey, out);
    if (this.cache.size > 2000) this.cache.delete(this.cache.keys().next().value);
    return out;
  }
}

// When is it safe to change the word for the user without asking?
const SHORT_OK = new Set(['im', 'ot', 'fo']);
export function autocorrectable(typo, ranked, { midSentenceCapital = false } = {}) {
  const best = ranked[0];
  if (!best) return null;
  const lower = typo.toLowerCase();
  if (/[0-9@#_/\\.]/.test(typo)) return null;
  if (typo.length > 1 && typo === typo.toUpperCase()) return null; // acronyms
  if (midSentenceCapital && !best.sources.includes('common') && !best.sources.includes('learned')) return null; // names
  if (lower.length < 3 && !SHORT_OK.has(lower)) return null;
  const trusted = best.sources.includes('learned') || best.sources.includes('common');
  if (trusted && best.p >= 0.6) return best.word;
  if (best.rivals > 0) return null; // several plausible words: underline and let the user pick
  if (best.p >= 0.9 && best.cost <= 0.8 && lower.length >= 4) return best.word;
  if (best.p >= 0.97 && best.cost <= 1.2 && lower.length >= 7) return best.word; // one slip in a long word
  return null;
}
