// suche.js (komplett)
// Entfernt "no-js" Klasse, falls im HTML gesetzt
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", () => {
  // ===== DOM Refs =====
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");

  const toggleBtn     = document.getElementById("toggleFiltersBtn");
  const sidebar       = document.querySelector(".filter-sidebar");

  const searchLink    = document.querySelector('a[href="#search-section"]');
  const makeInput     = document.getElementById("make");
  const modelInput    = document.getElementById("model");
  const titleInput    = document.getElementById("title");

  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");

  const container     = document.getElementById("carResults");
  const pager         = document.getElementById("pager");
  const sortBy        = document.getElementById("sortBy");
  const applyFilters  = document.getElementById("applyFiltersBtn");

  // ===== State =====
  let allItems = [];              // Vom Server (ungefiltert)
  let filteredItems = [];         // Nach Client-Filtern
  let page = 1;                   // Aktuelle Seite (Client-Pager)
  const pageSize = 20;            // Server-limit (auch für Client-Pager genutzt)

  // ===== Helpers =====
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const toNum = (v) => (v === null || v === undefined || v === "" ? NaN : Number(String(v).replace(/\./g, "").replace(",", ".")));
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

    // Stagger
    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    // Nur Desktop zentrieren
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

  // ===== Navbar Login/Logout: Abmelden-Link setzen, wenn eingeloggt =====
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
    } catch {
      /* ignore */
    }
  })();

  // ===== Login-Redirects für gespeicherte/meine Autos =====
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

  // ===== Medien-Slider =====
  function initMediaSlider(mediaContainer) {
    if (!mediaContainer) return;
    const slidesWrapper = mediaContainer.querySelector(".slides");
    if (!slidesWrapper) return;
    const slides = Array.from(slidesWrapper.children);

    const state = {
      currentIndex: 0,
      isDragging: false,
      startPos: 0,
      currentTranslate: 0,
      prevTranslate: 0,
      animationID: null,
    };

    slidesWrapper.style.display = "flex";
    slidesWrapper.style.transition = "transform 0.3s ease";
    slidesWrapper.style.willChange = "transform";
    slides.forEach(slide => { slide.style.flex = "0 0 100%"; slide.style.minWidth = "100%"; });

    function setSliderPosition() {
      slidesWrapper.style.transform = `translateX(${state.currentTranslate}px)`;
    }
    function animation() {
      setSliderPosition();
      if (state.isDragging) requestAnimationFrame(animation);
    }
    function pointerDown(event) {
      state.isDragging = true;
      state.startPos = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
      state.animationID = requestAnimationFrame(animation);
    }
    function pointerMove(event) {
      if (!state.isDragging) return;
      const currentPosition = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
      state.currentTranslate = state.prevTranslate + currentPosition - state.startPos;
    }
    function pointerUp() {
      if (!state.isDragging) return;
      state.isDragging = false;
      cancelAnimationFrame(state.animationID);
      const movedBy = state.currentTranslate - state.prevTranslate;
      if (movedBy < -50 && state.currentIndex < slides.length - 1) state.currentIndex++;
      else if (movedBy > 50 && state.currentIndex > 0) state.currentIndex--;
      updateSlidePosition();
    }
    function updateSlidePosition() {
      const width = mediaContainer.clientWidth;
      state.currentTranslate = -state.currentIndex * width;
      state.prevTranslate = state.currentTranslate;
      setSliderPosition();
    }

    ["pointerdown","touchstart","mousedown"].forEach(ev => slidesWrapper.addEventListener(ev, pointerDown));
    ["pointermove","touchmove","mousemove"].forEach(ev => slidesWrapper.addEventListener(ev, pointerMove));
    ["pointerup","pointerleave","pointercancel","touchend","mouseup","mouseleave"].forEach(ev => slidesWrapper.addEventListener(ev, pointerUp));

    mediaContainer.querySelector(".media-arrow.right")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.currentIndex < slides.length - 1) { state.currentIndex++; updateSlidePosition(); }
    });
    mediaContainer.querySelector(".media-arrow.left")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.currentIndex > 0) { state.currentIndex--; updateSlidePosition(); }
    });

    window.addEventListener("resize", updateSlidePosition);
    updateSlidePosition();
  }

  // ===== Server-Daten laden =====
  async function fetchInserate(p = 1, limit = pageSize) {
    const url = `/inserate?page=${encodeURIComponent(p)}&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error("Fetch /inserate fehlgeschlagen");
    const data = await res.json(); // { page, limit, total, items }
    return data;
  }

  // ===== Client-Filter =====
  function applyClientFilters(items) {
    const priceFromEl = document.getElementById("priceFrom");
    const priceToEl   = document.getElementById("priceTo");
    const mileageFromEl = document.getElementById("mileageFrom");
    const mileageToEl   = document.getElementById("mileageTo");
    const powerFromEl = document.getElementById("powerFrom");
    const powerToEl   = document.getElementById("powerTo");
    const fuelTypeEl  = document.getElementById("fuelType");
    const transmissionEl = document.getElementById("transmission");
    const accidentFreeEl = document.getElementById("accidentFree");
    const inspectionUntilEl = document.getElementById("inspectionUntil");
    const firstRegFromEl    = document.getElementById("firstRegFrom");

    const priceFrom = toNum(priceFromEl?.value ?? "");
    const priceTo   = toNum(priceToEl?.value ?? "");
    const mileageFrom = toNum(mileageFromEl?.value ?? "");
    const mileageTo   = toNum(mileageToEl?.value ?? "");
    const powerFrom = toNum(powerFromEl?.value ?? "");
    const powerTo   = toNum(powerToEl?.value ?? "");
    const fuelType  = String(fuelTypeEl?.value || "Beliebig").toLowerCase();
    const transmission = String(transmissionEl?.value || "Beliebig").toLowerCase();
    const accidentFree = !!accidentFreeEl?.checked;
    const inspectionUntil = inspectionUntilEl?.value || ""; // YYYY-MM
    const firstRegFrom    = firstRegFromEl?.value || "";    // YYYY-MM

    return items.filter(i => {
      const preis = toNum(i.verkauf_brutto ?? i.verkauf_preis ?? i.preis);
      if (!isNaN(priceFrom) && priceFrom > 0 && !(preis >= priceFrom)) return false;
      if (!isNaN(priceTo)   && priceTo   > 0 && !(preis <= priceTo))   return false;

      const km = toNum(i.verkauf_kilometer ?? i.km);
      if (!isNaN(mileageFrom) && mileageFrom > 0 && !(km >= mileageFrom)) return false;
      if (!isNaN(mileageTo)   && mileageTo   > 0 && !(km <= mileageTo))   return false;

      const ps = toNum(i.verkauf_leistung ?? i.ps);
      if (!isNaN(powerFrom) && powerFrom > 0 && !(ps >= powerFrom)) return false;
      if (!isNaN(powerTo)   && powerTo   > 0 && !(ps <= powerTo))   return false;

      if (fuelType !== "beliebig") {
        const ft = String(i.verkauf_kraftstoff || "").toLowerCase();
        if (!ft.includes(fuelType)) return false;
      }

      if (transmission !== "beliebig") {
        const tr = String(i.verkauf_getriebe || "").toLowerCase();
        if (!tr.includes(transmission)) return false;
      }

      if (accidentFree) {
        const flag = i.unfallfrei === true ||
          (Array.isArray(i.verkauf_ausstattung) && i.verkauf_ausstattung.some(a => String(a).toLowerCase().includes("unfall")));
        if (!flag) return false;
      }

      if (inspectionUntil) {
        const hu = String(i.hu || i.verkauf_hu || "");
        if (hu && hu.length >= 7 && hu < inspectionUntil) return false;
      }

      if (firstRegFrom) {
        const ez = String(i.verkauf_erstzulassung || "");
        if (ez && ez.length >= 7 && ez < firstRegFrom) return false;
      }

      return true;
    });
  }

  // ===== Sortierung =====
  function sortItems(items) {
    const v = sortBy?.value || "relevance";
    const copy = items.slice();

    switch (v) {
      case "price-asc":
        copy.sort((a,b) => (toNum(a.verkauf_brutto ?? a.verkauf_preis ?? a.preis) || Infinity) - (toNum(b.verkauf_brutto ?? b.verkauf_preis ?? b.preis) || Infinity));
        break;
      case "price-desc":
        copy.sort((a,b) => (toNum(b.verkauf_brutto ?? b.verkauf_preis ?? b.preis) || -Infinity) - (toNum(a.verkauf_brutto ?? a.verkauf_preis ?? a.preis) || -Infinity));
        break;
      case "date-desc": {
        const getDate = (x) => (x?.veroeffentlichtAm ? new Date(x.veroeffentlichtAm) : x?._id?.$date ? new Date(x._id.$date) : new Date(0));
        copy.sort((a,b) => getDate(b) - getDate(a));
        break;
      }
      case "mileage-asc":
        copy.sort((a,b) => (toNum(a.verkauf_kilometer ?? a.km) || Infinity) - (toNum(b.verkauf_kilometer ?? b.km) || Infinity));
        break;
      default: // relevance
        // no-op (kannst du später mit Scoring befüllen)
        break;
    }
    return copy;
  }

  // ===== Rendering =====
  function renderPager(totalCount) {
    if (!pager) return;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    page = clamp(page, 1, totalPages);

    if (totalPages <= 1) {
      pager.innerHTML = "";
      return;
    }

    let html = `<button class="pager-btn" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>« Zurück</button>`;
    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end   = Math.min(totalPages, start + windowSize - 1);
    for (let p = start; p <= end; p++) {
      html += `<button class="pager-btn ${p === page ? "active" : ""}" data-page="${p}">${p}</button>`;
    }
    html += `<button class="pager-btn" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>Weiter »</button>`;
    pager.innerHTML = html;

    pager.querySelectorAll(".pager-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = Number(e.currentTarget.getAttribute("data-page"));
        if (!isNaN(target)) {
          page = clamp(target, 1, totalPages);
          renderItems(); // clientseitig blättern
        }
      });
    });
  }

  function renderItems() {
    if (!container) return;
    container.innerHTML = "";

    // Client-Pagination
    const total = filteredItems.length;
    const start = (page - 1) * pageSize;
    const end   = Math.min(start + pageSize, total);
    const view  = filteredItems.slice(start, end);

    if (!view.length) {
      container.innerHTML = "<p>❌ Keine Fahrzeuge gefunden.</p>";
      renderPager(total);
      return;
    }

    view.forEach(inserat => {
      const imgs = Array.isArray(inserat.images) ? inserat.images : [];
      const tel  = sanitizePhone(inserat.telefon);

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
            <p class="car-price">${fmtEUR(inserat.verkauf_brutto ?? inserat.verkauf_preis ?? inserat.preis)}</p>
          </div>
          <p class="car-subtitle">${inserat.verkauf_kurzbeschreibung || ""}</p>
          <div class="car-info-grid">
            <p><i class="fas fa-road"></i> ${inserat.verkauf_kilometer ?? "?"} km</p>
            <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.verkauf_erstzulassung || "?"}</p>
            <p><i class="fas fa-gas-pump"></i> ${inserat.verkauf_kraftstoff || "?"}</p>
            <p><i class="fas fa-gauge-high"></i> ${inserat.verkauf_leistung ?? "?"} PS</p>
            <p><i class="fas fa-gears"></i> ${inserat.verkauf_getriebe || "?"}</p>
            <p><i class="fas fa-tint"></i> ${inserat.verkauf_verbrauch_kombiniert || "?"} l/100 km</p>
          </div>
          <div class="dealer-info-row">
            <div class="dealer-info-text">
              ${String(inserat.verkauf_verkaeufer || "").toLowerCase() === "händler"
                ? `<strong>${inserat.verkauf_name || "Autohaus"}</strong><br>${inserat.standort || ""}`
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
    });

    renderPager(total);
  }

  // ===== Load + First Render =====
  async function loadAndRender() {
    try {
      // Server holt "frisch", aber wir paginieren clientseitig für schnelles Filtern
      const { items } = await fetchInserate(1, 200); // bis zu 200 laden; anpassen nach Bedarf
      allItems = Array.isArray(items) ? items : [];
      // Erstfilterung (leer -> alles)
      filteredItems = applyClientFilters(allItems);
      // Sortieren
      filteredItems = sortItems(filteredItems);
      page = 1;
      renderItems();
    } catch (err) {
      console.error("Fehler beim Laden der Inserate:", err);
      if (container) container.innerHTML = "<p>🚫 Fehler beim Laden der Inserate.</p>";
    }
  }

  // ===== Events: Filter & Sort =====
  applyFilters?.addEventListener("click", () => {
    filteredItems = applyClientFilters(allItems);
    filteredItems = sortItems(filteredItems);
    page = 1;
    renderItems();
  });

  sortBy?.addEventListener("change", () => {
    filteredItems = sortItems(filteredItems);
    page = 1;
    renderItems();
  });

  // ===== Init =====
  loadAndRender();
});
