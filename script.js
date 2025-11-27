const fileInput = document.getElementById("file-input");
const preview = document.getElementById("preview");
const statusText = document.getElementById("status-text");
const progressBar = document.getElementById("progress-bar");
const ocrText = document.getElementById("ocr-text");
const resultsEl = document.getElementById("results");
const runSampleBtn = document.getElementById("run-sample");
const reevaluateBtn = document.getElementById("re-evaluate");

// Inline SVG sample for instant testing.
const SAMPLE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="210" viewBox="0 0 640 210" style="background:#f7f7ff;">
      <style>
        text{font:20px 'Space Grotesk',Arial,sans-serif;fill:#111}
      </style>
      <text x="22" y="50">10^2 - 4</text>
      <text x="22" y="80">2^5 + 4^3</text>
      <text x="22" y="110">48 × 3/4 - 9 + 9</text>
      <text x="22" y="140">5x - 4(x - 3) = 32</text>
      <text x="22" y="170">16 · sin(30°)</text>
    </svg>`
  );

fileInput.addEventListener("change", (evt) => {
  const file = evt.target.files?.[0];
  if (file) {
    renderPreview(file);
    runOCR(file);
  }
});

runSampleBtn.addEventListener("click", () => {
  renderPreview(SAMPLE_IMAGE);
  runOCR(SAMPLE_IMAGE);
});

reevaluateBtn.addEventListener("click", () => {
  const lines = ocrText.value.split("\n");
  renderResults(lines);
});

function renderPreview(source) {
  preview.innerHTML = "";
  const img = document.createElement("img");
  if (source instanceof File) {
    img.src = URL.createObjectURL(source);
    img.onload = () => URL.revokeObjectURL(img.src);
  } else {
    img.src = source;
  }
  preview.appendChild(img);
}

function runOCR(image) {
  statusText.textContent = "Reading text…";
  progressBar.style.width = "8%";
  Tesseract.recognize(image, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        const pct = Math.min(100, Math.round(m.progress * 100));
        progressBar.style.width = `${pct}%`;
        statusText.textContent = `Recognizing… ${pct}%`;
      }
    },
  })
    .then(({ data }) => {
      progressBar.style.width = "100%";
      statusText.textContent = "Done";
      ocrText.value = data.text.trim();
      const lines = data.text.split("\n");
      renderResults(lines);
    })
    .catch((err) => {
      statusText.textContent = "Error";
      console.error(err);
      alert("OCR failed. Try a clearer photo.");
    });
}

function normalizeExpression(raw) {
  let expr = raw;
  expr = expr.replace(/[×x]/g, "*");
  expr = expr.replace(/[÷:]/g, "/");
  expr = expr.replace(/[·•]/g, "*");
  expr = expr.replace(/[–—−]/g, "-");
  expr = expr.replace(/°/g, " deg");
  expr = expr.replace(/\s+/g, "");
  // Handle "5x" -> "5*x" so math.js can solve.
  expr = expr.replace(/(\d)([a-zA-Z])/g, "$1*$2");
  return expr;
}

function looksLikeMath(line) {
  const cleaned = line.replace(/\s+/g, "");
  const hasMathToken = /\d+[\+\-\*\/\^]|(sin|cos|tan|log)/i.test(cleaned);
  return hasMathToken;
}

function renderResults(lines) {
  const mathLines = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && looksLikeMath(l));

  if (mathLines.length === 0) {
    resultsEl.innerHTML = `<p class="hint">No obvious math expressions found. Edit the OCR text and tap "Evaluate text".</p>`;
    return;
  }

  resultsEl.innerHTML = "";
  mathLines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "result-row";
    const exprEl = document.createElement("div");
    exprEl.className = "expr";
    exprEl.textContent = line;
    const valEl = document.createElement("div");
    valEl.className = "value";
    try {
      const expr = normalizeExpression(line);
      const value = math.evaluate(expr);
      valEl.textContent = String(value);
    } catch (error) {
      row.classList.add("error");
      valEl.textContent = "Could not evaluate";
    }
    row.appendChild(exprEl);
    row.appendChild(valEl);
    resultsEl.appendChild(row);
  });
}
