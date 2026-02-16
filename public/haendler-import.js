document.documentElement.classList.remove('no-js');

const $ = (id) => document.getElementById(id);

const fileEl = $("file");
const btnPreview = $("btnPreview");
const btnImport = $("btnImport");
const statusEl = $("status");
const summaryEl = $("summary");
const errorsEl = $("errors");
const previewBody = $("previewBody");

let lastFile = null;
let lastPreviewOk = false;

function setStatus(msg){ statusEl.textContent = msg || ""; }

function fmtEuro(v){
  if (typeof v !== "number" || !isFinite(v)) return "—";
  return new Intl.NumberFormat("de-DE").format(v) + " €";
}

function fmtInt(v){
  if (typeof v !== "number" || !isFinite(v)) return "—";
  return new Intl.NumberFormat("de-DE").format(v);
}

function badge(status){
  if (status === "new") return `<span class="badge new">Neu</span>`;
  if (status === "update") return `<span class="badge upd">Update</span>`;
  return `<span class="badge err">Fehler</span>`;
}

function renderSummary(s){
  summaryEl.classList.remove("empty");
  summaryEl.innerHTML = `
    <div class="pills">
      <div class="pill ok">Neu: <b>${s.newCount}</b></div>
      <div class="pill warn">Updates: <b>${s.updateCount}</b></div>
      <div class="pill bad">Fehler: <b>${s.errorCount}</b></div>
      <div class="pill">Zeilen: <b>${s.total}</b></div>
    </div>
    <div style="margin-top:10px;color:#667680">
      Delimiter erkannt: <b>${s.delimiter === ";" ? "Semikolon" : (s.delimiter === "\\t" ? "Tab" : "Komma")}</b>
    </div>
  `;
}

function renderErrors(errs){
  if (!errs || !errs.length){
    errorsEl.classList.add("empty");
    errorsEl.textContent = "Noch keine Fehler.";
    return;
  }
  errorsEl.classList.remove("empty");
  errorsEl.innerHTML = errs.slice(0, 50).map(e =>
    `<div style="padding:6px 0;border-top:1px solid #e3e9ef">
      <b>Zeile ${e.row}</b>: ${e.message}
    </div>`
  ).join("");
  if (errs.length > 50){
    errorsEl.innerHTML += `<div style="padding-top:10px;color:#7b8a95">… ${errs.length - 50} weitere Fehler (gekürzt)</div>`;
  }
}

function renderPreview(rows){
  if (!rows || !rows.length){
    previewBody.innerHTML = `<tr><td colspan="7" class="muted">Keine Daten.</td></tr>`;
    return;
  }
  previewBody.innerHTML = rows.slice(0, 200).map(r => `
    <tr>
      <td>${badge(r.status)}</td>
      <td>${(r.stock_number ?? "—")}</td>
      <td>${(r.title ?? "—")}</td>
      <td>${fmtEuro(r.price_eur)}</td>
      <td>${fmtInt(r.mileage_km)}</td>
      <td>${(r.first_registration ?? "—")}</td>
      <td class="media">
        Bilder: ${r.image_count ?? 0}
        ${r.video_url ? " • Video: ja" : " • Video: nein"}
      </td>
    </tr>
  `).join("");
  if (rows.length > 200){
    previewBody.innerHTML += `<tr><td colspan="7" class="muted">Vorschau zeigt nur die ersten 200 Zeilen.</td></tr>`;
  }
}

async function callPreview(file){
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/haendler/import/preview", {
    method: "POST",
    body: fd,
  });

  if (!res.ok){
    const t = await res.text().catch(() => "");
    throw new Error(`Preview fehlgeschlagen (${res.status}): ${t || res.statusText}`);
  }
  return res.json();
}

async function callCommit(file){
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/haendler/import/commit", {
    method: "POST",
    body: fd,
  });

  if (!res.ok){
    const t = await res.text().catch(() => "");
    throw new Error(`Import fehlgeschlagen (${res.status}): ${t || res.statusText}`);
  }
  return res.json();
}

btnPreview.addEventListener("click", async () => {
  const file = fileEl.files && fileEl.files[0];
  if (!file) { setStatus("Bitte zuerst eine CSV auswählen."); return; }

  btnPreview.disabled = true;
  btnImport.disabled = true;
  lastPreviewOk = false;
  lastFile = file;

  setStatus("Vorschau wird geladen…");
  try{
    const data = await callPreview(file);
    renderSummary(data.summary);
    renderErrors(data.errors);
    renderPreview(data.rows);

    lastPreviewOk = true;
    btnImport.disabled = false;
    setStatus("Vorschau geladen. Prüfen und dann Import starten.");
  }catch(err){
    setStatus(err.message);
  }finally{
    btnPreview.disabled = false;
  }
});

btnImport.addEventListener("click", async () => {
  if (!lastFile || !lastPreviewOk){
    setStatus("Bitte zuerst eine Vorschau laden.");
    return;
  }
  btnImport.disabled = true;
  btnPreview.disabled = true;
  setStatus("Import läuft…");

  try{
    const result = await callCommit(lastFile);
    setStatus(`Import fertig: Neu ${result.created}, Updates ${result.updated}, Fehler ${result.failed}.`);
  }catch(err){
    setStatus(err.message);
  }finally{
    btnPreview.disabled = false;
  }
});
