// Turns a contenteditable subtree into plain text plus a map back to DOM text nodes,
// so engine offsets can be converted into DOM Ranges.

const BLOCK = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIELDSET',
  'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
  'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TR', 'TD', 'TH', 'UL',
]);
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'CODE']);

function skipElement(el) {
  if (SKIP.has(el.tagName)) return true;
  if (el.getAttribute('contenteditable') === 'false') return true;
  if (el.getAttribute('data-gramm') === 'false' || el.getAttribute('data-grammar-lee') === 'off') return true;
  const cls = el.className && typeof el.className === 'string' ? el.className : '';
  // Gmail quoted replies and signatures are not the user's new writing.
  if (/\bgmail_(quote|signature)\b/.test(cls)) return true;
  return false;
}

export function extract(root) {
  const segs = [];
  let text = '';
  const nl = () => {
    if (text && !text.endsWith('\n')) text += '\n';
  };
  const walk = (node) => {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === Node.TEXT_NODE) {
        if (!c.data) continue;
        segs.push({ node: c, start: text.length, len: c.data.length });
        text += c.data;
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        if (c.tagName === 'BR') {
          text += '\n';
          continue;
        }
        if (skipElement(c)) {
          if (text && !/\s$/.test(text)) text += ' ';
          continue;
        }
        const block = BLOCK.has(c.tagName);
        if (block) nl();
        walk(c);
        if (block) nl();
      }
    }
  };
  walk(root);
  // Non-breaking spaces read as normal spaces to the engines (same length, offsets unaffected).
  return { text: text.replace(/ /g, ' '), segs };
}

function locate(segs, offset, preferNext) {
  // Binary search for the segment containing the offset.
  let lo = 0;
  let hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
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
  // Offset falls on a virtual newline: snap to the next real text.
  const next = segs[lo];
  if (next) return { node: next.node, offset: 0 };
  const last = segs[segs.length - 1];
  return last ? { node: last.node, offset: last.len } : null;
}

export function rangeFor(model, start, end) {
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
