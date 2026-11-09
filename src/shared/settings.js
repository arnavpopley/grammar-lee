// Shared settings schema and storage helpers.
import { SEED_WORDS } from './dictionary.js';

export const DEFAULTS = {
  enabled: true,
  dialect: 'British', // American | British | Australian | Canadian | Indian
  showClarity: true, // style/readability suggestions (blue) in addition to correctness (red)
  disabledSites: [],
  words: SEED_WORDS, // personal dictionary
  ignored: [], // "ruleId::problem text" keys the user has dismissed everywhere
  disabledRules: [], // Harper or LanguageTool rule ids switched off entirely
  languageTool: {
    enabled: false,
    auto: true, // switch on by itself when a server answers on localhost; false once you set it yourself
    url: 'http://localhost:8081',
    picky: false,
  },
  checkDelayMs: 450,
  autocorrect: true, // fix confident typos (adn -> and) the moment you finish the word
  learned: {}, // typo -> correction you accepted; ranked first next time
  noAutocorrect: [], // typos you undid; never autocorrected again
};

export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  const s = stored.settings || {};
  return {
    ...DEFAULTS,
    ...s,
    languageTool: { ...DEFAULTS.languageTool, ...(s.languageTool || {}) },
  };
}

export async function updateSettings(patch) {
  const cur = await getSettings();
  const next = {
    ...cur,
    ...patch,
    languageTool: { ...cur.languageTool, ...(patch.languageTool || {}) },
  };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export function siteDisabled(settings, hostname) {
  return settings.disabledSites.includes(hostname);
}
