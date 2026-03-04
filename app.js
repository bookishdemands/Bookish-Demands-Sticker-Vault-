alert("app.js loaded ✅");

let CFG = null;

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
   ✅ Palette preview — supports:
   - paletteData keyed by ORIGINAL names
   - dropdown showing BOOKISH names
   - paletteNameMap: bookish -> original
========================================================= */
function resolvePaletteKey(paletteName) {
  if (!paletteName) return "";
  const mapped = CFG?.paletteNameMap?.[paletteName]; // bookish -> original
  return mapped || paletteName;
}

function getPaletteEntry(paletteName) {
  if (!paletteName) return null;

  const originalKey = resolvePaletteKey(paletteName);

  // Prefer paletteData
  const p = CFG?.paletteData?.[paletteName] || CFG?.paletteData?.[originalKey];

  if (p) {
    return {
      name: paletteName, // show what user selected (bookish)
      hex: Array.isArray(p.hex) ? p.hex : [],
      vibe: p.vibe || ""
    };
  }

  // Legacy fallback: options.palette objects (rare)
  const list = CFG?.options?.palette || [];
  if (Array.isArray(list)) {
    const obj = list.find(x => (x?.name === paletteName));
    if (obj) {
      return {
        name: obj.label || obj.name || paletteName,
        hex: Array.isArray(obj.hex) ? obj.hex : [],
        vibe: obj.vibe || obj.collection || ""
      };
    }
  }

  return null;
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

  // ✅ IMPORTANT: match your CSS structure:
  // .palette-preview (container) then .top (child)
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
   ✅ Config + Select Fill
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

  // one listener only
  $("palette")?.addEventListener("change", renderPalettePreview);
}

/* =========================================================
   ✅ Quote selection
========================================================= */
function selectedBanks() {
  // Map checkbox IDs -> CFG.quoteBanks keys
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

  // fallback if nothing selected
  return banks.length ? banks : ["general_urban_bookish"];
}

function getRandomQuoteFromBanks() {
  const banks = selectedBanks();
  const pool = [];

  banks.forEach((key) => {
    const arr = CFG?.quoteBanks?.[key];
    if (Array.isArray(arr)) pool.push(...arr);
  });

  if (!pool.length) return "";
  return pick(pool);
}

function getMicroQuoteMaybe() {
  if (!c("useMicroQuotes")) return "";
  const mq = CFG?.microQuotes;
  if (!Array.isArray(mq) || !mq.length) return "";
  return pick(mq);
}

/* =========================================================
   ✅ Product subject lookup
========================================================= */
function getSelectedProductSubject() {
  const selected = v("product");
  const products = CFG?.options?.product;

  // If options.product is an array of objects like {value, mainSubject}
  if (Array.isArray(products) && products.length && typeof products[0] === "object") {
    const match = products.find(p => p?.value === selected) || products.find(p => p?.name === selected);
    return match?.mainSubject || selected || "";
  }

  // Otherwise it's strings
  return selected || "";
}

/* =========================================================
   ✅ Dialogue Mode generator (safe fallback)
========================================================= */
function getDialogueExchange(lines, tone, pairing) {
  // Your CFG.dialogueBanks example uses dialogueBanks.elite_dominance.M.flirty etc.
  // We'll try to pull from that if it exists, otherwise fallback.
  const bank = CFG?.dialogueBanks?.elite_dominance;

  const speakerOrder = (() => {
    // pairing uses MF / FM / MM / FF
    const a = pairing?.[0] || "M";
    const b = pairing?.[1] || "F";
    return [a, b];
  })();

  function roleToKey(r) { return (r === "M" ? "M" : "F"); } // CFG sample only has M/F
  const [A, B] = speakerOrder.map(roleToKey);

  const aLines = bank?.[A]?.[tone];
  const bLines = bank?.[B]?.[tone];

  const out = [];
  for (let i = 0; i < lines; i++) {
    const who = (i % 2 === 0) ? A : B;
    const pool = (who === A) ? aLines : bLines;

    let line = "";
    if (Array.isArray(pool) && pool.length) line = pick(pool);
    else {
      // fallback if no dialogue bank
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
   ✅ Prompt builder
========================================================= */
function buildOnePrompt() {
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
  const microLine = micro ? `Micro-quote: ${micro}` : "";

  const hexLine = palette?.hex?.length ? `Palette hex: ${palette.hex.join(", ")}` : "";
  const paletteVibe = palette?.vibe ? `Palette vibe: ${palette.vibe}` : "";

  // Your “non-graphic spice” mapping lives in config; we’ll include the label if present.
  const spiceLabel =
    CFG?.spiceAestheticByLevel?.[String(spice)] ||
    CFG?.spiceAestheticByLevel?.[String(parseInt(spice || "0", 10))] ||
    "";

  return [
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
    `SPICE: ${spice || "—"}${spiceLabel ? ` (${spiceLabel})` : ""}`,
    ``,
    `STYLE NOTES: clean sticker-ready design, bold readable composition, no real brand logos, no copyrighted characters, high-contrast, crisp edges, print-friendly.`
  ].filter(Boolean).join("\n");
}

/* =========================================================
   ✅ Buttons
========================================================= */
function generate() {
  const count = parseInt(v("count") || "1", 10) || 1;
  const prompts = [];
  for (let i = 0; i < count; i++) prompts.push(buildOnePrompt());
  setV("output", prompts.join("\n\n---\n\n"));
}

function randomizeAll() {
  // Helper to pick a random option from a select (skipping placeholder)
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

  // Optional: random bank toggles (keep core on by default)
  setC("bGeneralUrbanBookish", true);
  setC("bMoodQuotes", true);

  renderPalettePreview();
  generate();
}

function clearAll() {
  // reset selects to placeholder
  ["count","product","genreTone","vibe","palette","background","border","outline","spice"].forEach(id => {
    const sel = $(id);
    if (sel) sel.selectedIndex = 0;
  });

  setV("quote", "");
  setV("output", "");

  // reset checkboxes
  setC("useRandomQuote", true);
  setC("useMicroQuotes", true);

  setC("dialogueMode", false);

  // bank defaults
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
   ✅ Init
========================================================= */
async function init() {
  try {
    await loadConfig();
    populateAllOptionsFromConfig();

    // Apply defaults AFTER options exist
    const d = CFG?.defaults || {};
    Object.entries(d).forEach(([key, val]) => {
      // If it's a checkbox key, you can extend this, but current defaults are mostly selects.
      if ($(key)) setV(key, val);
    });

    // render after defaults
    renderPalettePreview();

    // Buttons (✅ generate/randomizeAll/clearAll NOW exist)
    $("generateBtn")?.addEventListener("click", generate);
    $("randomizeBtn")?.addEventListener("click", randomizeAll);
    $("clearBtn")?.addEventListener("click", clearAll);
    $("copyBtn")?.addEventListener("click", copyOutput);

  } catch (e) {
    console.error(e);
    alert("Init error ❌ " + (e?.message || e));
  }
}

window.addEventListener("load", init);
