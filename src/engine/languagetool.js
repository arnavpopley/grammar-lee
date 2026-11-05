// Client for a LanguageTool server running on this machine (never the public cloud API).
import { ltCategory, ltLabel } from './categories.js';

const LT_LANG = {
  British: 'en-GB',
  American: 'en-US',
  Australian: 'en-AU',
  Canadian: 'en-CA',
  Indian: 'en-GB',
};

function isLocalUrl(url) {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

export async function ltPing(url) {
  if (!isLocalUrl(url)) return { ok: false, error: 'Only a LanguageTool server on localhost is allowed.' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${url.replace(/\/$/, '')}/v2/languages`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const langs = await res.json();
    return { ok: true, languages: langs.length };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Timed out' : 'Not running' };
  }
}

export async function ltCheck(text, settings) {
  const { url, picky } = settings.languageTool;
  if (!isLocalUrl(url)) return [];
  const body = new URLSearchParams({
    text,
    language: LT_LANG[settings.dialect] || 'en-GB',
    level: picky ? 'picky' : 'default',
  });
  if (settings.disabledRules.length) body.set('disabledRules', settings.disabledRules.join(','));

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/v2/check`, {
      method: 'POST',
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.matches || []).map((m) => ({
      source: 'languagetool',
      ruleId: m.rule?.id || 'LT',
      start: m.offset,
      end: m.offset + m.length,
      problem: text.slice(m.offset, m.offset + m.length),
      category: ltCategory(m),
      label: ltLabel(m),
      message: m.message || m.shortMessage || '',
      suggestions: (m.replacements || []).slice(0, 5).map((r) => r.value),
      isSpelling: m.rule?.issueType === 'misspelling',
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
