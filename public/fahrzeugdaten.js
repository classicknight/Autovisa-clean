// fahrzeugdaten.js — korrigiert & robust

document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // API-Basis (für Domain-/Subdomain-Setups)
  // ============================
  const API_BASE =
    (typeof window !== "undefined" && window.API_BASE) ||
    document.querySelector('meta[name="api-base"]')?.content ||
    "";
  const api = (path) =>
    API_BASE
      ? API_BASE.replace(/\/+$/, "") + "/" + String(path).replace(/^\/+/, "")
      : String(path);

  // ============================
  // Fallback-Toast & Step-Done
  // ============================
  function ensureToastContainer() {
    if (document.getElementById("toast-container")) return;
    const c = document.createElement("div");
    c.id = "toast-container";
    Object.assign(c.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "9999",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    });
    document.body.appendChild(c);
  }
  const safeToast = (msg, type = "success") => {
    if (typeof window.showToast === "function") return window.showToast(msg, type);
    ensureToastContainer();
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      background: type === "error" ? "#d64545" : "#00b8a9",
      color: "#fff",
      padding: "12px 14px",
      borderRadius: "10px",
      boxShadow: "0 10px 22px rgba(0,0,0,.15)",
      fontSize: "14px",
      opacity: "0",
      transform: "translateY(-8px)",
      transition: "all .25s ease"
    });
    document.getElementById("toast-container").appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      t.addEventListener("transitionend", () => t.remove(), { once: true });
    }, 3000);
  };
  const safeMarkStepDone = (step) => {
    if (typeof window.markStepDone === "function") return window.markStepDone(step);
    try {
      const KEY = "haendlerSteps";
      const state = JSON.parse(localStorage.getItem(KEY) || "{}");
      state[step] = true;
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
    const box = document.querySelector(`.step-box[data-step="${step}"]`);
    if (box) {
      box.classList.add("completed");
      const s = box.querySelector(".step-status");
      if (s) s.textContent = "✔️";
    }
  };

  // ============================
  // Login-Gate
  // ============================
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!isLoggedIn) {
    localStorage.setItem("redirectAfterLogin", "fahrzeugdaten.html");
    window.location.href = "login.html";
    return;
  }

  // ============================
  // Abbruch-Erkennung & Wizard-Flags
  // ============================
  const referrer = document.referrer || "";
  const kamVonNeutralerSeite = ["index.html", "verkaufen.html"].some((p) =>
    referrer.includes(p)
  );
  const inseratGestartet = sessionStorage.getItem("inseratGestartet") === "true";
  const hatGespeichert = sessionStorage.getItem("hatGespeichert") === "true";

  if (kamVonNeutralerSeite && inseratGestartet && !hatGespeichert) {
    localStorage.removeItem("fahrzeugdaten");
    sessionStorage.removeItem("inseratGestartet");
    console.log("❌ Abbruch erkannt: Fahrzeugdaten gelöscht.");
  }
  sessionStorage.setItem("inseratGestartet", "true");

  // ============================
  // Helpers
  // ============================
  const $ = (id) => document.getElementById(id);
  const getFirst = (...ids) => {
    for (const id of ids) {
      const el = $(id);
      if (el) return el;
    }
    return null;
  };
  const getVal = (...ids) => {
    const el = getFirst(...ids);
    if (!el) return "";
    if (el.type === "checkbox") return el.checked ? "true" : "false";
    return String(el.value || "").trim();
  };
  const getNum = (...ids) => {
    const raw = getVal(...ids);
    if (!raw) return "";
    const cleaned = raw
      .replace(/[\u202F\u00A0\s]/g, "")
      .replace(/[€]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? String(n) : "";
  };
  const pad2 = (n) => String(n).padStart(2, "0");

  // ============================
  // State laden
  // ============================
  let fahrzeugdaten = {};
  try {
    fahrzeugdaten = JSON.parse(localStorage.getItem("fahrzeugdaten")) || {};
  } catch {
    fahrzeugdaten = {};
  }

  // ============================
  // DOM-Refs
  // ============================
  const form         = $("fahrzeugForm");
  const saveButton   = document.querySelector(".save-button");
  const backButton   = document.querySelector(".back-button");

  const markeSelect  = $("marke");
  const modellSelect = $("modell");
  const titelInput   = $("titel");

  const mwstCheckbox      = $("mwst-ausweisbar");
  const bruttoNettoFields = $("brutto-netto-fields");
  const standardPreis     = $("preis-wrapper");
  const bruttoInput       = $("brutto-preis");
  const nettoInput        = $("netto-preis");
  const preisInput        = $("preis");

// EZ-Felder robust holen (unterstützt alternative IDs)
const ezMonat = $("ez-monat") || $("first-registration-month") || $("verkauf-ez-monat");
const ezJahr  = $("ez-jahr")  || $("first-registration-year")  || $("verkauf-ez-jahr");

// ============================
// Jahre befüllen (1950 .. aktuellesJahr+2)
// ============================
if (ezJahr) {
  const aktuellesJahr = new Date().getFullYear();
  const minYear = 1950;
  const maxYear = aktuellesJahr + 2; // Vorbestellungen erlauben

  // Nur befüllen, wenn noch KEINE echten Jahres-Optionen existieren
  const hatJahre = Array.from(ezJahr.options).some(o => /^\d{4}$/.test(o.value));
  if (!hatJahre) {
    // Falls kein Platzhalter vorhanden, einen setzen
    if (!ezJahr.querySelector('option[disabled][selected]')) {
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "Jahr";
      ph.disabled = true;
      ph.selected = true;
      ezJahr.appendChild(ph);
    }
    // Von maxYear rückwärts bis minYear auffüllen
    for (let j = maxYear; j >= minYear; j--) {
      const opt = document.createElement("option");
      opt.value = String(j);
      opt.textContent = String(j);
      ezJahr.appendChild(opt);
    }
  }
}


  // ============================
  // Felder aus Storage vorbelegen + live speichern
  // (nutzt name ODER id als Key)
  // ============================
  if (form) {
    const fields = form.querySelectorAll("input, select, textarea");
    fields.forEach((field) => {
      const key = field.name || field.id;
      if (!key) return;

      const stored = fahrzeugdaten[key];
      if (stored != null) {
        if (field.type === "checkbox") {
          field.checked = stored === "true";
        } else {
          field.value = stored;
        }
      }

      const speichern = () => {
        const value = field.type === "checkbox" ? String(field.checked) : String(field.value || "");
        fahrzeugdaten[key] = value;

        // EZ zusätzlich als normiertes Feld ablegen (YYYY-MM)
        if (ezJahr && ezMonat) {
          const jahr  = ezJahr.value;
          const monat = ezMonat.value;
          if (jahr && monat) {
            const iso = `${jahr}-${pad2(monat)}`;
            fahrzeugdaten.erstzulassung         = iso; // neutral
            fahrzeugdaten.verkauf_erstzulassung = iso; // für Vorschau
          }
        }

        localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten));
        if (typeof updateProgressBar === "function") updateProgressBar();
        if (typeof aktualisiereTitel === "function")  aktualisiereTitel();
      };

      field.addEventListener("input", speichern);
      field.addEventListener("change", speichern);
    });
  }

  // ============================
  // EZ aus Storage wiederherstellen
  // ============================
  if (fahrzeugdaten.erstzulassung && ezMonat && ezJahr) {
    const [jahr, monat] = String(fahrzeugdaten.erstzulassung).split("-");
    if (jahr)  ezJahr.value  = jahr;
    if (monat) ezMonat.value = monat;
  }

  // ============================
  // Marken/Modelle (Verkäufer-Ansicht: ohne "Beliebig"/"(Alle)")
  // ============================
  function sanitizeModelListSell(listRaw = []) {
    const seen = new Set();
    const out = [];
    let hadAndere = false;
    for (const raw of listRaw) {
      if (raw == null) continue;
      const name = String(raw).trim();
      if (!name) continue;
      if (/^beliebig$/i.test(name)) continue;
      if (/\(alle\)/i.test(name)) continue;
      if (/^andere$/i.test(name)) { hadAndere = true; continue; }
      const key = name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(name); }
    }
    out.sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
    if (hadAndere) out.push("Andere");
    return out;
  }

  let brandModelMap = {};
  function rebuildModelOptionsSell(brand, preselect = "") {
    if (!modellSelect) return;
    modellSelect.innerHTML = `<option value="" disabled selected>Bitte Modell wählen</option>`;
    const rawList = (brandModelMap && brandModelMap[brand]) || [];
    const models  = sanitizeModelListSell(rawList);
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      modellSelect.appendChild(opt);
    }
    if (preselect && models.includes(preselect)) {
      modellSelect.value = preselect;
    } else {
      modellSelect.value = "";
    }
    modellSelect.dispatchEvent(new Event("change", { bubbles: true }));
    aktualisiereTitel();
    updateProgressBar();
  }

  // (… dein weiterer Code folgt hier — fetch der marken-modelle.json, Titel-Logik, Progress-Bar, Preis-Logik, Save-Handler, etc.)


  fetch("data/marken-modelle.json", { credentials: "omit" })
    .then((res) => res.json())
    .then((data) => {
      brandModelMap = (data && typeof data === "object") ? data : {};
      if (markeSelect && modellSelect) {
        markeSelect.addEventListener("change", () => {
          rebuildModelOptionsSell(markeSelect.value, "");
        });
        const initialBrand = markeSelect.value || fahrzeugdaten.marke || "";
        const initialModel = fahrzeugdaten.modell || "";
        if (initialBrand) {
          if (!markeSelect.value) markeSelect.value = initialBrand;
          rebuildModelOptionsSell(initialBrand, initialModel);
        } else {
          modellSelect.innerHTML = `<option value="" disabled selected>Bitte zuerst Marke wählen</option>`;
        }
      }
    })
    .catch(() => {
      if (modellSelect) {
        modellSelect.innerHTML = `<option value="" disabled selected>Bitte zuerst Marke wählen</option>`;
      }
    });

  // ============================
  // Titel automatisch vorschlagen (nur wenn leer)
  // ============================
  function aktualisiereTitel() {
    const marke  = markeSelect?.value || "";
    const modell = modellSelect?.value || "";
    if (titelInput && marke && modell) {
      const aktuellerTitel = titelInput.value.trim();
      const vorgeschlagenerTitel = `${marke} ${modell}`;
      if (aktuellerTitel === "") {
        titelInput.value = vorgeschlagenerTitel;
        fahrzeugdaten.titel = vorgeschlagenerTitel;
        localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten));
      }
    }
  }
// ============================
// Progress-Bar
// ============================
function updateProgressBar() {
  // Doppelte/Alternativ-IDs deduplizieren
  const ids = Array.from(new Set([
    "marke","modell","kilometer","leistung","hubraum",
    "kraftstoff","getriebe","antriebsart","fahrzeugtyp",
    "tueren","türen","partikelfilter","verbrauch_kombiniert","co2_emission",
    "verbrauch_innerorts","verbrauch_ausserorts","schadstoffklasse","umweltplakette"
  ]));

  // nur tatsächlich vorhandene & nicht deaktivierte Felder berücksichtigen
  const felder = ids
    .map(id => $(id))
    .filter(el => !!el && !el.disabled);

  let gefuellt = 0;
  for (const el of felder) {
    let ok = false;
    if (el.tagName === "SELECT") {
      ok = el.value !== "";
    } else if (el.type === "checkbox") {
      ok = el.checked;
    } else {
      ok = String(el.value || "").trim() !== "";
    }
    if (ok) gefuellt++;
  }

  // EZ als 1 zusätzlicher Schritt – nur wenn beide Selects existieren
  const hatEZ = !!(ezMonat && ezJahr);
  const ezOK  = hatEZ && ezMonat.value && ezJahr.value;

  const total = felder.length + (hatEZ ? 1 : 0);
  const prozentRaw = total > 0 ? ((gefuellt + (ezOK ? 1 : 0)) / total) * 100 : 0;
  const prozent = Math.max(0, Math.min(100, Math.round(prozentRaw)));

  const bar = $("progress-bar");
  if (bar) {
    bar.style.width = `${prozent}%`;
    bar.setAttribute("aria-valuenow", String(prozent));
  }
}

// Änderungen an EZ sofort berücksichtigen
ezMonat?.addEventListener("change", updateProgressBar);
ezJahr ?.addEventListener("change", updateProgressBar);

// ============================
// MwSt / Preis-Logik
// ============================
if (mwstCheckbox && bruttoNettoFields && standardPreis) {
  const applyMwstUI = (checked) => {
    preisInput.disabled = checked;
    bruttoNettoFields.style.display = checked ? "grid" : "none";
    standardPreis.style.display = checked ? "none" : "grid";
  };
  applyMwstUI(mwstCheckbox.checked);

  mwstCheckbox.addEventListener("change", function () {
    applyMwstUI(this.checked);
    updateProgressBar();
  });

  bruttoInput?.addEventListener("input", function () {
    const brutto = Number(getNum("brutto-preis"));
    const netto  = Number.isFinite(brutto) ? (brutto / 1.19) : NaN;
    nettoInput.value = Number.isFinite(netto) ? netto.toFixed(2) : "";

    // sofort persistieren
    fahrzeugdaten["brutto-preis"] = this.value || "";
    fahrzeugdaten["netto-preis"]  = nettoInput.value || "";
    localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten));
    updateProgressBar();
  });
}

// ============================
// Navigation
// ============================
backButton?.addEventListener("click", (e) => {
  e.preventDefault();
  const userRole = localStorage.getItem("userRole");
  window.location.href = userRole === "haendler" ? "haendler.html" : "privat.html";
});

// ============================
// Speichern → sammelt ALLE Felder robust ein
// ============================
saveButton?.addEventListener("click", async (e) => {
  e.preventDefault();

  // Preise
  const brutto      = getNum("brutto-preis") || fahrzeugdaten["brutto-preis"] || "";
  const netto       = getNum("netto-preis")  || fahrzeugdaten["netto-preis"]  || "";
  const einzelpreis = getNum("preis")        || fahrzeugdaten["preis"]        || "";

  const marke  = markeSelect?.value || "";
  const modell = modellSelect?.value || "";
  const titel  = (titelInput?.value || "").trim() || `${marke} ${modell}`;

  // EZ als YYYY-MM
  const ezIso = (() => {
    const jahr = ezJahr?.value || "";
    const monat = ezMonat?.value || "";
    return jahr && monat ? `${jahr}-${pad2(monat)}` : "";
  })();

  // Robust Werte einsammeln (IDs mit/ohne Umlaute, Alternativen)
  const out = {
    // Titel / Marke / Modell
    titel,
    marke,
    modell,

    // Preise + MwSt
    "brutto-preis": brutto,
    "netto-preis":  netto,
    preis:          einzelpreis,

    verkauf_brutto: brutto,
    verkauf_netto:  netto,
    verkauf_preis:  einzelpreis,
    verkauf_mwst:   mwstCheckbox?.checked ? "zzgl. MwSt." : "Keine MwSt.",

    // Vorschau erwartet "verkauf_modell" als großen Titel
    verkauf_modell: titel,

    // Verkäufer-Typ
    verkauf_verkaeufer: localStorage.getItem("verkaeuferTyp") || "Privat",

    // Erstzulassung (kompatibel zur Suche & Vorschau)
    erstzulassung: ezIso,
    verkauf_erstzulassung: ezIso,

    // Kernfelder
    verkauf_kilometer:           getNum("kilometer", "km"),
    verkauf_leistung:            getNum("leistung", "ps"),
    verkauf_hubraum:             getNum("hubraum", "ccm"),
    verkauf_kraftstoff:          getVal("kraftstoff", "kraftstoffart"),
    verkauf_getriebe:            getVal("getriebe", "getriebeart"),
    verkauf_antrieb:             getVal("antriebsart", "antrieb"),

    verkauf_fahrzeugtyp:         getVal("fahrzeugtyp"),
    verkauf_tueren:              getVal("tueren", "türen"),
    verkauf_partikelfilter:      getVal("partikelfilter"),

    verkauf_verbrauch_kombiniert: getVal("verbrauch_kombiniert"),
    verkauf_verbrauch_innerorts:  getVal("verbrauch_innerorts"),
    verkauf_verbrauch_ausserorts: getVal("verbrauch_ausserorts"),
    verkauf_co2_emission:         getVal("co2_emission"),

    verkauf_schadstoffklasse:    getVal("schadstoffklasse"),
    verkauf_umweltplakette:      getVal("umweltplakette")
  };

  // In Memory mergen & persistieren
  Object.assign(fahrzeugdaten, out);
  try { localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten)); } catch {}

  // POST an Backend
  try {
    const res = await fetch(api("/saveFahrzeugdaten"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",                 // ← Session-Cookie mitschicken
      body: JSON.stringify(fahrzeugdaten)
    });
    if (!res.ok) throw new Error(await res.text().catch(() => "Fehler beim Speichern"));

    sessionStorage.setItem("hatGespeichert", "true");
    localStorage.setItem("fahrzeugSchritt1", "abgeschlossen");

    safeMarkStepDone(1);
    safeToast("Fahrzeugdaten gespeichert ✅");

    const userRole = localStorage.getItem("userRole");
    setTimeout(() => {
      window.location.href = userRole === "haendler" ? "haendler.html" : "privat.html";
    }, 600);
  } catch (err) {
    console.error("🚫 Fehler:", err);
    safeToast("❌ Fahrzeugdaten konnten nicht gespeichert werden.", "error");
  }
});

// Initial UI
updateProgressBar();
aktualisiereTitel();

});
