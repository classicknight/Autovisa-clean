


// suchkriterien.js
document.documentElement.classList.remove('no-js');

document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Navbar (Klick-only)
     ========================= */
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");
  const authLinkLi    = document.getElementById("auth-link");

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function closeAllDropdowns(except = null) {
    dropdownLis.forEach(li => {
      if (li !== except) {
        li.classList.remove("open");
        const trigger = li.querySelector('a[aria-haspopup="true"]');
        const menu    = li.querySelector(".dropdown-menu");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        if (menu) {
          menu.classList.remove("show");
          menu.style.left = "";
          [...menu.children].forEach(item => (item.style.transitionDelay = ""));
        }
      }
    });
  }

  function positionMenu(li) {
    const trigger = li.querySelector('a[aria-haspopup="true"]');
    const menu    = li.querySelector('.dropdown-menu');
    if (!trigger || !menu) return;

    const tRect = trigger.getBoundingClientRect();
    const mRect = menu.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const vw = window.innerWidth;

    const center  = tRect.left + tRect.width / 2;
    let leftAbs   = center - mRect.width / 2;
    leftAbs       = clamp(leftAbs, 16, vw - mRect.width - 16);
    const relLeft = leftAbs - liRect.left;

    menu.style.left = `${relLeft}px`;
  }

  function openDropdown(trigger) {
    const li   = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    closeAllDropdowns(li);

    li.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.classList.add("show");

    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }

  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    li.classList.contains("open") ? closeAllDropdowns() : openDropdown(trigger);
  }

  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !navLinks.classList.contains("active");
    navLinks.classList.toggle("active");
    closeAllDropdowns();
    hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  dropdownLinks.forEach(link => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });

  document.addEventListener("click", () => {
    navLinks?.classList.remove("active");
    closeAllDropdowns();
  });

  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  // Auth-UI (Login -> Abmelden)
  if (authLinkLi) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data?.eingeloggt) {
          authLinkLi.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
          document.getElementById("logout-link")?.addEventListener("click", (e) => {
            e.preventDefault();
            fetch("/logout", { method: "POST", credentials: "include" })
              .then(() => { localStorage.clear(); location.reload(); })
              .catch(() => alert("Abmelden fehlgeschlagen."));
          });
        }
      })
      .catch(() => {});
  }

  // Links -> Übersicht-Tabs (login-abhängig)
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");
  const soldCarsLink  = document.getElementById("sold-cars-link");
  const messagesLink  = document.getElementById("messages-link");

  function gotoUebersicht(targetHash) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.eingeloggt) {
          window.location.href = `übersicht.html${targetHash}`;
        } else {
          localStorage.setItem("redirectAfterLogin", `übersicht.html${targetHash}`);
          window.location.href = "login.html";
        }
      })
      .catch(() => {
        localStorage.setItem("redirectAfterLogin", `übersicht.html${targetHash}`);
        window.location.href = "login.html";
      });
  }

  savedCarsLink?.addEventListener("click", (e) => { e.preventDefault(); gotoUebersicht("#saved"); });
  myCarsLink?.addEventListener("click",    (e) => { e.preventDefault(); gotoUebersicht("#my-cars"); });
  soldCarsLink?.addEventListener("click",  (e) => { e.preventDefault(); gotoUebersicht("#sold"); });
  messagesLink?.addEventListener("click",  (e) => { e.preventDefault(); gotoUebersicht("#chats"); });

  document.querySelector('a[href="#search-section"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
  });

  // Sichtbar machen (falls animiert)
  const searchSection = document.querySelector('.search-section');
  if (searchSection) searchSection.style.opacity = '1';

  /* =========================
     Marken/Modelle (SlimSelect + JSON)
     ========================= */
  const brandDropdown = document.getElementById("marke");
  const modelDropdown = document.getElementById("modell");

  // Gruppen-Definitionen (bleiben wie gehabt)
  const modelGroups = {
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

    "Fengon (Alle)": /^Fengon(\s\d+)?$/i,
    "Tourneo (Alle)": /^Tourneo(?!\s*\(Alle\))/i,
    "Transit (Alle)": /^Transit(?!\s*\(Alle\))/i,
    "Continental (Alle)": /^Continental\b/i,

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

    "ES-Serie (Alle)": /^ES\s/i,
    "GS-Serie (Alle)": /^GS\s/i,
    "GX Series (Alle)": /^GX\s/i,
    "IS-Serie (Alle)": /^IS\s/i,
    "LS-Serie (Alle)": /^LS\s/i,
    "LX-Serie (Alle)": /^LX\s/i,
    "NX-Serie (Alle)": /^NX\s/i,
    "RC-Serie (Alle)": /^RC\s/i,
    "RX-Serie (Alle)": /^RX\s/i,

    "Cabrio Serie (Alle)": /\bCabrio$/,
    "Clubman Serie (Alle)": /\bClubman$/,
    "Countryman Serie (Alle)": /\bCountryman$/,
    "Coupe Serie (Alle)": /\bCoupé$/,
    "MINI (Alle)": /^(1000|1300|Cooper|ONE|One)\b|John Cooper Works$/,
    "Paceman Serie (Alle)": /\bPaceman$/,
    "Roadster Serie (Alle)": /\bRoadster$/,

    "911er Reihe (Alle)": /^(911|930|964|991|992|993|996|997|912|914|918)\b/,

  "Golf (Alle)":   /^Golf(?!\s*\(Alle\))(\s|$|-)/i,
"Passat (Alle)": /^Passat(?!\s*\(Alle\))(\s|$|-)/i,
"T3 (Alle)":     /^T3(?!\s*\(Alle\))(\s|$)/i,
"T4 (Alle)":     /^T4(?!\s*\(Alle\))(\s|$)/i,
"T5 (Alle)":     /^T5(?!\s*\(Alle\))(\s|$)/i,
"T6 (Alle)":     /^T6(?!\s*\(Alle\))(\s|$)/i

  };

  // SlimSelect-Helfer
  const initSlim = (selector, opts) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    return new SlimSelect({ select: selector, ...opts });
  };

  // SlimSelect für Dropdowns
  const slimMarke = initSlim('#marke', {
    closeOnSelect: true,
    placeholder: 'Marke wählen',
    allowDeselect: true,
    showSearch: true
  });
  let slimModell = initSlim('#modell', {
    closeOnSelect: false,
    placeholder: 'Modell wählen',
    allowDeselect: true,
    hideSelected: false,
    showSearch: true,
    data: [
      { text: "Bitte zuerst Marke wählen", value: "", disabled: true, selected: true }
    ],
    events: {
      afterChange: (newSelected) => {
        const brand       = brandDropdown?.value || "";
        const allowGroups = ALLOW_GROUPS_FOR[brand] || [];
        const currentVals = (newSelected || []).map(s => s.value);
    
        // "Beliebig" exklusiv
        let vals = (currentVals.includes(ALL_MODELS_VALUE) && currentVals.length > 1)
          ? currentVals.filter(v => v !== ALL_MODELS_VALUE)
          : currentVals;
        if (vals.length === 1 && vals[0] === ALL_MODELS_VALUE) return;
    
        const fullList = sanitizeModelList((brandToModels[brand] || []).map(String));
        const nextSet  = new Set();
    
        vals.forEach(v => {
          const rx = modelGroups[v];
          const isAllowedGroup = rx && allowGroups.includes(v);
          if (isAllowedGroup) {
            fullList.forEach(m => {
              if (/\(alle\)/i.test(m)) return;    // Gruppen-Label NICHT selektieren
              if (rx.test(m)) nextSet.add(m);
            });
          } else if (v && v !== ALL_MODELS_VALUE) {
            nextSet.add(v);
          }
        });
    
        const next = nextSet.size ? [...nextSet] : [ALL_MODELS_VALUE];
        const nowKey  = currentVals.slice().sort().join("|");
        const nextKey = next.slice().sort().join("|");
        if (nowKey !== nextKey) slimModell.setSelected(next);
      }
    }
    
  });
  
  // Modelle aus JSON
  const FILTER_OUT_BELIEBIG = true;     // "Beliebig" aus JSON entfernen (wir fügen es selbst ein)
  const FILTER_OUT_ALLE_VARIANTS = false; // "(Alle)"-Einträge aus JSON entfernen (Gruppen steuern wir separat)
  const ALL_MODELS_VALUE = "__ALL_MODELS__";

  // Nur diese Marken bekommen Gruppen (… (Alle))
  const ALLOW_GROUPS_FOR = {
    "Bentley": ["Continental (Alle)"],
    "BMW": [
      "1er Reihe (Alle)","2er Reihe (Alle)","3er Reihe (Alle)","4er Reihe (Alle)",
      "5er Reihe (Alle)","6er Reihe (Alle)","7er Reihe (Alle)",
      "M-Modelle (Alle)","X-Reihe (Alle)","Z-Reihe (Alle)"
    ],
    "DFSK": ["Fengon (Alle)"],
    "Ford": ["Tourneo (Alle)","Transit (Alle)"],
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
    "Volkswagen": ["Golf (Alle)","Passat (Alle)","T3 (Alle)","T4 (Alle)","T5 (Alle)","T6 (Alle)"]
  };

  let brandToModels = {};
  function sanitizeModelList(listRaw = []) {
    const seen = new Set();
    const clean = [];
    let hadAndere = false;
  
    for (const raw of listRaw) {
      if (raw == null) continue;
      const name = String(raw).trim();
      if (!name) continue;
      if (FILTER_OUT_BELIEBIG && /^beliebig$/i.test(name)) continue;
      // "(Alle)" behalten (FILTER_OUT_ALLE_VARIANTS = false)
  
      if (/^andere$/i.test(name)) { hadAndere = true; continue; }
  
      const key = name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); clean.push(name); }
    }
  
    // JSON-Reihenfolge beibehalten; "Andere" ans Ende setzen
    if (hadAndere) clean.push("Andere");
    return clean;
  }
  
  

  async function loadBrandModelMap() {
    try {
      const r = await fetch('/data/marken-modelle.json', { credentials: 'omit' });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      brandToModels = (data && typeof data === "object") ? data : {};
    } catch (e) {
      console.warn("marken-modelle.json konnte nicht geladen werden.", e);
      brandToModels = {};
    }
  }

  function rebuildModelOptions(brand) {
    if (!modelDropdown) return;
  
    const rawList = (brandToModels && brandToModels[brand]) || [];
    const models  = sanitizeModelList(rawList);
  
    // Nur "Beliebig" + die Modelle in JSON-Reihenfolge
    const data = [
      { text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE },
      ...models.map(m => ({ text: m, value: m }))
    ];
  
    if (slimModell) {
      slimModell.setData(data.length ? data : [{ text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE }]);
      slimModell.setSelected([ALL_MODELS_VALUE]);
    } else {
      modelDropdown.innerHTML = "";
      data.forEach(({ text, value }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text;
        modelDropdown.appendChild(opt);
      });
      modelDropdown.value = ALL_MODELS_VALUE;
    }
  }
  
// Lade Daten & initialisiere
(async () => {
  await loadBrandModelMap();

  // -------- Safari-Fallback für <input type="month"> --------
  function supportsInputTypeMonth() {
    const i = document.createElement('input');
    i.setAttribute('type', 'month');
    i.value = '2023-12';
    return i.type === 'month' && i.value === '2023-12';
  }

  function buildMonthYearFallback(hiddenInputId, { minYear = 1980, maxYear = new Date().getFullYear() } = {}) {
    const hidden = document.getElementById(hiddenInputId);
    if (!hidden) return;
  
    // Original-Input als hidden verwenden
    hidden.type = 'hidden';
  
    // UI: Monat + Jahr als <select>
    const wrapper = document.createElement('div');
    wrapper.className = 'month-year';
  
    const selMonth = document.createElement('select');
    selMonth.setAttribute('aria-label', hiddenInputId + ' Monat');
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = String(m).padStart(2, '0');
      opt.textContent = new Date(2000, m - 1, 1).toLocaleString('de-DE', { month: 'long' });
      selMonth.appendChild(opt);
    }
  
    const selYear = document.createElement('select');
    selYear.setAttribute('aria-label', hiddenInputId + ' Jahr');
    for (let y = maxYear; y >= minYear; y--) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      selYear.appendChild(opt);
    }
  
    // Vorbelegung aus vorhandenem Wert (z. B. aus URL)
    const mm = /^\d{4}-\d{2}$/.test(hidden.value) ? hidden.value : '';
    if (mm) {
      const [y, m] = mm.split('-');
      if ([...selYear.options].some(o => o.value === y)) selYear.value = y;
      if ([...selMonth.options].some(o => o.value === m)) selMonth.value = m;
    }
  
    function sync() {
      if (selYear.value && selMonth.value) {
        hidden.value = `${selYear.value}-${selMonth.value}`;
      } else {
        hidden.value = '';
      }
    }
    selMonth.addEventListener('change', sync);
    selYear.addEventListener('change', sync);
    sync();
  
    wrapper.appendChild(selMonth);
    wrapper.appendChild(selYear);
  
    // WICHTIG: in der jeweiligen .range-item-Box einfügen (direkt vor das hidden Input)
    const container = hidden.closest('.range-item') || hidden.parentElement;
    container.insertBefore(wrapper, hidden);
  }
  
  // ----------------------------------------------------------

  // Marke -> Modelle
  brandDropdown?.addEventListener("change", () => {
    const val = brandDropdown.value;
    rebuildModelOptions(val);
    // Bei Markenwechsel standardmäßig "Beliebig"
    if (slimModell) slimModell.setSelected([ALL_MODELS_VALUE]);
    else modelDropdown.value = ALL_MODELS_VALUE;
  });

  // URL-Parameter übernehmen (von index.html)
  const qs = new URLSearchParams(location.search);

  // Marke
  const qBrand = qs.get("marke") || "";
  if (qBrand && brandDropdown) {
    if (slimMarke) slimMarke.setSelected(qBrand);
    else brandDropdown.value = qBrand;
    rebuildModelOptions(qBrand);
  } else if (brandDropdown?.value) {
    rebuildModelOptions(brandDropdown.value);
  }

  // Modelle (kann Einzelmodelle ODER Gruppen enthalten)
  const qModels = (qs.get("modell") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (qModels.length && slimModell) {
    const brand = qBrand || brandDropdown?.value || "";
    const list  = sanitizeModelList((brandToModels[brand] || []).map(String));
    const allowedForBrand = ALLOW_GROUPS_FOR[brand] || [];
    const expanded = new Set();

    for (const item of qModels) {
      if (allowedForBrand.includes(item) && modelGroups[item]) {
        const rx = modelGroups[item];
        list.forEach(m => { if (!/\(alle\)/i.test(m) && rx.test(m)) expanded.add(m); });
      } else if (list.includes(item)) {
        expanded.add(item);
      }
    }

    const vals = [...expanded];
    slimModell.setSelected(vals.length ? vals : [ALL_MODELS_VALUE]);
  } else {
    // Wenn keine Modelle in der URL: Beliebig aktiv
    slimModell?.setSelected([ALL_MODELS_VALUE]);
  }

  // EZ von (index: ezFrom=YYYY-MM)
  const ezFrom = qs.get("ezFrom");
  const ezVonInput = document.getElementById("ez-von");
  if (ezFrom && ezVonInput) {
    const mm = /^\d{4}-\d{2}$/.test(ezFrom) ? ezFrom : null;
    if (mm) ezVonInput.value = mm;
  }

  // EZ bis (index: ezTo=YYYY-MM)
  const ezTo = qs.get("ezTo");
  const ezBisInput = document.getElementById("ez-bis");
  if (ezTo && ezBisInput) {
    const mm2 = /^\d{4}-\d{2}$/.test(ezTo) ? ezTo : null;
    if (mm2) ezBisInput.value = mm2;
  }

  // Safari-Fallback erst nach dem Setzen der URL-Werte bauen:
  if (!supportsInputTypeMonth()) {
    buildMonthYearFallback('ez-von', { minYear: 1980 });
    buildMonthYearFallback('ez-bis', { minYear: 1980 });
  }

  // km_max -> km-bis
  const kmMax = qs.get("km_max");
  const kmBis = document.getElementById("km-bis");
  if (kmMax && kmBis) kmBis.value = kmMax;

  // price_max -> preis-bis
  const priceMax = qs.get("price_max");
  const preisBis = document.getElementById("preis-bis");
  if (priceMax && preisBis) preisBis.value = priceMax;

  // Ort
  const ort = qs.get("ort");
  const ortInput = document.getElementById("ort");
  if (ort && ortInput) ortInput.value = ort;

  // Umkreis (+ custom)
  const umkreisSel = document.getElementById("umkreis");
  const umkreisQS  = qs.get("umkreis");
  if (umkreisSel && umkreisQS) {
    const values = Array.from(umkreisSel.options).map(o => o.value);
    if (values.includes(umkreisQS)) {
      umkreisSel.value = umkreisQS;
      window.toggleCustomUmkreis?.(umkreisSel.value);
    } else {
      umkreisSel.value = "custom";
      window.toggleCustomUmkreis?.("custom");
      const custom = document.getElementById("custom-umkreis");
      if (custom) custom.value = umkreisQS;
    }
  }

  // Getriebe (Automatik/Schalt)
  const getriebe = (qs.get("getriebe") || "").toLowerCase();
  if (getriebe) {
    document
      .querySelectorAll('[label*="Getriebe"] input[type="checkbox"], .search-group input[type="checkbox"]')
      .forEach(inp => {
        const v = (inp.value || "").toLowerCase();
        if (getriebe.includes("auto") && v.includes("auto")) inp.checked = true;
        if (getriebe.includes("schalt") && v.includes("schalt")) inp.checked = true;
      });
  }

  // Kraftstoff
  const kraftstoff = (qs.get("kraftstoff") || "").toLowerCase();
  if (kraftstoff) {
    document.querySelectorAll('.fuel-type-grid input[type="checkbox"]').forEach(inp => {
      const v = (inp.parentElement?.innerText || inp.value || "").toLowerCase();
      if (kraftstoff && v.includes(kraftstoff)) inp.checked = true;
    });
  }
})();

  /* =========================
     SlimSelects für restliche Felder (nur wenn vorhanden)
     ========================= */
  initSlim('#hu-gueltig',      { placeholder: 'HU mind. gültig', allowDeselect: true, showSearch: false });
  initSlim('#fahrzeughalter',  { placeholder: 'Fahrzeughalter',  allowDeselect: true, showSearch: false });
  initSlim('#land',            { placeholder: 'Land',            allowDeselect: true, showSearch: false });
  initSlim('#umkreis',         { placeholder: 'Umkreis wählen',  allowDeselect: true, showSearch: false });
  initSlim('#plakette',        { placeholder: 'Plakette wählen', allowDeselect: true, showSearch: false });
  initSlim('#schadstoffklasse',{ placeholder: 'Schadstoffklasse',allowDeselect: true, showSearch: false });
  initSlim('#tueren',          { placeholder: 'Türen wählen',    allowDeselect: true, showSearch: false });
  initSlim('#zustand',         { placeholder: 'Zustand wählen',  allowDeselect: true, showSearch: false });
  initSlim('#fahrzeugart',     { placeholder: 'Fahrzeugart',     allowDeselect: true, showSearch: false });
  initSlim('#halter',          { placeholder: 'Halter',          allowDeselect: true, showSearch: false });
  initSlim('#fahrtauglich',    { placeholder: 'Fahrtauglich?',   allowDeselect: true, showSearch: false });
  initSlim('#beschaedigt',     { placeholder: 'Beschädigt?',     allowDeselect: true, showSearch: false });
  initSlim('#unfall',          { placeholder: 'Unfallfahrzeug?', allowDeselect: true, showSearch: false });

  /* =========================
     Globale Handler für HTML-onchange
     ========================= */
  window.toggleCustomUmkreis = function(value) {
    const customField = document.getElementById('custom-umkreis');
    if (!customField) return;
    if (value === 'custom') {
      customField.style.display = 'block';
    } else {
      customField.style.display = 'none';
      customField.value = '';
    }
  };

  window.toggleCustomSchadstoff = function(value) {
    const input = document.getElementById('custom-schadstoff');
    if (!input) return;
    if (value === 'custom') {
      input.style.display = 'block';
    } else {
      input.style.display = 'none';
      input.value = '';
    }
  };
  /* =========================
     Button "Fahrzeuge anzeigen" → suche.html
     ========================= */
// Hilfen
function num(val) {
  const s = String(val ?? "").replace(",", ".").trim();
  if (s === "") return null;                // leer => nichts senden
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getSelectedModels() {
  const sel = document.getElementById("modell");
  if (!sel) return [];
  const vals = Array.from(sel.selectedOptions || [])
    .map(o => o.value)
    .filter(Boolean);
  // "Beliebig (alle Modelle)" => keine Modelle senden
  return vals.includes(ALL_MODELS_VALUE) ? [] : vals;
}

// Labels ohne value → Text extrahieren
function getCheckedTextsIn(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]'))
    .filter(inp => inp.checked)
    .map(inp => (inp.parentElement?.innerText || "").trim())
    .filter(Boolean);
}

// Werte aus Checkboxen mit value
function getCheckedValuesIn(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]'))
    .filter(inp => inp.checked)
    .map(inp => (inp.value || "").trim())
    .filter(Boolean);
}

// gezielt einen .search-group-Block per Überschrift finden
function findGroupByLabelText(text) {
  return Array.from(document.querySelectorAll('.search-group')).find(g => {
    const label = g.querySelector('label');
    return label && label.textContent && label.textContent.toLowerCase().includes(text.toLowerCase());
  }) || null;
}// ganz oben eine simple num-Fallback-Funktion, falls window.num fehlt:
function _numFallback(v){ const n=parseInt(v,10); return Number.isFinite(n)?n:null; }

function buildAdvancedQuery() {
  const qs = new URLSearchParams();

  // --- kleine Helper (ohne externe Abhängigkeiten) ---
  const num = (typeof window.num === "function") ? window.num : _numFallback;

  // Marke
  const brandEl = document.getElementById("marke") || window.brandDropdown;
  const brand = brandEl?.value?.trim() || "";
  if (brand) qs.set("marke", brand);

  // Modelle: aus <select id="modell" multiple> lesen (SlimSelect benutzt unter der Haube immer das <select>)
  (function collectModels(){
    const sel = document.getElementById("modell");
    if (!sel) return;
    // Werte holen
    let vals = Array.from(sel.selectedOptions || []).map(o => (o.value || "").trim()).filter(Boolean);
    // "Beliebig" und Gruppen-Labels raus
    vals = vals.filter(v => v !== "__ALL_MODELS__" && !/^beliebig/i.test(v) && !/\(alle\)$/i.test(v));
    // Dedupe
    vals = Array.from(new Set(vals));
    if (vals.length) qs.set("modell", vals.join(","));
  })();

  // Modellvariante (Freitext)
  const modVar = document.getElementById("modellausfuehrung")?.value?.trim();
  if (modVar) qs.set("modellausfuehrung", modVar);

  // Türen
  const tueren = document.getElementById("tueren")?.value?.trim();
  if (tueren) qs.set("tueren", tueren);

  // Erstzulassung
  const ezFrom = document.getElementById("ez-von")?.value;
  const ezTo   = document.getElementById("ez-bis")?.value;
  if (ezFrom) qs.set("ezFrom", ezFrom);
  if (ezTo)   qs.set("ezTo",   ezTo);

  // Kilometer
  const kmMin = num(document.getElementById("km-von")?.value);
  const kmMax = num(document.getElementById("km-bis")?.value);
  if (kmMin != null && kmMin > 0) qs.set("km_min", String(kmMin));
  if (kmMax != null && kmMax > 0) qs.set("km_max", String(kmMax));

  // Preis
  const pMin = num(document.getElementById("preis-von")?.value);
  const pMax = num(document.getElementById("preis-bis")?.value);
  if (pMin != null && pMin > 0) qs.set("price_min", String(pMin));
  if (pMax != null && pMax > 0) qs.set("price_max", String(pMax));

  // Land (nur wenn != erstem Eintrag)
  (function(){
    const landEl = document.getElementById("land");
    if (!landEl) return;
    const val = landEl.value?.trim();
    const hasMultiple = landEl.options && landEl.options.length > 1;
    const firstVal = hasMultiple ? landEl.options[0].value : val;
    if (hasMultiple && val && val !== firstVal) qs.set("land", val);
  })();

  // Ort & Umkreis (+ optionale Lat/Lon-Hidden)
  const ort = document.getElementById("ort")?.value?.trim();
  if (ort) qs.set("ort", ort);

  const latV = parseFloat(document.getElementById("ort-lat")?.value);
  const lonV = parseFloat(document.getElementById("ort-lon")?.value);
  if (Number.isFinite(latV) && Number.isFinite(lonV)) {
    qs.set("ort_lat", String(latV));
    qs.set("ort_lon", String(lonV));
  }

  const umkreisSel = document.getElementById("umkreis");
  if (umkreisSel) {
    let radius = umkreisSel.value;
    if (radius === "custom") {
      const c = num(document.getElementById("custom-umkreis")?.value);
      radius = (c != null && c > 0) ? String(c) : "";
    }
    if (radius) qs.set("umkreis", radius);
  }

  // Leistung / Hubraum / Verbrauch
  const psMin = num(document.getElementById("leistung-von")?.value);
  const psMax = num(document.getElementById("leistung-bis")?.value);
  if (psMin != null && psMin > 0) qs.set("ps_min", String(psMin));
  if (psMax != null && psMax > 0) qs.set("ps_max", String(psMax));

  const ccMin = num(document.getElementById("hubraum-von")?.value);
  const ccMax = num(document.getElementById("hubraum-bis")?.value);
  if (ccMin != null && ccMin > 0) qs.set("ccm_min", String(ccMin));
  if (ccMax != null && ccMax > 0) qs.set("ccm_max", String(ccMax));

  const verb = num(document.getElementById("verbrauch")?.value);
  if (verb != null && verb > 0) qs.set("verbrauch_max", String(verb));

  // Getriebe (genau 1 Checkbox)
  (function(){
    const boxes = document.querySelectorAll(
      'input[type="checkbox"][value="Automatik"], input[type="checkbox"][value="Schaltgetriebe"]'
    );
    const selected = Array.from(boxes).filter(i => i.checked).map(i => i.value.toLowerCase());
    if (selected.length === 1) qs.set("getriebe", selected[0]);
  })();

  // Antrieb (mehrere)
  (function(){
    const picked = Array.from(document.querySelectorAll(
      'input[type="checkbox"][value="Frontantrieb"], input[type="checkbox"][value="Heckantrieb"], input[type="checkbox"][value="Allradantrieb"]'
    )).filter(i => i.checked).map(i => i.value);
    if (picked.length) qs.set("antrieb", picked.join(","));
  })();

  // Kraftstoff (genau 1)
  (function(){
    const grid = document.querySelector(".fuel-type-grid");
    if (!grid) return;
    const picked = Array.from(grid.querySelectorAll('input[type="checkbox"]'))
      .filter(i => i.checked)
      .map(i => (i.parentElement?.innerText || "").trim().toLowerCase());
    if (picked.length !== 1) return;
    const t = picked[0];
    let token = "";
    if (t.startsWith("benzin")) token = "benzin";
    else if (t.startsWith("diesel")) token = "diesel";
    else if (t.startsWith("elektro")) token = "elektro";
    else if (t.includes("hybrid"))   token = "hybrid";
    else if (t.startsWith("wasserstoff")) token = "wasserstoff";
    else if (t.includes("cng") || t.includes("erdgas")) token = "cng";
    else if (t.includes("lpg") || t.includes("autogas")) token = "lpg";
    else if (t.startsWith("ethanol")) token = "ethanol";
    else if (t.startsWith("andere"))  token = "andere";
    if (token) qs.set("kraftstoff", token);
  })();

  // Schadstoffe / Umwelt / HU / Halter
  const schad       = document.getElementById("schadstoffklasse")?.value;
  const schadCustom = document.getElementById("custom-schadstoff")?.value?.trim();
  const schadFinal  = schadCustom || schad;
  if (schadFinal) qs.set("schadstoffklasse", schadFinal);

  const plakette = document.getElementById("plakette")?.value;
  if (plakette && plakette !== "Beliebig") qs.set("plakette", plakette);

  const pf = document.getElementById("partikelfilter");
  if (pf && pf.checked) qs.set("partikelfilter", "1");

  const huSel    = document.getElementById("hu-gueltig")?.value;
  const huCustom = document.getElementById("custom-hu")?.value?.trim();
  const huFinal  = huCustom || huSel;
  if (huFinal && huFinal !== "Beliebig") qs.set("hu", huFinal);

  const halter = document.getElementById("fahrzeughalter")?.value;
  if (halter) qs.set("halter_max", halter);

  // Fahrzeugtyp: direkt aus einem Container auslesen (ohne Helper)
  (function collectVehicleTypes(){
    const vals = new Set();

    // 1) Bevorzugt: Inputs mit name="fahrzeugtyp"
    document.querySelectorAll('input[type="checkbox"][name="fahrzeugtyp"]:checked')
      .forEach(i => { const v=i.value?.trim(); if (v) vals.add(v); });

    // 2) Fallback: irgendeine Gruppe, deren Label-Text „Fahrzeugtyp“ enthält
    if (!vals.size) {
      const group = Array.from(document.querySelectorAll(".search-group"))
        .find(g => /fahrzeugtyp/i.test(g.querySelector("label")?.textContent || g.textContent || ""));
      if (group) {
        group.querySelectorAll('input[type="checkbox"]:checked').forEach(i => {
          const v = i.value?.trim() || i.parentElement?.textContent?.trim();
          if (v) vals.add(v);
        });
      }
    }

    if (vals.size) qs.set("fahrzeugtyp", Array.from(vals).join(","));
  })();

  // Farben / Sonstige Merkmale (falls vorhanden – du kannst diese Blöcke lassen)
  (function(){
    const colorBox = document.querySelector(".color-selection");
    if (colorBox) {
      const vals = Array.from(colorBox.querySelectorAll('input[type="checkbox"]:checked'))
        .map(i => i.value?.trim() || i.parentElement?.textContent?.trim())
        .filter(Boolean);
      if (vals.length) qs.set("farbe", Array.from(new Set(vals)).join(","));
    }
  })();

  (function(){
    const group = Array.from(document.querySelectorAll(".search-group"))
      .find(g => /Sonstige Merkmale/i.test(g.querySelector("label")?.textContent || g.textContent || ""));
    if (group) {
      const vals = Array.from(group.querySelectorAll('input[type="checkbox"]:checked'))
        .map(i => i.value?.trim() || i.parentElement?.textContent?.trim())
        .filter(Boolean);
      if (vals.length) qs.set("merkmale", Array.from(new Set(vals)).join(","));
    }
  })();

  // page zurücksetzen
  qs.delete("page");
  return qs;
}

// Weiterleitung
function goToSearch(){ const qs = buildAdvancedQuery(); window.location.href = `suche.html?${qs.toString()}`; }
document.querySelector(".search-submit .submit-btn")?.addEventListener("click", e => { e.preventDefault(); goToSearch(); });

});













// Nur einmal definieren, z.B. in deiner Suchkriterien.js
function toggleCustomUmkreis(val) {
  const custom = document.getElementById("custom-umkreis");
  if (!custom) return;
  const show = val === "custom";
  custom.style.display = show ? "block" : "none";
  if (!show) custom.value = "";
}

// Ort steuert, ob Umkreis enabled ist
(function () {
  const ortInput   = document.getElementById("ort");
  const umkreisSel = document.getElementById("umkreis");
  if (!ortInput || !umkreisSel) return;

  const sync = () => {
    const hasLoc = !!ortInput.value.trim();
    umkreisSel.disabled = !hasLoc;
    if (!hasLoc) {
      umkreisSel.value = "";            // Beliebig
      toggleCustomUmkreis("");          // Custom verstecken & leeren
    }
  };
  ortInput.addEventListener("input", sync);
  ortInput.addEventListener("change", sync);
  sync(); // Initial
})();
