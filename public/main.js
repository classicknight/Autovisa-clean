
/* main.js (bereinigt & robust) */
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Utils
  // =========================
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // =========================
  // Session / Login State (einheitlich)
  // =========================
  let _sessionCache = null;

  async function getSession() {
    if (_sessionCache) return _sessionCache;
    try {
      const res = await fetch("/getNutzerInfo", { credentials: "include" });
      const data = await res.json();
      _sessionCache = data || { eingeloggt: false };
      return _sessionCache;
    } catch {
      _sessionCache = { eingeloggt: false };
      return _sessionCache;
    }
  }

  async function syncAuthToLocalStorage() {
    const s = await getSession();
    if (s?.eingeloggt) {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userRole", s.rolle || "privat");
      if (s.nutzerId) localStorage.setItem("userId", s.nutzerId);
    } else {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
    }
  }

  function checkLoginAndRedirect(targetUrl) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.eingeloggt) {
          window.location.href = targetUrl;
        } else {
          localStorage.setItem("redirectAfterLogin", targetUrl);
          window.location.href = "login.html";
        }
      })
      .catch(() => {
        localStorage.setItem("redirectAfterLogin", targetUrl);
        window.location.href = "login.html";
      });
  }

  function handleLogout(e) {
    if (e) e.preventDefault();
    fetch("/logout", { method: "POST", credentials: "include" })
      .then(() => {
        localStorage.clear();
        location.reload();
      })
      .catch(() => {
        localStorage.clear();
        location.reload();
      });
  }

  // =========================
  // Navbar (Dropdown + Hamburger)
  // =========================
  (function initNavbar() {
    const navLinks  = $("#nav-links");
    const hamburger = $("#hamburger");
    const dropdownLis = $$(".dropdown");
    const dropdownLinks = $$(".dropdown > a");

    if (!navLinks && !hamburger && !dropdownLis.length) return;

    function closeAllDropdowns(except = null) {
      dropdownLis.forEach((li) => {
        if (li !== except) {
          li.classList.remove("open");
          const trigger = li.querySelector('a[aria-haspopup="true"]') || li.querySelector("a");
          const menu = li.querySelector(".dropdown-menu");
          if (trigger) trigger.setAttribute("aria-expanded", "false");
          if (menu) {
            menu.classList.remove("show");
            menu.style.left = "";
            [...menu.children].forEach((item) => (item.style.transitionDelay = ""));
          }
        }
      });
    }

    function positionMenu(li) {
      const trigger = li.querySelector('a[aria-haspopup="true"]') || li.querySelector("a");
      const menu = li.querySelector(".dropdown-menu");
      if (!trigger || !menu) return;

      // Hinweis: getBoundingClientRect() vom Menu ist nur korrekt, wenn es "sichtbar" ist.
      // Wir rufen positionMenu() nur nach open an.
      const tRect = trigger.getBoundingClientRect();
      const mRect = menu.getBoundingClientRect();
      const liRect = li.getBoundingClientRect();
      const vw = window.innerWidth;

      const center = tRect.left + tRect.width / 2;
      let leftAbs = center - mRect.width / 2;
      leftAbs = clamp(leftAbs, 16, vw - mRect.width - 16);

      const relativeLeft = leftAbs - liRect.left;
      menu.style.left = `${relativeLeft}px`;
    }

    function openDropdown(trigger) {
      const li = trigger.closest(".dropdown");
      const menu = trigger.nextElementSibling;
      if (!li || !menu) return;

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
      if (!li) return;
      const isOpen = li.classList.contains("open");
      if (isOpen) closeAllDropdowns();
      else openDropdown(trigger);
    }

    // Hamburger
    if (hamburger && navLinks) {
      hamburger.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !navLinks.classList.contains("active");
        navLinks.classList.toggle("active");
        closeAllDropdowns();
        hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    }

    // Dropdown nur Klick
    dropdownLinks.forEach((link) => {
      link.setAttribute("aria-expanded", "false");
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown(link);
      });
    });

    // Outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".navbar")) {
        if (navLinks) navLinks.classList.remove("active");
        if (hamburger) hamburger.setAttribute("aria-expanded", "false");
        closeAllDropdowns();
      }
    });

    // ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (navLinks) navLinks.classList.remove("active");
        if (hamburger) hamburger.setAttribute("aria-expanded", "false");
        closeAllDropdowns();
      }
    });

    const repositionOpen = () => $$(".dropdown.open").forEach(positionMenu);
    window.addEventListener("resize", repositionOpen, { passive: true });
    window.addEventListener("scroll", repositionOpen, { passive: true });
  })();

  // =========================
  // Navbar Auth Link (Login/Logout Anzeige)
  // =========================
  (function initAuthLink() {
    const authLink = $("#auth-link");
    if (!authLink) return;

    const renderLoggedOut = () => {
      // Wenn du hier einen Login-Link drin hast, lass ihn so wie in deiner HTML.
      // Wir überschreiben nur, wenn eingeloggt.
    };

    const renderLoggedIn = () => {
      authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
      $("#logout-link")?.addEventListener("click", handleLogout);
    };

    // Sofort-Optimismus (falls localStorage gesetzt)
    if (localStorage.getItem("isLoggedIn") === "true") {
      renderLoggedIn();
      return;
    }

    // serverseitig prüfen
    fetch("/getNutzerInfo", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.eingeloggt) renderLoggedIn();
        else renderLoggedOut();
      })
      .catch(renderLoggedOut);
  })();

  // =========================
  // Login-abhängige Weiterleitungen (Navbar-Links + Mobile Icons)
  // =========================
  (function initLoginRedirectLinks() {
    const map = [
      ["saved-cars-link",  "übersicht.html#saved-cars"],
      ["my-cars-link",     "übersicht.html#car-list"],
      ["sold-cars-link",   "übersicht.html#sold-cars"],
      ["messages-link",    "übersicht.html#messages-list"],
      ["mobile-saved",     "übersicht.html#saved-cars"],
      ["mobile-messages",  "übersicht.html#messages-list"],
    ];

    map.forEach(([id, target]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", (e) => {
        e.preventDefault();
        checkLoginAndRedirect(target);
      });
    });
  })();

  // =========================
  // Smooth Scroll (nur wenn Anker existieren)
  // =========================
  (function initSmoothScroll() {
    const searchLink  = document.querySelector('a[href="#search-section"]');
    const resultsLink = document.querySelector('a[href="#results-section"]');

    if (searchLink) {
      searchLink.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
      });
    }

    if (resultsLink) {
      resultsLink.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector("#results-section")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  })();

  // =========================
  // Filter Toggle (Weitere Filter)
  // =========================
  (function initFilterToggle() {
    const form = document.querySelector(".search-form");
    const advancedBtn = form?.querySelector(".btn-advanced");
    const filters = document.getElementById("extra-filters");
    if (!advancedBtn || !filters) return;

    advancedBtn.addEventListener("click", () => {
      filters.classList.toggle("show");
      advancedBtn.textContent = filters.classList.contains("show")
        ? "Filter schließen"
        : "Weitere Filter";
    });
  })();

  // =========================
  // SlimSelect Init (guarded)
  // =========================
  function safeSlimSelect(selector, options = {}) {
    if (!window.SlimSelect) return null;
    const el = document.querySelector(selector);
    if (!el) return null;

    // nicht doppelt initialisieren
    if (el.dataset.slimInit === "1") return null;
    el.dataset.slimInit = "1";

    try {
      return new SlimSelect({ select: selector, ...options });
    } catch (e) {
      console.warn("SlimSelect init failed for", selector, e);
      return null;
    }
  }

  (function initSearchFormSelects() {
    // Preis
    const priceSelect  = document.getElementById("price-select");
    const priceCustom  = document.getElementById("price-custom");
    if (priceSelect && window.SlimSelect) {
      safeSlimSelect("#price-select", {
        placeholder: "Preis wählen",
        allowDeselect: true,
        showSearch: false,
      });
      if (priceCustom) {
        priceSelect.addEventListener("change", () => {
          if (priceSelect.value === "custom") {
            priceCustom.style.display = "block";
            priceCustom.focus();
          } else {
            priceCustom.style.display = "none";
            priceCustom.value = "";
          }
        });
      }
    }

    // Kilometer
    const kmSelect = document.getElementById("kilometer-select");
    const kmCustom = document.getElementById("kilometer-custom");
    if (kmSelect && window.SlimSelect) {
      safeSlimSelect("#kilometer-select", {
        placeholder: "Kilometer wählen",
        allowDeselect: true,
        showSearch: false,
      });
      if (kmCustom) {
        kmSelect.addEventListener("change", () => {
          if (kmSelect.value === "custom") {
            kmCustom.style.display = "block";
            kmCustom.focus();
          } else {
            kmCustom.style.display = "none";
            kmCustom.value = "";
          }
        });
      }
    }

    // Getriebe / Kraftstoff
    if (document.getElementById("gear")) {
      safeSlimSelect("#gear", {
        placeholder: "Getriebe wählen",
        allowDeselect: true,
        showSearch: false,
      });
    }
    if (document.getElementById("fuel")) {
      safeSlimSelect("#fuel", {
        placeholder: "Kraftstoff wählen",
        allowDeselect: true,
        showSearch: false,
      });
    }

    // Umkreis + custom
    const distanceSelect = document.getElementById("distance-select");
    const distanceCustom = document.getElementById("distance-custom");
    const locationInput  = document.getElementById("location");

    if (distanceSelect && window.SlimSelect) {
      safeSlimSelect("#distance-select", {
        placeholder: "Umkreis wählen",
        allowDeselect: true,
        showSearch: false,
      });
    }

    if (locationInput && distanceSelect) {
      locationInput.addEventListener("input", () => {
        distanceSelect.disabled = !locationInput.value.trim();
        if (!locationInput.value.trim()) {
          distanceSelect.selectedIndex = 0;
          if (distanceCustom) {
            distanceCustom.style.display = "none";
            distanceCustom.value = "";
          }
        }
      });

      distanceSelect.addEventListener("change", () => {
        if (!distanceCustom) return;
        if (distanceSelect.value === "custom") {
          distanceCustom.style.display = "block";
          distanceCustom.focus();
        } else {
          distanceCustom.style.display = "none";
          distanceCustom.value = "";
        }
      });
    }
  })();
// =========================
// Marke/Modell + EZ Jahr/Monat (SlimSelect) — JSON Variante
// =========================
(async function initBrandModelAndRegistration() {
  // Doppel-Init verhindern (falls andere Seite/Script das auch macht)
  if (window.__AV_BRANDMODEL_INIT_DONE) return;
  window.__AV_BRANDMODEL_INIT_DONE = true;

  const brandDropdown = document.getElementById("marke");
  const modelDropdown = document.getElementById("modell");
  const yearSelect    = document.getElementById("first-registration-year");
  const monthSelect   = document.getElementById("first-registration-month");

  // Wenn auf der Seite nichts davon existiert: raus
  if (!brandDropdown && !modelDropdown && !yearSelect && !monthSelect) return;

  // ---------------------------------------------------------
  // EZ Jahr/Monat Logik (unverändert aus deiner Version)
  // ---------------------------------------------------------
  if (yearSelect && monthSelect) {
    if (yearSelect.options.length <= 1) {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear; y >= 1900; y--) {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        yearSelect.appendChild(opt);
      }
    }

    let slimMonth = null;

    if (window.SlimSelect) {
      safeSlimSelect("#first-registration-year", {
        placeholder: "Jahr wählen",
        allowDeselect: true,
        showSearch: false,
      });

      slimMonth = safeSlimSelect("#first-registration-month", {
        placeholder: "Monat wählen",
        allowDeselect: true,
        showSearch: false,
      });

      try { slimMonth?.disable(); } catch {}
    } else {
      monthSelect.disabled = true;
    }

    yearSelect.addEventListener("change", () => {
      if (yearSelect.value) {
        if (window.SlimSelect) { try { slimMonth?.enable(); } catch {} }
        else monthSelect.disabled = false;
      } else {
        if (window.SlimSelect) { try { slimMonth?.disable(); } catch {} }
        monthSelect.selectedIndex = 0;
        monthSelect.disabled = true;
      }
    });
  }

  // ---------------------------------------------------------
  // Marke/Modell nur wenn beide existieren
  // ---------------------------------------------------------
  if (!brandDropdown || !modelDropdown) return;

  // ---------------------------------------------------------
  // JSON Loader + Normalizer (cached)
  // ---------------------------------------------------------
  async function loadBrandModelFromJson() {
    if (window.__AV_BRANDMODEL_CACHE) return window.__AV_BRANDMODEL_CACHE;

    // Fallback: falls du noch model-data.js nutzt
    const fallback = {
      modelData: window.AUTOVISA_MODEL_DATA || null,
      modelGroups: window.AUTOVISA_MODEL_GROUPS || {},
    };

    try {
      const res = await fetch("public/data/marken-modelle.json", {
        credentials: "omit",
        cache: "force-cache",
      });
      
      if (!res.ok) throw new Error("HTTP " + res.status);
      const raw = await res.json();

      const normalized = (function normalize(input) {
        if (!input) return { modelData: null, modelGroups: {} };

        // Variante A: { modelData: {...}, modelGroups?: {...} }
        if (input.modelData && typeof input.modelData === "object") {
          return { modelData: input.modelData, modelGroups: input.modelGroups || input.groups || {} };
        }

        // Variante B: { "BMW":[...], "Audi":[...] }
        if (typeof input === "object" && !Array.isArray(input)) {
          const keys = Object.keys(input);
          const looksLikeMapping = keys.length && Array.isArray(input[keys[0]]);
          if (looksLikeMapping) return { modelData: input, modelGroups: {} };
        }

        // Variante C: Array [{marke:"BMW", modelle:[...]}]
        if (Array.isArray(input)) {
          const out = {};
          input.forEach((e) => {
            const brand = e?.marke || e?.brand || e?.name;
            const models = e?.modelle || e?.models || e?.items;
            if (!brand) return;
            if (Array.isArray(models)) out[brand] = models;
            else if (typeof models === "string") out[brand] = models.split(",").map(s => s.trim()).filter(Boolean);
          });
          return { modelData: out, modelGroups: {} };
        }

        return { modelData: null, modelGroups: {} };
      })(raw);

      // modelGroups: Regex-Strings -> RegExp
      const groups = normalized.modelGroups || {};
      const parsedGroups = {};
      Object.keys(groups).forEach((k) => {
        const v = groups[k];
        if (v instanceof RegExp) {
          parsedGroups[k] = v;
          return;
        }
        if (typeof v === "string") {
          // erlaubt "/pattern/i" oder "pattern"
          const m = v.match(/^\/(.+)\/([gimsuy]*)$/);
          try {
            parsedGroups[k] = m ? new RegExp(m[1], m[2] || "") : new RegExp(v, "i");
          } catch {
            // ignoriere kaputte Regex
          }
        }
      });

      const result = {
        modelData: normalized.modelData,
        modelGroups: parsedGroups,
      };

      window.__AV_BRANDMODEL_CACHE = result;
      return result;
    } catch (e) {
      console.warn("marken-modelle.json konnte nicht geladen werden – Fallback aktiv.", e);
      window.__AV_BRANDMODEL_CACHE = fallback;
      return fallback;
    }
  }

  const { modelData, modelGroups } = await loadBrandModelFromJson();

  if (!modelData || typeof modelData !== "object") {
    console.warn("Keine Marken/Modelle Daten verfügbar (weder JSON noch Fallback).");
    return;
  }

  // ---------------------------------------------------------
  // Marke Optionen füllen (nur wenn Select leer/placeholder ist)
  // ---------------------------------------------------------
  const brandKeys = Object.keys(modelData).sort((a, b) => a.localeCompare(b, "de"));

  const hasRealBrandOptions =
    Array.from(brandDropdown.options).some((o) => o.value && o.value.trim());

  if (!hasRealBrandOptions) {
    brandDropdown.innerHTML = `<option value="">Marke wählen</option>`;
    brandKeys.forEach((b) => {
      const o = document.createElement("option");
      o.value = b;
      o.textContent = b;
      brandDropdown.appendChild(o);
    });
  }

  // SlimSelect Marke (nachdem Optionen existieren!)
  if (window.SlimSelect) {
    safeSlimSelect("#marke", {
      placeholder: "Marke wählen",
      allowDeselect: true,
      showSearch: true,
    });
  }

  // ---------------------------------------------------------
  // SlimSelect Modell (multi) + dynamische Optionen
  // ---------------------------------------------------------
  if (!window.SlimSelect) return;

  const slimModell = safeSlimSelect("#modell", {
    placeholder: "Bitte zuerst Marke wählen",
    closeOnSelect: false,
    allowDeselect: true,
    hideSelected: false,
    showSearch: true,
  });
  if (!slimModell) return;

  let currentOptions = [];
  let syncing = false;

  function setModelOptionsForBrand(brand) {
    if (!brand || !modelData[brand]) {
      currentOptions = [];
      modelDropdown.innerHTML = `<option value="" disabled selected hidden>Bitte zuerst Marke wählen</option>`;
      slimModell.setData([
        { text: "Bitte zuerst Marke wählen", value: "", placeholder: true, disabled: true, selected: true }
      ]);
      return;
    }

    currentOptions = (modelData[brand] || []).map((m) => ({ text: m, value: m }));

    // native select neu bauen
    modelDropdown.innerHTML = "";
    currentOptions.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.text;
      modelDropdown.appendChild(o);
    });

    // slim set
    slimModell.setData(currentOptions);

    // Auswahl reset
    try { slimModell.setSelected([], false); } catch {}
  }

  // Gruppen-Logik (optional)
  slimModell.on("afterChange", (newSelected) => {
    if (syncing) return;
    syncing = true;

    const selectedValues = (newSelected || []).map((s) => s.value);
    const all = new Set();

    selectedValues.forEach((val) => {
      const regex = modelGroups?.[val];
      if (regex) {
        currentOptions.forEach((opt) => {
          if (regex.test(opt.value)) all.add(opt.value);
        });
        all.add(val);
      } else {
        all.add(val);
      }
    });

    // native sync
    modelDropdown.querySelectorAll("option").forEach((opt) => {
      opt.selected = all.has(opt.value);
    });

    // slim sync
    try { slimModell.setSelected([...all], false); } catch {}

    syncing = false;
  });

  brandDropdown.addEventListener("change", () => {
    setModelOptionsForBrand(brandDropdown.value);
  });

  // initial
  setModelOptionsForBrand(brandDropdown.value);
})();


  // =========================
  // Media Slider (einzige, saubere Version)
  // =========================
  function initMediaSlider(container) {
    if (!container) return;
    if (container.dataset.sliderInit === "1") return;
    container.dataset.sliderInit = "1";

    const slidesWrapper = container.querySelector(".slides");
    if (!slidesWrapper) return;

    const slides = Array.from(slidesWrapper.children || []);
    if (!slides.length) return;

    // iOS/Scroll-Frieden
    container.style.touchAction = "pan-y";
    slidesWrapper.style.display = "flex";
    slidesWrapper.style.willChange = "transform";

    slides.forEach((slide) => {
      slide.style.flex = "0 0 100%";
      slide.style.minWidth = "100%";
      // Bild-Drag verhindern
      if (slide.tagName === "IMG") slide.setAttribute("draggable", "false");
    });

    const btnLeft  = container.querySelector(".media-arrow.left");
    const btnRight = container.querySelector(".media-arrow.right");

    const state = {
      index: 0,
      dragging: false,
      axis: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      prevTranslate: 0,
      currentTranslate: 0,
      blockClickUntil: 0,
      hadRealSwipe: false,
      captured: false,
    };

    const width = () => {
      const w = container.getBoundingClientRect().width || container.clientWidth;
      return w > 0 ? w : 1;
    };

    const setTranslate = (x, animate) => {
      slidesWrapper.style.transition = animate
        ? "transform 0.28s cubic-bezier(.2,.8,.2,1)"
        : "none";
      slidesWrapper.style.transform = `translateX(${x}px)`;
    };

    const pauseInactiveVideos = () => {
      slides.forEach((s, idx) => {
        const v = s?.tagName === "VIDEO" ? s : s?.querySelector?.("video");
        if (!v) return;
        if (idx !== state.index && !v.paused) {
          try { v.pause(); } catch {}
        }
      });
    };

    const snapTo = (i, animate = true) => {
      state.index = Math.max(0, Math.min(i, slides.length - 1));
      state.prevTranslate = -state.index * width();
      state.currentTranslate = state.prevTranslate;
      setTranslate(state.currentTranslate, animate);
      pauseInactiveVideos();
      if (btnLeft)  btnLeft.disabled  = state.index <= 0;
      if (btnRight) btnRight.disabled = state.index >= slides.length - 1;
    };

    // Click-Block nur nach echtem Swipe
    container.addEventListener(
      "click",
      (e) => {
        if (Date.now() < state.blockClickUntil) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    const startDrag = (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.target?.closest?.(".media-arrow")) return;

      state.dragging = true;
      state.axis = null;
      state.pointerId = e.pointerId ?? null;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.hadRealSwipe = false;
      state.captured = false;

      slidesWrapper.style.transition = "none";
    };

    const moveDrag = (e) => {
      if (!state.dragging) return;
      if (state.pointerId != null && e.pointerId != null && e.pointerId !== state.pointerId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (state.axis == null) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < 6 && ady < 6) return;

        state.axis = adx > ady ? "x" : "y";
        if (state.axis === "y") {
          state.dragging = false;
          state.pointerId = null;
          return;
        }

        if (!state.captured && e.pointerId != null && container.setPointerCapture) {
          try {
            container.setPointerCapture(e.pointerId);
            state.captured = true;
          } catch {}
        }
      }

      if (state.axis !== "x") return;

      if (Math.abs(dx) > 10) state.hadRealSwipe = true;
      if (e.cancelable) e.preventDefault();

      state.currentTranslate = state.prevTranslate + dx;
      setTranslate(state.currentTranslate, false);
    };

    const endDrag = (e) => {
      if (!state.dragging) return;
      if (state.pointerId != null && e?.pointerId != null && e.pointerId !== state.pointerId) return;

      state.dragging = false;

      const movedBy = state.currentTranslate - state.prevTranslate;
      const w = width();
      const threshold = Math.max(40, w * 0.12);

      if (movedBy < -threshold && state.index < slides.length - 1) state.index++;
      else if (movedBy > threshold && state.index > 0) state.index--;

      state.blockClickUntil = state.hadRealSwipe ? (Date.now() + 220) : 0;

      snapTo(state.index, true);

      if (state.captured && e?.pointerId != null && container.releasePointerCapture) {
        try { container.releasePointerCapture(e.pointerId); } catch {}
      }

      state.pointerId = null;
      state.axis = null;
      state.captured = false;
      state.hadRealSwipe = false;
    };

    container.addEventListener("pointerdown", startDrag, { passive: false });
    container.addEventListener("pointermove", moveDrag, { passive: false });
    container.addEventListener("pointerup", endDrag, { passive: true });
    container.addEventListener("pointercancel", endDrag, { passive: true });
    container.addEventListener("pointerleave", endDrag, { passive: true });

    btnRight?.addEventListener("click", (e) => {
      e.stopPropagation();
      snapTo(state.index + 1, true);
    });
    btnLeft?.addEventListener("click", (e) => {
      e.stopPropagation();
      snapTo(state.index - 1, true);
    });

    window.addEventListener("resize", () => snapTo(state.index, false), { passive: true });

    snapTo(0, false);
  }

  // globale Slider-Init für vorhandene Container
  $$(".media-container").forEach(initMediaSlider);

  // =========================
  // Startseite: Inserate laden (nur wenn Container existiert)
  // =========================
  function toNum(v) {
    if (v === null || v === undefined || v === "") return NaN;
    const s = String(v)
      .trim()
      .replace(/[\u202F\u00A0\s]/g, "")
      .replace(/[€]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function pickPrice(...vals) {
    for (const v of vals) {
      const n = toNum(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return NaN;
  }
  function fmtEUR(v) {
    const n = toNum(v);
    return Number.isFinite(n) ? n.toLocaleString("de-DE") + " €" : "Preis n. a.";
  }
  function sanitizePhone(raw) {
    return raw ? String(raw).replace(/[^\d+]/g, "") : "";
  }
  function getDocId(doc) {
    if (!doc) return null;
    if (doc._id && typeof doc._id === "object" && typeof doc._id.$oid === "string") return doc._id.$oid;
    if (typeof doc._id === "string") return doc._id;
    if (typeof doc.id === "string") return doc.id;
    return null;
  }
  function sellerInitials(name = "") {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => (p[0] || "").toUpperCase()).join("") || "AV";
  }
  function toAnzeigePayload(item) {
    const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
    const merged = { ...raw, ...item };

    if (merged.verkauf_kilometer == null && item.verkauf_kilometer != null) merged.verkauf_kilometer = item.verkauf_kilometer;
    if (!merged.verkauf_erstzulassung && item.verkauf_erstzulassung) merged.verkauf_erstzulassung = item.verkauf_erstzulassung;
    if (!merged.verkauf_kraftstoff && item.verkauf_kraftstoff) merged.verkauf_kraftstoff = item.verkauf_kraftstoff;
    if (!merged.verkauf_getriebe && item.verkauf_getriebe) merged.verkauf_getriebe = item.verkauf_getriebe;
    if (!merged.verkauf_leistung && item.verkauf_leistung) merged.verkauf_leistung = item.verkauf_leistung;
    if (!merged.verkauf_verbrauch_kombiniert && item.verkauf_verbrauch_kombiniert) merged.verkauf_verbrauch_kombiniert = item.verkauf_verbrauch_kombiniert;
    if (!merged.verkauf_verkaeufer && item.verkauf_verkaeufer) merged.verkauf_verkaeufer = item.verkauf_verkaeufer;
    if (!merged.verkauf_name && item.verkauf_name) merged.verkauf_name = item.verkauf_name;

    if (merged.verkauf_brutto == null && merged.brutto_preis != null) merged.verkauf_brutto = merged.brutto_preis;
    if (merged.verkauf_brutto == null && merged["brutto-preis"] != null) merged.verkauf_brutto = merged["brutto-preis"];
    if (merged.verkauf_preis == null && item.preis != null) merged.verkauf_preis = item.preis;

    if (!merged.telefon && item.telefon) merged.telefon = item.telefon;
    return merged;
  }

  async function fetchInserate(page = 1, limit = 9) {
    const url = `/inserate?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error("Fetch /inserate fehlgeschlagen");
    return res.json();
  }

  async function loadHomeListings() {
    const container = document.getElementById("homeResults");
    if (!container) return;

    container.innerHTML = "<p style='opacity:.7'>Lade Inserate…</p>";

    try {
      const { items } = await fetchInserate(1, 9);
      const list = Array.isArray(items) ? items : [];

      if (!list.length) {
        container.innerHTML = "<p>Aktuell sind keine Fahrzeuge online.</p>";
        return;
      }

      container.innerHTML = "";

      list.forEach((inserat) => {
        const imgs  = Array.isArray(inserat.images) ? inserat.images : [];
        const tel   = sanitizePhone(inserat.telefon);
        const titel = inserat.titel || "Unbekanntes Fahrzeug";

        const preisNum = pickPrice(
          inserat["brutto-preis"],
          inserat.brutto_preis,
          inserat.verkauf_brutto,
          inserat.preis,
          inserat.verkauf_preis,
          inserat.verkauf_netto
        );
        const preis = fmtEUR(preisNum);

        const kurz = inserat.verkauf_kurzbeschreibung || "";
        const _id  = getDocId(inserat) || "";

        const rawType = String(inserat.seller?.type || inserat.verkauf_verkaeufer || "").toLowerCase();
        const isHaendler =
          rawType === "haendler" || rawType === "händler" || rawType.includes("händ") || rawType.includes("haend");

        const sellerName =
          inserat.seller?.name || inserat.verkauf_name || (isHaendler ? "Händler" : "Privatanbieter");

        const sellerLogo =
          inserat.seller?.logoUrl ||
          inserat.raw?.seller?.logoUrl ||
          inserat.logoUrl ||
          "";

        const sellerLocation =
          inserat.standort || [inserat.plz, inserat.ort].filter(Boolean).join(" ") || "Standort nicht angegeben";

        const card = document.createElement("div");
        card.className = "car-card";
        card.innerHTML = `
          <div class="car-card-media">
            <div class="card-actions mobile-only">
              <button class="save-btn" title="Auto speichern"><i class="fas fa-heart"></i></button>
              <a href="${tel ? `tel:${tel}` : "#"}"
                 class="contact-btn clean-phone"
                 title="Verkäufer kontaktieren"
                 role="button"
                 ${tel ? "" : "aria-disabled='true'"} >
                <i class="fas fa-phone"></i>
              </a>
            </div>

            <div class="media-container">
              <div class="slides">
                ${imgs.map((src) => `<img src="${src}" class="slide" alt="" draggable="false">`).join("")}
                ${
                  inserat.video
                    ? `<video class="slide" playsinline controls preload="metadata">
                         <source src="${inserat.video}" type="video/mp4">
                       </video>`
                    : ""
                }
              </div>

              <button class="media-arrow left" type="button"><i class="fas fa-chevron-left"></i></button>
              <button class="media-arrow right" type="button"><i class="fas fa-chevron-right"></i></button>
            </div>
          </div>

          <div class="car-details">
            <div class="car-top-row">
              <h2 class="car-title">${titel}</h2>
              <p class="car-price">${preis}</p>
            </div>

            <p class="car-subtitle">${kurz}</p>

            <div class="car-info-grid">
              <p><i class="fas fa-road"></i> ${inserat.verkauf_kilometer ?? "—"} km</p>
              <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.verkauf_erstzulassung || "—"}</p>
              <p><i class="fas fa-gas-pump"></i> ${inserat.verkauf_kraftstoff || "—"}</p>
              <p><i class="fas fa-gauge-high"></i> ${inserat.verkauf_leistung ?? "—"} PS</p>
              <p><i class="fas fa-gears"></i> ${inserat.verkauf_getriebe || "—"}</p>
              <p><i class="fas fa-tint"></i> ${inserat.verkauf_verbrauch_kombiniert || "—"} l/100 km</p>
            </div>

            <div class="dealer-info">
              <div class="dealer-row">
                <div class="dealer-avatar">
                  <img alt="${sellerName} Logo">
                  <span class="dealer-initials">${sellerInitials(sellerName)}</span>
                </div>

                <div class="dealer-meta">
                  <div class="dealer-name">${sellerName}</div>
                  <div class="dealer-location">${sellerLocation}</div>
                </div>
              </div>
            </div>
          </div>
        `;

        card.addEventListener("click", (e) => {
          const isAction = e.target.closest(".card-actions button, .card-actions a, .media-arrow, video");
          if (isAction) return;

          try {
            localStorage.setItem("ausgewaehltesInserat", JSON.stringify(toAnzeigePayload(inserat)));
          } catch {}

          if (_id) window.location.href = `anzeige.html?id=${encodeURIComponent(_id)}`;
          else window.location.href = `anzeige.html`;
        });

        container.appendChild(card);

        // Slider init (guarded)
        initMediaSlider(card.querySelector(".media-container"));

        // Video: Tap darf nicht Card öffnen
        card.querySelectorAll("video").forEach((v) => {
          v.setAttribute("playsinline", "");
          v.setAttribute("controls", "");
          v.setAttribute("preload", "metadata");
          v.addEventListener("pointerdown", (ev) => ev.stopPropagation(), { passive: true });
          v.addEventListener("click", (ev) => ev.stopPropagation());
        });

        // Avatar/Logo robust
        const avatar = card.querySelector(".dealer-avatar");
        const img = avatar?.querySelector("img");
        if (avatar && img) {
          avatar.classList.remove("has-logo");
          img.removeAttribute("src");

          if (sellerLogo) {
            img.addEventListener("load", () => {
              if (img.naturalWidth > 0) avatar.classList.add("has-logo");
            }, { once: true });

            img.addEventListener("error", () => {
              avatar.classList.remove("has-logo");
              img.removeAttribute("src");
            }, { once: true });

            img.src = sellerLogo;
            if (img.complete && img.naturalWidth > 0) avatar.classList.add("has-logo");
          }
        }

        // optional: Hochformat
        card.querySelectorAll(".slide").forEach((m) => {
          if (m.tagName === "VIDEO") {
            m.addEventListener("loadedmetadata", () => {
              if (m.videoHeight > m.videoWidth) m.classList.add("portrait-zoom");
            });
          } else if (m.tagName === "IMG") {
            m.addEventListener("load", () => {
              if (m.naturalHeight > m.naturalWidth) m.classList.add("portrait-zoom");
            });
          }
        });
      });
    } catch (err) {
      console.error("Fehler beim Laden der Start-Inserate:", err);
      container.innerHTML = "<p>Fehler beim Laden der Inserate.</p>";
    }
  }

  // Startseite nur wenn homeResults existiert
  loadHomeListings();

  // =========================
  // Verkaufen Click (deine Funktion global verfügbar)
  // =========================
  window.handleVerkaufenClick = function handleVerkaufenClick() {
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    const role = localStorage.getItem("userRole");

    if (!isLoggedIn) window.location.href = "login.html";
    else if (role === "haendler") window.location.href = "haendler.html";
    else window.location.href = "privat.html";
  };

  // Logout global, falls Buttons es nutzen
  window.logout = logout;
  function logout() {
    fetch("/logout", { method: "POST", credentials: "include" })
      .then(() => {
        localStorage.clear();
        window.location.href = "index.html";
      })
      .catch(() => {
        localStorage.clear();
        window.location.href = "index.html";
      });
  }

  // =========================
  // Index: sessionStorage reset
  // =========================
  (function resetIndexSessionFlags() {
    const path = window.location.pathname;
    const isIndex = path === "/" || path.endsWith("/index.html");
    if (!isIndex) return;

    sessionStorage.removeItem("inseratGestartet");
    sessionStorage.removeItem("hatGespeichert");
  })();

  // =========================
  // Admin Passwort Check (wenn du es brauchst)
  // =========================
  window.checkPassword = function checkPassword() {
    const input = document.getElementById("password-input")?.value || "";
    const overlay = document.getElementById("password-overlay");
    const wrong = document.getElementById("wrong-password");

    if (input === "Peter211") {
      if (overlay) overlay.style.display = "none";
    } else {
      if (wrong) wrong.style.display = "block";
    }
  };

  // =========================
  // Footer Jahr
  // =========================
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());

  // Auth sync im Hintergrund (damit localStorage sauber ist)
  syncAuthToLocalStorage();
});





