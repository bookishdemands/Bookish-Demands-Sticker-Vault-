// app.js (Option 2 - corrected)
let CFG = null;

const $ = (id) => document.getElementById(id);
const v = (id) => ($(id)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el) el.value = val; };

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const uniq = (arr) => Array.from(new Set(arr));

async function loadConfig() {
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load config.json");
  CFG = await res.json();
  // optional debug:
  // alert("Config loaded ✅ " + (CFG?.meta?.version || "no version found"));
}

function fillSelect(id, items, { placeholder = "Select..." } = {}) {
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

  // Only populate dropdowns that exist in your HTML.
  // These match your screenshots:
  fillSelect("product", CFG.options.product, { placeholder: "Select product..." });
  fillSelect("genreTone", CFG.options.genreTone, { placeholder: "Select genre..." });
  fillSelect("vibe", CFG.options.vibe, { placeholder: "Select vibe..." });
  fillSelect("palette", CFG.options.palette, { placeholder: "Select palette..." });
  fillSelect("background", CFG.options.background, { placeholder: "Select background..." });
  fillSelect("border", CFG.options.border, { placeholder: "Select border..." });
  fillSelect("outline", CFG.options.outline, { placeholder: "Select outline..." });
  fillSelect("spice", CFG.options.spice, { placeholder: "Select spice..." });

  // If you add <select id="count"> later, uncomment:
  fillSelect("count", ["1","2","3","4","5"], { placeholder: "How many prompts?" });
}

function applyDefaults() {
  const d = CFG?.defaults || {};
  // Only apply defaults to IDs that exist on the page.
  Object.entries(d).forEach(([key, val]) => {
    if ($(key)) setV(key, val);
  });

  // Common mismatch helpers (because your config uses different names sometimes):
  // If config has bgMode but your UI is background:
  if (!$("bgMode") && $("background") && d.bgMode && !v("background")) setV("background", d.bgMode);

  // If config has spiceLevel but your UI is spice:
  if (!$("spiceLevel") && $("spice") && d.spiceLevel && !v("spice")) setV("spice", d.spiceLevel);

  // If config has productTheme but your UI is product:
  if (!$("productTheme") && $("product") && d.productTheme && !v("product")) setV("product", d.productTheme);
}

// Convert "IV Drip Bag" -> "iv_bag" to match your productDesc/productCategory keys
function toKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Your product dropdown items are objects {value, mainSubject}
function selectedProductObj() {
  const selected = v("product");
  return (CFG?.options?.product || []).find(p => p.value === selected) || null;
}

function productKey() {
  const p = selectedProductObj();
  // Prefer explicit keys if you add them later, else derive:
  return p?.key || toKey(p?.value || "");
}

function productDescText() {
  const p = selectedProductObj();
  if (!p) return "";
  // Prefer mainSubject from options (best), else fall back to productDesc map:
  return p.mainSubject || CFG?.productDesc?.[productKey()] || p.value;
}

function productCategory() {
  const k = productKey();
  return CFG?.productCategory?.[k] || "default";
}

function getAutoLabel() {
  const k = productKey() || "default";
  const titles = CFG?.labelTitles?.[k] || CFG?.labelTitles?.default || ["MAIN CHARACTER ENERGY"];
  const cat = productCategory();
  const subs = CFG?.labelSubsByCategory?.[cat] || CFG?.labelSubsByCategory?.default || ["Handle with care."];
  return { title: pick(titles), subtitle: pick(subs) };
}

function spiceAestheticText() {
  const lvl = String(v("spice") || "2"); // ✅ read from spice dropdown
  return CFG?.spiceAestheticByLevel?.[lvl] || CFG?.spiceAestheticByLevel?.["2"] || "";
}

function finishText() {
  const outline = (v("outline") === "bold_black") ? "thick bold outline" : "no outline";
  const border = (v("border") === "white") ? "clean white sticker offset border" : "no sticker border";

  // ✅ read from background dropdown
  const bgVal = v("background");
  const bg =
    (bgVal === "transparent") ? "transparent background" :
    (bgVal === "solid_white") ? "solid white background" :
    (bgVal ? `${bgVal} background` : "background not specified");

  return [
    outline,
    border,
    bg,
    "bold shapes, punchy contrast",
    "crisp outlines, crisp edges, vector-like clarity",
    "high resolution",
    "no brand logos, no watermark"
  ].filter(Boolean).join(", ");
}

function cutSafeText() {
  // If you haven’t added cutSafeMode checkbox yet, always include (safe default).
  return [
    "Cut-safe die-cut requirement: one continuous closed silhouette outline around the ENTIRE design.",
    "ABSOLUTE RULE: every sparkle, glitter dot, foil fleck, smoke wisp, particle, shine pop, and glow must be INSIDE the silhouette boundary.",
    "No floating elements outside the border. No stray dots. No outside specks. No outside aura. No outer shadow.",
    "Any glow must hug the silhouette tightly and remain fully inside the die-cut outline.",
    "If any particles would cross the edge, remove them."
  ].join(" ");
}

function generate() {
  const palette = v("palette");
  const genre = v("genreTone");
  const vibe = v("vibe");

  const label = getAutoLabel();

  const productName = v("product") || "None";
  const mainSubject = productDescText()
    ? `Main subject: ${productDescText()}.`
    : "Main subject: simple iconic bookish symbol.";

  const prompt = [
    "Create image:",
    finishText() + ".",
    cutSafeText(),
    palette ? `Color palette: ${palette}.` : "",
    genre ? `Genre tone: ${genre}.` : "",
    vibe ? `Vibe: ${vibe}.` : "",
    spiceAestheticText() ? (spiceAestheticText() + ".") : "",
    `Product theme: ${productName}.`,
    mainSubject,
    `Typography: clear legible typography, centered composition, bold high-contrast text, no distorted letters.`,
    `Label text (packaging-style): title “${label.title}”, subtitle “${label.subtitle}”.`,
    "Original design, no trademarks, no brand names, no copyrighted characters.",
    "Clean commercial sticker clipart look, polished, readable, centered."
  ].filter(Boolean).join(" ");

  const negative =
    "photorealistic, blurry, low-res, messy outline, uneven line weight, distorted letters, unreadable text, random extra words, watermark, signature, brand logos, copyrighted characters, celebrity likeness, real book titles, background scene, floating particles outside outline, aura outside silhouette, outer shadow, UI screenshot, app interface, OS UI";

  setV("output", prompt);
  setV("negOut", negative);
  setV("notesOut", "Export: PNG • 2000–3000px • Transparent background recommended");
}

window.addEventListener("load", async () => {
  try {
    await loadConfig();
    populateAllOptionsFromConfig();
    applyDefaults();
    generate();

    $("generateBtn")?.addEventListener("click", generate);
  } catch (e) {
    console.error(e);
    // ✅ write error where you can SEE it
    setV("output", "❌ Error: " + (e?.message || e));
  }
});
