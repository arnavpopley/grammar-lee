// Content script entry: finds editable fields as you focus them and attaches a checker.
import { Field, fields, state, loadSettings, hideCard, send } from './field.js';
import { watchForDuplicates } from './duplicates.js';

const attached = new WeakMap();

const SKIP_INPUT_HINT = /(user|login|email|pass|otp|code|token|card|cvv|cvc|iban|sort|zip|post|phone|tel|url|search|captcha|address|city|amount|price)/i;
const CODE_EDITOR = '.CodeMirror, .cm-editor, .monaco-editor, .ace_editor, [data-language], .view-lines';

function hostBlocked() {
  const { hostname, pathname } = location;
  // Google Docs/Sheets/Slides draw text on a canvas; there is no text for an extension to read.
  if (hostname === 'docs.google.com' && /^\/(document|spreadsheets|presentation)\//.test(pathname)) return true;
  // Their hidden about:blank input iframes too.
  const anc = location.ancestorOrigins ? Array.from(location.ancestorOrigins) : [];
  if (anc.includes('https://docs.google.com')) return true;
  return false;
}

function resolveTarget(node) {
  if (!(node instanceof HTMLElement)) return null;
  if (node.closest('[data-gramm="false"], [data-grammar-lee="off"], grammar-lee-ui')) return null;
  if (node instanceof HTMLTextAreaElement) {
    if (node.readOnly || node.disabled || node.getAttribute('spellcheck') === 'false' && !attached.has(node)) return null;
    if (node.closest(CODE_EDITOR)) return null;
    return node;
  }
  if (node instanceof HTMLInputElement) {
    const type = (node.getAttribute('type') || 'text').toLowerCase();
    if (type !== 'text') return null;
    if (node.readOnly || node.disabled) return null;
    const hint = `${node.name} ${node.id} ${node.autocomplete} ${node.placeholder} ${node.getAttribute('aria-label') || ''}`;
    if (SKIP_INPUT_HINT.test(hint)) return null;
    if (node.getAttribute('role') === 'combobox' || node.getAttribute('role') === 'searchbox') return null;
    return node;
  }
  if (node.isContentEditable) {
    let top = node;
    while (top.parentElement && top.parentElement.isContentEditable) top = top.parentElement;
    if (top.closest(CODE_EDITOR)) return null;
    return top;
  }
  return null;
}

function attach(node) {
  if (!state.settings?.enabled || siteOff()) return;
  const target = resolveTarget(node);
  if (!target || attached.has(target)) return;
  attached.set(target, new Field(target));
}

function siteOff() {
  return hostBlocked() || (state.settings?.disabledSites || []).includes(location.hostname);
}

function detachAll() {
  hideCard();
  for (const f of [...fields]) {
    attached.delete(f.el);
    f.destroy();
  }
}

async function init() {
  await loadSettings();
  if (!state.settings) return;
  document.addEventListener('focusin', (e) => attach(e.composedPath()[0]), true);
  if (window === window.top) watchForDuplicates(send);
  if (document.activeElement) attach(document.activeElement);

  chrome.storage.onChanged.addListener(async (changes) => {
    if (!changes.settings) return;
    await loadSettings();
    if (!state.settings.enabled || siteOff()) {
      detachAll();
      return;
    }
    for (const f of fields) f.recheck();
    if (document.activeElement) attach(document.activeElement);
  });
}

init();
