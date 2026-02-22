// app.js
let CFG = null;

const $ = (id) => document.getElementById(id);
const v = (id) => ($(`${id}`)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el) el.value = val; };
const c = (id) => !!($(`${id}`)?.checked);

async function loadConfig(){
  const res = await fetch("./config.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Could not load config.json");
  CFG = await res.json();
}

// --- OPTIONAL: populate selects from CFG.options ---
// Only use this if you want your HTML <select> options to come from JSON.
// If your index.html already hardcodes options, you can skip these.
function fillSelect(id, items, { includeNone = false, itemValue = null, itemLabel = null } = {}){
  const sel = $(id);
  if(!sel) return;

  sel.innerHTML = "";

  if(includeNone){
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "None";
    sel.appendChild(o);
  }

  items.forEach((it) => {
    const o = document.createElement("option");
    if(typeof it === "string"){
      o.value = it;
      o.textContent = it;
    } else {
      o.value = itemValue ? it[itemValue] : it.value;
      o.textContent = itemLabel ? it[itemLabel] : (it.label ?? it.value);
    }
    sel.appendChild(o);
  });
}

function initOptionsFromJSON(){
  // These IDs must exist in index.html.
  // If your IDs differ, change them here.
  fillSelect("productTheme", CFG.options.product, { includeNone: true, itemValue: "value", itemLabel: "value" });
  fillSelect("genreTone", CFG.options.genreTone, { includeNone: true });
  fillSelect("vibe", CFG.options.vibe, { includeNone: true });
  fillSelect("palette", CFG.options.palette, { includeNone: true });
  fillSelect("bgMode", CFG.options.background, { includeNone: false });
  fillSelect("border", CFG.options.border, { includeNone: false });
  fillSelect("outline", CFG.options.outline, { includeNone: false });
  fillSelect("spiceLevel", CFG.options.spice, { includeNone: false, itemValue: "value", itemLabel: "label" });

  // styleBlock is not in your UI currently as a dropdown, but you can add one if you want:
  // fillSelect("styleBlock", Object.keys(CFG.styleBlocks), { includeNone: false });
}

function applyDefaults(){
  const d = CFG.defaults || {};
  // If your UI uses different IDs, adjust these
  setV("productTheme", d.product ?? "");
  setV("genreTone", d.genreTone ?? "");
  setV("vibe", d.vibe ?? "");
  setV("palette", d.palette ?? "");
  setV("bgMode", d.background ?? "Transparent background");
  setV("border", d.border ?? "White border (recommended)");
  setV("outline", d.outline ?? "Thick bold outline");
  setV("spiceLevel", d.spice ?? "2");

  // You can keep "styleBlock" internal unless you add a dropdown for it
  window.__styleBlockKey = d.styleBlock ?? "clipart";
}

// Find the selected product's mainSubject from CFG.options.product[]
function getProductMainSubject(){
  const chosen = v("productTheme");
  const match = (CFG.options.product || []).find(p => p.value === chosen);
  return match?.mainSubject || chosen || "Product theme: None";
}

function getStyleBlockText(){
  // If you add a dropdown later, read it here. For now use defaults.
  const key = window.__styleBlockKey || "default";
  const lines = CFG.styleBlocks?.[key] || CFG.styleBlocks?.default || [];
  // Your template expects {STYLE_BLOCK} to be a single string
  return lines.join(", ");
}

function getSpiceAesthetic(){
  const lvl = String(v("spiceLevel") || CFG.defaults?.spice || "2");
  return CFG.spiceAestheticByLevel?.[lvl] || CFG.spiceAestheticByLevel?.["2"] || "flirty heat (non-graphic)";
}

function renderTemplate(tokens){
  const lines = (CFG.template || []).map(line => {
    return line.replace(/\{([A-Z_]+)\}/g, (_, key) => {
      return (tokens[key] ?? "").toString();
    });
  });

  // OPTIONAL: If you want cut-safe toggleable, remove those lines when unchecked
  // (Only do this if you add a checkbox in UI like cutSafeMode)
  // if (!c("cutSafeMode")) { ...filter out cut-safe lines... }

  return lines.join("\n").trim();
}

function generate(){
  const tokens = {
    STYLE_BLOCK: getStyleBlockText(),
    PALETTE: v("palette") || "None",
    GENRE_TONE: v("genreTone") || "None",
    VIBE: v("vibe") || "None",
    SPICE_AESTHETIC: getSpiceAesthetic(),
    PRODUCT: v("productTheme") || "None",
    MAIN_SUBJECT: getProductMainSubject(),
    BACKGROUND: v("bgMode") || "Transparent background",
    BORDER: v("border") || "White border (recommended)",
    OUTLINE: v("outline") || "Thick bold outline"
  };

  const prompt = renderTemplate(tokens);

  // These IDs must exist in your HTML output panel:
  setV("promptOut", prompt);
  setV("negOut", "blurry, low-res, unreadable text, distorted letters, watermark, signature, brand logos, copyrighted characters, celebrity likeness");
  setV("notesOut", "Export: PNG • 2000–3000px • Transparent background recommended");
}

window.addEventListener("load", async () => {
  try{
    await loadConfig();

    // If you want the dropdowns driven by JSON:
    initOptionsFromJSON();

    applyDefaults();
    generate();

    // Wire button (make sure IDs match your HTML)
    $("generateBtn")?.addEventListener("click", generate);
  } catch(e){
    console.error(e);
    setV("promptOut", "❌ Error loading config.json:\n" + (e?.message || e));
  }
});
