document.addEventListener("DOMContentLoaded", () => {



    function initMediaSlider(container) {
  const slidesWrapper = container.querySelector(".slides");
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
  
  slides.forEach(slide => {
    slide.style.flex = "0 0 100%";
    slide.style.minWidth = "100%";
  });
  
  function setSliderPosition() {
    slidesWrapper.style.transform = `translateX(${state.currentTranslate}px)`;
  }
  
  function animation() {
    setSliderPosition();
    if (state.isDragging) requestAnimationFrame(animation);
  }
  
  function pointerDown(event) {
    state.isDragging = true;
    state.startPos = event.clientX;
    state.animationID = requestAnimationFrame(animation);
  }
  
  function pointerMove(event) {
    if (state.isDragging) {
      const currentPosition = event.clientX;
      state.currentTranslate = state.prevTranslate + currentPosition - state.startPos;
    }
  }
  
  function pointerUp() {
    state.isDragging = false;
    cancelAnimationFrame(state.animationID);
    const movedBy = state.currentTranslate - state.prevTranslate;
    const containerWidth = container.clientWidth;
    
    if (movedBy < -50 && state.currentIndex < slides.length - 1) {
      state.currentIndex++;
    } else if (movedBy > 50 && state.currentIndex > 0) {
      state.currentIndex--;
    }
    
    updateSlidePosition();
  }
  
  function updateSlidePosition() {
    const containerWidth = container.clientWidth;
    state.currentTranslate = -state.currentIndex * containerWidth;
    state.prevTranslate = state.currentTranslate;
    setSliderPosition();
  }
  
  // Pointer Events
  slidesWrapper.addEventListener("pointerdown", pointerDown);
  slidesWrapper.addEventListener("pointermove", pointerMove);
  slidesWrapper.addEventListener("pointerup", pointerUp);
  slidesWrapper.addEventListener("pointerleave", (e) => { if (state.isDragging) pointerUp(e); });
  slidesWrapper.addEventListener("pointercancel", pointerUp);
  
  slides.forEach(slide => {
    slide.addEventListener("pointerdown", pointerDown);
    slide.addEventListener("pointermove", pointerMove);
    slide.addEventListener("pointerup", pointerUp);
    slide.addEventListener("pointerleave", (e) => { if (state.isDragging) pointerUp(e); });
    slide.addEventListener("pointercancel", pointerUp);
  });
  
    container.querySelector(".media-arrow.right")?.addEventListener("click", () => {
    if (state.currentIndex < slides.length - 1) {
      state.currentIndex++;
      updateSlidePosition();
    }
  });
  
  container.querySelector(".media-arrow.left")?.addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      updateSlidePosition();
    }
  });
  
  window.addEventListener("resize", updateSlidePosition);
  updateSlidePosition();
  }
  
  // **Hier den Aufruf einfügen – sonst wird der Slider nie aktiviert!**
  document.querySelectorAll(".media-container").forEach(initMediaSlider);
  });

  /** 🔹 Fahrzeug löschen */
  document.querySelectorAll(".delete-btn").forEach(button => {
    button.addEventListener("click", function() {
      const carCard = this.closest(".car-card");
      if (confirm("Möchtest du dieses Inserat wirklich löschen?")) {
        carCard.remove();
      }
    });
  });

  /** 🔹 Sidebar Navigation (Sektionen umschalten) */
  const sidebarLinks = document.querySelectorAll(".sidebar-link");
const title = document.querySelector(".title");
const sections = {
    "car-list": document.querySelector(".car-list"),
    "messages-list": document.querySelector("#messages-list"),
    "saved-cars": document.querySelector("#saved-cars"),
    "sold-cars": document.querySelector("#sold-cars")
  };

  function showSection(sectionName) {
    Object.values(sections).forEach(section => {
      if (section) {
        section.classList.add("hidden");
        section.classList.remove("visible");
      }
    });

    if (sections[sectionName]) {
      sections[sectionName].classList.remove("hidden");
      sections[sectionName].classList.add("visible");
    }
  }

  const chatButton = `<a href="chat-uebersicht.html" class="all-chats-btn" style="margin-left: auto;">
  <i class="fas fa-envelope-open-text"></i> Alle Chats anzeigen
</a>`;

sidebarLinks.forEach(link => {
  link.addEventListener("click", () => {
    const selectedSection = link.dataset.section;
    
    // Aktiven Link markieren
    sidebarLinks.forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    
    // Sichtbare Sektion wechseln
    showSection(selectedSection);
    
    // Überschrift setzen (und bei Nachrichten zusätzlich Button einfügen)
    switch (selectedSection) {
      case "car-list":
        title.innerHTML = '<i class="fas fa-car"></i> Meine Autos';
        break;
      case "messages-list":
        title.innerHTML = '<i class="fas fa-comments"></i> Nachrichten' + chatButton;
        break;
      case "saved-cars":
        title.innerHTML = '<i class="fas fa-heart"></i> Gespeicherte Autos';
        break;
      case "sold-cars":
        title.innerHTML = '<i class="fas fa-check-circle"></i> Verkaufte Autos';
        break;
      default:
        title.innerHTML = '<i class="fas fa-car"></i> Meine Autos';
    }
  });
});

  /** 🔹 Kommentar-Funktionen */
  document.querySelectorAll(".delete-comment-btn").forEach(button => {
    button.addEventListener("click", function() {
      if (confirm("Möchtest du diesen Kommentar wirklich löschen?")) {
        this.closest(".comment-card").remove();
      }
    });
  });

  document.querySelectorAll(".reply-btn").forEach(button => {
    button.addEventListener("click", function() {
      alert("Antwortfunktion wird demnächst verfügbar sein.");
    });
  });

// Beim Laden: „Meine Autos“ anzeigen und Titel setzen
showSection("car-list");
title.innerHTML = '<i class="fas fa-car"></i> Meine Autos';

  /** 🔹 Gespeicherte Autos umschalten */
  document.querySelectorAll(".toggle-saved-car").forEach(button => {
    button.addEventListener("click", function() {
      const carCard = this.closest(".saved-car-card");
      this.classList.toggle("removed");

      if (this.classList.contains("removed")) {
        setTimeout(() => {
          carCard.remove();
        }, 300);
      }
    });
  });




document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.getElementById('nav-links');
  const hamburger = document.getElementById('hamburger');
  const dropdownLinks = document.querySelectorAll('.dropdown > a');

  // Hamburger-Menü ein-/ausblenden
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation(); // Verhindert Konflikte bei Klicks außerhalb
    navLinks.classList.toggle('active');
  });

  // Schließen des Menüs bei Klick außerhalb
  document.addEventListener('click', () => {
    navLinks.classList.remove('active');
    closeAllDropdowns();
  });

  // Dropdown-Logik
  dropdownLinks.forEach((link) => {
    const menu = link.nextElementSibling;

    link.addEventListener('click', (e) => {
      e.preventDefault(); // Verhindert den Standard-Link-Klick
      e.stopPropagation();

      const isMobile = window.matchMedia('(max-width: 768px)').matches;

      if (isMobile) {
        // Handy-Modus: Einfach ein-/ausblenden
        closeAllDropdowns(); // Schließt andere Dropdowns
        menu.classList.toggle('show'); // Sichtbarkeit umschalten
      } else {
        // Desktop-/Tablet: Standardverhalten
        closeAllDropdowns(); // Schließt andere Dropdowns
        menu.classList.toggle('show'); // Sichtbarkeit umschalten
      }
    });
  });

  // Funktion zum Schließen aller Dropdowns
  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
      menu.classList.remove('show'); // Entfernt die "show"-Klasse
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Simulierte Login-Status (ersetze das später durch eine echte Authentifizierungsprüfung)
  const isLoggedIn = false; // Ändere auf `true`, wenn der Benutzer eingeloggt ist

  // Links zu Gespeicherten Autos und Meinen Autos
  const savedCarsLink = document.getElementById('saved-cars-link');
  const myCarsLink = document.getElementById('my-cars-link');

  // Event-Listener für Gespeicherte Autos
  savedCarsLink.addEventListener('click', (e) => {
    e.preventDefault(); // Verhindert Standardaktion
    if (!isLoggedIn) {
      window.location.href = 'login.html'; // Weiterleitung zur Login-Seite
    } else {
      window.location.href = 'gespeicherte-autos.html'; // Weiterleitung zur richtigen Seite
    }
  });

  // Event-Listener für Meine Autos
  myCarsLink.addEventListener('click', (e) => {
    e.preventDefault(); // Verhindert Standardaktion
    if (!isLoggedIn) {
      window.location.href = 'login.html'; // Weiterleitung zur Login-Seite
    } else {
      window.location.href = 'meine-autos.html'; // Weiterleitung zur richtigen Seite
    }
  });
});

document.querySelector('a[href="#search-section"]').addEventListener('click', function(e) {
  e.preventDefault(); // Standardverhalten verhindern
  document.querySelector('#search-section').scrollIntoView({ behavior: 'smooth' });
});


document.addEventListener("DOMContentLoaded", () => {
  const makeInput = document.getElementById("make");
  const modelInput = document.getElementById("model");
  const titleInput = document.getElementById("title");

  function updateTitle() {
    const make = makeInput.value.trim();
    const model = modelInput.value.trim();
    if (make || model) {
      titleInput.value = `${make} ${model}`.trim();
    }
  }

  makeInput.addEventListener("input", updateTitle);
  modelInput.addEventListener("input", updateTitle);

  // Hamburger Menü
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");

  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
});





document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");

  // Hamburger-Menü ein-/ausblenden
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
});


document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");

  // Hamburger-Menü ein-/ausblenden
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
});



  
  
  
document.querySelectorAll('.slide img, .slide video').forEach(media => {
    if (media.tagName === "VIDEO") {
      media.addEventListener("loadedmetadata", () => {
        if (media.videoHeight > media.videoWidth) {
          media.classList.add("portrait-zoom");
        }
      });
    } else {
      media.addEventListener("load", () => {
        if (media.naturalHeight > media.naturalWidth) {
          media.classList.add("portrait-zoom");
        }
      });
    }
  });
  





document.querySelectorAll('.remove-saved-btn').forEach(button => {
  button.addEventListener('click', function() {
    const wrapper = this.closest('.car-card-wrapper');
    if (confirm("Möchtest du dieses Fahrzeug wirklich entfernen?")) {
      wrapper.remove();
    }
  });
});













document.addEventListener("DOMContentLoaded", async () => {

  // 🔹 Hilfsfunktion zum sicheren Formatieren von Preisen
  function formatEUR(value) {
    if (value == null || value === "") return null;
    const num = parseFloat(String(value).replace(/\./g, "").replace(",", "."));
    if (!isNaN(num)) return num.toLocaleString("de-DE") + " €";
    return String(value) + " €";
  }

  const carlist = document.querySelector(".car-list");
  try {
    const nutzerRes = await fetch("/getNutzerInfo", { credentials: "include" });
    const nutzerData = await nutzerRes.json();

    if (!nutzerData.eingeloggt || !nutzerData.nutzerId) {
      alert("❌ Du bist nicht eingeloggt. Bitte logge dich zuerst ein.");
      window.location.href = "login.html";
      return;
    }

    const userId = nutzerData.nutzerId;

    const res = await fetch("/meineInserate.json");
    const alleInserate = await res.json();

    // ✅ Zeige nur die Inserate, die zu diesem User gehören
    const inserate = alleInserate.filter(i => i.verkaeuferId === userId);

    if (!Array.isArray(inserate) || inserate.length === 0) {
      document.querySelector(".car-list").innerHTML = "<p>Keine Inserate gefunden.</p>";
      return;
    }

    const carList = document.querySelector(".car-list");
    carList.innerHTML = "";

    inserate.forEach((inserat, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "car-card-wrapper";
      wrapper.dataset.id = inserat.id || `inserat-${index}`;

      wrapper.innerHTML = `
        <div class="car-card-actions mobile-only">
          <button class="publish-btn"><i class="fas fa-globe"></i> Veröffentlichen</button>
          <button class="edit-btn"><i class="fas fa-pen"></i> Bearbeiten</button>
          <button class="remove-saved-btn"><i class="fas fa-trash"></i> Entfernen</button>
        </div>

        <div class="car-card horizontal">
          <div class="car-card-media">
            <div class="media-container">
              <div class="slides">
                ${generateSlides(inserat)}
              </div>
              <button class="media-arrow left"><i class="fas fa-chevron-left"></i></button>
              <button class="media-arrow right"><i class="fas fa-chevron-right"></i></button>
            </div>
          </div>

          <div class="car-details">
            <div class="car-top-row">
              <h2 class="car-title">${inserat.titel || "Titel fehlt"}</h2>
              <p class="car-price">${
                formatEUR(inserat.verkauf_brutto) ||
                formatEUR(inserat.verkauf_preis) ||
                formatEUR(inserat.preis) ||
                "Preis fehlt"
              }</p>
            </div>
            <p class="car-subtitle">${inserat.verkauf_kurzbeschreibung || "Besondere Ausstattung"}</p>

            <div class="car-info-grid">
              <p><i class="fas fa-road"></i> ${inserat.verkauf_kilometer || "—"} km</p>
              <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.verkauf_erstzulassung || "—"}</p>
              <p><i class="fas fa-gas-pump"></i> ${inserat.verkauf_kraftstoff || "—"}</p>
              <p><i class="fas fa-gauge-high"></i> ${inserat.verkauf_leistung || "—"} PS</p>
              <p><i class="fas fa-gears"></i> ${inserat.verkauf_getriebe || "—"}</p>
              <p><i class="fas fa-tint"></i> ${inserat.verkauf_verbrauch_kombiniert || "—"} l/100 km</p>
            </div>
            <div class="dealer-info">
              ${
                inserat.verkauf_verkaeufer?.toLowerCase() === "händler"
                  ? `<div><strong>${inserat.verkauf_name || "Unbekannt"}</strong></div>`
                  : `<div><span class="seller-label">Privatanbieter</span></div>`
              }
              <div class="seller-location">${inserat.standort || "Standort nicht angegeben"}</div>
            </div>
          </div>
        </div>

        <div class="car-card-actions desktop-only">
          <button class="publish-btn"><i class="fas fa-globe"></i> Veröffentlichen</button>
          <button class="edit-btn"><i class="fas fa-pen"></i> Bearbeiten</button>
          <button class="remove-saved-btn"><i class="fas fa-trash"></i> Entfernen</button>
        </div>
      `;



  

        // 📦 Klick auf Fahrzeugkarte → Inserat speichern + Weiterleitung
wrapper.addEventListener("click", (e) => {
    const isActionButton = e.target.closest(".car-card-actions button");
    if (!isActionButton) {
      localStorage.setItem("ausgewaehltesInserat", JSON.stringify(inserat));
      window.location.href = "anzeige.html";
    }
  });
  
        carList.appendChild(wrapper);
// Slides & Pfeile initialisieren
initializeSlider(wrapper);



  
        // ✅ Hochformat-Erkennung pro Wrapper
        wrapper.querySelectorAll(".slide").forEach(media => {
          if (media.tagName === "VIDEO") {
            media.addEventListener("loadedmetadata", () => {
              if (media.videoHeight > media.videoWidth) {
                media.classList.add("portrait-zoom");
              }
            });
          } else if (media.tagName === "IMG") {
            media.addEventListener("load", () => {
              if (media.naturalHeight > media.naturalWidth) {
                media.classList.add("portrait-zoom");
              }
            });
          }
        });
  
        // 🗑️ Entfernen-Button aktivieren
        wrapper.querySelectorAll(".remove-saved-btn").forEach(button => {
          button.addEventListener("click", () => {
            if (confirm("Möchtest du dieses Fahrzeug wirklich entfernen?")) {
              wrapper.remove();
            }
          });
        });
      });
    } catch (error) {
      console.error("Fehler beim Laden der Inserate:", error);
    }
  });
  
  // 🔁 Slides erstellen (Bilder + Video)
  function generateSlides(inserat) {
    const slides = [];
  
    if (Array.isArray(inserat.images)) {
      inserat.images.forEach(bild => {
        slides.push(`<img src="${bild}" alt="Bild" class="slide">`);
      });
    }
  
    if (inserat.video && inserat.video.trim() !== "") {
      slides.push(`
        <video class="slide" controls muted playsinline preload="metadata">
          <source src="${inserat.video}" type="video/mp4">
        </video>
      `);
    }
  
    return slides.join("");
  }
  



  function initializeSlider(wrapper) {
    const slidesContainer = wrapper.querySelector(".slides");
    const slides = wrapper.querySelectorAll(".slide");
    const leftArrow = wrapper.querySelector(".media-arrow.left");
    const rightArrow = wrapper.querySelector(".media-arrow.right");
  
    if (!slidesContainer || slides.length === 0) return;
  
    let currentIndex = 0;
  
    function updateSlide() {
      const offset = -currentIndex * 100;
      slidesContainer.style.transform = `translateX(${offset}%)`;
    }
  
    leftArrow?.addEventListener("click", () => {
      if (currentIndex > 0) {
        currentIndex--;
        updateSlide();
      }
    });
  
    rightArrow?.addEventListener("click", () => {
      if (currentIndex < slides.length - 1) {
        currentIndex++;
        updateSlide();
      }
    });
  
    // Initialer Zustand
    updateSlide();
  }
  









  document.addEventListener("click", async (e) => {
    const button = e.target.closest(".publish-btn");
    if (!button) return;
  
    const card = button.closest(".car-card-wrapper");
    const inseratId = card?.dataset.id;
    const verkaeuferId = localStorage.getItem("nutzerId");
  
    if (!inseratId || !verkaeuferId) {
      alert("❌ Inserat-ID oder Verkäufer-ID fehlt.");
      return;
    }
  
    try {
      const res = await fetch("/inserat-veroeffentlichen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inseratId, verkaeuferId })
      });
  
      const text = await res.text();
  
      if (res.ok) {
        alert("✅ Inserat ist jetzt online!");
        // ✅ Button visuell anpassen
        button.textContent = "Veröffentlicht";
        button.classList.add("published");
        button.disabled = true;
      } else {
        alert("❌ Fehler: " + text);
      }
    } catch (err) {
      console.error("Netzwerkfehler:", err);
      alert("❌ Netzwerkfehler beim Veröffentlichen.");
    }
  });
  