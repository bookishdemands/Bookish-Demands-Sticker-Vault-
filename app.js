alert("app.js loaded ✅");
let CFG = null;

const $ = (id) => document.getElementById(id);
const v = (id) => ($(id)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el) el.value = val; };

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const uniq = (arr) => Array.from(new Set(arr));

async function loadConfig() {
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load config.json (${res.status})`);
  CFG = await res.json();

  alert(
    "CFG ✅ " +
    (CFG?.meta?.version || "?") +
    "\nkeys: " + Object.keys(CFG?.options || {}).join(", ") +
    "\nproduct len: " + (CFG?.options?.product?.length || 0)
   );
}  
    
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load config.json (${res.status})`);
  CFG = await res.json();
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

function populateAllOptionsFromConfig() {
  if (!CFG?.options) return;

  fillSelect("count", ["1","2","3","4","5"], "How many prompts?");
  fillSelect("product", CFG.options.product, "Select product...");
  fillSelect("genreTone", CFG.options.genreTone, "Select genre...");
  fillSelect("vibe", CFG.options.vibe, "Select vibe...");
  fillSelect("palette", CFG.options.palette, "Select palette...");
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
function bankKeyFromGenre(genre) {
  const g = (genre || "").toLowerCase().trim();

  if (g.includes("dark")) return "dark_romance";
  if (g.includes("paranormal")) return "paranormal";
  if (g.includes("thriller")) return "thriller";
  if (g.includes("soft")) return "soft_life_self_care";
  if (g.includes("urban")) return "general_urban_bookish";

  return "mood_quotes"; // safe fallback
}

function buildQuotePool() {
  const banks = CFG?.quoteBanks || {};
  let pool = [];

  // If these checkboxes exist, use them. If not, fall back.
  const hasBankUI =
    $("bGeneralUrbanBookish") || $("bMoodQuotes") || $("bIYKYK");

  if (hasBankUI) {
    if (c("bGeneralUrbanBookish")) pool.push(...(banks.general_urban_bookish || []));
    if (c("bMoodQuotes")) pool.push(...(banks.mood_quotes || []));
    if (c("bIYKYK")) pool.push(...(banks.iykyk || []));
  } else {
    // fallback if UI isn’t there
    const genre = v("genreTone");
    const genreKey = bankKeyFromGenre(genre);
    pool.push(...(banks[genreKey] || []));
  }

  // Micro quotes toggle
  const microOn = $("useMicroQuotes") ? c("useMicroQuotes") : true;
  if (microOn) pool.push(...(CFG.microQuotes || []));

  pool = uniq(pool.filter(Boolean));

  // final fallback so it never empties
  if (!pool.length) {
    pool = uniq([...(banks.general_urban_bookish || []), ...(CFG.microQuotes || [])]);
  }

  return pool;
}

function chooseQuote() {
  const typed = (v("quote") || "").trim();
  if (typed) return typed; // ✅ custom wins

  // If checkbox exists and is off, return empty
  if ($("useRandomQuote") && !c("useRandomQuote")) return "";

  const pool = buildQuotePool();
  return pool.length ? pick(pool) : "";
}

function buildPromptOnce() {
  const palette = v("palette");
  const genre = v("genreTone");
  const vibe = v("vibe");
  const mainSubject = getSelectedProductMainSubject();

  const quote = chooseQuote(); // ✅ pull a quote

  const cutSafe =
    "Cut-safe die-cut requirement: one continuous closed silhouette outline around the ENTIRE design. " +
    "ABSOLUTE RULE: every sparkle, glitter dot, foil fleck, smoke wisp, particle, shine pop, and glow must be INSIDE the silhouette boundary. " +
    "No floating elements outside the border. No stray dots. No outside specks. No outside aura. No outer shadow. " +
    "Any glow must hug the silhouette tightly and remain fully inside the die-cut outline. " +
    "If any particles would cross the edge, remove them.";

  const spice = spiceAesthetic(); // ✅ call once

  return [
    "Create image:",
    finishText() + ".",
    cutSafe,
    palette ? `Color palette: ${palette}.` : "",
    genre ? `Genre tone: ${genre}.` : "",
    vibe ? `Vibe: ${vibe}.` : "",
    spice ? `Spice aesthetic: ${spice}.` : "",
    mainSubject ? `Main subject: ${mainSubject}.` : "Main subject: simple iconic bookish symbol.",
    quote ? `Optional quote line: “${quote}”.` : "", // ✅ inject quote
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
  const opts = Array.from(sel.options).filter(o => o.value); // skip placeholder
  if (!opts.length) return;
  sel.value = pick(opts).value;
}

function randomizeAll() {
  // dropdowns
  setSelectToRandom("count");
  setSelectToRandom("product");
  setSelectToRandom("genreTone");
  setSelectToRandom("vibe");
  setSelectToRandom("palette");
  setSelectToRandom("background");
  setSelectToRandom("border");
  setSelectToRandom("outline");
  setSelectToRandom("spice");

  // clear custom quote so random can kick in
  if ($("quote")) setV("quote", "");

  generate();
}

function clearAll() {
  // reset selects to placeholder
  ["count","product","genreTone","vibe","palette","background","border","outline","spice"]
    .forEach(id => { if ($(id)) setV(id, ""); });

  // reset quote + output
  if ($("quote")) setV("quote", "");
  if ($("output")) setV("output", "");

  // reset checkboxes (optional defaults)
  if ($("useRandomQuote")) setC("useRandomQuote", true);
  if ($("useMicroQuotes")) setC("useMicroQuotes", true);
  if ($("bGeneralUrbanBookish")) setC("bGeneralUrbanBookish", true);
  if ($("bMoodQuotes")) setC("bMoodQuotes", true);
  if ($("bIYKYK")) setC("bIYKYK", true);
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

// ✅ this must be OUTSIDE init()
window.addEventListener("load", init);
