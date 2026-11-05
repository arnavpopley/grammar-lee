import { getSettings, updateSettings } from './shared/settings.js';

const $ = (id) => document.getElementById(id);

async function main() {
  const s = await getSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try {
    host = new URL(tab.url).hostname;
  } catch {}
  $('site').textContent = host || 'This page';
  $('siteOn').disabled = !host;

  $('enabled').checked = s.enabled;
  $('siteOn').checked = !s.disabledSites.includes(host);
  $('dialect').value = s.dialect;
  $('clarity').checked = s.showClarity;
  $('autocorrect').checked = s.autocorrect;
  $('autocorrect').onchange = (e) => updateSettings({ autocorrect: e.target.checked });

  $('enabled').onchange = (e) => updateSettings({ enabled: e.target.checked });
  $('dialect').onchange = (e) => updateSettings({ dialect: e.target.value });
  $('clarity').onchange = (e) => updateSettings({ showClarity: e.target.checked });
  $('siteOn').onchange = async (e) => {
    const cur = await getSettings();
    const sites = new Set(cur.disabledSites);
    if (e.target.checked) sites.delete(host);
    else sites.add(host);
    updateSettings({ disabledSites: [...sites] });
  };
  $('editor').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
  $('settings').onclick = () => chrome.runtime.openOptionsPage();

  const pill = $('lt');
  if (!s.languageTool.enabled) return;
  pill.lastElementChild.textContent = 'Checking…';
  const r = await chrome.runtime.sendMessage({ type: 'ltPing' });
  pill.classList.add(r?.ok ? 'ok' : 'bad');
  pill.lastElementChild.textContent = r?.ok ? 'Connected' : 'Not running';
}

main();
