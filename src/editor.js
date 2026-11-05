// Full-page editor: same engine and field logic as the content script, plus a Grammarly-style sidebar.
import { Field, loadSettings, showCard, state } from './content/field.js';
import { renderMessage } from './content/ui.js';

const $ = (id) => document.getElementById(id);
const doc = $('doc');
let field = null;
let saveTimer = null;

function stats() {
  const text = doc.innerText.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const mins = Math.max(1, Math.round(words / 230));
  $('stats').textContent = words ? `${words} words · ${text.length} characters · ${mins} min read` : '';
}

function renderList(f) {
  const live = f.liveIssues();
  const corr = live.filter((i) => i.category === 'correctness');
  $('nC').textContent = corr.length;
  $('nK').textContent = live.length - corr.length;
  $('fixAll').disabled = !corr.some((i) => i.suggestions.length);
  const list = $('list');
  list.replaceChildren();
  if (!live.length) {
    const n = document.createElement('div');
    n.className = 'none';
    n.innerHTML = doc.textContent.trim() ? '<b>✓</b>No issues found.' : 'Suggestions will appear here.';
    list.append(n);
    return;
  }
  for (const i of live) {
    const it = document.createElement('div');
    it.className = 'it';
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.innerHTML = `<span class="dot ${i.category}"></span>`;
    lbl.append(i.label);
    const chg = document.createElement('div');
    chg.className = 'chg';
    const s = document.createElement('s');
    s.textContent = i.problem;
    chg.append(s);
    if (i.suggestions.length) {
      chg.append(' → ');
      const b = document.createElement('b');
      b.textContent = i.suggestions[0] === '' ? '(remove)' : i.suggestions[0];
      chg.append(b);
    }
    const msg = document.createElement('div');
    msg.className = 'msg';
    renderMessage(msg, i.message);
    const acts = document.createElement('div');
    acts.className = 'acts';
    if (i.suggestions.length) {
      const ok = document.createElement('button');
      ok.className = 'ok';
      ok.textContent = 'Accept';
      ok.onclick = (e) => {
        e.stopPropagation();
        f.apply(i, i.suggestions[0]);
      };
      acts.append(ok);
    }
    const no = document.createElement('button');
    no.className = 'no';
    no.textContent = 'Dismiss';
    no.onclick = (e) => {
      e.stopPropagation();
      f.dropWhere((x) => x === i);
    };
    acts.append(no);
    it.append(lbl, chg, msg, acts);
    it.onclick = () => {
      if (!i.range) return;
      const r = i.range.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 40) {
        i.range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => showCard(f, i, i.range.getBoundingClientRect()), 350);
      } else showCard(f, i, r);
    };
    list.append(it);
  }
}

async function main() {
  await loadSettings();
  const { editorDraft } = await chrome.storage.local.get('editorDraft');
  if (editorDraft) doc.textContent = editorDraft;
  stats();

  field = new Field(doc, { badge: false, onUpdate: renderList });
  renderList(field);

  doc.addEventListener('input', () => {
    stats();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({ editorDraft: doc.innerText }), 500);
  });
  doc.addEventListener('paste', (e) => {
    e.preventDefault();
    const t = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  $('copy').onclick = async () => {
    await navigator.clipboard.writeText(doc.innerText);
    $('copy').textContent = 'Copied';
    setTimeout(() => ($('copy').textContent = 'Copy text'), 1200);
  };
  $('clear').onclick = () => {
    doc.textContent = '';
    chrome.storage.local.set({ editorDraft: '' });
    stats();
    field.recheck();
  };
  $('fixAll').onclick = () => field.applyAll('correctness');
  $('settings').onclick = () => chrome.runtime.openOptionsPage();
  chrome.storage.onChanged.addListener(async (c) => {
    if (!c.settings) return;
    await loadSettings();
    field.recheck();
  });
  doc.focus();
  void state;
}

main();
