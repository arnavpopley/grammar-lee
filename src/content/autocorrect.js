// Autocorrect as you type: when you finish a word (space, punctuation or Enter), confident typos are
// fixed in place, e.g. "adn " -> "and ". Uses the browser's own editing command so ⌘Z undoes it, and
// shows a small toast with Undo. Undoing teaches grammar-lee never to autocorrect that word again.
import { ui, el as h } from './ui.js';

const BOUNDARY = /^[\s.,!?;:)\]}"”’]$/;
const WORD_CHAR = /[A-Za-z']/;
const BLOCK_BEFORE = /[@#/\\_.:0-9A-Za-z-]/; // part of a URL, email, handle, path or code token

let toast = null;
let toastTimer = null;
let lastFix = null; // { field, original, replacement, at, undo() }

export function isBoundaryInput(e) {
  if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') return true;
  return e.inputType === 'insertText' && typeof e.data === 'string' && BOUNDARY.test(e.data);
}

// Find the word that ends just before `end` in `text`.
function wordBefore(text, end) {
  let we = end;
  while (we > 0 && /["”’)\]]/.test(text[we - 1])) we--; // closing quotes/brackets typed before the boundary
  let ws = we;
  while (ws > 0 && WORD_CHAR.test(text[ws - 1])) ws--;
  while (ws < we && text[ws] === "'") ws++;
  const word = text.slice(ws, we).replace(/'+$/, '');
  we = ws + word.length;
  if (word.length < 2 || !/[A-Za-z]/.test(word)) return null;
  if (ws > 0 && BLOCK_BEFORE.test(text[ws - 1])) return null;
  if (end < text.length && /[@/\\_]/.test(text[end])) return null;
  return { word, ws, we };
}

function sentenceStart(text, ws) {
  let a = ws;
  while (a > 0 && ws - a < 200 && !/[.!?\n]/.test(text[a - 1])) a--;
  return a;
}

export async function maybeAutocorrect(field, e, send) {
  if (!field.state.settings?.autocorrect || field.applying) return;
  if (field.ce) return autocorrectCE(field, send);
  return autocorrectText(field, send);
}

async function autocorrectText(field, send) {
  const el = field.el;
  const caret = el.selectionStart;
  if (caret == null || caret !== el.selectionEnd) return;
  const text = el.value;
  const w = wordBefore(text, caret - 1);
  if (!w) return;
  const a = sentenceStart(text, w.ws);
  const res = await send({ type: 'autocorrect', word: w.word, sentence: text.slice(a, w.we), start: w.ws - a });
  const rep = res?.fix?.replacement;
  if (!rep || el.value.slice(w.ws, w.we) !== w.word) return;

  const caretNow = el.selectionStart;
  const delta = rep.length - w.word.length;
  field.applying = true;
  try {
    el.setSelectionRange(w.ws, w.we);
    const ok = document.execCommand('insertText', false, rep);
    if (!ok || el.value.slice(w.ws, w.ws + rep.length) !== rep) {
      el.setRangeText(rep, w.ws, w.we, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: rep }));
    }
    const pos = caretNow >= w.we ? caretNow + delta : caretNow;
    el.setSelectionRange(pos, pos);
  } finally {
    field.applying = false;
  }
  field.afterExternalEdit();
  const start = w.ws;
  const textGap = Math.max(0, caretNow - w.we);
  showToast(field, w.word, rep, textGap, () => {
    if (el.value.slice(start, start + rep.length) !== rep) return false;
    const keep = el.selectionStart;
    field.applying = true;
    el.setSelectionRange(start, start + rep.length);
    if (!document.execCommand('insertText', false, w.word)) el.setRangeText(w.word, start, start + rep.length, 'end');
    const back = keep >= start + rep.length ? keep - delta : keep;
    el.setSelectionRange(back, back);
    field.applying = false;
    field.afterExternalEdit();
    return true;
  });
}

export function selectionFor(el) {
  const root = el.getRootNode();
  return root instanceof ShadowRoot && root.getSelection ? root.getSelection() : window.getSelection();
}

async function autocorrectCE(field, send) {
  const sel = selectionFor(field.el);
  if (!sel || !sel.isCollapsed || !sel.anchorNode || sel.anchorNode.nodeType !== Node.TEXT_NODE) return;
  const node = sel.anchorNode;
  if (!field.el.contains(node)) return;
  const caret = sel.anchorOffset;
  const text = node.data.replace(/ /g, ' ');
  const w = wordBefore(text, caret - 1);
  if (!w) return;
  const a = sentenceStart(text, w.ws);
  const range = document.createRange();
  range.setStart(node, w.ws);
  range.setEnd(node, w.we);
  const res = await send({ type: 'autocorrect', word: w.word, sentence: text.slice(a, w.we), start: w.ws - a });
  const rep = res?.fix?.replacement;
  if (!rep || range.toString().replace(/\u00a0/g, ' ') !== w.word) return;

  // You may have kept typing while we checked: follow the caret as long as it is still after the word.
  const s2 = selectionFor(field.el);
  if (!s2.isCollapsed || s2.anchorNode !== range.endContainer || s2.anchorOffset < range.endOffset) return;
  const gap = s2.anchorOffset - range.endOffset;
  let repRange = null;
  field.applying = true;
  try {
    s2.removeAllRanges();
    s2.addRange(range);
    if (!document.execCommand('insertText', false, rep)) return;
    // Remember where the replacement now sits (live range), then put the caret back.
    for (let i = 0; i < rep.length; i++) s2.modify('extend', 'backward', 'character');
    if (s2.rangeCount && s2.toString() === rep) repRange = s2.getRangeAt(0).cloneRange();
    s2.collapseToEnd();
    for (let i = 0; i < gap; i++) s2.modify('move', 'forward', 'character');
  } finally {
    field.applying = false;
  }
  field.afterExternalEdit();
  showToast(field, w.word, rep, gap, () => {
    if (!repRange || repRange.toString() !== rep) return false;
    const s3 = selectionFor(field.el);
    const caret = s3.rangeCount ? s3.getRangeAt(0).cloneRange() : null;
    field.applying = true;
    s3.removeAllRanges();
    s3.addRange(repRange);
    document.execCommand('insertText', false, w.word);
    if (caret && caret.startContainer.isConnected) {
      s3.removeAllRanges();
      s3.addRange(caret);
    }
    field.applying = false;
    field.afterExternalEdit();
    return true;
  });
}

function hideToast() {
  clearTimeout(toastTimer);
  toast?.remove();
  toast = null;
}

function showToast(field, original, replacement, gap, undo) {
  hideToast();
  const { shadow } = ui();
  const t = h('div', 'toast');
  t.addEventListener('mousedown', (e) => e.preventDefault());
  const what = h('span', 'tw');
  what.append(h('s', null, original), document.createTextNode(' → '), h('b', null, replacement));
  const btn = h('button', 'tu', 'Undo');
  btn.addEventListener('click', () => {
    if (undo()) field.send({ type: 'noAutocorrect', typo: original });
    hideToast();
    lastFix = null;
  });
  t.append(h('span', 'tdot'), what, btn);
  shadow.append(t);
  const r = field.el.getBoundingClientRect();
  const top = Math.min(window.innerHeight - 40, r.bottom + 6);
  t.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 260))}px`;
  t.style.top = `${top}px`;
  toast = t;
  lastFix = { field, original, replacement, gap, at: Date.now() };
  toastTimer = setTimeout(hideToast, 4500);
}

// ⌘Z straight after an autocorrect counts as "don't do that again".
export function noteUndo(field, e) {
  if (e.inputType !== 'historyUndo' || !lastFix || lastFix.field !== field) return;
  if (Date.now() - lastFix.at > 8000) return;
  const { original, gap } = lastFix;
  field.send({ type: 'noAutocorrect', typo: original });
  lastFix = null;
  hideToast();
  // The browser re-selects the restored word; put the caret back where you were typing instead,
  // otherwise your next keystroke would overwrite it.
  if (!field.ce) {
    const el = field.el;
    if (el.selectionStart !== el.selectionEnd && el.value.slice(el.selectionStart, el.selectionEnd) === original) {
      const pos = Math.min(el.value.length, el.selectionEnd + gap);
      el.setSelectionRange(pos, pos);
    }
    return;
  }
  const sel = selectionFor(field.el);
  if (sel && !sel.isCollapsed && sel.toString() === original) {
    sel.collapseToEnd();
    for (let i = 0; i < gap; i++) sel.modify('move', 'forward', 'character');
  }
}
