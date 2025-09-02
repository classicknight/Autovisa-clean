// public/search-form.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("#search-section .search-form");
    if (!form) return;
  
    // HTML5-Validierung für die Suchbox abschalten
    form.noValidate = true;
  
    // "required" von ggf. versteckten Feldern entfernen
    ["marke","modell","kilometer-select","price-select","distance-select","gear","transmission","fuel","fuelType"]
      .forEach(id => document.getElementById(id)?.removeAttribute("required"));
  
    // === Refs ===
    const markeSel    = document.getElementById("marke");
    const modellSel   = document.getElementById("modell");
    const monthSel    = document.getElementById("first-registration-month");
    const yearSel     = document.getElementById("first-registration-year");
    const kmSel       = document.getElementById("kilometer-select");
    const kmCustom    = document.getElementById("kilometer-custom");
    const priceSel    = document.getElementById("price-select");
    const priceCustom = document.getElementById("price-custom");
    const gearSel     = document.getElementById("gear") || document.getElementById("transmission");
    const fuelSel     = document.getElementById("fuel") || document.getElementById("fuelType");
    const locInput    = document.getElementById("location");
    const distSel     = document.getElementById("distance-select");
    const distCustom  = document.getElementById("distance-custom");
    const sortSel     = document.getElementById("sortBy") || document.getElementById("sort");
  
    // === Jahre befüllen (aktuell -> 1980) ===
    if (yearSel) {
      const thisYear = new Date().getFullYear();
      for (let y = thisYear; y >= 1980; y--) {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        yearSel.appendChild(opt);
      }
    }
  
    // === Modelle pro Marke (Kurzliste) ===
    const brandToModels = {
      "Audi": ["A1","A3","A4","A6","Q2","Q3","Q5","Q7","TT","e-tron"],
      "BMW": ["1er","2er","3er","4er","5er","7er","X1","X3","X5","i3"],
      "Mercedes-Benz": ["A-Klasse","B-Klasse","C-Klasse","E-Klasse","S-Klasse","GLA","GLC","GLE"],
      "Volkswagen": ["up!","Polo","Golf","T-Roc","Tiguan","Passat","Touran","ID.3","ID.4"],
      "Opel": ["Adam","Corsa","Astra","Insignia","Mokka","Grandland"],
      "Ford": ["Ka","Fiesta","Focus","Mondeo","Kuga","Puma"],
      "Skoda": ["Fabia","Scala","Octavia","Superb","Karoq","Kodiaq"],
      "Seat": ["Ibiza","Leon","Ateca","Arona","Tarraco"],
      "Renault": ["Twingo","Clio","Megane","Captur","Kadjar","Austral"],
      "Peugeot": ["108","208","308","508","2008","3008","5008"],
      "Toyota": ["Aygo","Yaris","Corolla","C-HR","RAV4","Yaris Cross"],
      "Hyundai": ["i10","i20","i30","Kona","Tucson","Ioniq 5"],
      "Kia": ["Picanto","Rio","Ceed","XCeed","Sportage","Niro"],
      "Volvo": ["V40","V60","V90","XC40","XC60","XC90"],
      "Mazda": ["2","3","6","CX-3","CX-5","MX-5"],
      "Nissan": ["Micra","Juke","Qashqai","X-Trail","Leaf"],
      "MINI": ["Cooper","Clubman","Countryman","Cabrio"]
    };
  
    // === Slim Select (falls eingebunden) ===
    let ssMarke = null, ssModell = null;
    if (window.SlimSelect) {
      if (markeSel)   ssMarke  = new SlimSelect({ select: "#marke", placeholder: "Marke wählen" });
      if (modellSel) {
        ssModell = new SlimSelect({
          select: "#modell",
          placeholder: "Modell(e) wählen",
          closeOnSelect: false,
          showSearch: true,
        });
      }
    }
  
    function rebuildModelOptions(brand) {
      if (!modellSel) return;
      const list = brandToModels[brand] || [];
  
      modellSel.innerHTML = "";
      if (!list.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = "Keine Modellvorschläge";
        modellSel.appendChild(opt);
      } else {
        list.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m;
          modellSel.appendChild(opt);
        });
      }
  
      if (ssModell) {
        ssModell.setData(
          list.length
            ? list.map(m => ({ text: m, value: m }))
            : [{ text: "Keine Modellvorschläge", value: "", disabled: true }]
        );
        ssModell.setSelected([]);
      }
    }
  
    markeSel?.addEventListener("change", () => rebuildModelOptions(markeSel.value));
    if (markeSel && markeSel.value) rebuildModelOptions(markeSel.value);
  
    // === Custom-Felder togglen (km/price/distance) ===
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
  
    // Umkreis nur aktiv, wenn Ort/PLZ gesetzt
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
  
    /* === Ortsvorschläge – schnell: Debounce + AbortController === */
    if (locInput) {
      let suggestList = document.getElementById("location-suggest");
      if (!suggestList) {
        suggestList = document.createElement("datalist");
        suggestList.id = "location-suggest";
        document.body.appendChild(suggestList);
      }
      if (!locInput.getAttribute("list")) {
        locInput.setAttribute("list", "location-suggest");
        locInput.setAttribute("autocomplete", "off");
        locInput.setAttribute("inputmode", "search");
      }
  
      const debounce = (fn, delay = 120) => {
        let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
      };
  
      let geoAbort = null;
      async function updateLocationSuggestionsFast(q) {
        const term = String(q || "").trim();
        if (term.length < 2) { suggestList.innerHTML = ""; return; }
  
        if (geoAbort) geoAbort.abort();
        geoAbort = new AbortController();
  
        try {
          const limit = term.length <= 3 ? 15 : 8; // kurze Prefixe => mehr Treffer
          const r = await fetch(`/api/geosuggest?q=${encodeURIComponent(term)}&limit=${limit}`, {
            credentials: "omit",
            signal: geoAbort.signal
          });
          if (!r.ok) return;
  
          const { suggestions = [] } = await r.json();
          suggestList.innerHTML = suggestions.map(s => {
            const base = (s.postcode && s.city) ? `${s.postcode} ${s.city}` : (s.city || s.postcode || s.label || "");
            const show = s.state ? `${base}, ${s.state}` : base;
            return `<option value="${show}"></option>`;
          }).join("");
        } catch (err) {
          if (err?.name !== "AbortError") { /* ignore */ }
        }
      }
  
      const debouncedSuggest = debounce(() => updateLocationSuggestionsFast(locInput.value), 120);
      locInput.addEventListener("input", debouncedSuggest);
      locInput.addEventListener("change", debouncedSuggest);
      locInput.addEventListener("focus", debouncedSuggest);
    }
  
    // === Sort-Mapping (optional Select vorhanden) ===
    function mapSortToServer(val) {
      if (val === "price-asc")  return "preis_asc";
      if (val === "price-desc") return "preis_desc";
      if (val === "date-desc")  return "neueste";
      return "";
    }
  
    // === Submit → suche.html mit Query-Parametern ===
    form.addEventListener("submit", (e) => {
      e.preventDefault();
  
      const qs = new URLSearchParams();
  
      const brand = markeSel?.value || "";
      if (brand) qs.set("marke", brand);
  
      if (modellSel) {
        const models = Array.from(modellSel.selectedOptions || [])
          .map(o => o.value)
          .filter(Boolean);
        if (models.length) qs.set("modell", models.join(","));
      }
  
      const y = yearSel?.value || "";
      const m = monthSel?.value || "";
      if (y && m) qs.set("ezFrom", `${y}-${String(m).padStart(2, "0")}`);
  
      if (kmSel) {
        const raw = kmSel.value === "custom" ? (kmCustom?.value || "") : kmSel.value;
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n) && n > 0) qs.set("km_max", String(n));
      }
  
      if (priceSel) {
        const raw = priceSel.value === "custom" ? (priceCustom?.value || "") : priceSel.value;
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n) && n > 0) qs.set("price_max", String(n));
      }
  
      const gear = (gearSel?.value || "").toLowerCase().trim();
      if (gear && !["beliebig","any","alle","all","-"].includes(gear)) {
        qs.set("getriebe", gear);
      }
  
      const fuel = (fuelSel?.value || "").toLowerCase().trim();
      if (fuel && !["beliebig","any","alle","all","-"].includes(fuel)) {
        qs.set("kraftstoff", fuel);
      }
  
      const loc = (locInput?.value || "").trim();
      if (loc) qs.set("ort", loc);
  
      if (distSel && !distSel.disabled) {
        const dRaw = distSel.value === "custom" ? (distCustom?.value || "") : distSel.value;
        const d = parseInt(dRaw, 10);
        if (!Number.isNaN(d) && d > 0 && d !== 999) qs.set("umkreis", String(d));
      }
  
      if (sortSel && sortSel.value) {
        const mapped = mapSortToServer(sortSel.value);
        if (mapped) qs.set("sort", mapped);
      }
  
      qs.delete("page");
      window.location.href = `suche.html?${qs.toString()}`;
    });
  });
  