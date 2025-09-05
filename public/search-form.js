// public/search-form.js
document.addEventListener("DOMContentLoaded", () => {
    // Läuft nur auf der Startseite: es muss ein Formular im #search-section existieren
    const form = document.querySelector("#search-section .search-form");
    if (!form) return;
  
    // ---- HTML5-Validierung abschalten & "required" auf evtl. versteckten Feldern entfernen
    form.noValidate = true;
    ["marke","modell","kilometer-select","price-select","distance-select","gear","transmission","fuel","fuelType"]
      .forEach(id => document.getElementById(id)?.removeAttribute("required"));
  
    // ---- Refs
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
  
    // ---- Slim Select
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
    // Marken/Modelle laden
    // ============================
    const ALL_MODELS_VALUE = "__ALL_MODELS__";
    const FILTER_OUT_BELIEBIG_IN_JSON = true;       // "Beliebig" als echtes Modell aus JSON entfernen
    const FILTER_OUT_GROUP_ALLE = false;            // Dinge wie "(Alle)" in den Modellnamen entfernen?
  
    let brandToModels = {}; // wird nach fetch befüllt
  
    function sanitizeModelList(listRaw = []) {
      const seen = new Set();
      const out = [];
      let hadAndere = false;
  
      for (const raw of listRaw) {
        if (raw == null) continue;
        const name = String(raw).trim();
        if (!name) continue;
  
        if (FILTER_OUT_BELIEBIG_IN_JSON && /^beliebig$/i.test(name)) continue;
        if (FILTER_OUT_GROUP_ALLE && /\(alle\)/i.test(name)) continue;
  
        if (/^andere$/i.test(name)) { hadAndere = true; continue; }
  
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(name);
        }
      }
  
      out.sort((a,b)=> a.localeCompare(b, "de", {sensitivity:"base"}));
      if (hadAndere) out.push("Andere");
      return out;
    }
  
    async function loadBrandModelMap() {
      try {
        // Wichtig: relativer Pfad, damit es auch in Subpfaden/Render funktioniert
        const r = await fetch("./marken-modelle.json", { credentials: "omit" });
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
      const list = sanitizeModelList(rawList);
  
      // Plain select leeren
      modellSel.innerHTML = "";
  
      // Erst "Beliebig (alle Modelle)" anbieten
      const any = document.createElement("option");
      any.value = ALL_MODELS_VALUE;
      any.textContent = "Beliebig (alle Modelle)";
      modellSel.appendChild(any);
  
      if (!list.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = "Keine Modellvorschläge";
        modellSel.appendChild(opt);
  
        if (ssModell) {
          ssModell.setData([
            { text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE },
            { text: "Keine Modellvorschläge", value: "", disabled: true }
          ]);
          ssModell.setSelected([ALL_MODELS_VALUE]);
        }
        return;
      }
  
      // Normale Modelle hinzufügen
      for (const m of list) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        modellSel.appendChild(opt);
      }
  
      // SlimSelect updaten
      if (ssModell) {
        const data = [{ text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE }]
          .concat(list.map(m => ({ text: m, value: m })));
        ssModell.setData(data);
        ssModell.setSelected([ALL_MODELS_VALUE]);
      } else {
        // Browser-Select: "Beliebig" standardmäßig auswählen
        any.selected = true;
      }
    }
  
    // Exklusivität: wenn "Beliebig (alle Modelle)" gewählt ist, alle anderen abwählen
    function enforceAllModelsExclusivity() {
      if (!modellSel) return;
      const selected = Array.from(modellSel.selectedOptions || []).map(o => o.value);
      if (selected.includes(ALL_MODELS_VALUE)) {
        // nur ALL_MODELS_VALUE aktiv lassen
        Array.from(modellSel.options).forEach(o => o.selected = (o.value === ALL_MODELS_VALUE));
        ssModell?.setSelected([ALL_MODELS_VALUE]);
      }
    }
    modellSel?.addEventListener("change", enforceAllModelsExclusivity);
  
    // Initialisieren: Marken laden, ggf. Modelle füllen
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
  
    // ============================
    // Ortsvorschläge – eigene Dropdown-Liste
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
    // Query-Params bauen (für Suchen & „Weitere Filter“)
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
        // „Beliebig (alle Modelle)“ => kein Modell-Param an die URL, damit serverseitig alle Modelle zählen
        if (models.length && !models.includes(ALL_MODELS_VALUE)) {
          qs.set("modell", models.filter(Boolean).join(","));
        }
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
      if (gear && !["beliebig","any","alle","all","-"].includes(gear)) qs.set("getriebe", gear);
  
      const fuel = (fuelSel?.value || "").toLowerCase().trim();
      if (fuel && !["beliebig","any","alle","all","-"].includes(fuel)) qs.set("kraftstoff", fuel);
  
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
  
    // Submit → suche.html
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const qs = buildQueryParams();
      window.location.href = `suche.html?${qs.toString()}`;
    });
  
    // „Weitere Filter“ → Suchkriterien.html (mit bereits gesetzten Filtern)
    if (advancedBtn) {
      advancedBtn.addEventListener("click", () => {
        const qs = buildQueryParams();
        window.location.href = `suchkriterien.html?${qs.toString()}`;
      });
    }
  });
  