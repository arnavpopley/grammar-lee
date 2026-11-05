// Shadow-DOM UI: underline mirrors for textareas, the suggestion card, the badge and the issues panel.

const CSS = `
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

let root = null;

export function ui() {
  if (root) return root;
  const host = document.createElement('grammar-lee-ui');
  host.setAttribute('data-grammar-lee', 'off');
  const shadow = host.attachShadow({ mode: 'open' });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const st = document.createElement('style');
    st.textContent = CSS;
    shadow.appendChild(st);
  }
  const layer = document.createElement('div');
  layer.className = 'layer';
  shadow.appendChild(layer);
  (document.body || document.documentElement).appendChild(host);
  root = { host, shadow, layer };
  return root;
}

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Render engine messages: Harper uses `code` spans in backticks.
export function renderMessage(target, message) {
  const parts = message.split('`');
  parts.forEach((p, i) => {
    if (i % 2) target.appendChild(el('code', null, p));
    else target.appendChild(document.createTextNode(p));
  });
}

export function placeNear(box, rect, width) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = Math.min(Math.max(8, rect.left), vw - width - 8);
  box.style.left = `${left}px`;
  box.style.top = '0px';
  box.style.visibility = 'hidden';
  requestAnimationFrame(() => {
    const h = box.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > vh - 8) top = Math.max(8, rect.top - h - 6);
    box.style.top = `${top}px`;
    box.style.visibility = 'visible';
  });
}
