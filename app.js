alert("app.js loaded ✅");

let CFG = null;

const $ = (id) => document.getElementById(id);
const v = (id) => ($(id)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el) el.value = val; };
const c = (id) => !!($(id)?.checked);
const setC = (id, val) => { const el = $(id); if (el) el.checked = !!val; };

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const uniq = (arr) => Array.from(new Set(arr));

async function loadConfig() {
  const url = "./config.json?v=" + Date.now(); // hard cache-bust
  const res = await fetch(url, { cache: "no-store" });

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`config.json fetch failed (${res.status})\nURL: ${res.url}\nBody preview: ${text.slice(0, 120)}`);
  }

  try {
    CFG = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `config.json JSON parse failed\nURL: ${res.url}\nContent-Type: ${ct}\n` +
      `Preview:\n${text.slice(0, 300)}`
    );
  }

  // SAFETY: If you moved palettes into paletteGroups, rebuild options.palette automatically
  if (CFG?.paletteGroups && (!CFG?.options?.palette || !CFG.options.palette.length)) {
    const all = Object.values(CFG.paletteGroups).flat().filter(Boolean);
    CFG.options = CFG.options || {};
    CFG.options.palette = Array.from(new Set(all));
  }

  alert(
    "CFG ✅ " + (CFG?.meta?.version || "?") +
    "\nkeys: " + Object.keys(CFG?.options || {}).join(", ") +
    "\nproduct len: " + (CFG?.options?.product?.length || 0) +
    "\npalette len: " + (CFG?.options?.palette?.length || 0)
  );
}

function fillSelect(id, items, placeholder) {
  const sel = $(id);
  if (!sel) return;

  sel.innerHTML = "";

  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = placeholder;
  sel.appendChild(o0);

  (items || []).forEach((item) => {
    const opt = document.createElement("option");

    if (typeof item === "string") {
      opt.value = item;
      opt.textContent = item;
    } else {
      opt.value = item.value ?? "";
      opt.textContent = item.label ?? item.value ?? "";
    }

    sel.appendChild(opt);
  });
}

function getAllPalettes() {
  // Preferred: if options.palette exists, use it
  if (Array.isArray(CFG?.options?.palette) && CFG.options.palette.length) {
    return CFG.options.palette;
  }

  // Otherwise: build from paletteGroups
  const groups = CFG?.paletteGroups || {};
  const flattened = Object.values(groups).flat().filter(Boolean);
  return uniq(flattened);
}

function populateAllOptionsFromConfig() {
  if (!CFG?.options) return;

  fillSelect("count", ["1","2","3","4","5"], "How many prompts?");
  fillSelect("product", CFG.options.product, "Select product...");
  fillSelect("genreTone", CFG.options.genreTone, "Select genre...");
  fillSelect("vibe", CFG.options.vibe, "Select vibe...");
  fillSelect("palette", getAllPalettes(), "Select palette...");
  fillSelect("background", CFG.options.background, "Select background...");
  fillSelect("border", CFG.options.border, "Select border...");
  fillSelect("outline", CFG.options.outline, "Select outline...");
  fillSelect("spice", CFG.options.spice, "Select spice...");

  alert("Populate ran ✅");
}

function applyDefaults() {
  const d = CFG?.defaults || {};
  Object.entries(d).forEach(([key, val]) => {
    if ($(key)) setV(key, val);
  });
}

function getSelectedProductMainSubject() {
  const selected = v("product");
  const list = CFG?.options?.product || [];
  const obj = list.find(p => (p.value === selected));
  return obj?.mainSubject || selected || "";
}

function spiceAesthetic() {
  const lvl = String(v("spice") || "2");
  return CFG?.spiceAestheticByLevel?.[lvl] || "";
}

function finishText() {
  const outline = (v("outline") === "bold_black") ? "thick bold outline" : "no outline";
  const border = (v("border") === "white") ? "clean white sticker offset border" : "no sticker border";

  const bg =
    (v("background") === "transparent") ? "transparent background" :
    (v("background") === "solid_white") ? "solid white background" :
    "background not specified";

  return [
    outline,
    border,
    bg,
    "booktok pop-art sticker style",
    "bold shapes, punchy contrast, crisp edges, vector-like clarity",
    "high resolution",
    "no brand logos, no watermark"
  ].join(", ");
}

function buildQuotePool() {
  const banks = CFG?.quoteBanks || {};
  const genre = v("genreTone");
  const vibe = v("vibe");

  let pool = [];

  // If these checkboxes exist, respect them (manual control mode)
  const hasBankUI =
    $("bGeneralUrbanBookish") || $("bMoodQuotes") || $("bIYKYK");

  if (hasBankUI) {
    if ($("bGeneralUrbanBookish") && c("bGeneralUrbanBookish")) pool.push(...(banks.general_urban_bookish || []));
    if ($("bMoodQuotes") && c("bMoodQuotes")) pool.push(...(banks.mood_quotes || []));
    if ($("bIYKYK") && c("bIYKYK")) pool.push(...(banks.iykyk || []));

    // ✅ Even in checkbox mode, we still allow vibe-based boosts (so DBE triggers work)
    bankKeysFromVibe(vibe).forEach(k => pool.push(...(banks[k] || [])));

  } else {
    // No bank UI? Then we do smart automatic pooling:
    const genreKey = bankKeyFromGenre(genre);
    pool.push(...(banks[genreKey] || []));

    // ✅ Vibe boosts (includes DBE)
    bankKeysFromVibe(vibe).forEach(k => pool.push(...(banks[k] || [])));
  }

  // Micro quotes toggle
  const microOn = $("useMicroQuotes") ? c("useMicroQuotes") : true;
  if (microOn) pool.push(...(CFG.microQuotes || []));

  // Clean + unique
  pool = uniq(pool.filter(Boolean));

  // Final fallback so it never empties
  if (!pool.length) {
    pool = uniq([...(banks.general_urban_bookish || []), ...(banks.mood_quotes || []), ...(CFG.microQuotes || [])]);
  }

  return pool;
}

function chooseQuote() {
  const typed = (v("quote") || "").trim();
  if (typed) return typed;

  if ($("useRandomQuote") && !c("useRandomQuote")) return "";

  const pool = buildQuotePool();
  return pool.length ? pick(pool) : "";
}

function buildPromptOnce() {
  const palette = v("palette");
  const genre = v("genreTone");
  const vibe = v("vibe");
  const mainSubject = getSelectedProductMainSubject();
  const quote = chooseQuote();

  const cutSafe =
    "Cut-safe die-cut requirement: one continuous closed silhouette outline around the ENTIRE design. " +
    "ABSOLUTE RULE: every sparkle, glitter dot, foil fleck, smoke wisp, particle, shine pop, and glow must be INSIDE the silhouette boundary. " +
    "No floating elements outside the border. No stray dots. No outside specks. No outside aura. No outer shadow. " +
    "Any glow must hug the silhouette tightly and remain fully inside the die-cut outline. " +
    "If any particles would cross the edge, remove them.";

  const spice = spiceAesthetic();

  return [
    "Create image:",
    finishText() + ".",
    cutSafe,
    palette ? `Color palette: ${palette}.` : "",
    genre ? `Genre tone: ${genre}.` : "",
    vibe ? `Vibe: ${vibe}.` : "",
    spice ? `Spice aesthetic: ${spice}.` : "",
    mainSubject ? `Main subject: ${mainSubject}.` : "Main subject: simple iconic bookish symbol.",
    quote
  ? `Text requirement: Print the quote EXACTLY as written ON the product itself (on the main label panel of the main subject). The quote must be integrated into the product design — NOT on a separate banner, ribbon, plaque, or floating below the product. Quote text: “${quote}”.`
  : "",
    "Typography: clear legible typography, centered composition, bold high-contrast text, no distorted letters.",
    "Original design, no trademarks, no brand logos, no watermark."
  ].filter(Boolean).join(" ");
}

function generate() {
  const count = parseInt(v("count") || "1", 10);
  const n = Number.isFinite(count) && count > 0 ? count : 1;

  const prompts = Array.from({ length: n }, () => buildPromptOnce());
  setV("output", prompts.join("\n\n---\n\n"));
}

function setSelectToRandom(id) {
  const sel = $(id);
  if (!sel) return;
  const opts = Array.from(sel.options).filter(o => o.value);
  if (!opts.length) return;
  sel.value = pick(opts).value;
}

function bankKeyFromGenre(genre) {
  const g = (genre || "").toLowerCase().trim();

  if (g.includes("dark")) return "dark_romance";
  if (g.includes("paranormal")) return "paranormal";
  if (g.includes("thriller")) return "thriller";
  if (g.includes("soft")) return "soft_life_self_care";
  if (g.includes("urban")) return "general_urban_bookish";

  return "mood_quotes"; // safe fallback
}

function bankKeysFromVibe(vibe) {
  const s = (vibe || "").toLowerCase();

  const keys = [];

  // Your existing vibe boosts (keep these)
  if (s.includes("iykyk")) keys.push("iykyk");
  if (s.includes("kindle")) keys.push("mood_quotes");

  // ✅ NEW: Unhinged / Wealthy / DBE triggers
  // 🔥 BDE only
if (s.includes("bde")) {
  keys.push("bde_energy");
}

// 👑 DBE only
if (s.includes("dbe") || s.includes("dark boss")) {
  keys.push("unhinged_wealthy_dbe");
}

// 💰 Wealthy / billionaire lane (optional stacking)
if (
  s.includes("billionaire") ||
  s.includes("wealthy") ||
  s.includes("rich") ||
  s.includes("old money") ||
  s.includes("private jet") ||
  s.includes("mogul") ||
  s.includes("high net worth")
) {
  keys.push("unhinged_wealthy_dbe");
}
  return keys;
}

// Map CFG quote bank keys -> your checkbox IDs in HTML
function bankKeyToCheckboxId(bankKey) {
  const map = {
    general_urban_bookish: "bGeneralUrbanBookish",
    mood_quotes: "bMoodQuotes",
    iykyk: "bIYKYK"
    // NOTE: you don't currently have checkboxes for dark_romance/paranormal/etc
    // so we route those through mood/general depending on your UI.
  };
  return map[bankKey] || null;
}

// Pick 1–2 banks, smarter, without checking everything
function smartPickBanksFromSelections() {
  const genre = v("genreTone");
  const vibe = v("vibe");

  // Start with genre-based intent
  const genreKey = bankKeyFromGenre(genre);

  // Because your UI only has 3 bank checkboxes, “route” genre intent:
  // - dark/paranormal/thriller → Mood Quotes (best “genre-ish” you have)
  // - urban → General Urban Bookish
  // - soft → Mood Quotes (until you add a soft-life checkbox)
  let primaryBankCheckbox = null;

  if (genreKey === "general_urban_bookish") primaryBankCheckbox = "bGeneralUrbanBookish";
  else primaryBankCheckbox = "bMoodQuotes";

  // Secondary bank based on vibe
  let secondaryBankCheckbox = null;
  const vibeLower = (vibe || "").toLowerCase();

  if (vibeLower.includes("iykyk")) secondaryBankCheckbox = "bIYKYK";
  else if (vibeLower.includes("kindle")) secondaryBankCheckbox = "bMoodQuotes";
  else {
    // optional: small chance to add Mood as a spice booster if primary isn't mood
    if (primaryBankCheckbox !== "bMoodQuotes" && Math.random() < 0.35) secondaryBankCheckbox = "bMoodQuotes";
  }

  // Deduplicate
  const picked = [primaryBankCheckbox, secondaryBankCheckbox].filter(Boolean);
  return Array.from(new Set(picked));
}

function smartGenreCheckboxFromGenreTone(genreTone) {
  const key = bankKeyFromGenre(genreTone);
  // Map genre bank key -> checkbox id
  const map = {
    dark_romance: "gDarkRomance",
    paranormal: "gParanormal",
    thriller: "gThriller",
    soft_life_self_care: "gSoftLife",
    general_urban_bookish: null, // genreTone=urban handled by CORE
    mood_quotes: null
  };
  return map[key] || null;
}

function getSelectedProductObj() {
  const selected = v("product");
  const list = CFG?.options?.product || [];
  return list.find(p => p.value === selected) || null;
}

function setPaletteSmartForSelectedProduct() {
  const p = getSelectedProductObj();
  const lock = p?.paletteLock;

  // If no lock, do nothing (palette stays random as usual)
  if (!lock) return;

  const group = CFG?.paletteGroups?.[lock];
  if (!Array.isArray(group) || !group.length) return;

  // Pick from the locked group only
  setV("palette", pick(group));
}

function randomizeAll() {
  // dropdowns
  setSelectToRandom("count");
  setSelectToRandom("product");
  setSelectToRandom("genreTone");
  setSelectToRandom("vibe");
  setSelectToRandom("palette");      // normal random first
  setPaletteSmartForSelectedProduct(); // then lock it ONLY if product needs it
  setSelectToRandom("background");
  setSelectToRandom("border");
  setSelectToRandom("outline");
  setSelectToRandom("spice");

  // quote system ON for randomize
  if ($("useRandomQuote")) setC("useRandomQuote", true);
  if ($("useMicroQuotes")) setC("useMicroQuotes", true);

  // clear custom quote
  if ($("quote")) setV("quote", "");

  // Clear ALL bank checkboxes first
  [
    "bGeneralUrbanBookish","bMoodQuotes","bIYKYK",
    "gDarkRomance","gParanormal","gThriller","gSoftLife"
  ].forEach(id => { if ($(id)) setC(id, false); });

  // SMART PICKS (1–2 banks max total)
  const genreTone = v("genreTone");
  const vibe = v("vibe");
  const vibeLower = (vibe || "").toLowerCase();

  // Pick primary CORE bank
  // Urban -> general; otherwise mood
  let primaryCore = "bMoodQuotes";
  if ((genreTone || "").toLowerCase().includes("urban")) primaryCore = "bGeneralUrbanBookish";

  setC(primaryCore, true);

  // Optional GENRE bank (only if genreTone is dark/paranormal/thriller/soft)
  const genreBox = smartGenreCheckboxFromGenreTone(genreTone);
  let pickedCount = 1;

  // Decide whether to use genre bank as the 2nd pick
  // (helps make genreTone feel meaningful)
  if (genreBox && pickedCount < 2) {
    setC(genreBox, true);
    pickedCount++;
  }

  // If we still have room for a 2nd pick, vibe can add IYKYK
  if (pickedCount < 2 && vibeLower.includes("iykyk")) {
    setC("bIYKYK", true);
    pickedCount++;
  }

  // If nothing vibe-specific, small chance to add mood as a boost (if not already)
  if (pickedCount < 2 && primaryCore !== "bMoodQuotes" && Math.random() < 0.35) {
    setC("bMoodQuotes", true);
    pickedCount++;
  }

  generate();
}

function clearAll() {
  // reset selects to placeholder
  ["count","product","genreTone","vibe","palette","background","border","outline","spice"]
    .forEach(id => { if ($(id)) setV(id, ""); });

  // clear custom quote + output
  if ($("quote")) setV("quote", "");
  if ($("output")) setV("output", "");

  // ✅ CLEAR quote section toggles + bank selections
  if ($("useRandomQuote")) setC("useRandomQuote", false);
  if ($("useMicroQuotes")) setC("useMicroQuotes", false);

  if ($("bGeneralUrbanBookish")) setC("bGeneralUrbanBookish", false);
  if ($("bMoodQuotes")) setC("bMoodQuotes", false);
  if ($("bIYKYK")) setC("bIYKYK", false);
  // clear genre boost checkboxes
  if ($("gDarkRomance")) setC("gDarkRomance", false);
  if ($("gParanormal")) setC("gParanormal", false);
  if ($("gThriller")) setC("gThriller", false);
  if ($("gSoftLife")) setC("gSoftLife", false);
}

async function init() {
  try {
    await loadConfig();
    populateAllOptionsFromConfig();
    applyDefaults();
    generate();

    $("generateBtn")?.addEventListener("click", generate);
    $("randomizeBtn")?.addEventListener("click", randomizeAll);
    $("clearBtn")?.addEventListener("click", clearAll);

    $("copyBtn")?.addEventListener("click", async () => {
      const text = v("output");
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        alert("Copied ✅");
      } catch {
        const ta = $("output");
        ta?.select();
        document.execCommand("copy");
        alert("Copied ✅");
      }
    });

  } catch (e) {
    console.error(e);
    alert("Init error ❌ " + (e?.message || e));
  }
}

window.addEventListener("load", init);
