document.addEventListener("DOMContentLoaded", () => {
  /* ============ DEV Schalter ============ */
  const DEV_MODE = true; // beim Entwickeln: true, später false
  /* ===================================== */

  /* =========================================================
     Fallback Toast / Step-Done
  ========================================================= */
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
      gap: "10px",
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
      transition: "all .25s ease",
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
      if (s) s.textContent = "✔";
    }
  };

  /* =========================================================
     Login-Bypass (kein Redirect in DEV)
  ========================================================= */
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!DEV_MODE) {
    if (!isLoggedIn) {
      localStorage.setItem("redirectAfterLogin", "fahrzeugdaten.html");
      window.location.href = "login.html";
      return;
    }
  }

  /* =========================================================
     Abbruch-Logik (nur in PROD relevant)
  ========================================================= */
  const referrer = document.referrer || "";
  const kamVonNeutralerSeite = ["index.html", "verkaufen.html"].some((p) => referrer.includes(p));
  const inseratGestartet = sessionStorage.getItem("inseratGestartet") === "true";
  const hatGespeichert = sessionStorage.getItem("hatGespeichert") === "true";
  if (!DEV_MODE && kamVonNeutralerSeite && inseratGestartet && !hatGespeichert) {
    localStorage.removeItem("fahrzeugdaten");
    sessionStorage.removeItem("inseratGestartet");
    console.log("Abbruch erkannt: Fahrzeugdaten gelöscht.");
  }
  sessionStorage.setItem("inseratGestartet", "true");

  /* =========================================================
     DOM Refs + Storage
  ========================================================= */
  let fahrzeugdaten = {};
  try {
    fahrzeugdaten = JSON.parse(localStorage.getItem("fahrzeugdaten")) || {};
  } catch {
    fahrzeugdaten = {};
  }

  const form = document.getElementById("fahrzeugForm");
  if (!form) return;

  const saveButton = document.querySelector(".save-button");
  const backButton = document.querySelector(".back-button");

  const markeSelect = document.getElementById("marke");
  const modellSelect = document.getElementById("modell");
  const varianteSelect = document.getElementById("variante");
  const motorSelect = document.getElementById("motor");

  const titelInput = document.getElementById("titel");

  const mwstCheckbox = document.getElementById("mwst-ausweisbar");
  const bruttoNettoFields = document.getElementById("brutto-netto-fields");
  const standardPreis = document.getElementById("preis-wrapper");
  const bruttoInput = document.getElementById("brutto-preis");
  const nettoInput = document.getElementById("netto-preis");
  const preisInput = document.getElementById("preis");

  const ezMonat = document.getElementById("ez-monat");
  const ezJahr = document.getElementById("ez-jahr");

  const kraftstoffSelect = document.getElementById("kraftstoff");

  // EV-Felder
  const evBatteryEl = document.getElementById("battery_kwh");
  const evRangeEl = document.getElementById("range_km");
  const evConsEl = document.getElementById("consumption_kwh_100");
  const evStandardEl = document.getElementById("ev_range_standard");

  // Optional: AC/DC
  const evAcEl = document.getElementById("charging_ac_kw");
  const evDcEl = document.getElementById("charging_dc_kw");

  // Sitze
  const placesSelect = document.getElementById("places");

  // weitere Standard-Felder
  const antriebSelect = document.getElementById("antriebsart");
  const getriebeSelect = document.getElementById("getriebe");
  const fahrzeugtypSelect = document.getElementById("fahrzeugtyp");
  const tuerenSelect = document.getElementById("türen");

  /* =========================================================
     Kleine Utilitys
  ========================================================= */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function hpToKw(hp) {
    const n = safeNumber(hp);
    if (n == null) return null;
    return Math.round(n * 0.73549875);
  }

  function setOptions(select, options, placeholderText) {
    if (!select) return;
    select.innerHTML = "";

    const ph = document.createElement("option");
    ph.disabled = true;
    ph.selected = true;
    ph.value = "";
    ph.textContent = placeholderText;
    select.appendChild(ph);

    options.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });
  }

  function mapDriveToSelect(driveStr = "") {
    const s = String(driveStr).toLowerCase();
    if (s.includes("allrad") || s.includes("4x4")) return "Allradantrieb";
    if (s.includes("vorder")) return "Frontantrieb";
    if (s.includes("heck")) return "Heckantrieb";
    return "";
  }

  function mapCoupeToFahrzeugtyp(coupe = "") {
    const c = String(coupe).toLowerCase();
    if (c.includes("suv") || c.includes("off-road") || c.includes("crossover")) return "Geländewagen / SUV";
    if (c.includes("limousine") || c.includes("sedan")) return "Limousine";
    if (c.includes("kombi") || c.includes("estate") || c.includes("wagon")) return "Kombi";
    if (c.includes("hatch") || c.includes("kleinwagen")) return "Kleinwagen";
    if (c.includes("coupe") || c.includes("coupé") || c.includes("sport")) return "Sportwagen / Coupé";
    if (c.includes("cabrio") || c.includes("roadster")) return "Cabrio / Roadster";
    if (c.includes("van") || c.includes("minibus")) return "Van / Minibus";
    return "";
  }

  function normalizeEvStandard(std = "") {
    const s = String(std).trim().toUpperCase();
    // dein Select hat WLTP/CLTC/EPA – Daten haben teils WLTC
    if (s === "WLTC") return "WLTP";
    return s; // CLTC/EPA/WLTP
  }

  /* =========================================================
     Feedback pro Feld (is-filled / is-disabled)
  ========================================================= */
  function getGroupEl(el) {
    if (!el) return null;
    return el.closest(".form-group") || el.closest(".form-row") || null;
  }

  function applyFilledState(el) {
    const group = getGroupEl(el);
    if (!group) return;

    let hasValue = false;
    if (el.type === "checkbox") hasValue = el.checked === true;
    else hasValue = String(el.value || "").trim() !== "";

    group.classList.toggle("is-filled", hasValue);
  }

  function applyDisabledStateToGroup(el) {
    const group = getGroupEl(el);
    if (!group) return;
    group.classList.toggle("is-disabled", el.disabled === true);
  }

  function applyFeedbackForAllFields() {
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      applyFilledState(el);
      applyDisabledStateToGroup(el);
    });
  }

  /* =========================================================
     Persistenz (einheitlich)
  ========================================================= */
  function persistField(el) {
    if (!el || !el.name) return;

    fahrzeugdaten[el.name] = el.type === "checkbox" ? el.checked.toString() : el.value;

    // Erstzulassung -> ISO
    if (ezJahr && ezMonat) {
      const m = ezMonat.value;
      const j = ezJahr.value;
      if (m && j) fahrzeugdaten.erstzulassung = `${j}-${m}`;
    }

    localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten));
  }

  function setField(id, value) {
    const el = document.getElementById(id);
    if (!el) return;

    if (el.tagName === "SELECT") {
      const exists = [...el.options].some((o) => o.value === String(value));
      if (exists) el.value = String(value);
      else {
        // wenn Select den Wert nicht kennt, nichts erzwingen
        // (z. B. WLTC → WLTP machen wir vorher!)
      }
    } else if (el.type === "checkbox") {
      el.checked = Boolean(value);
    } else {
      el.value = value ?? "";
    }

    // Persist + Feedback
    persistField(el);
    applyFilledState(el);

    // Event feuern, damit Progress + sonstige Listener reagieren
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* =========================================================
     Title helper
  ========================================================= */
  function aktualisiereTitel() {
    const marke = markeSelect?.value;
    const modell = modellSelect?.value;
    if (titelInput && marke && modell && modell !== "Beliebig") {
      if (titelInput.value.trim() === "") {
        const vorgeschlagen = `${marke} ${modell}`;
        titelInput.value = vorgeschlagen;
        persistField(titelInput);
        applyFilledState(titelInput);
      }
    }
  }

  /* =========================================================
     Powertrain Mode: EV deaktiviert ICE-Felder (und umgekehrt)
  ========================================================= */
  function inferModeFromFuelText(fuelText = "") {
    const f = String(fuelText).toLowerCase();
    const hasElec = f.includes("elektr");
    const hasBenz = f.includes("benzin");
    const hasDies = f.includes("diesel");

    if (hasElec && !hasBenz && !hasDies) return "ev";
    if (hasElec && (hasBenz || hasDies)) return "phev";
    if (hasBenz || hasDies || f.includes("lpg") || f.includes("ethanol") || f.includes("wasserstoff")) return "ice";
    return "unknown";
  }

  function disableContainer(selector, disabled, reasonLabel = "") {
  document.querySelectorAll(selector).forEach((wrap) => {
    wrap.querySelectorAll("input, select, textarea, button").forEach((el) => {
      el.disabled = disabled;
      
      // Grund am nächsten .form-group hinterlegen (Badge-Text)
      const group = getGroupEl(el);
      if (group && group.classList.contains("form-group")) {
        if (disabled) {
          group.dataset.disabledLabel = reasonLabel || "Derzeit nicht relevant";
          // Optional Tooltip (falls Badge abgeschnitten wird)
          group.title = reasonLabel || "Derzeit nicht relevant";
        } else {
          delete group.dataset.disabledLabel;
          group.title = "";
        }
      }
      
      // OPTIONAL: Werte nicht hart löschen (besseres UX)
      // Wenn du aktuell absichtlich alles leerst, lass den Block drin.
      // Empfehlung: Werte merken, dann beim Reaktivieren wiederherstellen:
      if (disabled) {
        if (el.type === "checkbox") {
          el.dataset.prevValue = el.checked ? "true" : "false";
          el.checked = false;
        } else {
          el.dataset.prevValue = el.value || "";
          el.value = "";
        }
        persistField(el);
      } else {
        // Restore (falls vorhanden)
        if (el.dataset.prevValue != null) {
          if (el.type === "checkbox") el.checked = el.dataset.prevValue === "true";
          else el.value = el.dataset.prevValue;
          delete el.dataset.prevValue;
          persistField(el);
        }
      }
      
      applyDisabledStateToGroup(el);
      applyFilledState(el);
    });
  });
}

  function setPowertrainMode(mode) {
  const isEvLike = mode === "ev" || mode === "phev";
  
  document.body.classList.toggle("is-ev", isEvLike);
  
  // EV/PHEV => ICE sperren
  disableContainer(".ice-only", isEvLike, "Nicht relevant bei Elektro/Hybrid");
  
  // ICE => EV sperren
  disableContainer(".ev-only", !isEvLike, "Nur relevant bei Elektro/Hybrid");
  
  updateProgressBar();
  applyFeedbackForAllFields();
}

  /* =========================================================
     Progressbar (sichtbarkeitsbewusst)
  ========================================================= */
  function updateProgressBar() {
    const ids = [
      "marke",
      "modell",
      "variante",
      "motor",
      "kilometer",
      "leistung_ps",
      "leistung_kw",
      "kraftstoff",
      "getriebe",
      "antriebsart",
      "fahrzeugtyp",
      "türen",
      "places",

      // ICE-only
      "hubraum",
      "partikelfilter",
      "verbrauch_kombiniert",
      "co2_emission",
      "verbrauch_innerorts",
      "verbrauch_ausserorts",
      "schadstoffklasse",
      "umweltplakette",
      "emissionsklasse",

      // EV-only
      "battery_kwh",
      "range_km",
      "consumption_kwh_100",
      "ev_range_standard",
      "charging_ac_kw",
      "charging_dc_kw",
    ];

    let gültig = 0;
    let total = 0;
    const isEvMode = document.body.classList.contains("is-ev");

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      // deaktivierte Felder nicht zählen
      if (el.disabled) return;

      // Nur relevante Container zählen (falls CSS etwas ausblendet)
      const hiddenAsIce = el.closest(".ice-only") && isEvMode;
      const hiddenAsEv = el.closest(".ev-only") && !isEvMode;
      if (hiddenAsIce || hiddenAsEv) return;

      total++;
      if (el.type === "checkbox") {
        if (el.checked) gültig++;
      } else if (String(el.value || "").trim() !== "") {
        gültig++;
      }
    });

    // EZ zählt als 1 Block (Monat+Jahr) – nur wenn nicht disabled
    total++;
    if (ezMonat?.value && ezJahr?.value) gültig++;

    const prozent = total > 0 ? Math.round((gültig / total) * 100) : 0;
    const fill = document.getElementById("progress-bar");
    if (fill) fill.style.width = `${prozent}%`;
  }

  /* =========================================================
     Autosave + Feedback Hook
  ========================================================= */
  const fields = form.querySelectorAll("input, select, textarea");
  fields.forEach((field) => {
    // restore
    if (field.name && fahrzeugdaten[field.name] != null && fahrzeugdaten[field.name] !== "") {
      if (field.type === "checkbox") field.checked = fahrzeugdaten[field.name] === "true";
      else field.value = fahrzeugdaten[field.name];
    }

    const speichern = () => {
      persistField(field);
      applyFilledState(field);
      updateProgressBar();
      aktualisiereTitel();

      // Mode bei Kraftstoffwechsel
      if (field === kraftstoffSelect) {
        const v = kraftstoffSelect.value || "";
        if (v === "Elektro") setPowertrainMode("ev");
        else if (v.startsWith("Hybrid")) setPowertrainMode("phev");
        else setPowertrainMode("ice");
      }
    };

    field.addEventListener("input", speichern);
    field.addEventListener("change", speichern);
  });

  // EZ zurückschreiben
  if (fahrzeugdaten.erstzulassung && ezMonat && ezJahr) {
    const [j, m] = String(fahrzeugdaten.erstzulassung).split("-");
    if (j && m) {
      ezJahr.value = j;
      ezMonat.value = m;
    }
  }

  /* =========================================================
     MwSt Toggle
  ========================================================= */
  if (mwstCheckbox && bruttoNettoFields && standardPreis) {
    const apply = (checked) => {
      if (preisInput) preisInput.disabled = checked;
      bruttoNettoFields.style.display = checked ? "grid" : "none";
      standardPreis.style.display = checked ? "none" : "grid";
      applyDisabledStateToGroup(preisInput);
      applyFilledState(preisInput);
    };

    apply(mwstCheckbox.checked);

    mwstCheckbox.addEventListener("change", function () {
      apply(this.checked);
    });

    bruttoInput?.addEventListener("input", function () {
      const brutto = parseFloat(this.value);
      if (nettoInput) nettoInput.value = !isNaN(brutto) ? (brutto / 1.19).toFixed(2) : "";
      persistField(nettoInput);
      applyFilledState(nettoInput);
    });
  }

  /* =========================================================
     Back
  ========================================================= */
  backButton?.addEventListener("click", (e) => {
    e.preventDefault();
    if (DEV_MODE) {
      safeToast("Zurück (DEV) – kein Redirect");
    } else {
      const userRole = localStorage.getItem("userRole");
      window.location.href = userRole === "haendler" ? "haendler.html" : "privat.html";
    }
  });

  /* =========================================================
     Save
  ========================================================= */
  function collectDataForSave() {
    const brutto = bruttoInput?.value?.trim() || fahrzeugdaten["brutto-preis"] || "";
    const netto = nettoInput?.value?.trim() || fahrzeugdaten["netto-preis"] || "";
    const einzelpreis = preisInput?.value?.trim() || fahrzeugdaten["preis"] || "";

    fahrzeugdaten.verkauf_preis = einzelpreis;
    fahrzeugdaten.verkauf_brutto = brutto;
    fahrzeugdaten.verkauf_netto = netto;
    fahrzeugdaten.verkauf_mwst = mwstCheckbox?.checked ? "zzgl. MwSt." : "Keine MwSt.";
    fahrzeugdaten.verkauf_modell = titelInput?.value || "";

    const verkaeuferTyp = localStorage.getItem("verkaeuferTyp") || "Privat";
    fahrzeugdaten.verkauf_verkaeufer = verkaeuferTyp;

    const m = ezMonat?.value || "";
    const j = ezJahr?.value || "";
    if (m && j) fahrzeugdaten.verkauf_erstzulassung = `${m}/${j}`;

    // Standard
    fahrzeugdaten.verkauf_antrieb = antriebSelect?.value || "";
    fahrzeugdaten.verkauf_fahrzeugtyp = fahrzeugtypSelect?.value || "";
    fahrzeugdaten.verkauf_tueren = tuerenSelect?.value || "";
    fahrzeugdaten.verkauf_kraftstoff = kraftstoffSelect?.value || "";
    fahrzeugdaten.verkauf_getriebe = getriebeSelect?.value || "";
    fahrzeugdaten.verkauf_sitze = placesSelect?.value || "";

    // EV-Felder nur wenn EV-Mode aktiv
    const isEvMode = document.body.classList.contains("is-ev");
    if (isEvMode) {
      fahrzeugdaten.ev_battery_kwh = evBatteryEl?.value || "";
      fahrzeugdaten.ev_range_km = evRangeEl?.value || "";
      fahrzeugdaten.ev_consumption_kwh_100 = evConsEl?.value || "";
      fahrzeugdaten.ev_range_standard = evStandardEl?.value || "";
      fahrzeugdaten.ev_charging_ac_kw = evAcEl?.value || "";
      fahrzeugdaten.ev_charging_dc_kw = evDcEl?.value || "";
    } else {
      // ICE-Felder (nur wenn nicht EV)
      fahrzeugdaten.verkauf_hubraum = document.getElementById("hubraum")?.value || "";
      fahrzeugdaten.verkauf_partikelfilter = document.getElementById("partikelfilter")?.value || "";
      fahrzeugdaten.verkauf_verbrauch_kombiniert = document.getElementById("verbrauch_kombiniert")?.value || "";
      fahrzeugdaten.verkauf_co2_emission = document.getElementById("co2_emission")?.value || "";
      fahrzeugdaten.verkauf_verbrauch_innerorts = document.getElementById("verbrauch_innerorts")?.value || "";
      fahrzeugdaten.verkauf_verbrauch_ausserorts = document.getElementById("verbrauch_ausserorts")?.value || "";
      fahrzeugdaten.verkauf_schadstoffklasse = document.getElementById("schadstoffklasse")?.value || "";
      fahrzeugdaten.verkauf_umweltplakette = document.getElementById("umweltplakette")?.value || "";
      fahrzeugdaten.verkauf_emissionsklasse = document.getElementById("emissionsklasse")?.value || "";
    }

    return fahrzeugdaten;
  }

  function serverSave(payload) {
    if (DEV_MODE) {
      localStorage.setItem("fahrzeugdaten", JSON.stringify(payload));
      return new Promise((resolve) => setTimeout(resolve, 400));
    }
    return fetch("/saveFahrzeugdaten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    }).then((res) => {
      if (!res.ok) throw new Error("Fehler beim Speichern der Fahrzeugdaten.");
      return res.json();
    });
  }

  saveButton?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const payload = collectDataForSave();
      await serverSave(payload);
      sessionStorage.setItem("hatGespeichert", "true");
      localStorage.setItem("fahrzeugSchritt1", "abgeschlossen");
      safeMarkStepDone(1);
      safeToast(DEV_MODE ? "Gespeichert (DEV)" : "Fahrzeugdaten gespeichert");

      if (!DEV_MODE) {
        const userRole = localStorage.getItem("userRole");
        setTimeout(() => {
          window.location.href = userRole === "haendler" ? "haendler.html" : "privat.html";
        }, 600);
      }
    } catch (err) {
      console.error("Fehler:", err);
      safeToast("Fahrzeugdaten konnten nicht gespeichert werden.", "error");
    }
  });

  /* =========================================================
     Auto-Data Integration (./data.json) + Fallback
  ========================================================= */
  let autoData = null;

  let currentBrand = null;
  let currentModel = null;
  let currentGeneration = null;

  async function loadAutoData() {
    try {
      const res = await fetch("./data.json");
      if (!res.ok) throw new Error("data.json nicht gefunden");
      autoData = await res.json();
    } catch (e) {
      console.warn("Auto-Data konnte nicht geladen werden:", e);
      autoData = null;
    }
  }

  function findBrandByName(name) {
    if (!autoData?.brands) return null;
    return autoData.brands.find((b) => String(b.name).toLowerCase() === String(name).toLowerCase()) || null;
  }

  function fillModelsForBrand(brand) {
    currentBrand = brand;
    currentModel = null;
    currentGeneration = null;

    const models = (brand?.models || []).map((m) => ({ value: m.name, label: m.name }));
    setOptions(modellSelect, models, "Bitte Modell wählen");
    setOptions(varianteSelect, [], "Bitte zuerst Modell wählen");
    setOptions(motorSelect, [], "Bitte zuerst Variante wählen");
  }

  function findModelByName(brand, modelName) {
    return (brand?.models || []).find((m) => String(m.name).toLowerCase() === String(modelName).toLowerCase()) || null;
  }

  function fillGenerationsForModel(model) {
    currentModel = model;
    currentGeneration = null;

    const gens = (model?.generations || []).map((g) => {
      const year = g.modelYear ? ` (${g.modelYear})` : "";
      return { value: String(g.id ?? g.name), label: `${g.name}${year}` };
    });

    setOptions(varianteSelect, gens, "Bitte Variante wählen");
    setOptions(motorSelect, [], "Bitte zuerst Variante wählen");
  }

  function findGenerationByIdOrName(model, genValue) {
    const gens = model?.generations || [];
    return gens.find((g) => String(g.id) === String(genValue) || String(g.name) === String(genValue)) || null;
  }

  function fillMotorsForGeneration(gen) {
    currentGeneration = gen;

    const mods = (gen?.modifications || []).map((mod) => {
      const hp = mod.powerSystemHp ?? mod.powerHp ?? "";
      const psText = hp ? ` • ${hp} PS` : "";
      return { value: String(mod.id), label: `${mod.engine}${psText}` };
    });

    setOptions(motorSelect, mods, "Bitte Motor wählen");
  }

  function findModificationById(gen, modId) {
    return (gen?.modifications || []).find((m) => String(m.id) === String(modId)) || null;
  }

  function applyAutofillFromModification(mod) {
    if (!mod) return;

    // Türen
    if (mod.doors) {
      const doors = Number(mod.doors);
      setField("türen", doors <= 3 ? "2/3" : "4/5");
    }

    // Sitze (NEU)
    const seats = safeNumber(mod.places ?? mod.placesMin);
    if (seats != null) setField("places", String(clamp(seats, 2, 9)));

    // Fahrzeugtyp
    const ft = mapCoupeToFahrzeugtyp(mod.coupe || "");
    if (ft) setField("fahrzeugtyp", ft);

    // Kraftstoff + Mode
    const fuelRaw = String(mod.fuel || "");
    const mode = inferModeFromFuelText(fuelRaw);

    // zuerst Mode setzen (damit Deaktivierungen greifen)
    setPowertrainMode(mode);

    // dann Kraftstoff-Select passend setzen
    const fuel = fuelRaw.toLowerCase();
    if (fuel.includes("benzin") && fuel.includes("elektr")) {
      setField("kraftstoff", "Hybrid (Benzin)");
    } else if (fuel.includes("diesel") && fuel.includes("elektr")) {
      setField("kraftstoff", "Hybrid (Diesel)");
    } else if (fuel.includes("elektr")) {
      setField("kraftstoff", "Elektro");
    } else if (fuel.includes("diesel")) {
      setField("kraftstoff", "Diesel");
    } else if (fuel.includes("benzin")) {
      setField("kraftstoff", "Benzin");
    } else if (fuel.includes("wasserstoff")) {
      setField("kraftstoff", "Wasserstoff");
    }

    // Antrieb
    const antrieb = mapDriveToSelect(mod.drive || "");
    if (antrieb) setField("antriebsart", antrieb);

    // Getriebe
    if (mod.gearboxAT && Number(mod.gearboxAT) > 0) setField("getriebe", "Automatik");

    // Leistung: HP bevorzugen, kW berechnen wenn nicht sauber vorhanden
    const hp = safeNumber(mod.powerSystemHp ?? mod.powerHp);
    const kwFromData = safeNumber(mod.powerSystem ?? mod.power);
    const kw = kwFromData != null && hp != null && Math.abs(kwFromData - hp) > 5 ? kwFromData : hpToKw(hp);

    if (hp != null) setField("leistung_ps", String(hp));
    if (kw != null) setField("leistung_kw", String(kw));

    // EV: Batterie/Reichweite/Verbrauch/Standard
    const battery = safeNumber(mod.batteryCapacity);
    const range = safeNumber(mod.allElectricRange);
    const evCons = safeNumber(mod.averageEnergyConsumption);
    const stdRaw = String(mod.standardEVr || mod.standardEVc || "").trim();
    const std = normalizeEvStandard(stdRaw);

    if (battery != null) setField("battery_kwh", String(battery));
    if (range != null) setField("range_km", String(range));
    if (evCons != null) setField("consumption_kwh_100", String(evCons));
    if (std) setField("ev_range_standard", std);

    // Optional: falls mal Hubraum sauber vorhanden ist (nur wenn ICE aktiv)
    const hub = safeNumber(mod.displacement ?? mod.engineDisplacement ?? mod.ccm);
    if (!document.body.classList.contains("is-ev") && hub != null) {
      setField("hubraum", String(hub));
    }

    // Optional: PHEV hat oft L/100km in fuelConsumptionCombined – deine ICE-Felder sind im EV-Modus deaktiviert.
    // Wenn du das später auch anzeigen willst, machen wir dafür ein eigenes PHEV-Feld.
  }

  /* =========================================================
     Fallback Marken/Modelle
  ========================================================= */
  let fallbackData = null;
  async function loadFallbackMarkenModelle() {
    try {
      const res = await fetch("data/marken-modelle.json");
      if (!res.ok) throw new Error("marken-modelle.json nicht gefunden");
      fallbackData = await res.json();
    } catch (e) {
      fallbackData = null;
    }
  }

  function applyFallbackBrand() {
    if (!fallbackData || !markeSelect || !modellSelect) return;
    const modelle = fallbackData[markeSelect.value] || [];
    modellSelect.innerHTML = `<option disabled selected>Bitte Modell wählen</option>`;
    modelle.forEach((modell) => {
      const opt = document.createElement("option");
      opt.value = modell;
      opt.textContent = modell;
      modellSelect.appendChild(opt);
    });

    setOptions(varianteSelect, [], "Bitte zuerst Modell wählen");
    setOptions(motorSelect, [], "Bitte zuerst Variante wählen");
  }

  function persistCatalogSelection() {
    fahrzeugdaten.autodata_brand = markeSelect?.value || "";
    fahrzeugdaten.autodata_model = modellSelect?.value || "";
    fahrzeugdaten.autodata_generation = varianteSelect?.value || "";
    fahrzeugdaten.autodata_modification = motorSelect?.value || "";
    localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten));
  }

  /* =========================================================
     Init
  ========================================================= */
  Promise.all([loadAutoData(), loadFallbackMarkenModelle()]).then(() => {
    // Marke change
    markeSelect?.addEventListener("change", () => {
      const brandName = markeSelect.value;
      const brand = findBrandByName(brandName);

      if (brand) fillModelsForBrand(brand);
      else {
        currentBrand = null;
        currentModel = null;
        currentGeneration = null;
        applyFallbackBrand();
      }

      persistCatalogSelection();
      aktualisiereTitel();
      updateProgressBar();
      applyFeedbackForAllFields();
    });

    // Modell change
    modellSelect?.addEventListener("change", () => {
      if (currentBrand) {
        const model = findModelByName(currentBrand, modellSelect.value);
        if (model) fillGenerationsForModel(model);
        else {
          setOptions(varianteSelect, [], "Bitte zuerst Modell wählen");
          setOptions(motorSelect, [], "Bitte zuerst Variante wählen");
        }
      } else {
        setOptions(varianteSelect, [], "Variante (Auto-Data) nicht verfügbar");
        setOptions(motorSelect, [], "Motor (Auto-Data) nicht verfügbar");
      }

      persistCatalogSelection();
      aktualisiereTitel();
      updateProgressBar();
      applyFeedbackForAllFields();
    });

    // Variante change
    varianteSelect?.addEventListener("change", () => {
      if (!currentModel) return;
      const gen = findGenerationByIdOrName(currentModel, varianteSelect.value);
      if (!gen) return;
      fillMotorsForGeneration(gen);
      persistCatalogSelection();
      updateProgressBar();
      applyFeedbackForAllFields();
    });

    // Motor change
    motorSelect?.addEventListener("change", () => {
      if (!currentGeneration) return;
      const mod = findModificationById(currentGeneration, motorSelect.value);
      persistCatalogSelection();
      applyAutofillFromModification(mod);
      updateProgressBar();
      applyFeedbackForAllFields();
    });

    // Restore Auswahl aus localStorage
    if (fahrzeugdaten?.marke && markeSelect && [...markeSelect.options].some((o) => o.value === fahrzeugdaten.marke)) {
      markeSelect.value = fahrzeugdaten.marke;
      markeSelect.dispatchEvent(new Event("change"));

      if (fahrzeugdaten?.modell) {
        setTimeout(() => {
          if ([...modellSelect.options].some((o) => o.value === fahrzeugdaten.modell)) {
            modellSelect.value = fahrzeugdaten.modell;
            modellSelect.dispatchEvent(new Event("change"));
          }
        }, 0);
      }

      if (fahrzeugdaten?.variante) {
        setTimeout(() => {
          if ([...varianteSelect.options].some((o) => o.value === fahrzeugdaten.variante)) {
            varianteSelect.value = fahrzeugdaten.variante;
            varianteSelect.dispatchEvent(new Event("change"));
          }
        }, 40);
      }

      if (fahrzeugdaten?.motor) {
        setTimeout(() => {
          if ([...motorSelect.options].some((o) => o.value === fahrzeugdaten.motor)) {
            motorSelect.value = fahrzeugdaten.motor;
            motorSelect.dispatchEvent(new Event("change"));
          }
        }, 80);
      }
    }

    // Restore Mode aus gespeichertem Kraftstoff
    if (kraftstoffSelect?.value) {
      const v = kraftstoffSelect.value;
      if (v === "Elektro") setPowertrainMode("ev");
      else if (v.startsWith("Hybrid")) setPowertrainMode("phev");
      else setPowertrainMode("ice");
    } else {
      // Default: ICE (EV-Felder sperren)
      setPowertrainMode("ice");
    }

    updateProgressBar();
    aktualisiereTitel();
    applyFeedbackForAllFields();
  });
});
