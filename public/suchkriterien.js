


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

    "Golf (Alle)": /^Golf\s|^Golf$|^Golf-/i,
    "Passat (Alle)": /^Passat\s|^Passat$|^Passat-/i,
    "T3 (Alle)": /^T3(\s|$)/i,
    "T4 (Alle)": /^T4(\s|$)/i,
    "T5 (Alle)": /^T5(\s|$)/i,
    "T6 (Alle)": /^T6(\s|$)/i
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
      // Gruppen-Auswahl automatisch auf Einzelmodelle erweitern
      afterChange: (newSelected) => {
        const selectedBrand = brandDropdown?.value;
        const selectedValues = (newSelected || []).map(s => s.value);
        if (!selectedBrand || !brandToModels[selectedBrand]) return;

        const allValuesToSelect = new Set();
        selectedValues.forEach(val => {
          const regex = modelGroups[val];
          if (regex) {
            brandToModels[selectedBrand].forEach(model => {
              if (regex.test(model)) allValuesToSelect.add(model);
            });
          } else {
            allValuesToSelect.add(val);
          }
        });

        slimModell.setSelected([...allValuesToSelect]);
      }
    }
  });
  // Modelle aus JSON
  const FILTER_OUT_BELIEBIG = true;     // "Beliebig" aus JSON entfernen (wir fügen es selbst ein)
  const FILTER_OUT_ALLE_VARIANTS = true; // "(Alle)"-Einträge aus JSON entfernen (Gruppen steuern wir separat)
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
      if (FILTER_OUT_ALLE_VARIANTS && /\(alle\)/i.test(name)) continue;

      if (/^andere$/i.test(name)) { hadAndere = true; continue; }

      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        clean.push(name);
      }
    }
    clean.sort((a,b)=> a.localeCompare(b, "de", { sensitivity:"base" }));
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

    // Gruppen nur, wenn Marke auf Allowlist und es echte Treffer gibt
    let groupOptions = [];
    const allowedForBrand = ALLOW_GROUPS_FOR[brand];
    if (allowedForBrand && allowedForBrand.length) {
      groupOptions = allowedForBrand
        .filter(groupName => {
          const rx = modelGroups[groupName];
          return rx && models.some(m => rx.test(m));
        })
        .map(groupName => ({ text: groupName, value: groupName }));
    }

    // Reihenfolge: Beliebig → Gruppen → Einzelmodelle
    const data = [
      { text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE },
      ...groupOptions,
      ...models.map(m => ({ text: m, value: m }))
    ];

    if (slimModell) {
      slimModell.setData(
        data.length
          ? data
          : [{ text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE }]
      );
      // Standard: Beliebig aktiv
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

  // "Beliebig" exklusiv halten (SlimSelect feuert change auf dem <select>)
  modelDropdown?.addEventListener("change", () => {
    const selected = Array.from(modelDropdown.selectedOptions || []).map(o => o.value);
    if (selected.includes(ALL_MODELS_VALUE)) {
      if (slimModell) slimModell.setSelected([ALL_MODELS_VALUE]);
      else modelDropdown.value = ALL_MODELS_VALUE;
    }
  });

  // Lade Daten & initialisiere
  (async () => {
    await loadBrandModelMap();

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

      // expandiere Gruppen in Einzelmodelle (nur wenn für Marke erlaubt)
      const allowedForBrand = ALLOW_GROUPS_FOR[brand] || [];
      const expanded = new Set();

      for (const item of qModels) {
        if (allowedForBrand.includes(item) && modelGroups[item]) {
          const rx = modelGroups[item];
          list.forEach(m => { if (rx.test(m)) expanded.add(m); });
        } else if (list.includes(item)) {
          expanded.add(item);
        }
      }

      const vals = [...expanded];
      if (vals.length) {
        slimModell.setSelected(vals);
      } else {
        // Fallback: Beliebig
        slimModell.setSelected([ALL_MODELS_VALUE]);
      }
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
      document.querySelectorAll('[label*="Getriebe"] input[type="checkbox"], .search-group input[type="checkbox"]').forEach(inp => {
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
    const n = Number(String(val || "").replace(",", ".").trim());
    return Number.isFinite(n) ? n : null;
  }

  function getSelectedModels() {
    const sel = document.getElementById("modell");
    if (!sel) return [];
    const vals = Array.from(sel.selectedOptions || []).map(o => o.value).filter(Boolean);
    // "Beliebig" => keine Modell-Parameter senden
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
  }

  function buildAdvancedQuery() {
    const qs = new URLSearchParams();

    // Marke & Modelle
    const brand = brandDropdown?.value || "";
    if (brand) qs.set("marke", brand);

    const models = getSelectedModels();
    if (models.length) qs.set("modell", models.join(","));

    // Modellvariante
    const modVar = document.getElementById("modellausfuehrung")?.value?.trim();
    if (modVar) qs.set("modellausfuehrung", modVar);

    // Erstzulassung
    const ezFrom = document.getElementById("ez-von")?.value;
    const ezTo   = document.getElementById("ez-bis")?.value;
    if (ezFrom) qs.set("ezFrom", ezFrom); // YYYY-MM
    if (ezTo)   qs.set("ezTo",   ezTo);

    // Kilometer
    const kmMin = num(document.getElementById("km-von")?.value);
    const kmMax = num(document.getElementById("km-bis")?.value);
    if (kmMin != null) qs.set("km_min", String(kmMin));
    if (kmMax != null) qs.set("km_max", String(kmMax));

    // Preis
    const pMin = num(document.getElementById("preis-von")?.value);
    const pMax = num(document.getElementById("preis-bis")?.value);
    if (pMin != null) qs.set("price_min", String(pMin));
    if (pMax != null) qs.set("price_max", String(pMax));

    // Land / Ort / Umkreis
    const land = document.getElementById("land")?.value?.trim();
    if (land) qs.set("land", land);

    const ort = document.getElementById("ort")?.value?.trim();
    if (ort) qs.set("ort", ort);

    const umkreisSel = document.getElementById("umkreis");
    if (umkreisSel) {
      let radius = umkreisSel.value;
      if (radius === "custom") {
        const c = num(document.getElementById("custom-umkreis")?.value);
        radius = (c != null && c > 0) ? String(c) : "";
      }
      if (radius && radius !== "999") qs.set("umkreis", radius);
    }

    // Leistung PS
    const psMin = num(document.getElementById("leistung-von")?.value);
    const psMax = num(document.getElementById("leistung-bis")?.value);
    if (psMin != null) qs.set("ps_min", String(psMin));
    if (psMax != null) qs.set("ps_max", String(psMax));

    // Hubraum
    const ccMin = num(document.getElementById("hubraum-von")?.value);
    const ccMax = num(document.getElementById("hubraum-bis")?.value);
    if (ccMin != null) qs.set("ccm_min", String(ccMin));
    if (ccMax != null) qs.set("ccm_max", String(ccMax));

    // Verbrauch (komb.) bis
    const verb = num(document.getElementById("verbrauch")?.value);
    if (verb != null) qs.set("verbrauch_max", String(verb));

    // Getriebe (Automatik / Schaltgetriebe)
    const getriebeChecked = Array.from(
      document.querySelectorAll('input[type="checkbox"][value="Automatik"], input[type="checkbox"][value="Schaltgetriebe"]')
    ).filter(i => i.checked).map(i => i.value.toLowerCase());
    if (getriebeChecked.length) qs.set("getriebe", getriebeChecked.join(","));

    // Antriebsart
    const antriebChecked = Array.from(
      document.querySelectorAll('input[type="checkbox"][value="Frontantrieb"], input[type="checkbox"][value="Heckantrieb"], input[type="checkbox"][value="Allradantrieb"]')
    ).filter(i => i.checked).map(i => i.value);
    if (antriebChecked.length) qs.set("antrieb", antriebChecked.join(","));

    // Kraftstoff (Labels ohne value → Texte)
    const fuelGrid = document.querySelector(".fuel-type-grid");
    if (fuelGrid) {
      const fuels = getCheckedTextsIn(fuelGrid);
      if (fuels.length) qs.set("kraftstoff", fuels.join(","));
    }

    // Schadstoffklasse (+ Custom)
    const schad = document.getElementById("schadstoffklasse")?.value;
    const schadCustom = document.getElementById("custom-schadstoff")?.value?.trim();
    const schadFinal = schadCustom || schad;
    if (schadFinal) qs.set("schadstoffklasse", schadFinal);

    // Umweltplakette
    const plakette = document.getElementById("plakette")?.value;
    if (plakette && plakette !== "Beliebig") qs.set("plakette", plakette);

    // Partikelfilter
    const pf = document.getElementById("partikelfilter");
    if (pf && pf.checked) qs.set("partikelfilter", "1");

    // HU mind. gültig (+ Custom)
    const huSel = document.getElementById("hu-gueltig")?.value;
    const huCustom = document.getElementById("custom-hu")?.value?.trim();
    const huFinal = huCustom || huSel;
    if (huFinal && huFinal !== "Beliebig") qs.set("hu", huFinal);

    // Halter
    const halter = document.getElementById("fahrzeughalter")?.value;
    if (halter) qs.set("halter_max", halter);

    // Fahrzeugtyp (gezielt den Block mit der Überschrift finden)
    const grpTyp = findGroupByLabelText("Fahrzeugtyp");
    if (grpTyp) {
      const typGrid = grpTyp.querySelector(".checkbox-grid");
      if (typGrid) {
        const typen = getCheckedTextsIn(typGrid);
        if (typen.length) qs.set("fahrzeugtyp", typen.join(","));
      }
    }

    // Sonstige Merkmale
    const grpSonst = findGroupByLabelText("Sonstige Merkmale");
    if (grpSonst) {
      const grid = grpSonst.querySelector(".checkbox-grid");
      if (grid) {
        const sonst = getCheckedTextsIn(grid);
        if (sonst.length) qs.set("merkmale", sonst.join(","));
      }
    }

    // Farben
    const colorBox = document.querySelector(".color-selection");
    if (colorBox) {
      const colors = getCheckedTextsIn(colorBox);
      if (colors.length) qs.set("farbe", colors.join(","));
    }

    // immer page resetten
    qs.delete("page");
    return qs;
  }

  function goToSearch() {
    const qs = buildAdvancedQuery();
    window.location.href = `suche.html?${qs.toString()}`;
  }

  // Button binden (ohne ID, nutzt deine .submit-btn)
  document.querySelector(".search-submit .submit-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    goToSearch();
  });
});