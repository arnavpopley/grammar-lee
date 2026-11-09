// Service worker: owns the grammar engines; pages talk to it over chrome.runtime messages.
import { Engine, ignoreKey } from './engine/engine.js';
import { getSettings, updateSettings, DEFAULTS } from './shared/settings.js';
import { ltPing } from './engine/languagetool.js';

const engine = new Engine(chrome.runtime.getURL('harper_wasm_slim_bg.wasm'));
let settingsPromise = getSettings();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) settingsPromise = getSettings();
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ settings: DEFAULTS });
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html#welcome') });
  }
  chrome.contextMenus.create({
    id: 'grammar-lee-editor',
    title: 'Check selected text in grammar-lee editor',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'grammar-lee-editor' && info.selectionText) {
    await chrome.storage.local.set({ editorDraft: info.selectionText });
    chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
  }
});

// Warm the engine so the first check is instant.
settingsPromise.then((s) => engine.configure(s)).catch(console.error);

// If a LanguageTool server is running on this machine (./setup-languagetool.sh), use it without being asked.
// Runs whenever the service worker starts, which Chrome does often.
async function autoEnableLanguageTool() {
  const s = await settingsPromise;
  if (!s.languageTool.auto || s.languageTool.enabled) return;
  const r = await ltPing(s.languageTool.url);
  if (r.ok) {
    await updateSettings({ languageTool: { enabled: true } });
    settingsPromise = getSettings();
  }
}
autoEnableLanguageTool().catch(() => {});

async function handle(msg) {
  const settings = await settingsPromise;
  switch (msg.type) {
    case 'check': {
      if (!settings.enabled) return { issues: [] };
      const issues = await engine.check(msg.text, settings);
      return { issues };
    }
    case 'addWord': {
      const word = msg.word.trim();
      if (word && !settings.words.includes(word)) {
        await updateSettings({ words: [...settings.words, word] });
        settingsPromise = getSettings();
      }
      return { ok: true };
    }
    case 'ignore': {
      const key = ignoreKey(msg.issue);
      if (!settings.ignored.includes(key)) {
        await updateSettings({ ignored: [...settings.ignored, key] });
        settingsPromise = getSettings();
      }
      return { ok: true };
    }
    case 'disableRule': {
      if (!settings.disabledRules.includes(msg.ruleId)) {
        await updateSettings({ disabledRules: [...settings.disabledRules, msg.ruleId] });
        settingsPromise = getSettings();
      }
      return { ok: true };
    }
    case 'autocorrect': {
      if (!settings.enabled || !settings.autocorrect) return { fix: null };
      const fix = await engine.autocorrect(msg.word, msg.sentence, msg.start, settings);
      return { fix };
    }
    case 'learn': {
      const typo = msg.typo.toLowerCase();
      if (!/^[a-z']+$/.test(typo) || settings.learned[typo] === msg.correction) return { ok: true };
      const learned = { ...settings.learned, [typo]: msg.correction };
      const keys = Object.keys(learned);
      if (keys.length > 1000) delete learned[keys[0]];
      await updateSettings({ learned, noAutocorrect: settings.noAutocorrect.filter((t) => t !== typo) });
      settingsPromise = getSettings();
      return { ok: true };
    }
    case 'noAutocorrect': {
      const typo = msg.typo.toLowerCase();
      if (settings.noAutocorrect.includes(typo)) return { ok: true };
      const learned = { ...settings.learned };
      delete learned[typo];
      await updateSettings({ noAutocorrect: [...settings.noAutocorrect, typo], learned });
      settingsPromise = getSettings();
      return { ok: true };
    }
    case 'duplicate': {
      // Remember it for the popup; nag on the page at most twice a day.
      const { duplicate } = await chrome.storage.local.get('duplicate');
      const now = Date.now();
      const warn = !duplicate?.warnedAt || now - duplicate.warnedAt > 12 * 3600 * 1000;
      await chrome.storage.local.set({ duplicate: { kind: msg.kind, host: msg.host, at: now, warnedAt: warn ? now : duplicate.warnedAt } });
      return { warn };
    }
    case 'ltPing':
      return ltPing(msg.url || settings.languageTool.url);
    case 'getSettings':
      return settings;
    default:
      return { error: 'unknown message' };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ error: String(e?.message || e) }));
  return true; // async response
});
