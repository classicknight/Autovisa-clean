document.addEventListener("DOMContentLoaded", () => {
  // Auf Startseite gibt es ein Formular im #search-section; auf der Suchkriterien-Seite NICHT.
  const form = document.querySelector("#search-section .search-form");

  // HTML5-Validierung nur deaktivieren, wenn es das Formular gibt
  if (form) {
    form.noValidate = true;
    ["marke","modell","kilometer-select","price-select","distance-select","gear","transmission","fuel","fuelType"]
      .forEach(id => document.getElementById(id)?.removeAttribute("required"));
  }

  // ---- Refs (alles optional, je nach Seite vorhanden)
  const markeSel    = document.getElementById("marke");
  const modellSel   = document.getElementById("modell");
  const monthSel    = document.getElementById("first-registration-month"); // Startseite
  const yearSel     = document.getElementById("first-registration-year");  // Startseite

  // Suchkriterien-Seite: <input type="month"> von/bis
  const ezVonAlt    = document.getElementById("ez-von"); // Kriterien-Seite
  const ezBisAlt    = document.getElementById("ez-bis"); // Kriterien-Seite

  const kmSel       = document.getElementById("kilometer-select");
  const kmCustom    = document.getElementById("kilometer-custom");
  const priceSel    = document.getElementById("price-select");
  const priceCustom = document.getElementById("price-custom");

  const gearSel     = document.getElementById("gear") || document.getElementById("transmission");
  const fuelSel     = document.getElementById("fuel") || document.getElementById("fuelType");

  // Startseite ODER Suchkriterien-Seite (location vs. ort)
  const locInput    = document.getElementById("location") || document.getElementById("ort");

  // Startseite (distance-select) – Kriterien-Seite hat 'umkreis'
  const distSel     = document.getElementById("distance-select");
  const distCustom  = document.getElementById("distance-custom");

  const sortSel     = document.getElementById("sortBy") || document.getElementById("sort");
  const advancedBtn = form?.querySelector(".btn-advanced");

  // Verbrauch (Komb.): Fallback-Input-ID für Suchkriterien-Seite ist "verbrauch"
  const consSel     = document.getElementById("verbrauch-select");
  const consCustom  = document.getElementById("verbrauch-custom") || document.getElementById("verbrauch");

  // Feature-Checkboxen auf Suchkriterien-Seite
  const pfEl        = document.getElementById("partikelfilter");
  const shEl        = document.getElementById("scheckheft");
  const ftEl        = document.getElementById("fahrtauglich");

  // Suchkriterien-Seite: eigener Umkreis
  const umkreisSel    = document.getElementById("umkreis");
  const umkreisCustom = document.getElementById("custom-umkreis");

  // ---- Jahre befüllen (aktuell -> 1980)
  if (yearSel) {
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y >= 1980; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSel.appendChild(opt);
    }
  }

  // ============================
  // Slim Select
  // ============================
  let ssMarke = null, ssModell = null;
  if (window.SlimSelect) {
    if (markeSel) {
      ssMarke = new SlimSelect({ select: "#marke", placeholder: "Marke wählen" });
    }
    if (modellSel) {
      ssModell = new SlimSelect({
        select: "#modell",
        placeholder: "Modell(e) wählen",
        closeOnSelect: false,
        showSearch: true,
      });
    }
  }

  // ============================
  // Gruppen-Definitionen (Regex)
  // ============================
  const modelGroups = {
    // BMW
    "1er Reihe (Alle)": /^1(1[0-9]|2[0-9]|3[0-9]|4[0-9]|14[0-9]|1er M Coupé)/i,
    "2er Reihe (Alle)": /^2(1[0-9]|2[0-9]|3[0-9])/i,
    "3er Reihe (Alle)": /^3[0-9]{2}|^ActiveHybrid 3/i,
    "4er Reihe (Alle)": /^4[0-9]{2}/i,
    "5er Reihe (Alle)": /^5[0-9]{2}|^ActiveHybrid 5/i,
    "6er Reihe (Alle)": /^6[0-9]{2}/i,
    "7er Reihe (Alle)": /^7[0-9]{2}|^ActiveHybrid 7/i,
    "M-Modelle (Alle)": /^M[0-9]|^M1[0-9]/i,
    "X-Reihe (Alle)": /^X[0-9]|^ActiveHybrid X6/i,
    "Z-Reihe (Alle)": /^Z[0-9]/i,

    // DFSK
    "Fengon (Alle)": /^Fengon(\s\d+)?$/i,

    // Ford
    "Tourneo (Alle)": /^Tourneo\b/i,
    "Transit (Alle)": /^Transit\b/i,
    "Tourneo (alle)": /^Tourneo\b/i,

    // Lexus
    "ES-Serie (Alle)": /^ES\s/i,
    "GS-Serie (Alle)": /^GS\s/i,
    "GX Series (Alle)": /^GX\s/i,
    "IS-Serie (Alle)": /^IS\s/i,
    "LS-Serie (Alle)": /^LS\s/i,
    "LX-Serie (Alle)": /^LX\s/i,
    "NX-Serie (Alle)": /^NX\s/i,
    "RC-Serie (Alle)": /^RC\s/i,
    "RX-Serie (Alle)": /^RX\s/i,

    // Mercedes-Benz
    "A-Klasse (Alle)": /^A\s/i,
    "B-Klasse (Alle)": /^B\s/i,
    "C-Klasse (Alle)": /^C\s/i,
    "CE-Klasse (Alle)": /^CE\s/i,
    "CLA-Klasse (Alle)": /^CLA\s/i,
    "CLC-Klasse (Alle)": /^CLC\s/i,
    "CLE-Klasse (Alle)": /^CLE\s/i,
    "CLK-Klasse (Alle)": /^CLK\s/i,
    "CL-Klasse (Alle)": /^CL\s/i,
    "CLS-Klasse (Alle)": /^CLS\s/i,
    "E-Klasse (Alle)": /^E\s/i,
    "G-Klasse (Alle)": /^G\s/i,
    "GLA-Klasse (Alle)": /^GLA\s/i,
    "GLB-Klasse (Alle)": /^GLB\s/i,
    "GLC-Klasse (Alle)": /^GLC\s/i,
    "GLE-Klasse (Alle)": /^GLE\s/i,
    "GLK-Klasse (Alle)": /^GLK\s/i,
    "GL-Klasse (Alle)": /^GL\s/i,
    "GLS-Klasse (Alle)": /^GLS\s/i,
    "GT-Klasse (Alle)": /^AMG GT/i,
    "ML-Klasse (Alle)": /^ML\s/i,
    "R-Klasse (Alle)": /^R\s/i,
    "S-Klasse (Alle)": /^S\s/i,
    "SLC-Klasse (Alle)": /^SLC\s/i,
    "SLK-Klasse (Alle)": /^SLK\s/i,
    "SL-Klasse (Alle)": /^SL\s/i,
    "V-Klasse (Alle)": /^V\s/i,
    "X-Klasse (Alle)": /^X\s/i,

    // MINI
    "Cabrio Serie (Alle)": /\bCabrio$/,
    "Clubman Serie (Alle)": /\bClubman$/,
    "Countryman Serie (Alle)": /\bCountryman$/,
    "Coupe Serie (Alle)": /\bCoupé$/,
    "MINI (Alle)": /^(1000|1300|Cooper|ONE|One)\b|John Cooper Works$/i,
    "Paceman Serie (Alle)": /\bPaceman$/,
    "Roadster Serie (Alle)": /\bRoadster$/,

    // Bentley
    "Continental (Alle)": /^Continental\b/i,

    // Porsche
    "911er Reihe (Alle)": /^(911|930|964|991|992|993|996|997|912|914|918)\b/i,

    // Volkswagen
    "Golf (Alle)": /^Golf(\s|$|-)/i,
    "Passat (Alle)": /^Passat(\s|$|-)/i,
    "Passat (alle)": /^Passat(\s|$|-)/i,
    "T3 (Alle)": /^T3(\s|$)/i,
    "T4 (Alle)": /^T4(\s|$)/i,
    "T5 (Alle)": /^T5(\s|$)/i,
    "T6 (Alle)": /^T6(\s|$)/i,
  };

  const ALLOW_GROUPS_FOR = {
    "Bentley": ["Continental (Alle)"],
    "BMW": [
      "1er Reihe (Alle)","2er Reihe (Alle)","3er Reihe (Alle)","4er Reihe (Alle)",
      "5er Reihe (Alle)","6er Reihe (Alle)","7er Reihe (Alle)",
      "M-Modelle (Alle)","X-Reihe (Alle)","Z-Reihe (Alle)"
    ],
    "DFSK": ["Fengon (Alle)"],
    "Ford": ["Tourneo (Alle)","Tourneo (alle)","Transit (Alle)"],
    "Lexus": [
      "ES-Serie (Alle)","GS-Serie (Alle)","GX Series (Alle)","IS-Serie (Alle)",
      "LS-Serie (Alle)","LX-Serie (Alle)","NX-Serie (Alle)","RC-Serie (Alle)","RX-Serie (Alle)"
    ],
    "Mercedes-Benz": [
      "A-Klasse (Alle)","B-Klasse (Alle)","C-Klasse (Alle)","CE-Klasse (Alle)",
      "CLA-Klasse (Alle)","CLC-Klasse (Alle)","CLE-Klasse (Alle)","CLK-Klasse (Alle)",
      "CL-Klasse (Alle)","CLS-Klasse (Alle)","E-Klasse (Alle)","G-Klasse (Alle)",
      "GLA-Klasse (Alle)","GLB-Klasse (Alle)","GLC-Klasse (Alle)","GLE-Klasse (Alle)",
      "GLK-Klasse (Alle)","GL-Klasse (Alle)","GLS-Klasse (Alle)","GT-Klasse (Alle)",
      "ML-Klasse (Alle)","R-Klasse (Alle)","S-Klasse (Alle)","SLC-Klasse (Alle)",
      "SLK-Klasse (Alle)","SL-Klasse (Alle)","V-Klasse (Alle)","X-Klasse (Alle)"
    ],
    "MINI": [
      "Cabrio Serie (Alle)","Clubman Serie (Alle)","Countryman Serie (Alle)",
      "Coupe Serie (Alle)","MINI (Alle)","Paceman Serie (Alle)","Roadster Serie (Alle)"
    ],
    "Porsche": ["911er Reihe (Alle)"],
    "Volkswagen": ["Golf (Alle)","Passat (Alle)","Passat (alle)","T3 (Alle)","T4 (Alle)","T5 (Alle)","T6 (Alle)"]
  };

  // ============================
  // Marken/Modelle laden
  // ============================
  const ALL_MODELS_VALUE = "__ALL_MODELS__";
  const FILTER_OUT_BELIEBIG_IN_JSON = true;
  const FILTER_OUT_GROUP_ALLE = false;
  let brandToModels = {};

  function sanitizeModelList(listRaw = []) {
    const seen = new Set();
    const out = [];
    for (const raw of listRaw) {
      if (raw == null) continue;
      const name = String(raw).trim();
      if (!name) continue;
      if (FILTER_OUT_BELIEBIG_IN_JSON && /^beliebig$/i.test(name)) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(name); }
    }
    const idxAndere = out.findIndex(v => /^andere$/i.test(v));
    if (idxAndere >= 0 && idxAndere !== out.length - 1) {
      const [andere] = out.splice(idxAndere, 1);
      out.push(andere);
    }
    return out;
  }

  async function loadBrandModelMap() {
    try {
      const r = await fetch("/data/marken-modelle.json", { credentials: "omit" });
      if (!r.ok) throw new Error("HTTP "+r.status);
      const data = await r.json();
      brandToModels = (data && typeof data === "object") ? data : {};
    } catch (e) {
      console.warn("marken-modelle.json konnte nicht geladen werden – Fallback aktiv.", e);
      brandToModels = {
        "Audi": ["A1","A3","A4","A6","Q2","Q3","Q5","Q7","TT","e-tron","Andere"],
        "BMW": ["1er","2er","3er","4er","5er","7er","X1","X3","X5","i3","Andere"],
        "Mercedes-Benz": ["A-Klasse","B-Klasse","C-Klasse","E-Klasse","S-Klasse","GLA","GLC","GLE","Andere"],
        "Volkswagen": ["up!","Polo","Golf","T-Roc","Tiguan","Passat","Touran","ID.3","ID.4","Andere"]
      };
    }
  }

  function rebuildModelOptions(brand) {
    if (!modellSel) return;
    const rawList = (brandToModels && brandToModels[brand]) || [];
    const models  = sanitizeModelList(rawList);
    const data = [
      { text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE },
      ...models.map(m => ({ text: m, value: m }))
    ];
    if (ssModell) {
      ssModell.setData(data.length ? data : [{ text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE }]);
      ssModell.setSelected([ALL_MODELS_VALUE]);
    } else {
      modellSel.innerHTML = "";
      data.forEach(({ text, value }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text;
        modellSel.appendChild(opt);
      });
      modellSel.value = ALL_MODELS_VALUE;
    }
  }

  function enforceAllModelsExclusivity() {
    if (!modellSel) return;
    const selected = Array.from(modellSel.selectedOptions || []).map(o => o.value);
    if (selected.includes(ALL_MODELS_VALUE)) {
      Array.from(modellSel.options).forEach(o => o.selected = (o.value === ALL_MODELS_VALUE));
      ssModell?.setSelected([ALL_MODELS_VALUE]);
    }
  }
  modellSel?.addEventListener("change", enforceAllModelsExclusivity);

  if (ssModell) {
    ssModell.settings.events = ssModell.settings.events || {};
    const prevAfterChange = ssModell.settings.events.afterChange;
    ssModell.settings.events.afterChange = (newSelected) => {
      const selectedBrand  = markeSel?.value;
      const selectedValues = (newSelected || []).map(s => s.value);
      if (!selectedBrand || !brandToModels[selectedBrand]) return;

      if (selectedValues.includes(ALL_MODELS_VALUE)) {
        ssModell.setSelected([ALL_MODELS_VALUE]);
        return;
      }

      const allValuesToSelect = new Set();
      const allow = ALLOW_GROUPS_FOR[selectedBrand];

      selectedValues.forEach(val => {
        const isGroup = !!modelGroups[val];
        if (isGroup && allow && allow.includes(val)) {
          const rx = modelGroups[val];
          brandToModels[selectedBrand].forEach(model => {
            const cleaned = sanitizeModelList([model])[0];
            if (!cleaned) return;
            if (/\(alle\)/i.test(cleaned)) return;
            if (rx.test(cleaned)) allValuesToSelect.add(cleaned);
          });
        } else {
          allValuesToSelect.add(val);
        }
      });

      if (!allValuesToSelect.size) {
        ssModell.setSelected([ALL_MODELS_VALUE]);
      } else {
        ssModell.setSelected([...allValuesToSelect]);
      }

      if (typeof prevAfterChange === "function") prevAfterChange(newSelected);
    };
  }

  (async () => {
    await loadBrandModelMap();
    if (markeSel && markeSel.value) {
      rebuildModelOptions(markeSel.value);
    }
    markeSel?.addEventListener("change", () => rebuildModelOptions(markeSel.value));
  })();

  // ============================
  // Custom-Felder togglen (km/price/distance)
  // ============================
  function bindCustom(selectEl, inputEl) {
    if (!selectEl || !inputEl) return;
    const toggle = () => {
      const isCustom = selectEl.value === "custom";
      inputEl.style.display = isCustom ? "block" : "none";
      if (!isCustom) inputEl.value = "";
      if (isCustom) inputEl.focus();
    };
    selectEl.addEventListener("change", toggle);
    toggle();
  }
  bindCustom(kmSel,    kmCustom);
  bindCustom(priceSel, priceCustom);
  bindCustom(distSel,  distCustom);
  // Wichtig: Verbrauch hat einen Wrapper – separate Logik unten!

  // --- Verbrauch-Custom richtig ein-/ausblenden (Wrapper!) ---
  const consWrap = document.getElementById('verbrauch-custom-wrap');
  function toggleConsumption() {
    const isCustom = consSel?.value === 'custom';
    if (consWrap) consWrap.style.display = isCustom ? '' : 'none';
    if (!isCustom && consCustom) consCustom.value = '';
  }
  consSel?.addEventListener('change', toggleConsumption);
  toggleConsumption();

  // Umkreis nur aktiv, wenn Ort/PLZ gesetzt (Startseiten-Variante)
  function syncDistanceEnabled() {
    if (!distSel) return;
    const hasLoc = !!(locInput && locInput.value.trim());
    distSel.disabled = !hasLoc;
    if (!hasLoc && distCustom) {
      distSel.value = "999";   // "Beliebig"
      distCustom.value = "";
      distCustom.style.display = "none";
    }
  }
  locInput?.addEventListener("input", syncDistanceEnabled);
  locInput?.addEventListener("change", syncDistanceEnabled);
  syncDistanceEnabled();

  // ============================
  // Ortsvorschläge – eigene Dropdown-Liste (Startseite/Kriterienseite)
  // ============================
  if (locInput) {
    const wrapper = locInput.closest(".input-icon-wrapper") || locInput.parentElement || document.body;
    if (getComputedStyle(wrapper).position === "static") wrapper.style.position = "relative";

    const box = document.createElement("div");
    box.className = "loc-suggest-box hidden";
    wrapper.appendChild(box);

    const debounce = (fn, delay = 120) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; };
    const escapeReg = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let geoAbort = null;
    let items = [];
    let activeIndex = -1;

    function hideBox() { box.classList.add("hidden"); box.innerHTML = ""; items = []; activeIndex = -1; }
    function setActive(i) {
      const rows = box.querySelectorAll(".loc-suggest-item");
      rows.forEach((el, idx) => el.classList.toggle("active", idx === i));
      activeIndex = i;
    }
    function pick(i) {
      const it = items[i];
      if (!it) return;
      const base = (it.postcode && it.city) ? `${it.postcode} ${it.city}` : (it.city || it.postcode || it.label || "");
      const value = it.state ? `${base}, ${it.state}` : base;
      locInput.value = value;
      hideBox();
      locInput.dispatchEvent(new Event("input", { bubbles: true }));
      locInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function render(list, q) {
      if (!list.length) { hideBox(); return; }
      const rx = new RegExp(`^(${escapeReg(q)})`, "i");
      box.innerHTML = list.map((s, i) => {
        const base = (s.postcode && s.city) ? `${s.postcode} ${s.city}` : (s.city || s.postcode || s.label || "");
        const show = s.state ? `${base}, ${s.state}` : base;
        const hl = show.replace(rx, "<strong>$1</strong>");
        return `<div class="loc-suggest-item" data-idx="${i}" tabindex="-1">${hl}</div>`;
      }).join("");
      box.classList.remove("hidden");
      box.querySelectorAll(".loc-suggest-item").forEach(el => {
        el.addEventListener("mousedown", (e) => { e.preventDefault(); pick(parseInt(el.dataset.idx, 10)); });
      });
      setActive(-1);
    }
    async function querySuggestions(q) {
      const term = String(q || "").trim();
      if (term.length < 2) { hideBox(); return; }
      if (geoAbort) geoAbort.abort();
      geoAbort = new AbortController();
      try {
        const limit = term.length <= 3 ? 15 : 8;
        const r = await fetch(`/api/geosuggest?q=${encodeURIComponent(term)}&limit=${limit}`, {
          credentials: "omit",
          signal: geoAbort.signal
        });
        if (!r.ok) { hideBox(); return; }
        const { suggestions = [] } = await r.json();
        items = suggestions;
        render(items, term);
      } catch (err) {
        if (err?.name !== "AbortError") hideBox();
      }
    }
    const debouncedSuggest = debounce(() => querySuggestions(locInput.value), 120);
    locInput.addEventListener("input", debouncedSuggest);
    locInput.addEventListener("focus", debouncedSuggest);
    locInput.addEventListener("keydown", (e) => {
      if (box.classList.contains("hidden")) return;
      const max = items.length - 1;
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeIndex < max ? activeIndex + 1 : 0); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIndex > 0 ? activeIndex - 1 : max); }
      else if (e.key === "Enter") { if (activeIndex >= 0) { e.preventDefault(); pick(activeIndex); } }
      else if (e.key === "Escape") { hideBox(); }
    });
    document.addEventListener("click", (e) => { if (!wrapper.contains(e.target)) hideBox(); });
  }

  // ============================
  // Query-Params bauen
  // ============================
  function mapSortToServer(val) {
    if (val === "price-asc")  return "preis_asc";
    if (val === "price-desc") return "preis_desc";
    if (val === "date-desc")  return "neueste";
    return "";
  }

  function buildQueryParams() {
    const qs = new URLSearchParams();

    const brand = markeSel?.value || "";
    if (brand) qs.set("marke", brand);

    if (modellSel) {
      const models = Array.from(modellSel.selectedOptions || []).map(o => o.value);
      if (models.length && !models.includes("__ALL_MODELS__")) {
        qs.set("modell", models.filter(Boolean).join(","));
      }
    }

    // Startseite: Jahr/Monat -> ezFrom
    const y = yearSel?.value || "";
    const m = monthSel?.value || "";
    if (y && m) qs.set("ezFrom", `${y}-${String(m).padStart(2, "0")}`);

    // Suchkriterien-Seite: von/bis (überschreibt ggf. Startseitenwert)
    const ezFromAltVal = ezVonAlt?.value || "";
    const ezToAltVal   = ezBisAlt?.value || "";
    if (ezFromAltVal) qs.set("ezFrom", ezFromAltVal);
    if (ezToAltVal)   qs.set("ezTo",   ezToAltVal);

    // Startseite km_max (Select + Custom)
    if (kmSel) {
      const raw = kmSel.value === "custom" ? (kmCustom?.value || "") : kmSel.value;
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n > 0) qs.set("km_max", String(n));
    }
    // Kriterien-Seite km-bis überschreibt ggf.
    const kmBisEl    = document.getElementById("km-bis");
    const kmBis      = parseInt(kmBisEl?.value || "", 10);
    if (!Number.isNaN(kmBis) && kmBis > 0) qs.set("km_max", String(kmBis));

    // Verbrauch (max) – Komma/Punkt tolerant
    if (consSel || consCustom) {
      const raw = consSel
        ? (consSel.value === 'custom' ? (consCustom?.value || '') : consSel.value)
        : (consCustom?.value || '');
      const n = parseFloat(String(raw).replace(',', '.'));
      if (Number.isFinite(n) && n > 0) {
        qs.set('verbrauch_max', String(n));
      }
    }

    // Startseite price_max (Select + Custom)
    if (priceSel) {
      const raw = priceSel.value === "custom" ? (priceCustom?.value || "") : priceSel.value;
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n > 0) qs.set("price_max", String(n));
    }
    // Kriterien-Seite preis-bis überschreibt ggf.
    const preisBisEl = document.getElementById("preis-bis");
    const preisBis   = parseInt(preisBisEl?.value || "", 10);
    if (!Number.isNaN(preisBis) && preisBis > 0) qs.set("price_max", String(preisBis));

    // Getriebe/Kraftstoff (Startseite Select)
    const gear = (gearSel?.value || "").toLowerCase().trim();
    if (gear && !["beliebig","any","alle","all","-"].includes(gear)) qs.set("getriebe", gear);

    const fuel = (fuelSel?.value || "").toLowerCase().trim();
    if (fuel && !["beliebig","any","alle","all","-"].includes(fuel)) qs.set("kraftstoff", fuel);

    // Kriterien-Seite: Getriebe als Checkboxen (wenn genau eine gewählt)
    const getriebeCbs = document.querySelectorAll('.search-group label input[type="checkbox"][value="Automatik"], .search-group label input[type="checkbox"][value="Schaltgetriebe"]');
    if (getriebeCbs.length) {
      const checked = [...getriebeCbs].filter(cb => cb.checked).map(cb => cb.value.toLowerCase());
      if (checked.length === 1) {
        const map = { "automatik": "automatik", "schaltgetriebe": "schalt" };
        qs.set("getriebe", map[checked[0]] || checked[0]);
      }
    }

    // Kriterien-Seite: Kraftstoff als Checkboxen (wenn genau eine gewählt)
    const fuelCbs = document.querySelectorAll('.fuel-type-grid input[type="checkbox"]');
    if (fuelCbs.length) {
      const checkedFuel = [...fuelCbs].filter(cb => cb.checked).map(cb => cb.value.toLowerCase());
      if (checkedFuel.length === 1) {
        qs.set("kraftstoff", checkedFuel[0]);
      }
    }

    // Ort
    const loc = (locInput?.value || "").trim();
    if (loc) qs.set("ort", loc);

    // Umkreis: Kriterien-Seite zuerst, sonst Startseite
    if (umkreisSel) {
      const raw = umkreisSel.value === 'custom' ? (umkreisCustom?.value || '') : umkreisSel.value;
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n > 0) qs.set('umkreis', String(n));
      else qs.delete('umkreis');
    } else if (distSel && !distSel.disabled) {
      const dRaw = distSel.value === "custom" ? (distCustom?.value || "") : distSel.value;
      const d = parseInt(dRaw, 10);
      if (!Number.isNaN(d) && d > 0 && d !== 999) qs.set("umkreis", String(d));
      else qs.delete("umkreis");
    }

    if (sortSel && sortSel.value) {
      const mapped = mapSortToServer(sortSel.value);
      if (mapped) qs.set("sort", mapped);
    }

    // Features
    if (pfEl?.checked) qs.set("partikelfilter", "mit");
    if (shEl?.checked) qs.set("scheckheft", "ja");
    if (ftEl?.checked) qs.set("fahrtauglich", "ja");

    qs.delete("page");
    return qs;
  }

  // Submit → suche.html (nur wenn ein Formular existiert, z. B. auf der Startseite)
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const qs = buildQueryParams();
      window.location.href = `suche.html?${qs.toString()}`;
    });

    // „Weitere Filter“ → Suchkriterien.html
    advancedBtn?.addEventListener("click", () => {
      const qs = buildQueryParams();
      window.location.href = `suchkriterien.html?${qs.toString()}`;
    });
  }

// Button „Fahrzeuge anzeigen“ nur auf Seiten ohne erweitertes Formular binden
// (die Kriterien-Seite hat #modellausfuehrung)
const btnSearch = document.getElementById("btn-search");
if (btnSearch && !document.getElementById("modellausfuehrung")) {
  btnSearch.addEventListener("click", () => {
    const qs = buildQueryParams();
    window.location.href = `suche.html?${qs.toString()}`;
  });
}

});
