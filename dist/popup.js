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

  // src/popup.js
  var $ = (id) => document.getElementById(id);
  async function main() {
    const s = await getSettings();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let host = "";
    try {
      host = new URL(tab.url).hostname;
    } catch {
    }
    $("site").textContent = host || "This page";
    $("siteOn").disabled = !host;
    $("enabled").checked = s.enabled;
    $("siteOn").checked = !s.disabledSites.includes(host);
    $("dialect").value = s.dialect;
    $("clarity").checked = s.showClarity;
    $("autocorrect").checked = s.autocorrect;
    $("autocorrect").onchange = (e) => updateSettings({ autocorrect: e.target.checked });
    $("enabled").onchange = (e) => updateSettings({ enabled: e.target.checked });
    $("dialect").onchange = (e) => updateSettings({ dialect: e.target.value });
    $("clarity").onchange = (e) => updateSettings({ showClarity: e.target.checked });
    $("siteOn").onchange = async (e) => {
      const cur = await getSettings();
      const sites = new Set(cur.disabledSites);
      if (e.target.checked) sites.delete(host);
      else sites.add(host);
      updateSettings({ disabledSites: [...sites] });
    };
    $("editor").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
    $("settings").onclick = () => chrome.runtime.openOptionsPage();
    const pill = $("lt");
    if (!s.languageTool.enabled) return;
    pill.lastElementChild.textContent = "Checking\u2026";
    const r = await chrome.runtime.sendMessage({ type: "ltPing" });
    pill.classList.add(r?.ok ? "ok" : "bad");
    pill.lastElementChild.textContent = r?.ok ? "Connected" : "Not running";
  }
  main();
})();
