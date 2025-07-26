document.addEventListener("DOMContentLoaded", async () => {
    // === Variablen ===
    const navLinks = document.getElementById("nav-links");
    const hamburger = document.getElementById("hamburger");
    const dropdownLinks = document.querySelectorAll(".dropdown > a");
    const toggleBtn = document.getElementById("toggleFiltersBtn");
    const sidebar = document.querySelector(".filter-sidebar");
    const searchLink = document.querySelector('a[href="#search-section"]');
    const makeInput = document.getElementById("make");
    const modelInput = document.getElementById("model");
    const titleInput = document.getElementById("title");
    const savedCarsLink = document.getElementById("saved-cars-link");
    const myCarsLink = document.getElementById("my-cars-link");
  
    const isLoggedIn = false; // später dynamisch setzen
  
    // === Hamburger Menü und Dropdowns ===
    hamburger?.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("active");
      closeAllDropdowns();
    });
  
    dropdownLinks.forEach(link => {
      const menu = link.nextElementSibling;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll(".dropdown-menu").forEach(otherMenu => {
          if (otherMenu !== menu) {
            otherMenu.classList.remove("show");
          }
        });
        menu.classList.toggle("show");
      });
    });
  
    document.addEventListener("click", () => {
      navLinks.classList.remove("active");
      closeAllDropdowns();
    });
  
    function closeAllDropdowns() {
      document.querySelectorAll(".dropdown-menu").forEach(menu => {
        menu.classList.remove("show");
      });
    }
  
    // === Filter-Sidebar (mobil) ===
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("visible");
        toggleBtn.innerHTML = sidebar.classList.contains("visible")
          ? '<i class="fas fa-sliders-h"></i> Filter ausblenden'
          : '<i class="fas fa-sliders-h"></i> Filter anzeigen';
      });
    }
  
    // === Login-Weiterleitungen ===
    savedCarsLink?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isLoggedIn ? "gespeicherte-autos.html" : "login.html";
    });
  
    myCarsLink?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isLoggedIn ? "meine-autos.html" : "login.html";
    });
  
    // === Smooth Scroll zu Suchbereich ===
    searchLink?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  
    // === Fahrzeugtitel automatisch setzen ===
    function updateTitle() {
      const make = makeInput?.value.trim();
      const model = modelInput?.value.trim();
      if (make || model) {
        titleInput.value = `${make} ${model}`.trim();
      }
    }
  
    makeInput?.addEventListener("input", updateTitle);
    modelInput?.addEventListener("input", updateTitle);
  
    // === Medien-Slider initialisieren ===
    document.querySelectorAll(".media-container").forEach(initMediaSlider);
  
    // === 🚗 Fahrzeuge laden (nur wenn auf suche.html) ===
    const container = document.getElementById("carResults");
    if (container) {
      try {
        const res = await fetch("fahrzeuge-online.json");

        const daten = await res.json();
        const onlineInserate = daten.filter(inserat => inserat.status === "online");
  
        if (onlineInserate.length === 0) {
          container.innerHTML = "<p>❌ Keine Fahrzeuge gefunden.</p>";
          return;
        }
  
        onlineInserate.forEach(inserat => {
          const card = document.createElement("div");
          card.className = "car-card horizontal";
          card.innerHTML = `
          <div class="car-card-media">
            <div class="card-actions mobile-only">
              <button class="save-btn" title="Auto speichern">
                <i class="fas fa-heart"></i>
              </button>
              <a href="tel:${inserat.telefon || ''}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button">
                <i class="fas fa-phone"></i>
              </a>
            </div>
            <div class="media-container">
              <div class="slides">
                ${inserat.images?.map(img => `<img src="${img}" class="slide">`).join("") || ""}
                ${inserat.video ? `<video class="slide" controls muted preload="metadata"><source src="${inserat.video}" type="video/mp4"></video>` : ""}
              </div>
              <button class="media-arrow left"><i class="fas fa-chevron-left"></i></button>
              <button class="media-arrow right"><i class="fas fa-chevron-right"></i></button>
            </div>
          </div>
          <div class="car-details">
            <div class="car-top-row">
              <h2 class="car-title">${inserat.titel || "Unbekanntes Fahrzeug"}</h2>
              <p class="car-price">${inserat.verkauf_brutto ? Number(inserat.verkauf_brutto).toLocaleString("de-DE") + " €" : "Preis n. a."}</p>
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
                ${inserat.verkauf_verkaeufer?.toLowerCase() === "händler"
                  ? `<strong>${inserat.verkauf_name || "Autohaus"}</strong><br>${inserat.standort || ""}`
                  : `Privatanbieter<br>${inserat.standort || ""}`
                }
              </div>
              <div class="card-actions desktop-only">
                <button class="save-btn" title="Auto speichern">
                  <i class="fas fa-heart"></i>
                </button>
                <a href="tel:${inserat.telefon || ''}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button">
                  <i class="fas fa-phone"></i>
                </a>
              </div>
            </div>
          </div>
        `;
        
  
          container.appendChild(card);
          initMediaSlider(card.querySelector(".media-container"));
        });
      } catch (err) {
        console.error("Fehler beim Laden der Fahrzeuge:", err);
        container.innerHTML = "<p>🚫 Fehler beim Laden der Inserate.</p>";
      }
    }
  });
  