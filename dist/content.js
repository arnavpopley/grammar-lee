(() => {
  // src/content/ui.js
  var CSS2 = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer { position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: 2147483646; pointer-events: none; }
.mirror { position: fixed; overflow: hidden; pointer-events: none; color: transparent !important;
  border-color: transparent !important; background: transparent !important; margin: 0; }
.mirror .inner { position: relative; will-change: transform; }
.u { text-decoration-line: underline; text-decoration-thickness: 2px; text-underline-offset: 3px;
  text-decoration-skip-ink: none; border-radius: 2px; }
.u.correctness { text-decoration-color: #e5484d; }
.u.clarity { text-decoration-color: #3e7bfa; }
.u.active.correctness { background: rgba(229, 72, 77, 0.16) !important; }
.u.active.clarity { background: rgba(62, 123, 250, 0.16) !important; }

.card, .panel { position: fixed; pointer-events: auto; font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
  color: #1c2024; background: #fff; border: 1px solid #e3e5e8; border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(15, 23, 42, 0.08); z-index: 2147483647; }
.card { width: 320px; padding: 12px 14px 10px; }
.head { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #60646c; text-transform: uppercase; letter-spacing: .04em; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dot.correctness { background: #e5484d; } .dot.clarity { background: #3e7bfa; }
.close { margin-left: auto; cursor: pointer; border: 0; background: none; color: #8b8d98; font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 4px; }
.close:hover { background: #f0f0f3; color: #1c2024; }
.sugs { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 6px; }
.sug { cursor: pointer; border: 0; border-radius: 6px; padding: 5px 10px; font: inherit; font-weight: 600; color: #fff; background: #2b7a4b; }
.sug.alt { background: #eef7f1; color: #1f5c38; }
.sug:hover { filter: brightness(1.07); }
.sug .old { text-decoration: line-through; opacity: .65; font-weight: 400; margin-right: 6px; }
.msg { color: #3a3f47; margin: 6px 0 8px; }
.msg code { background: #f3f4f6; border-radius: 4px; padding: 0 4px; font-size: 12px; }
.actions { display: flex; gap: 4px; border-top: 1px solid #f0f0f3; padding-top: 6px; margin-top: 4px; flex-wrap: wrap; }
.act { cursor: pointer; border: 0; background: none; font: inherit; font-size: 12px; color: #60646c; padding: 4px 6px; border-radius: 5px; }
.act:hover { background: #f0f0f3; color: #1c2024; }
.src { margin-left: auto; font-size: 11px; color: #a0a3ab; align-self: center; }

.badge { position: fixed; pointer-events: auto; width: 24px; height: 24px; border-radius: 50%; border: 0; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font: 700 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #fff; background: #2b7a4b; box-shadow: 0 2px 6px rgba(0,0,0,.2); transition: transform .12s; z-index: 2147483647; }
.badge:hover { transform: scale(1.1); }
.badge.has { background: #e5484d; }
.badge.clarityonly { background: #3e7bfa; }
.badge.busy::after { content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid transparent; border-top-color: #2b7a4b; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.panel { width: 340px; max-height: 420px; display: flex; flex-direction: column; overflow: hidden; }
.ph { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #f0f0f3; font-weight: 600; }
.ph .count { color: #8b8d98; font-weight: 500; }
.list { overflow: auto; padding: 6px; }
.item { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; cursor: pointer; }
.item:hover { background: #f7f7f9; }
.item .what { flex: 1; min-width: 0; }
.item .lbl { font-size: 11px; color: #8b8d98; text-transform: uppercase; letter-spacing: .04em; }
.item .chg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item .chg s { color: #a0a3ab; }
.item .chg b { color: #1f5c38; }
.item .ok { border: 0; border-radius: 6px; padding: 4px 8px; background: #eef7f1; color: #1f5c38; font: inherit; font-weight: 600; cursor: pointer; }
.pf { padding: 10px 14px; border-top: 1px solid #f0f0f3; display: flex; gap: 8px; }
.all { cursor: pointer; border: 0; border-radius: 6px; padding: 6px 10px; font: inherit; font-weight: 600; color: #fff; background: #2b7a4b; }
.all[disabled] { opacity: .4; cursor: default; }
.empty { padding: 18px 14px; color: #60646c; }

.dupwarn { position: fixed; right: 16px; bottom: 16px; width: 340px; pointer-events: auto; display: flex; gap: 10px; align-items: flex-start;
  padding: 12px 12px 12px 14px; font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; color: #1c2024;
  background: #fff8e6; border: 1px solid #f3d27a; border-radius: 10px; box-shadow: 0 10px 30px rgba(15,23,42,.16); z-index: 2147483647; }
.dupwarn .dwb { flex: none; border: 0; border-radius: 6px; padding: 5px 10px; background: #1c2024; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.toast { position: fixed; pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 7px 8px 7px 12px;
  font: 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; color: #fff; background: #1c2024;
  border-radius: 9px; box-shadow: 0 8px 24px rgba(0,0,0,.25); z-index: 2147483647; animation: pop .14s ease-out; }
@keyframes pop { from { transform: translateY(4px); opacity: 0; } }
.toast .tdot { width: 7px; height: 7px; border-radius: 50%; background: #3fbf6f; }
.toast s { color: #9ba1a9; }
.toast b { color: #7ee0a3; }
.toast .tu { border: 0; background: #33383f; color: #fff; border-radius: 6px; padding: 4px 9px; font: inherit; font-weight: 600; cursor: pointer; }
.toast .tu:hover { background: #454b54; }
`;
  var root = null;
  function ui() {
    if (root) return root;
    const host = document.createElement("grammar-lee-ui");
    host.setAttribute("data-grammar-lee", "off");
    host.dataset.glId = chrome.runtime.id;
    const shadow = host.attachShadow({ mode: "open" });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS2);
      shadow.adoptedStyleSheets = [sheet];
    } catch {
      const st = document.createElement("style");
      st.textContent = CSS2;
      shadow.appendChild(st);
    }
    const layer = document.createElement("div");
    layer.className = "layer";
    shadow.appendChild(layer);
    (document.body || document.documentElement).appendChild(host);
    root = { host, shadow, layer };
    return root;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function renderMessage(target, message) {
    const parts = message.split("`");
    parts.forEach((p, i) => {
      if (i % 2) target.appendChild(el("code", null, p));
      else target.appendChild(document.createTextNode(p));
    });
  }
  function placeNear(box, rect, width) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(Math.max(8, rect.left), vw - width - 8);
    box.style.left = `${left}px`;
    box.style.top = "0px";
    box.style.visibility = "hidden";
    requestAnimationFrame(() => {
      const h = box.offsetHeight;
      let top = rect.bottom + 6;
      if (top + h > vh - 8) top = Math.max(8, rect.top - h - 6);
      box.style.top = `${top}px`;
      box.style.visibility = "visible";
    });
  }

  // src/content/textmodel.js
  var BLOCK = /* @__PURE__ */ new Set([
    "ADDRESS",
    "ARTICLE",
    "ASIDE",
    "BLOCKQUOTE",
    "DD",
    "DIV",
    "DL",
    "DT",
    "FIELDSET",
    "FIGCAPTION",
    "FIGURE",
    "FOOTER",
    "FORM",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HEADER",
    "HR",
    "LI",
    "MAIN",
    "NAV",
    "OL",
    "P",
    "PRE",
    "SECTION",
    "TABLE",
    "TR",
    "TD",
    "TH",
    "UL"
  ]);
  var SKIP = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "IMG", "VIDEO", "AUDIO", "CANVAS", "CODE"]);
  function skipElement(el2) {
    if (SKIP.has(el2.tagName)) return true;
    if (el2.getAttribute("contenteditable") === "false") return true;
    if (el2.getAttribute("data-gramm") === "false" || el2.getAttribute("data-grammar-lee") === "off") return true;
    const cls = el2.className && typeof el2.className === "string" ? el2.className : "";
    if (/\bgmail_(quote|signature)\b/.test(cls)) return true;
    return false;
  }
  function extract(root2) {
    const segs = [];
    let text = "";
    const nl = () => {
      if (text && !text.endsWith("\n")) text += "\n";
    };
    const walk = (node) => {
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === Node.TEXT_NODE) {
          if (!c.data) continue;
          segs.push({ node: c, start: text.length, len: c.data.length });
          text += c.data;
        } else if (c.nodeType === Node.ELEMENT_NODE) {
          if (c.tagName === "BR") {
            text += "\n";
            continue;
          }
          if (skipElement(c)) {
            if (text && !/\s$/.test(text)) text += " ";
            continue;
          }
          const block = BLOCK.has(c.tagName);
          if (block) nl();
          walk(c);
          if (block) nl();
        }
      }
    };
    walk(root2);
    return { text: text.replace(/ /g, " "), segs };
  }
  function locate(segs, offset, preferNext) {
    let lo = 0;
    let hi = segs.length - 1;
    while (lo <= hi) {
      const mid = lo + hi >> 1;
      const s = segs[mid];
      if (offset < s.start) hi = mid - 1;
      else if (offset > s.start + s.len) lo = mid + 1;
      else {
        if (preferNext && offset === s.start + s.len && segs[mid + 1] && segs[mid + 1].start === offset) {
          return { node: segs[mid + 1].node, offset: 0 };
        }
        return { node: s.node, offset: offset - s.start };
      }
    }
    const next = segs[lo];
    if (next) return { node: next.node, offset: 0 };
    const last = segs[segs.length - 1];
    return last ? { node: last.node, offset: last.len } : null;
  }
  function rangeFor(model, start, end) {
    const a = locate(model.segs, start, true);
    const b = locate(model.segs, end, false);
    if (!a || !b) return null;
    if (!a.node.isConnected || !b.node.isConnected) return null;
    try {
      const r = document.createRange();
      r.setStart(a.node, Math.min(a.offset, a.node.data.length));
      r.setEnd(b.node, Math.min(b.offset, b.node.data.length));
      return r;
    } catch {
      return null;
    }
  }

  // src/content/autocorrect.js
  var BOUNDARY = /^[\s.,!?;:)\]}"”’]$/;
  var WORD_CHAR = /[A-Za-z']/;
  var BLOCK_BEFORE = /[@#/\\_.:0-9A-Za-z-]/;
  var toast = null;
  var toastTimer = null;
  var lastFix = null;
  function isBoundaryInput(e) {
    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") return true;
    return e.inputType === "insertText" && typeof e.data === "string" && BOUNDARY.test(e.data);
  }
  function wordBefore(text, end) {
    let we = end;
    while (we > 0 && /["”’)\]]/.test(text[we - 1])) we--;
    let ws = we;
    while (ws > 0 && WORD_CHAR.test(text[ws - 1])) ws--;
    while (ws < we && text[ws] === "'") ws++;
    const word = text.slice(ws, we).replace(/'+$/, "");
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
  async function maybeAutocorrect(field, e, send2) {
    if (!field.state.settings?.autocorrect || field.applying) return;
    if (field.ce) return autocorrectCE(field, send2);
    return autocorrectText(field, send2);
  }
  async function autocorrectText(field, send2) {
    const el2 = field.el;
    const caret = el2.selectionStart;
    if (caret == null || caret !== el2.selectionEnd) return;
    const text = el2.value;
    const w = wordBefore(text, caret - 1);
    if (!w) return;
    const a = sentenceStart(text, w.ws);
    const res = await send2({ type: "autocorrect", word: w.word, sentence: text.slice(a, w.we), start: w.ws - a });
    const rep = res?.fix?.replacement;
    if (!rep || el2.value.slice(w.ws, w.we) !== w.word) return;
    const caretNow = el2.selectionStart;
    const delta = rep.length - w.word.length;
    field.applying = true;
    try {
      el2.setSelectionRange(w.ws, w.we);
      const ok = document.execCommand("insertText", false, rep);
      if (!ok || el2.value.slice(w.ws, w.ws + rep.length) !== rep) {
        el2.setRangeText(rep, w.ws, w.we, "end");
        el2.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: rep }));
      }
      const pos = caretNow >= w.we ? caretNow + delta : caretNow;
      el2.setSelectionRange(pos, pos);
    } finally {
      field.applying = false;
    }
    field.afterExternalEdit();
    const start = w.ws;
    const textGap = Math.max(0, caretNow - w.we);
    showToast(field, w.word, rep, textGap, () => {
      if (el2.value.slice(start, start + rep.length) !== rep) return false;
      const keep = el2.selectionStart;
      field.applying = true;
      el2.setSelectionRange(start, start + rep.length);
      if (!document.execCommand("insertText", false, w.word)) el2.setRangeText(w.word, start, start + rep.length, "end");
      const back = keep >= start + rep.length ? keep - delta : keep;
      el2.setSelectionRange(back, back);
      field.applying = false;
      field.afterExternalEdit();
      return true;
    });
  }
  function selectionFor(el2) {
    const root2 = el2.getRootNode();
    return root2 instanceof ShadowRoot && root2.getSelection ? root2.getSelection() : window.getSelection();
  }
  async function autocorrectCE(field, send2) {
    const sel = selectionFor(field.el);
    if (!sel || !sel.isCollapsed || !sel.anchorNode || sel.anchorNode.nodeType !== Node.TEXT_NODE) return;
    const node = sel.anchorNode;
    if (!field.el.contains(node)) return;
    const caret = sel.anchorOffset;
    const text = node.data.replace(/ /g, " ");
    const w = wordBefore(text, caret - 1);
    if (!w) return;
    const a = sentenceStart(text, w.ws);
    const range = document.createRange();
    range.setStart(node, w.ws);
    range.setEnd(node, w.we);
    const res = await send2({ type: "autocorrect", word: w.word, sentence: text.slice(a, w.we), start: w.ws - a });
    const rep = res?.fix?.replacement;
    if (!rep || range.toString().replace(/\u00a0/g, " ") !== w.word) return;
    const s2 = selectionFor(field.el);
    if (!s2.isCollapsed || s2.anchorNode !== range.endContainer || s2.anchorOffset < range.endOffset) return;
    const gap = s2.anchorOffset - range.endOffset;
    let repRange = null;
    field.applying = true;
    try {
      s2.removeAllRanges();
      s2.addRange(range);
      if (!document.execCommand("insertText", false, rep)) return;
      for (let i = 0; i < rep.length; i++) s2.modify("extend", "backward", "character");
      if (s2.rangeCount && s2.toString() === rep) repRange = s2.getRangeAt(0).cloneRange();
      s2.collapseToEnd();
      for (let i = 0; i < gap; i++) s2.modify("move", "forward", "character");
    } finally {
      field.applying = false;
    }
    field.afterExternalEdit();
    showToast(field, w.word, rep, gap, () => {
      if (!repRange || repRange.toString() !== rep) return false;
      const s3 = selectionFor(field.el);
      const caret2 = s3.rangeCount ? s3.getRangeAt(0).cloneRange() : null;
      field.applying = true;
      s3.removeAllRanges();
      s3.addRange(repRange);
      document.execCommand("insertText", false, w.word);
      if (caret2 && caret2.startContainer.isConnected) {
        s3.removeAllRanges();
        s3.addRange(caret2);
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
    const t = el("div", "toast");
    t.addEventListener("mousedown", (e) => e.preventDefault());
    const what = el("span", "tw");
    what.append(el("s", null, original), document.createTextNode(" \u2192 "), el("b", null, replacement));
    const btn = el("button", "tu", "Undo");
    btn.addEventListener("click", () => {
      if (undo()) field.send({ type: "noAutocorrect", typo: original });
      hideToast();
      lastFix = null;
    });
    t.append(el("span", "tdot"), what, btn);
    shadow.append(t);
    const r = field.el.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 40, r.bottom + 6);
    t.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 260))}px`;
    t.style.top = `${top}px`;
    toast = t;
    lastFix = { field, original, replacement, gap, at: Date.now() };
    toastTimer = setTimeout(hideToast, 4500);
  }
  function noteUndo(field, e) {
    if (e.inputType !== "historyUndo" || !lastFix || lastFix.field !== field) return;
    if (Date.now() - lastFix.at > 8e3) return;
    const { original, gap } = lastFix;
    field.send({ type: "noAutocorrect", typo: original });
    lastFix = null;
    hideToast();
    if (!field.ce) {
      const el2 = field.el;
      if (el2.selectionStart !== el2.selectionEnd && el2.value.slice(el2.selectionStart, el2.selectionEnd) === original) {
        const pos = Math.min(el2.value.length, el2.selectionEnd + gap);
        el2.setSelectionRange(pos, pos);
      }
      return;
    }
    const sel = selectionFor(field.el);
    if (sel && !sel.isCollapsed && sel.toString() === original) {
      sel.collapseToEnd();
      for (let i = 0; i < gap; i++) sel.modify("move", "forward", "character");
    }
  }

  // src/content/field.js
  var MAX_LEN = 6e4;
  var fields = /* @__PURE__ */ new Set();
  var state = { settings: null };
  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(r);
        });
      } catch {
        resolve(null);
      }
    });
  }
  async function loadSettings() {
    state.settings = await send({ type: "getSettings" });
    return state.settings;
  }
  var norm = (s) => s.replace(/ /g, " ");
  var MIRROR_PROPS = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontVariant",
    "fontStretch",
    "fontKerning",
    "fontFeatureSettings",
    "letterSpacing",
    "wordSpacing",
    "lineHeight",
    "textAlign",
    "textIndent",
    "textTransform",
    "direction",
    "tabSize",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderTopStyle",
    "borderRightStyle",
    "borderBottomStyle",
    "borderLeftStyle",
    "overflowWrap",
    "wordBreak",
    "whiteSpace"
  ];
  var Field = class {
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
      this.origSpellcheck = target.getAttribute("spellcheck");
      target.setAttribute("spellcheck", "false");
      this.onInput = (e) => {
        if (!this.ce) {
          this.shiftIssues(this.prevValue ?? "", this.el.value);
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
      target.addEventListener("input", this.onInput);
      target.addEventListener("focus", this.onFocus);
      target.addEventListener("blur", this.onBlur);
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
      this.el.removeEventListener("input", this.onInput);
      this.el.removeEventListener("focus", this.onFocus);
      this.el.removeEventListener("blur", this.onBlur);
      this.mo?.disconnect();
      this.mirror?.remove();
      this.badge?.remove();
      if (this.origSpellcheck == null) this.el.removeAttribute("spellcheck");
      else this.el.setAttribute("spellcheck", this.origSpellcheck);
      this.issues = [];
      fields.delete(this);
      updateHighlights();
      if (card.field === this) hideCard();
    }
    // Text changed by us (autocorrect): keep underlines aligned and re-check.
    afterExternalEdit() {
      if (!this.ce) {
        this.shiftIssues(this.prevValue ?? "", this.el.value);
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
      if (!state.settings?.enabled) return this.setIssues([], "");
      const text = this.getText();
      if (text === this.lastText) return;
      if (!text.trim() || text.length > MAX_LEN) return this.setIssues([], text);
      const seq = ++this.seq;
      this.busy = true;
      this.updateBadge();
      const res = await send({ type: "check", text });
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
      this.issues = this.issues.filter((i) => i.end <= p || i.start >= oldEnd).map((i) => i.start >= oldEnd ? { ...i, start: i.start + delta, end: i.end + delta } : i);
    }
    liveIssues() {
      if (!this.ce) return this.issues;
      return this.issues.filter((i) => i.range && norm(i.range.toString()) === i.problem);
    }
    // ---------- rendering ----------
    buildMirror() {
      const { layer } = ui();
      this.mirror = el("div", "mirror");
      this.inner = el("div", "inner");
      this.mirror.appendChild(this.inner);
      layer.appendChild(this.mirror);
      this.copyStyles();
    }
    copyStyles() {
      const cs = getComputedStyle(this.el);
      const m = this.mirror.style;
      for (const p of MIRROR_PROPS) m[p] = cs[p];
      m.boxSizing = "border-box";
      const bl = parseFloat(cs.borderLeftWidth) || 0;
      const br = parseFloat(cs.borderRightWidth) || 0;
      const scrollbar = Math.max(0, this.el.offsetWidth - this.el.clientWidth - bl - br);
      m.paddingRight = `${(parseFloat(cs.paddingRight) || 0) + scrollbar}px`;
      if (this.isInput) {
        m.whiteSpace = "pre";
        m.display = "flex";
        m.alignItems = "center";
        this.inner.style.whiteSpace = "pre";
      } else {
        m.whiteSpace = cs.whiteSpace === "normal" ? "pre-wrap" : cs.whiteSpace;
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
        const span = el("span", `u ${i.category}`, text.slice(i.start, i.end));
        span.dataset.id = i.id;
        i.span = span;
        frag.append(span);
        pos = i.end;
      }
      frag.append(`${text.slice(pos)}\u200B`);
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
          m.display = "none";
        } else {
          m.display = this.isInput ? "flex" : "block";
          m.left = `${r.left}px`;
          m.top = `${r.top}px`;
          m.width = `${r.width}px`;
          m.height = `${r.height}px`;
          if (`${this.el.offsetWidth}x${this.el.offsetHeight}` !== this.styledFor) this.copyStyles();
          this.inner.style.transform = `translate(${-this.el.scrollLeft}px, ${-this.el.scrollTop}px)`;
          const c = clipRect(this.el);
          m.clipPath = c ? `inset(${Math.max(0, c.top - r.top)}px ${Math.max(0, r.right - c.right)}px ${Math.max(0, r.bottom - c.bottom)}px ${Math.max(0, c.left - r.left)}px)` : "none";
        }
      }
      if (this.badge) this.positionBadge(r, visible);
    }
    // ---------- badge ----------
    buildBadge() {
      const { layer } = ui();
      this.badge = el("button", "badge");
      this.badge.title = "grammar-lee";
      this.badge.style.display = "none";
      this.badge.addEventListener("mousedown", (e) => e.preventDefault());
      this.badge.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePanel(this);
      });
      layer.appendChild(this.badge);
    }
    updateBadge() {
      if (!this.badge) return;
      const live = this.liveIssues();
      const corr = live.filter((i) => i.category === "correctness").length;
      const clar = live.length - corr;
      this.badge.classList.toggle("has", corr > 0);
      this.badge.classList.toggle("clarityonly", corr === 0 && clar > 0);
      this.badge.classList.toggle("busy", this.busy);
      this.badge.textContent = live.length ? String(corr || clar) : "\u2713";
      this.badge.title = live.length ? `${corr} correctness, ${clar} clarity suggestion${clar === 1 ? "" : "s"}` : "No issues found";
    }
    positionBadge(r, visible) {
      const focused = document.activeElement === this.el || this.el.contains(document.activeElement);
      const show = visible && (focused || this.issues.length > 0) && r.width >= 120 && r.height >= 18 && inViewport(r);
      const b = this.badge.style;
      if (!show) {
        b.display = "none";
        return;
      }
      b.display = "flex";
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
      if (ok && issue.isSpelling && replacement) send({ type: "learn", typo: issue.problem, correction: replacement });
      this.issues = this.issues.filter((i) => i !== issue);
      if (this.ce) updateHighlights();
      else this.render();
      this.updateBadge();
      this.opts.onUpdate?.(this);
      if (recheck) this.recheck();
      return ok;
    }
    applyText(issue, rep) {
      const el2 = this.el;
      if (el2.value.slice(issue.start, issue.end) !== issue.problem) return false;
      el2.focus();
      el2.setSelectionRange(issue.start, issue.end);
      let ok = false;
      try {
        ok = rep ? document.execCommand("insertText", false, rep) : document.execCommand("delete");
      } catch {
        ok = false;
      }
      if (!ok || el2.value.slice(issue.start, issue.start + rep.length) !== rep) {
        el2.setRangeText(rep, issue.start, issue.end, "end");
        el2.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: rep }));
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
        ok = rep ? document.execCommand("insertText", false, rep) : document.execCommand("delete");
      } catch {
        ok = false;
      }
      if (!ok) {
        r.deleteContents();
        if (rep) r.insertNode(document.createTextNode(rep));
        this.el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: rep }));
      }
      return true;
    }
    async applyAll(category = "correctness") {
      const todo = this.liveIssues().filter((i) => i.category === category && i.suggestions.length).sort((a, b) => b.start - a.start);
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
  };
  var HIGHLIGHT_CSS = `
::highlight(grammar-lee-correctness){text-decoration-line:underline;text-decoration-color:#e5484d;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-skip-ink:none}
::highlight(grammar-lee-clarity){text-decoration-line:underline;text-decoration-color:#3e7bfa;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-skip-ink:none}
::highlight(grammar-lee-active){background-color:rgba(229,72,77,.16)}`;
  var styledRoots = /* @__PURE__ */ new WeakSet();
  function adoptHighlightStyles(root2) {
    if (!(root2 instanceof ShadowRoot) || styledRoots.has(root2)) return;
    styledRoots.add(root2);
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(HIGHLIGHT_CSS);
      root2.adoptedStyleSheets = [...root2.adoptedStyleSheets, sheet];
    } catch {
      const st = document.createElement("style");
      st.textContent = HIGHLIGHT_CSS;
      root2.appendChild(st);
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
      if (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible") {
        const pr = p.getBoundingClientRect();
        top = Math.max(top, pr.top);
        left = Math.max(left, pr.left);
        right = Math.min(right, pr.right);
        bottom = Math.min(bottom, pr.bottom);
      }
      if (cs.position === "fixed") break;
    }
    return { top, left, right, bottom };
  }
  var activeRange = null;
  function updateHighlights() {
    if (!(window.CSS && CSS.highlights)) return;
    const groups = { correctness: [], clarity: [] };
    for (const f of fields) {
      if (!f.ce) continue;
      for (const i of f.issues) if (i.range) groups[i.category]?.push(i.range);
    }
    for (const [k, ranges] of Object.entries(groups)) {
      CSS.highlights.set(`grammar-lee-${k}`, new Highlight(...ranges));
    }
    if (activeRange) CSS.highlights.set("grammar-lee-active", new Highlight(activeRange));
    else CSS.highlights.delete("grammar-lee-active");
  }
  var looping = false;
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
  var card = { box: null, field: null, issue: null, hideTimer: null, showTimer: null };
  function setActive(field, issue) {
    for (const f of fields) if (!f.ce) for (const i of f.issues) i.span?.classList.remove("active");
    activeRange = null;
    if (field && issue) {
      if (field.ce) activeRange = issue.range;
      else issue.span?.classList.add("active");
    }
    updateHighlights();
  }
  function hideCard() {
    clearTimeout(card.hideTimer);
    clearTimeout(card.showTimer);
    card.box?.remove();
    card.box = null;
    card.field = null;
    card.issue = null;
    setActive(null, null);
  }
  function sourceName(s) {
    return s === "languagetool" ? "LanguageTool" : "Harper";
  }
  function showCard(field, issue, rect) {
    hidePanel();
    if (card.issue === issue && card.box) return;
    hideCard();
    const { shadow } = ui();
    const box = el("div", "card");
    box.addEventListener("mousedown", (e) => e.preventDefault());
    box.addEventListener("mouseenter", () => clearTimeout(card.hideTimer));
    box.addEventListener("mouseleave", () => scheduleHide());
    const head = el("div", "head");
    head.append(el("span", `dot ${issue.category}`), el("span", null, issue.label));
    const close = el("button", "close", "\xD7");
    close.addEventListener("click", hideCard);
    head.append(close);
    box.append(head);
    const sugs = el("div", "sugs");
    issue.suggestions.slice(0, 4).forEach((s, n) => {
      const b = el("button", n === 0 ? "sug" : "sug alt");
      if (n === 0) b.append(el("span", "old", issue.problem));
      b.append(document.createTextNode(s === "" ? "Remove" : s));
      b.addEventListener("click", () => {
        hideCard();
        field.apply(issue, s);
      });
      sugs.append(b);
    });
    if (issue.suggestions.length) box.append(sugs);
    const msg = el("div", "msg");
    renderMessage(msg, issue.message);
    box.append(msg);
    const actions = el("div", "actions");
    if (issue.isSpelling) {
      const add = el("button", "act", `Add \u201C${issue.problem}\u201D to dictionary`);
      add.addEventListener("click", async () => {
        hideCard();
        await send({ type: "addWord", word: issue.problem });
        const w = issue.problem.toLowerCase();
        for (const f of fields) f.dropWhere((i) => i.isSpelling && i.problem.toLowerCase() === w);
      });
      actions.append(add);
    }
    const ign = el("button", "act", "Ignore");
    ign.title = "Ignore this exact issue everywhere";
    ign.addEventListener("click", async () => {
      hideCard();
      await send({ type: "ignore", issue: { ruleId: issue.ruleId, problem: issue.problem } });
      const key = `${issue.ruleId}::${issue.problem.toLowerCase()}`;
      for (const f of fields) f.dropWhere((i) => `${i.ruleId}::${i.problem.toLowerCase()}` === key);
    });
    actions.append(ign);
    if (!issue.isSpelling) {
      const off = el("button", "act", "Turn off rule");
      off.title = `Stop showing ${issue.ruleId}`;
      off.addEventListener("click", async () => {
        hideCard();
        await send({ type: "disableRule", ruleId: issue.ruleId });
        for (const f of fields) f.dropWhere((i) => i.ruleId === issue.ruleId);
      });
      actions.append(off);
    }
    actions.append(el("span", "src", sourceName(issue.source)));
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
  function issueAt(x, y) {
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
  var moveQueued = false;
  var lastMove = null;
  document.addEventListener(
    "mousemove",
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
    { passive: true, capture: true }
  );
  document.addEventListener(
    "mousedown",
    (e) => {
      const path = e.composedPath();
      if (path.includes(ui().host)) return;
      hideCard();
      hidePanel();
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideCard();
      hidePanel();
    }
  });
  window.addEventListener("scroll", () => hideCard(), { capture: true, passive: true });
  var panel = null;
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
    const box = el("div", "panel");
    box.addEventListener("mousedown", (e) => e.preventDefault());
    const live = field.liveIssues();
    const head = el("div", "ph");
    head.append(el("span", null, "grammar-lee"), el("span", "count", `${live.length} suggestion${live.length === 1 ? "" : "s"}`));
    box.append(head);
    const list = el("div", "list");
    if (!live.length) list.append(el("div", "empty", "Looks good. No issues found."));
    for (const i of live) {
      const row = el("div", "item");
      row.append(el("span", `dot ${i.category}`));
      const what = el("div", "what");
      what.append(el("div", "lbl", i.label));
      const chg = el("div", "chg");
      chg.append(el("s", null, i.problem));
      if (i.suggestions.length) {
        chg.append(document.createTextNode(" \u2192 "));
        chg.append(el("b", null, i.suggestions[0] === "" ? "(remove)" : i.suggestions[0]));
      }
      what.append(chg);
      row.append(what);
      if (i.suggestions.length) {
        const ok = el("button", "ok", "Accept");
        ok.addEventListener("click", (e) => {
          e.stopPropagation();
          hidePanel();
          field.apply(i, i.suggestions[0]);
        });
        row.append(ok);
      }
      row.addEventListener("click", () => {
        const r = field.issueRects(i)[0];
        hidePanel();
        if (r) showCard(field, i, r);
      });
      list.append(row);
    }
    box.append(list);
    const fixable = live.filter((i) => i.category === "correctness" && i.suggestions.length).length;
    const foot = el("div", "pf");
    const all = el("button", "all", `Fix all correctness (${fixable})`);
    all.disabled = !fixable;
    all.addEventListener("click", () => {
      hidePanel();
      field.applyAll("correctness");
    });
    foot.append(all);
    box.append(foot);
    shadow.append(box);
    placeNear(box, field.badge.getBoundingClientRect(), 340);
    panel = box;
  }

  // src/content/duplicates.js
  var reported = false;
  function findDuplicate() {
    if (document.querySelector("proofline-ui")) return "Proofline (the old version)";
    const mine = chrome.runtime.id;
    const others = [...document.querySelectorAll("grammar-lee-ui")].filter((n) => n.dataset.glId !== mine);
    return others.length ? "an older grammar-lee" : null;
  }
  function watchForDuplicates(send2) {
    const check = async () => {
      if (reported) return;
      const kind = findDuplicate();
      if (!kind) return;
      reported = true;
      const res = await send2({ type: "duplicate", kind, host: location.hostname });
      if (res?.warn) showWarning(kind);
    };
    document.addEventListener("focusin", () => setTimeout(check, 1500), true);
    setTimeout(check, 3e3);
  }
  function showWarning(kind) {
    const { shadow } = ui();
    const box = el("div", "dupwarn");
    const text = el("div", "dwt");
    text.append(el("b", null, "Two spell-checkers are running. "));
    text.append(document.createTextNode(`${kind[0].toUpperCase()}${kind.slice(1)} is also loaded, so you may see its suggestions instead of these. Remove it at chrome://extensions.`));
    const ok = el("button", "dwb", "Got it");
    ok.addEventListener("click", () => box.remove());
    box.append(text, ok);
    shadow.append(box);
    setTimeout(() => box.remove(), 2e4);
  }

  // src/content/index.js
  var attached = /* @__PURE__ */ new WeakMap();
  var SKIP_INPUT_HINT = /(user|login|email|pass|otp|code|token|card|cvv|cvc|iban|sort|zip|post|phone|tel|url|search|captcha|address|city|amount|price)/i;
  var CODE_EDITOR = ".CodeMirror, .cm-editor, .monaco-editor, .ace_editor, [data-language], .view-lines";
  function hostBlocked() {
    const { hostname, pathname } = location;
    if (hostname === "docs.google.com" && /^\/(document|spreadsheets|presentation)\//.test(pathname)) return true;
    const anc = location.ancestorOrigins ? Array.from(location.ancestorOrigins) : [];
    if (anc.includes("https://docs.google.com")) return true;
    return false;
  }
  function resolveTarget(node) {
    if (!(node instanceof HTMLElement)) return null;
    if (node.closest('[data-gramm="false"], [data-grammar-lee="off"], grammar-lee-ui')) return null;
    if (node instanceof HTMLTextAreaElement) {
      if (node.readOnly || node.disabled || node.getAttribute("spellcheck") === "false" && !attached.has(node)) return null;
      if (node.closest(CODE_EDITOR)) return null;
      return node;
    }
    if (node instanceof HTMLInputElement) {
      const type = (node.getAttribute("type") || "text").toLowerCase();
      if (type !== "text") return null;
      if (node.readOnly || node.disabled) return null;
      const hint = `${node.name} ${node.id} ${node.autocomplete} ${node.placeholder} ${node.getAttribute("aria-label") || ""}`;
      if (SKIP_INPUT_HINT.test(hint)) return null;
      if (node.getAttribute("role") === "combobox" || node.getAttribute("role") === "searchbox") return null;
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
    document.addEventListener("focusin", (e) => attach(e.composedPath()[0]), true);
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
})();
