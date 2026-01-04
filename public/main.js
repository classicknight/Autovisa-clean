/* ============================
   main.js — KOMPLETT KORRIGIERT (konsolidiert)
   - nur EIN DOMContentLoaded
   - keine doppelten SlimSelect/Preis-Listener
   - nur EINE initMediaSlider-Implementierung (die gute)
   - Navbar + Login-Redirects + Filter + Selects + Startseiten-Inserate sauber getrennt
   ============================ */

   document.documentElement.classList.remove("no-js");

   /* ========= 0) HIER DEINE DATEN EINFÜGEN =========
      LASS diese beiden Objekte UNVERÄNDERT (einfach aus deinem Code kopieren):
      - modelData  (riesiger Block)
      - modelGroups (Regex-Block)
   */
   const modelData = {
     /* >>> HIER DEIN KOMPLETTES modelData OBJEKT EINFÜGEN (unverändert) <<< */
   };
   
   const modelGroups = {
     /* >>> HIER DEIN KOMPLETTES modelGroups OBJEKT EINFÜGEN (unverändert) <<< */
   };
   /* =============================================== */
   
   // ---------- Utils ----------
   const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
   
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
   
   // gemergtes Payload für anzeige.html, damit dort alle verkauf_* Felder sicher vorhanden sind
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
   
     // Preise robuster abbilden
     if (merged.verkauf_brutto == null && merged.brutto_preis != null) merged.verkauf_brutto = merged.brutto_preis;
     if (merged.verkauf_brutto == null && merged["brutto-preis"] != null) merged.verkauf_brutto = merged["brutto-preis"];
     if (merged.verkauf_preis == null && item.preis != null) merged.verkauf_preis = item.preis;
   
     if (!merged.telefon && item.telefon) merged.telefon = item.telefon;
     return merged;
   }
   
   // ===== Server laden (holt online-Inserate) =====
   async function fetchInserate(page = 1, limit = 9) {
     const url = `/inserate?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
     const res = await fetch(url, { credentials: "omit" });
     if (!res.ok) throw new Error("Fetch /inserate fehlgeschlagen");
     return res.json(); // { page, limit, total, items }
   }
   
   /* =========================
      1) Navbar (Hamburger + Dropdowns)
      ========================= */
   function initNavbar() {
     const navLinks = document.getElementById("nav-links");
     const hamburger = document.getElementById("hamburger");
     const dropdownLis = document.querySelectorAll(".dropdown");
     const dropdownLinks = document.querySelectorAll('.dropdown > a[aria-haspopup="true"], .dropdown > a');
   
     function closeAllDropdowns(except = null) {
       dropdownLis.forEach((li) => {
         if (li !== except) {
           li.classList.remove("open");
           const trigger = li.querySelector('a[aria-haspopup="true"], a');
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
       const trigger = li.querySelector('a[aria-haspopup="true"], a');
       const menu = li.querySelector(".dropdown-menu");
       if (!trigger || !menu) return;
   
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
       const menu = li?.querySelector(".dropdown-menu");
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
   
     // Dropdown nur per Klick
     dropdownLinks.forEach((link) => {
       link.setAttribute("aria-expanded", "false");
       link.addEventListener("click", (e) => {
         const li = link.closest(".dropdown");
         const menu = li?.querySelector(".dropdown-menu");
         if (!li || !menu) return; // normale Links nicht blocken
   
         e.preventDefault();
         e.stopPropagation();
         toggleDropdown(link);
       });
     });
   
     // Outside Click schließt
     document.addEventListener("click", (e) => {
       if (!e.target.closest(".navbar")) {
         if (navLinks) navLinks.classList.remove("active");
         if (hamburger) hamburger.setAttribute("aria-expanded", "false");
         closeAllDropdowns();
       }
     });
   
     // ESC schließt
     document.addEventListener("keydown", (e) => {
       if (e.key === "Escape") {
         if (navLinks) navLinks.classList.remove("active");
         if (hamburger) hamburger.setAttribute("aria-expanded", "false");
         closeAllDropdowns();
       }
     });
   
     // Reposition nur Desktop relevant
     const repositionOpen = () => {
       const isMobile = window.matchMedia("(max-width: 900px)").matches;
       if (isMobile) return;
       document.querySelectorAll(".dropdown.open").forEach(positionMenu);
     };
     window.addEventListener("resize", repositionOpen, { passive: true });
     window.addEventListener("scroll", repositionOpen, { passive: true });
   }
   
   /* =========================
      2) Login-abhängige Links (Navbar + Mobile Icons)
      ========================= */
   function checkLoginAndRedirect(targetUrl) {
     fetch("/getNutzerInfo", { credentials: "include" })
       .then((res) => res.json())
       .then((data) => {
         if (data?.eingeloggt) {
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
   
   function initProtectedNavLinks() {
     const savedCarsLink = document.getElementById("saved-cars-link");
     const myCarsLink = document.getElementById("my-cars-link");
     const soldCarsLink = document.getElementById("sold-cars-link");
     const messagesLink = document.getElementById("messages-link");
   
     if (savedCarsLink) savedCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#saved-cars"); });
     if (myCarsLink) myCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#car-list"); });
     if (soldCarsLink) soldCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#sold-cars"); });
     if (messagesLink) messagesLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#messages-list"); });
   
     const mobileSaved = document.getElementById("mobile-saved");
     const mobileMessages = document.getElementById("mobile-messages");
   
     if (mobileSaved) {
       mobileSaved.addEventListener("click", (e) => {
         e.preventDefault();
         checkLoginAndRedirect("übersicht.html#saved-cars");
       });
     }
     if (mobileMessages) {
       mobileMessages.addEventListener("click", (e) => {
         e.preventDefault();
         checkLoginAndRedirect("übersicht.html#messages-list");
       });
     }
   }
   
   /* =========================
      3) Smooth Scroll (Startseite)
      ========================= */
   function initSmoothScroll() {
     document.querySelectorAll('a[href="#search-section"]').forEach((a) => {
       a.addEventListener("click", (e) => {
         e.preventDefault();
         document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
       });
     });
   
     document.querySelectorAll('a[href="#results-section"]').forEach((a) => {
       a.addEventListener("click", (e) => {
         e.preventDefault();
         document.querySelector("#results-section")?.scrollIntoView({ behavior: "smooth" });
       });
     });
   }
   
   /* =========================
      4) Filter Toggle (Weitere Filter)
      ========================= */
   function initFilterToggle() {
     const form = document.querySelector(".search-form");
     const advancedBtn = form?.querySelector(".btn-advanced");
     const filters = document.getElementById("extra-filters");
   
     if (advancedBtn && filters) {
       advancedBtn.addEventListener("click", () => {
         filters.classList.toggle("show");
         advancedBtn.textContent = filters.classList.contains("show") ? "Filter schließen" : "Weitere Filter";
       });
     }
   }
   
   /* =========================
      5) Login-State sync + Auth-Link (Abmelden)
      ========================= */
   async function syncLoginState() {
     try {
       const res = await fetch("/getNutzerInfo", { credentials: "include" });
       const data = await res.json();
   
       if (data?.eingeloggt) {
         localStorage.setItem("isLoggedIn", "true");
         localStorage.setItem("userRole", data.rolle || "privat");
         localStorage.setItem("userId", data.nutzerId || "");
         return true;
       }
   
       localStorage.removeItem("isLoggedIn");
       localStorage.removeItem("userRole");
       localStorage.removeItem("userId");
       return false;
     } catch {
       localStorage.removeItem("isLoggedIn");
       localStorage.removeItem("userRole");
       localStorage.removeItem("userId");
       return false;
     }
   }
   
   function doLogout(redirect = null) {
     fetch("/logout", { method: "POST", credentials: "include" })
       .finally(() => {
         localStorage.clear();
         sessionStorage.clear();
         if (redirect) window.location.href = redirect;
         else location.reload();
       });
   }
   
   async function initAuthLink() {
     const authLink = document.getElementById("auth-link");
     if (!authLink) return;
   
     const loggedIn = await syncLoginState();
     if (!loggedIn) return;
   
     authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
     const logoutLink = document.getElementById("logout-link");
     if (logoutLink) {
       logoutLink.addEventListener("click", (e) => {
         e.preventDefault();
         doLogout(null);
       });
     }
   }
   
   /* =========================
      6) SlimSelect + dynamische Marke/Modell + Custom-Felder
      ========================= */
   function ensureSlimOnce(selectEl, options) {
     if (!selectEl || !window.SlimSelect) return null;
     if (selectEl.dataset.slimInit === "1") return null;
     selectEl.dataset.slimInit = "1";
     return new SlimSelect(options);
   }
   
   function bindSelectWithCustom({ selectId, customId, placeholder }) {
     const select = document.getElementById(selectId);
     const custom = document.getElementById(customId);
     if (!select || !custom) return;
   
     ensureSlimOnce(select, {
       select: `#${selectId}`,
       placeholder,
       allowDeselect: true,
       showSearch: false
     });
   
     // initial
     if (select.value === "custom") {
       custom.style.display = "block";
     } else {
       custom.style.display = "none";
     }
   
     select.addEventListener("change", () => {
       if (select.value === "custom") {
         custom.style.display = "block";
         custom.focus();
       } else {
         custom.style.display = "none";
         custom.value = "";
       }
     });
   }
   
   function initSearchFormSelects() {
     if (!window.SlimSelect) return;
   
     // Marke/Modell
     const brandDropdown = document.getElementById("marke");
     const modelDropdown = document.getElementById("modell");
   
     if (brandDropdown) {
       ensureSlimOnce(brandDropdown, {
         select: "#marke",
         placeholder: "Marke wählen",
         allowDeselect: true,
         showSearch: true
       });
     }
   
     // Jahr/Monat
     const yearSelect = document.getElementById("first-registration-year");
     const monthSelect = document.getElementById("first-registration-month");
   
     let slimYear = null;
     let slimMonth = null;
   
     if (yearSelect && monthSelect) {
       // Jahre nur einmal füllen
       if (yearSelect.dataset.filled !== "1") {
         const currentYear = new Date().getFullYear();
         for (let year = currentYear; year >= 1900; year--) {
           const option = document.createElement("option");
           option.value = String(year);
           option.text = String(year);
           yearSelect.appendChild(option);
         }
         yearSelect.dataset.filled = "1";
       }
   
       slimYear = ensureSlimOnce(yearSelect, {
         select: "#first-registration-year",
         placeholder: "Jahr wählen",
         allowDeselect: true,
         showSearch: false
       });
   
       slimMonth = ensureSlimOnce(monthSelect, {
         select: "#first-registration-month",
         placeholder: "Monat wählen",
         allowDeselect: true,
         showSearch: false
       });
   
       // Monat initial deaktivieren
       if (slimMonth?.disable) slimMonth.disable();
   
       yearSelect.addEventListener("change", () => {
         if (yearSelect.value) {
           if (slimMonth?.enable) slimMonth.enable();
         } else {
           if (slimMonth?.disable) slimMonth.disable();
           monthSelect.selectedIndex = 0;
         }
       });
     }
   
     // Modell (SlimSelect)
     let slimModell = null;
     let currentModelOptions = [];
   
     if (modelDropdown) {
       slimModell = ensureSlimOnce(modelDropdown, {
         select: "#modell",
         placeholder: "Bitte zuerst Marke wählen",
         closeOnSelect: false,
         allowDeselect: true,
         hideSelected: false,
         showSearch: false
       });
     }
   
     // afterChange nur EINMAL binden (wichtig: sonst multipliziert sich das)
     const onModelAfterChange = (newSelected) => {
       if (!modelDropdown || !slimModell) return;
   
       const selectedValues = (newSelected || []).map((s) => s.value);
       const allValuesToSelect = new Set();
   
       selectedValues.forEach((selectedValue) => {
         const regex = modelGroups?.[selectedValue];
         if (regex) {
           currentModelOptions.forEach((opt) => {
             if (regex.test(opt.value)) allValuesToSelect.add(opt.value);
           });
           allValuesToSelect.add(selectedValue);
         } else {
           allValuesToSelect.add(selectedValue);
         }
       });
   
       // native Optionen aktualisieren
       modelDropdown.querySelectorAll("option").forEach((opt) => {
         opt.selected = allValuesToSelect.has(opt.value);
       });
   
       // SlimSelect aktualisieren ohne afterChange erneut auszulösen (SlimSelect v2: setSelected(values, triggerOnChange=false))
       slimModell.setSelected([...allValuesToSelect], false);
     };
   
     // Marke → Modelle neu setzen
     if (brandDropdown && modelDropdown && slimModell) {
       // initial Placeholder
       const setModelPlaceholder = () => {
         modelDropdown.innerHTML = `<option value="" disabled selected hidden>Bitte zuerst Marke wählen</option>`;
         slimModell.setData([
           { text: "Bitte zuerst Marke wählen", placeholder: true, disabled: true, selected: true }
         ]);
         currentModelOptions = [];
       };
   
       setModelPlaceholder();
   
       // afterChange handler einmalig setzen
       if (slimModell.on) slimModell.on("afterChange", onModelAfterChange);
   
       brandDropdown.addEventListener("change", function () {
         const selectedBrand = this.value;
   
         if (!selectedBrand || !modelData?.[selectedBrand]) {
           setModelPlaceholder();
           return;
         }
   
         currentModelOptions = modelData[selectedBrand].map((m) => ({ text: m, value: m }));
   
         // Native Optionen neu setzen
         modelDropdown.innerHTML = "";
         currentModelOptions.forEach((opt) => {
           const option = document.createElement("option");
           option.value = opt.value;
           option.text = opt.text;
           modelDropdown.appendChild(option);
         });
   
         // SlimSelect neu füttern + Auswahl zurücksetzen
         slimModell.setData(currentModelOptions);
         slimModell.setSelected([], false);
       });
     }
   
     // Custom-Selects (nur einmal, ohne Duplikate)
     bindSelectWithCustom({ selectId: "price-select", customId: "price-custom", placeholder: "Preis wählen" });
     bindSelectWithCustom({ selectId: "kilometer-select", customId: "kilometer-custom", placeholder: "Kilometer wählen" });
   
     // Getriebe/Kraftstoff
     const gearSelect = document.getElementById("gear");
     if (gearSelect) {
       ensureSlimOnce(gearSelect, { select: "#gear", placeholder: "Getriebe wählen", allowDeselect: true, showSearch: false });
     }
     const fuelSelect = document.getElementById("fuel");
     if (fuelSelect) {
       ensureSlimOnce(fuelSelect, { select: "#fuel", placeholder: "Kraftstoff wählen", allowDeselect: true, showSearch: false });
     }
   
     // Umkreis (Ort → enable/disable)
     const distanceSelect = document.getElementById("distance-select");
     const distanceCustom = document.getElementById("distance-custom");
     const locationInput = document.getElementById("location");
   
     let slimDistance = null;
     if (distanceSelect) {
       slimDistance = ensureSlimOnce(distanceSelect, {
         select: "#distance-select",
         placeholder: "Umkreis wählen",
         allowDeselect: true,
         showSearch: false
       });
     }
   
     if (locationInput && distanceSelect && distanceCustom) {
       const setDistanceEnabled = (enabled) => {
         distanceSelect.disabled = !enabled;
         if (slimDistance?.enable && slimDistance?.disable) {
           enabled ? slimDistance.enable() : slimDistance.disable();
         }
         if (!enabled) {
           distanceSelect.selectedIndex = 0;
           distanceCustom.style.display = "none";
           distanceCustom.value = "";
         }
       };
   
       setDistanceEnabled(!!locationInput.value.trim());
   
       locationInput.addEventListener("input", () => {
         setDistanceEnabled(!!locationInput.value.trim());
       });
   
       distanceSelect.addEventListener("change", () => {
         if (distanceSelect.value === "custom") {
           distanceCustom.style.display = "block";
           distanceCustom.focus();
         } else {
           distanceCustom.style.display = "none";
           distanceCustom.value = "";
         }
       });
     }
   }
   
   /* =========================
      7) Media Slider (Pointer + Pfeile) — EINMAL
      ========================= */
   function initMediaSlider(container) {
     if (!container) return;
   
     // Guard: nicht doppelt initialisieren
     if (container.dataset.sliderInit === "1") return;
     container.dataset.sliderInit = "1";
   
     const slidesWrapper = container.querySelector(".slides");
     if (!slidesWrapper) return;
   
     const slides = Array.from(slidesWrapper.children || []);
     if (!slides.length) return;
   
     const state = {
       index: 0,
       dragging: false,
       axis: null,
       pointerId: null,
       startX: 0,
       startY: 0,
       prevTranslate: 0,
       currentTranslate: 0,
   
       // Click-Block nur nach echtem Swipe
       blockClickUntil: 0,
       hadRealSwipe: false,
   
       // PointerCapture erst nach Axis-Lock auf X
       captured: false,
     };
   
     // Basis-Styles
     slidesWrapper.style.display = "flex";
     slidesWrapper.style.willChange = "transform";
     slides.forEach((slide) => {
       slide.style.flex = "0 0 100%";
       slide.style.minWidth = "100%";
     });
   
     const btnLeft = container.querySelector(".media-arrow.left");
     const btnRight = container.querySelector(".media-arrow.right");
   
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
   
     const updateArrows = () => {
       if (btnLeft) btnLeft.disabled = state.index <= 0;
       if (btnRight) btnRight.disabled = state.index >= slides.length - 1;
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
       updateArrows();
       pauseInactiveVideos();
     };
   
     // Verhindert „Swipe → Click → Karte öffnet“ (nur nach echtem Swipe)
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
   
         // scroll -> abbrechen
         if (state.axis === "y") {
           state.dragging = false;
           state.pointerId = null;
           return;
         }
   
         // PointerCapture erst nach X-Lock
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
   
   /* =========================
      8) Startseite: Neueste Inserate laden
      ========================= */
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
   
       // Dealer Rating Helpers (nur Startseite)
       const fmtRating = (v) => {
         const n = Number(v);
         return Number.isFinite(n) ? n.toFixed(1).replace(".", ",") : "";
       };
   
       const starsHTML = (avg) => {
         const a = Number(avg);
         if (!Number.isFinite(a) || a <= 0) return "";
         let out = `<span class="stars" aria-hidden="true">`;
         for (let i = 1; i <= 5; i++) {
           if (a >= i - 0.25) out += `<i class="fa-solid fa-star"></i>`;
           else if (a >= i - 0.75) out += `<i class="fa-solid fa-star-half-stroke"></i>`;
           else out += `<i class="fa-regular fa-star"></i>`;
         }
         out += `</span>`;
         return out;
       };
   
       const ratingBlock = ({ isHaendler, avg, count }) => {
         const c = Number(count);
         const a = Number(avg);
         if (!isHaendler) return "";
         if (!Number.isFinite(c) || c <= 0) return "";
         if (!Number.isFinite(a) || a <= 0) return "";
         const label = `Bewertung ${fmtRating(a)} von 5 Sternen (${c} Bewertungen)`;
         return `
           <div class="dealer-rating" aria-label="${label}">
             ${starsHTML(a)}
             <span class="dealer-rating__value">${fmtRating(a)}</span>
             <span class="dealer-rating__count" title="${c} Bewertungen">(${c})</span>
           </div>
         `;
       };
   
       container.innerHTML = "";
   
       list.forEach((inserat) => {
         const imgs = Array.isArray(inserat.images) ? inserat.images : [];
         const tel = sanitizePhone(inserat.telefon);
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
         const _id = getDocId(inserat) || "";
   
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
   
         const ratingAvg = inserat.seller?.ratingAvg;
         const ratingCount = inserat.seller?.ratingCount;
         const dealerRatingHTML = ratingBlock({ isHaendler, avg: ratingAvg, count: ratingCount });
   
         const card = document.createElement("div");
         card.className = "car-card";
         card.innerHTML = `
           <div class="car-card-media">
             <div class="card-actions mobile-only">
               <button class="save-btn" title="Auto speichern" type="button"><i class="fas fa-heart"></i></button>
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
                 ${imgs.map((src) => `<img src="${src}" class="slide" alt="">`).join("")}
                 ${
                   inserat.video
                     ? `<video class="slide" playsinline controls preload="metadata">
                          <source src="${inserat.video}" type="video/mp4">
                        </video>`
                     : ""
                 }
               </div>
   
               <button class="media-arrow left"  type="button"><i class="fas fa-chevron-left"></i></button>
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
                   ${dealerRatingHTML}
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
             const payload = toAnzeigePayload(inserat);
             localStorage.setItem("ausgewaehltesInserat", JSON.stringify(payload));
           } catch {}
   
           if (_id) window.location.href = `anzeige.html?id=${encodeURIComponent(_id)}`;
           else window.location.href = `anzeige.html`;
         });
   
         container.appendChild(card);
   
         // Slider init
         initMediaSlider(card.querySelector(".media-container"));
   
         // Video: iPhone/Safari Play fix + Navigation block
         card.querySelectorAll("video").forEach((v) => {
           v.setAttribute("playsinline", "");
           v.setAttribute("controls", "");
           v.setAttribute("preload", "metadata");
           v.addEventListener("pointerdown", (ev) => ev.stopPropagation(), { passive: true });
           v.addEventListener("click", (ev) => ev.stopPropagation());
         });
   
         // Avatar/Logo (Safari-safe)
         const avatar = card.querySelector(".dealer-avatar");
         const img = avatar?.querySelector("img");
         if (avatar && img) {
           avatar.classList.remove("has-logo");
           img.removeAttribute("src");
   
           if (sellerLogo) {
             try { img.loading = "eager"; } catch {}
   
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
   
         // Hochformat-Erkennung (optional)
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
   
   /* =========================
      9) Startseite: sessionStorage reset
      ========================= */
   function initSessionResetOnIndex() {
     const path = window.location.pathname;
     const istNurAufIndex = path === "/" || path.endsWith("/index.html");
     if (istNurAufIndex) {
       sessionStorage.removeItem("inseratGestartet");
       sessionStorage.removeItem("hatGespeichert");
     }
   }
   
   /* =========================
      10) Exposed Funktionen (falls HTML onclick nutzt)
      ========================= */
   function handleVerkaufenClick() {
     const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
     const role = localStorage.getItem("userRole");
   
     if (!isLoggedIn) {
       window.location.href = "login.html";
     } else if (role === "haendler") {
       window.location.href = "haendler.html";
     } else {
       window.location.href = "privat.html";
     }
   }
   
   // Hinweis: clientseitiges Passwort ist nicht sicher; nur als UI-Demo ok.
   function checkPassword() {
     const input = document.getElementById("password-input")?.value || "";
     const overlay = document.getElementById("password-overlay");
     const wrong = document.getElementById("wrong-password");
   
     if (!overlay || !wrong) return;
   
     if (input === "Peter211") {
       overlay.style.display = "none";
     } else {
       wrong.style.display = "block";
     }
   }
   
   // Backward-compat für alte Aufrufe
   window.handleVerkaufenClick = handleVerkaufenClick;
   window.logout = () => doLogout("index.html");
   window.checkPassword = checkPassword;
   
   /* =========================
      11) BOOTSTRAP: nur EIN DOMContentLoaded
      ========================= */
   document.addEventListener("DOMContentLoaded", async () => {
     initNavbar();
     initProtectedNavLinks();
     initSmoothScroll();
     initFilterToggle();
     initSearchFormSelects();
     initSessionResetOnIndex();
     await initAuthLink();
   
     // Slider für alle vorhandenen Media-Container (z. B. Suchseite/Übersicht)
     document.querySelectorAll(".media-container").forEach(initMediaSlider);
   
     // Startseite: Inserate nur laden, wenn Container existiert
     if (document.getElementById("homeResults")) {
       await loadHomeListings();
     }
   
     // Footer-Jahr
     const y = document.getElementById("year");
     if (y) y.textContent = new Date().getFullYear();
   });
   








