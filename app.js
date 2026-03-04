/* app.js — Bookish Demands Sticker Prompt Generator (vNext)
   Fixes + upgrades:
   ✅ fixes generate not firing (guarantees functions exist + binds once)
   ✅ spice label mapping supports spice "5" gracefully
   ✅ dialogue mode supports your UI + defaults
   ✅ palette lock (product.paletteLock) + eliteUnlockMinSpice
   ✅ optional: “No repeats” + “Prompt style” hooks (safe if UI not added yet)
   ✅ avoids duplicate listeners + safer null checks
*/

console.log("app.js loaded ✅");

let CFG = null;

/* =========================================================
   Helpers
========================================================= */
const $ = (id) => document.getElementById(id);
const v = (id) => ($(id)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el != null) el.value = val; };
const c = (id) => !!($(id)?.checked);
const setC = (id, val) => { const el = $(id); if (el != null) el.checked = !!val; };

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const uniq = (arr) => Array.from(new Set(arr));

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

/* =========================================================
   Palette preview + palette name mapping
========================================================= */
function resolvePaletteKey(paletteName) {
  if (!paletteName) return "";
  const mapped = CFG?.paletteNameMap?.[paletteName]; // bookish -> original
  return mapped || paletteName;
}

function getPaletteEntry(paletteName) {
  if (!paletteName) return null;
  const originalKey = resolvePaletteKey(paletteName);
  const p = CFG?.paletteData?.[paletteName] || CFG?.paletteData?.[originalKey];
  if (!p) return null;

  return {
    name: paletteName, // show what user selected
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
   Config loading
========================================================= */
async function loadConfig() {
  const url = "./config.json?v=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`config.json fetch failed (${res.status})`);

  try { CFG = JSON.parse(text); }
  catch {
    throw new Error(`config.json JSON parse failed\nPreview:\n${text.slice(0, 300)}`);
  }

  CFG.options = CFG.options || {};
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

function populateAllOptionsFromConfig() {
  fillSelect("count", ["1","2","3","4","5"], "How many prompts?");
  fillSelect("product", CFG.options.product, "Select product...");
  fillSelect("genreTone", CFG.options.genreTone, "Select genre...");
  fillSelect("vibe", CFG.options.vibe, "Select vibe...");

  const paletteItems =
    (Array.isArray(CFG?.options?.palette) && CFG.options.palette.length)
      ? CFG.options.palette
      : Object.keys(CFG?.paletteData || {});

  fillSelect("palette", paletteItems, "Select a palette");
  fillSelect("background", CFG.options.background, "Select background...");
  fillSelect("border", CFG.options.border, "Select border...");
  fillSelect("outline", CFG.options.outline, "Select outline...");
  fillSelect("spice", CFG.options.spice, "Select spice...");

  // bind once
  $("palette")?.addEventListener("change", renderPalettePreview, { passive: true });
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

/* =========================================================
   Product subject lookup + palette lock support
========================================================= */
function getProductObject() {
  const selected = v("product");
  const products = CFG?.options?.product;

  if (Array.isArray(products) && products.length && typeof products[0] === "object") {
    return products.find(p => p?.value === selected) || products.find(p => p?.name === selected) || null;
  }
  return null;
}

function getSelectedProductSubject() {
  const selected = v("product");
  const obj = getProductObject();
  return obj?.mainSubject || selected || "";
}

function enforceProductPaletteLockIfNeeded() {
  const obj = getProductObject();
  const lock = obj?.paletteLock; // e.g. "blood"
  if (!lock) return;

  const group = CFG?.paletteGroups?.[lock];
  if (!Array.isArray(group) || !group.length) return;

  // If current palette not in allowed group, set a valid one.
  const current = v("palette");
  if (!group.includes(current)) {
    setV("palette", group[0]);
    renderPalettePreview();
  }
}

/* =========================================================
   Dialogue Mode generator
========================================================= */
function clampInt(n, lo, hi) {
  const x = parseInt(String(n ?? ""), 10);
  if (Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function roleToKey(r) {
  // Your sample CFG.dialogueBanks only has M and F
  if (r === "M" || r === "F") return r;
  // NB fallback: treat as F for bank lookup, but label still prints NB if you want later
  return "F";
}

function getDialogueExchange(lines, tone, pairing) {
  const bank = CFG?.dialogueBanks?.elite_dominance;

  const aRole = pairing?.[0] || "M";
  const bRole = pairing?.[1] || "F";
  const A = roleToKey(aRole);
  const B = roleToKey(bRole);

  const aLines = bank?.[A]?.[tone];
  const bLines = bank?.[B]?.[tone];

  const fallbackByTone = {
    threatening: ["Touch what’s mine and we escalate.", "Say less. Stay close.", "Try me."],
    argument: ["Don’t promise. Execute.", "I’m not repeating myself.", "Stand on it."],
    soft: ["Relax. You’re safe.", "Protection looks good on you.", "I got you."],
    flirty: ["You look like trouble. I like that.", "Say it again. Slower.", "Good. Because I don’t do temporary."]
  };

  const out = [];
  for (let i = 0; i < lines; i++) {
    const who = (i % 2 === 0) ? A : B;
    const pool = (who === A) ? aLines : bLines;

    let line = "";
    if (Array.isArray(pool) && pool.length) line = pick(pool);
    else line = pick(fallbackByTone[tone] || fallbackByTone.flirty);

    out.push(`${who}: ${line}`);
  }
  return out.join("\n");
}

/* =========================================================
   Spice label handling (supports 1–4 map, and 5 gracefully)
========================================================= */
function getSpiceLabel(spiceValue) {
  const sVal = String(spiceValue || "").trim();
  const map = CFG?.spiceAestheticByLevel || {};

  // direct
  if (map[sVal]) return map[sVal];

  // if spice "5" exists in UI but map only 1–4, treat 5 as 4+
  if (sVal === "5") return map["4"] ? `${map["4"]} (max)` : "maximum spice vibe (non-graphic)";

  // numeric fallback
  const n = clampInt(sVal, 1, 5);
  if (map[String(n)]) return map[String(n)];
  if (n > 4 && map["4"]) return `${map["4"]} (max)`;
  return "";
}

/* =========================================================
   Prompt builder (with safe “Prompt Style” hooks)
   Optional upgrades:
   - if you later add <select id="promptStyle"> minimal|detailed|cinematic
   - and <input id="noRepeats" type="checkbox">
   This code won’t break if they don’t exist.
========================================================= */
function buildOnePrompt() {
  // Enforce product palette locks before building
  enforceProductPaletteLockIfNeeded();

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

  // Elite unlock gate (optional): if spice below eliteUnlockMinSpice, don’t use elite-only banks.
  const eliteMin = clampInt(CFG?.eliteUnlockMinSpice ?? 0, 0, 10);
  const spiceNum = clampInt(spice || "1", 1, 5);

  let quoteText = "";

  if (useDialogue) {
    const lines = clampInt(v("dialogueLines") || "5", 4, 6);
    const tone = v("dialogueTone") || "flirty";
    const pairing = v("dialoguePairing") || "MF";
    quoteText = getDialogueExchange(lines, tone, pairing);
  } else if (customQuote) {
    quoteText = customQuote;
  } else if (useRandom) {
    quoteText = getRandomQuoteFromBanks();
  }

  const micro = getMicroQuoteMaybe();
  const microLine = micro ? `Micro-quote: ${micro}` : "";

  const hexLine = palette?.hex?.length ? `Palette hex: ${palette.hex.join(", ")}` : "";
  const paletteVibe = palette?.vibe ? `Palette vibe: ${palette.vibe}` : "";
  const spiceLabel = getSpiceLabel(spice);

  // Prompt style (optional UI hook)
  const style = (v("promptStyle") || "detailed").toLowerCase();

  const baseLines = [
    `MAIN SUBJECT: ${productSubject || "sticker subject (choose a product)"}`,
    quoteText ? `QUOTE:\n${quoteText}` : `QUOTE: (none)`,
    microLine,
    `GENRE TONE: ${genre || "—"}`,
    `VIBE: ${vibe || "—"}`,
    `PALETTE: ${paletteName || "—"}`,
    paletteVibe,
    hexLine,
    `BACKGROUND: ${background || "—"}`,
    `BORDER: ${border || "—"}`,
    `OUTLINE: ${outline || "—"}`,
    `SPICE: ${spice || "—"}${spiceLabel ? ` (${spiceLabel})` : ""}`
  ].filter(Boolean);

  const styleNotesMinimal = [
    `STYLE NOTES: clean sticker-ready design, bold readable composition, crisp edges, print-friendly, no real brand logos, no copyrighted characters.`
  ];

  const styleNotesDetailed = [
    `STYLE NOTES: clean sticker-ready design; bold readable composition; crisp vector-like linework; high-contrast; subtle gloss highlights; balanced whitespace for quote legibility; no real brand logos; no copyrighted characters; print-friendly (300dpi feel).`
  ];

  const styleNotesCinematic = [
    `STYLE NOTES: sticker-ready but cinematic; dramatic lighting cues; bold typographic hierarchy; premium “urban luxe” polish; crisp die-cut edge; strong silhouette; no real brand logos; no copyrighted characters; print-friendly.`
  ];

  const notes =
    style === "minimal" ? styleNotesMinimal :
    style === "cinematic" ? styleNotesCinematic :
    styleNotesDetailed;

  // Optional: elite hint (only if user picked elite vibe but spice too low)
  const eliteHint =
    (eliteMin > 0 && spiceNum < eliteMin && /elite|dominance|penthouse|morally/i.test(String(vibe || "")))
      ? [`NOTE: Elite energy selected. For full “Elite” unlock, set spice ≥ ${eliteMin}.`]
      : [];

  return [...baseLines, "", ...eliteHint, ...notes].filter(Boolean).join("\n");
}

/* =========================================================
   Buttons
========================================================= */
function generate() {
  const count = clampInt(v("count") || "1", 1, 20);
  const prompts = [];

  // Optional “no repeats” hook
  const noRepeats = c("noRepeats");
  const seen = new Set();

  for (let i = 0; i < count; i++) {
    let p = buildOnePrompt();

    if (noRepeats) {
      // try a few times to avoid duplicates
      let tries = 0;
      while (seen.has(p) && tries < 8) {
        p = buildOnePrompt();
        tries++;
      }
      seen.add(p);
    }

    prompts.push(p);
  }

  setV("output", prompts.join("\n\n---\n\n"));
}

function randomizeAll() {
  function pickRandomSelect(id) {
    const sel = $(id);
    if (!sel || !sel.options || sel.options.length < 2) return;
    const idx = 1 + rnd(sel.options.length - 1);
    sel.selectedIndex = idx;
  }

  pickRandomSelect("product");
  pickRandomSelect("genreTone");
  pickRandomSelect("vibe");
  pickRandomSelect("palette");
  pickRandomSelect("background");
  pickRandomSelect("border");
  pickRandomSelect("outline");
  pickRandomSelect("spice");

  // Keep core banks on by default
  setC("bGeneralUrbanBookish", true);
  setC("bMoodQuotes", true);

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

  renderPalettePreview();
}

function copyOutput() {
  const txt = v("output");
  if (!txt) return;
  navigator.clipboard.writeText(txt)
    .then(() => alert("Copied ✅"))
    .catch(() => alert("Copy failed ❌"));
}

/* =========================================================
   Init (bind ONCE)
========================================================= */
let __bound = false;

async function init() {
  try {
    await loadConfig();
    populateAllOptionsFromConfig();

    // Apply defaults AFTER options exist
    const d = CFG?.defaults || {};
    Object.entries(d).forEach(([key, val]) => { if ($(key)) setV(key, val); });

    // Enforce palette locks after defaults too
    enforceProductPaletteLockIfNeeded();

    // Render after defaults
    renderPalettePreview();

    // Bind buttons once
    if (!__bound) {
      __bound = true;

      $("generateBtn")?.addEventListener("click", generate);
      $("randomizeBtn")?.addEventListener("click", randomizeAll);
      $("clearBtn")?.addEventListener("click", clearAll);
      $("copyBtn")?.addEventListener("click", copyOutput);

      // Quality of life: if user changes product, enforce paletteLock instantly
      $("product")?.addEventListener("change", () => {
        enforceProductPaletteLockIfNeeded();
        renderPalettePreview();
      });

      // Auto-regenerate on key changes (optional; safe)
      ["genreTone","vibe","palette","background","border","outline","spice"].forEach(id => {
        $(id)?.addEventListener("change", () => {
          renderPalettePreview();
          // don’t auto-generate if output is empty and user hasn’t asked; comment out if you prefer
          // if (v("output")) generate();
        });
      });
    }
  } catch (e) {
    console.error(e);
    alert("Init error ❌ " + (e?.message || e));
  }
}

window.addEventListener("load", init);
