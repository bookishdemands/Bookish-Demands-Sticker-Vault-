alert("app.js loaded ✅");

let CFG = null;

const $ = (id) => document.getElementById(id);
const s = $; // alias
const v = (id) => ($(id)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el) el.value = val; };
const c = (id) => !!($(id)?.checked);
const setC = (id, val) => { const el = $(id); if (el) el.checked = !!val; };

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
  // If you have a paletteNameMap (bookish -> original), use it.
  const mapped = CFG?.paletteNameMap?.[paletteName];
  return mapped || paletteName;
}

function getPaletteEntry(paletteName) {
  if (!paletteName) return null;

  const originalKey = resolvePaletteKey(paletteName);

  // Preferred: paletteData object (name -> {hex:[], vibe:""})
  const p1 = CFG?.paletteData?.[paletteName];
  const p2 = CFG?.paletteData?.[originalKey];

  const p = p1 || p2;
  const displayName = paletteName; // show what user selected (bookish)

  if (p) {
    return {
      name: displayName,
      hex: Array.isArray(p.hex) ? p.hex : [],
      vibe: p.vibe || ""
    };
  }

  // Legacy fallback: options.palette as objects (rare now)
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
  if (!hexes.length) {
    preview.innerHTML = `
      <div class="palette-preview top">
        <div>
          <div class="name">${escapeHtml(entry.name)}</div>
          <div class="meta">${escapeHtml(entry.vibe || "")}</div>
        </div>
      </div>
      <div class="meta">No hex codes found for this palette.</div>
    `;
    return;
  }

  const swatches = hexes
    .map(h => `<span class="swatch" title="${escapeHtml(h)}" style="background:${escapeHtml(h)}"></span>`)
    .join("");

  preview.innerHTML = `
    <div class="palette-preview top">
      <div>
        <div class="name">${escapeHtml(entry.name)}</div>
        <div class="meta">${escapeHtml(entry.vibe || "")}</div>
      </div>
      <div class="swatches">${swatches}</div>
    </div>
    <div class="hex">${escapeHtml(hexes.join(" "))}</div>
  `;
}

async function loadConfig() {
  const url = "./config.json?v=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) throw new Error(`config.json fetch failed (${res.status})`);

  try { CFG = JSON.parse(text); }
  catch (err) {
    throw new Error(`config.json JSON parse failed\nPreview:\n${text.slice(0, 300)}`);
  }

  // Safety: make sure options exists
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
  if (!CFG?.options) return;

  fillSelect("count", ["1","2","3","4","5"], "How many prompts?");
  fillSelect("product", CFG.options.product, "Select product...");
  fillSelect("genreTone", CFG.options.genreTone, "Select genre...");
  fillSelect("vibe", CFG.options.vibe, "Select vibe...");

  // ✅ IMPORTANT: dropdown should use the BOOKISH list (options.palette)
  const paletteItems =
    (Array.isArray(CFG?.options?.palette) && CFG.options.palette.length)
      ? CFG.options.palette
      : Object.keys(CFG?.paletteData || {});

  fillSelect("palette", paletteItems, "Select a palette");
  $("palette")?.addEventListener("change", renderPalettePreview);

  // render immediately after filling
  renderPalettePreview();

  fillSelect("background", CFG.options.background, "Select background...");
  fillSelect("border", CFG.options.border, "Select border...");
  fillSelect("outline", CFG.options.outline, "Select outline...");
  fillSelect("spice", CFG.options.spice, "Select spice...");
}

// keep the rest of your existing code the same,
// just make sure init() calls these in order
async function init() {
  try {
    await loadConfig();
    populateAllOptionsFromConfig();

    // apply defaults AFTER options exist
    const d = CFG?.defaults || {};
    Object.entries(d).forEach(([key, val]) => { if ($(key)) setV(key, val); });

    renderPalettePreview();

    $("palette")?.addEventListener("change", renderPalettePreview);
    $("generateBtn")?.addEventListener("click", generate);
    $("randomizeBtn")?.addEventListener("click", randomizeAll);
    $("clearBtn")?.addEventListener("click", clearAll);

  } catch (e) {
    console.error(e);
    alert("Init error ❌ " + (e?.message || e));
  }
}

window.addEventListener("load", init);
