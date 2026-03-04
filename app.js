/* app.js — Bookish Demands Sticker Prompt Generator (fixed + upgraded)
   - Single palette engine (product lock + vibe filtering)
   - No duplicate listeners
   - Stable defaults + randomize that respects locks/filters
   - Palette preview always accurate
*/

let CFG = null;

const $ = (id) => document.getElementById(id);
const v = (id) => ($(id)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el) el.value = val; };
const c = (id) => !!($(id)?.checked);
const setC = (id, val) => { const el = $(id); if (el) el.checked = !!val; };

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

/* =========================================================
   Vibe → Palette Tag Mapping
========================================================= */
const vibeTagMap = {
  "Dark Obsession": ["dark_romance","possession_protocol","morally_gray","after_hours","moody","luxe"],
  "Kindle After Dark": ["after_hours","dark_romance","neon","bold"],
  "Elite Dominance": ["luxe","executive","old_money","gold_accent","brand_core","editorial"],
  "Urban Power": ["urban","gritty","high_contrast","bold"],
  "Feminine Authority": ["soft_glam","romantic","editorial","pink","bold"],
  "Soft Luxe": ["soft_glam","neutral","warm","gold_accent","calm"],
  "Bookish Mood": ["neutral","soft_glam","pastel","calm","minimal"],
  "Thriller & Noir": ["high_contrast","dramatic","cool_tone","dark","minimal","edgy"]
};

/* =========================================================
   Palette helpers
========================================================= */
let ALL_PALETTES_CACHE = [];
let LAST_PALETTE_LIST = [];

function resolvePaletteKey(paletteName) {
  if (!paletteName) return "";
  // paletteNameMap is bookish -> original (optional)
  const mapped = CFG?.paletteNameMap?.[paletteName];
  return mapped || paletteName;
}

function getPaletteEntry(paletteName) {
  if (!paletteName) return null;
  const originalKey = resolvePaletteKey(paletteName);
  const p = CFG?.paletteData?.[paletteName] || CFG?.paletteData?.[originalKey];
  if (!p) return null;

  return {
    name: paletteName,
    hex: Array.isArray(p.hex) ? p.hex : [],
    vibe: p.vibe || ""
  };
}

function renderPalettePreview() {
  const preview = $("palettePreview");
  if (!preview) return;

  const paletteName = v("palette");
  const entry = getPaletteEntry(paletteName);

  if (!entry) {
    preview.innerHTML = `<div class="meta">Select a palette to preview.</div>`;
    return;
  }

  const hexes = entry.hex || [];
  const swatches = hexes
    .map(h => `<span class="swatch" title="${escapeHtml(h)}" style="background:${escapeHtml(h)}"></span>`)
    .join("");

  preview.innerHTML = `
    <div class="top">
      <div>
        <div class="name">${escapeHtml(entry.name)}</div>
        <div class="meta">${escapeHtml(entry.vibe || "")}</div>
      </div>
      <div class="swatches">${swatches}</div>
    </div>
    <div class="hex">${escapeHtml(hexes.length ? hexes.join(" ") : "No hex codes found for this palette.")}</div>
  `;
}

/* =========================================================
   Config load
========================================================= */
async function loadConfig() {
  const url = "./config.json?v=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) throw new Error(`config.json fetch failed (${res.status})`);

  try {
    CFG = JSON.parse(text);
  } catch {
    throw new Error(
      `config.json JSON parse failed.\n` +
      `Common causes: trailing commas, smart quotes, hidden characters.\n\n` +
      `Preview:\n${text.slice(0, 450)}`
    );
  }

  CFG.options = CFG.options || {};
  CFG.options.paletteTags = CFG.options.paletteTags || {};
  CFG.paletteGroups = CFG.paletteGroups || {};
  CFG.paletteData = CFG.paletteData || {};
}

/* =========================================================
   Select filling
========================================================= */
function fillSelect(id, items, placeholder) {
  const sel = $(id);
  if (!sel) return;

  sel.innerHTML = "";

  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = placeholder || "Select…";
  sel.appendChild(o0);

  (items || []).forEach((item) => {
    const opt = document.createElement("option");
    const isString = (typeof item === "string");

    const val = isString ? item : (item.value ?? item.name ?? item.label ?? "");
    const label = isString ? item : (item.label ?? item.name ?? item.value ?? val);

    opt.value = val;
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

function getSelectedProductObj() {
  const selected = v("product");
  const products = CFG?.options?.product;
  if (!Array.isArray(products) || !products.length) return null;
  if (typeof products[0] !== "object") return null;

  return products.find(p => p?.value === selected)
    || products.find(p => p?.name === selected)
    || null;
}

function getSelectedProductSubject() {
  const obj = getSelectedProductObj();
  return obj?.mainSubject || v("product") || "";
}

function getAllPalettesList() {
  // Use config list first, else fallback to paletteData keys
  const list =
    (Array.isArray(CFG?.options?.palette) && CFG.options.palette.length)
      ? CFG.options.palette
      : Object.keys(CFG?.paletteData || {});
  return Array.isArray(list) ? list.slice() : [];
}

function populateAllOptionsFromConfig() {
  fillSelect("count", ["1","2","3","4","5","6","7","8","9","10"], "How many prompts?");
  fillSelect("product", CFG.options.product, "Select product...");
  fillSelect("genreTone", CFG.options.genreTone, "Select genre...");
  fillSelect("vibe", CFG.options.vibe, "Select vibe...");

  ALL_PALETTES_CACHE = getAllPalettesList();
  fillSelect("palette", ALL_PALETTES_CACHE, "Select a palette");

  fillSelect("background", CFG.options.background, "Select background...");
  fillSelect("border", CFG.options.border, "Select border...");
  fillSelect("outline", CFG.options.outline, "Select outline...");
  fillSelect("spice", CFG.options.spice, "Select spice...");
}

/* =========================================================
   Palette smart filtering (Product lock + Vibe tags)
========================================================= */
function paletteHasTags(paletteName, requiredTags) {
  if (!requiredTags?.length) return true;
  const tags = CFG?.options?.paletteTags?.[paletteName] || [];
  // keep palettes that match ANY required tag
  return requiredTags.some(tag => tags.includes(tag));
}

function computePaletteList() {
  // base list
  let paletteList = ALL_PALETTES_CACHE.length ? ALL_PALETTES_CACHE.slice() : getAllPalettesList();

  // PRODUCT PALETTE LOCK (e.g., Blood Oath Vial -> paletteLock: "blood")
  const productObj = getSelectedProductObj();
  const lockGroup = productObj?.paletteLock;
  if (lockGroup && Array.isArray(CFG?.paletteGroups?.[lockGroup]) && CFG.paletteGroups[lockGroup].length) {
    paletteList = CFG.paletteGroups[lockGroup].slice();
  }

  // VIBE FILTER
  const vibe = v("vibe");
  const requiredTags = vibeTagMap[vibe] || [];

  if (requiredTags.length) {
    const filtered = paletteList.filter(p => paletteHasTags(p, requiredTags));
    // Only apply if we still have a healthy selection (prevents empty dropdowns)
    if (filtered.length >= 6) paletteList = filtered;
  }

  return paletteList;
}

function updatePaletteOptions() {
  const current = v("palette");
  const paletteList = computePaletteList();

  LAST_PALETTE_LIST = paletteList.slice();
  fillSelect("palette", paletteList, "Select a palette");

  // Keep selection if still valid, otherwise auto-pick first real option
  if (current && paletteList.includes(current)) {
    setV("palette", current);
  } else if (paletteList.length) {
    setV("palette", paletteList[0]); // first real palette
  }

  renderPalettePreview();
}

/* =========================================================
   Quote selection
========================================================= */
function selectedBanks() {
  const map = [
    ["bGeneralUrbanBookish", "general_urban_bookish"],
    ["bMoodQuotes", "mood_quotes"],
    ["bIYKYK", "iykyk"],
    ["gDarkRomance", "dark_romance"],
    ["gParanormal", "paranormal"],
    ["gThriller", "thriller"],
    ["gSoftLife", "soft_life_self_care"],
  ];

  const banks = [];
  map.forEach(([chkId, key]) => {
    if (c(chkId)) banks.push(key);
  });

  return banks.length ? banks : ["general_urban_bookish"];
}

function getRandomQuoteFromBanks() {
  const banks = selectedBanks();
  const pool = [];

  banks.forEach((key) => {
    const arr = CFG?.quoteBanks?.[key];
    if (Array.isArray(arr)) pool.push(...arr);
  });

  return pool.length ? pick(pool) : "";
}

function getMicroQuoteMaybe() {
  if (!c("useMicroQuotes")) return "";
  const mq = CFG?.microQuotes;
  if (!Array.isArray(mq) || !mq.length) return "";
  return pick(mq);
}

/* =========================================================
   Dialogue Mode generator
========================================================= */
function getDialogueExchange(lines, tone, pairing) {
  const bank = CFG?.dialogueBanks?.elite_dominance; // matches JSON

  const a = pairing?.[0] || "M";
  const b = pairing?.[1] || "F";

  function roleToKey(r) { return (r === "M") ? "M" : "F"; } // NB falls back to F
  const A = roleToKey(a);
  const B = roleToKey(b);

  const aLines = bank?.[A]?.[tone];
  const bLines = bank?.[B]?.[tone];

  const out = [];
  for (let i = 0; i < lines; i++) {
    const who = (i % 2 === 0) ? A : B;
    const pool = (who === A) ? aLines : bLines;

    let line = "";
    if (Array.isArray(pool) && pool.length) line = pick(pool);
    else {
      line = (tone === "threatening")
        ? "Say less. Stay close."
        : (tone === "argument")
          ? "Don’t promise. Execute."
          : (tone === "soft")
            ? "Relax. You’re safe with me."
            : "You look like trouble. I like that.";
    }

    out.push(`${who}: ${line}`);
  }
  return out.join("\n");
}

/* =========================================================
   Prompt builder (Ideogram format)
========================================================= */
function spiceAestheticLabel(spiceVal) {
  const s = String(spiceVal || "");
  return (
    CFG?.spiceAestheticByLevel?.[s] ||
    (s === "5" ? "maximum spice vibe (non-graphic)" : "") ||
    ""
  );
}

function buildOnePrompt(seedIdx = 0) {
  const productSubject = getSelectedProductSubject();
  const genre = v("genreTone");
  const vibe = v("vibe");
  const paletteName = v("palette");
  const palette = getPaletteEntry(paletteName);
  const background = v("background");
  const border = v("border");
  const outline = v("outline");
  const spice = v("spice");

  const customQuote = (v("quote") || "").trim();
  const useRandom = c("useRandomQuote");
  const useDialogue = c("dialogueMode");

  let quoteText = "";

  if (useDialogue) {
    const lines = parseInt(v("dialogueLines") || "5", 10);
    const tone = v("dialogueTone") || "flirty";
    const pairing = v("dialoguePairing") || "MF";
    quoteText = getDialogueExchange(lines, tone, pairing);
  } else if (customQuote) {
    quoteText = customQuote;
  } else if (useRandom) {
    quoteText = getRandomQuoteFromBanks();
  }

  const micro = getMicroQuoteMaybe();
  const microLine = micro ? `MICRO-QUOTE: ${micro}` : "";

  const spiceLabel = spiceAestheticLabel(spice);

  const textBlock = quoteText
    ? (useDialogue
        ? `Text (stacked cinematic exchange, keep line breaks):\n${quoteText}`
        : `Text to render (exact wording): "${quoteText}"`)
    : `Text: none`;

  const styleNotes = [
    "die-cut sticker design",
    "bold clean composition",
    "high contrast",
    "crisp edges",
    "print-ready",
    "no real brand logos",
    "no copyrighted characters",
    "no watermark",
  ].join(", ");

  const paletteLine = palette?.hex?.length
    ? `Color palette: ${palette.hex.join(", ")}`
    : (paletteName ? `Color palette name: ${paletteName}` : "");

  const ideogramPrompt = [
    `Sticker design: ${productSubject || "sticker subject"}.`,
    `Genre vibe: ${genre || "—"}; vibe: ${vibe || "—"}; spice: ${spice || "—"}${spiceLabel ? ` (${spiceLabel})` : ""}.`,
    paletteLine,
    palette?.vibe ? `Palette mood: ${palette.vibe}.` : "",
    microLine,
    `Background: ${background || "transparent"}.`,
    `Border: ${border || "white border"}; Outline: ${outline || "bold outline"}.`,
    textBlock,
    `Typography: bold centered sticker lettering, highly readable.`,
    `Style: ${styleNotes}.`,
  ].filter(Boolean).join("\n");

  return ideogramPrompt;
}

/* =========================================================
   Buttons
========================================================= */
function generate() {
  const count = parseInt(v("count") || "1", 10) || 1;
  const prompts = [];
  for (let i = 0; i < count; i++) prompts.push(buildOnePrompt(i));
  setV("output", prompts.join("\n\n---\n\n"));
}

function pickRandomSelect(id) {
  const sel = $(id);
  if (!sel || !sel.options || sel.options.length < 2) return;
  const idx = 1 + rnd(sel.options.length - 1);
  sel.selectedIndex = idx;
}

function randomizeAll() {
  // randomize the drivers first
  pickRandomSelect("product");
  pickRandomSelect("genreTone");
  pickRandomSelect("vibe");
  pickRandomSelect("background");
  pickRandomSelect("border");
  pickRandomSelect("outline");
  pickRandomSelect("spice");

  // keep your preferred defaults
  setC("bGeneralUrbanBookish", true);
  setC("bMoodQuotes", true);

  // now apply palette lock + vibe filtering, then choose a random palette from the filtered list
  updatePaletteOptions();
  const paletteSel = $("palette");
  if (paletteSel && paletteSel.options && paletteSel.options.length > 1) {
    paletteSel.selectedIndex = 1 + rnd(paletteSel.options.length - 1);
  }

  renderPalettePreview();
  generate();
}

function clearAll() {
  ["count","product","genreTone","vibe","palette","background","border","outline","spice"].forEach(id => {
    const sel = $(id);
    if (sel) sel.selectedIndex = 0;
  });

  setV("quote", "");
  setV("output", "");

  setC("useRandomQuote", true);
  setC("useMicroQuotes", true);
  setC("dialogueMode", false);

  setC("bGeneralUrbanBookish", true);
  setC("bMoodQuotes", true);
  setC("bIYKYK", false);

  setC("gDarkRomance", false);
  setC("gParanormal", false);
  setC("gThriller", false);
  setC("gSoftLife", false);

  // restore palette list + preview
  fillSelect("palette", ALL_PALETTES_CACHE, "Select a palette");
  renderPalettePreview();
}

async function copyOutput() {
  const txt = v("output");
  if (!txt) return;

  try {
    await navigator.clipboard.writeText(txt);
    alert("Copied ✅");
  } catch {
    // fallback for older Safari
    const out = $("output");
    if (!out) return alert("Copy failed ❌");
    out.focus();
    out.select();
    const ok = document.execCommand("copy");
    alert(ok ? "Copied ✅" : "Copy failed ❌");
  }
}

/* =========================================================
   Init
========================================================= */
function bindButtons() {
  $("generateBtn")?.addEventListener("click", generate);
  $("randomizeBtn")?.addEventListener("click", randomizeAll);
  $("clearBtn")?.addEventListener("click", clearAll);
  $("copyBtn")?.addEventListener("click", copyOutput);
}

function bindSmartListeners() {
  $("palette")?.addEventListener("change", renderPalettePreview);

  // One palette engine: updates on product/vibe changes
  $("product")?.addEventListener("change", updatePaletteOptions);
  $("vibe")?.addEventListener("change", updatePaletteOptions);
}

function applyDefaults() {
  const d = CFG?.defaults || {};
  Object.entries(d).forEach(([key, val]) => {
    if ($(key)) setV(key, val);
  });

  // apply locks/filters based on defaults
  updatePaletteOptions();
  renderPalettePreview();
}

async function init() {
  try {
    await loadConfig();
    populateAllOptionsFromConfig();
    bindButtons();
    bindSmartListeners();
    applyDefaults();
  } catch (e) {
    console.error(e);
    setV("output", "INIT ERROR ❌\n\n" + (e?.message || e));
    alert("Init error ❌ " + (e?.message || e));
  }
}

document.addEventListener("DOMContentLoaded", init);
