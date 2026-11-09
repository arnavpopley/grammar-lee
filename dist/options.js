(() => {
  // src/shared/dictionary.js
  var SEED_WORDS = ["Arnav", "Popley", "Mumbai", "Kensington", "Chatsworth", "Imperial", "MEng", "MSc", "BEng", "thermofluids", "thermodynamics", "RANS", "CFD", "SMR", "SMRs", "OpenSRE", "SRE", "Tracer", "IdeaForge", "Card", "Commune", "derivkit", "deriv-kit", "Quantest", "quantest.net", "Libster", "gpuval", "TfL", "AlgoSoc", "QTE", "LODR", "BSE", "NSE", "smallcap", "smallcaps", "midcap", "Groww", "TradingView", "ISA", "Suryansh", "Vincent", "Emma", "NumPy", "pandas", "SciPy", "PyTorch", "scikit-learn", "Matplotlib", "Jupyter", "LaTeX", "Overleaf", "GitHub", "Git", "Bash", "Docker", "PostgreSQL", "SQL", "Supabase", "Vercel", "Next.js", "TypeScript", "JavaScript", "Python", "C++", "C++20", "MATLAB", "SolidWorks", "ANSYS", "Simulink", "Oracle", "Optiver", "IMC", "Jane", "Street", "Citadel", "Algothon", "CR3BP", "KeyRing", "paygate", "DMT", "LRP", "ME2", "ME3", "backtest", "backtested", "backtesting", "backtests", "quant", "quants", "microcontroller", "microcontrollers", "Black-Scholes", "Heston", "Monte", "Carlo", "stochastic", "volatility", "orderbook", "GTM", "fintech", "fintechs", "SaaS", "API", "APIs", "LLM", "LLMs", "MCP", "OpenAI", "Anthropic", "Claude", "Greptile", "Codespaces", "Cursor", "YC", "recruiter", "Earls", "Pembroke", "IIT", "NIFTY", "Nifty", "Sensex", "SEBI", "Zerodha", "Ghidra", "Harper", "LanguageTool", "WhatsApp", "Gmail", "Notion", "Figma", "Spotify", "Rust", "WASM", "README", "repo", "repos", "config", "CLI", "async", "dataset", "datasets", "dataframe", "dataframes", "pytest", "Codex", "Lovable", "Turnitin"];

  // src/shared/settings.js
  var DEFAULTS = {
    enabled: true,
    dialect: "British",
    // American | British | Australian | Canadian | Indian
    showClarity: true,
    // style/readability suggestions (blue) in addition to correctness (red)
    disabledSites: [],
    words: SEED_WORDS,
    // personal dictionary
    ignored: [],
    // "ruleId::problem text" keys the user has dismissed everywhere
    disabledRules: [],
    // Harper or LanguageTool rule ids switched off entirely
    languageTool: {
      enabled: false,
      auto: true,
      // switch on by itself when a server answers on localhost; false once you set it yourself
      url: "http://localhost:8081",
      picky: false
    },
    checkDelayMs: 450,
    autocorrect: true,
    // fix confident typos (adn -> and) the moment you finish the word
    learned: {},
    // typo -> correction you accepted; ranked first next time
    noAutocorrect: []
    // typos you undid; never autocorrected again
  };
  async function getSettings() {
    const stored = await chrome.storage.local.get("settings");
    const s = stored.settings || {};
    return {
      ...DEFAULTS,
      ...s,
      languageTool: { ...DEFAULTS.languageTool, ...s.languageTool || {} }
    };
  }
  async function updateSettings(patch) {
    const cur = await getSettings();
    const next = {
      ...cur,
      ...patch,
      languageTool: { ...cur.languageTool, ...patch.languageTool || {} }
    };
    await chrome.storage.local.set({ settings: next });
    return next;
  }

  // src/options.js
  var $ = (id) => document.getElementById(id);
  function chips(container, items, onRemove, render = (x) => x) {
    container.replaceChildren();
    if (!items.length) {
      const e = document.createElement("span");
      e.className = "empty";
      e.textContent = "None";
      container.append(e);
      return;
    }
    for (const it of items) {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = render(it);
      const b = document.createElement("button");
      b.textContent = "\xD7";
      b.title = "Remove";
      b.onclick = () => onRemove(it);
      c.append(b);
      container.append(c);
    }
  }
  async function paint() {
    const s = await getSettings();
    $("enabled").checked = s.enabled;
    $("dialect").value = s.dialect;
    $("clarity").checked = s.showClarity;
    $("autocorrect").checked = s.autocorrect;
    chips(
      $("learned"),
      Object.keys(s.learned),
      (k) => {
        const learned = { ...s.learned };
        delete learned[k];
        updateSettings({ learned });
      },
      (k) => `${k} \u2192 ${s.learned[k]}`
    );
    chips($("noAuto"), s.noAutocorrect, (k) => updateSettings({ noAutocorrect: s.noAutocorrect.filter((x) => x !== k) }));
    $("delay").value = String(s.checkDelayMs);
    $("ltOn").checked = s.languageTool.enabled;
    $("ltUrl").value = s.languageTool.url;
    $("ltPicky").checked = s.languageTool.picky;
    if (document.activeElement !== $("words")) $("words").value = s.words.join("\n");
    $("wordCount").textContent = `${s.words.length} words`;
    chips($("rules"), s.disabledRules, (r) => updateSettings({ disabledRules: s.disabledRules.filter((x) => x !== r) }));
    chips(
      $("ignored"),
      s.ignored,
      (k) => updateSettings({ ignored: s.ignored.filter((x) => x !== k) }),
      (k) => {
        const [rule, text] = k.split("::");
        return `\u201C${text}\u201D (${rule})`;
      }
    );
    chips($("sites"), s.disabledSites, (h) => updateSettings({ disabledSites: s.disabledSites.filter((x) => x !== h) }));
  }
  async function testLT() {
    const pill = $("ltPill");
    pill.className = "pill";
    pill.lastElementChild.textContent = "Testing\u2026";
    const r = await chrome.runtime.sendMessage({ type: "ltPing", url: $("ltUrl").value.trim() });
    pill.classList.add(r?.ok ? "ok" : "bad");
    pill.lastElementChild.textContent = r?.ok ? `Connected (${r.languages} languages)` : r?.error || "Not running";
  }
  function main() {
    if (location.hash === "#welcome") $("welcome").classList.add("show");
    paint();
    chrome.storage.onChanged.addListener((c) => c.settings && paint());
    $("enabled").onchange = (e) => updateSettings({ enabled: e.target.checked });
    $("dialect").onchange = (e) => updateSettings({ dialect: e.target.value });
    $("clarity").onchange = (e) => updateSettings({ showClarity: e.target.checked });
    $("autocorrect").onchange = (e) => updateSettings({ autocorrect: e.target.checked });
    $("delay").onchange = (e) => updateSettings({ checkDelayMs: Number(e.target.value) });
    $("ltOn").onchange = (e) => {
      updateSettings({ languageTool: { enabled: e.target.checked, auto: false } });
      if (e.target.checked) testLT();
    };
    $("ltPicky").onchange = (e) => updateSettings({ languageTool: { picky: e.target.checked } });
    $("ltUrl").onchange = (e) => updateSettings({ languageTool: { url: e.target.value.trim() } });
    $("ltTest").onclick = testLT;
    $("saveWords").onclick = async () => {
      const words = [...new Set($("words").value.split("\n").map((w) => w.trim()).filter(Boolean))];
      await updateSettings({ words });
      $("savedWords").classList.add("on");
      setTimeout(() => $("savedWords").classList.remove("on"), 1500);
    };
    $("clearIgnored").onclick = () => updateSettings({ ignored: [] });
    const m = chrome.runtime.getManifest();
    $("ver").textContent = `grammar-lee ${m.version_name || m.version} \xB7 extension ID ${chrome.runtime.id}`;
    $("export").onclick = async () => {
      const s = await getSettings();
      const blob = new Blob([JSON.stringify({ grammarLee: m.version, settings: s }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `grammar-lee-settings-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2e3);
    };
    $("importBtn").onclick = () => $("importFile").click();
    $("importFile").onchange = async (e) => {
      const msg = $("importMsg");
      try {
        const data = JSON.parse(await e.target.files[0].text());
        const incoming = data.settings || data;
        const patch = {};
        for (const k of Object.keys(DEFAULTS)) if (k in incoming) patch[k] = incoming[k];
        if (!Object.keys(patch).length) throw new Error("no grammar-lee settings in that file");
        await updateSettings(patch);
        msg.textContent = "Imported";
      } catch (err) {
        msg.textContent = `Could not import: ${err.message}`;
      }
      msg.classList.add("on");
      setTimeout(() => msg.classList.remove("on"), 3e3);
      e.target.value = "";
    };
    $("openEditor").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
  }
  main();
})();
