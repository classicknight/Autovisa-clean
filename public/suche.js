// suche.js — TEIL 1 (korrigiert bis inkl. initMediaSlider)
document.documentElement.classList.remove("no-js");

// === Query-Params + Utils ===
const QP = (() => {
  const sp = new URLSearchParams(location.search);
  const arr = (v) => (v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : []);
  return {
    marke: sp.get("marke") || "",
    modell: arr(sp.get("modell")),
    ezFrom: sp.get("ezFrom") || "",
    km_max: sp.get("km_max") || "",
    price_max: sp.get("price_max") || "",
    getriebe: (sp.get("getriebe") || "").toLowerCase(),
    kraftstoff: (sp.get("kraftstoff") || "").toLowerCase(),
    ort: sp.get("ort") || "",
    umkreis: sp.get("umkreis") || "",
    sort: sp.get("sort") || ""         // <-- NEU
  };
})();


const norm = (s) => String(s || "").toLowerCase();
const toNum = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  return Number(String(v).replace(/\./g, "").replace(",", "."));
};

document.addEventListener("DOMContentLoaded", () => {
  // ===== DOM Refs =====
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");

  const toggleBtn     = document.getElementById("toggleFiltersBtn");
  const sidebar       = document.querySelector(".filter-sidebar");

  const searchLink    = document.querySelector('a[href="#search-section"]');
  const makeInput     = document.getElementById("marke");
  const modelInput    = document.getElementById("modell");
  const titleInput    = document.getElementById("title");

  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");

  const container     = document.getElementById("carResults");
  const pager         = document.getElementById("pager");
  const sortBy        = document.getElementById("sortBy");
  const applyFilters  = document.getElementById("applyFiltersBtn");

  // --- Prefill aus URL in die UI ---
  (function prefillFromQuery(){
    const markeEl   = document.getElementById("marke");
    const modellEl  = document.getElementById("modell");

    const priceToEl = document.getElementById("priceTo");
    const kmToEl    = document.getElementById("mileageTo");

    const fuelEl    = document.getElementById("fuelType") || document.getElementById("fuel");
    const gearEl    = document.getElementById("transmission") || document.getElementById("gear");

    const firstRegMonthEl = document.getElementById("first-registration-month");
    const firstRegYearEl  = document.getElementById("first-registration-year");
    const firstRegFromEl  = document.getElementById("firstRegFrom"); // <input type="month">

    if (markeEl && QP.marke) markeEl.value = QP.marke;

    if (modellEl && Array.isArray(QP.modell) && QP.modell.length){
      const set = new Set(QP.modell.map(v => v.toLowerCase()));
      [...modellEl.options].forEach(opt => { opt.selected = set.has(String(opt.value).toLowerCase()); });
    }

    if (priceToEl && QP.price_max) priceToEl.value = QP.price_max;
    if (kmToEl && QP.km_max)       kmToEl.value    = QP.km_max;

    if (fuelEl && QP.kraftstoff) fuelEl.value = QP.kraftstoff;
    if (gearEl && QP.getriebe)   gearEl.value = QP.getriebe;

    if (firstRegFromEl && QP.ezFrom) firstRegFromEl.value = QP.ezFrom;
// Sortierung aus URL auf das Select mappen
if (sortBy) {
  if (QP.sort === "preis_asc")      sortBy.value = "price-asc";
  else if (QP.sort === "preis_desc")sortBy.value = "price-desc";
  else if (QP.sort)                 sortBy.value = "date-desc"; // Fallback bei unbekanntem Wert
}

    if (QP.ezFrom && firstRegMonthEl && firstRegYearEl) {
      const [y,m] = QP.ezFrom.split("-");
      if (y) firstRegYearEl.value  = y;
      if (m) firstRegMonthEl.value = m;
    }
  })();
// ===== State =====
let filteredItems = [];   // enthält IMMER nur die aktuelle Server-Seite (nach normalize)
let page = 1;
const pageSize = 20;
let serverTotal = 0;      // Gesamtanzahl vom Server für den Pager


  // ===== Helpers =====
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const fmtEUR = (v) => {
    const n = toNum(v);
    return isNaN(n) ? "Preis n. a." : n.toLocaleString("de-DE") + " €";
  };
  const sanitizePhone = (p) => String(p || "").replace(/[^\d+]/g, "");

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
    const menu    = li.querySelector(".dropdown-menu");
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

  // ===== Navbar: Hamburger & Dropdowns =====
  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !navLinks?.classList.contains("active");
    navLinks?.classList.toggle("active");
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

  // Outside Click & ESC
  document.addEventListener("click", () => {
    navLinks?.classList.remove("active");
    hamburger?.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // Reposition on resize/scroll
  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  // ===== Filter-Sidebar Toggle =====
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("open");
      const txtOpen  = toggleBtn.getAttribute("data-open-text")  || "Filter schließen";
      const txtClose = toggleBtn.getAttribute("data-close-text") || "Filter anzeigen";
      toggleBtn.textContent = isOpen ? txtOpen : txtClose;
    });
  }

  // ===== Smooth Scroll (optional) =====
  searchLink?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
  });

  // ===== Titel-Autofill =====
  function updateTitle() {
    if (!makeInput || !modelInput || !titleInput) return;
    const make  = makeInput.value.trim();
    const model = modelInput.value.trim();
    if (make || model) titleInput.value = `${make} ${model}`.trim();
  }
  makeInput?.addEventListener("input", updateTitle);
  modelInput?.addEventListener("input", updateTitle);

  // ===== Navbar Login/Logout =====
  (async () => {
    const authLi = document.getElementById("auth-link");
    if (!authLi) return;
    try {
      const res = await fetch("/getNutzerInfo", { credentials: "include" });
      const data = await res.json();
      if (data?.eingeloggt) {
        authLi.innerHTML = `
          <a href="#" id="logout-link">
            <i class="fas fa-sign-out-alt"></i> Abmelden
          </a>`;
        document.getElementById("logout-link")?.addEventListener("click", async (e) => {
          e.preventDefault();
          try {
            await fetch("/logout", { method: "POST", credentials: "include" });
            localStorage.clear();
            location.reload();
          } catch {
            alert("Abmelden fehlgeschlagen.");
          }
        });
      }
    } catch { /* ignore */ }
  })();

  // ===== Login-Redirects =====
  function checkLoginAndGo(targetUrl) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.eingeloggt) {
          window.location.href = targetUrl;
        } else {
          try { localStorage.setItem("redirectAfterLogin", targetUrl); } catch {}
          window.location.href = "login.html";
        }
      })
      .catch(() => {
        try { localStorage.setItem("redirectAfterLogin", targetUrl); } catch {}
        window.location.href = "login.html";
      });
  }
  document.getElementById("saved-cars-link")?.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndGo("gespeicherte-autos.html"); });
  document.getElementById("my-cars-link")?.addEventListener("click",    (e) => { e.preventDefault(); checkLoginAndGo("meine-autos.html"); });

  // ===== Medien-Slider (Pointer Events, sauberer Drag) =====
  function initMediaSlider(mediaContainer) {
    if (!mediaContainer) return;
    const slidesWrapper = mediaContainer.querySelector(".slides");
    if (!slidesWrapper) return;

    const slides = Array.from(slidesWrapper.children);
    const btnLeft  = mediaContainer.querySelector(".media-arrow.left");
    const btnRight = mediaContainer.querySelector(".media-arrow.right");

    // Keine Slider-Controls nötig bei 0/1 Slide
    const hasMultiple = slides.length > 1;
    if (!hasMultiple) {
      btnLeft?.setAttribute("disabled", "true");
      btnRight?.setAttribute("disabled", "true");
    }

    // Grundlayout
    slidesWrapper.style.display = "flex";
    slidesWrapper.style.willChange = "transform";
    slidesWrapper.style.transition = "transform 0.3s ease";
    slidesWrapper.style.touchAction = "pan-y"; // Scrollen vertikal erlauben
    slides.forEach(slide => {
      slide.style.flex = "0 0 100%";
      slide.style.minWidth = "100%";
      slide.addEventListener("dragstart", e => e.preventDefault());
    });

    const state = {
      idx: 0,
      isDragging: false,
      pointerId: null,
      startX: 0,
      prevX: 0,
      startTranslate: 0,
      currentTranslate: 0,
      hasMoved: false
    };

    const width = () => mediaContainer.clientWidth;
    const snap = () => {
      state.currentTranslate = -state.idx * width();
      slidesWrapper.style.transition = "transform 0.3s ease";
      setTransform(state.currentTranslate);
    };
    const clampIndex = (i) => clamp(i, 0, Math.max(0, slides.length - 1));
    const setTransform = (x) => { slidesWrapper.style.transform = `translateX(${x}px)`; };

    function goTo(i) {
      state.idx = clampIndex(i);
      snap();
      updateArrows();
    }

    function updateArrows() {
      if (!hasMultiple) return;
      if (btnLeft)  btnLeft.disabled  = state.idx <= 0;
      if (btnRight) btnRight.disabled = state.idx >= slides.length - 1;
    }
    updateArrows();

    // === Pointer Events ===
    function onPointerDown(e) {
      if (!hasMultiple) return;
      state.isDragging = true;
      state.pointerId = e.pointerId ?? null;
      slidesWrapper.setPointerCapture?.(state.pointerId);
      state.startX = e.clientX;
      state.prevX = e.clientX;
      state.startTranslate = state.currentTranslate;
      state.hasMoved = false;
      slidesWrapper.style.transition = "none";
      document.body.style.userSelect = "none";
    }

    function onPointerMove(e) {
      if (!state.isDragging) return;
      const dx = e.clientX - state.prevX;
      state.prevX = e.clientX;
      if (Math.abs(e.clientX - state.startX) > 2) state.hasMoved = true;
      // leichte Gummi-Zone am Rand
      const maxTranslate = 0;
      const minTranslate = -(slides.length - 1) * width();
      let next = state.currentTranslate + dx;
      if (next > maxTranslate) next = maxTranslate + (next - maxTranslate) * 0.35;
      if (next < minTranslate) next = minTranslate + (next - minTranslate) * 0.35;
      state.currentTranslate = next;
      setTransform(state.currentTranslate);
    }

    function onPointerUpOrCancel() {
      if (!state.isDragging) return;
      state.isDragging = false;
      document.body.style.userSelect = "";

      // snap nach Threshold
      const moved = state.currentTranslate - state.startTranslate;
      const threshold = Math.max(40, width() * 0.18);
      if (moved <= -threshold) state.idx = clampIndex(state.idx + 1);
      else if (moved >= threshold) state.idx = clampIndex(state.idx - 1);

      snap();
    }

    slidesWrapper.addEventListener("pointerdown", onPointerDown, { passive: true });
    slidesWrapper.addEventListener("pointermove", onPointerMove, { passive: true });
    slidesWrapper.addEventListener("pointerup", onPointerUpOrCancel, { passive: true });
    slidesWrapper.addEventListener("pointercancel", onPointerUpOrCancel, { passive: true });
    slidesWrapper.addEventListener("pointerleave", onPointerUpOrCancel, { passive: true });

    // Klicks nach Drag nicht durchlassen (z. B. Card-Click)
    slidesWrapper.addEventListener("click", (e) => {
      if (state.hasMoved) e.stopPropagation();
    }, true);

    // Pfeile
    btnRight?.addEventListener("click", (e) => {
      e.stopPropagation();
      goTo(state.idx + 1);
    });
    btnLeft?.addEventListener("click", (e) => {
      e.stopPropagation();
      goTo(state.idx - 1);
    });

    // Resize
    let ro;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(() => snap());
      ro.observe(mediaContainer);
    } else {
      window.addEventListener("resize", snap);
    }

    // Initial
    snap();
  }
  // --- Ende initMediaSlider ---

  async function fetchSearch(p = 1, limit = pageSize) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(p));
    params.set("limit", String(limit));
    const res = await fetch(`/api/search?${params.toString()}`, { credentials: "omit" });
    if (!res.ok) throw new Error("Fetch /api/search fehlgeschlagen");
    return res.json(); // { page, limit, total, results }
  }
  
  // ---- DB -> UI Normalform (einheitliche Feldnamen) ----
  function normalizeItem(raw) {
    // EZ: bevorzugt 'erstzulassung' (YYYY-MM); sonst aus jahr/monat zusammensetzen
    const ez =
      raw.erstzulassung ||
      (raw.verkauf_ez_jahr && raw.verkauf_ez_monat
        ? `${String(raw.verkauf_ez_jahr)}-${String(raw.verkauf_ez_monat).padStart(2, "0")}`
        : "");

    // Preis: nimm brutto zuerst, sonst preis
    const preis =
      raw["brutto-preis"] ??
      raw.brutto_preis ??
      raw.verkauf_brutto ??
      raw.preis ??
      raw.verkauf_preis ?? "";

    return {
      // ID bleibt wie geliefert (getMongoId() kümmert sich später)
      _id: raw._id,

      // Basis
      titel: raw.titel || [raw.marke, raw.modell].filter(Boolean).join(" ").trim(),
      marke: raw.marke || "",
      modell: raw.modell || "",

      // Normalisierte Kernwerte als String (wir parsen on-the-fly mit toNum)
      preis,
      kilometer: raw.verkauf_kilometer ?? raw.kilometer ?? raw.km ?? "",
      erstzulassung: ez,
      kraftstoff: raw.verkauf_kraftstoff ?? raw.kraftstoff ?? "",
      getriebe: raw.verkauf_getriebe ?? raw.getriebe ?? "",
      leistung: raw.verkauf_leistung ?? raw.leistung ?? raw.ps ?? "",
      verbrauch_kombiniert: raw.verbrauch_kombiniert ?? raw.verkauf_verbrauch_kombiniert ?? "",

      // Metadaten/Anbieter
      verkaeufer: raw.verkauf_verkaeufer ?? raw.verkaeufer ?? "",
      name: raw.verkauf_name ?? raw.name ?? "",
      standort: raw.standort ?? "",
      telefon: raw.telefon ?? raw.phone ?? "",

      // Medien (Strings bevorzugt)
      images: Array.isArray(raw.images) ? raw.images
            : Array.isArray(raw.fotos)  ? raw.fotos
            : Array.isArray(raw.media)  ? raw.media.map(m => m.url || m)
            : [],
      video: raw.video || "",

      // optional alles Rohdaten falls woanders gebraucht
      raw
    };
  }

  function applyClientFilters(items) {
    // Sidebar-/Form-Felder (nur verwenden, wenn vorhanden)
    const priceFromEl      = document.getElementById("priceFrom");
    const priceToEl        = document.getElementById("priceTo");
    const mileageFromEl    = document.getElementById("mileageFrom");
    const mileageToEl      = document.getElementById("mileageTo");
    const powerFromEl      = document.getElementById("powerFrom");
    const powerToEl        = document.getElementById("powerTo");

    // IDs: auf Suche-Seite evtl. fuelType/transmission, auf Startseite fuel/gear
    const fuelTypeEl       = document.getElementById("fuelType") || document.getElementById("fuel");
    const transmissionEl   = document.getElementById("transmission") || document.getElementById("gear");

    const accidentFreeEl   = document.getElementById("accidentFree");
    const inspectionUntilEl= document.getElementById("inspectionUntil");

    // Erstzulassung UI
    const firstRegFromEl   = document.getElementById("firstRegFrom");
    const firstRegMonthEl  = document.getElementById("first-registration-month");
    const firstRegYearEl   = document.getElementById("first-registration-year");

    // Marke/Modell Felder (UI kann Vorrang vor URL haben)
    const markeEl          = document.getElementById("marke");
    const modellEl         = document.getElementById("modell");

    // --- UI lesen ---
    const priceFrom     = toNum(priceFromEl?.value ?? "");
    const priceTo       = toNum(priceToEl?.value   ?? "");
    const mileageFrom   = toNum(mileageFromEl?.value ?? "");
    const mileageTo     = toNum(mileageToEl?.value   ?? "");
    const powerFrom     = toNum(powerFromEl?.value ?? "");
    const powerTo       = toNum(powerToEl?.value   ?? "");

    const fuelTypeUI    = (fuelTypeEl?.value ? String(fuelTypeEl.value) : "Beliebig").toLowerCase();
    const transmissionUI= (transmissionEl?.value ? String(transmissionEl.value) : "Beliebig").toLowerCase();

    const accidentFree  = !!accidentFreeEl?.checked;
    const inspectionUntil = inspectionUntilEl?.value || ""; // YYYY-MM

    // Erstzulassung aus UI zusammensetzen
    const firstRegFromUI =
      (firstRegFromEl?.value) ||
      (firstRegYearEl?.value && firstRegMonthEl?.value
        ? `${firstRegYearEl.value}-${firstRegMonthEl.value}`
        : "");

    // --- Fallbacks aus URL (wenn UI leer) ---
    const priceToEff     = (!isNaN(priceTo)   && priceTo   > 0) ? priceTo   : toNum(QP.price_max);
    const mileageToEff   = (!isNaN(mileageTo) && mileageTo > 0) ? mileageTo : toNum(QP.km_max);
    const firstRegEff    = firstRegFromUI || QP.ezFrom;

    const fuelEff        = (fuelTypeUI !== "beliebig")     ? fuelTypeUI     : (QP.kraftstoff || "beliebig");
    const gearEff        = (transmissionUI !== "beliebig") ? transmissionUI : (QP.getriebe   || "beliebig");

    // Marke/Modell: UI > URL
    let brandEff  = QP.marke ? norm(QP.marke) : "";
    let modelsEff = Array.isArray(QP.modell) ? QP.modell.map(norm) : [];
    if (markeEl && markeEl.value) brandEff = norm(markeEl.value);
    if (modellEl && modellEl.options) {
      const selected = [...modellEl.options].filter(o => o.selected).map(o => norm(o.value));
      if (selected.length) modelsEff = selected;
    }

    // --- Filtern (auf Normalform) ---
    return items.filter(i => {
      // Marke/Modell/Titel
      const iBrand = norm(i.marke);
      const iModel = norm(i.modell);
      const iTitle = norm(i.titel || "");

      if (brandEff && iBrand !== brandEff) return false;
      if (modelsEff.length) {
        const hit = modelsEff.some(m => iModel.includes(m) || iTitle.includes(m));
        if (!hit) return false;
      }

      // Preis
      const preis = toNum(i.preis);
      if (!isNaN(priceFrom) && priceFrom > 0 && !(preis >= priceFrom)) return false;
      if (!isNaN(priceToEff) && priceToEff > 0 && !(preis <= priceToEff)) return false;

      // Kilometer
      const km = toNum(i.kilometer);
      if (!isNaN(mileageFrom) && mileageFrom > 0 && !(km >= mileageFrom)) return false;
      if (!isNaN(mileageToEff) && mileageToEff > 0 && !(km <= mileageToEff)) return false;

      // Leistung (PS)
      const ps = toNum(i.leistung);
      if (!isNaN(powerFrom) && powerFrom > 0 && !(ps >= powerFrom)) return false;
      if (!isNaN(powerTo)   && powerTo   > 0 && !(ps <= powerTo))   return false;

      // Kraftstoff/Getriebe
      if (fuelEff !== "beliebig") {
        const ft = norm(i.kraftstoff || "");
        if (!ft.includes(fuelEff)) return false;
      }
      if (gearEff !== "beliebig") {
        const tr = norm(i.getriebe || "");
        if (!tr.includes(gearEff)) return false;
      }

      // Unfallfrei (nur UI; heuristisch)
      if (accidentFree) {
        const flag = i.raw?.unfallfrei === true ||
          (Array.isArray(i.raw?.verkauf_ausstattung) &&
           i.raw.verkauf_ausstattung.some(a => norm(a).includes("unfall")));
        if (!flag) return false;
      }

      // HU bis
      if (inspectionUntil) {
        const hu = String(i.raw?.hu || i.raw?.verkauf_hu || "");
        if (hu && hu.length >= 7 && hu < inspectionUntil) return false;
      }

      // Erstzulassung ab
      if (firstRegEff) {
        const ez = String(i.erstzulassung || "");
        if (ez && ez.length >= 7 && ez < firstRegEff) return false;
      }

      // Ort (Textmatch; echter Radius später via Geocoding)
      if (QP.ort) {
        const standort = norm(i.standort || "");
        if (!standort.includes(norm(QP.ort))) return false;
      }

      return true;
    });
  }
// ===== Sortierung (auf Normalform) =====
// (optional – wird aktuell NICHT mehr in den Events benutzt, weil der Server sortiert.
//  Lass es drin, falls du zusätzlich clientseitig sortieren willst.)
function sortItems(items) {
  const v = sortBy?.value || "relevance";
  const copy = items.slice();

  switch (v) {
    case "price-asc":
      copy.sort((a,b) => (toNum(a.preis) || Infinity) - (toNum(b.preis) || Infinity));
      break;
    case "price-desc":
      copy.sort((a,b) => (toNum(b.preis) || -Infinity) - (toNum(a.preis) || -Infinity));
      break;
    case "date-desc": {
      const getDate = (x) => (x?.raw?.veroeffentlichtAm ? new Date(x.raw.veroeffentlichtAm)
                           : x?._id?.$date ? new Date(x._id.$date)
                           : new Date(0));
      copy.sort((a,b) => getDate(b) - getDate(a));
      break;
    }
    case "mileage-asc":
      copy.sort((a,b) => (toNum(a.kilometer) || Infinity) - (toNum(b.kilometer) || Infinity));
      break;
    default: // relevance
      // no-op (Platz für Scoring)
      break;
  }
  return copy;
}

function renderPager(totalCount) {
  if (!pager) return;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const current    = clamp(page, 1, totalPages);

  if (totalPages <= 1) {
    pager.innerHTML = "";
    return;
  }

  let html = `<button class="pager-btn" data-page="${current - 1}" ${current === 1 ? "disabled" : ""}>« Zurück</button>`;
  const windowSize = 5;
  const start = Math.max(1, current - Math.floor(windowSize / 2));
  const end   = Math.min(totalPages, start + windowSize - 1);
  for (let p = start; p <= end; p++) {
    html += `<button class="pager-btn ${p === current ? "active" : ""}" data-page="${p}">${p}</button>`;
  }
  html += `<button class="pager-btn" data-page="${current + 1}" ${current === totalPages ? "disabled" : ""}>Weiter »</button>`;
  pager.innerHTML = html;

  // Serverseitig blättern + Page in der URL mitführen
  pager.querySelectorAll(".pager-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const target = Number(e.currentTarget.getAttribute("data-page"));
      if (!isNaN(target)) {
        page = clamp(target, 1, totalPages);

        const params = new URLSearchParams(window.location.search);
        params.set("page", String(page));
        history.replaceState(null, "", `${location.pathname}?${params.toString()}`);

        loadAndRender(page);
      }
    });
  });
}

// Helper: echte Mongo-ID herausziehen (string, {_id: "..."} oder {$oid: "..."})
function getMongoId(doc) {
  if (!doc) return null;
  if (doc._id && typeof doc._id === "object" && typeof doc._id.$oid === "string") return doc._id.$oid;
  if (typeof doc._id === "string") return doc._id;
  if (typeof doc.id === "string") return doc.id;
  return null;
}

function renderItems() {
  if (!container) return;
  container.innerHTML = "";

  // Server liefert *nur die aktuelle Seite*:
  const view = filteredItems;

  if (!view.length) {
    container.innerHTML = "<p>❌ Keine Fahrzeuge gefunden.</p>";
    renderPager(serverTotal); // Gesamttreffer aus Server
    return;
  }

  view.forEach(inserat => {
    const imgs = Array.isArray(inserat.images) ? inserat.images : [];
    const tel  = sanitizePhone(inserat.telefon);

    const priceNum = toNum(inserat.preis);
    const kmNum    = toNum(inserat.kilometer);

    const card = document.createElement("div");
    card.className = "car-card horizontal";
    card.innerHTML = `
      <div class="car-card-media">
        <div class="card-actions mobile-only">
          <button class="save-btn" title="Auto speichern"><i class="fas fa-heart"></i></button>
          <a href="${tel ? `tel:${tel}` : '#'}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button" ${tel ? "" : "aria-disabled='true'"} >
            <i class="fas fa-phone"></i>
          </a>
        </div>
        <div class="media-container">
          <div class="slides">
            ${imgs.map(src => `<img src="${src}" class="slide" alt="">`).join("")}
            ${inserat.video ? `<video class="slide" controls muted playsinline preload="metadata"><source src="${inserat.video}" type="video/mp4"></video>` : ""}
          </div>
          <button class="media-arrow left"  type="button"><i class="fas fa-chevron-left"></i></button>
          <button class="media-arrow right" type="button"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>
      <div class="car-details">
        <div class="car-top-row">
          <h2 class="car-title">${inserat.titel || "Unbekanntes Fahrzeug"}</h2>
          <p class="car-price">${isNaN(priceNum) ? "Preis n. a." : priceNum.toLocaleString("de-DE") + " €"}</p>
        </div>
        <p class="car-subtitle">${inserat.raw?.verkauf_kurzbeschreibung || ""}</p>
        <div class="car-info-grid">
          <p><i class="fas fa-road"></i> ${isNaN(kmNum) ? "?" : kmNum.toLocaleString("de-DE")} km</p>
          <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.erstzulassung || "?"}</p>
          <p><i class="fas fa-gas-pump"></i> ${inserat.kraftstoff || "?"}</p>
          <p><i class="fas fa-gauge-high"></i> ${inserat.leistung || "?"} PS</p>
          <p><i class="fas fa-gears"></i> ${inserat.getriebe || "?"}</p>
          <p><i class="fas fa-tint"></i> ${inserat.verbrauch_kombiniert || "?"} l/100 km</p>
        </div>
        <div class="dealer-info-row">
          <div class="dealer-info-text">
            ${String(inserat.verkaeufer || "").toLowerCase() === "händler"
              ? `<strong>${inserat.name || "Autohaus"}</strong><br>${inserat.standort || ""}`
              : `Privatanbieter<br>${inserat.standort || ""}`
            }
          </div>
          <div class="card-actions desktop-only">
            <button class="save-btn" title="Auto speichern"><i class="fas fa-heart"></i></button>
            <a href="${tel ? `tel:${tel}` : '#'}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button" ${tel ? "" : "aria-disabled='true'"} >
              <i class="fas fa-phone"></i>
            </a>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
    initMediaSlider(card.querySelector(".media-container"));

    // Karte klickbar
    const realId = getMongoId(inserat);
    card.dataset.id = realId || "";
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, a, .media-arrow")) return;
      try { localStorage.setItem("ausgewaehltesInserat", JSON.stringify(inserat)); } catch {}
      const qs = realId ? `?id=${encodeURIComponent(realId)}` : "";
      window.location.href = `anzeige.html${qs}`;
    });
  });

  renderPager(serverTotal); // Wichtig: Gesamttreffer vom Server
}

async function loadAndRender(p = 1) {
  try {
    const { page: serverPage, limit: serverLimit, total, results } = await fetchSearch(p, pageSize);
    serverTotal   = total;                               // Gesamtzahl vom Server (für Pager)
    filteredItems = Array.isArray(results) ? results.map(normalizeItem) : [];
    page          = Number(serverPage) || 1;             // aktuelle Seite setzen

    // Optional: falls du zusätzliche Client-Feinfilter/Sort noch anwenden willst:
    // filteredItems = applyClientFilters(filteredItems);
    // filteredItems = sortItems(filteredItems);

    renderItems();
  } catch (err) {
    console.error("Fehler beim Laden der Suche:", err);
    if (container) container.innerHTML = "<p>🚫 Fehler beim Laden der Ergebnisse.</p>";
  }
}

// ===== Events: Filter & Sort =====
function setOrDelete(params, key, val) {
  if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
    params.delete(key);
  } else {
    params.set(key, String(val));
  }
}
function mapSortSelectToParam(v) {
  if (v === "price-asc")  return "preis_asc";
  if (v === "price-desc") return "preis_desc";
  return "neueste"; // "date-desc" und alles andere
}
function updateUrlFromUiAndReload() {
  const params = new URLSearchParams(window.location.search);

  // Marke/Modell
  const markeEl  = document.getElementById("marke");
  const modellEl = document.getElementById("modell");
  setOrDelete(params, "marke", markeEl?.value || "");
  if (modellEl && modellEl.options) {
    const selected = [...modellEl.options].filter(o => o.selected).map(o => o.value).filter(Boolean);
    setOrDelete(params, "modell", selected.length ? selected.join(",") : "");
  }

  // EZ (type="month" oder Jahr/Monat)
  const firstRegFromEl  = document.getElementById("firstRegFrom");
  const firstRegMonthEl = document.getElementById("first-registration-month");
  const firstRegYearEl  = document.getElementById("first-registration-year");
  const ez =
    (firstRegFromEl?.value) ||
    (firstRegYearEl?.value && firstRegMonthEl?.value
      ? `${firstRegYearEl.value}-${String(firstRegMonthEl.value).padStart(2,"0")}`
      : "");
  setOrDelete(params, "ezFrom", ez);

 // Preis/KM bis (nur echte Zahlen > 0 setzen)
const priceToEl   = document.getElementById("priceTo");
const mileageToEl = document.getElementById("mileageTo");

const pMax = parseInt(priceToEl?.value || "", 10);
if (!Number.isNaN(pMax) && pMax > 0) {
  params.set("price_max", String(pMax));
} else {
  params.delete("price_max");
}

const kmMax = parseInt(mileageToEl?.value || "", 10);
if (!Number.isNaN(kmMax) && kmMax > 0) {
  params.set("km_max", String(kmMax));
} else {
  params.delete("km_max");
}

// Kraftstoff/Getriebe (Beliebig/leer NICHT senden)
const fuelEl = document.getElementById("fuelType") || document.getElementById("fuel");
const gearEl = document.getElementById("transmission") || document.getElementById("gear");

const fuelVal = (fuelEl?.value || "").toLowerCase();
if (fuelVal && !["beliebig","any","alle","all","-"].includes(fuelVal)) {
  params.set("kraftstoff", fuelVal);
} else {
  params.delete("kraftstoff");
}

const gearVal = (gearEl?.value || "").toLowerCase();
if (gearVal && !["beliebig","any","alle","all","-"].includes(gearVal)) {
  params.set("getriebe", gearVal);
} else {
  params.delete("getriebe");
}

  // Ort / Umkreis
  const locEl       = document.getElementById("location");
  const distSel     = document.getElementById("distance-select");
  const distCustom  = document.getElementById("distance-custom");

  const locVal = (locEl?.value || "").trim();
  setOrDelete(params, "ort", locVal);

  if (distSel && !distSel.disabled) {
    const dRaw = distSel.value === "custom" ? (distCustom?.value || "") : distSel.value;
    const d = parseInt(dRaw, 10);
    setOrDelete(params, "umkreis", (!Number.isNaN(d) && d > 0 && d !== 999) ? d : "");
  } else {
    params.delete("umkreis");
  }

  // Sortierung -> Serverparam
  const sortSelectVal = sortBy?.value || "";
  if (sortSelectVal) params.set("sort", mapSortSelectToParam(sortSelectVal));
  else params.delete("sort");

  // Bei Filteränderung auf Seite 1 springen
  params.delete("page");

  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  loadAndRender(1);
}

applyFilters?.addEventListener("click", (e) => {
  e.preventDefault();
  updateUrlFromUiAndReload();
});

sortBy?.addEventListener("change", () => {
  updateUrlFromUiAndReload();
});

// ===== Init =====
const initialPage = Math.max(parseInt(new URLSearchParams(window.location.search).get("page") || "1", 10), 1);
loadAndRender(initialPage);


});













