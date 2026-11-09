// Detects a second spell-checker copy on the page: the old Proofline build, or another grammar-lee loaded
// from a different folder. Both would underline the same words with different suggestions.
import { ui, el as h } from './ui.js';

let reported = false;

function findDuplicate() {
  if (document.querySelector('proofline-ui')) return 'Proofline (the old version)';
  const mine = chrome.runtime.id;
  const others = [...document.querySelectorAll('grammar-lee-ui')].filter((n) => n.dataset.glId !== mine);
  return others.length ? 'an older grammar-lee' : null;
}

export function watchForDuplicates(send) {
  const check = async () => {
    if (reported) return;
    const kind = findDuplicate();
    if (!kind) return;
    reported = true;
    const res = await send({ type: 'duplicate', kind, host: location.hostname });
    if (res?.warn) showWarning(kind);
  };
  document.addEventListener('focusin', () => setTimeout(check, 1500), true);
  setTimeout(check, 3000);
}

function showWarning(kind) {
  const { shadow } = ui();
  const box = h('div', 'dupwarn');
  const text = h('div', 'dwt');
  text.append(h('b', null, 'Two spell-checkers are running. '));
  text.append(document.createTextNode(`${kind[0].toUpperCase()}${kind.slice(1)} is also loaded, so you may see its suggestions instead of these. Remove it at chrome://extensions.`));
  const ok = h('button', 'dwb', 'Got it');
  ok.addEventListener('click', () => box.remove());
  box.append(text, ok);
  shadow.append(box);
  setTimeout(() => box.remove(), 20000);
}
