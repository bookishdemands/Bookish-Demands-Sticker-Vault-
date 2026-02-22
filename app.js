// app.js (Option 2)
let CFG = null;

const $ = (id) => document.getElementById(id);
const v = (id) => ($(`${id}`)?.value ?? "");
const setV = (id, val) => { const el = $(id); if (el) el.value = val; };
const c = (id) => !!($(`${id}`)?.checked);
const setC = (id, val) => { const el = $(id); if (el) el.checked = !!val; };

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const uniq = (arr) => Array.from(new Set(arr));

async function loadConfig(){
  const res = await fetch("./config.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Could not load config.json");
  CFG = await res.json();
  alert("Config loaded ✅ " + (CFG?.meta?.version || "no version found"));
}
function fillSelect(id, items, { placeholder = "Select..." } = {}) {
  const sel = document.getElementById(id);
  if (!sel) return;

  sel.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  sel.appendChild(opt0);

  (items || []).forEach((item) => {
    const opt = document.createElement("option");

    // Supports strings OR objects like {value, label}
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
  const o = CFG?.options || {};

  fillSelect("product", o.product, { placeholder: "Select product..." });
  fillSelect("genreTone", o.genreTone, { placeholder: "Select genre..." });
  fillSelect("vibe", o.vibe, { placeholder: "Select vibe..." });
  fillSelect("palette", o.palette, { placeholder: "Select palette..." });
  fillSelect("background", o.background, { placeholder: "Select background..." });
  fillSelect("border", o.border, { placeholder: "Select border..." });
  fillSelect("outline", o.outline, { placeholder: "Select outline..." });
  fillSelect("spice", o.spice, { placeholder: "Select spice..." });
}

function looksHorrorPalette(p){
  const s = (p || "").toLowerCase();
  return s.includes("red") || s.includes("blood") || s.includes("oxblood") || s.includes("black cherry");
}

function applyHarmonyRules(){
  const genre = v("genreTone");
  const paletteSel = v("palette");
  const horrorActive = (genre === "horror") || c("gHorror"); // if you have the checkbox

  if(horrorActive && !looksHorrorPalette(paletteSel)){
    setV("palette", CFG.rules?.horrorPaletteDefault || "Blood Red + Ink Black + Bone");
  }
}

function productKey(){
  // If you support customProductTheme, you can handle it here
  return v("productTheme") || "";
}

function productDesc(){
  const k = productKey();
  if(!k) return "";
  return CFG.productDesc?.[k] || k.replaceAll("_"," ");
}

function productCategory(){
  const k = productKey();
  return CFG.productCategory?.[k] || "default";
}

function getAutoLabel(){
  const k = productKey() || "default";
  const titles = CFG.labelTitles?.[k] || CFG.labelTitles?.default || ["MAIN CHARACTER ENERGY"];
  const cat = productCategory();
  const subs = CFG.labelSubsByCategory?.[cat] || CFG.labelSubsByCategory?.default || ["Handle with care."];
  return { title: pick(titles), subtitle: pick(subs) };
}

function buildQuotePool(){
  // If you have customQuotes textarea, you can add “custom wins” logic here.
  let pool = [];

  // CORE toggles (IDs must match your HTML)
  if(c("bGeneralUrbanBookish")) pool.push(...(CFG.quoteBanks?.general_urban_bookish || []));
  if(c("bMoodQuotes")) pool.push(...(CFG.quoteBanks?.mood_quotes || []));
  if(c("bIYKYK")) pool.push(...(CFG.quoteBanks?.iykyk || []));

  // Add micro quotes depending on quoteMode
  const qm = v("quoteMode");
  if(qm === "micro" || qm === "any") pool.push(...(CFG.microQuotes || []));

  pool = uniq(pool);
  return pool.length ? pool : uniq([...(CFG.quoteBanks?.general_urban_bookish || []), ...(CFG.microQuotes || [])]);
}

function chooseQuote(){
  const typed = (v("quote") || "").trim();
  if(typed) return typed;
  if(!c("useRandomQuote")) return "";
  const pool = buildQuotePool();
  return pool.length ? pick(pool) : "";
}

function typographyRuleText(){
  if(v("typoRule") !== "on") return "";
  return "clear legible typography, centered composition, bold high-contrast text, no distorted letters";
}

function spiceAesthetic(){
  const lvl = String(v("spiceLevel") || "2");
  return CFG.spiceAestheticByLevel?.[lvl] || CFG.spiceAestheticByLevel?.["2"];
}

function cutSafeText(){
  if(!c("cutSafeMode")) return "";
  return [
    "Cut-safe die-cut requirement: one continuous closed silhouette outline around the ENTIRE design.",
    "ABSOLUTE RULE: every sparkle, glitter dot, foil fleck, smoke wisp, particle, shine pop, and glow must be INSIDE the silhouette boundary.",
    "No floating elements outside the border. No stray dots. No outside specks. No outside aura. No outer shadow.",
    "Any glow must hug the silhouette tightly and remain fully inside the die-cut outline.",
    "If any particles would cross the edge, remove them."
  ].join(" ");
}

function finishText(){
  const outline = (v("outline")==="bold_black") ? "thick bold outline" : "no outline";
  const border = (v("border")==="white") ? "clean white sticker offset border" : "no sticker border";

  const bgMode = v("bgMode");
  const bg =
    (bgMode==="transparent") ? "transparent background" :
    (bgMode==="solid_white") ? "solid white background" :
    "background not specified";

  let variationKey = v("variation") || "";
  if(c("handDrawnPreset")) variationKey = "hand_drawn";
  const variationText = variationKey ? (CFG.variations?.[variationKey] || "") : "";

  const handDrawnExtra = c("handDrawnPreset")
    ? "hand-drawn rule: keep lines organic and inked, slight wobble allowed, but edges must remain crisp and print-ready"
    : "";

  return [
    outline, border, bg,
    variationText,
    handDrawnExtra,
    "bold shapes, punchy contrast",
    "crisp outlines, crisp edges, vector-like clarity",
    "high resolution",
    "no brand logos, no watermark"
  ].filter(Boolean).join(", ");
}

function shouldIncludeQuoteLine(stickerType){
  const usage = v("quoteUsage"); // smart|always|never
  if(c("blankMode")) return false;
  if(usage === "never") return false;
  if(usage === "always") return true;
  return (stickerType === "icon_quote" || stickerType === "quote_only");
}

function buildLabelTextBlock(stickerType, quote){
  if(c("blankMode")) return "No label text.";

  const mode = v("labelMode"); // none|auto|manual|mixed|quote_subtitle
  if(mode === "none") return "No label text.";

  // packaging-style label makes most sense when there is a product selected
  const hasProduct = !!productDesc();
  if(stickerType !== "packaging" && !hasProduct) return "";

  const manualTitle = (v("titleText") || "").trim();
  const manualSub = (v("subtitleText") || "").trim();
  const auto = getAutoLabel();

  const title =
    (mode==="manual") ? manualTitle :
    (mode==="mixed") ? (manualTitle || auto.title) :
    (mode==="quote_subtitle") ? auto.title :
    auto.title;

  const subtitle =
    (mode==="manual") ? manualSub :
    (mode==="mixed") ? (manualSub || auto.subtitle) :
    (mode==="quote_subtitle") ? (quote || auto.subtitle) :
    auto.subtitle;

  if(mode==="manual" && !title && !subtitle) return "No label text.";

  return `Label text (packaging-style): title “${title}”${subtitle ? `, subtitle “${subtitle}”` : ""}.`;
}

function generate(){
  applyHarmonyRules();

  const stickerType = v("stickerType");
  const quote = chooseQuote();

  const palette = (v("palette") || "");
  const genre = (v("genreTone") || "");
  const vibe = (v("vibe") || "");
  const typo = typographyRuleText();
  const safety = "original design, no trademarks, no brand names, no copyrighted characters";

  const labelTextBlock = buildLabelTextBlock(stickerType, quote);
  const quoteLine = (quote && shouldIncludeQuoteLine(stickerType)) ? `Optional quote line: “${quote}”.` : "";

  const product = productKey() ? productKey().replaceAll("_"," ") : "None";
  const mainSubject = productDesc()
    ? `Main subject: ${productDesc()}.`
    : "Main subject: simple iconic bookish symbol.";

  const prompt = [
    "Create image:",
    finishText() + ".",
    cutSafeText(),
    palette ? `color palette: ${palette}.` : "",
    genre ? `genre tone: ${genre.replaceAll("_"," ")}.` : "",
    vibe ? `vibe: ${vibe}.` : "",
    spiceAesthetic() + ".",
    `Product theme: ${product}.`,
    mainSubject,
    typo ? `Typography: ${typo}.` : "",
    labelTextBlock,
    quoteLine,
    c("blankMode") ? "No text at all (blank sticker mode)." : "",
    safety + ".",
    "Clean commercial sticker clipart look, polished, readable, centered."
  ].filter(Boolean).join(" ");

  const negative =
    "photorealistic, blurry, low-res, messy outline, uneven line weight, distorted letters, unreadable text, random extra words, watermark, signature, brand logos, copyrighted characters, celebrity likeness, real book titles, background scene, floating particles outside outline, aura outside silhouette, outer shadow, UI screenshot, app interface, OS UI";

  setV("promptOut", prompt);
  setV("negOut", negative);
  setV("notesOut", "Export: PNG • 2000–3000px • Transparent background recommended");
}

function applyDefaults(){
  const d = CFG.defaults || {};
  Object.entries(d).forEach(([key, val]) => {
    // match your IDs
    if($(key)){
      if($(key).type === "checkbox") setC(key, val);
      else setV(key, val);
    }
  });
}

window.addEventListener("load", async () => {
  try {
    await loadConfig();

    // ✅ THIS is what you’re missing
    populateAllOptionsFromConfig();

    applyDefaults();   // if you have this
    generate();        // if you have this

    document.getElementById("generateBtn")?.addEventListener("click", generate);
  } catch (e) {
    console.error(e);
    const out = document.getElementById("promptOut");
    if (out) out.value = "❌ Error loading config/options: " + (e?.message || e);
  }
});
