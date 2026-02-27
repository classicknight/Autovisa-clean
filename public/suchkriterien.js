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
  const KW_TO_PS = 1.35962;
  const PS_TO_KW = 1 / KW_TO_PS;

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
    
      // Browser-Autofill/History bestmöglich unterdrücken
      ortInput.setAttribute("autocomplete", "new-password");
      ortInput.setAttribute("name", "ort_display");
      ortInput.setAttribute("autocorrect", "off");
      ortInput.setAttribute("autocapitalize", "off");
      ortInput.setAttribute("spellcheck", "false");
    
      const group = ortInput.closest(".search-group") || ortInput.parentElement;
      if (group) group.style.position = "relative";
    
      const box = document.createElement("div");
      box.className = "av-geo-suggest";
      box.style.display = "none";
      group.appendChild(box);
    
      let items = [];
      let active = -1;
      let abort = null;
      let lastPreferCity = false;
    
      // -------------------------
      // Local PLZ/Ort Index (/data/plz-de.json)
      // -------------------------
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
    
          // Erwartete Struktur:
          // { plz: "01067", ort: "Dresden", zusatz: null, bundesland: "Sachsen", country: "DE" }
          const normalized = Array.isArray(data)
            ? data.map((row) => {
                const postcode = String(row.postcode || row.plz || "").trim();
                const cityBase = String(row.city || row.ort || "").trim();
                const extra    = String(row.zusatz || "").trim();
                const city     = [cityBase, extra].filter(Boolean).join(" ").trim();
                const state    = String(row.state || row.bundesland || "").trim();
    
                const mainLabel = postcode ? `${postcode} ${city}` : city;
                const query     = state ? `${mainLabel}, ${state}` : mainLabel;
    
                return {
                  postcode,
                  city,
                  state,
                  mainLabel,
                  query,
                  plzLower:  postcode.toLowerCase(),
                  cityLower: city.toLowerCase(),
                  comboLower: query.toLowerCase(),
                };
              })
            : [];
    
          // Sort für schnellere Prefix-Treffer (bricht früher ab)
          normalized.sort((a, b) => a.comboLower.localeCompare(b.comboLower));
          plzIndex = normalized;
    
          plzLoaded = true;
        } catch (e) {
          console.warn("plz-de.json konnte nicht geladen werden – fallback auf /api/geosuggest.", e);
        } finally {
          plzLoading = false;
        }
      }
    
      const normalizeCityFromLabel = (label = "") =>
        String(label || "").replace(/^\s*\d{4,5}\s+/, "").trim();

      function localSuggest(term, preferCity) {
        if (!plzLoaded || !plzIndex.length) return [];
        const t = String(term || "").trim().toLowerCase();
        if (t.length < 2) return [];
    
        const MAX = 20;
        const out = [];
        const seen = new Set();
        const startsWithDigit = /^\d/.test(t);
    
        for (let i = 0; i < plzIndex.length; i++) {
          const it = plzIndex[i];
          if (startsWithDigit) {
            // PLZ-Suche
            if (it.plzLower && it.plzLower.startsWith(t)) out.push(it);
          } else {
            // Orts-Suche (Prefix)
            if (
              (it.cityLower && it.cityLower.startsWith(t)) ||
              (it.comboLower && it.comboLower.startsWith(t))
            ) {
              if (preferCity) {
                const cityKey = (it.cityLower || normalizeCityFromLabel(it.mainLabel).toLowerCase());
                const stateKey = String(it.state || "").toLowerCase();
                const key = `${cityKey}|${stateKey}`;
                if (key && seen.has(key)) continue;
                if (key) seen.add(key);
              }
              out.push(it);
            }
          }
          if (out.length >= MAX) break;
        }
        return out;
      }
    
      // -------------------------
      // UI Helpers
      // -------------------------
      const open = () => (box.style.display = "block");
      const close = () => {
        box.style.display = "none";
        box.innerHTML = "";
        items = [];
        active = -1;
      };
    
      const highlight = () => {
        box.querySelectorAll("button[data-idx]").forEach((b, i) => {
          b.style.background = i === active ? "rgba(0,184,169,0.12)" : "transparent";
        });
      };
    
      async function resolveCoordsFromApi(query) {
        const q = String(query || "").trim();
        if (!q) return null;
    
        try {
          const res = await fetch(`/api/geosuggest?q=${encodeURIComponent(q)}&limit=1`, {
            credentials: "omit",
          });
          if (!res.ok) return null;
          const data = await res.json();
          const it = data?.items?.[0];
          if (it && Number.isFinite(it.lat) && Number.isFinite(it.lon)) {
            return { lat: Number(it.lat), lon: Number(it.lon), value: it.value || it.label || "" };
          }
        } catch {}
        return null;
      }
    
      const select = async (idx) => {
        const it = items[idx];
        if (!it) return;
    
        // Wert setzen (für Query/Chip-Anzeige)
        ortInput.value = it.value || it.label || "";
        // Coords erstmal löschen, werden dann gefüllt
        ortLatEl.value = "";
        ortLonEl.value = "";
    
        // Wenn Suggest schon Coords hat -> direkt setzen
        if (Number.isFinite(it.lat) && Number.isFinite(it.lon)) {
          ortLatEl.value = String(it.lat);
          ortLonEl.value = String(it.lon);
          close();
          return;
        }
    
        // Local PLZ Treffer: einmalig Coords nachladen (damit Umkreis sauber funktioniert)
        const resolved = await resolveCoordsFromApi(it.query || it.value || it.label);
        if (resolved) {
          ortLatEl.value = String(resolved.lat);
          ortLonEl.value = String(resolved.lon);

          // optional: auf "sauberen" API-Wert normalisieren
          if (resolved.value && !lastPreferCity) ortInput.value = resolved.value;
        }
    
        close();
      };
    
      const render = () => {
        if (!items.length) return close();
    
        box.innerHTML = items
          .map((it, idx) => {
            const secondary = it.secondary
              ? `<div style="opacity:.75;font-size:.9em">${it.secondary}</div>`
              : "";
            return `
              <button type="button" data-idx="${idx}"
                style="display:block;width:100%;text-align:left;padding:12px 14px;border:0;background:transparent;color:inherit;cursor:pointer;font:inherit">
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
    
        open();
        highlight();
      };
    
      // -------------------------
      // Suggest Fetch (Local first, API fallback)
      // -------------------------
      const fetchSuggest = async (val) => {
        const q = String(val || "").trim();
        if (q.length < 2) return close();
        const preferCity = !/\d/.test(q);
        lastPreferCity = preferCity;
    
        // Local index lazy-loaden
        await ensurePlzIndex();
    
        // 1) Local Vorschläge (PLZ/Ort komplett)
        const local = localSuggest(q, preferCity);
        if (local.length) {
          items = local.map((x) => {
            const city = x.city || normalizeCityFromLabel(x.mainLabel);
            const state = x.state || "";
            const basePlz = x.postcode && x.city ? `${x.postcode} ${x.city}` : x.mainLabel;
            const baseCity = city || normalizeCityFromLabel(x.mainLabel) || x.mainLabel;
            const base = preferCity ? baseCity : basePlz;
            const label = state ? `${base}, ${state}` : base;
            return {
              label,
              value: label,
              query: label,
              secondary: state || "",
              lat: NaN,
              lon: NaN,
            };
          });
          active = -1;
          render();
          return;
        }
    
        // 2) Fallback: API
        try {
          if (abort) abort.abort();
          abort = new AbortController();
    
          const res = await fetch(`/api/geosuggest?q=${encodeURIComponent(q)}&limit=12`, {
            signal: abort.signal,
            credentials: "omit",
          });
    
          if (!res.ok) throw new Error("HTTP " + res.status);
          const data = await res.json();
    
          const arr = Array.isArray(data?.items) ? data.items : [];
          let mapped = arr
            .map((x) => {
              const city = String(x.city || "").trim() || normalizeCityFromLabel(x.label || x.value || "");
              const state = String(x.state || "").trim();
              const postcode = String(x.postcode || "").trim();
              const basePlz = postcode && city ? `${postcode} ${city}` : (x.label || x.value || "");
              const baseCity = city || normalizeCityFromLabel(x.label || x.value || "") || (x.label || x.value || "");
              const base = preferCity ? baseCity : basePlz;
              const label = state && base ? `${base}, ${state}` : base;
              return {
                label,
                value: label,
                query: label,
                secondary: state || "",
                lat: Number(x.lat),
                lon: Number(x.lon),
              };
            })
            .filter((it) => it.label);

          if (preferCity) {
            const seen = new Set();
            mapped = mapped.filter((it) => {
              const cityKey = normalizeCityFromLabel(it.label).toLowerCase();
              const stateKey = String(it.secondary || "").toLowerCase();
              const key = `${cityKey}|${stateKey}`;
              if (!cityKey) return false;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }

          items = mapped;

          active = -1;
          render();
        } catch (e) {
          if (e?.name !== "AbortError") close();
        }
      };
    
      // mini-debounce
      let t = null;
      const debounced = (val) => {
        clearTimeout(t);
        t = setTimeout(() => fetchSuggest(val), 80);
      };
    
      ortInput.addEventListener("input", () => {
        // User tippt frei -> Koords invalidieren bis er wählt / bis wir resolve machen
        ortLatEl.value = "";
        ortLonEl.value = "";
        debounced(ortInput.value);
      });
    
      ortInput.addEventListener("focus", async () => {
        // Index früh laden, damit es sich "instant" anfühlt
        ensurePlzIndex();
        debounced(ortInput.value);
      });
    
      ortInput.addEventListener("keydown", (e) => {
        if (box.style.display === "none") return;
    
        if (e.key === "ArrowDown") {
          e.preventDefault();
          active = Math.min(active + 1, items.length - 1);
          highlight();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          active = Math.max(active - 1, 0);
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
     let brandSyncing = false;
     let modellSyncing = false;
     let lastModellValues = [ALL_MODELS_VALUE];
     
     function setModelEnabled(enabled) {
       if (!modelDropdown) return;
     
       modelDropdown.disabled = !enabled;
     
       // SlimSelect UI mitziehen
       if (slimModell) {
         if (!enabled && typeof slimModell.disable === "function") slimModell.disable();
         if ( enabled && typeof slimModell.enable  === "function") slimModell.enable();
       }
     }

     function getSelectedBrandsRaw() {
       if (!brandDropdown) return [];
       return Array.from(brandDropdown.selectedOptions || [])
         .map(o => String(o.value || "").trim());
     }

     function getSelectedBrands() {
       return getSelectedBrandsRaw().filter(Boolean);
     }

     function setSelectedBrands(values) {
       const vals = (Array.isArray(values) ? values : [])
         .map(v => String(v || "").trim())
         .filter(Boolean);
       if (slimMarke && typeof slimMarke.setSelected === "function") {
         slimMarke.setSelected(vals);
         return;
       }
       if (!brandDropdown) return;
       for (const opt of brandDropdown.options) {
         opt.selected = vals.includes(opt.value);
       }
     }

     function normalizeBrandValues(values) {
       const raw = (Array.isArray(values) ? values : [])
         .map(v => String(v || "").trim());
       const cleaned = raw.filter(Boolean);
       if (raw.some(v => !v) && cleaned.length) {
         if (!brandSyncing) {
           brandSyncing = true;
           try { setSelectedBrands(cleaned); } finally { brandSyncing = false; }
         }
       }
       return cleaned;
     }
     

  // ⬇️⬇️ NEU: GUARD – nur initialisieren, wenn SlimSelect hier noch NICHT aktiv ist
  const _isSlim = el => !!(el && el.nextElementSibling && el.nextElementSibling.classList.contains('ss-main'));
  if (!_isSlim(brandDropdown) && !_isSlim(modelDropdown)) {

    // Gruppen-Definitionen
    const modelGroups = {
    "1er Reihe (Alle)": /^(1(1[0-9]|2[0-9]|3[0-9]|4[0-9]|14[0-9])|1er M Coupé)/i,

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
  closeOnSelect: false,
  placeholder: 'Beliebig (alle Marken)',
  allowDeselect: true,
  showSearch: true,
  events: {
    afterChange: (newSelected) => {
      if (brandSyncing) return;
      const raw = (newSelected || []).map(s => String(s.value || "").trim());
      const brands = normalizeBrandValues(raw);
      rebuildModelOptions(brands, lastModellValues);
    }
  }
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
      if (modellSyncing) return;
    
      const brands = getSelectedBrands();
      if (!brands.length) return; // Marke "Beliebig" -> keine Modell-Logik

      const singleBrand = brands.length === 1;
      const brand = singleBrand ? brands[0] : "";
      const allowGroups = singleBrand ? (ALLOW_GROUPS_FOR[brand] || []) : [];
      const currentVals = (newSelected || [])
        .map(s => canonAlle(s.value))
        .filter(Boolean);
    
      const hadAllBefore = lastModellValues.includes(ALL_MODELS_VALUE);
      const hasAllNow = currentVals.includes(ALL_MODELS_VALUE);
    
      // ✅ Wenn der User "Beliebig" aktiv anklickt: IMMER resetten auf nur Beliebig
      if (hasAllNow && !hadAllBefore) {
        lastModellValues = [ALL_MODELS_VALUE];
        modellSyncing = true;
        try { slimModell.setSelected([ALL_MODELS_VALUE]); } finally { modellSyncing = false; }
        return;
      }
    
      // Wenn "Beliebig" aktiv ist und der User etwas anderes auswählt -> "Beliebig" entfernen
      let vals = currentVals;
      if (hasAllNow && vals.length > 1) {
        vals = vals.filter(v => v !== ALL_MODELS_VALUE);
      }
    
      // Nur Beliebig ausgewählt -> fertig
      if (vals.length === 1 && vals[0] === ALL_MODELS_VALUE) {
        lastModellValues = [ALL_MODELS_VALUE];
        return;
      }
    
      const fullList = singleBrand
        ? sanitizeModelList(brandToModels[brand] || [])
        : unionModelsForBrands(brands);
      const nextSet  = new Set();
    
      vals.forEach(v => {
        const rx = modelGroups[v];
        const isAllowedGroup = singleBrand && rx && allowGroups.includes(v);
    
        if (isAllowedGroup) {
          fullList.forEach(m => {
            if (/\(alle\)/i.test(m)) return; // Gruppenlabel nicht als echtes Modell nutzen
            if (rx.test(m)) nextSet.add(m);
          });
        } else if (v && v !== ALL_MODELS_VALUE) {
          nextSet.add(v);
        }
      });
    
      const next   = nextSet.size ? [...nextSet] : [ALL_MODELS_VALUE];
      const nowKey = currentVals.slice().sort().join("|");
      const nxtKey = next.slice().sort().join("|");
    
      if (nowKey !== nxtKey) {
        lastModellValues = next;
        modellSyncing = true;
        try { slimModell.setSelected(next); } finally { modellSyncing = false; }
      } else {
        lastModellValues = currentVals.length ? currentVals : [ALL_MODELS_VALUE];
      }
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
    const canonAlle = (s) =>
      String(s ?? "").trim().replace(/\(\s*alle\s*\)/i, "(Alle)");
    
    let brandToModels = {};
    function sanitizeModelList(listRaw = []) {
      const seen = new Set();
      const clean = [];
      let hadAndere = false;

      for (const raw of listRaw) {
        if (raw == null) continue;
        const name = canonAlle(raw);

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
    function unionModelsForBrands(brands) {
      const seen = new Set();
      const out = [];
      for (const b of (brands || [])) {
        const list = sanitizeModelList((brandToModels && brandToModels[b]) || []);
        for (const m of list) {
          const key = m.toLowerCase();
          if (!seen.has(key)) { seen.add(key); out.push(m); }
        }
      }
      return out;
    }

    function rebuildModelOptions(brands, preselect = []) {
      if (!modelDropdown) return;
    
      const brandList = (Array.isArray(brands) ? brands : [brands])
        .map(b => String(b || "").trim())
        .filter(Boolean);
    
      // Marke = Beliebig -> Modell komplett deaktivieren und leeren
      if (!brandList.length) {
        if (slimModell) {
          slimModell.setData([]);
          modellSyncing = true;
          try { slimModell.setSelected([]); } finally { modellSyncing = false; }
        } else {
          modelDropdown.innerHTML = "";
          modelDropdown.value = "";
        }
        setModelEnabled(false);
        lastModellValues = [ALL_MODELS_VALUE];
        return;
      }
    
      setModelEnabled(true);
    
      const modelsRaw =
        (brandList.length === 1)
          ? sanitizeModelList((brandToModels && brandToModels[brandList[0]]) || [])
          : unionModelsForBrands(brandList);
      const models =
        (brandList.length === 1)
          ? modelsRaw
          : modelsRaw.filter(m => !modelGroups[m]);
    
      const data = [
        { text: "Beliebig (alle Modelle)", value: ALL_MODELS_VALUE },
        ...models.map(m => ({ text: m, value: m }))
      ];
    
      const valid = new Set(data.map(d => d.value));
      const wanted = (Array.isArray(preselect) ? preselect : [])
        .map(v => canonAlle(v))
        .filter(v => v && valid.has(v));
      const selected = wanted.length ? wanted : [ALL_MODELS_VALUE];

      if (slimModell) {
        slimModell.setData(data);
        modellSyncing = true;
        try { slimModell.setSelected(selected); } finally { modellSyncing = false; }
      } else {
        modelDropdown.innerHTML = "";
        data.forEach(({ text, value }) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = text;
          modelDropdown.appendChild(opt);
        });
        for (const opt of modelDropdown.options) {
          opt.selected = selected.includes(opt.value);
        }
      }
      lastModellValues = selected;
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
        if (slimMarke) return; // SlimSelect handled im afterChange
        const raw = getSelectedBrandsRaw();
        const brands = normalizeBrandValues(raw);
        rebuildModelOptions(brands, lastModellValues); // handled auch brand="" sauber
      });
      

// URL-Parameter übernehmen
const qs = new URLSearchParams(location.search);
const splitCsv = (v) =>
  v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : [];

// 1) Marken aus URL
const qBrands = splitCsv(qs.get("marke"));

if (brandDropdown) {
  if (qBrands.length) {
    setSelectedBrands(qBrands);
    rebuildModelOptions(qBrands);
  } else {
    const current = getSelectedBrands();
    rebuildModelOptions(current);
  }
}

const qModels = splitCsv(qs.get("modell"))
  .map(canonAlle)
  .filter(Boolean);

if (qModels.length) {
  const brands = qBrands.length ? qBrands : getSelectedBrands();

  // Wenn keine Marke -> Modelle ignorieren (Modell ist dann sowieso disabled)
  if (brands.length) {
    const singleBrand = brands.length === 1;
    const brand = singleBrand ? brands[0] : "";
    const list = singleBrand
      ? sanitizeModelList((brandToModels[brand] || []).map(String))
      : unionModelsForBrands(brands);
    const allowedForBrand = singleBrand ? (ALLOW_GROUPS_FOR[brand] || []) : [];
    const expanded = new Set();

    for (const item of qModels) {
      if (singleBrand && allowedForBrand.includes(item) && modelGroups[item]) {
        const rx = modelGroups[item];
        list.forEach(m => { if (!/\(alle\)/i.test(m) && rx.test(m)) expanded.add(m); });
      } else if (list.includes(item)) {
        expanded.add(item);
      }
    }

    const vals = expanded.size ? [...expanded] : [ALL_MODELS_VALUE];

    // ✅ SlimSelect korrekt setzen
    if (slimModell && typeof slimModell.setSelected === "function") {
      modellSyncing = true;
      try { slimModell.setSelected(vals); } finally { modellSyncing = false; }
    } else if (modelDropdown) {
      for (const opt of modelDropdown.options) opt.selected = vals.includes(opt.value);
      modelDropdown.dispatchEvent(new Event("change"));
    }
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

      // Leistung + Einheit aus URL
      const powerUnitQS = (qs.get("power_unit") || "ps").toLowerCase();
      const powerUnitEl = document.getElementById("leistung-einheit");
      if (powerUnitEl) powerUnitEl.value = powerUnitQS === "kw" ? "kw" : "ps";

      const psMinQS = qs.get("ps_min");
      const psMaxQS = qs.get("ps_max");
      const powerFromEl = document.getElementById("leistung-von");
      const powerToEl = document.getElementById("leistung-bis");
      const psToKw = (v) => {
        const n = parseFloat(String(v || "").replace(",", "."));
        return Number.isFinite(n) ? Math.round(n * PS_TO_KW) : null;
      };
      if (psMinQS && powerFromEl) {
        powerFromEl.value = (powerUnitQS === "kw") ? (psToKw(psMinQS) ?? "") : psMinQS;
      }
      if (psMaxQS && powerToEl) {
        powerToEl.value = (powerUnitQS === "kw") ? (psToKw(psMaxQS) ?? "") : psMaxQS;
      }

      // Sitze (mindestens)
      const seatsMinQS = qs.get("sitze_min") || qs.get("sitze");
      const seatsEl = document.getElementById("sitze");
      if (seatsMinQS && seatsEl) seatsEl.value = seatsMinQS;

      // Anbieter
      const anbieterQS = qs.get("anbieter");
      const anbieterEl = document.getElementById("anbieter");
      if (anbieterQS && anbieterEl) anbieterEl.value = anbieterQS;

      // MwSt. ausweisbar
      const mwstQS = qs.get("mwst");
      const mwstEl = document.getElementById("mwst-ausweisbar");
      if (mwstQS && mwstEl) mwstEl.checked = ["1", "true", "ja", "yes", "on"].includes(String(mwstQS).toLowerCase());

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

// Ausstattung (Mehrfach)
const equipValues = splitCsv(qs.get("ausstattung")).map(v => v.toLowerCase());
if (equipValues.length) {
  const mapEquipToken = (t) => {
    const s = String(t || "").toLowerCase();
    if (!s) return "";
    if (/(rueckfahr|rückfahr|rear|backup).*(kamera|camera)/.test(s)) return "rueckfahrkamera";
    if (/(scheinwerfer|xenon|bi-?xenon|matrix|led|laser)/.test(s)) return "scheinwerfer";
    if (/navigation|navi/.test(s)) return "navigation";
    if (/sitzheizung/.test(s)) return "sitzheizung";
    if (/bluetooth|freispre/.test(s)) return "bluetooth";
    if (/panorama|schiebedach/.test(s)) return "panorama";
    if (/carplay/.test(s)) return "applecarplay";
    if (/android/.test(s)) return "androidauto";
    if (/isofix/.test(s)) return "isofix";
    return s;
  };

  const normalized = equipValues.map(mapEquipToken).filter(Boolean);
  document
    .querySelectorAll('.equipment-grid input[type="checkbox"]')
    .forEach(inp => {
      const val = (inp.value || "").toLowerCase();
      inp.checked = normalized.includes(val);
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
  initSlim('#sitze',           { placeholder: 'Sitze',           allowDeselect: true, showSearch: false });
  initSlim('#anbieter',        { placeholder: 'Anbieter',        allowDeselect: true, showSearch: false });

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

  // HU Custom (optional)
  window.toggleCustomHU = function(value) {
    const wrap = document.getElementById('custom-hu-wrapper');
    const input = document.getElementById('custom-hu');
    if (!wrap) return;
    const isCustom = String(value || '').toLowerCase() === 'custom';
    wrap.style.display = isCustom ? 'block' : 'none';
    if (!isCustom && input) input.value = '';
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

  // Leistungseinheit (PS / kW)
  const powerUnitEl = document.getElementById('leistung-einheit');
  const powerFromEl = document.getElementById('leistung-von');
  const powerToEl   = document.getElementById('leistung-bis');
  const powerLabelEl = document.getElementById('leistung-unit-label');

  function syncPowerUnitUI() {
    if (!powerUnitEl) return;
    const unit = (powerUnitEl.value || 'ps').toLowerCase();
    const unitText = unit === 'kw' ? 'kW' : 'PS';
    if (powerLabelEl) powerLabelEl.textContent = `(${unitText})`;
    if (powerFromEl) powerFromEl.placeholder = `von ${unitText}`;
    if (powerToEl) powerToEl.placeholder = `bis ${unitText}`;
  }

  powerUnitEl?.addEventListener('change', syncPowerUnitUI);
  syncPowerUnitUI();

  initSlim('#verbrauch-select', {
    allowDeselect: true,
    showSearch: false,
    placeholder: 'Beliebig',
    events: { afterChange: () => syncVerbrauchUI() }
  });

  /* =========================
     Button "Fahrzeuge anzeigen" → suche.html
     ========================= */
  function _numFallback(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;

    let s = String(v).trim();
    if (!s) return null;

    s = s.replace(/[\u202F\u00A0\s]/g, "").replace(/[€]/g, "");

    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      const decPos = Math.max(lastComma, lastDot);
      const intPart = s.slice(0, decPos).replace(/[.,]/g, "");
      const fracPart = s.slice(decPos + 1).replace(/[.,]/g, "");
      s = `${intPart}.${fracPart}`;
    } else if (hasComma || hasDot) {
      const sep = hasComma ? "," : ".";
      const parts = s.split(sep);
      if (parts.length === 2) {
        const frac = parts[1];
        if (/^\d{1,2}$/.test(frac)) {
          s = parts[0].replace(/[.,]/g, "") + "." + frac;
        } else {
          s = s.replace(/[.,]/g, "");
        }
      } else {
        s = s.replace(/[.,]/g, "");
      }
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function buildAdvancedQuery() {
    const qs = new URLSearchParams();
    const numLocal = (typeof window.num === "function") ? window.num : _numFallback;
  
    // Marke (Mehrfach)
    const brandEl = document.getElementById("marke") || window.brandDropdown;
    const brandVals = (() => {
      if (!brandEl) return [];
      if (brandEl.selectedOptions) {
        return Array.from(brandEl.selectedOptions || [])
          .map(o => String(o.value || "").trim())
          .filter(Boolean);
      }
      const v = String(brandEl.value || "").trim();
      return v ? [v] : [];
    })();
    if (brandVals.length) qs.set("marke", Array.from(new Set(brandVals)).join(","));
  
    // Modelle
    (function collectModels() {
      const sel = document.getElementById("modell");
      if (!sel) return;
    
      // NEU: wenn keine Marke gewählt, niemals modell mitsenden
      if (!brandVals.length) return;
    
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

    // Sitze (mindestens)
    const sitze = document.getElementById("sitze")?.value?.trim();
    if (sitze) qs.set("sitze_min", sitze);
  
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
    const hasOrt = !!ort;
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
      if (radius) {
        qs.set("umkreis", radius);
      } else if (hasOrt) {
        // Default: wenn Ort gesetzt ist, aber kein Umkreis gewählt → 100 km
        radius = "100";
        umkreisSel.value = radius;
        window.toggleCustomUmkreis?.(radius);
        qs.set("umkreis", radius);
      }
    }
  
    // Leistung / Hubraum
    const rawPowerMin = _numFallback(document.getElementById("leistung-von")?.value);
    const rawPowerMax = _numFallback(document.getElementById("leistung-bis")?.value);
    const powerUnit = (document.getElementById("leistung-einheit")?.value || "ps").toLowerCase();
    let psMin = rawPowerMin;
    let psMax = rawPowerMax;
    if (powerUnit === "kw") {
      if (rawPowerMin != null && rawPowerMin > 0) psMin = Math.ceil(rawPowerMin * KW_TO_PS);
      if (rawPowerMax != null && rawPowerMax > 0) psMax = Math.floor(rawPowerMax * KW_TO_PS);
      qs.set("power_unit", "kw");
    }
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

    // Anbieter (Händler/Privat)
    const anbieter = document.getElementById("anbieter")?.value?.trim();
    if (anbieter) qs.set("anbieter", anbieter);
  
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

const schadSel = (document.getElementById("schadstoffklasse")?.value || "").trim();
const schadCustom = (document.getElementById("custom-schadstoff")?.value || "").trim();

if (schadSel === "custom") {
  if (schadCustom) qs.set("schadstoffklasse", schadCustom);
} else if (schadSel) {
  qs.set("schadstoffklasse", schadSel);
}

  
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

    // MwSt. ausweisbar
    const mwstEl = document.getElementById("mwst-ausweisbar");
    if (mwstEl && mwstEl.checked) qs.set("mwst", "1");

    // Ausstattung (Mehrfach)
    (function () {
      const equipBox = document.querySelector(".equipment-grid");
      if (!equipBox) return;
      const picks = Array.from(equipBox.querySelectorAll('input[type="checkbox"]:checked'))
        .map(i => (i.value || "").trim())
        .filter(Boolean);
      if (picks.length) qs.set("ausstattung", picks.join(","));
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
/* =========================
   Active Filters Bar (Chips) – TOP sticky dynamisch (unter Navbar wenn sichtbar)
   ========================= */
   (function initActiveFiltersBar() {
    const section = document.querySelector('.search-section');
    if (!section) return;
  
    // Bar DOM
    const bar = document.createElement('div');
    bar.className = 'av-filterbar';
    bar.innerHTML = `
      <div class="av-filterbar__head">
        <div class="av-filterbar__title">
          <span class="av-filterbar__badge" id="avFilterCount">0</span>
          <span>Aktive Filter</span>
        </div>
        <button type="button" class="av-filterbar__reset" id="avFilterReset">Zurücksetzen</button>
      </div>
      <div class="av-filterbar__chips" id="avFilterChips" aria-label="Aktive Filter"></div>
    `;
  
    // ✅ Unter Navbar einfügen (nicht auf Navbar, nicht unten)
    const nav = document.querySelector('.navbar');
    if (nav) nav.insertAdjacentElement('afterend', bar);
    else document.body.prepend(bar);
  
    // ✅ Dynamischer "top"-Offset (robust, ohne IntersectionObserver):
    // - Navbar sichtbar: unter Navbar
    // - Navbar weg: ganz oben (BASE_TOP_GAP)
    const BASE_TOP_GAP = 12;
  
    function updateFilterbarTop() {
      if (!nav) {
        document.documentElement.style.setProperty('--av-filterbar-top', `${BASE_TOP_GAP}px`);
        return;
      }
  
      const rect = nav.getBoundingClientRect();
      const navVisible = rect.bottom > 0 && rect.top < window.innerHeight;
  
      const h = Math.round(rect.height) || 96;
      const top = navVisible ? (h + BASE_TOP_GAP) : BASE_TOP_GAP;
  
      // Sicherheits-Clamp, damit es auf Mobile nie "mittig" wegrutscht
      const clamped = Math.max(BASE_TOP_GAP, Math.min(top, 140));
  
      document.documentElement.style.setProperty('--av-filterbar-top', `${clamped}px`);
    }
  
    // Initial + live Updates
    updateFilterbarTop();
    window.addEventListener('scroll', updateFilterbarTop, { passive: true });
    window.addEventListener('resize', updateFilterbarTop);
  
    const countEl = bar.querySelector('#avFilterCount');
    const chipsEl = bar.querySelector('#avFilterChips');
    const resetBtn = bar.querySelector('#avFilterReset');
  
    const fmtInt = (n) => {
      const x = Number(n);
      return Number.isFinite(x) ? x.toLocaleString('de-DE') : '';
    };
    const fmtEUR = (n) => {
      const x = Number(n);
      return Number.isFinite(x) ? `${x.toLocaleString('de-DE')} €` : '';
    };
    const fmtYM = (ym) => {
      const s = String(ym || '').trim();
      if (!/^\d{4}-\d{2}$/.test(s)) return s;
      const [y, m] = s.split('-');
      return `${m}/${y}`;
    };
  
    const fuelLabel = (t) => {
      const k = String(t || '').trim().toLowerCase();
      const map = {
        'benzin': 'Benzin',
        'diesel': 'Diesel',
        'elektro': 'Elektro',
        'hybrid': 'Hybrid',
        'hybrid-benzin': 'Hybrid (Benzin)',
        'hybrid-diesel': 'Hybrid (Diesel)',
        'plug-in-hybrid': 'Plug-in-Hybrid',
        'plug-in-hybrid-benzin': 'Plug-in-Hybrid (Benzin)',
        'wasserstoff': 'Wasserstoff',
        'autogas': 'Autogas (LPG)',
        'lpg': 'Autogas (LPG)',
        'cng': 'Erdgas (CNG)',
        'ethanol': 'Ethanol (E85)',
        'andere': 'Andere'
      };
      return map[k] || t;
    };
  
    const getriebeLabel = (t) => {
      const k = String(t || '').trim().toLowerCase();
      if (k === 'automatik') return 'Automatik';
      if (k === 'schaltgetriebe' || k === 'schalter' || k === 'manuell') return 'Schaltgetriebe';
      return t;
    };
  
    const deHyphen = (s) => String(s || '').replace(/\s*-\s*/g, '-').replace(/-/g, ' ');
  
    function setSelectToDefault(sel) {
      if (!sel) return;
      const hasEmpty = Array.from(sel.options || []).some(o => o.value === '');
      if (hasEmpty) sel.value = '';
      else sel.selectedIndex = 0;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  
    function clearMultiSelect(sel) {
      if (!sel) return;
      Array.from(sel.options || []).forEach(o => o.selected = false);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  
    function uncheckAll(selector) {
      document.querySelectorAll(selector).forEach(cb => {
        if (cb && cb.checked) cb.checked = false;
      });
    }
  
    function hideAndClear(idWrap, idInput) {
      const w = document.getElementById(idWrap);
      const i = document.getElementById(idInput);
      if (w) w.style.display = 'none';
      if (i) i.value = '';
    }
  
    function clearGroup(group) {
      switch (group) {
  
        case 'price':
          (document.getElementById('preis-von') || {}).value = '';
          (document.getElementById('preis-bis') || {}).value = '';
          break;
  
        case 'km':
          (document.getElementById('km-von') || {}).value = '';
          (document.getElementById('km-bis') || {}).value = '';
          break;
  
        case 'ps':
          (document.getElementById('leistung-von') || {}).value = '';
          (document.getElementById('leistung-bis') || {}).value = '';
          {
            const unitEl = document.getElementById('leistung-einheit');
            if (unitEl) unitEl.value = 'ps';
            if (typeof syncPowerUnitUI === 'function') syncPowerUnitUI();
          }
          break;
  
        case 'ccm':
          (document.getElementById('hubraum-von') || {}).value = '';
          (document.getElementById('hubraum-bis') || {}).value = '';
          break;
  
        case 'ez':
          (document.getElementById('ez-von') || {}).value = '';
          (document.getElementById('ez-bis') || {}).value = '';
          setSelectToDefault(document.getElementById('ez-von-year'));
          setSelectToDefault(document.getElementById('ez-von-month'));
          setSelectToDefault(document.getElementById('ez-bis-year'));
          setSelectToDefault(document.getElementById('ez-bis-month'));
          break;
  
        case 'marke': {
          const brandSel = document.getElementById('marke');
          if (typeof slimMarke !== 'undefined' && slimMarke && typeof slimMarke.setSelected === 'function') {
            slimMarke.setSelected([]);
          } else if (brandSel) {
            if (brandSel.multiple) clearMultiSelect(brandSel);
            else brandSel.value = '';
            brandSel.dispatchEvent(new Event('change', { bubbles: true }));
          }

          if (typeof rebuildModelOptions === 'function') {
            rebuildModelOptions([]);
          } else if (typeof setModelEnabled === 'function') {
            setModelEnabled(false);
          }
          if (typeof slimModell !== 'undefined' && slimModell && typeof slimModell.setSelected === 'function') {
            try { slimModell.setSelected([ALL_MODELS_VALUE]); } catch {}
          } else {
            const mSel = document.getElementById('modell');
            if (mSel) clearMultiSelect(mSel);
          }
          break;
        }
  
        case 'modell': {
          if (typeof slimModell !== 'undefined' && slimModell && typeof slimModell.setSelected === 'function') {
            try { slimModell.setSelected([ALL_MODELS_VALUE]); } catch {}
          } else {
            const mSel = document.getElementById('modell');
            if (mSel) clearMultiSelect(mSel);
          }
          break;
        }
  
        case 'modVar':
          (document.getElementById('modellausfuehrung') || {}).value = '';
          break;
  
        case 'tueren':
          setSelectToDefault(document.getElementById('tueren'));
          break;

        case 'sitze':
          setSelectToDefault(document.getElementById('sitze'));
          break;
  
        case 'ort':
          (document.getElementById('ort') || {}).value = '';
          (document.getElementById('ort-lat') || {}).value = '';
          (document.getElementById('ort-lon') || {}).value = '';
          setSelectToDefault(document.getElementById('umkreis'));
          hideAndClear('custom-umkreis-wrap', 'custom-umkreis');
          window.toggleCustomUmkreis?.('');
          break;
  
        case 'umkreis':
          setSelectToDefault(document.getElementById('umkreis'));
          window.toggleCustomUmkreis?.('');
          (document.getElementById('custom-umkreis') || {}).value = '';
          break;
  
        case 'verbrauch':
          setSelectToDefault(document.getElementById('verbrauch-select'));
          (document.getElementById('verbrauch') || {}).value = '';
          {
            const vbWrap = document.getElementById('verbrauch-custom-wrap');
            if (vbWrap) vbWrap.style.display = 'none';
          }
          break;
  
        case 'getriebe':
          uncheckAll('input[type="checkbox"][value="Automatik"], input[type="checkbox"][value="Schaltgetriebe"]');
          break;

        case 'anbieter':
          setSelectToDefault(document.getElementById('anbieter'));
          break;
  
        case 'antrieb':
          uncheckAll('input[type="checkbox"][value="Frontantrieb"], input[type="checkbox"][value="Heckantrieb"], input[type="checkbox"][value="Allradantrieb"]');
          break;
  
        case 'kraftstoff':
          uncheckAll('.fuel-type-grid input[type="checkbox"]');
          break;
  
        case 'schadstoff':
          setSelectToDefault(document.getElementById('schadstoffklasse'));
          window.toggleCustomSchadstoff?.('');
          (document.getElementById('custom-schadstoff') || {}).value = '';
          break;
  
        case 'plakette':
          setSelectToDefault(document.getElementById('plakette'));
          break;
  
        case 'partikelfilter': {
          const pf = document.getElementById('partikelfilter');
          if (pf) pf.checked = false;
          break;
        }
  
        case 'merkmale': {
          const sh = document.getElementById('scheckheft');
          if (sh) sh.checked = false;
          break;
        }

        case 'mwst': {
          const mw = document.getElementById('mwst-ausweisbar');
          if (mw) mw.checked = false;
          break;
        }

        case 'ausstattung':
          uncheckAll('.equipment-grid input[type="checkbox"]');
          break;
  
        case 'unfallfrei': {
          const uf = document.getElementById('unfallfrei');
          if (uf) uf.checked = false;
          break;
        }
  
        case 'hu':
          setSelectToDefault(document.getElementById('hu-gueltig'));
          hideAndClear('custom-hu-wrapper', 'custom-hu');
          break;
  
        case 'halter':
          setSelectToDefault(document.getElementById('fahrzeughalter'));
          break;
  
        case 'fahrzeugtyp':
          uncheckAll('input[type="checkbox"][name="fahrzeugtyp"]');
          break;
  
        case 'farbe':
          uncheckAll('.color-selection input[type="checkbox"]');
          break;
  
        default:
          break;
      }
  
      section.dispatchEvent(new Event('change', { bubbles: true }));
      section.dispatchEvent(new Event('input', { bubbles: true }));
      update();
    }
  
    function resetAll() {
      [
        'preis-von', 'preis-bis', 'km-von', 'km-bis', 'leistung-von', 'leistung-bis',
        'hubraum-von', 'hubraum-bis',
        'modellausfuehrung', 'ort', 'ort-lat', 'ort-lon',
        'custom-umkreis', 'verbrauch', 'custom-schadstoff', 'custom-hu',
        'ez-von', 'ez-bis'
      ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
  
      clearGroup('marke');
  
      document.querySelectorAll('.search-section select').forEach(sel => {
        if (!sel || sel.id === 'marke' || sel.id === 'modell') return;
        if (sel.multiple) clearMultiSelect(sel);
        else setSelectToDefault(sel);
      });
  
      uncheckAll('.search-section input[type="checkbox"]');

      window.toggleCustomUmkreis?.('');
      window.toggleCustomSchadstoff?.('');
      hideAndClear('custom-hu-wrapper', 'custom-hu');

      const vbWrap = document.getElementById('verbrauch-custom-wrap');
      if (vbWrap) vbWrap.style.display = 'none';

      if (typeof syncPowerUnitUI === 'function') syncPowerUnitUI();

      const ortEl = document.getElementById('ort');
      ortEl?.dispatchEvent(new Event('input', { bubbles: true }));
  
      update();
    }
  
    function addChip(text, group) {
      const chip = document.createElement('div');
      chip.className = 'av-chip';
      chip.innerHTML = `
        <span class="av-chip__text">${text}</span>
        <button type="button" class="av-chip__x" aria-label="Filter entfernen">×</button>
      `;
      chip.querySelector('.av-chip__x')?.addEventListener('click', () => clearGroup(group));
      chipsEl.appendChild(chip);
    }
  
    function update() {
      const qs = buildAdvancedQuery();
      qs.delete('ort_lat');
      qs.delete('ort_lon');
  
      const get = (k) => qs.get(k);
      const powerUnit = (get('power_unit') || 'ps').toLowerCase();
      const powerUnitText = powerUnit === 'kw' ? 'kW' : 'PS';
      const toPowerDisplay = (psVal) => {
        const n = Number(psVal);
        if (!Number.isFinite(n)) return null;
        return powerUnit === 'kw' ? Math.round(n * PS_TO_KW) : Math.round(n);
      };
  
      chipsEl.innerHTML = '';
      let count = 0;
  
      const pMin = get('price_min');
      const pMax = get('price_max');
      if (pMin || pMax) {
        addChip(`Preis: ${(pMin ? fmtEUR(pMin) : '…')} – ${(pMax ? fmtEUR(pMax) : '…')}`, 'price');
        count++;
      }
  
      const kmMin = get('km_min');
      const kmMax = get('km_max');
      if (kmMin || kmMax) {
        addChip(`Kilometer: ${(kmMin ? `${fmtInt(kmMin)} km` : '…')} – ${(kmMax ? `${fmtInt(kmMax)} km` : '…')}`, 'km');
        count++;
      }
  
      const psMin = get('ps_min');
      const psMax = get('ps_max');
      if (psMin || psMax) {
        const dMin = psMin ? toPowerDisplay(psMin) : null;
        const dMax = psMax ? toPowerDisplay(psMax) : null;
        addChip(`Leistung: ${(dMin != null ? `${fmtInt(dMin)} ${powerUnitText}` : '…')} – ${(dMax != null ? `${fmtInt(dMax)} ${powerUnitText}` : '…')}`, 'ps');
        count++;
      }
  
      const cMin = get('ccm_min');
      const cMax = get('ccm_max');
      if (cMin || cMax) {
        addChip(`Hubraum: ${(cMin ? `${fmtInt(cMin)} cm³` : '…')} – ${(cMax ? `${fmtInt(cMax)} cm³` : '…')}`, 'ccm');
        count++;
      }
  
      const ezFrom = get('ezFrom');
      const ezTo = get('ezTo');
      if (ezFrom || ezTo) {
        addChip(`Erstzulassung: ${(ezFrom ? fmtYM(ezFrom) : '…')} – ${(ezTo ? fmtYM(ezTo) : '…')}`, 'ez');
        count++;
      }
  
      const brand = get('marke');
      if (brand) {
        const parts = brand.split(',').map(s => s.trim()).filter(Boolean);
        const nice = parts.length > 3 ? `${parts.slice(0, 3).join(', ')} +${parts.length - 3}` : parts.join(', ');
        addChip(`Marke${parts.length > 1 ? 'n' : ''}: ${nice}`, 'marke');
        count++;
      }
  
      const modell = get('modell');
      if (modell) {
        const parts = modell.split(',').map(s => s.trim()).filter(Boolean);
        const nice = parts.length > 3 ? `${parts.slice(0, 3).join(', ')} +${parts.length - 3}` : parts.join(', ');
        addChip(`Modell: ${nice}`, 'modell'); count++;
      }
  
      const modVar = get('modellausfuehrung');
      if (modVar) {
        const parts = modVar.split(',').map(s => s.trim()).filter(Boolean);
        const nice = parts.length > 3 ? `${parts.slice(0, 3).join(', ')} +${parts.length - 3}` : parts.join(', ');
        addChip(`Variante${parts.length > 1 ? 'n' : ''}: ${nice}`, 'modVar');
        count++;
      }
  
      const tueren = get('tueren');
      if (tueren) { addChip(`Türen: ${tueren}`, 'tueren'); count++; }

      const sitze = get('sitze_min') || get('sitze');
      if (sitze) { addChip(`Sitze: ab ${sitze}`, 'sitze'); count++; }
  
      const ort = get('ort');
      if (ort) { addChip(`Ort: ${ort}`, 'ort'); count++; }
  
      const umkreis = get('umkreis');
      if (umkreis) { addChip(`Umkreis: ${umkreis} km`, 'umkreis'); count++; }
  
      const vMax = get('verbrauch_max');
      if (vMax) { addChip(`Verbrauch: ≤ ${String(vMax).replace('.', ',')} l/100 km`, 'verbrauch'); count++; }
  
      const getr = get('getriebe');
      if (getr) { addChip(`Getriebe: ${getriebeLabel(getr)}`, 'getriebe'); count++; }

      const anbieter = get('anbieter');
      if (anbieter) {
        const label = anbieter.toLowerCase().includes("haend") || anbieter.toLowerCase().includes("händ")
          ? "Händler"
          : "Privat";
        addChip(`Anbieter: ${label}`, 'anbieter');
        count++;
      }
  
      const antrieb = get('antrieb');
      if (antrieb) {
        const parts = antrieb.split(',').map(s => s.trim()).filter(Boolean);
        addChip(`Antrieb: ${parts.join(', ')}`, 'antrieb');
        count++;
      }
  
      const kf = get('kraftstoff');
      if (kf) {
        const parts = kf.split(',').map(s => s.trim()).filter(Boolean).map(fuelLabel);
        const nice = parts.length > 3 ? `${parts.slice(0, 3).join(', ')} +${parts.length - 3}` : parts.join(', ');
        addChip(`Kraftstoff: ${nice}`, 'kraftstoff');
        count++;
      }
  
      const sk = get('schadstoffklasse');
      if (sk) { addChip(`Schadstoff: ${sk}`, 'schadstoff'); count++; }
  
      const pl = get('plakette');
      if (pl) { addChip(`Plakette: ${pl}`, 'plakette'); count++; }
  
      const pf = get('partikelfilter');
      if (pf) { addChip(`Partikelfilter`, 'partikelfilter'); count++; }
  
      const merkmale = get('merkmale');
      if (merkmale) {
        const parts = merkmale.split(',').map(s => s.trim()).filter(Boolean);
        addChip(`Merkmale: ${parts.join(', ')}`, 'merkmale');
        count++;
      }

      const ausstattung = get('ausstattung');
      if (ausstattung) {
        const parts = ausstattung.split(',').map(s => s.trim()).filter(Boolean);
        const nice = parts.length > 4 ? `${parts.slice(0, 4).join(', ')} +${parts.length - 4}` : parts.join(', ');
        addChip(`Ausstattung: ${nice}`, 'ausstattung');
        count++;
      }

      const mwst = get('mwst');
      if (mwst) { addChip(`MwSt. ausweisbar`, 'mwst'); count++; }
  
      const uf = get('unfallfrei');
      if (uf) { addChip(`Unfallfrei`, 'unfallfrei'); count++; }
  
      const hu = get('hu');
      if (hu) { addChip(`HU: ${deHyphen(hu)}`, 'hu'); count++; }
  
      const halter = get('halter_max');
      if (halter) { addChip(`Halter: ≤ ${halter}`, 'halter'); count++; }
  
      const ft = get('fahrzeugtyp');
      if (ft) {
        const parts = ft.split(',').map(s => s.trim()).filter(Boolean);
        const nice = parts.length > 3 ? `${parts.slice(0, 3).join(', ')} +${parts.length - 3}` : parts.join(', ');
        addChip(`Fahrzeugtyp: ${nice}`, 'fahrzeugtyp');
        count++;
      }
  
      const farbe = get('farbe');
      if (farbe) {
        const parts = farbe.split(',').map(s => s.trim()).filter(Boolean);
        const nice = parts.length > 5 ? `${parts.slice(0, 5).join(', ')} +${parts.length - 5}` : parts.join(', ');
        addChip(`Farbe: ${nice}`, 'farbe');
        count++;
      }
  
      // Anzeige
      countEl.textContent = String(count);
      if (count > 0) bar.classList.add('is-visible');
      else bar.classList.remove('is-visible');
    }
  
    // Live-Updates
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
  
    section.addEventListener('input', schedule, true);
    section.addEventListener('change', schedule, true);
  
    // Reset Button
    resetBtn.addEventListener('click', resetAll);
  
    // Initial
    update();
  })();
  
  

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
