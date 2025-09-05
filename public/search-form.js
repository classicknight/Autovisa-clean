// public/search-form.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("#search-section .search-form");
    if (!form) return;
  
    // HTML5-Validierung für die Suchbox abschalten
    form.noValidate = true;
  
    // "required" bei evtl. versteckten Feldern entfernen
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
    const advancedBtn = form.querySelector(".btn-advanced");
  
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
  
    // === Slim Select (falls eingebunden) ===
    let ssMarke = null, ssModell = null;
    if (window.SlimSelect) {
      if (markeSel) {
        ssMarke = new SlimSelect({
          select: "#marke",
          placeholder: "Marke wählen"
        });
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
  
    // === Marken/Modelle laden (aus /marken-modelle.json) ===
    // Konfiguration: was ausblenden?
    const FILTER_OUT_BELIEBIG = true;       // "Beliebig" ausblenden
    const FILTER_OUT_ALLE_VARIANTS = true;  // alles mit "(Alle)" ausblenden
  
    let brandToModels = {}; // wird nach fetch befüllt
  
    function sanitizeModelList(listRaw = []) {
      const seen = new Set();
      const clean = [];
      let hadAndere = false;
  
      for (const raw of listRaw) {
        if (raw == null) continue;
        const name = String(raw).trim();
        if (!name) continue;
        if (FILTER_OUT_BELIEBIG && /^beliebig$/i.test(name)) continue;
        if (FILTER_OUT_ALLE_VARIANTS && /\(alle\)/i.test(name)) continue;
  
        if (/^andere$/i.test(name)) { hadAndere = true; continue; }
  
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          clean.push(name);
        }
      }
  
      // Alphabetisch nach de-DE sortieren
      clean.sort((a,b)=> a.localeCompare(b, "de", { sensitivity:"base" }));
  
      // "Andere" am Ende, falls in Original vorhanden
      if (hadAndere) clean.push("Andere");
      return clean;
    }
  
    async function loadBrandModelMap() {
      const url = "/marken-modelle.json";
      try {
        const r = await fetch(url, { credentials: "omit" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        brandToModels = data && typeof data === "object" ? data : {};
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
  
    function maybeBuildBrandOptions() {
      if (!markeSel) return;
      // Wenn bereits echte Options vorhanden sind, nichts überschreiben
      const hasRealOptions = Array.from(markeSel.options || [])
        .some(o => o.value && o.value.trim() && !/^beliebig$/i.test(o.value));
      if (hasRealOptions) return;
  
      // Sonst Marken aus JSON befüllen
      const brands = Object.keys(brandToModels || {});
      if (!brands.length) return;
  
      // Bestehende Optionen leeren (z. B. nur Platzhalter)
      markeSel.innerHTML = "";
  
      // Optional: eine erste "Beliebig"-Option
      const anyOpt = document.createElement("option");
      anyOpt.value = "";
      anyOpt.textContent = "Beliebig";
      markeSel.appendChild(anyOpt);
  
      // "Andere" ans Ende
      const normalBrands = brands.filter(b => !/^andere$/i.test(b));
      normalBrands.sort((a,b)=> a.localeCompare(b, "de", { sensitivity:"base" }));
      const otherBrands = brands.filter(b => /^andere$/i.test(b));
  
      for (const b of normalBrands) {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        markeSel.appendChild(opt);
      }
      for (const b of otherBrands) {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        markeSel.appendChild(opt);
      }
  
      // SlimSelect updaten, falls aktiv
      if (ssMarke) {
        const data = [{ text: "Beliebig", value: "" }]
          .concat(normalBrands.map(b => ({ text: b, value: b })))
          .concat(otherBrands.map(b => ({ text: b, value: b })));
        ssMarke.setData(data);
        ssMarke.setSelected("");
      }
    }
  
    function rebuildModelOptions(brand) {
      if (!modellSel) return;
  
      const rawList = (brandToModels && brandToModels[brand]) || [];
      const list = sanitizeModelList(rawList);
  
      // Plain select leeren (falls kein SlimSelect)
      modellSel.innerHTML = "";
  
      if (!list.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = "Keine Modellvorschläge";
        modellSel.appendChild(opt);
        if (ssModell) {
          ssModell.setData([{ text: "Keine Modellvorschläge", value: "", disabled: true }]);
          ssModell.setSelected([]);
        }
        return;
      }
  
      // Optionen aufbauen
      if (ssModell) {
        ssModell.setData(list.map(m => ({ text: m, value: m })));
        ssModell.setSelected([]);
      } else {
        for (const m of list) {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m;
          modellSel.appendChild(opt);
        }
      }
    }
  
    // Laden & initialisieren (async Kette)
    (async () => {
      await loadBrandModelMap();
      maybeBuildBrandOptions();
  
      // Wenn Marke schon vorausgewählt ist, gleich Modelle befüllen
      if (markeSel && markeSel.value) {
        rebuildModelOptions(markeSel.value);
      } else {
        // andernfalls ggf. leeres „Modell“-Select initialisieren
        if (ssModell) {
          ssModell.setData([{ text: "Bitte zuerst Marke wählen", value: "", disabled: true }]);
          ssModell.setSelected([]);
        } else if (modellSel) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.disabled = true;
          opt.selected = true;
          opt.textContent = "Bitte zuerst Marke wählen";
          modellSel.appendChild(opt);
        }
      }
  
      // Wechsel der Marke -> Modelle neu laden
      markeSel?.addEventListener("change", () => rebuildModelOptions(markeSel.value));
    })();
  
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
  
    /* === Ortsvorschläge – eigene Dropdown-Liste === */
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
  
    // === Helper: Sort-Mapping ===
    function mapSortToServer(val) {
      if (val === "price-asc")  return "preis_asc";
      if (val === "price-desc") return "preis_desc";
      if (val === "date-desc")  return "neueste";
      return "";
    }
  
    // === Helper: Query aus aktuellem Formular bauen (für Suche + Weitere Filter) ===
    function buildQueryParams() {
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
      return qs;
    }
  
    // === „Weitere Filter“ → Suchkriterien.html (mit aktuellen Werten) ===
    advancedBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      const qs = buildQueryParams();
      window.location.href = `Suchkriterien.html?${qs.toString()}`;
    });
  
    // === Submit → suche.html mit Query-Parametern ===
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const qs = buildQueryParams();
      window.location.href = `suche.html?${qs.toString()}`;
    });
  });
  