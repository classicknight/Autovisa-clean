let mediaItems = [];
let currentIndex = 0;
let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isDragging = false;
let animationID;
let slider;
let container;

// 🔐 Navbar-Login/Logout dynamisch (Anzeige erfordert KEIN Login)
function setupAuthLink() {
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(r => r.json())
    .then(data => {
      const authLink = document.getElementById("auth-link");
      if (!authLink) return;

      if (data.eingeloggt) {
        authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
        document.getElementById("logout-link")?.addEventListener("click", (e) => {
          e.preventDefault();
          fetch("/logout", { method: "POST", credentials: "include" })
            .then(() => {
              localStorage.clear();
              window.location.href = "index.html";
            })
            .catch(() => alert("Abmelden fehlgeschlagen."));
        });
      } else {
        authLink.innerHTML = `<a href="login.html"><i class="fas fa-sign-in-alt"></i> Login / Registrierung</a>`;
      }
    })
    .catch(() => { /* still not fatal for view page */ });
}

window.addEventListener("load", () => {
  setupAuthLink();

  // Links "Gespeicherte Autos" / "Eigene Inserate" nur bei Login öffnen
  document.getElementById("saved-cars-link")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const s = await fetch("/getNutzerInfo", { credentials: "include" }).then(r => r.json());
      window.location.href = s.eingeloggt ? "gespeicherte-autos.html" : "login.html";
    } catch { window.location.href = "login.html"; }
  });
  document.getElementById("my-cars-link")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const s = await fetch("/getNutzerInfo", { credentials: "include" }).then(r => r.json());
      window.location.href = s.eingeloggt ? "meine-autos.html" : "login.html";
    } catch { window.location.href = "login.html"; }
  });

  // ── Inserat aus localStorage laden ─────────────────────────────
  const daten = localStorage.getItem("ausgewaehltesInserat");
  if (!daten) return;

  let inserat = {};
  try { inserat = JSON.parse(daten); } catch { inserat = {}; }

  // 🔹 Titel
  const titelAnzeige = document.getElementById("titelAnzeige");
  const carTitle = document.getElementById("car-title");
  if (inserat.titel) {
    if (titelAnzeige) titelAnzeige.textContent = inserat.titel;
    if (carTitle) carTitle.textContent = inserat.titel;
  }

  // 🔹 Preis(e)
  const priceMain = document.getElementById("price-main");
  const priceNet  = document.getElementById("price-net");
  const mwstType  = document.getElementById("mwst-type");
  const priceType = document.getElementById("price-type");

  const toPrice = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toLocaleString("de-DE")} €` : "–";
  };

  if (priceMain) {
    if (inserat.verkauf_brutto) priceMain.textContent = toPrice(inserat.verkauf_brutto);
    else if (inserat.verkauf_preis) priceMain.textContent = toPrice(inserat.verkauf_preis);
    else priceMain.textContent = "–";
  }
  if (priceNet && inserat.verkauf_netto) priceNet.textContent = toPrice(inserat.verkauf_netto);
  if (mwstType && inserat.verkauf_mwst) mwstType.textContent = inserat.verkauf_mwst;
  if (priceType) priceType.textContent = inserat.verkauf_mwst === "Keine MwSt." ? "Endpreis" : "Brutto";

  // 🔹 Medien vorbereiten
  mediaItems = [];
  if (Array.isArray(inserat.images)) {
    inserat.images.forEach(src => mediaItems.push({ type: "img", src }));
  }
  if (inserat.video && String(inserat.video).trim() !== "") {
    mediaItems.push({ type: "video", src: inserat.video });
  }

  // Slider initialisieren (nur wenn Container existieren)
  slider = document.getElementById("media-slider");
  container = document.getElementById("media-display");
  if (slider && container) {
    initSlider();
    setMedia(0);
    setupSlider();
  }

  // 🔹 Top-Infos
  const ezEl         = document.getElementById("info-ez");
  const kmEl         = document.getElementById("info-km");
  const psEl         = document.getElementById("info-ps");
  const kraftstoffEl = document.getElementById("info-kraftstoff");
  const getriebeEl   = document.getElementById("info-getriebe");
  const sellerTypeEl = document.getElementById("seller-type");

  if (inserat.verkauf_erstzulassung && ezEl) ezEl.textContent = inserat.verkauf_erstzulassung;
  if (inserat.verkauf_kilometer && kmEl) kmEl.textContent = `${Number(inserat.verkauf_kilometer).toLocaleString("de-DE")} km`;
  if (inserat.verkauf_leistung && psEl) psEl.textContent = `${inserat.verkauf_leistung} PS`;
  if (inserat.verkauf_kraftstoff && kraftstoffEl) kraftstoffEl.textContent = inserat.verkauf_kraftstoff;
  if (inserat.verkauf_getriebe && getriebeEl) getriebeEl.textContent = inserat.verkauf_getriebe;
  if (inserat.verkauf_verkaeufer && sellerTypeEl) sellerTypeEl.textContent = inserat.verkauf_verkaeufer;

  // 🔹 Technische Daten
  const technischeDatenMapping = {
    "v-zustand": "zustand",
    "v-fahrzeugart": "fahrzeugart",
    "v-halter": "halter",
    "v-fahrtauglich": "fahrtauglich",
    "v-beschaedigt": "beschaedigt",
    "v-unfall": "unfall",
    "v-tueren": "verkauf_tueren",
    "v-fahrzeugtyp": "verkauf_fahrzeugtyp",
    "v-hubraum": "verkauf_hubraum",
    "v-verbrauch-kombiniert": "verkauf_verbrauch_kombiniert",
    "v-verbrauch-innerorts": "verkauf_verbrauch_innerorts",
    "v-verbrauch-ausserorts": "verkauf_verbrauch_ausserorts",
    "v-antrieb": "verkauf_antrieb",
    "v-co2": "verkauf_co2_emission",
    "v-schadstoffklasse": "verkauf_schadstoffklasse",
    "v-umweltplakette": "verkauf_umweltplakette",
    "v-partikelfilter": "verkauf_partikelfilter",
    "v-hu": "", // separat
    "v-klimatisierung": "klimatisierung",
    "v-einparkhilfe": "", // separat
    "v-airbags": "airbags",
    "v-innenausstattung": "innenmaterial"
  };

  for (const [spanId, jsonKey] of Object.entries(technischeDatenMapping)) {
    const el = document.getElementById(spanId);
    if (!el) continue;
    if (jsonKey && inserat[jsonKey]) el.textContent = inserat[jsonKey];
  }

  // HU (Monat/Jahr)
  const huEl = document.getElementById("v-hu");
  if (huEl && (inserat.tuevMonat || inserat.tuevJahr)) {
    const m = inserat.tuevMonat || "";
    const j = inserat.tuevJahr || "";
    huEl.textContent = `${m} ${j}`.trim() || "–";
  }

  // Einparkhilfe – zusammenbauen
  const einparkhilfeEl = document.getElementById("v-einparkhilfe");
  if (einparkhilfeEl) {
    const hilfen = [];
    if (inserat.einparkhilfeVorne) hilfen.push("vorn");
    if (inserat.einparkhilfeHinten) hilfen.push("hinten");
    if (inserat.einparkhilfeSelbstlenkend) hilfen.push("selbstlenkend");
    if (inserat.kameraHinten) hilfen.push("Kamera hinten");
    if (inserat.kamera360) hilfen.push("360° Kamera");
    einparkhilfeEl.textContent = hilfen.length ? hilfen.join(", ") : "–";
  }

  // 🔹 Ausstattungsliste
  const ausstattungContainer = document.getElementById("v-ausstattung");
  const ausstattungBlock = document.getElementById("ausstattung-block");
  if (ausstattungContainer) {
    const ausstattungLabels = {
      abstandsregeltempomat: "Abstandsregeltempomat",
      applecarplay: "Apple CarPlay",
      androidauto: "Android Auto",
      frontscheibenheizung: "Frontscheibenheizung",
      heckklappe: "Elektrische Heckklappe",
      led: "LED-Scheinwerfer",
      multifunktion: "Multifunktionslenkrad",
      navigation: "Navigationssystem",
      sitzheizung: "Sitzheizung",
      rueckfahrkamera: "Rückfahrkamera",
      nichtraucher: "Nichtraucherfahrzeug",
      scheckheft: "Scheckheftgepflegt",
      garantie: "Garantie / Werksgarantie",
      mettalic: "Metallic-Lackierung",
      abs: "ABS",
      esp: "ESP",
      asr: "ASR (Traktionskontrolle)",
      berganfahrassistent: "Berganfahrassistent",
      muedigkeitswarner: "Müdigkeitswarner",
      spurhalteassistent: "Spurhalteassistent",
      totwinkelassistent: "Totwinkelassistent",
      notbremsassistent: "Notbremsassistent",
      notrufsystem: "Notrufsystem",
      verkehrszeichenerkennung: "Verkehrszeichenerkennung",
      isofixhinten: "Isofix (hinten)",
      isofixbeifahrer: "Isofix Beifahrersitz",
      scheinwerferreinigung: "Scheinwerferreinigung",
      blendfreiesfernlicht: "Blendfreies Fernlicht",
      fernlichtassistent: "Fernlichtassistent",
      innenspiegelabblendend: "Innenspiegel automatisch abblendend",
      nachtsichtassistent: "Nachtsichtassistent",
      nebelscheinwerfer: "Nebelscheinwerfer",
      lichtsensor: "Lichtsensor",
      regensensor: "Regensensor",
      alarmanlage: "Alarmanlage",
      wegfahrsperre: "Elektrische Wegfahrsperre",
      keylesszv: "Schlüssellose Zentralverriegelung",
      zentralverriegelung: "Zentralverriegelung",
      standheizung: "Standheizung",
      frontscheibebeheizbar: "Beheizbare Frontscheibe",
      lenkradbeheizbar: "Beheizbares Lenkrad",
      einparkhilfeselbstlenkend: "Selbstlenkende Einparkhilfe",
      kamerahinten: "Rückfahrkamera",
      kamera360: "360°-Kamera",
      sitzheizungvorne: "Sitzheizung vorne",
      sitzheizunghinten: "Sitzheizung hinten",
      sitzeelektrisch: "Elektrische Sitzeinstellung",
      sportsitze: "Sportsitze",
      armlehne: "Armlehne",
      lordosenstuetze: "Lordosenstütze",
      massagesitze: "Massagesitze",
      sitzbelueftung: "Sitzbelüftung",
      beifahrersitzumklappbar: "Umklappbarer Beifahrersitz",
      elektrfensterheber: "Elektrische Fensterheber",
      elektrspiegel: "Elektrische Seitenspiegel",
      elektheckklappe: "Elektrische Heckklappe",
      servolenkung: "Servolenkung",
      ambientebeleuchtung: "Ambientebeleuchtung",
      lederlenkrad: "Lederlenkrad",
      radio: "Radio",
      dab: "DAB-Radio",
      cd: "CD-Spieler",
      tv: "TV-Empfang",
      navi: "Navigationssystem",
      soundsystem: "Soundsystem",
      touchscreen: "Touchscreen",
      sprachsteuerung: "Sprachsteuerung",
      freisprecheinrichtung: "Freisprecheinrichtung",
      usb: "USB-Anschluss",
      bluetooth: "Bluetooth",
      wlan: "WLAN / Wifi Hotspot",
      streaming: "Musikstreaming integriert",
      induktionsladen: "Induktionsladen für Smartphones",
      bordcomputer: "Bordcomputer",
      headup: "Head-up Display",
      volldigital: "Volldigitales Kombiinstrument",
      alufelgen: "Leichtmetallfelgen",
      sommerreifen: "Sommerreifen",
      winterreifen: "Winterreifen",
      allwetterreifen: "Allwetterreifen",
      reifendruckkontrolle: "Reifendruckkontrollsystem",
      winterpaket: "Winterpaket",
      raucherpaket: "Raucherpaket",
      sportpaket: "Sportpaket",
      sportfahrwerk: "Sportfahrwerk",
      luftfederung: "Luftfederung",
      gepaeckabtrennung: "Gepäckraumabtrennung",
      skisack: "Skisack",
      schiebedach: "Schiebedach",
      panoramadach: "Panorama-Dach",
      dachreling: "Dachreling",
      behindertengerecht: "Behindertengerecht",
      taxi: "Taxi"
    };

    let hatAusstattung = false;
    for (const key in ausstattungLabels) {
      const datenwert = inserat["verkauf_" + key] ?? inserat[key];
      const gespeichert = localStorage.getItem("details_" + key);
      const checked = gespeichert === "true" || datenwert === true || datenwert === "true";
      if (checked) {
        const div = document.createElement("div");
        div.classList.add("equipment-item");
        div.innerHTML = `<i class="fas fa-check"></i> ${ausstattungLabels[key]}`;
        ausstattungContainer.appendChild(div);
        hatAusstattung = true;
      }
    }
    if (hatAusstattung && ausstattungBlock) ausstattungBlock.style.display = "block";
  }

  // 🔹 Beschreibung
  const beschreibungEl = document.getElementById("car-description");
  const toggleBtn = document.getElementById("toggle-description-btn");
  if (inserat.fahrzeugbeschreibung && beschreibungEl) {
    beschreibungEl.textContent = inserat.fahrzeugbeschreibung;
  }
  toggleBtn?.addEventListener("click", () => {
    if (!beschreibungEl) return;
    beschreibungEl.classList.toggle("expanded");
    toggleBtn.textContent = beschreibungEl.classList.contains("expanded")
      ? "Weniger anzeigen" : "Mehr anzeigen";
  });
});


  
  function initSlider() {
    document.documentElement.style.setProperty('--media-count', mediaItems.length);
    
    slider = document.getElementById("media-slider");
    container = document.getElementById("media-display");
    slider.innerHTML = "";
    
    mediaItems.forEach(item => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("media-slide-wrapper");
    
    const el = document.createElement(item.type === "img" ? "img" : "video");
    el.src = item.src;
    el.classList.add("media-slide");
    el.draggable = false;
    
    if (item.type === "video") {
      el.controls = true;
      el.playsInline = true;
      el.preload = "metadata";
    } else {
      // Warten bis das Bild geladen ist, dann prüfen ob Hochformat
      el.addEventListener("load", () => {
        if (el.naturalHeight > el.naturalWidth) {
          el.classList.add("portrait");
        }
      });
    }
    
      // Beim Klick auf das Bild soll es sich ebenfalls öffnen
    el.addEventListener("click", () => openFullscreen(el));
    
    const btn = document.createElement("div");
    btn.classList.add("fullscreen-btn");
    btn.innerHTML = `<i class="fas fa-expand"></i>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // verhindert Doppelauslösung
      openFullscreen(el);
    });
    
    wrapper.appendChild(el);
    wrapper.appendChild(btn);
    slider.appendChild(wrapper);
  });
    
    setTimeout(() => {
      updateSlider(false); // kein automatisches Pause/Reset
    }, 100);
}



function setupSlider() {
    container.addEventListener("pointerdown", dragStart, { passive: false });
    container.addEventListener("pointermove", dragMove, { passive: false });
    container.addEventListener("pointerup", dragEnd);
    container.addEventListener("pointerleave", dragEnd);
    container.addEventListener("pointercancel", dragEnd);
  
    container.addEventListener("dblclick", () => nextMedia());
  }
  
    function dragStart(e) {
      isDragging = true;
      slider.classList.add("dragging");
      startX = e.clientX;
      animationID = requestAnimationFrame(animation);
      slider.style.transition = "none";
    }
    
    function dragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const currentX = e.clientX;
        currentTranslate = prevTranslate + currentX - startX;
      }
  

  
  function dragEnd() {
    cancelAnimationFrame(animationID);
    isDragging = false;
    slider.classList.remove("dragging");
  
    const slideWidth = container.offsetWidth;
    const movedBy = currentTranslate - prevTranslate;
  
    if (movedBy < -50 && currentIndex < mediaItems.length - 1) {
      currentIndex++;
    } else if (movedBy > 50 && currentIndex > 0) {
      currentIndex--;
    }
  
    updateSlider();
  }
  
  function animation() {
    setSliderPosition();
    if (isDragging) requestAnimationFrame(animation);
  }
  
  function setSliderPosition() {
    slider.style.transform = `translateX(${currentTranslate}px)`;
  }
  
  function updateSlider(pauseVideos = true) {
    const slideWidth = container.offsetWidth;
    const targetTranslate = -currentIndex * slideWidth;
    
  
    
    slider.style.transition = "transform 0.5s ease";
    slider.style.transform = `translateX(${targetTranslate}px)`;
    
    currentTranslate = targetTranslate;
    prevTranslate = targetTranslate;
    
    updateActiveThumb();
  }
  
  function setMedia(index) {
    currentIndex = index;
    updateSlider();
  }
  
  function prevMedia() {
    if (currentIndex > 0) {
      currentIndex--;
      updateSlider();
    }
  }
  
  function nextMedia() {
    if (currentIndex < mediaItems.length - 1) {
      currentIndex++;
      updateSlider();
    }
  }
  
  function updateActiveThumb() {
    const thumbs = document.querySelectorAll(".media-thumb");
    const track = document.querySelector(".media-detail-thumbnails-scroll");
  
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle("active-thumb", i === currentIndex);
      if (i === currentIndex && track) {
        // Nur horizontal scrollen
        const scrollLeft = thumb.offsetLeft - track.clientWidth / 2 + thumb.clientWidth / 2;
        track.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    });
  }
  
  
  // ---------------------- UI Interaktionen ----------------------
  
  function toggleContactPanel() {
    const panel = document.getElementById("contactPanel");
    const button = document.querySelector(".contact-btn");
    panel.classList.toggle("open");
    button.classList.toggle("active");
  }
  
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("contactPanel");
    const btn = document.querySelector(".contact-btn");
    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.remove("open");
      btn.classList.remove("active");
    }
  });
  
  function toggleSave(button) {
    button.classList.toggle('saved');
    const icon = button.querySelector('i');
    icon.classList.add('bounce');
    setTimeout(() => icon.classList.remove('bounce'), 300);
  
    icon.classList.toggle('far', !button.classList.contains('saved'));
    icon.classList.toggle('fas', button.classList.contains('saved'));
  }
  
  function showPhoneNumber() {
    const phoneContainer = document.getElementById("phoneNumber");
    const btn = document.getElementById("showPhoneBtn");
  
    const inserat = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}");
  
    if (inserat.telefon) {
      phoneContainer.textContent = inserat.telefon;
      phoneContainer.style.display = "block";
      btn.style.display = "none";
    } else {
      phoneContainer.textContent = "Keine Nummer vorhanden";
      phoneContainer.style.display = "block";
      btn.style.display = "none";
    }
  }
  
  
  // ---------------------- Beschreibung erweitern ----------------------
  
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("toggle-description-btn");
    const description = document.getElementById("car-description");
  
    if (btn && description) {
      btn.addEventListener("click", () => {
        description.classList.toggle("expanded");
        btn.textContent = description.classList.contains("expanded")
          ? "Weniger anzeigen"
          : "Mehr anzeigen";
      });
    }
  
    setupNavbar();
  });
  
  // ---------------------- Bewertungssystem ----------------------
  
  function toggleRatingPanel() {
    const panel = document.getElementById("ratingPanel");
    panel.classList.toggle("open");
  }
  
  const stars = document.querySelectorAll("#starRating i");
  let selectedRating = 0;
  
  stars.forEach(star => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.getAttribute("data-value"));
      updateStarDisplay();
    });
  });
  
  function updateStarDisplay() {
    stars.forEach(star => {
      const value = parseInt(star.getAttribute("data-value"));
      star.classList.toggle("active", value <= selectedRating);
    });
  }
  
  function submitRating() {
    const text = document.getElementById("ratingText").value.trim();
    if (selectedRating === 0 || text === "") {
      alert("Bitte gib eine Bewertung mit Kommentar ab.");
      return;
    }
  
    console.log("Bewertung gesendet:", selectedRating + " Sterne, Kommentar: " + text);
    alert("Vielen Dank für deine Bewertung!");
    toggleRatingPanel();
    document.getElementById("ratingText").value = "";
    selectedRating = 0;
    updateStarDisplay();
  }
  // ---------------------- Navbar Interaktion ----------------------
function setupNavbar() {
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");

  // --- Helpers ---
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

    const tRect  = trigger.getBoundingClientRect();
    const mRect  = menu.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const vw     = window.innerWidth;

    // Menü unter dem Trigger zentrieren, am Viewport clampen (16px Rand)
    const center  = tRect.left + tRect.width / 2;
    let leftAbs   = center - mRect.width / 2;
    leftAbs       = clamp(leftAbs, 16, vw - mRect.width - 16);
    const relLeft = leftAbs - liRect.left;

    menu.style.left = `${relLeft}px`;
  }

  function openDropdown(trigger) {
    const li   = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    if (!li || !menu) return;

    closeAllDropdowns(li);

    li.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.classList.add("show");

    // Stagger-Animation
    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    // Nur Desktop zentrieren (mobil = position: static)
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }

  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    if (!li) return;
    li.classList.contains("open") ? closeAllDropdowns() : openDropdown(trigger);
  }

  // --- Hamburger ---
  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !navLinks.classList.contains("active");
    navLinks.classList.toggle("active");
    closeAllDropdowns();
    hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  // --- Dropdowns nur per Klick (KEIN Hover) ---
  dropdownLinks.forEach(link => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });

  // --- Outside Click schließt (nur wenn außerhalb der Navbar geklickt wird) ---
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar")) {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // --- ESC schließt ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // --- Reposition bei Resize/Scroll (Desktop) ---
  const repositionOpen = () =>
    document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);
}

  
    // 🔒 Login/Logout + geschützte Links
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        const authLink = document.getElementById("auth-link");
        if (authLink) {
          if (data.eingeloggt) {
            authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
            document.getElementById("logout-link")?.addEventListener("click", (e) => {
              e.preventDefault();
              fetch("/logout", { method: "POST", credentials: "include" })
                .then(() => {
                  localStorage.clear();
                  window.location.href = "index.html";
                });
            });
          } else {
            authLink.innerHTML = `<a href="login.html"><i class="fas fa-sign-in-alt"></i> Login / Registrierung</a>`;
          }
        }
  
        // jetzt mit echtem Status weiterleiten
        document.getElementById("saved-cars-link")?.addEventListener("click", (e) => {
          e.preventDefault();
          window.location.href = data.eingeloggt ? "gespeicherte-autos.html" : "login.html";
        });
        document.getElementById("my-cars-link")?.addEventListener("click", (e) => {
          e.preventDefault();
          window.location.href = data.eingeloggt ? "meine-autos.html" : "login.html";
        });
      })
      .catch(err => {
        console.warn("⚠️ Konnte Nutzerstatus nicht abrufen:", err);
      });
  
    // Smooth scroll (optional)
    document.querySelector('a[href="#search-section"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  
  
  
  // ---------------------- Lightbox mit Swipe ----------------------
  
  let currentLightboxIndex = 0;
  let lightboxStartX = 0;
  let lightboxIsDragging = false;
  
  function openFullscreen(media) {
    if (!media || !(media.tagName === "IMG" || media.tagName === "VIDEO")) return;
    
    const allSlides = document.querySelectorAll(".media-slide");
    currentLightboxIndex = Array.from(allSlides).findIndex(el => el.src === media.src);
    
    const overlay = document.getElementById("lightbox-overlay");
    overlay.classList.add("show");
    
    renderLightboxMedia(media);
    updateLightboxCounter();
  }
  
  function renderLightboxMedia(media) {
    const container = document.getElementById("lightbox-content");
    container.innerHTML = "";
    
    const el = document.createElement(media.tagName.toLowerCase());
    el.src = media.src;
    el.className = "lightbox-inner-media";
    
    if (media.tagName === "VIDEO") {
      el.controls = true;
      el.autoplay = true;
      el.playsInline = true;
    }
    
    container.appendChild(el);
  }
  
  function navigateLightbox(direction) {
    const allSlides = document.querySelectorAll(".media-slide");
    currentLightboxIndex = Math.max(0, Math.min(currentLightboxIndex + direction, allSlides.length - 1));
    const nextMedia = allSlides[currentLightboxIndex];
    renderLightboxMedia(nextMedia);
    updateLightboxCounter();
  }
  function closeLightbox() {
    const overlay = document.getElementById("lightbox-overlay");
    overlay.classList.remove("show");
    document.getElementById("lightbox-content").innerHTML = "";
  }
  
  // ---------------------- Drag-Swipe in der Lightbox ----------------------
  
  function lightboxDragStart(e) {
    if (e.pointerType !== "touch" && e.pointerType !== "mouse") return;
    lightboxIsDragging = true;
    lightboxStartX = e.clientX;
    document.getElementById("lightbox-overlay").classList.add("dragging");
  }
  
  function lightboxDragMove(e) {
    if (!lightboxIsDragging) return;
    e.preventDefault();
    const deltaX = e.clientX - lightboxStartX;
    const media = document.querySelector("#lightbox-content .lightbox-inner-media");
  if (media) {
    media.style.transform = `translateX(${deltaX}px)`;
  }
    
    if (Math.abs(deltaX) > 50) {
      lightboxIsDragging = false;
      document.getElementById("lightbox-overlay").classList.remove("dragging");
      if (deltaX > 0) {
        navigateLightbox(-1);
      } else {
        navigateLightbox(1);
      }
    }
  }
  
  function lightboxDragEnd(e) {
    if (!lightboxIsDragging) return;
    lightboxIsDragging = false;
    document.getElementById("lightbox-overlay").classList.remove("dragging");
    
    const deltaX = e.clientX - lightboxStartX;
    
    if (Math.abs(deltaX) > 80) {
      // Nur bei echtem Swipe wechseln
      if (deltaX > 0) {
        navigateLightbox(-1);
      } else {
        navigateLightbox(1);
      }
    } else {
      // Bild leicht zurücksnappen
      const media = document.querySelector("#lightbox-content .lightbox-inner-media");
      media.style.transition = "transform 0.3s ease";
      media.style.transform = "translateX(0)";
      setTimeout(() => {
        media.style.transition = "";
      }, 300);
    }
  }
  
  function setupLightboxSwipe() {
    const overlay = document.getElementById("lightbox-overlay");
    const content = document.getElementById("lightbox-content");
    
    // Events auf Overlay UND Content registrieren
    [overlay, content].forEach(el => {
      el.addEventListener("pointerdown", lightboxDragStart);
      el.addEventListener("pointermove", lightboxDragMove);
      el.addEventListener("pointerup", lightboxDragEnd);
      el.addEventListener("pointercancel", lightboxDragEnd);
      el.addEventListener("pointerleave", lightboxDragEnd);
    });
  }
  
  // ---------------------- Tastatursteuerung ----------------------
  
  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("lightbox-overlay");
    if (overlay.classList.contains("show")) {
      if (e.key === "ArrowRight") navigateLightbox(1);
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      if (e.key === "Escape") closeLightbox();
    } else {
      if (e.key === "ArrowRight") nextMedia?.();
      if (e.key === "ArrowLeft") prevMedia?.();
    }
  });
  
  // ---------------------- Tap für Vollbild ----------------------
  
  let lastTap = 0;
  
  function handleTapFullscreen(e) {
    const now = Date.now();
    const delta = now - lastTap;
    lastTap = now;
    
    if (delta < 300 && delta > 0) {
      const media = e.target.closest(".lightbox-inner-media") || document.querySelector("#lightbox-content .lightbox-inner-media");
      if (media) {
        const request = media.requestFullscreen || media.webkitRequestFullscreen;
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          exit?.call(document);
        } else if (request) {
          request.call(media).catch(err => {
            console.error("Fullscreen konnte nicht aktiviert werden:", err);
          });
        }
      }
    }
  }
  
  // ---------------------- Initialisierung ----------------------
  
  document.addEventListener("DOMContentLoaded", () => {
    setupLightboxSwipe();
  
    const lightboxArea = document.getElementById("lightbox-content");
    if (lightboxArea) {
      lightboxArea.addEventListener("pointerdown", handleTapFullscreen);
    }
  
    const fullscreenBtn = document.getElementById("lightbox-fullscreen-btn");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => {
        const media = document.querySelector("#lightbox-content .lightbox-inner-media");
        if (media) {
          const request = media.requestFullscreen || media.webkitRequestFullscreen;
          if (request) {
            request.call(media).catch(err => {
              console.error("Fullscreen konnte nicht aktiviert werden:", err);
            });
          }
        }
      });
    }
  
    // 🔽 Medien-Rendering aus localStorage
    const data = localStorage.getItem("ausgewaehltesInserat");
    if (!data) return;
  
    const inserat = JSON.parse(data);
    const slider = document.getElementById("media-slider");
    const thumbnails = document.getElementById("thumbnail-track");
  
    if (!slider || !thumbnails) return;
  
    slider.innerHTML = "";
    thumbnails.innerHTML = "";
  
    const files = [];
  
    if (Array.isArray(inserat.images)) {
      inserat.images.forEach((src, i) => {
        files.push({ type: "image", src });
      });
    }
  
    if (inserat.video && inserat.video.trim() !== "") {
      files.push({ type: "video", src: inserat.video });
    }
  
    files.forEach((file, index) => {
      if (file.type === "image") {
        slider.innerHTML += `
          <div class="media-slide-wrapper">
            <img src="${file.src}" class="media-slide" alt="Bild ${index + 1}">
            <div class="fullscreen-btn" onclick="openFullscreen(this)">
              <i class="fas fa-expand"></i>
            </div>
          </div>`;
        thumbnails.innerHTML += `
          <img src="${file.src}" class="media-thumb" onclick="setMedia(${index})" alt="Thumb ${index + 1}">`;
      } else {
        slider.innerHTML += `
          <div class="media-slide-wrapper">
            <video src="${file.src}" class="media-slide" muted playsinline controls></video>
            <div class="fullscreen-btn" onclick="openFullscreen(this)">
              <i class="fas fa-expand"></i>
            </div>
          </div>`;
        thumbnails.innerHTML += `
          <video class="media-thumb" onclick="setMedia(${index})">
            <source src="${file.src}" type="video/mp4">
          </video>`;
      }
    });
  
    // Start mit erstem Medium
    setMedia(0);
  });
  
  
  
  function updateLightboxCounter() {
    const counter = document.getElementById("lightbox-counter");
    if (counter) {
      counter.textContent = `Bild ${currentLightboxIndex + 1} von ${mediaItems.length}`;
    }
  }
  
  
  
  
  
  
  
  
  
  
  
  // Beschreibung auf/zu
const descBtn = document.getElementById('toggle-description-btn');
if (descBtn) {
  descBtn.addEventListener('click', function () {
    const box = document.querySelector('.car-description-box');
    if (!box) return;
    box.classList.toggle('expanded');
    this.textContent = this.textContent.includes('Mehr') ? 'Weniger anzeigen' : 'Mehr anzeigen';
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("messageForm");
  if (!form) return; // auf Seiten ohne Formular einfach nix machen

  // 🚗 Fahrzeug aus LocalStorage holen (id oder _id zulassen)
  let fahrzeug = {};
  try {
    fahrzeug = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}");
  } catch {}
  const fahrzeugId = fahrzeug.id || fahrzeug._id;
  if (!fahrzeugId) {
    alert("❌ Kein Fahrzeug ausgewählt.");
    window.location.href = "übersicht.html";
    return;
  }

  // 📩 Formular absenden
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nachricht = this.querySelector("textarea[name='nachricht']")?.value.trim();
    if (!nachricht) return;

    // Absender aus LocalStorage (wird beim Login gesetzt)
    const senderId = localStorage.getItem("userId");
    const absenderName = localStorage.getItem("username");

    if (!senderId || !absenderName) {
      alert("Bitte logge dich ein, um eine Nachricht zu senden.");
      // Optional: redirect: window.location.href = "login.html";
      return;
    }

    const payload = {
      senderId,
      empfaengerId: fahrzeug.verkaeuferId || fahrzeug.nutzerId || "", // Fallbacks
      fahrzeugId: fahrzeugId,
      absenderName,
      nachricht
    };

    try {
      const res = await fetch("/nachricht-senden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",                // <- falls Server später Login voraussetzt
        body: JSON.stringify(payload),
      });

      // Serverantwort lesen (auch bei Fehlern)
      const result = await res.json().catch(() => ({}));

      if (res.ok && result.success) {
        alert("Nachricht wurde erfolgreich gesendet.");
        this.reset();
      } else {
        const msg = result.error || `Fehler ${res.status}`;
        alert("Fehler beim Senden: " + msg);
      }
    } catch (err) {
      console.error("Fehler beim Senden:", err);
      alert("Serverfehler. Bitte später versuchen.");
    }
  });
});

// Panels togglen
function toggleRatingPanel() {
  const panel = document.getElementById("ratingPanel");
  panel?.classList.toggle("show");
}

function toggleContactPanel() {
  const panel = document.getElementById("contactPanel");
  const overlay = document.getElementById("contactOverlay");
  panel?.classList.toggle("open");
  overlay?.classList.toggle("show");
}

// Telefonnummer anzeigen
function showPhoneNumber() {
  const phoneContainer = document.getElementById("phoneNumber");
  const btn = document.getElementById("showPhoneBtn");
  if (!phoneContainer || !btn) return;

  let inserat = {};
  try {
    inserat = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}");
  } catch {}

  if (inserat.telefon) {
    phoneContainer.textContent = inserat.telefon;
  } else {
    phoneContainer.textContent = "Keine Nummer vorhanden";
  }
  phoneContainer.style.display = "block";
  btn.style.display = "none";
}











// anzeige.js — Anbieterkarte inkl. Telefon, Website, Adresse, Öffnungszeiten, Sprachen + weitere Fahrzeuge

// ---------- Utils ----------
const $id = (x) => document.getElementById(x);
const setText = (id, v) => { const el = $id(id); if (el) el.textContent = v ?? "—"; };
const toNum = (v) => (v==null||v==="") ? NaN : Number(String(v).replace(/[\u202F\u00A0\s€]/g,"").replace(/\./g,"").replace(",","."));
const fmtEUR = (v) => { const n = toNum(v); return Number.isFinite(n) ? n.toLocaleString("de-DE")+" €" : "Preis n. a."; };
const sanitizePhone = (p) => String(p||"").replace(/[^\d+]/g,"");
const ensureHttp = (u) => !u ? "" : (/^https?:\/\//i.test(u) ? u : "https://" + String(u).trim());
const pickPrice = (...vals) => { for (const v of vals){ const n = toNum(v); if (Number.isFinite(n) && n>0) return n; } return NaN; };
function getDocId(doc){ if(!doc) return null; if(doc._id && typeof doc._id==="object" && typeof doc._id.$oid==="string") return doc._id.$oid; if(typeof doc._id==="string") return doc._id; if(typeof doc.id==="string") return doc.id; return null; }

// Daten für anzeige.html aufbereiten (wenn von „Weitere Fahrzeuge“ aus geklickt)
function toAnzeigePayload(item){
  const raw = item?.raw && typeof item.raw==="object" ? item.raw : {};
  const merged = { ...raw, ...item };
  if (merged.verkauf_kilometer==null && item.kilometer!=null) merged.verkauf_kilometer=item.kilometer;
  if (!merged.verkauf_erstzulassung && item.erstzulassung) merged.verkauf_erstzulassung=item.erstzulassung;
  if (!merged.verkauf_kraftstoff && item.kraftstoff) merged.verkauf_kraftstoff=item.kraftstoff;
  if (!merged.verkauf_getriebe && item.getriebe) merged.verkauf_getriebe=item.getriebe;
  if (!merged.verkauf_leistung && item.leistung) merged.verkauf_leistung=item.leistung;
  if (merged.verkauf_verbrauch_kombiniert==null && item.verbrauch_kombiniert!=null) merged.verkauf_verbrauch_kombiniert=item.verbrauch_kombiniert;

  // Preise robuster
  if (merged.verkauf_brutto==null && (merged.brutto_preis!=null)) merged.verkauf_brutto=merged.brutto_preis;
  if (merged.verkauf_brutto==null && (merged["brutto-preis"]!=null)) merged.verkauf_brutto=merged["brutto-preis"];
  if (merged.verkauf_preis==null && (item.preis!=null)) merged.verkauf_preis=item.preis;

  if (!merged.telefon && item.telefon) merged.telefon=item.telefon;
  if (!merged.verkauf_verkaeufer && item.verkauf_verkaeufer) merged.verkauf_verkaeufer=item.verkauf_verkaeufer;
  if (!merged.verkauf_name && item.verkauf_name) merged.verkauf_name=item.verkauf_name;

  return merged;
}

// Logo robust laden (Safari/cache-safe)
function loadLogo(imgEl, avatarEl, url){
  avatarEl?.classList?.remove("has-logo");
  imgEl?.removeAttribute?.("src");
  if(!url || !imgEl || !avatarEl) return;
  try { imgEl.loading = "eager"; } catch {}
  imgEl.addEventListener("load", () => { if (imgEl.naturalWidth>0) avatarEl.classList.add("has-logo"); }, { once:true });
  imgEl.addEventListener("error", () => { avatarEl.classList.remove("has-logo"); imgEl.removeAttribute("src"); }, { once:true });
  imgEl.src = url;
  if (imgEl.complete && imgEl.naturalWidth>0) avatarEl.classList.add("has-logo");
}

// Händlerprofil (aus haendlerformular.html gespeicherte Felder)
async function fetchSellerProfile(sellerId){
  try{
    if(!sellerId) return null;
    const res = await fetch(`/api/seller?id=${encodeURIComponent(sellerId)}`, { credentials:"include" });
    if(!res.ok) return null;
    return await res.json();
  }catch{ return null; }
}

// Weitere Fahrzeuge laden
async function fetchSellerCars(sellerId, limit=6){
  try{
    if(!sellerId) return { total:0, results:[] };
    const params = new URLSearchParams({ verkaeufer: sellerId, limit: String(limit), page: "1", sort: "neueste" });
    const res = await fetch(`/api/search?${params.toString()}`, { credentials:"omit" });
    if(!res.ok) return { total:0, results:[] };
    const data = await res.json();
    const list = data?.results ?? data?.items ?? [];
    return { total: data?.total||list.length||0, results: Array.isArray(list) ? list : [] };
  }catch{ return { total:0, results:[] }; }
}

// ===== Medien-Slider (wie auf Startseite) =====
function initMediaSlider(mediaContainer) {
  if (!mediaContainer) return;
  const slidesWrapper = mediaContainer.querySelector(".slides");
  if (!slidesWrapper) return;

  const slides = Array.from(slidesWrapper.children);
  const state = { currentIndex:0, isDragging:false, startPos:0, currentTranslate:0, prevTranslate:0, animationID:null };

  slidesWrapper.style.display = "flex";
  slidesWrapper.style.transition = "transform 0.3s ease";
  slidesWrapper.style.willChange = "transform";
  slides.forEach(slide => { slide.style.flex = "0 0 100%"; slide.style.minWidth = "100%"; });

  const getX = (ev) => (typeof ev.clientX === "number" ? ev.clientX : (ev.touches && ev.touches[0]?.clientX) || 0);
  const setSliderPosition = () => { slidesWrapper.style.transform = `translateX(${state.currentTranslate}px)`; };
  const animation = () => { setSliderPosition(); if (state.isDragging) requestAnimationFrame(animation); };

  const pointerDown = (ev) => { state.isDragging=true; state.startPos=getX(ev); state.animationID=requestAnimationFrame(animation); };
  const pointerMove = (ev) => { if (!state.isDragging) return; const x=getX(ev); state.currentTranslate = state.prevTranslate + x - state.startPos; };
  const pointerUp   = () => {
    if (!state.isDragging) return;
    state.isDragging=false; cancelAnimationFrame(state.animationID);
    const movedBy = state.currentTranslate - state.prevTranslate;
    if (movedBy < -50 && state.currentIndex < slides.length-1) state.currentIndex++;
    else if (movedBy > 50 && state.currentIndex > 0)          state.currentIndex--;
    updateSlidePosition();
  };
  const updateSlidePosition = () => {
    const width = mediaContainer.clientWidth || 1;
    state.currentTranslate = -state.currentIndex * width;
    state.prevTranslate = state.currentTranslate;
    setSliderPosition();
  };

  ["pointerdown","touchstart","mousedown"].forEach(ev=>slidesWrapper.addEventListener(ev, pointerDown));
  ["pointermove","touchmove","mousemove"].forEach(ev=>slidesWrapper.addEventListener(ev, pointerMove));
  ["pointerup","pointerleave","pointercancel","touchend","mouseup","mouseleave"].forEach(ev=>slidesWrapper.addEventListener(ev, pointerUp));

  mediaContainer.querySelector(".media-arrow.right")?.addEventListener("click", (e)=>{ e.stopPropagation(); if (state.currentIndex < slides.length-1){ state.currentIndex++; updateSlidePosition(); }});
  mediaContainer.querySelector(".media-arrow.left") ?.addEventListener("click", (e)=>{ e.stopPropagation(); if (state.currentIndex > 0){               state.currentIndex--; updateSlidePosition(); }});

  window.addEventListener("resize", updateSlidePosition);
  updateSlidePosition();
}

// ---- „Weitere Fahrzeuge“ (identisches Kartenlayout wie index.html) ----
function renderSellerMore(items){
  const sec  = document.getElementById("sellerMore");
  const grid = document.getElementById("sellerMoreGrid");
  if(!sec || !grid) return;

  grid.innerHTML = "";
  if(!items.length){ sec.style.display = "none"; return; }

  items.forEach(item=>{
    const imgs   = Array.isArray(item.images) ? item.images : Array.isArray(item.fotos) ? item.fotos : [];
    const titel  = item.titel || [item.marke, item.modell].filter(Boolean).join(" ").trim() || "Fahrzeug";
    const preisN = pickPrice(item["brutto-preis"], item.brutto_preis, item.verkauf_brutto, item.preis, item.verkauf_preis, item.verkauf_netto);
    const preis  = fmtEUR(preisN);

    // gewünschte Felder
    const kmV   = item.verkauf_kilometer ?? item.kilometer ?? item.km;
    const ezV   = item.verkauf_erstzulassung || item.erstzulassung;
    const fuelV = item.verkauf_kraftstoff || item.kraftstoff;
    const psV   = item.verkauf_leistung ?? item.leistung; // PS
    const gearV = item.verkauf_getriebe || item.getriebe;
    const conV  = item.verkauf_verbrauch_kombiniert || item.verbrauch_kombiniert || item.verbrauch;

    const kmTxt = kmV != null && kmV !== "" ? `${Number(toNum(kmV)).toLocaleString("de-DE")} km` : "—";
    const ezTxt = ezV || "—";
    const fuTxt = fuelV || "—";
    const psTxt = psV != null && psV !== "" ? `${Number(toNum(psV)).toLocaleString("de-DE")} PS` : "—";
    const geTxt = gearV || "—";
    const coTxt = conV != null && conV !== "" ? `${String(conV).replace(",",".")} l/100 km` : "—";

    const id = getDocId(item);

    const card = document.createElement("div");
    card.className = "car-card";
    card.innerHTML = `
      <div class="car-card-media">
        <div class="media-container">
          <div class="slides">
            ${imgs.map(src => `<img src="${src}" class="slide" alt="">`).join("")}
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

        <div class="car-info-grid">
          <p><i class="fas fa-road"></i> ${kmTxt}</p>
          <p><i class="fas fa-calendar-alt"></i> EZ ${ezTxt}</p>
          <p><i class="fas fa-gas-pump"></i> ${fuTxt}</p>
          <p><i class="fas fa-gauge-high"></i> ${psTxt}</p>
          <p><i class="fas fa-gears"></i> ${geTxt}</p>
          <p><i class="fas fa-tint"></i> ${coTxt}</p>
        </div>
      </div>
    `;

    // Klick zur Detailseite (Pfeile sollen nicht durchklicken)
    card.addEventListener("click", (e)=>{
      if (e.target.closest(".media-arrow")) return;
      try{ localStorage.setItem("ausgewaehltesInserat", JSON.stringify(toAnzeigePayload(item))); }catch{}
      if (id) window.location.href = `anzeige.html?id=${encodeURIComponent(id)}`;
      else     window.location.href = `anzeige.html`;
    });

    grid.appendChild(card);
    initMediaSlider(card.querySelector(".media-container"));
  });

  sec.style.display = "";
}

// Zusätzlichen Info-Block unter den Buttons anlegen
function ensureExtraInfoBlock(){
  let wrap = document.getElementById("sellerInfoExtra");
  if (wrap) return wrap;

  wrap = document.createElement("div");
  wrap.id = "sellerInfoExtra";
  wrap.style.marginTop = "12px";
  wrap.innerHTML = `
    <ul class="kv" id="sellerKV" style="list-style:none;display:flex;flex-direction:column;gap:8px;">
      <li id="rowPhone" style="display:none;justify-content:space-between;gap:10px;">
        <span><i class="fas fa-phone"></i> Telefon</span><strong id="sellerPhoneText"></strong>
      </li>
      <li id="rowMail" style="display:none;justify-content:space-between;gap:10px;">
        <span><i class="fas fa-envelope"></i> E-Mail</span><strong id="sellerMailText"></strong>
      </li>
      <li id="rowWeb" style="display:none;justify-content:space-between;gap:10px;">
        <span><i class="fas fa-globe"></i> Website</span><strong><a id="sellerWebsiteText" target="_blank" rel="noopener"></a></strong>
      </li>
      <li id="rowLang" style="display:none;justify-content:space-between;gap:10px;">
        <span><i class="fas fa-language"></i> Wir sprechen</span><strong id="sellerLanguages"></strong>
      </li>
    </ul>
    <div id="hoursWrap" style="display:none;margin-top:10px;">
      <div class="box-title" style="font-weight:700;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-clock" style="color:#00bfa6;"></i> Öffnungszeiten
      </div>
      <ul class="hours" id="hoursList" style="list-style:none;display:flex;flex-direction:column;gap:8px;"></ul>
    </div>
  `;
  const contact = $id("sellerCard")?.querySelector(".seller-contact");
  (contact?.parentElement || $id("sellerCard"))?.appendChild(wrap);
  return wrap;
}

// Öffnungszeiten-Liste befüllen
function renderHours(hours){
  const wrap = $id("hoursWrap");
  const list = $id("hoursList");
  if (!wrap || !list) return;

  if (!hours || typeof hours !== "object"){ wrap.style.display="none"; return; }

  const order = ["montag","dienstag","mittwoch","donnerstag","freitag","samstag","sonntag"];
  const mapDe = { montag:"Mo", dienstag:"Di", mittwoch:"Mi", donnerstag:"Do", freitag:"Fr", samstag:"Sa", sonntag:"So" };
  const todayIdx = (new Date().getDay() + 6) % 7; // Mo=0 … So=6

  list.innerHTML = "";
  order.forEach((key, i)=>{
    const val = hours[key];
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.gap = "10px";
    if (i===todayIdx){ li.style.fontWeight = "700"; li.style.color = "#0b5e56"; }
    li.innerHTML = `<span>${mapDe[key]||key}</span><span>${val || "—"}</span>`;
    list.appendChild(li);
  });
  wrap.style.display = "";
}

// ---------- Haupt-Render ----------
async function renderSeller(){
  const box = $id("sellerCard");
  if(!box) return;

  let inserat = {};
  try{ inserat = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}"); }catch{}

  const rawType  = String(inserat?.seller?.type || inserat?.verkauf_verkaeufer || "").toLowerCase();
  const isDealer = rawType.includes("händ") || rawType.includes("haend") || rawType==="haendler" || rawType==="händler" || inserat?.seller?.role==="haendler";
  let sellerId   = inserat?.verkaeuferId || inserat?.seller?.id || inserat?.sellerId || "";

  const profile  = await fetchSellerProfile(sellerId);
  if(!sellerId && profile && (profile._id || profile.id)) sellerId = getDocId(profile) || profile.id;

  const name = (profile?.firma || profile?.name || inserat?.seller?.name || inserat?.verkauf_name || (isDealer ? "Händler" : "Privatanbieter")).trim();
  const initials = name.split(/\s+/).slice(0,2).map(p => p[0]?.toUpperCase()||"").join("") || "AV";
  setText("sellerName", name);
  setText("sellerInitials", initials);
  setText("sellerType", isDealer ? "Händler" : "Privatanbieter");

  const fullAddress = (() => {
    const s = (t) => (t==null ? "" : String(t).trim());
    if (isDealer) {
      const parts = [
        [s(profile?.strasse), s(profile?.hausnummer)].filter(Boolean).join(" "),
        [s(profile?.plz), s(profile?.ort)].filter(Boolean).join(" "),
        s(profile?.land)
      ].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
    return inserat?.standort || [inserat?.plz, inserat?.ort].filter(Boolean).join(" ") || "Standort nicht angegeben";
  })();
  setText("sellerAddress", fullAddress);

  const avatar = box.querySelector(".dealer-avatar");
  const logoUrl = profile?.logoUrl || inserat?.seller?.logoUrl || inserat?.logoUrl || "";
  loadLogo($id("sellerLogo"), avatar, logoUrl);

  const rating = Number(profile?.rating ?? inserat?.seller?.rating ?? inserat?.rating ?? 0);
  const rCnt   = Number(profile?.reviews ?? inserat?.seller?.reviews ?? inserat?.reviews ?? 0);
  const w = Math.max(0, Math.min(5, rating))/5*100;
  $id("starsFill").style.width = w + "%";
  setText("ratingValue", rating ? rating.toFixed(1) : "–");
  $id("ratingCount").textContent = rCnt ? `(${rCnt})` : "";

  const phone = profile?.telefon || inserat?.telefon || inserat?.seller?.phone || "";
  const mail  = profile?.email   || inserat?.seller?.email || inserat?.email || "";
  const web   = ensureHttp(profile?.website || profile?.web || inserat?.seller?.website || inserat?.website || "");
  const telFmt= sanitizePhone(phone);

  const callBtn = $id("callBtn");
  if (telFmt) { callBtn.href = `tel:${telFmt}`; callBtn.classList.remove("ghost"); }
  else        { callBtn.removeAttribute("href"); callBtn.classList.add("ghost"); }

  const mailBtn = $id("mailBtn");
  if (mail) { mailBtn.href = `mailto:${mail}`; mailBtn.classList.remove("ghost"); }
  else      { mailBtn.removeAttribute("href"); mailBtn.classList.add("ghost"); }

  const msgBtn = $id("msgBtn");
  if (msgBtn){
    msgBtn.onclick = () => {
      document.getElementById("contactPanel")?.classList.add("open");
      document.querySelector("#messageForm textarea")?.focus();
    };
  }

  // Zusatzinfos unter Buttons
  ensureExtraInfoBlock();
  if (phone){ setText("sellerPhoneText", phone); $id("rowPhone").style.display="flex"; }
  if (mail){  setText("sellerMailText", mail);   $id("rowMail").style.display="flex"; }
  if (web){
    const a = $id("sellerWebsiteText");
    if (a){ a.href = web; a.textContent = web.replace(/^https?:\/\//i,""); }
    $id("rowWeb").style.display="flex";
  }

  const langs = (() => {
    const l = profile?.sprachen || profile?.languages || inserat?.seller?.languages || inserat?.sprachen || [];
    return Array.isArray(l) ? l : (typeof l === "string" ? l.split(",").map(s=>s.trim()).filter(Boolean) : []);
  })();
  if (langs.length){
    setText("sellerLanguages", langs.join(", "));
    $id("rowLang").style.display="flex";
  }

  const hours = profile?.oeffnungszeiten || profile?.hours || inserat?.seller?.hours || inserat?.oeffnungszeiten || null;
  renderHours(hours);

  // Weitere Fahrzeuge (unten, im Index-Look)
  const moreSec = $id("sellerMore");
  if (isDealer && (sellerId || profile?._id || profile?.id) && moreSec){
    const finalId = sellerId || getDocId(profile) || profile?.id || "";
    const { results } = await fetchSellerCars(finalId, 6);
    const currentId = getDocId(inserat);
    const filtered  = results.filter(r => getDocId(r) !== currentId);
    renderSellerMore(filtered.slice(0,6));
  } else {
    if (moreSec) moreSec.style.display = "none";
  }
}

// ---------- Einfaches Rating-Panel ----------
(function setupRatingPanel(){
  let panel = document.getElementById("ratingPanel");
  if (!panel){
    panel = document.createElement("div");
    panel.id = "ratingPanel";
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="rating-panel" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);z-index:10000;">
        <div style="background:#fff;border-radius:12px;min-width:300px;max-width:90vw;padding:16px 16px 12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <strong>Händler bewerten</strong>
            <button id="closeRatingBtn" style="background:none;border:none;font-size:22px;line-height:1;cursor:pointer;">×</button>
          </div>
          <div id="starRating" style="display:flex;gap:6px;margin:6px 0 10px;"></div>
          <textarea id="ratingText" rows="4" style="width:100%;padding:8px;border-radius:8px;border:1px solid #e3e9ef;" placeholder="Deine Bewertung…"></textarea>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button id="submitRatingBtn" class="btn-primary" style="padding:8px 12px;border-radius:10px;border:none;background:linear-gradient(90deg,#00ffcc,#00bfa6);color:#002a2b;font-weight:800;cursor:pointer;">Absenden</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(panel);

    const wrap = panel.querySelector("#starRating");
    for (let i=1;i<=5;i++){
      const b = document.createElement("button");
      b.type="button";
      b.dataset.value=String(i);
      b.style.cssText="width:34px;height:34px;border:none;border-radius:8px;background:#f3f7f8;cursor:pointer;display:flex;align-items:center;justify-content:center;";
      b.innerHTML = `<i class="fas fa-star"></i>`;
      wrap.appendChild(b);
    }
  }

  let chosen = 0;
  panel.querySelector("#starRating")?.addEventListener("click",(e)=>{
    const btn = e.target.closest("button[data-value]");
    if(!btn) return;
    chosen = Number(btn.dataset.value||0);
    [...panel.querySelectorAll("#starRating button")].forEach((b,i)=>{
      b.style.background = i < chosen ? "#e9fdfb" : "#f3f7f8";
      b.querySelector("i").style.color = i < chosen ? "#00bfa6" : "#888";
    });
  });

  document.getElementById("btnRate")?.addEventListener("click", ()=>{ panel.style.display="block"; chosen=0; [...panel.querySelectorAll("#starRating button i")].forEach(i=>i.style.color="#888"); });
  panel.querySelector("#closeRatingBtn")?.addEventListener("click", ()=>{ panel.style.display="none"; });

  panel.querySelector("#submitRatingBtn")?.addEventListener("click", async ()=>{
    const text = (panel.querySelector("#ratingText").value||"").trim();
    let inserat = {};
    try{ inserat = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}"); }catch{}
    const sellerId = inserat?.verkaeuferId || inserat?.seller?.id || inserat?.sellerId || "";
    if (!sellerId){ alert("Kein Händler zugeordnet."); return; }
    if (!chosen){ alert("Bitte Sterne auswählen."); return; }

    try{
      const res = await fetch("/api/seller/rate",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        credentials:"include",
        body: JSON.stringify({ sellerId, rating: chosen, text })
      });
      if (res.status===401){ alert("Bitte einloggen, um zu bewerten."); return; }
      if (!res.ok) throw new Error();
      panel.style.display="none";
      alert("Danke für deine Bewertung!");
      renderSeller(); // Rating auffrischen
    }catch{
      alert("Bewertung konnte nicht gespeichert werden.");
    }
  });
})();

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", renderSeller);
