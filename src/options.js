import { getSettings, updateSettings } from './shared/settings.js';

const $ = (id) => document.getElementById(id);

function chips(container, items, onRemove, render = (x) => x) {
  container.replaceChildren();
  if (!items.length) {
    const e = document.createElement('span');
    e.className = 'empty';
    e.textContent = 'None';
    container.append(e);
    return;
  }
  for (const it of items) {
    const c = document.createElement('span');
    c.className = 'chip';
    c.textContent = render(it);
    const b = document.createElement('button');
    b.textContent = '×';
    b.title = 'Remove';
    b.onclick = () => onRemove(it);
    c.append(b);
    container.append(c);
  }
}

async function paint() {
  const s = await getSettings();
  $('enabled').checked = s.enabled;
  $('dialect').value = s.dialect;
  $('clarity').checked = s.showClarity;
  $('autocorrect').checked = s.autocorrect;
  chips(
    $('learned'),
    Object.keys(s.learned),
    (k) => {
      const learned = { ...s.learned };
      delete learned[k];
      updateSettings({ learned });
    },
    (k) => `${k} → ${s.learned[k]}`,
  );
  chips($('noAuto'), s.noAutocorrect, (k) => updateSettings({ noAutocorrect: s.noAutocorrect.filter((x) => x !== k) }));
  $('delay').value = String(s.checkDelayMs);
  $('ltOn').checked = s.languageTool.enabled;
  $('ltUrl').value = s.languageTool.url;
  $('ltPicky').checked = s.languageTool.picky;
  if (document.activeElement !== $('words')) $('words').value = s.words.join('\n');
  $('wordCount').textContent = `${s.words.length} words`;
  chips($('rules'), s.disabledRules, (r) => updateSettings({ disabledRules: s.disabledRules.filter((x) => x !== r) }));
  chips(
    $('ignored'),
    s.ignored,
    (k) => updateSettings({ ignored: s.ignored.filter((x) => x !== k) }),
    (k) => {
      const [rule, text] = k.split('::');
      return `“${text}” (${rule})`;
    },
  );
  chips($('sites'), s.disabledSites, (h) => updateSettings({ disabledSites: s.disabledSites.filter((x) => x !== h) }));
}

async function testLT() {
  const pill = $('ltPill');
  pill.className = 'pill';
  pill.lastElementChild.textContent = 'Testing…';
  const r = await chrome.runtime.sendMessage({ type: 'ltPing', url: $('ltUrl').value.trim() });
  pill.classList.add(r?.ok ? 'ok' : 'bad');
  pill.lastElementChild.textContent = r?.ok ? `Connected (${r.languages} languages)` : r?.error || 'Not running';
}

function main() {
  if (location.hash === '#welcome') $('welcome').classList.add('show');
  paint();
  chrome.storage.onChanged.addListener((c) => c.settings && paint());

  $('enabled').onchange = (e) => updateSettings({ enabled: e.target.checked });
  $('dialect').onchange = (e) => updateSettings({ dialect: e.target.value });
  $('clarity').onchange = (e) => updateSettings({ showClarity: e.target.checked });
  $('autocorrect').onchange = (e) => updateSettings({ autocorrect: e.target.checked });
  $('delay').onchange = (e) => updateSettings({ checkDelayMs: Number(e.target.value) });
  $('ltOn').onchange = (e) => {
    updateSettings({ languageTool: { enabled: e.target.checked } });
    if (e.target.checked) testLT();
  };
  $('ltPicky').onchange = (e) => updateSettings({ languageTool: { picky: e.target.checked } });
  $('ltUrl').onchange = (e) => updateSettings({ languageTool: { url: e.target.value.trim() } });
  $('ltTest').onclick = testLT;
  $('saveWords').onclick = async () => {
    const words = [...new Set($('words').value.split('\n').map((w) => w.trim()).filter(Boolean))];
    await updateSettings({ words });
    $('savedWords').classList.add('on');
    setTimeout(() => $('savedWords').classList.remove('on'), 1500);
  };
  $('clearIgnored').onclick = () => updateSettings({ ignored: [] });
  $('openEditor').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
}

main();
