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

function buildPromptOnce() {
  const palette = v("palette");
  const genre = v("genreTone");
  const vibe = v("vibe");
  const mainSubject = getSelectedProductMainSubject();

  const cutSafe =
    "Cut-safe die-cut requirement: one continuous closed silhouette outline around the ENTIRE design. " +
    "ABSOLUTE RULE: every sparkle, glitter dot, foil fleck, smoke wisp, particle, shine pop, and glow must be INSIDE the silhouette boundary. " +
    "No floating elements outside the border. No stray dots. No outside specks. No outside aura. No outer shadow. " +
    "Any glow must hug the silhouette tightly and remain fully inside the die-cut outline. " +
    "If any particles would cross the edge, remove them.";

  return [
    "Create image:",
    finishText() + ".",
    cutSafe,
    palette ? `Color palette: ${palette}.` : "",
    genre ? `Genre tone: ${genre}.` : "",
    vibe ? `Vibe: ${vibe}.` : "",
    spiceAesthetic() ? `Spice aesthetic: ${spiceAesthetic()}.` : "",
    mainSubject ? `Main subject: ${mainSubject}.` : "Main subject: simple iconic bookish symbol.",
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

async function init() {
  try {
    await loadConfig();
    populateAllOptionsFromConfig();
    applyDefaults();
    generate();

    $("generateBtn")?.addEventListener("click", generate);
    $("copyBtn")?.addEventListener("click", async () => {
      const text = v("output");
      if (!text) return;
      await navigator.clipboard.writeText(text);
      alert("Copied ✅");
    });

  } catch (e) {
    setV("output", "❌ " + (e?.message || String(e)));
  }
}

window.addEventListener("load", init);
