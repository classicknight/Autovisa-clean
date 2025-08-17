// suche.js (komplett)
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", async () => {
  // ===== DOM Refs =====
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");

  const toggleBtn = document.getElementById("toggleFiltersBtn");
  const sidebar   = document.querySelector(".filter-sidebar");

  const searchLink = document.querySelector('a[href="#search-section"]');
  const makeInput  = document.getElementById("make");
  const modelInput = document.getElementById("model");
  const titleInput = document.getElementById("title");

  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");

  // ===== Helpers =====
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

  // ===== Navbar: Hamburger & Dropdowns nur per Klick =====
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
      const txtClose = toggleBtn.getAttribute("data-close-text") || "Weitere Filter";
      toggleBtn.textContent = isOpen ? txtOpen : txtClose;
    });
  }

  // ===== Smooth Scroll (suche) =====
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
  savedCarsLink?.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndGo("gespeicherte-autos.html"); });
  myCarsLink?.addEventListener("click",    (e) => { e.preventDefault(); checkLoginAndGo("meine-autos.html"); });

  // ===== Medien-Slider =====
  function initMediaSlider(container) {
    if (!container) return;
    const slidesWrapper = container.querySelector(".slides");
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
      const width = container.clientWidth;
      state.currentTranslate = -state.currentIndex * width;
      state.prevTranslate = state.currentTranslate;
      setSliderPosition();
    }

    // Events
    ["pointerdown","touchstart","mousedown"].forEach(ev => slidesWrapper.addEventListener(ev, pointerDown));
    ["pointermove","touchmove","mousemove"].forEach(ev => slidesWrapper.addEventListener(ev, pointerMove));
    ["pointerup","pointerleave","pointercancel","touchend","mouseup","mouseleave"].forEach(ev => slidesWrapper.addEventListener(ev, pointerUp));

    container.querySelector(".media-arrow.right")?.addEventListener("click", () => {
      if (state.currentIndex < slides.length - 1) { state.currentIndex++; updateSlidePosition(); }
    });
    container.querySelector(".media-arrow.left")?.addEventListener("click", () => {
      if (state.currentIndex > 0) { state.currentIndex--; updateSlidePosition(); }
    });

    window.addEventListener("resize", updateSlidePosition);
    updateSlidePosition();
  }

  // Alle vorhandenen Slider initialisieren
  document.querySelectorAll(".media-container").forEach(initMediaSlider);

  // ===== Fahrzeuge laden (nur wenn #carResults existiert) =====
  const container = document.getElementById("carResults");
  if (container) {
    try {
      const res = await fetch("fahrzeuge-online.json", { credentials: "omit" });
      const daten = await res.json();
      const onlineInserate = (daten || []).filter(inserat => inserat.status === "online");

      if (!onlineInserate.length) {
        container.innerHTML = "<p>❌ Keine Fahrzeuge gefunden.</p>";
      } else {
        onlineInserate.forEach(inserat => {
          const card = document.createElement("div");
          card.className = "car-card horizontal";
          card.innerHTML = `
            <div class="car-card-media">
              <div class="card-actions mobile-only">
                <button class="save-btn" title="Auto speichern"><i class="fas fa-heart"></i></button>
                <a href="tel:${inserat.telefon || ""}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button">
                  <i class="fas fa-phone"></i>
                </a>
              </div>
              <div class="media-container">
                <div class="slides">
                  ${(inserat.images || []).map(img => `<img src="${img}" class="slide" alt="">`).join("")}
                  ${inserat.video ? `<video class="slide" controls muted preload="metadata"><source src="${inserat.video}" type="video/mp4"></video>` : ""}
                </div>
                <button class="media-arrow left"  type="button"><i class="fas fa-chevron-left"></i></button>
                <button class="media-arrow right" type="button"><i class="fas fa-chevron-right"></i></button>
              </div>
            </div>
            <div class="car-details">
              <div class="car-top-row">
                <h2 class="car-title">${inserat.titel || "Unbekanntes Fahrzeug"}</h2>
                <p class="car-price">${inserat.verkauf_brutto ? Number(inserat.verkauf_brutto).toLocaleString("de-DE") + " €" : "Preis n. a."}</p>
              </div>
              <p class="car-subtitle">${inserat.verkauf_kurzbeschreibung || ""}</p>
              <div class="car-info-grid">
                <p><i class="fas fa-road"></i> ${inserat.verkauf_kilometer || "?"} km</p>
                <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.verkauf_erstzulassung || "?"}</p>
                <p><i class="fas fa-gas-pump"></i> ${inserat.verkauf_kraftstoff || "?"}</p>
                <p><i class="fas fa-gauge-high"></i> ${inserat.verkauf_leistung || "?"} PS</p>
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
                  <a href="tel:${inserat.telefon || ""}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button">
                    <i class="fas fa-phone"></i>
                  </a>
                </div>
              </div>
            </div>
          `;
          container.appendChild(card);
          initMediaSlider(card.querySelector(".media-container"));
        });
      }
    } catch (err) {
      console.error("Fehler beim Laden der Fahrzeuge:", err);
      container.innerHTML = "<p>🚫 Fehler beim Laden der Inserate.</p>";
    }
  }
});
