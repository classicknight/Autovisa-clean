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
  const navbar        = document.querySelector(".navbar");

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

    // LINKS am Trigger statt Center:
    const offset = 0;
    let leftAbs = tRect.left + offset;

    // Clamping an die Viewport-Kanten
    leftAbs = Math.max(16, Math.min(leftAbs, vw - mRect.width - 16));

    const relLeft = leftAbs - liRect.left;
    menu.style.left = `${relLeft}px`;
  }

  function openDropdown(trigger) {
    const li   = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    closeAllDropdowns(li);

    li.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu?.classList.add("show");

    if (menu) {
      [...menu.children].forEach((item, i) => {
        item.style.transitionDelay = `${i * 25}ms`;
      });
    }

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

  navbar?.addEventListener("click", (e) => e.stopPropagation());
  navLinks?.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", () => {
    navLinks?.classList.remove("active");
    closeAllDropdowns();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks?.classList.remove("active");
      closeAllDropdowns();
      hamburger?.setAttribute("aria-expanded", "false");
    }
  });

  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen, { passive: true });
  window.addEventListener("scroll", repositionOpen, { passive: true });

  /* =========================
     Auth-UI (Login -> Abmelden)
     ========================= */
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
  /* =========================
     Ort/PLZ – GeoSuggest Autocomplete (setzt ort-lat/ort-lon)
     ========================= */
     const ortInput = document.getElementById("ort");
     const ortLatEl = document.getElementById("ort-lat");
     const ortLonEl = document.getElementById("ort-lon");
   
     function setupOrtGeoSuggest() {
       if (!ortInput || !ortLatEl || !ortLonEl) return;
   
       const group = ortInput.closest(".search-group") || ortInput.parentElement;
       if (group) group.style.position = "relative";
   
       const box = document.createElement("div");
       box.className = "av-geo-suggest";
       box.style.cssText = `
         position:absolute; left:0; right:0; top:100%;
         margin-top:8px; z-index:9999; display:none;
         background:#0f2027; color:#fff;
         border:1px solid rgba(227,233,239,.22);
         border-radius:12px; overflow:hidden;
         box-shadow:0 18px 40px rgba(0,0,0,.35);
       `;
       group.appendChild(box);
   
       let items = [];
       let active = -1;
       let abortCtrl = null;
   
       const close = () => {
         box.style.display = "none";
         box.innerHTML = "";
         items = [];
         active = -1;
       };
   
       const highlight = () => {
         const btns = box.querySelectorAll("button[data-idx]");
         btns.forEach((b, i) => (b.style.background = i === active ? "rgba(0,184,169,.14)" : "transparent"));
       };
   
       const select = (idx) => {
         const it = items[idx];
         if (!it) return;
         ortInput.value = it.value || it.label;
         ortLatEl.value = String(it.lat);
         ortLonEl.value = String(it.lon);
         close();
       };
   
       const render = () => {
         if (!items.length) return close();
   
         box.innerHTML = items
           .map((it, idx) => {
             const secondary = it.secondary ? `<div style="opacity:.75;font-size:.9em">${it.secondary}</div>` : "";
             return `
               <button type="button" data-idx="${idx}"
                 style="display:block;width:100%;text-align:left;padding:10px 12px;border:0;background:transparent;color:inherit;cursor:pointer;font:inherit">
                 <div style="font-weight:600">${it.label}</div>
                 ${secondary}
               </button>
             `;
           })
           .join("");
   
         box.querySelectorAll("button[data-idx]").forEach((btn) => {
           btn.addEventListener("click", () => select(Number(btn.dataset.idx)));
           btn.addEventListener("mouseenter", () => {
             active = Number(btn.dataset.idx);
             highlight();
           });
         });
   
         active = 0;
         highlight();
         box.style.display = "block";
       };
   
       const fetchSuggest = async (q) => {
         const query = String(q || "").trim();
         if (query.length < 2) return close();
   
         if (abortCtrl) abortCtrl.abort();
         abortCtrl = new AbortController();
   
         try {
           const res = await fetch(`/api/geosuggest?q=${encodeURIComponent(query)}&limit=8`, { signal: abortCtrl.signal });
           if (!res.ok) return close();
   
           const data = await res.json();
           items = (Array.isArray(data?.items) ? data.items : [])
             .map((x) => ({
               label: x.label || x.display_name || "",
               value: x.value || x.label || "",
               secondary: x.secondary || "",
               lat: x.lat,
               lon: x.lon,
             }))
             .filter((it) => it.label && Number.isFinite(it.lat) && Number.isFinite(it.lon));
   
           render();
         } catch (e) {
           if (e?.name !== "AbortError") close();
         }
       };
   
       // mini-debounce
       let t = null;
       const debounced = (val) => {
         clearTimeout(t);
         t = setTimeout(() => fetchSuggest(val), 220);
       };
   
       ortInput.addEventListener("input", () => {
         // sobald der User frei tippt: Koordinaten invalidieren (bis er wieder auswählt)
         ortLatEl.value = "";
         ortLonEl.value = "";
         debounced(ortInput.value);
       });
   
       ortInput.addEventListener("focus", () => debounced(ortInput.value));
   
       ortInput.addEventListener("keydown", (e) => {
         if (box.style.display === "none") return;
   
         if (e.key === "ArrowDown") {
           e.preventDefault();
           active = Math.min(items.length - 1, active + 1);
           highlight();
         } else if (e.key === "ArrowUp") {
           e.preventDefault();
           active = Math.max(0, active - 1);
           highlight();
         } else if (e.key === "Enter") {
           if (active >= 0) {
             e.preventDefault();
             select(active);
           }
         } else if (e.key === "Escape") {
           close();
         }
       });
   
       document.addEventListener("click", (e) => {
         if (!group.contains(e.target)) close();
       });
     }
   
     setupOrtGeoSuggest();
   
  /* =========================
     Login-abhängige Navigationsziele
     ========================= */
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");
  const soldCarsLink  = document.getElementById("sold-cars-link");
  const messagesLink  = document.getElementById("messages-link");
  const mobileSaved   = document.getElementById("mobile-saved");
  const mobileMsg     = document.getElementById("mobile-messages");

  function gotoUebersicht(targetHash) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data?.eingeloggt) {
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

  const bindGoto = (el, hash) => el?.addEventListener("click", e => { e.preventDefault(); gotoUebersicht(hash); });
  bindGoto(savedCarsLink, "#saved");
  bindGoto(myCarsLink,    "#my-cars");
  bindGoto(soldCarsLink,  "#sold");
  bindGoto(messagesLink,  "#chats");
  bindGoto(mobileSaved,   "#saved");
  bindGoto(mobileMsg,     "#chats");

  const hashLink = document.querySelector('a[href="#search-section"]');
  if (hashLink) {
    hashLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Sichtbar machen (falls animiert)
  const searchSection = document.querySelector('.search-section');
  if (searchSection) searchSection.style.opacity = '1';

  /* =========================
     Marken/Modelle (SlimSelect + JSON)
     ========================= */
     const brandDropdown = document.getElementById("marke");
     const modelDropdown = document.getElementById("modell");
     
     const FILTER_OUT_BELIEBIG = true;
     const ALL_MODELS_VALUE = "__ALL_MODELS__";
     
     let slimMarke = null;
     let slimModell = null;
     
     function setModelEnabled(enabled) {
       if (!modelDropdown) return;
     
       modelDropdown.disabled = !enabled;
     
       // SlimSelect UI mitziehen
       if (slimModell) {
         if (!enabled && typeof slimModell.disable === "function") slimModell.disable();
         if ( enabled && typeof slimModell.enable  === "function") slimModell.enable();
       }
     }
     

  // ⬇️⬇️ NEU: GUARD – nur initialisieren, wenn SlimSelect hier noch NICHT aktiv ist
  const _isSlim = el => !!(el && el.nextElementSibling && el.nextElementSibling.classList.contains('ss-main'));
  if (!_isSlim(brandDropdown) && !_isSlim(modelDropdown)) {

    // Gruppen-Definitionen
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

 // SlimSelect-Helfer (im Guard-Block weiterhin ok)
const initSlim = (selector, opts) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  return new SlimSelect({ select: selector, ...opts });
};

// WICHTIG: slimMarke/slimModell NICHT neu als const/let deklarieren,
// sondern die äußeren Variablen befüllen (die du vorher oben definiert hast):
// let slimMarke = null;
// let slimModell = null;

slimMarke = initSlim('#marke', {
  closeOnSelect: true,
  placeholder: 'Beliebig (alle Marken)',
  allowDeselect: false,   // weil du Option value="" hast
  showSearch: true
});

slimModell = initSlim('#modell', {
  closeOnSelect: false,
  placeholder: 'Bitte zuerst Marke wählen',
  allowDeselect: true,
  hideSelected: false,
  showSearch: true,
  data: [], // wird erst nach Markenwahl gefüllt
  events: {
    afterChange: (newSelected) => {
      const brand = (brandDropdown?.value || "").trim();
      if (!brand) return; // Marke "Beliebig" -> keine Modell-Logik

      const allowGroups = ALLOW_GROUPS_FOR[brand] || [];
      const currentVals = (newSelected || []).map(s => s.value);

      // "Beliebig (alle Modelle)" exklusiv
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
            if (/\(alle\)/i.test(m)) return;
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

// Ganz wichtig: Modell soll auch in SlimSelect optisch disabled starten
setModelEnabled(false);

// ❌ Diese beiden Zeilen HIER entfernen (Duplikate!)
// const FILTER_OUT_BELIEBIG = true;
// const ALL_MODELS_VALUE = "__ALL_MODELS__";


    // Nur diese Marken bekommen Gruppen
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
        if (/^andere$/i.test(name)) { hadAndere = true; continue; }

        const key = name.toLowerCase();
        if (!seen.has(key)) { seen.add(key); clean.push(name); }
      }
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
    
      const b = (brand || "").trim();
    
      // Marke = Beliebig -> Modell komplett deaktivieren und leeren
      if (!b) {
        if (slimModell) {
          slimModell.setData([]);
          slimModell.setSelected([]);
        } else {
          modelDropdown.innerHTML = "";
          modelDropdown.value = "";
        }
        setModelEnabled(false);
        return;
      }
    
      setModelEnabled(true);
    
      const rawList = (brandToModels && brandToModels[b]) || [];
      const models  = sanitizeModelList(rawList);
    
      const data = [
        { text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE },
        ...models.map(m => ({ text: m, value: m }))
      ];
    
      if (slimModell) {
        slimModell.setData(data);
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

      // ---- „Erstzulassung“ auf hübsche Dropdowns umbauen ----
      function buildMonthYearSelect(hiddenInputId, { minYear = 1980, maxYear = new Date().getFullYear() } = {}) {
        const hidden = document.getElementById(hiddenInputId);
        if (!hidden) return;

        if (hidden.type === "hidden" && hidden.dataset.mmEnhanced === "1") return;

        hidden.type = "hidden";
        hidden.dataset.mmEnhanced = "1";

        const wrapper = document.createElement("div");
        wrapper.className = "month-year";

        const selMonth = document.createElement("select");
        selMonth.id = `${hiddenInputId}-month`;
        selMonth.setAttribute("aria-label", hiddenInputId + " Monat");
        selMonth.innerHTML =
          `<option value="">Monat</option>` +
          Array.from({ length: 12 }, (_, i) => {
            const val = String(i + 1).padStart(2, "0");
            const label = new Date(2000, i, 1).toLocaleString("de-DE", { month: "long" });
            return `<option value="${val}">${label}</option>`;
          }).join("");

        const selYear = document.createElement("select");
        selYear.id = `${hiddenInputId}-year`;
        selYear.setAttribute("aria-label", hiddenInputId + " Jahr");
        selYear.innerHTML =
          `<option value="">Jahr</option>` +
          Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
            const y = String(maxYear - i);
            return `<option value="${y}">${y}</option>`;
          }).join("");

        function syncHidden() {
          const y = selYear.value;
          const m = selMonth.value;
          hidden.value = (y && m) ? `${y}-${m}` : "";
        }
        selMonth.addEventListener("change", syncHidden);
        selYear.addEventListener("change", syncHidden);

        if (/^\d{4}-\d{2}$/.test(hidden.value)) {
          const [y, m] = hidden.value.split("-");
          if ([...selYear.options].some(o => o.value === y)) selYear.value = y;
          if ([...selMonth.options].some(o => o.value === m)) selMonth.value = m;
          syncHidden();
        }

        wrapper.appendChild(selMonth);
        wrapper.appendChild(selYear);
        const container = hidden.closest(".range-item") || hidden.parentElement;
        container.insertBefore(wrapper, hidden);

        new SlimSelect({ select: `#${selMonth.id}`, placeholder: 'Monat', showSearch: false });
        new SlimSelect({ select: `#${selYear.id}`,  placeholder: 'Jahr',  showSearch: true  });
      }

      brandDropdown?.addEventListener("change", () => {
        const brand = (brandDropdown.value || "").trim();
        rebuildModelOptions(brand); // handled auch brand="" sauber
      });
      

    // URL-Parameter übernehmen
const qs = new URLSearchParams(location.search);

// 1) Marke aus URL
const qBrand = (qs.get("marke") || "").trim();

if (brandDropdown) {
  if (qBrand) {
    // Marke setzen (SlimSelect oder nicht ist egal – wir setzen den echten <select>-Value)
    brandDropdown.value = qBrand;

    // Modelle passend zur Marke neu aufbauen (und dabei "Beliebig Modelle" setzen)
    rebuildModelOptions(qBrand);

    // Falls SlimSelect für Marke existiert: UI synchronisieren
    if (slimMarke && typeof slimMarke.setSelected === "function") {
      slimMarke.setSelected(qBrand);
    }
  } else {
    // Keine Marke in URL => wenn aktuell eine Marke gewählt ist, Modelle passend aufbauen,
    // sonst Modell deaktiviert lassen (macht rebuildModelOptions bei brand="" sowieso)
    const current = (brandDropdown.value || "").trim();
    rebuildModelOptions(current);
  }
}

const qModels = (qs.get("modell") || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

if (qModels.length) {
  const brand = (qBrand || brandDropdown?.value || "").trim();

  // Wenn keine Marke -> Modelle ignorieren (Modell ist dann sowieso disabled)
  if (brand) {
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

    const vals = expanded.size ? [...expanded] : [ALL_MODELS_VALUE];

    // ✅ SlimSelect korrekt setzen
    if (slimModell && typeof slimModell.setSelected === "function") {
      slimModell.setSelected(vals);
    } else if (modelDropdown) {
      for (const opt of modelDropdown.options) opt.selected = vals.includes(opt.value);
      modelDropdown.dispatchEvent(new Event("change"));
    }
  }
} else {
  // ✅ Default: "Beliebig (alle Modelle)"
  if (slimModell && typeof slimModell.setSelected === "function") {
    slimModell.setSelected([ALL_MODELS_VALUE]);
  } else if (modelDropdown) {
    for (const opt of modelDropdown.options) opt.selected = (opt.value === ALL_MODELS_VALUE);
    modelDropdown.dispatchEvent(new Event("change"));
  }
}


      // EZ aus URL
      const ezFrom = qs.get("ezFrom");
      const ezVonInput = document.getElementById("ez-von");
      if (ezFrom && ezVonInput && /^\d{4}-\d{2}$/.test(ezFrom)) {
        ezVonInput.value = ezFrom;
      }

      const ezTo = qs.get("ezTo");
      const ezBisInput = document.getElementById("ez-bis");
      if (ezTo && ezBisInput && /^\d{4}-\d{2}$/.test(ezTo)) {
        ezBisInput.value = ezTo;
      }

      // Erstzulassung-Helfer rendern
      buildMonthYearSelect('ez-von', { minYear: 1950 });
      buildMonthYearSelect('ez-bis', { minYear: 1950 });

      // km_max -> km-bis
      const kmMax = qs.get("km_max");
      const kmBis = document.getElementById("km-bis");
      if (kmMax && kmBis) kmBis.value = kmMax;

      // price_max -> preis-bis
      const priceMax = qs.get("price_max");
      const preisBis = document.getElementById("preis-bis");
      if (priceMax && preisBis) preisBis.value = priceMax;

      // ⬇️⬇️ NEU: Verbrauch aus URL robust vorbelegen (Wrapper wird via syncVerbrauchUI getoggelt)
      (() => {
        const vMax = qs.get('verbrauch_max');
        if (!vMax) return;

        const sel = document.getElementById('verbrauch-select');
        const inp = document.getElementById('verbrauch');
        const toNum = (s) => {
          const n = parseFloat(String(s).replace(',', '.'));
          return Number.isFinite(n) ? n : null;
        };
        const vNum = toNum(vMax);
        if (!sel) return;

        const match = Array.from(sel.options).find(o => {
          const ov = toNum(o.value);
          return ov !== null && ov === vNum;
        });

        if (match && match.value !== 'custom') {
          sel.value = match.value;
          if (inp) inp.value = '';
        } else {
          sel.value = 'custom';
          if (inp) inp.value = String(vMax).replace('.', ',');
        }
        if (typeof syncVerbrauchUI === 'function') syncVerbrauchUI();
      })();

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

// Kleine Helper-Funktion lokal:
const splitCsv = (v) =>
  v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : [];

// Kraftstoff (Mehrfach; Werte wie "benzin", "diesel", "hybrid-benzin", ...)
const kraftValues = splitCsv(qs.get("kraftstoff")).map(v => v.toLowerCase());
if (kraftValues.length) {
  document
    .querySelectorAll('.fuel-type-grid input[type="checkbox"]')
    .forEach(inp => {
      const val = (inp.value || "").toLowerCase();
      inp.checked = kraftValues.includes(val);
    });
}

    })();
  } // ⬅️⬅️ ENDE: GUARD

  /* =========================
     SlimSelects für restliche Felder (nur wenn vorhanden)
     ========================= */
  const initSlim = (selector, opts) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    return new SlimSelect({ select: selector, ...opts });
  };

  initSlim('#hu-gueltig',      { placeholder: 'HU mind. gültig', allowDeselect: true, showSearch: false });
  initSlim('#fahrzeughalter',  { placeholder: 'Fahrzeughalter',  allowDeselect: true, showSearch: false });
  initSlim('#land',            { placeholder: 'Land',            allowDeselect: true, showSearch: false });
  initSlim('#umkreis',         { placeholder: 'Umkreis wählen',  allowDeselect: true, showSearch: false });
  initSlim('#plakette',        { placeholder: 'Plakette wählen', allowDeselect: true, showSearch: false });
  initSlim('#schadstoffklasse',{ placeholder: 'Schadstoffklasse',allowDeselect: true, showSearch: false });
  initSlim('#tueren',          { placeholder: 'Türen wählen',    allowDeselect: true, showSearch: false });

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

  // ⬇️⬇️ NEU: Verbrauch-UI richtig (Wrapper toggeln)
  const vbSel   = document.getElementById('verbrauch-select');
  const vbWrap  = document.getElementById('verbrauch-custom-wrap');
  const vbInput = document.getElementById('verbrauch');

  function syncVerbrauchUI() {
    if (!vbSel || !vbWrap) return;
    const isCustom = vbSel.value === 'custom';
    vbWrap.style.display = isCustom ? '' : 'none';
    if (!isCustom && vbInput) vbInput.value = '';
  }

  vbSel?.addEventListener('change', syncVerbrauchUI);
  syncVerbrauchUI();

  initSlim('#verbrauch-select', {
    allowDeselect: true,
    showSearch: false,
    placeholder: 'Beliebig',
    events: { afterChange: () => syncVerbrauchUI() }
  });

  /* =========================
     Button "Fahrzeuge anzeigen" → suche.html
     ========================= */
  function _numFallback(v){ const n=parseInt(String(v||"").trim(),10); return Number.isFinite(n)?n:null; }
  function buildAdvancedQuery() {
    const qs = new URLSearchParams();
    const numLocal = (typeof window.num === "function") ? window.num : _numFallback;
  
    // Marke
    const brandEl = document.getElementById("marke") || window.brandDropdown;
    const brand = brandEl?.value?.trim() || "";
    if (brand) qs.set("marke", brand);
  
    // Modelle
    (function collectModels() {
      const sel = document.getElementById("modell");
      if (!sel) return;
    
      // NEU: wenn Marke Beliebig, niemals modell mitsenden
      const brand = (document.getElementById("marke")?.value || "").trim();
      if (!brand) return;
    
      let vals = Array.from(sel.selectedOptions || [])
        .map(o => (o.value || "").trim())
        .filter(Boolean);
    
      vals = vals.filter(v => v !== "__ALL_MODELS__" && !/^beliebig/i.test(v) && !/\(alle\)$/i.test(v));
      vals = Array.from(new Set(vals));
      if (vals.length) qs.set("modell", vals.join(","));
    })();
    
    // Modellvariante
    const modVar = document.getElementById("modellausfuehrung")?.value?.trim();
    if (modVar) qs.set("modellausfuehrung", modVar);
  
    // Türen
    const tueren = document.getElementById("tueren")?.value?.trim();
    if (tueren) qs.set("tueren", tueren);
  
    // Erstzulassung (robust: Hidden ODER Year/Month-Selects; fehlenden Monat auffüllen)
    function readEz(id, fallbackMonth) {
      const hiddenVal = document.getElementById(id)?.value || "";
      if (/^\d{4}-\d{2}$/.test(hiddenVal)) return hiddenVal;
  
      const y = document.getElementById(`${id}-year`)?.value || "";
      const m = document.getElementById(`${id}-month`)?.value || fallbackMonth || "";
      if (y && m) return `${y}-${String(m).padStart(2, "0")}`;
      return "";
    }
    const ezFrom = readEz("ez-von", "01"); // nur Jahr gewählt -> Januar
    const ezTo   = readEz("ez-bis", "12"); // nur Jahr gewählt -> Dezember
    if (ezFrom) qs.set("ezFrom", ezFrom);
    if (ezTo)   qs.set("ezTo",   ezTo);
  
    // Kilometer
    const kmMin = numLocal(document.getElementById("km-von")?.value);
    const kmMax = numLocal(document.getElementById("km-bis")?.value);
    if (kmMin != null && kmMin > 0) qs.set("km_min", String(kmMin));
    if (kmMax != null && kmMax > 0) qs.set("km_max", String(kmMax));
  
    // Preis
    const pMin = numLocal(document.getElementById("preis-von")?.value);
    const pMax = numLocal(document.getElementById("preis-bis")?.value);
    if (pMin != null && pMin > 0) qs.set("price_min", String(pMin));
    if (pMax != null && pMax > 0) qs.set("price_max", String(pMax));
  
    // Land
    (function () {
      const landEl = document.getElementById("land");
      if (!landEl) return;
      const val = landEl.value?.trim();
      const hasMultiple = landEl.options && landEl.options.length > 1;
      const firstVal = hasMultiple ? landEl.options[0].value : val;
      if (hasMultiple && val && val !== firstVal) qs.set("land", val);
    })();
  
    // Ort
    const ort = document.getElementById("ort")?.value?.trim();
    if (ort) qs.set("ort", ort);
  
    // Koordinaten (falls vorhanden)
    const latV = parseFloat(document.getElementById("ort-lat")?.value);
    const lonV = parseFloat(document.getElementById("ort-lon")?.value);
    if (Number.isFinite(latV) && Number.isFinite(lonV)) {
      qs.set("ort_lat", String(latV));
      qs.set("ort_lon", String(lonV));
    }
  
    // Umkreis
    const umkreisSel = document.getElementById("umkreis");
    if (umkreisSel && !umkreisSel.disabled) {
      let radius = umkreisSel.value;
      if (radius === "custom") {
        const c = _numFallback(document.getElementById("custom-umkreis")?.value);
        radius = (c != null && c > 0) ? String(c) : "";
      }
      if (radius) qs.set("umkreis", radius);
    }
  
    // Leistung / Hubraum
    const psMin = _numFallback(document.getElementById("leistung-von")?.value);
    const psMax = _numFallback(document.getElementById("leistung-bis")?.value);
    if (psMin != null && psMin > 0) qs.set("ps_min", String(psMin));
    if (psMax != null && psMax > 0) qs.set("ps_max", String(psMax));
  
    const ccMin = _numFallback(document.getElementById("hubraum-von")?.value);
    const ccMax = _numFallback(document.getElementById("hubraum-bis")?.value);
    if (ccMin != null && ccMin > 0) qs.set("ccm_min", String(ccMin));
    if (ccMax != null && ccMax > 0) qs.set("ccm_max", String(ccMax));
  
    // Verbrauch (max)
    (function () {
      const sel   = document.getElementById('verbrauch-select');
      const input = document.getElementById('verbrauch');
      const toDec = (s) => {
        if (s == null) return null;
        const n = parseFloat(String(s).replace(',', '.'));
        return Number.isFinite(n) ? n : null;
      };
      let raw = '';
      if (sel) raw = sel.value === 'custom' ? (input?.value || '') : sel.value;
      else     raw = input?.value || '';
      const n = toDec(raw);
      if (n != null && n > 0) qs.set('verbrauch_max', String(n));
    })();
  
    // Getriebe (genau 1)
    (function () {
      const boxes = document.querySelectorAll(
        'input[type="checkbox"][value="Automatik"], input[type="checkbox"][value="Schaltgetriebe"]'
      );
      const selected = Array.from(boxes).filter(i => i.checked).map(i => (i.value || "").toLowerCase());
      if (selected.length === 1) qs.set("getriebe", selected[0]);
    })();
  
    // Antrieb (mehrere)
    (function () {
      const picked = Array.from(document.querySelectorAll(
        'input[type="checkbox"][value="Frontantrieb"], input[type="checkbox"][value="Heckantrieb"], input[type="checkbox"][value="Allradantrieb"]'
      ))
        .filter(i => i.checked)
        .map(i => i.value)
        .filter(Boolean);
      if (picked.length) qs.set("antrieb", picked.join(","));
    })();
  
 // Kraftstoff (Mehrfachauswahl + Hybrid-Unterarten)
(function () {
  const grid = document.querySelector('#feld-kraftstoff') || document.querySelector('.fuel-type-grid');
  if (!grid) return;

  const picked = Array.from(grid.querySelectorAll('input[type="checkbox"]:checked'))
    .map(i => (i.value || i.getAttribute('data-value') || i.parentElement?.innerText || '')
      .trim().toLowerCase())
    .filter(Boolean);

  if (!picked.length) {
    try { qs.delete('kraftstoff'); } catch {}
    return;
  }

  const tokens = picked.map(s => {
    // PHEV zuerst
    if ((/plug|phev/).test(s) && /hyb/.test(s) && (/benz|otto/).test(s)) return 'plug-in-hybrid-benzin';
    if ((/plug|phev/).test(s) && /hyb/.test(s))                          return 'plug-in-hybrid';

    // Hybrid (ohne Plug)
    if (/hyb/.test(s) && /diesel/.test(s))           return 'hybrid-diesel';
    if (/hyb/.test(s) && (/benz|otto/).test(s))      return 'hybrid-benzin';
    if (/hyb/.test(s))                                return 'hybrid-benzin'; // Fallback

    if (/benzin|otto/.test(s))                        return 'benzin';
    if (/diesel/.test(s))                             return 'diesel';
    if (/elektro|bev|strom|electric/.test(s))         return 'elektro';
    if (/wasserstoff|h2|fuel\s*cell/.test(s))         return 'wasserstoff';
    if (/autogas|lpg/.test(s))                        return 'autogas';
    if (/cng|erdgas/.test(s))                         return 'cng';
    if (/ethanol|e85/.test(s))                        return 'ethanol';
    if (/andere|sonstig/.test(s))                     return 'andere';
    return s;
  });

  // Doppelte entfernen (Reihenfolge beibehalten)
  const uniq = [...new Set(tokens)];
  const val = uniq.join(',');

  try { 
    qs.set('kraftstoff', val); 
  } catch {
    if (typeof Q !== 'undefined' && Q.set) Q.set('kraftstoff', val);
  }
})();

    // Schadstoffe / Umwelt / HU / Halter
    const schad       = document.getElementById("schadstoffklasse")?.value;
    const schadCustom = document.getElementById("custom-schadstoff")?.value?.trim();
    const schadFinal  = schadCustom || schad;
    if (schadFinal) qs.set("schadstoffklasse", schadFinal);
  
    const plakette = document.getElementById("plakette")?.value;
    if (plakette && plakette !== "Beliebig") qs.set("plakette", plakette);
  
    // Partikelfilter
    const pf = document.getElementById("partikelfilter");
    if (pf && pf.checked) qs.set("partikelfilter", "1");
  
 // Sonstige Merkmale + Unfallfrei
(function () {
  const m = [];

  // bleibt wie bisher: Scheckheft geht in "merkmale"
  if (document.getElementById('scheckheft')?.checked) {
    m.push('Scheckheftgepflegt');
  }

  if (m.length) {
    qs.set('merkmale', m.join(','));
  }

  // NEU: Unfallfrei als eigenes Flag
  const unfallCb = document.getElementById('unfallfrei');
  if (unfallCb && unfallCb.checked) {
    // Frontend-Flag -> /api/search muss das auf "unfall" === "keine" mappen
    qs.set('unfallfrei', '1');
  }
})();

  
    const huSel    = document.getElementById("hu-gueltig")?.value;
    const huCustom = document.getElementById("custom-hu")?.value?.trim();
    const huFinal  = huCustom || huSel;
    if (huFinal && huFinal !== "Beliebig") qs.set("hu", hyphenate(huFinal || "").trim() || huFinal);
  
    const halter = document.getElementById("fahrzeughalter")?.value;
    if (halter) qs.set("halter_max", halter);
  
    // Fahrzeugtyp
    (function collectVehicleTypes() {
      const vals = new Set();
      document.querySelectorAll('input[type="checkbox"][name="fahrzeugtyp"]:checked')
        .forEach(i => { const v = i.value?.trim(); if (v) vals.add(v); });
  
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
  
    // Farben + Lack-Finish
    (function () {
      const colorBox = document.querySelector(".color-selection");
      if (!colorBox) return;
  
      const picks = Array.from(colorBox.querySelectorAll('input[type="checkbox"]:checked'))
        .map(i => (i.value?.trim() || i.parentElement?.textContent?.trim()))
        .map(s => s && s.replace(/\s+/g, " ").trim())
        .filter(Boolean);
  
      if (picks.length) {
        const hasMetallic = picks.some(p => /^metallic$/i.test(p));
        const hasMatt     = picks.some(p => /^matt$/i.test(p));
        const pureColors  = picks.filter(p => !/^metallic$/i.test(p) && !/^matt$/i.test(p));
  
        if (pureColors.length) qs.set("farbe", Array.from(new Set(pureColors)).join(","));
        if (hasMetallic) qs.set("lack", "metallic");
        if (hasMatt)     qs.set("lack_matt", "1");
      }
    })();
  
    // page zurücksetzen
    qs.delete("page");
    return qs;
  }
  

  function hyphenate(s){ return String(s).replace(/\s+/g,' ').replace(/\s*-\s*/g,'-'); }

  async function ensureOrtCoordsIfNeeded() {
    const ortEl = document.getElementById("ort");
    const latEl = document.getElementById("ort-lat");
    const lonEl = document.getElementById("ort-lon");
    const umkreisSel = document.getElementById("umkreis");
    const customEl = document.getElementById("custom-umkreis");
  
    const ort = (ortEl?.value || "").trim();
    if (!ort) return;
  
    // Umkreis nur prüfen, wenn wirklich gesetzt
    let radius = (umkreisSel?.value || "").trim();
    if (radius === "custom") radius = String(customEl?.value || "").trim();
    if (!radius) return;
  
    // Wenn schon Koordinaten vorhanden -> fertig
    const lat = parseFloat(latEl?.value);
    const lon = parseFloat(lonEl?.value);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return;
  
    // Nachladen über /api/geosuggest
    try {
      const res = await fetch(`/api/geosuggest?q=${encodeURIComponent(ort)}&limit=1`);
      if (!res.ok) throw new Error("geosuggest not ok");
      const data = await res.json();
      const it = data?.items?.[0];
  
      if (it && Number.isFinite(it.lat) && Number.isFinite(it.lon)) {
        latEl.value = String(it.lat);
        lonEl.value = String(it.lon);
  
        // optional: Ort auf "sauberen" Wert setzen (Label/Value aus Suggest)
        if (it.value || it.label) ortEl.value = it.value || it.label;
        return;
      }
    } catch {}
  
    // Wenn Umkreis gesetzt ist, aber wir keine Koordinaten bekommen: erzwinge Auswahl aus Liste
    alert("Bitte wähle den Ort aus der Vorschlagsliste aus, damit der Umkreis korrekt funktioniert.");
  }
  
  async function goToSearch() {
    await ensureOrtCoordsIfNeeded();          // <<< DAS ist der fehlende Teil
    const qs = buildAdvancedQuery();
    window.location.href = `suche.html?${qs.toString()}`;
  }
  

  document.querySelector(".search-submit .submit-btn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await goToSearch();
  });
  
});

/* =========================
   Ort steuert Umkreis-Enable
   ========================= */
(() => {
  const ortInput   = document.getElementById("ort");
  const umkreisSel = document.getElementById("umkreis");
  if (!ortInput || !umkreisSel) return;

  const sync = () => {
    const hasLoc = !!ortInput.value.trim();
    umkreisSel.disabled = !hasLoc;
    if (!hasLoc) {
      umkreisSel.value = "";            // Beliebig
      window.toggleCustomUmkreis?.(""); // Custom verstecken & leeren
    }
  };
  ortInput.addEventListener("input", sync);
  ortInput.addEventListener("change", sync);
  sync();
})();
