document.addEventListener("DOMContentLoaded", () => {
  // Startseite: Formular existiert in #search-section .search-form
  const form = document.querySelector("#search-section .search-form");

  // Helper: wurde bereits von SlimSelect umgebaut?
  const isSlimmed = (el) =>
    !!(el && el.nextElementSibling && el.nextElementSibling.classList.contains("ss-main"));

  // HTML5-Validierung nur deaktivieren, wenn es das Formular gibt
  if (form) {
    form.noValidate = true;
    [
      "marke",
      "modell",
      "kilometer-select",
      "price-select",
      "distance-select",
      "gear",
      "transmission",
      "fuel",
      "fuelType",
    ].forEach((id) => document.getElementById(id)?.removeAttribute("required"));
  }

  // ---- Refs (alles optional, je nach Seite vorhanden)
  const markeSel = document.getElementById("marke");
  const modellSel = document.getElementById("modell");
  const monthSel = document.getElementById("first-registration-month"); // Startseite
  const yearSel = document.getElementById("first-registration-year"); // Startseite

  // Suchkriterien-Seite: <input type="month"> von/bis
  const ezVonAlt = document.getElementById("ez-von");
  const ezBisAlt = document.getElementById("ez-bis");

  const kmSel = document.getElementById("kilometer-select");
  const kmCustom = document.getElementById("kilometer-custom");
  const priceSel = document.getElementById("price-select");
  const priceCustom = document.getElementById("price-custom");

  const gearSel = document.getElementById("gear") || document.getElementById("transmission");
  const fuelSel = document.getElementById("fuel") || document.getElementById("fuelType");

  // Startseite ODER Suchkriterien-Seite (location vs. ort)
  const locInput = document.getElementById("location") || document.getElementById("ort");

  // Startseite (distance-select) – Kriterien-Seite hat 'umkreis'
  const distSel = document.getElementById("distance-select");
  const distCustom = document.getElementById("distance-custom");

  const sortSel = document.getElementById("sortBy") || document.getElementById("sort");
  const advancedBtn = form?.querySelector(".btn-advanced");

  // Verbrauch (Komb.): Fallback-Input-ID für Suchkriterien-Seite ist "verbrauch"
  const consSel = document.getElementById("verbrauch-select");
  const consCustom = document.getElementById("verbrauch-custom") || document.getElementById("verbrauch");

  // Feature-Checkboxen auf Suchkriterien-Seite
  const pfEl = document.getElementById("partikelfilter");
  const shEl = document.getElementById("scheckheft");
  const ftEl = document.getElementById("fahrtauglich");

  // Suchkriterien-Seite: eigener Umkreis
  const umkreisSel = document.getElementById("umkreis");
  const umkreisCustom = document.getElementById("custom-umkreis");

  // ============================
  // Konstanten / State
  // ============================
  const ANY_BRAND_VALUE = "__ANY__";
  const ALL_MODELS_VALUE = "__ALL__";
  
  const FILTER_OUT_BELIEBIG_IN_JSON = true;

  let brandToModels = {};
  let ssMarke = null;
  let ssModell = null;
  let modelSyncGuard = false;

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
    Bentley: ["Continental (Alle)"],
    BMW: [
      "1er Reihe (Alle)",
      "2er Reihe (Alle)",
      "3er Reihe (Alle)",
      "4er Reihe (Alle)",
      "5er Reihe (Alle)",
      "6er Reihe (Alle)",
      "7er Reihe (Alle)",
      "M-Modelle (Alle)",
      "X-Reihe (Alle)",
      "Z-Reihe (Alle)",
    ],
    DFSK: ["Fengon (Alle)"],
    Ford: ["Tourneo (Alle)", "Tourneo (alle)", "Transit (Alle)"],
    Lexus: [
      "ES-Serie (Alle)",
      "GS-Serie (Alle)",
      "GX Series (Alle)",
      "IS-Serie (Alle)",
      "LS-Serie (Alle)",
      "LX-Serie (Alle)",
      "NX-Serie (Alle)",
      "RC-Serie (Alle)",
      "RX-Serie (Alle)",
    ],
    "Mercedes-Benz": [
      "A-Klasse (Alle)",
      "B-Klasse (Alle)",
      "C-Klasse (Alle)",
      "CE-Klasse (Alle)",
      "CLA-Klasse (Alle)",
      "CLC-Klasse (Alle)",
      "CLE-Klasse (Alle)",
      "CLK-Klasse (Alle)",
      "CL-Klasse (Alle)",
      "CLS-Klasse (Alle)",
      "E-Klasse (Alle)",
      "G-Klasse (Alle)",
      "GLA-Klasse (Alle)",
      "GLB-Klasse (Alle)",
      "GLC-Klasse (Alle)",
      "GLE-Klasse (Alle)",
      "GLK-Klasse (Alle)",
      "GL-Klasse (Alle)",
      "GLS-Klasse (Alle)",
      "GT-Klasse (Alle)",
      "ML-Klasse (Alle)",
      "R-Klasse (Alle)",
      "S-Klasse (Alle)",
      "SLC-Klasse (Alle)",
      "SLK-Klasse (Alle)",
      "SL-Klasse (Alle)",
      "V-Klasse (Alle)",
      "X-Klasse (Alle)",
    ],
    MINI: [
      "Cabrio Serie (Alle)",
      "Clubman Serie (Alle)",
      "Countryman Serie (Alle)",
      "Coupe Serie (Alle)",
      "MINI (Alle)",
      "Paceman Serie (Alle)",
      "Roadster Serie (Alle)",
    ],
    Porsche: ["911er Reihe (Alle)"],
    Volkswagen: ["Golf (Alle)", "Passat (Alle)", "Passat (alle)", "T3 (Alle)", "T4 (Alle)", "T5 (Alle)", "T6 (Alle)"],
  };

  function sanitizeModelList(listRaw = []) {
    const seen = new Set();
    const out = [];
    for (const raw of listRaw) {
      if (raw == null) continue;
      const name = String(raw).trim();
      if (!name) continue;
  
      if (FILTER_OUT_BELIEBIG_IN_JSON && /^beliebig$/i.test(name)) continue;
      if (/\(alle\)\s*$/i.test(name)) continue; // <- NEU
  
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
    const idxAndere = out.findIndex((v) => /^andere$/i.test(v));
    if (idxAndere >= 0 && idxAndere !== out.length - 1) {
      const [andere] = out.splice(idxAndere, 1);
      out.push(andere);
    }
    return out;
  }
  

  async function loadBrandModelMap() {
    try {
      const r = await fetch("/data/marken-modelle.json", { credentials: "omit" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      brandToModels = data && typeof data === "object" ? data : {};
    } catch (e) {
      console.warn("marken-modelle.json konnte nicht geladen werden – Fallback aktiv.", e);
      brandToModels = {
        Audi: ["A1", "A3", "A4", "A6", "Q2", "Q3", "Q5", "Q7", "TT", "e-tron", "Andere"],
        BMW: ["1er", "2er", "3er", "4er", "5er", "7er", "X1", "X3", "X5", "i3", "Andere"],
        "Mercedes-Benz": ["A-Klasse", "B-Klasse", "C-Klasse", "E-Klasse", "S-Klasse", "GLA", "GLC", "GLE", "Andere"],
        Volkswagen: ["up!", "Polo", "Golf", "T-Roc", "Tiguan", "Passat", "Touran", "ID.3", "ID.4", "Andere"],
      };
    }
  }

  function setModelEnabled(enabled) {
    if (!modellSel) return;

    modellSel.disabled = !enabled;

    if (!enabled) {
      modellSel.innerHTML = `<option value="${ALL_MODELS_VALUE}" selected>Beliebig</option>`;
      modellSel.value = ALL_MODELS_VALUE;
    }
    

    const ssMain = modellSel.nextElementSibling;
    if (ssMain && ssMain.classList && ssMain.classList.contains("ss-main")) {
      ssMain.classList.toggle("is-disabled", !enabled);
      ssMain.setAttribute("aria-disabled", enabled ? "false" : "true");
    }
  }

  function setSelectedNative(values) {
    if (!modellSel) return;
    const set = new Set((values || []).map(String));
    Array.from(modellSel.options).forEach((opt) => {
      opt.selected = set.has(opt.value);
    });
    // falls single-select: genau ein selected
    if (!modellSel.multiple) {
      const first = values && values.length ? String(values[0]) : ALL_MODELS_VALUE;
      modellSel.value = first;
    }
  }

  function setSelectedSlim(values) {
    if (!ssModell) return;
    try {
      // SlimSelect v2: setSelected(values, triggerChange=true)
      ssModell.setSelected(values, false);
    } catch (_) {
      // Fallback (manche Versionen haben kein 2. Argument)
      try {
        modelSyncGuard = true;
        ssModell.setSelected(values);
      } finally {
        modelSyncGuard = false;
      }
    }
  }

  function rebuildModelOptions(brand) {
    if (!modellSel) return;

    const rawList = (brandToModels && brandToModels[brand]) || [];
    let models = sanitizeModelList(rawList);

    const groups = (ALLOW_GROUPS_FOR[brand] || []).slice();

    // Gruppen aus der Modellliste rausfiltern, falls sie im JSON auftauchen
    const groupSet = new Set(groups.map((g) => g.toLowerCase()));
    models = models.filter((m) => !groupSet.has(String(m).toLowerCase()));

    const data = [
      { text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE },
      ...groups.map((g) => ({ text: g, value: g })),
      ...models.map((m) => ({ text: m, value: m })),
    ];

    if (ssModell) {
      ssModell.setData(data);
      setSelectedSlim([ALL_MODELS_VALUE]);
      setSelectedNative([ALL_MODELS_VALUE]);
    } else {
      modellSel.innerHTML = "";
      data.forEach(({ text, value }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text;
        modellSel.appendChild(opt);
      });
      setSelectedNative([ALL_MODELS_VALUE]);
    }
  }

  function getCurrentModelValuesFromSlim(newSelected) {
    // newSelected kommt von SlimSelect: [{value,text}, ...]
    if (Array.isArray(newSelected) && newSelected.length) return newSelected.map((s) => String(s.value));
    // fallback: native select
    if (!modellSel) return [];
    return Array.from(modellSel.selectedOptions || []).map((o) => String(o.value));
  }

  function expandGroups(brand, values) {
    const allowGroups = ALLOW_GROUPS_FOR[brand] || [];
    const rxTargets = sanitizeModelList((brandToModels && brandToModels[brand]) || []);

    const out = new Set();
    for (const valRaw of values) {
      const val = String(valRaw);

      // "Beliebig" / ALL exklusiv
      if (val === ALL_MODELS_VALUE || /^beliebig$/i.test(val)) {
        return [ALL_MODELS_VALUE];
      }

      const rx = modelGroups[val];
      if (rx && allowGroups.includes(val)) {
        rxTargets.forEach((m) => {
          const cleaned = String(m || "").trim();
          if (!cleaned) return;
          if (/\(alle\)/i.test(cleaned)) return;
          if (rx.test(cleaned)) out.add(cleaned);
        });
      } else {
        out.add(val);
      }
    }

    if (!out.size) return [ALL_MODELS_VALUE];
    return Array.from(out);
  }

  // ============================
  // SlimSelect init (wenn vorhanden)
  // ============================
  if (window.SlimSelect) {
    if (markeSel && !isSlimmed(markeSel)) {
      ssMarke = new SlimSelect({
        select: "#marke",
        placeholder: "Marke wählen",
        allowDeselect: true,
        showSearch: true,
      });
    }

    if (modellSel && !isSlimmed(modellSel)) {
      ssModell = new SlimSelect({
        select: "#modell",
        placeholder: "Modell(e) wählen",
        closeOnSelect: false,
        showSearch: true,
        events: {
          afterChange: (newSelected) => {
            if (modelSyncGuard) return;
            if (!markeSel || !modellSel) return;
            const brand = String(markeSel.value || "").trim();
            if (!brand || brand === ANY_BRAND_VALUE) {
              setSelectedSlim([ALL_MODELS_VALUE]);
              setSelectedNative([ALL_MODELS_VALUE]);
              return;
            }
            

            // Wenn Map noch nicht da ist, einfach nicht expandieren – aber "Beliebig" sauber halten
            const current = getCurrentModelValuesFromSlim(newSelected);
            if (current.includes(ALL_MODELS_VALUE)) {
              modelSyncGuard = true;
              setSelectedSlim([ALL_MODELS_VALUE]);
              setSelectedNative([ALL_MODELS_VALUE]);
              modelSyncGuard = false;
              return;
            }

            if (!brandToModels[brand]) {
              // nur native syncen
              setSelectedNative(current.length ? current : [ALL_MODELS_VALUE]);
              return;
            }

            const expanded = expandGroups(brand, current);

            modelSyncGuard = true;
            setSelectedSlim(expanded);
            setSelectedNative(expanded);
            modelSyncGuard = false;
          },
        },
      });
    }
  }

  // ============================
  // Marken/Modelle dynamisch (wenn Selects existieren)
  // ============================
  if (markeSel && modellSel) {
    (async () => {
      await loadBrandModelMap();

      // initial state
      const initialBrand = String(markeSel.value || "").trim();
      if (initialBrand && initialBrand !== ANY_BRAND_VALUE) {
        setModelEnabled(true);
        rebuildModelOptions(initialBrand);
      } else {
        setModelEnabled(false);
        // optional: wenn SlimSelect aktiv ist, Data setzen:
        if (ssModell) {
          modelSyncGuard = true;
          ssModell.setData([{ text: "Beliebig", value: ALL_MODELS_VALUE }]);
          setSelectedSlim([ALL_MODELS_VALUE]);
          setSelectedNative([ALL_MODELS_VALUE]);
          modelSyncGuard = false;
        }
      }
      

      markeSel.addEventListener("change", () => {
        const brand = String(markeSel.value || "").trim();
        if (!brand || brand === ANY_BRAND_VALUE) {
          setModelEnabled(false);
          if (ssModell) {
            modelSyncGuard = true;
            ssModell.setData([{ text: "Beliebig", value: ALL_MODELS_VALUE }]);
            setSelectedSlim([ALL_MODELS_VALUE]);
            setSelectedNative([ALL_MODELS_VALUE]);
            modelSyncGuard = false;
          }
          return;
        }
        

        setModelEnabled(true);
        rebuildModelOptions(brand);
      });

      // native exclusivity (falls kein SlimSelect oder als zusätzliche Sicherheit)
      modellSel.addEventListener("change", () => {
        const selected = Array.from(modellSel.selectedOptions || []).map((o) => o.value);
        if (selected.includes(ALL_MODELS_VALUE)) {
          setSelectedNative([ALL_MODELS_VALUE]);
          setSelectedSlim([ALL_MODELS_VALUE]);
        }
      });
    })();
  }

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

  bindCustom(kmSel, kmCustom);
  bindCustom(priceSel, priceCustom);
  bindCustom(distSel, distCustom);

  // --- Verbrauch-Custom (Wrapper) ---
  const consWrap = document.getElementById("verbrauch-custom-wrap");
  function toggleConsumption() {
    const isCustom = consSel?.value === "custom";
    if (consWrap) consWrap.style.display = isCustom ? "" : "none";
    if (!isCustom && consCustom) consCustom.value = "";
  }
  consSel?.addEventListener("change", toggleConsumption);
  toggleConsumption();

  // Umkreis nur aktiv, wenn Ort/PLZ gesetzt (Startseiten-Variante)
  function syncDistanceEnabled() {
    if (!distSel) return;
    const hasLoc = !!(locInput && locInput.value.trim());
    distSel.disabled = !hasLoc;

    if (!hasLoc && distCustom) {
      distSel.value = "999"; // "Beliebig"
      distCustom.value = "";
      distCustom.style.display = "none";
    }
  }
  locInput?.addEventListener("input", syncDistanceEnabled);
  locInput?.addEventListener("change", syncDistanceEnabled);
  syncDistanceEnabled();

  // ============================
  // Ortsvorschläge (lokal -> /api/geosuggest fallback)
  // ============================
  if (locInput) {
    const wrapper = locInput.closest(".input-icon-wrapper") || locInput.parentElement || document.body;

    if (getComputedStyle(wrapper).position === "static") {
      wrapper.style.position = "relative";
    }

    const box = document.createElement("div");
    box.className = "loc-suggest-box hidden";
    wrapper.appendChild(box);

    const debounce = (fn, delay = 150) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
      };
    };

    const escapeReg = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let items = [];
    let activeIndex = -1;
    let geoAbort = null;
    let lastPreferCity = false;

    let plzIndex = [];
    let plzLoaded = false;
    let plzLoading = false;

    async function ensurePlzIndex() {
      if (plzLoaded || plzLoading) return;
      plzLoading = true;
      try {
        const r = await fetch("/data/plz-de.json", { credentials: "omit" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();

        plzIndex = Array.isArray(data)
          ? data.map((row) => {
              const postcode = String(row.postcode || row.plz || "").trim();
              const city = String(row.city || row.ort || "").trim();
              const state = String(row.state || row.bundesland || "").trim();
              const country = String(row.country || "DE").trim();

              const base = [postcode, city].filter(Boolean).join(" ");
              const label = state ? `${base}, ${state}` : base;

              return { postcode, city, state, country, label };
            })
          : [];

        plzLoaded = true;
      } catch (e) {
        console.warn("plz-de.json konnte nicht geladen werden – Fallback auf /api/geosuggest.", e);
      } finally {
        plzLoading = false;
      }
    }

    function hideBox() {
      box.classList.add("hidden");
      box.innerHTML = "";
      items = [];
      activeIndex = -1;
    }

    function setActive(i) {
      const rows = box.querySelectorAll(".loc-suggest-item");
      rows.forEach((el, idx) => el.classList.toggle("active", idx === i));
      activeIndex = i;
    }

    function normalizeCityFromLabel(label = "") {
      return String(label || "").replace(/^\s*\d{4,5}\s+/, "").trim();
    }

    function formatDisplay(it, preferCity) {
      const postcode = it.postcode || it.plz || "";
      const city = it.city || it.ort || "";
      const state = it.state || it.bundesland || "";

      let base = "";
      if (preferCity) {
        const fallback = normalizeCityFromLabel(it.label || it.value || "");
        base = city || fallback || it.label || it.value || "";
      } else {
        base = postcode && city ? `${postcode} ${city}` : city || postcode || it.label || it.value || "";
      }

      return state && base ? `${base}, ${state}` : base;
    }

    function pick(i) {
      const it = items[i];
      if (!it) return;

      const preferCity = lastPreferCity || !/\d/.test(locInput.value);
      const value = formatDisplay(it, preferCity);
      locInput.value = value;
      hideBox();

      locInput.dispatchEvent(new Event("input", { bubbles: true }));
      locInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function render(list, q, preferCity) {
      if (!list.length) {
        hideBox();
        return;
      }

      const rx = new RegExp("(" + escapeReg(q) + ")", "i");

      box.innerHTML = list
        .map((s, i) => {
          const show = formatDisplay(s, preferCity);

          const labelHtml = show.replace(rx, '<span class="loc-suggest-highlight">$1</span>');
          return `<div class="loc-suggest-item" data-idx="${i}">${labelHtml}</div>`;
        })
        .join("");

      box.classList.remove("hidden");

      box.querySelectorAll(".loc-suggest-item").forEach((el) => {
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const idx = parseInt(el.dataset.idx, 10);
          if (!Number.isNaN(idx)) pick(idx);
        });
      });

      setActive(-1);
    }

    function searchLocal(term, preferCity) {
      if (!plzLoaded || !Array.isArray(plzIndex) || !plzIndex.length) return [];
      const t = term.toLowerCase();
      const MAX = 20;
      const out = [];
      const seen = new Set();

      for (let i = 0; i < plzIndex.length; i++) {
        const it = plzIndex[i];
        const city = String(it.city || it.ort || "").toLowerCase();
        const plz = String(it.postcode || it.plz || "").toLowerCase();

        const combo = plz && city ? `${plz} ${city}` : city || plz;
        if (!combo) continue;

        if (combo.startsWith(t) || city.startsWith(t) || plz.startsWith(t)) {
          if (preferCity) {
            const state = String(it.state || it.bundesland || "").toLowerCase();
            const key = `${city}|${state}`;
            if (key && seen.has(key)) continue;
            if (key) seen.add(key);
          }
          out.push(it);
          if (out.length >= MAX) break;
        }
      }
      return out;
    }

    async function querySuggestions(q) {
      const term = String(q || "").trim();
      if (term.length < 2) {
        hideBox();
        return;
      }

      const preferCity = !/\d/.test(term);
      lastPreferCity = preferCity;

      await ensurePlzIndex();
      if (plzLoaded && plzIndex.length) {
        const local = searchLocal(term, preferCity);
        if (local.length) {
          items = local;
          render(items, term, preferCity);
          return;
        }
      }

      if (geoAbort) geoAbort.abort();
      geoAbort = new AbortController();

      try {
        const limit = term.length <= 3 ? 15 : 8;
        const r = await fetch(`/api/geosuggest?q=${encodeURIComponent(term)}&limit=${limit}`, {
          credentials: "omit",
          signal: geoAbort.signal,
        });

        if (!r.ok) {
          hideBox();
          return;
        }

        const { suggestions = [] } = await r.json();
        const raw = Array.isArray(suggestions) ? suggestions : [];
        if (preferCity) {
          const seen = new Set();
          items = raw.filter((it) => {
            const cityRaw = String(it.city || it.ort || "").trim();
            const city = cityRaw || normalizeCityFromLabel(it.label || it.value || "");
            const cityKey = String(city || "").toLowerCase();
            const state = String(it.state || it.bundesland || "").toLowerCase();
            const key = `${cityKey}|${state}`;
            if (!cityKey) return false;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        } else {
          items = raw;
        }
        render(items, term, preferCity);
      } catch (err) {
        if (err?.name !== "AbortError") hideBox();
      }
    }

    const debouncedSuggest = debounce(() => querySuggestions(locInput.value), 150);

    locInput.addEventListener("input", debouncedSuggest);
    locInput.addEventListener("focus", debouncedSuggest);

    locInput.addEventListener("keydown", (e) => {
      if (box.classList.contains("hidden")) return;
      const max = items.length - 1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(activeIndex < max ? activeIndex + 1 : 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(activeIndex > 0 ? activeIndex - 1 : max);
      } else if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault();
          pick(activeIndex);
        }
      } else if (e.key === "Escape") {
        hideBox();
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) hideBox();
    });
  }

  // ============================
  // Query-Params bauen
  // ============================
  function mapSortToServer(val) {
    if (val === "price-asc") return "preis_asc";
    if (val === "price-desc") return "preis_desc";
    if (val === "mileage-asc") return "km_asc";
    if (val === "mileage-desc") return "km_desc";
    if (val === "ez-desc") return "ez_desc";
    if (val === "ez-asc") return "ez_asc";
    if (val === "default" || val === "date-desc") return "neueste";
    return "";
  }
  function normalizeGear(val) {
    const g = String(val || "").toLowerCase().trim();
    if (!g || ["beliebig", "any", "alle", "all", "-"].includes(g)) return "";
    if (g === "manuell" || g === "manual" || g === "schaltgetriebe" || g === "schalt") return "schalt";
    if (g.includes("auto")) return "automatik";
    return g;
  }
  
  function normalizeFuel(val) {
    let f = String(val || "").toLowerCase().trim();
    if (!f || ["beliebig", "any", "alle", "all", "-"].includes(f)) return "";
  
    // alte Schreibweisen abfangen
    f = f.replace(/_/g, "-");           // hybrid_benzin -> hybrid-benzin
   
    if (f === "gas" || f === "lpg") f = "autogas";
    if (f === "e85") f = "ethanol";
  
    // NICHT mehr auf "hybrid" zusammenfassen!
    // hybrid-benzin und hybrid-diesel bleiben getrennt.
  
    return f;
  }
  
  function buildQueryParams() {
    const qs = new URLSearchParams();
    const toIntLoose = (v) => {
      const s = String(v ?? "").replace(/[^\d]/g, "");
      return s ? parseInt(s, 10) : NaN;
    };

    const brand = String(markeSel?.value || "").trim();
    if (brand && brand !== ANY_BRAND_VALUE) qs.set("marke", brand);
    

    if (modellSel) {
      const brand = String(markeSel?.value || "").trim();
      const raw = Array.from(modellSel.selectedOptions || []).map((o) => String(o.value));
    
      // Beliebig → kein "modell" Param
      if (raw.includes(ALL_MODELS_VALUE) || !raw.length) {
        // nichts setzen
      } else {
        // Gruppen expandieren (z.B. "1er Reihe (Alle)" → 114,116,118,...)
        const expanded =
          brand && brand !== ANY_BRAND_VALUE
            ? expandGroups(brand, raw)
            : raw;
    
        // Expand kann Beliebig zurückgeben, falls nichts passt
        const cleaned = expanded
          .map(String)
          .filter((v) => v && v !== ALL_MODELS_VALUE)
          .filter((v) => !/\(alle\)\s*$/i.test(v)) // absolute Sicherheit
          .filter((v) => !(modelGroups[v] && (ALLOW_GROUPS_FOR[brand] || []).includes(v))); // Gruppenwert nie senden
    
        if (cleaned.length) qs.set("modell", cleaned.join(","));
      }
    }
    

// Startseite: Jahr/Monat -> ezFrom
// Wenn nur Jahr gewählt ist, default Monat = 01 (Januar)
const y = String(yearSel?.value || "").trim();
const m = String(monthSel?.value || "").trim();

if (y) {
  const mm = String(m || "01").padStart(2, "0");
  qs.set("ezFrom", `${y}-${mm}`);
}


    // Suchkriterien-Seite: von/bis überschreibt ggf.
    const ezFromAltVal = ezVonAlt?.value || "";
    const ezToAltVal = ezBisAlt?.value || "";
    if (ezFromAltVal) qs.set("ezFrom", ezFromAltVal);
    if (ezToAltVal) qs.set("ezTo", ezToAltVal);

    // Startseite km_max (Select + Custom)
    if (kmSel) {
      const raw = kmSel.value === "custom" ? kmCustom?.value || "" : kmSel.value;
      const n = toIntLoose(raw);
      if (!Number.isNaN(n) && n > 0) qs.set("km_max", String(n));
    }
    // Kriterien-Seite km-bis überschreibt ggf.
    const kmBisEl = document.getElementById("km-bis");
    const kmBis = parseInt(kmBisEl?.value || "", 10);
    if (!Number.isNaN(kmBis) && kmBis > 0) qs.set("km_max", String(kmBis));

    // Verbrauch (max) – Komma/Punkt tolerant
    if (consSel || consCustom) {
      const raw = consSel
        ? consSel.value === "custom"
          ? consCustom?.value || ""
          : consSel.value
        : consCustom?.value || "";
      const n = parseFloat(String(raw).replace(",", "."));
      if (Number.isFinite(n) && n > 0) qs.set("verbrauch_max", String(n));
    }

    // Startseite price_max (Select + Custom)
    if (priceSel) {
      const raw = priceSel.value === "custom" ? priceCustom?.value || "" : priceSel.value;
      const n = toIntLoose(raw);
      if (!Number.isNaN(n) && n > 0) qs.set("price_max", String(n));
    }
    // Kriterien-Seite preis-bis überschreibt ggf.
    const preisBisEl = document.getElementById("preis-bis");
    const preisBis = toIntLoose(preisBisEl?.value || "");
    if (!Number.isNaN(preisBis) && preisBis > 0) qs.set("price_max", String(preisBis));

 // Getriebe/Kraftstoff (Startseite Select)
const gearNorm = normalizeGear(gearSel?.value);
if (gearNorm) qs.set("getriebe", gearNorm);

const fuelNorm = normalizeFuel(fuelSel?.value);
if (fuelNorm) qs.set("kraftstoff", fuelNorm);

    // Kriterien-Seite: Getriebe Checkboxen (wenn genau eine gewählt)
    const getriebeCbs = document.querySelectorAll(
      '.search-group label input[type="checkbox"][value="Automatik"], .search-group label input[type="checkbox"][value="Schaltgetriebe"]'
    );
    if (getriebeCbs.length) {
      const checked = [...getriebeCbs].filter((cb) => cb.checked).map((cb) => cb.value.toLowerCase());
      if (checked.length === 1) {
        const map = { automatik: "automatik", schaltgetriebe: "schalt" };
        qs.set("getriebe", map[checked[0]] || checked[0]);
      }
    }
// Kriterien-Seite: Kraftstoff Checkboxen (Mehrfachauswahl als CSV)
const fuelCbs = document.querySelectorAll(".fuel-type-grid input[type='checkbox']");
if (fuelCbs.length) {
  const checkedFuel = [...fuelCbs]
    .filter((cb) => cb.checked)
    .map((cb) => normalizeFuel(cb.value))
    .filter(Boolean);

  if (checkedFuel.length) {
    qs.set("kraftstoff", checkedFuel.join(","));
  }
}


    // Ort
    const loc = (locInput?.value || "").trim();
    const hasLoc = !!loc;
    if (loc) qs.set("ort", loc);

    // Umkreis: Kriterien-Seite zuerst, sonst Startseite
    let umkreisSet = false;
    if (umkreisSel) {
      const raw = umkreisSel.value === "custom" ? umkreisCustom?.value || "" : umkreisSel.value;
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n > 0) {
        qs.set("umkreis", String(n));
        umkreisSet = true;
      } else {
        qs.delete("umkreis");
      }
    } else if (distSel && !distSel.disabled) {
      const dRaw = distSel.value === "custom" ? distCustom?.value || "" : distSel.value;
      const d = parseInt(dRaw, 10);
      if (!Number.isNaN(d) && d > 0 && d !== 999) {
        qs.set("umkreis", String(d));
        umkreisSet = true;
      } else {
        qs.delete("umkreis");
      }
    }

    // Default: wenn Ort gesetzt ist, aber kein Umkreis gewählt → 100 km
    if (hasLoc && !umkreisSet) {
      qs.set("umkreis", "100");
      if (umkreisSel) {
        umkreisSel.value = "100";
        window.toggleCustomUmkreis?.("100");
      } else if (distSel) {
        distSel.disabled = false;
        distSel.value = "100";
        if (distCustom) distCustom.value = "";
      }
    }

    if (sortSel && sortSel.value) {
      const mapped = mapSortToServer(sortSel.value);
      if (mapped) qs.set("sort", mapped);
    }

    // Features (Flags)
    if (pfEl?.checked) qs.set("partikelfilter", "1");
    if (shEl?.checked) qs.set("scheckheft", "1");
    if (ftEl?.checked) qs.set("fahrtauglich", "1");

    qs.delete("page");
    return qs;
  }

  // Submit → suche.html (nur wenn Formular existiert)
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const qs = buildQueryParams();
      window.location.href = `suche.html?${qs.toString()}`;
    });

    // „Weitere Filter“ → suchkriterien.html
    advancedBtn?.addEventListener("click", () => {
      const qs = buildQueryParams();
      window.location.href = `suchkriterien.html?${qs.toString()}`;
    });
  }

  // Button „Fahrzeuge anzeigen“ (wenn vorhanden)
  const btnSearch = document.getElementById("btn-search");
  if (btnSearch && !document.getElementById("modellausfuehrung")) {
    btnSearch.addEventListener("click", () => {
      const qs = buildQueryParams();
      window.location.href = `suche.html?${qs.toString()}`;
    });
  }
});
