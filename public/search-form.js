// search-form.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("#search-section .search-form");
    if (!form) return;
  
    // === Refs ===
    const markeSel  = document.getElementById("marke");
    const modellSel = document.getElementById("modell");
    const monthSel  = document.getElementById("first-registration-month");
    const yearSel   = document.getElementById("first-registration-year");
    const kmSel     = document.getElementById("kilometer-select");
    const kmCustom  = document.getElementById("kilometer-custom");
    const priceSel  = document.getElementById("price-select");
    const priceCustom = document.getElementById("price-custom");
    const gearSel   = document.getElementById("gear");
    const fuelSel   = document.getElementById("fuel");
    const locInput  = document.getElementById("location");
    const distSel   = document.getElementById("distance-select");
    const distCustom= document.getElementById("distance-custom");
  
    // === Jahre befüllen (aktuell -> 1980) ===
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y >= 1980; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSel.appendChild(opt);
    }
  
    // === Modelle pro Marke (kleine, erweiterbare Liste) ===
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
  
    // === Slim Select initialisieren (falls vorhanden) ===
    let ssMarke = null, ssModell = null;
    if (window.SlimSelect) {
      ssMarke = new SlimSelect({ select: "#marke", placeholder: "Marke wählen" });
      ssModell = new SlimSelect({
        select: "#modell",
        placeholder: "Modell(e) wählen",
        closeOnSelect: false,
        showSearch: true,
      });
    }
  
    function rebuildModelOptions(brand) {
      const list = brandToModels[brand] || [];
      // DOM: alte Optionen entfernen
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
      }
    }
  
    markeSel.addEventListener("change", () => {
      const brand = markeSel.value;
      rebuildModelOptions(brand);
      if (ssModell) ssModell.setSelected([]); // Auswahl zurücksetzen
    });
  
    // === Custom-Felder togglen (km/price/distance) ===
    function bindCustom(selectEl, inputEl) {
      const toggle = () => {
        const isCustom = selectEl.value === "custom";
        inputEl.style.display = isCustom ? "block" : "none";
        if (isCustom) inputEl.focus();
        if (!isCustom) inputEl.value = "";
      };
      selectEl.addEventListener("change", toggle);
      toggle(); // Initial
    }
  
    bindCustom(kmSel, kmCustom);
    bindCustom(priceSel, priceCustom);
    bindCustom(distSel, distCustom);
  
    // Umkreis nur aktiv, wenn Ort/PLZ gesetzt
    function syncDistanceEnabled() {
      const hasLoc = (locInput.value || "").trim().length > 0;
      distSel.disabled = !hasLoc;
      if (!hasLoc) {
        distSel.value = "999";   // "Beliebig"
        distCustom.value = "";
        distCustom.style.display = "none";
      }
    }
    locInput.addEventListener("input", syncDistanceEnabled);
    syncDistanceEnabled();
  
    // === Submit → Weiterleitung zu suche.html mit Query-Parametern ===
    form.addEventListener("submit", (e) => {
      e.preventDefault();
  
      const qs = new URLSearchParams();
  
      const brand = markeSel.value || "";
      if (brand) qs.set("marke", brand);
  
      const models = Array.from(modellSel.selectedOptions || []).map(o => o.value).filter(Boolean);
      if (models.length) qs.set("modell", models.join(","));
  
      const y = yearSel.value || "";
      const m = monthSel.value || "";
      if (y && m) qs.set("ezFrom", `${y}-${m}`);
  
      // km max
      let kmMax = kmSel.value === "custom" ? kmCustom.value : kmSel.value;
      if (kmMax) qs.set("km_max", String(parseInt(kmMax, 10)));
  
      // price max
      let pMax = priceSel.value === "custom" ? priceCustom.value : priceSel.value;
      if (pMax) qs.set("price_max", String(parseInt(pMax, 10)));
  
      const gear = (gearSel.value || "").toLowerCase();
      if (gear) qs.set("getriebe", gear);
  
      const fuel = (fuelSel.value || "").toLowerCase();
      if (fuel) qs.set("kraftstoff", fuel);
  
      const loc  = (locInput.value || "").trim();
      if (loc) qs.set("ort", loc);
  
      let distVal = distSel.disabled ? "" : (distSel.value === "custom" ? distCustom.value : distSel.value);
      if (distVal) qs.set("umkreis", String(parseInt(distVal, 10)));
  
      // Go!
      window.location.href = `suche.html?${qs.toString()}`;
    });
  });
  