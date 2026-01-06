"use strict";

/**
 * Lädt /data/kba-index.json (Key: "HSN:TSN") und sucht per HSN/TSN.
 * Erwarteter Value pro Key:
 *  { hsn, tsn, marke, modell, power_kw, engine_ccm }
 */

const INDEX_URL = "/data/kba-index.json";

const els = {
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  statsText: document.getElementById("statsText"),

  hsnInput: document.getElementById("hsnInput"),
  tsnInput: document.getElementById("tsnInput"),
  btnSearch: document.getElementById("btnSearch"),
  btnClear: document.getElementById("btnClear"),
  btnReload: document.getElementById("btnReload"),

  resultBox: document.getElementById("resultBox"),
};

let kbaIndex = null; // Object: key -> record
let indexReady = false;

function setStatus(kind, text){
  // kind: "loading" | "ready" | "error" | "idle"
  els.statusText.textContent = text;

  const dot = els.statusDot;
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
    dot.style.background = "rgba(255,255,255,.50)";
    dot.style.boxShadow = "0 0 0 4px rgba(255,255,255,.12)";
  }
}

function setProgress(pct, text){
  const p = Math.max(0, Math.min(100, pct));
  els.progressBar.style.width = `${p}%`;
  els.progressText.textContent = text || "";
}

function escapeHtml(str){
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeHSN(v){
  const digits = String(v ?? "").trim().replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(4, "0").slice(-4);
}

function normalizeTSN(v){
  return String(v ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function makeKey(hsn, tsn){
  return `${hsn}:${tsn}`;
}

function renderNotReady(){
  els.resultBox.innerHTML = `<strong>Index ist noch nicht geladen.</strong><div class="muted">Bitte kurz warten oder „Index neu laden“.</div>`;
}

function renderNotFound(hsn, tsn){
  els.resultBox.innerHTML = `
    <strong>Nicht gefunden.</strong>
    <div class="muted">Key: <code>${escapeHtml(makeKey(hsn, tsn))}</code></div>
  `;
}

function renderHit(key, rec){
  const marke = rec?.marke ?? "-";
  const modell = rec?.modell ?? "-";
  const kw = Number.isFinite(rec?.power_kw) ? `${rec.power_kw} kW` : "-";
  const ccm = Number.isFinite(rec?.engine_ccm) ? `${rec.engine_ccm} cm³` : "-";

  els.resultBox.innerHTML = `
    <strong>Gefunden</strong>
    <div class="kv">
      <div>Key</div><div><code>${escapeHtml(key)}</code></div>
      <div>Marke</div><div>${escapeHtml(marke)}</div>
      <div>Modell</div><div>${escapeHtml(modell)}</div>
      <div>Leistung</div><div>${escapeHtml(kw)}</div>
      <div>Hubraum</div><div>${escapeHtml(ccm)}</div>
    </div>
  `;
}

async function loadIndex(){
  indexReady = false;
  kbaIndex = null;

  setStatus("loading", "Lade Index…");
  setProgress(0, `Fetch: ${INDEX_URL}`);
  els.statsText.textContent = "";
  els.resultBox.innerHTML = "";

  const t0 = performance.now();

  const res = await fetch(INDEX_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Index-Download fehlgeschlagen (HTTP ${res.status})`);

  // Streaming + Progress (wenn möglich)
  if (res.body && res.body.getReader){
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const total = Number(res.headers.get("content-length") || 0) || 0;

    let received = 0;
    let text = "";

    while (true){
      const { value, done } = await reader.read();
      if (done) break;

      received += value.byteLength;
      text += decoder.decode(value, { stream: true });

      if (total){
        const pct = (received / total) * 100;
        setProgress(pct, `Download: ${pct.toFixed(1)}%`);
      } else {
        setProgress(0, `Download: ${received.toLocaleString("de-DE")} Bytes…`);
      }
    }
    text += decoder.decode();

    setProgress(100, "Parse JSON…");
    await new Promise(requestAnimationFrame);

    kbaIndex = JSON.parse(text);
  } else {
    // Fallback
    setProgress(20, "Download…");
    const text = await res.text();
    setProgress(70, "Parse JSON…");
    kbaIndex = JSON.parse(text);
  }

  const ms = Math.round(performance.now() - t0);
  const keys = kbaIndex ? Object.keys(kbaIndex).length : 0;

  indexReady = true;
  setProgress(100, `Fertig. (${ms} ms)`);
  setStatus("ready", `Index bereit (${keys.toLocaleString("de-DE")} Keys)`);
  els.statsText.textContent = `Quelle: ${INDEX_URL} · Keys: ${keys.toLocaleString("de-DE")} · Ladezeit: ${ms.toLocaleString("de-DE")} ms`;
}

function doSearch(){
  if (!indexReady || !kbaIndex) return renderNotReady();

  const hsn = normalizeHSN(els.hsnInput.value);
  const tsn = normalizeTSN(els.tsnInput.value);

  if (!hsn || !tsn){
    els.resultBox.innerHTML = `<strong>Bitte HSN und TSN eingeben.</strong>`;
    return;
  }

  const key = makeKey(hsn, tsn);
  const rec = kbaIndex[key];

  if (!rec) return renderNotFound(hsn, tsn);
  renderHit(key, rec);
}

function clearForm(){
  els.hsnInput.value = "";
  els.tsnInput.value = "";
  els.resultBox.innerHTML = "";
  els.hsnInput.focus();
}

/* Events */
els.btnSearch.addEventListener("click", doSearch);
els.btnClear.addEventListener("click", clearForm);
els.btnReload.addEventListener("click", async () => {
  try{
    await loadIndex();
  }catch(e){
    setStatus("error", "Index konnte nicht geladen werden");
    setProgress(0, "Fehler.");
    els.statsText.textContent = String(e?.message || e);
  }
});

[els.hsnInput, els.tsnInput].forEach(inp => {
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
});

/* Auto-Load */
(async function init(){
  try{
    await loadIndex();
    setTimeout(() => els.hsnInput.focus(), 0);
  }catch(e){
    setStatus("error", "Index konnte nicht geladen werden");
    setProgress(0, "Fehler.");
    els.statsText.textContent = String(e?.message || e);
  }
})();
