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
  const FILTER_OUT_BELIEBIG = true;
  const FILTER_OUT_ALLE_VARIANTS = true;
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
      const r = await fetch('/data/marken-modelle.json', { credentials: 'omit' })

      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      brandToModels = (data && typeof data === "object") ? data : {};
    } catch (e) {
      console.warn("marken-modelle.json konnte nicht geladen werden.", e);
      brandToModels = {}; // leer -> nur Gruppen gäbe keinen Sinn
    }
  }

  function rebuildModelOptions(brand) {
    if (!modelDropdown) return;

    const rawList = (brandToModels && brandToModels[brand]) || [];
    const models = sanitizeModelList(rawList);

    // Gruppen anbieten, die für diese Marke Sinn machen
    const groupOptions = [];
    Object.entries(modelGroups).forEach(([groupName, rx]) => {
      const hasMatch = models.some(m => rx.test(m));
      if (hasMatch) groupOptions.push({ text: groupName, value: groupName });
    });

    const data = [
      ...models.map(m => ({ text: m, value: m })),
      ...groupOptions
    ];

    if (slimModell) {
      slimModell.setData(
        data.length
          ? data
          : [{ text: "Keine Modellvorschläge", value: "", disabled: true }]
      );
      slimModell.setSelected([]);
    } else {
      modelDropdown.innerHTML = "";
      if (!data.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = "Keine Modellvorschläge";
        modelDropdown.appendChild(opt);
      } else {
        data.forEach(({ text, value }) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = text;
          modelDropdown.appendChild(opt);
        });
      }
    }
  }

  // Lade Daten & initialisiere
  (async () => {
    await loadBrandModelMap();

    // Marke -> Modelle
    brandDropdown?.addEventListener("change", () => {
      const val = brandDropdown.value;
      rebuildModelOptions(val);
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

    // Modelle
    const qModels = (qs.get("modell") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (qModels.length && slimModell) {
      // Nur Modelle auswählen, die es für die Marke gibt
      const list = (brandToModels[qBrand] || []).map(String);
      const valid = qModels.filter(m => list.includes(m));
      if (valid.length) slimModell.setSelected(valid);
    }

    // EZ von (index: ezFrom=YYYY-MM)
    const ezFrom = qs.get("ezFrom");
    const ezVonInput = document.getElementById("ez-von");
    if (ezFrom && ezVonInput) {
      // Normalisieren auf YYYY-MM
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
});

  
  