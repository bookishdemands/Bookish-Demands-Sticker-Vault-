let configData = null;

async function loadConfig() {
  const res = await fetch("config.json?v=" + Date.now());
  configData = await res.json();
  populateDropdown("product", configData.products);
  populateDropdown("vibe", configData.vibes);
  populateDropdown("palette", configData.palettes);
}

function populateDropdown(id, items) {
  const select = document.getElementById(id);
  select.innerHTML = "";
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

function generatePrompt() {
  const product = document.getElementById("product").value;
  const vibe = document.getElementById("vibe").value;
  const palette = document.getElementById("palette").value;

  const prompt = `
Create image:
Product: ${product}
Vibe: ${vibe}
Color Palette: ${palette}
Sticker style, bold, high contrast, vector clarity, no watermark.
`;

  document.getElementById("output").textContent = prompt.trim();
}

document.getElementById("generateBtn").addEventListener("click", generatePrompt);

loadConfig();
