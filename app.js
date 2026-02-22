let CFG = null;

const $ = (id) => document.getElementById(id);

function fillSelect(sel, items, defaultValue) {
  sel.innerHTML = "";
  items.forEach((it) => {
    const opt = document.createElement("option");
    if (typeof it === "string") {
      opt.value = it;
      opt.textContent = it;
    } else {
      opt.value = it.value;
      opt.textContent = it.label ?? it.value;
    }
    sel.appendChild(opt);
  });
  if (defaultValue != null) sel.value = defaultValue;
}

function joinLines(arr) {
  return arr.filter(Boolean).join("\n");
}

function styleBlockText(key) {
  const block = (CFG.styleBlocks && CFG.styleBlocks[key]) ? CFG.styleBlocks[key] : CFG.styleBlocks.default;
  return joinLines(block);
}

function getProductMainSubject(productName) {
  const match = (CFG.options.product || []).find(p => p.value === productName);
  return match?.mainSubject || "sticker design with a clear main subject";
}

function buildPrompt() {
  const product = $("product").value;
  const genreTone = $("genreTone").value;
  const vibe = $("vibe").value;
  const palette = $("palette").value;
  const background = $("background").value;
  const border = $("border").value;
  const outline = $("outline").value;
  const spice = $("spice").value;

  const spiceAesthetic = CFG.spiceAestheticByLevel?.[spice] || "spicy vibes (non-graphic)";
  const mainSubject = getProductMainSubject(product);

  const styleBlock = styleBlockText(CFG.defaults?.styleBlock || "default");

  const tokenMap = {
    "{PRODUCT}": product,
    "{GENRE_TONE}": genreTone,
    "{VIBE}": vibe,
    "{PALETTE}": palette,
    "{BACKGROUND}": background,
    "{BORDER}": border,
    "{OUTLINE}": outline,
    "{SPICE_AESTHETIC}": spiceAesthetic,
    "{MAIN_SUBJECT}": mainSubject,
    "{STYLE_BLOCK}": styleBlock
  };

  const lines = (CFG.template || []).map(line => {
    let out = line;
    for (const k of Object.keys(tokenMap)) out = out.split(k).join(tokenMap[k]);
    return out;
  });

  return joinLines(lines);
}

async function loadConfig() {
  const res = await fetch("./config.json?v=" + Date.now());
  if (!res.ok) throw new Error("Failed to load config.json");
  CFG = await res.json();

  // Populate selects
  fillSelect($("product"), CFG.options.product.map(p => p.value), CFG.defaults.product);
  fillSelect($("genreTone"), CFG.options.genreTone, CFG.defaults.genreTone);
  fillSelect($("vibe"), CFG.options.vibe, CFG.defaults.vibe);
  fillSelect($("palette"), CFG.options.palette, CFG.defaults.palette);
  fillSelect($("background"), CFG.options.background, CFG.defaults.background);
  fillSelect($("border"), CFG.options.border, CFG.defaults.border);
  fillSelect($("outline"), CFG.options.outline, CFG.defaults.outline);
  fillSelect($("spice"), CFG.options.spice, CFG.defaults.spice);

  // initial output
  $("output").value = buildPrompt();
}

function wireEvents() {
  const ids = ["product","genreTone","vibe","palette","background","border","outline","spice"];
  ids.forEach(id => $(id).addEventListener("change", () => {
    $("output").value = buildPrompt();
  }));

  $("generateBtn").addEventListener("click", () => {
    $("output").value = buildPrompt();
  });

  $("copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("output").value);
      $("copyBtn").textContent = "Copied ✅";
      setTimeout(() => $("copyBtn").textContent = "Copy Prompt", 900);
    } catch {
      // fallback
      $("output").focus();
      $("output").select();
      document.execCommand("copy");
    }
  });
}

window.addEventListener("load", async () => {
  try {
    wireEvents();
    await loadConfig();
  } catch (e) {
    $("output").value = "ERROR: " + (e?.message || e);
  }
});
