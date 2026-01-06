"use strict";

/**
 * KBA JSONL Test
 * - Lädt kba.jsonl (Upload oder Fetch)
 * - Baut Index: Map("HSN:TSN" -> Array von Datensätzen)
 * - Suche per HSN/TSN
 */

const els = {
  fileInput: document.getElementById("fileInput"),
  urlInput: document.getElementById("urlInput"),
  btnLoadUrl: document.getElementById("btnLoadUrl"),

  hsnInput: document.getElementById("hsnInput"),
  tsnInput: document.getElementById("tsnInput"),
  btnSearch: document.getElementById("btnSearch"),
  btnClear: document.getElementById("btnClear"),

  resultBox: document.getElementById("resultBox"),

  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  statsText: document.getElementById("statsText"),

  statusPill: document.getElementById("statusPill"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
};

let kbaIndex = new Map();  // key -> Array<entry>
let indexReady = false;

function setStatus(kind, text){
  // kind: "idle" | "loading" | "ready" | "error"
  const dot = els.statusDot;
  els.statusText.textContent = text;

  if (kind === "ready"){
    dot.style.background = "rgba(0,184,169,.95)";
    dot.style.boxShadow = "0 0 0 4px rgba(0,184,169,.18)";
  } else if (kind === "loading"){
    dot.style.background = "rgba(255,255,255,.75)";
    dot.style.boxShadow = "0 0 0 4px rgba(255,255,255,.14)";
  } else if (kind === "error"){
    dot.style.background = "rgba(255,70,70,.9)";
    dot.style.boxShadow = "0 0 0 4px rgba(255,70,70,.18)";
  } else {
    dot.style.background = "rgba(255,255,255,.45)";
    dot.style.boxShadow = "0 0 0 4px rgba(255,255,255,.12)";
  }
}

function setProgress(pct, text){
  const clamped = Math.max(0, Math.min(100, pct));
  els.progressBar.style.width = `${clamped}%`;
  els.progressText.textContent = text || "";
}

function normalizeHSN(v){
  const s = String(v ?? "").trim().replace(/\s+/g, "");
  if (!s) return "";
  // HSN kann führende Nullen haben → 4-stellig behalten
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(4, "0").slice(-4);
}

function normalizeTSN(v){
  const s = String(v ?? "").trim().replace(/\s+/g, "").toUpperCase();
  return s;
}

function makeKey(hsn, tsn){
  return `${hsn}:${tsn}`;
}

function extractModel(entry){
  // Dein Datensatz hat z.B. commercial_name: "FORD,FORD Mondeo"
  // Wir nehmen nach Möglichkeit den Teil nach dem letzten Komma.
  const cn = String(entry?.commercial_name ?? "").trim();
  if (!cn) return "";
  if (cn.includes(",")){
    const parts = cn.split(",").map(x => x.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1];
  }
  return cn;
}

function pickFields(entry){
  return {
    hsn: String(entry?.hsn ?? ""),
    tsn: String(entry?.tsn ?? ""),
    marke: String(entry?.manufacturer_plaintext ?? ""),
    modell: extractModel(entry),
    power_kw: Number(entry?.power_kw ?? NaN),
    engine_ccm: Number(entry?.engine_ccm ?? NaN),
  };
}

function renderResult(records, hsn, tsn){
  if (!records || !records.length){
    els.resultBox.innerHTML = `
      <div><strong>Nicht gefunden.</strong></div>
      <div class="muted">HSN: <code>${hsn || "-"}</code> · TSN: <code>${tsn || "-"}</code></div>
    `;
    return;
  }

  const rows = records
    .map((r, idx) => {
      const f = pickFields(r);
      const kw = Number.isFinite(f.power_kw) ? `${f.power_kw} kW` : "-";
      const ccm = Number.isFinite(f.engine_ccm) ? `${f.engine_ccm} cm³` : "-";
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(f.marke) || "-"}</td>
          <td>${escapeHtml(f.modell) || "-"}</td>
          <td>${kw}</td>
          <td>${ccm}</td>
        </tr>
      `;
    })
    .join("");

  els.resultBox.innerHTML = `
    <div><strong>Treffer: ${records.length}</strong></div>
    <table class="table" role="table" aria-label="KBA Treffer">
      <thead>
        <tr>
          <th>#</th>
          <th>Marke</th>
          <th>Modell</th>
          <th>Leistung</th>
          <th>Hubraum</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="muted" style="margin-top:8px">
      Key: <code>${escapeHtml(makeKey(hsn, tsn))}</code>
    </div>
  `;
}

function escapeHtml(str){
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   Index Builder – Upload (Blob slices)
========================= */

async function buildIndexFromFile(file){
  indexReady = false;
  kbaIndex = new Map();

  setStatus("loading", "Index wird aufgebaut…");
  setProgress(0, "Starte Index…");
  els.statsText.textContent = "";

  const t0 = performance.now();
  const chunkSize = 4 * 1024 * 1024; // 4 MB
  let offset = 0;
  let leftover = "";

  let linesTotal = 0;
  let parsed = 0;
  let errors = 0;

  while (offset < file.size){
    const slice = file.slice(offset, offset + chunkSize);
    const text = await slice.text();

    const combined = leftover + text;
    const lines = combined.split(/\r?\n/);
    leftover = lines.pop() || "";

    for (const line of lines){
      linesTotal++;
      const trimmed = line.trim();
      if (!trimmed) continue;

      try{
        const obj = JSON.parse(trimmed);
        const hsn = normalizeHSN(obj.hsn);
        const tsn = normalizeTSN(obj.tsn);
        if (!hsn || !tsn) continue;

        const key = makeKey(hsn, tsn);
        const arr = kbaIndex.get(key);
        if (arr) arr.push(obj);
        else kbaIndex.set(key, [obj]);

        parsed++;
      }catch{
        errors++;
      }

      // UI nicht blockieren
      if (linesTotal % 40000 === 0){
        await new Promise(requestAnimationFrame);
      }
    }

    offset += chunkSize;
    const pct = (offset / file.size) * 100;
    setProgress(pct, `Index: ${pct.toFixed(1)}%`);
    els.statsText.textContent = `Zeilen: ${linesTotal.toLocaleString("de-DE")} · Gelesen: ${parsed.toLocaleString("de-DE")} · Fehler: ${errors.toLocaleString("de-DE")} · Keys: ${kbaIndex.size.toLocaleString("de-DE")}`;
  }

  // Letzte Restzeile
  const last = leftover.trim();
  if (last){
    linesTotal++;
    try{
      const obj = JSON.parse(last);
      const hsn = normalizeHSN(obj.hsn);
      const tsn = normalizeTSN(obj.tsn);
      if (hsn && tsn){
        const key = makeKey(hsn, tsn);
        const arr = kbaIndex.get(key);
        if (arr) arr.push(obj);
        else kbaIndex.set(key, [obj]);
        parsed++;
      }
    }catch{
      errors++;
    }
  }

  const ms = Math.round(performance.now() - t0);
  indexReady = true;

  setProgress(100, `Fertig. (${ms} ms)`);
  setStatus("ready", `Index bereit (${kbaIndex.size.toLocaleString("de-DE")} Keys)`);
  els.statsText.textContent = `Zeilen: ${linesTotal.toLocaleString("de-DE")} · Gelesen: ${parsed.toLocaleString("de-DE")} · Fehler: ${errors.toLocaleString("de-DE")} · Keys: ${kbaIndex.size.toLocaleString("de-DE")} · Zeit: ${ms.toLocaleString("de-DE")} ms`;
}

/* =========================
   Index Builder – Fetch (Stream)
========================= */

async function buildIndexFromUrl(url){
  indexReady = false;
  kbaIndex = new Map();

  setStatus("loading", "Lade von URL…");
  setProgress(0, "Fetch startet…");
  els.statsText.textContent = "";

  const t0 = performance.now();

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch fehlgeschlagen: HTTP ${res.status}`);

  // Falls Streaming verfügbar
  if (res.body && res.body.getReader){
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let received = 0;
    const contentLength = Number(res.headers.get("content-length") || 0) || 0;

    let buffer = "";
    let linesTotal = 0;
    let parsed = 0;
    let errors = 0;

    while (true){
      const { value, done } = await reader.read();
      if (done) break;

      received += value.byteLength;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines){
        linesTotal++;
        const trimmed = line.trim();
        if (!trimmed) continue;

        try{
          const obj = JSON.parse(trimmed);
          const hsn = normalizeHSN(obj.hsn);
          const tsn = normalizeTSN(obj.tsn);
          if (!hsn || !tsn) continue;

          const key = makeKey(hsn, tsn);
          const arr = kbaIndex.get(key);
          if (arr) arr.push(obj);
          else kbaIndex.set(key, [obj]);

          parsed++;
        }catch{
          errors++;
        }

        if (linesTotal % 40000 === 0){
          await new Promise(requestAnimationFrame);
        }
      }

      const pct = contentLength ? (received / contentLength) * 100 : 0;
      setProgress(contentLength ? pct : 0, contentLength ? `Index: ${pct.toFixed(1)}%` : `Index: ${received.toLocaleString("de-DE")} Bytes…`);
      els.statsText.textContent = `Zeilen: ${linesTotal.toLocaleString("de-DE")} · Gelesen: ${parsed.toLocaleString("de-DE")} · Fehler: ${errors.toLocaleString("de-DE")} · Keys: ${kbaIndex.size.toLocaleString("de-DE")}`;
    }

    // Rest
    const last = buffer.trim();
    if (last){
      linesTotal++;
      try{
        const obj = JSON.parse(last);
        const hsn = normalizeHSN(obj.hsn);
        const tsn = normalizeTSN(obj.tsn);
        if (hsn && tsn){
          const key = makeKey(hsn, tsn);
          const arr = kbaIndex.get(key);
          if (arr) arr.push(obj);
          else kbaIndex.set(key, [obj]);
          parsed++;
        }
      }catch{
        errors++;
      }
    }

    const ms = Math.round(performance.now() - t0);
    indexReady = true;

    setProgress(100, `Fertig. (${ms} ms)`);
    setStatus("ready", `Index bereit (${kbaIndex.size.toLocaleString("de-DE")} Keys)`);
    els.statsText.textContent = `Zeilen: ${linesTotal.toLocaleString("de-DE")} · Gelesen: ${parsed.toLocaleString("de-DE")} · Fehler: ${errors.toLocaleString("de-DE")} · Keys: ${kbaIndex.size.toLocaleString("de-DE")} · Zeit: ${ms.toLocaleString("de-DE")} ms`;
    return;
  }

  // Fallback: non-stream (kleiner)
  const text = await res.text();
  const lines = text.split(/\r?\n/);

  let parsed = 0, errors = 0;
  for (const line of lines){
    const trimmed = line.trim();
    if (!trimmed) continue;
    try{
      const obj = JSON.parse(trimmed);
      const hsn = normalizeHSN(obj.hsn);
      const tsn = normalizeTSN(obj.tsn);
      if (!hsn || !tsn) continue;

      const key = makeKey(hsn, tsn);
      const arr = kbaIndex.get(key);
      if (arr) arr.push(obj);
      else kbaIndex.set(key, [obj]);

      parsed++;
    }catch{
      errors++;
    }
  }

  const ms = Math.round(performance.now() - t0);
  indexReady = true;

  setProgress(100, `Fertig. (${ms} ms)`);
  setStatus("ready", `Index bereit (${kbaIndex.size.toLocaleString("de-DE")} Keys)`);
  els.statsText.textContent = `Zeilen: ${lines.length.toLocaleString("de-DE")} · Gelesen: ${parsed.toLocaleString("de-DE")} · Fehler: ${errors.toLocaleString("de-DE")} · Keys: ${kbaIndex.size.toLocaleString("de-DE")} · Zeit: ${ms.toLocaleString("de-DE")} ms`;
}

/* =========================
   Events
========================= */

els.fileInput.addEventListener("change", async () => {
  const file = els.fileInput.files && els.fileInput.files[0];
  if (!file) return;

  els.resultBox.innerHTML = "";
  try{
    await buildIndexFromFile(file);
  }catch (e){
    setStatus("error", "Fehler beim Index-Aufbau");
    setProgress(0, "Fehler.");
    els.statsText.textContent = String(e?.message || e);
  }
});

els.btnLoadUrl.addEventListener("click", async () => {
  const url = String(els.urlInput.value || "").trim();
  if (!url) return;

  els.resultBox.innerHTML = "";
  try{
    await buildIndexFromUrl(url);
  }catch (e){
    setStatus("error", "URL konnte nicht geladen werden");
    setProgress(0, "Fehler.");
    els.statsText.textContent = String(e?.message || e);
  }
});

els.btnSearch.addEventListener("click", () => {
  const hsn = normalizeHSN(els.hsnInput.value);
  const tsn = normalizeTSN(els.tsnInput.value);

  if (!indexReady){
    els.resultBox.innerHTML = `<div><strong>Bitte zuerst kba.jsonl laden.</strong></div>`;
    return;
  }

  if (!hsn || !tsn){
    els.resultBox.innerHTML = `<div><strong>Bitte HSN und TSN eingeben.</strong></div>`;
    return;
  }

  const key = makeKey(hsn, tsn);
  const records = kbaIndex.get(key) || [];
  renderResult(records, hsn, tsn);
});

els.btnClear.addEventListener("click", () => {
  els.hsnInput.value = "";
  els.tsnInput.value = "";
  els.resultBox.innerHTML = "";
  els.hsnInput.focus();
});

// Komfort: Enter triggert Suche
[els.hsnInput, els.tsnInput].forEach(inp => {
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.btnSearch.click();
  });
});

setStatus("idle", "Keine Datei geladen");
setProgress(0, "Bereit.");
