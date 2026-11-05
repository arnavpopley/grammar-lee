// One checked text field: reads its text, asks the background engine for issues,
// draws underlines (mirror for textarea/input, CSS Highlight API for contenteditable),
// and applies fixes in a way that keeps the page's undo stack and frameworks in sync.
import { ui, el as h, renderMessage, placeNear } from './ui.js';
import { extract, rangeFor } from './textmodel.js';
import { isBoundaryInput, maybeAutocorrect, noteUndo, selectionFor } from './autocorrect.js';

const MAX_LEN = 60000;
export const fields = new Set();
export const state = { settings: null };

export function send(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(r);
      });
    } catch {
      resolve(null); // extension reloaded: context invalidated
    }
  });
}

export async function loadSettings() {
  state.settings = await send({ type: 'getSettings' });
  return state.settings;
}

const norm = (s) => s.replace(/ /g, ' ');

const MIRROR_PROPS = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch', 'fontKerning',
  'fontFeatureSettings', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textAlign', 'textIndent',
  'textTransform', 'direction', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopStyle',
  'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle', 'overflowWrap', 'wordBreak', 'whiteSpace',
];

export class Field {
  constructor(target, opts = {}) {
    this.el = target;
    this.opts = { badge: true, ...opts };
    this.ce = !(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement);
    this.isInput = target instanceof HTMLInputElement;
    this.issues = [];
    this.seq = 0;
    this.lastText = null;
    this.busy = false;
    this.timer = null;
    this.prevValue = this.ce ? null : target.value;
    this.state = state;
    this.send = send;

    this.origSpellcheck = target.getAttribute('spellcheck');
    target.setAttribute('spellcheck', 'false'); // avoid double red squiggles from the browser

    this.onInput = (e) => {
      if (!this.ce) {
        this.shiftIssues(this.prevValue ?? '', this.el.value);
        this.prevValue = this.el.value;
        this.render();
      }
      if (!this.applying && e instanceof InputEvent) {
        noteUndo(this, e);
        if (isBoundaryInput(e)) maybeAutocorrect(this, e, send);
      }
      this.schedule();
    };
    this.onFocus = () => {
      this.schedule(0);
      this.updateBadge();
    };
    this.onBlur = () => setTimeout(() => this.updateBadge(), 0);
    target.addEventListener('input', this.onInput);
    target.addEventListener('focus', this.onFocus);
    target.addEventListener('blur', this.onBlur);

    if (this.ce) {
      adoptHighlightStyles(target.getRootNode());
      this.mo = new MutationObserver(() => {
        if (!this.applying) this.schedule();
      });
      this.mo.observe(target, { subtree: true, childList: true, characterData: true });
    } else {
      this.buildMirror();
    }
    if (this.opts.badge) this.buildBadge();
    fields.add(this);
    startLoop();
    this.schedule(0);
  }

  destroy() {
    clearTimeout(this.timer);
    this.el.removeEventListener('input', this.onInput);
    this.el.removeEventListener('focus', this.onFocus);
    this.el.removeEventListener('blur', this.onBlur);
    this.mo?.disconnect();
    this.mirror?.remove();
    this.badge?.remove();
    if (this.origSpellcheck == null) this.el.removeAttribute('spellcheck');
    else this.el.setAttribute('spellcheck', this.origSpellcheck);
    this.issues = [];
    fields.delete(this);
    updateHighlights();
    if (card.field === this) hideCard();
  }

  // Text changed by us (autocorrect): keep underlines aligned and re-check.
  afterExternalEdit() {
    if (!this.ce) {
      this.shiftIssues(this.prevValue ?? '', this.el.value);
      this.prevValue = this.el.value;
      this.render();
    }
    this.schedule();
  }

  getText() {
    if (!this.ce) return this.el.value;
    this.model = extract(this.el);
    return this.model.text;
  }

  schedule(delay) {
    clearTimeout(this.timer);
    const d = delay ?? state.settings?.checkDelayMs ?? 450;
    this.timer = setTimeout(() => this.check(), d);
  }

  recheck() {
    this.lastText = null;
    this.schedule(0);
  }

  async check() {
    if (!state.settings?.enabled) return this.setIssues([], '');
    const text = this.getText();
    if (text === this.lastText) return;
    if (!text.trim() || text.length > MAX_LEN) return this.setIssues([], text);
    const seq = ++this.seq;
    this.busy = true;
    this.updateBadge();
    const res = await send({ type: 'check', text });
    if (seq !== this.seq) return;
    this.busy = false;
    if (!res || res.error) {
      this.updateBadge();
      return;
    }
    if (this.getText() !== text) {
      this.schedule();
      return;
    }
    this.setIssues(res.issues, text);
  }

  setIssues(issues, text) {
    this.issues = issues;
    this.lastText = text;
    if (this.ce) {
      for (const i of issues) i.range = rangeFor(this.model, i.start, i.end);
    }
    this.render();
    this.updateBadge();
    this.opts.onUpdate?.(this);
  }

  // Keep textarea underlines aligned while typing, before the next check lands.
  shiftIssues(oldT, newT) {
    let p = 0;
    while (p < oldT.length && p < newT.length && oldT[p] === newT[p]) p++;
    let s = 0;
    while (s < oldT.length - p && s < newT.length - p && oldT[oldT.length - 1 - s] === newT[newT.length - 1 - s]) s++;
    const oldEnd = oldT.length - s;
    const delta = newT.length - oldT.length;
    this.issues = this.issues
      .filter((i) => i.end <= p || i.start >= oldEnd)
      .map((i) => (i.start >= oldEnd ? { ...i, start: i.start + delta, end: i.end + delta } : i));
  }

  liveIssues() {
    if (!this.ce) return this.issues;
    return this.issues.filter((i) => i.range && norm(i.range.toString()) === i.problem);
  }

  // ---------- rendering ----------
  buildMirror() {
    const { layer } = ui();
    this.mirror = h('div', 'mirror');
    this.inner = h('div', 'inner');
    this.mirror.appendChild(this.inner);
    layer.appendChild(this.mirror);
    this.copyStyles();
  }

  copyStyles() {
    const cs = getComputedStyle(this.el);
    const m = this.mirror.style;
    for (const p of MIRROR_PROPS) m[p] = cs[p];
    m.boxSizing = 'border-box';
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const scrollbar = Math.max(0, this.el.offsetWidth - this.el.clientWidth - bl - br);
    m.paddingRight = `${(parseFloat(cs.paddingRight) || 0) + scrollbar}px`;
    if (this.isInput) {
      m.whiteSpace = 'pre';
      m.display = 'flex';
      m.alignItems = 'center';
      this.inner.style.whiteSpace = 'pre';
    } else {
      m.whiteSpace = cs.whiteSpace === 'normal' ? 'pre-wrap' : cs.whiteSpace;
    }
    this.styledFor = `${this.el.offsetWidth}x${this.el.offsetHeight}`;
  }

  render() {
    if (this.ce) {
      updateHighlights();
      return;
    }
    const text = this.el.value;
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const i of this.issues) {
      if (i.start < pos || i.end > text.length) continue;
      frag.append(text.slice(pos, i.start));
      const span = h('span', `u ${i.category}`, text.slice(i.start, i.end));
      span.dataset.id = i.id;
      i.span = span;
      frag.append(span);
      pos = i.end;
    }
    frag.append(`${text.slice(pos)}​`);
    this.inner.replaceChildren(frag);
    this.copyStyles();
  }

  issueRects(issue) {
    if (this.ce) return issue.range ? Array.from(issue.range.getClientRects()) : [];
    return issue.span ? Array.from(issue.span.getClientRects()) : [];
  }

  // Called every animation frame while the field exists.
  frame() {
    if (!this.el.isConnected) {
      this.destroy();
      return;
    }
    const r = this.el.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && this.el.offsetParent !== null;
    if (this.mirror) {
      const m = this.mirror.style;
      if (!visible || !this.issues.length) {
        m.display = 'none';
      } else {
        m.display = this.isInput ? 'flex' : 'block';
        m.left = `${r.left}px`;
        m.top = `${r.top}px`;
        m.width = `${r.width}px`;
        m.height = `${r.height}px`;
        if (`${this.el.offsetWidth}x${this.el.offsetHeight}` !== this.styledFor) this.copyStyles();
        this.inner.style.transform = `translate(${-this.el.scrollLeft}px, ${-this.el.scrollTop}px)`;
        const c = clipRect(this.el);
        m.clipPath = c ? `inset(${Math.max(0, c.top - r.top)}px ${Math.max(0, r.right - c.right)}px ${Math.max(0, r.bottom - c.bottom)}px ${Math.max(0, c.left - r.left)}px)` : 'none';
      }
    }
    if (this.badge) this.positionBadge(r, visible);
  }

  // ---------- badge ----------
  buildBadge() {
    const { layer } = ui();
    this.badge = h('button', 'badge');
    this.badge.title = 'grammar-lee';
    this.badge.style.display = 'none';
    this.badge.addEventListener('mousedown', (e) => e.preventDefault());
    this.badge.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel(this);
    });
    layer.appendChild(this.badge);
  }

  updateBadge() {
    if (!this.badge) return;
    const live = this.liveIssues();
    const corr = live.filter((i) => i.category === 'correctness').length;
    const clar = live.length - corr;
    this.badge.classList.toggle('has', corr > 0);
    this.badge.classList.toggle('clarityonly', corr === 0 && clar > 0);
    this.badge.classList.toggle('busy', this.busy);
    this.badge.textContent = live.length ? String(corr || clar) : '✓';
    this.badge.title = live.length
      ? `${corr} correctness, ${clar} clarity suggestion${clar === 1 ? '' : 's'}`
      : 'No issues found';
  }

  positionBadge(r, visible) {
    const focused = document.activeElement === this.el || this.el.contains(document.activeElement);
    const show = visible && (focused || this.issues.length > 0) && r.width >= 120 && r.height >= 18 && inViewport(r);
    const b = this.badge.style;
    if (!show) {
      b.display = 'none';
      return;
    }
    b.display = 'flex';
    const single = r.height < 60;
    const top = single ? r.top + (r.height - 24) / 2 : r.bottom - 30;
    b.left = `${r.right - 30}px`;
    b.top = `${top}px`;
  }

  // ---------- applying fixes ----------
  async apply(issue, replacement, { recheck = true } = {}) {
    this.applying = true;
    let ok = false;
    try {
      if (!this.ce) ok = this.applyText(issue, replacement);
      else ok = this.applyCE(issue, replacement);
    } finally {
      this.applying = false;
    }
    if (ok && issue.isSpelling && replacement) send({ type: 'learn', typo: issue.problem, correction: replacement });
    this.issues = this.issues.filter((i) => i !== issue);
    if (this.ce) updateHighlights();
    else this.render();
    this.updateBadge();
    this.opts.onUpdate?.(this);
    if (recheck) this.recheck();
    return ok;
  }

  applyText(issue, rep) {
    const el = this.el;
    if (el.value.slice(issue.start, issue.end) !== issue.problem) return false;
    el.focus();
    el.setSelectionRange(issue.start, issue.end);
    let ok = false;
    try {
      ok = rep ? document.execCommand('insertText', false, rep) : document.execCommand('delete');
    } catch {
      ok = false;
    }
    if (!ok || el.value.slice(issue.start, issue.start + rep.length) !== rep) {
      el.setRangeText(rep, issue.start, issue.end, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: rep }));
    }
    return true;
  }

  applyCE(issue, rep) {
    const r = issue.range;
    if (!r || norm(r.toString()) !== issue.problem) return false;
    this.el.focus({ preventScroll: true });
    const sel = selectionFor(this.el);
    sel.removeAllRanges();
    sel.addRange(r.cloneRange());
    let ok = false;
    try {
      ok = rep ? document.execCommand('insertText', false, rep) : document.execCommand('delete');
    } catch {
      ok = false;
    }
    if (!ok) {
      r.deleteContents();
      if (rep) r.insertNode(document.createTextNode(rep));
      this.el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: rep }));
    }
    return true;
  }

  async applyAll(category = 'correctness') {
    const todo = this.liveIssues()
      .filter((i) => i.category === category && i.suggestions.length)
      .sort((a, b) => b.start - a.start);
    for (const i of todo) await this.apply(i, i.suggestions[0], { recheck: false });
    this.recheck();
    return todo.length;
  }

  dropWhere(pred) {
    this.issues = this.issues.filter((i) => !pred(i));
    if (this.ce) updateHighlights();
    else this.render();
    this.updateBadge();
    this.opts.onUpdate?.(this);
  }
}

// ---------- helpers ----------
// Editors inside shadow DOM (some web components) need the ::highlight rules in their own scope.
const HIGHLIGHT_CSS = `
::highlight(grammar-lee-correctness){text-decoration-line:underline;text-decoration-color:#e5484d;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-skip-ink:none}
::highlight(grammar-lee-clarity){text-decoration-line:underline;text-decoration-color:#3e7bfa;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-skip-ink:none}
::highlight(grammar-lee-active){background-color:rgba(229,72,77,.16)}`;
const styledRoots = new WeakSet();
function adoptHighlightStyles(root) {
  if (!(root instanceof ShadowRoot) || styledRoots.has(root)) return;
  styledRoots.add(root);
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(HIGHLIGHT_CSS);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } catch {
    const st = document.createElement('style');
    st.textContent = HIGHLIGHT_CSS;
    root.appendChild(st);
  }
}

function inViewport(r) {
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}

function clipRect(node) {
  let top = 0;
  let left = 0;
  let right = window.innerWidth;
  let bottom = window.innerHeight;
  for (let p = node.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const pr = p.getBoundingClientRect();
      top = Math.max(top, pr.top);
      left = Math.max(left, pr.left);
      right = Math.min(right, pr.right);
      bottom = Math.min(bottom, pr.bottom);
    }
    if (cs.position === 'fixed') break;
  }
  return { top, left, right, bottom };
}

let activeRange = null;
export function updateHighlights() {
  if (!(window.CSS && CSS.highlights)) return;
  const groups = { correctness: [], clarity: [] };
  for (const f of fields) {
    if (!f.ce) continue;
    for (const i of f.issues) if (i.range) groups[i.category]?.push(i.range);
  }
  for (const [k, ranges] of Object.entries(groups)) {
    CSS.highlights.set(`grammar-lee-${k}`, new Highlight(...ranges));
  }
  if (activeRange) CSS.highlights.set('grammar-lee-active', new Highlight(activeRange));
  else CSS.highlights.delete('grammar-lee-active');
}

let looping = false;
function startLoop() {
  if (looping) return;
  looping = true;
  const tick = () => {
    if (!fields.size) {
      looping = false;
      return;
    }
    for (const f of [...fields]) f.frame();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- suggestion card ----------
const card = { box: null, field: null, issue: null, hideTimer: null, showTimer: null };

function setActive(field, issue) {
  for (const f of fields) if (!f.ce) for (const i of f.issues) i.span?.classList.remove('active');
  activeRange = null;
  if (field && issue) {
    if (field.ce) activeRange = issue.range;
    else issue.span?.classList.add('active');
  }
  updateHighlights();
}

export function hideCard() {
  clearTimeout(card.hideTimer);
  clearTimeout(card.showTimer);
  card.box?.remove();
  card.box = null;
  card.field = null;
  card.issue = null;
  setActive(null, null);
}

function sourceName(s) {
  return s === 'languagetool' ? 'LanguageTool' : 'Harper';
}

export function showCard(field, issue, rect) {
  hidePanel();
  if (card.issue === issue && card.box) return;
  hideCard();
  const { shadow } = ui();
  const box = h('div', 'card');
  box.addEventListener('mousedown', (e) => e.preventDefault());
  box.addEventListener('mouseenter', () => clearTimeout(card.hideTimer));
  box.addEventListener('mouseleave', () => scheduleHide());

  const head = h('div', 'head');
  head.append(h('span', `dot ${issue.category}`), h('span', null, issue.label));
  const close = h('button', 'close', '×');
  close.addEventListener('click', hideCard);
  head.append(close);
  box.append(head);

  const sugs = h('div', 'sugs');
  issue.suggestions.slice(0, 4).forEach((s, n) => {
    const b = h('button', n === 0 ? 'sug' : 'sug alt');
    if (n === 0) b.append(h('span', 'old', issue.problem));
    b.append(document.createTextNode(s === '' ? 'Remove' : s));
    b.addEventListener('click', () => {
      hideCard();
      field.apply(issue, s);
    });
    sugs.append(b);
  });
  if (issue.suggestions.length) box.append(sugs);

  const msg = h('div', 'msg');
  renderMessage(msg, issue.message);
  box.append(msg);

  const actions = h('div', 'actions');
  if (issue.isSpelling) {
    const add = h('button', 'act', `Add “${issue.problem}” to dictionary`);
    add.addEventListener('click', async () => {
      hideCard();
      await send({ type: 'addWord', word: issue.problem });
      const w = issue.problem.toLowerCase();
      for (const f of fields) f.dropWhere((i) => i.isSpelling && i.problem.toLowerCase() === w);
    });
    actions.append(add);
  }
  const ign = h('button', 'act', 'Ignore');
  ign.title = 'Ignore this exact issue everywhere';
  ign.addEventListener('click', async () => {
    hideCard();
    await send({ type: 'ignore', issue: { ruleId: issue.ruleId, problem: issue.problem } });
    const key = `${issue.ruleId}::${issue.problem.toLowerCase()}`;
    for (const f of fields) f.dropWhere((i) => `${i.ruleId}::${i.problem.toLowerCase()}` === key);
  });
  actions.append(ign);
  if (!issue.isSpelling) {
    const off = h('button', 'act', 'Turn off rule');
    off.title = `Stop showing ${issue.ruleId}`;
    off.addEventListener('click', async () => {
      hideCard();
      await send({ type: 'disableRule', ruleId: issue.ruleId });
      for (const f of fields) f.dropWhere((i) => i.ruleId === issue.ruleId);
    });
    actions.append(off);
  }
  actions.append(h('span', 'src', sourceName(issue.source)));
  box.append(actions);

  shadow.append(box);
  placeNear(box, rect, 320);
  card.box = box;
  card.field = field;
  card.issue = issue;
  setActive(field, issue);
}

function scheduleHide() {
  clearTimeout(card.hideTimer);
  card.hideTimer = setTimeout(hideCard, 280);
}

function pointIn(r, x, y) {
  return x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 3;
}

export function issueAt(x, y) {
  for (const f of fields) {
    if (!f.issues.length) continue;
    const fr = f.el.getBoundingClientRect();
    if (!pointIn(fr, x, y)) continue;
    for (const i of f.liveIssues()) {
      for (const r of f.issueRects(i)) {
        if (pointIn(r, x, y)) return { field: f, issue: i, rect: r };
      }
    }
  }
  return null;
}

let moveQueued = false;
let lastMove = null;
document.addEventListener(
  'mousemove',
  (e) => {
    lastMove = e;
    if (moveQueued) return;
    moveQueued = true;
    requestAnimationFrame(() => {
      moveQueued = false;
      const { clientX: x, clientY: y } = lastMove;
      if (card.box && pointIn(card.box.getBoundingClientRect(), x, y)) return;
      const hit = issueAt(x, y);
      if (hit) {
        clearTimeout(card.hideTimer);
        if (hit.issue !== card.issue) {
          clearTimeout(card.showTimer);
          card.showTimer = setTimeout(() => showCard(hit.field, hit.issue, hit.rect), 140);
        }
      } else {
        clearTimeout(card.showTimer);
        if (card.box) scheduleHide();
      }
    });
  },
  { passive: true, capture: true },
);

document.addEventListener(
  'mousedown',
  (e) => {
    const path = e.composedPath();
    if (path.includes(ui().host)) return;
    hideCard();
    hidePanel();
  },
  true,
);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideCard();
    hidePanel();
  }
});
window.addEventListener('scroll', () => hideCard(), { capture: true, passive: true });

// ---------- issues panel (from the badge) ----------
let panel = null;
function hidePanel() {
  panel?.remove();
  panel = null;
}

function togglePanel(field) {
  if (panel) {
    hidePanel();
    return;
  }
  hideCard();
  const { shadow } = ui();
  const box = h('div', 'panel');
  box.addEventListener('mousedown', (e) => e.preventDefault());
  const live = field.liveIssues();
  const head = h('div', 'ph');
  head.append(h('span', null, 'grammar-lee'), h('span', 'count', `${live.length} suggestion${live.length === 1 ? '' : 's'}`));
  box.append(head);
  const list = h('div', 'list');
  if (!live.length) list.append(h('div', 'empty', 'Looks good. No issues found.'));
  for (const i of live) {
    const row = h('div', 'item');
    row.append(h('span', `dot ${i.category}`));
    const what = h('div', 'what');
    what.append(h('div', 'lbl', i.label));
    const chg = h('div', 'chg');
    chg.append(h('s', null, i.problem));
    if (i.suggestions.length) {
      chg.append(document.createTextNode(' → '));
      chg.append(h('b', null, i.suggestions[0] === '' ? '(remove)' : i.suggestions[0]));
    }
    what.append(chg);
    row.append(what);
    if (i.suggestions.length) {
      const ok = h('button', 'ok', 'Accept');
      ok.addEventListener('click', (e) => {
        e.stopPropagation();
        hidePanel();
        field.apply(i, i.suggestions[0]);
      });
      row.append(ok);
    }
    row.addEventListener('click', () => {
      const r = field.issueRects(i)[0];
      hidePanel();
      if (r) showCard(field, i, r);
    });
    list.append(row);
  }
  box.append(list);
  const fixable = live.filter((i) => i.category === 'correctness' && i.suggestions.length).length;
  const foot = h('div', 'pf');
  const all = h('button', 'all', `Fix all correctness (${fixable})`);
  all.disabled = !fixable;
  all.addEventListener('click', () => {
    hidePanel();
    field.applyAll('correctness');
  });
  foot.append(all);
  box.append(foot);
  shadow.append(box);
  placeNear(box, field.badge.getBoundingClientRect(), 340);
  panel = box;
}
