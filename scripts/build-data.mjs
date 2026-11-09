// Builds compact spelling data used by the ranker.
//   freq.json         { written, spoken }: lowercase word -> occurrences per billion words
//                     written = SymSpell list (Google Books n-grams ∩ SCOWL spell-checker lexicon), only real words
//                     spoken  = SUBTLEX film subtitles, which also covers contractions and chat words
//   misspellings.json typo -> correction (Wikipedia common misspellings + curated chat typos)
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const SYMSPELL = 'scripts/data/symspell-frequency_dictionary_en_82_765.txt';
if (!existsSync(SYMSPELL)) {
  execSync('mkdir -p scripts/data');
  execSync(`curl -fsSL -o ${SYMSPELL} https://raw.githubusercontent.com/wolfgarbe/SymSpell/master/SymSpell/frequency_dictionary_en_82_765.txt`);
}
function perBillion(map) {
  const total = Object.values(map).reduce((a, b) => a + b, 0);
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = Math.max(1, Math.round((v / total) * 1e9));
  return out;
}
const sym = Object.create(null);
for (const line of readFileSync(SYMSPELL, 'utf8').replace(/^\uFEFF/, '').split('\n')) {
  const [w, c] = line.trim().split(/\s+/);
  if (w && /^[a-z]+$/.test(w) && Number(c) > 0) sym[w] = Number(c);
}
const subtlex = JSON.parse(readFileSync('node_modules/subtlex-word-frequencies/index.json', 'utf8'));
const sub = Object.create(null);
for (const { word, count } of subtlex) {
  const k = word.toLowerCase();
  if (!/^[a-z][a-z'-]*$/.test(k)) continue;
  sub[k] = (sub[k] || 0) + count;
}
const freq = { written: perBillion(sym), spoken: perBillion(sub) };
const wiki = JSON.parse(readFileSync('node_modules/misspellings/dict/lc-dictionary.json', 'utf8'));
const miss = {};
for (const [typo, fix] of Object.entries(wiki)) {
  if (fix.includes(',') || fix.includes(' ')) continue; // ambiguous or multi-word: leave to the ranker
  if (['beng', 'dum', 'toke', 'thru'].includes(typo)) continue; // real words or slang
  miss[typo] = fix;
}
// Contractions typed without apostrophes, and fast-typing slips. Ambiguous ones (its, id, ill, wont, lets, were, hell, shell, well) left out on purpose.
const curated = {
  im: "I'm", ive: "I've", dont: "don't", cant: "can't", doesnt: "doesn't", didnt: "didn't", isnt: "isn't",
  wasnt: "wasn't", werent: "weren't", arent: "aren't", havent: "haven't", hasnt: "hasn't", hadnt: "hadn't",
  couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't", mustnt: "mustn't", youre: "you're",
  theyre: "they're", youve: "you've", theyve: "they've", weve: "we've", youll: "you'll", theyll: "they'll",
  thats: "that's", whats: "what's", hes: "he's", shes: "she's", theres: "there's", heres: "here's",
  wheres: "where's", whos: "who's", aint: "ain't", wouldve: "would've", couldve: "could've", shouldve: "should've",
  adn: 'and', nad: 'and', teh: 'the', hte: 'the', taht: 'that', thta: 'that', waht: 'what', wnat: 'want',
  jsut: 'just', yuo: 'you', yoru: 'your', wiht: 'with', iwth: 'with', becuase: 'because',
  becasue: 'because', beacuse: 'because', knwo: 'know', konw: 'know', woudl: 'would', shoudl: 'should',
  coudl: 'could', thnaks: 'thanks', thakns: 'thanks', thansk: 'thanks', abotu: 'about', baout: 'about',
  peopel: 'people', poeple: 'people', whcih: 'which', wihch: 'which', tehre: 'there', theri: 'their',
  agian: 'again', aslo: 'also', alos: 'also', ahve: 'have', hvae: 'have', ot: 'to', fo: 'of',
  nto: 'not', ont: 'not', tihs: 'this', htis: 'this', thsi: 'this', sicne: 'since', tiem: 'time',
  thign: 'thing', thigns: 'things', soem: 'some', smoe: 'some', liek: 'like', mroe: 'more', moer: 'more',
  owrk: 'work', wrok: 'work', ofr: 'for', yse: 'yes', yeha: 'yeah', okya: 'okay',
};
writeFileSync('src/data/freq.json', JSON.stringify(freq));
writeFileSync('src/data/misspellings.json', JSON.stringify({ wiki: miss, curated }));
console.log('written', Object.keys(freq.written).length, 'spoken', Object.keys(freq.spoken).length, 'wiki', Object.keys(miss).length, 'curated', Object.keys(curated).length);
