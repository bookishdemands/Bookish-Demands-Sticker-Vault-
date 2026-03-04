/* app.js — Bookish Demands Generator (v2.2.1)
   Includes your v2.2 upgrades + the missing Color A/Color B + Gradient fixes.

   ✅ Single palette pipeline (product lock + vibe filter)
   ✅ AI-smart palette selection (vibe-weighted randomize)
   ✅ Vibe intensity control (Balanced / On-theme / Super on-theme)
   ✅ No duplicate event listeners
   ✅ Safe helpers + consistent option normalization
   ✅ Color A / Color B populated from selected palette hex
   ✅ Gradient toggle (A → B) + angle + UI show/hide
   ✅ Prompt output reflects gradient + color overrides

   NOTE (important):
   If you still see “JSON Parse error: Expected '}'” — that is config.json being invalid JSON.
   The most common cause (in your pasted config) is:
   defaults.gradientAngle missing a comma before "background".
*/

let CFG = null;

/* ===================== Core ===================== */

const $ = (id) => document.getElementById(id);
const v = (id) => ($(id)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el) el.value = val; };
const c = (id) => !!($(id)?.checked);
const setC = (id, val) => { const el = $(id); if (el) el.checked = !!val; };

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];

/* ===================== Vibe → Palette Tag Mapping ===================== */

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

/* ===================== Utilities ===================== */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

/**
 * Ensures options arrays can be either:
 * - ["A","B"] or
 * - [{value:"A",label:"A"}, ...]
 * Returns an array of string values.
 */
function normalizeOptItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  if (typeof items[0] === "string") return items.slice();
  return items
    .map(x => x?.value ?? x?.name ?? x?.label ?? "")
    .filter(Boolean);
}

/* ===================== Palette helpers ===================== */

function resolvePaletteKey(paletteName) {
  if (!paletteName) return "";
  return CFG?.paletteNameMap?.[paletteName] || paletteName;
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

  const swatches = (entry.hex || [])
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
    <div class="hex">${escapeHtml(entry.hex.length ? entry.hex.join(" ") : "No hex codes found for this palette.")}</div>
  `;
}

/* ===================== Config load ===================== */

async function loadConfig() {
  const url = "./config.json?v=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`config.json fetch failed (${res.status})`);

  try {
    CFG = JSON.parse(text);
  } catch (err) {
    // Helpful debug hint (does not “fix” JSON, but makes it obvious what to check)
    throw new Error(
      `config.json JSON Parse error: ${err?.message || err}\n\n` +
      `Common cause: missing comma in defaults (ex: gradientAngle "90" needs a comma before background).\n` +
      `Open config.json and validate it with a JSON validator.`
    );
  }

  CFG.options = CFG.options || {};
}

/* ===================== Select filling ===================== */

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

let ALL_PALETTES_CACHE = null;

/* ===================== Product helpers ===================== */

function getSelectedProductObj() {
  const selected = v("product");
  const products = CFG?.options?.product;
  if (!Array.isArray(products) || !products.length) return null;
  if (typeof products[0] !== "object") return null;
  return products.find(p => p?.value === selected) || products.find(p => p?.name === selected) || null;
}

function getSelectedProductSubject() {
  const obj = getSelectedProductObj();
  return obj?.mainSubject || v("product") || "";
}

/* ===================== Palette tags + lists ===================== */

function paletteHasTags(paletteName, requiredTags) {
  const tags = CFG?.options?.paletteTags?.[paletteName] || [];
  if (!requiredTags?.length) return true;
  // qualifies if ANY required tags is present
  return requiredTags.some(tag => tags.includes(tag));
}

function getAllPalettes() {
  const opt = CFG?.options?.palette;
  const list = normalizeOptItems(opt);
  return (list.length) ? list : Object.keys(CFG?.paletteData || {});
}

/* =========================================================
   VIBE INTENSITY (dropdown id: "vibeIntensity")
========================================================= */

function getVibeIntensity() {
  const raw = (v("vibeIntensity") || "").trim().toLowerCase();
  if (!raw) return "on_theme";
  if (raw === "balanced" || raw === "on_theme" || raw === "super") return raw;
  return "on_theme";
}

function intensityParams() {
  const mode = getVibeIntensity();
  if (mode === "balanced") return { matchMult: 2, zeroPenalty: 0, hardBiasBonus: 1 };
  if (mode === "super")    return { matchMult: 6, zeroPenalty: 2, hardBiasBonus: 4 };
  return                   { matchMult: 4, zeroPenalty: 1, hardBiasBonus: 2 };
}

/* =========================================================
   SMART PALETTE ENGINE (lock-aware + vibe-filtered + weighted)
========================================================= */

function getEligiblePalettes() {
  let list = getAllPalettes().slice();

  // 1) Product lock
  const productObj = getSelectedProductObj();
  const lockGroup = productObj?.paletteLock;

  if (lockGroup && Array.isArray(CFG?.paletteGroups?.[lockGroup]) && CFG.paletteGroups[lockGroup].length) {
    list = CFG.paletteGroups[lockGroup].slice();
  }

  // 2) Vibe filter (soft enforce)
  const vibeName = v("vibe");
  const requiredTags = vibeTagMap[vibeName] || [];
  if (requiredTags.length) {
    const filtered = list.filter(p => paletteHasTags(p, requiredTags));
    if (filtered.length >= 6) list = filtered;
  }

  return list;
}

function getPaletteWeight(paletteName) {
  const vibeName = v("vibe");
  const req = vibeTagMap[vibeName] || [];
  const tags = CFG?.options?.paletteTags?.[paletteName] || [];

  const { matchMult, zeroPenalty, hardBiasBonus } = intensityParams();

  let w = 1;

  const matchCount = req.filter(t => tags.includes(t)).length;
  w += matchCount * matchMult;

  if (tags.includes("brand_core")) w += 2;

  if (vibeName === "Elite Dominance" && tags.includes("editorial")) w += hardBiasBonus;
  if (vibeName === "Dark Obsession" && tags.includes("possession_protocol")) w += hardBiasBonus;
  if (vibeName === "Kindle After Dark" && tags.includes("after_hours")) w += Math.max(1, Math.floor(hardBiasBonus / 2));

  if (matchCount === 0 && req.length) w = Math.max(1, w - zeroPenalty);

  return w;
}

function weightedPick(items, weights) {
  if (!items?.length) return "";
  const w = (Array.isArray(weights) && weights.length === items.length)
    ? weights.map(x => Math.max(0, x))
    : items.map(() => 1);

  const total = w.reduce((a, b) => a + b, 0);
  if (!total) return pick(items);

  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function smartPickPalette() {
  const eligible = getEligiblePalettes();
  if (!eligible.length) return "";
  const weights = eligible.map(getPaletteWeight);
  return weightedPick(eligible, weights);
}

/* =========================================================
   ONE PIPELINE: lock + vibe filter (dropdown population)
========================================================= */

function updatePaletteOptions() {
  let paletteList = getAllPalettes();

  const current = v("palette");
  const productObj = getSelectedProductObj();
  const lockGroup = productObj?.paletteLock;

  // 1) product lock
  if (lockGroup && Array.isArray(CFG?.paletteGroups?.[lockGroup]) && CFG.paletteGroups[lockGroup].length) {
    paletteList = CFG.paletteGroups[lockGroup].slice();
  }

  // 2) vibe filter (only apply if we keep a decent list)
  const vibeName = v("vibe");
  const requiredTags = vibeTagMap[vibeName] || [];
  if (requiredTags.length) {
    const filtered = paletteList.filter(p => paletteHasTags(p, requiredTags));
    if (filtered.length >= 6) paletteList = filtered;
  }

  fillSelect("palette", paletteList, lockGroup ? "Select a palette (locked)" : "Select a palette");

  // preserve selection if still valid, else pick first available
  if (current && paletteList.includes(current)) {
    setV("palette", current);
  } else if (paletteList.length) {
    setV("palette", paletteList[0]);
  }

  renderPalettePreview();
  updateColorOptions(); // ✅ keep Color A/B synced to palette
}

/* =========================================================
   COLOR A / COLOR B + GRADIENT
   - expects IDs: colorA, colorB, useGradient, gradientAngle
========================================================= */

function updateGradientUI() {
  const on = c("useGradient");

  const bWrap = $("colorB")?.closest(".field") || $("colorB");
  const angWrap = $("gradientAngle")?.closest(".field") || $("gradientAngle");

  // If your markup doesn't have .field wrappers, this still works (it will just show/hide the select itself)
  if (bWrap) bWrap.style.display = on ? "" : "none";
  if (angWrap) angWrap.style.display = on ? "" : "none";
}

function updateColorOptions() {
  const paletteName = v("palette");
  const entry = getPaletteEntry(paletteName);
  const hexes = entry?.hex || [];

  // If these controls don't exist in your HTML, safely exit.
  if (!$("colorA") && !$("colorB")) return;

  fillSelect("colorA", hexes, hexes.length ? "Pick Color A…" : "Pick a palette first…");
  fillSelect("colorB", ["", ...hexes], "None / optional");

  // preserve current selections if still valid
  const a = v("colorA");
  const b = v("colorB");
  if (a && !hexes.includes(a)) setV("colorA", "");
  if (b && b !== "" && !hexes.includes(b)) setV("colorB", "");

  // If gradient is ON, ensure B is set and different from A if possible
  if (c("useGradient")) {
    const A = v("colorA");
    let B = v("colorB");
    if (A && (!B || B === A)) {
      const alt = hexes.find(h => h !== A);
      if (alt) setV("colorB", alt);
    }
  }
}

/* ===================== Populate options ===================== */

function populateAllOptionsFromConfig() {
  fillSelect("count", ["1","2","3","4","5","10"], "How many prompts?");
  fillSelect("product", CFG.options.product, "Select product...");
  fillSelect("genreTone", CFG.options.genreTone, "Select genre...");
  fillSelect("vibe", CFG.options.vibe, "Select vibe...");

  // Vibe intensity (optional UI)
  if ($("vibeIntensity")) {
    fillSelect("vibeIntensity",
      [
        { value: "balanced", label: "Balanced (more variety)" },
        { value: "on_theme", label: "On-theme (recommended)" },
        { value: "super", label: "Super on-theme (AI-smart)" }
      ],
      "Vibe intensity..."
    );
  }

  const paletteItems = getAllPalettes();
  ALL_PALETTES_CACHE = paletteItems.slice();
  fillSelect("palette", paletteItems, "Select a palette");

  fillSelect("background", CFG.options.background, "Select background...");
  fillSelect("border", CFG.options.border, "Select border...");
  fillSelect("outline", CFG.options.outline, "Select outline...");
  fillSelect("spice", CFG.options.spice, "Select spice...");

  // Color controls (will be populated once a palette exists)
  if ($("colorA")) fillSelect("colorA", [], "Pick a palette first…");
  if ($("colorB")) fillSelect("colorB", [""], "None / optional");

  // listeners (no duplicates)
  $("palette")?.addEventListener("change", () => {
    renderPalettePreview();
    updateColorOptions();
  });

  $("product")?.addEventListener("change", updatePaletteOptions);
  $("vibe")?.addEventListener("change", updatePaletteOptions);

  $("useGradient")?.addEventListener("change", () => {
    updateGradientUI();
    updateColorOptions();
  });

  $("vibeIntensity")?.addEventListener("change", () => {
    updatePaletteOptions();
    const chosen = smartPickPalette();
    if (chosen) setV("palette", chosen);
    renderPalettePreview();
    updateColorOptions();
  });
}

/* ===================== Quotes ===================== */

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
  map.forEach(([chkId, key]) => { if (c(chkId)) banks.push(key); });
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

/* ===================== Dialogue ===================== */

function getDialogueExchange(lines, tone, pairing) {
  const bank = CFG?.dialogueBanks?.elite_dominance;

  const a = pairing?.[0] || "M";
  const b = pairing?.[1] || "F";
  const A = (a === "M") ? "M" : "F";
  const B = (b === "M") ? "M" : "F";

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

/* ===================== Prompt builder ===================== */

function spiceAestheticLabel(spiceVal) {
  const s = String(spiceVal || "");
  return CFG?.spiceAestheticByLevel?.[s] || "";
}

function buildOnePrompt(seedIdx = 0) {
  const productSubject = getSelectedProductSubject();
  const genre = v("genreTone");
  const vibeName = v("vibe");
  const paletteName = v("palette");
  const palette = getPaletteEntry(paletteName);

  const background = v("background");
  const border = v("border");
  const outline = v("outline");
  const spice = v("spice");

  // Color overrides
  const colorA = v("colorA");
  const colorB = v("colorB");
  const useGradient = c("useGradient");
  const gradientAngle = v("gradientAngle") || "90";

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

  // Output lines for color overrides
  const colorLine = colorA
    ? (useGradient && colorB
        ? `Color Options: A=${colorA}, B=${colorB}; Gradient: ON (${gradientAngle}°).`
        : `Color Options: A=${colorA}${colorB ? `, B=${colorB}` : ""}; Gradient: OFF.`)
    : `Color Options: none.`;

  const backgroundLine = (useGradient && colorA && colorB)
    ? `Background: gradient (${gradientAngle}°) from ${colorA} → ${colorB}.`
    : `Background: ${background || "transparent"}.`;

  return [
    `Sticker design: ${productSubject || "sticker subject"}.`,
    `Genre vibe: ${genre || "—"}; vibe: ${vibeName || "—"}; spice: ${spice || "—"}${spiceLabel ? ` (${spiceLabel})` : ""}.`,
    paletteLine,
    palette?.vibe ? `Palette mood: ${palette.vibe}.` : "",
    colorLine,
    backgroundLine,
    `Border: ${border || "white border"}; Outline: ${outline || "bold outline"}.`,
    textBlock,
    `Typography: bold centered sticker lettering, highly readable.`,
    `Style: ${styleNotes}.`,
  ].filter(Boolean).join("\n");
}

/* ===================== Buttons ===================== */

function generate() {
  const count = parseInt(v("count") || "1", 10) || 1;
  const prompts = [];
  for (let i = 0; i < count; i++) prompts.push(buildOnePrompt(i));
  setV("output", prompts.join("\n\n---\n\n"));
}

function randomizeAll() {
  function pickRandomSelect(id) {
    const sel = $(id);
    if (!sel || !sel.options || sel.options.length < 2) return;
    sel.selectedIndex = 1 + rnd(sel.options.length - 1);
  }

  // pick product/vibe early so palette engine can cooperate
  pickRandomSelect("product");
  pickRandomSelect("genreTone");
  pickRandomSelect("vibe");

  // refresh palette dropdown using lock + vibe filter
  updatePaletteOptions();

  // AI-smart palette pick (weighted)
  const chosen = smartPickPalette();
  if (chosen) setV("palette", chosen);

  // sync preview + colors with final palette
  renderPalettePreview();
  updateColorOptions();

  // randomize rest
  pickRandomSelect("background");
  pickRandomSelect("border");
  pickRandomSelect("outline");
  pickRandomSelect("spice");

  // Optional: randomize colorA/B from palette
  // (keeps it feeling “AI-smart” when Color Options are used)
  const entry = getPaletteEntry(v("palette"));
  const hexes = entry?.hex || [];
  if (hexes.length && $("colorA")) {
    setV("colorA", pick(hexes));
    if ($("colorB")) {
      // keep B different if possible
      const A = v("colorA");
      const alt = hexes.find(h => h !== A);
      setV("colorB", alt || "");
    }
  }

  // keep your preferred defaults
  setC("bGeneralUrbanBookish", true);
  setC("bMoodQuotes", true);

  updateGradientUI();
  generate();
}

function clearAll() {
  ["count","product","genreTone","vibe","palette","background","border","outline","spice"].forEach(id => {
    const sel = $(id);
    if (sel) sel.selectedIndex = 0;
  });

  // optional: reset intensity if it exists
  if ($("vibeIntensity")) setV("vibeIntensity", "on_theme");

  // reset colors + gradient
  if ($("colorA")) setV("colorA", "");
  if ($("colorB")) setV("colorB", "");
  if ($("useGradient")) setC("useGradient", false);
  if ($("gradientAngle")) setV("gradientAngle", "90");
  updateGradientUI();

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

  if (ALL_PALETTES_CACHE) fillSelect("palette", ALL_PALETTES_CACHE, "Select a palette");

  renderPalettePreview();
  updateColorOptions();
}

async function copyOutput() {
  const txt = v("output");
  if (!txt) return;

  try {
    await navigator.clipboard.writeText(txt);
    alert("Copied ✅");
  } catch {
    const out = $("output");
    if (!out) return alert("Copy failed ❌");
    out.focus();
    out.select();
    const ok = document.execCommand("copy");
    alert(ok ? "Copied ✅" : "Copy failed ❌");
  }
}

/* ===================== Init ===================== */

function bindButtons() {
  $("generateBtn")?.addEventListener("click", generate);
  $("randomizeBtn")?.addEventListener("click", randomizeAll);
  $("clearBtn")?.addEventListener("click", clearAll);
  $("copyBtn")?.addEventListener("click", copyOutput);
}

function applyDefaults() {
  const d = CFG?.defaults || {};
  Object.entries(d).forEach(([key, val]) => { if ($(key)) setV(key, val); });

  // set a safe default intensity if UI exists
  if ($("vibeIntensity") && !v("vibeIntensity")) setV("vibeIntensity", "on_theme");

  // after defaults set, apply lock + vibe filter
  updatePaletteOptions();

  // sync UI pieces
  renderPalettePreview();
  updateColorOptions();
  updateGradientUI();
}

async function init() {
  try {
    await loadConfig();
    populateAllOptionsFromConfig();
    bindButtons();
    applyDefaults();
  } catch (e) {
    console.error(e);
    setV("output", "INIT ERROR ❌\n\n" + (e?.message || e));
    alert("Init error ❌ " + (e?.message || e));
  }
}

document.addEventListener("DOMContentLoaded", init);
