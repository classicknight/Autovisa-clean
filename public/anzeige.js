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
















/* =========================================================================
   Verkäuferkarte (SellerCard) – Autovisa-Style
   Erwartet in anzeige.html ein <section id="seller-card" class="seller-card"></section>
   ========================================================================= */
   const SellerCard = (() => {
    // --- kleine Helpers ---
    const $ = (sel, root = document) => root.querySelector(sel);
    const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
    const norm = (s) => String(s || "").toLowerCase();
    const sanitizePhone = (v) => String(v || "").replace(/[^\d+]/g, "");
    const initials = (name = "") =>
      (name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("") || "AV");
  
    const starHTML = (avg = 0) => {
      const r = Math.max(0, Math.min(5, Number(avg) || 0));
      const full = Math.floor(r);
      const half = (r - full) >= 0.25 && (r - full) <= 0.75 ? 1 : 0;
      const moreFull = (r - full) > 0.75 ? 1 : 0;
      const empty = 5 - full - half - moreFull;
      return `${'<i class="fas fa-star"></i>'.repeat(full + moreFull)}${half ? '<i class="fas fa-star-half-alt"></i>' : ''}${'<i class="far fa-star"></i>'.repeat(empty)}`;
    };
  
    const kv = (k, v) => v ? `<div class="kv-key">${k}</div><div class="kv-val">${v}</div>` : "";
  
    const hoursList = (opening) => {
      if (!opening || typeof opening !== "object") return "";
      const order = ["mo","di","mi","do","fr","sa","so"];
      const label = { mo:"Mo", di:"Di", mi:"Mi", do:"Do", fr:"Fr", sa:"Sa", so:"So" };
      return `
        <ul class="seller-hours">
          ${order.map(key => opening[key] ? `<li><span>${label[key]}</span><span>${opening[key]}</span></li>` : "").join("")}
        </ul>
      `;
    };
  
    function render(inserat = {}) {
      const root = document.getElementById("seller-card");
      if (!root) return;
  
      // — robuste Grunddaten
      const rawType   = norm(inserat?.seller?.type || inserat?.verkauf_verkaeufer);
      const isDealer  = rawType === "haendler" || rawType === "händler" || rawType.includes("händ") || rawType.includes("haend");
      const name      = inserat?.seller?.name || inserat?.verkauf_name || (isDealer ? "Händler" : "Privatanbieter");
      const logo      = inserat?.seller?.logoUrl || inserat?.seller?.logo || inserat?.logoUrl || "";
      const sellerId  = inserat?.verkaeuferId || inserat?.nutzerId || inserat?.sellerId || "";
      const standort  = inserat?.standort || [inserat?.plz, inserat?.ort].filter(Boolean).join(" ") || "";
      const tel       = sanitizePhone(inserat?.telefon);
      const mwst      = inserat?.verkauf_mwst || ""; // "inkl. MwSt." / "Differenzbesteuert" / "Keine MwSt."
      const ratingAvg = Number(inserat?.seller?.rating || inserat?.rating || 0);
      const ratingCnt = Number(inserat?.seller?.ratingCount || inserat?.ratingCount || 0);
  
      const services = {
        finanzierung:    !!(inserat?.seller?.services?.financing || inserat?.finanzierung),
        inzahlungnahme:  !!(inserat?.seller?.services?.tradein    || inserat?.inzahlungnahme),
        lieferung:       !!(inserat?.seller?.services?.delivery   || inserat?.lieferung),
        zulassung:       !!(inserat?.seller?.services?.registration || inserat?.zulassungsservice),
        garantie:        !!(inserat?.seller?.services?.warranty   || inserat?.garantie),
      };
      const languages = Array.isArray(inserat?.seller?.languages) ? inserat.seller.languages : [];
      const opening   = inserat?.seller?.openingHours || null; // {mo:"09–18", ...}
      const impressum = {
        firma:      inserat?.seller?.firma      || inserat?.firma,
        rechtsform: inserat?.seller?.rechtsform || inserat?.rechtsform,
        hrb:        inserat?.seller?.handelsregister || inserat?.hrb,
        ustid:      inserat?.seller?.ustId      || inserat?.ustId || inserat?.ustid
      };
  
      // — Header
      const header   = el("div","seller-header");
      const ident    = el("div","seller-ident");
      const avatar   = el("div","dealer-avatar");
      const img      = el("img"); img.alt = `${name} Logo`;
      const ini      = el("span","dealer-initials"); ini.textContent = initials(name);
      avatar.append(img, ini);
      ident.appendChild(avatar);
  
      const headRight = el("div");
      const nameEl  = el("div","seller-name"); nameEl.textContent = name;
  
      const badges  = el("div","seller-badges");
      badges.innerHTML = `
        <span class="badge"><i class="fas fa-${isDealer?'user-tie':'user'}"></i> ${isDealer ? 'Gewerblich' : 'Privat'}</span>
        ${mwst ? `<span class="badge"><i class="fas fa-file-invoice"></i> ${mwst}</span>` : ""}
        ${services.garantie ? `<span class="badge"><i class="fas fa-shield-alt"></i> Garantie</span>` : ""}
      `;
  
      const rating  = el("div","seller-rating");
      rating.innerHTML = `${starHTML(ratingAvg)} <span class="count">${ratingCnt ? `(${ratingCnt})` : ""}</span>`;
  
      headRight.append(nameEl, badges, rating);
      header.append(ident, headRight);
  
      // — Body
      const body = el("div","seller-body");
  
      // Meta
      const meta = el("div","seller-meta");
      const langs = languages.length ? languages.join(", ") : "";
      const steuerHinweis = isDealer ? (mwst || "Steuerangaben siehe Preisdetails") : "Privatverkauf – keine MwSt.";
      meta.innerHTML = `
        ${standort ? kv("Standort", standort) : ""}
        ${kv(isDealer ? "Steuer" : "Hinweis", steuerHinweis)}
        ${langs ? kv("Sprachen", langs) : ""}
      `;
      body.appendChild(meta);
  
      // Services
      const svc = el("div","seller-services");
      const svcMap = [
        ["Finanzierung", services.finanzierung],
        ["Inzahlungnahme", services.inzahlungnahme],
        ["Lieferung", services.lieferung],
        ["Zulassung", services.zulassung]
      ];
      svc.innerHTML = svcMap.filter(([,v]) => v).map(([label]) => `<span class="badge">${label}</span>`).join("");
      if (svc.innerHTML) body.appendChild(svc);
  
      // Actions
      const actions = el("div","seller-actions");
      const mapsUrl = standort ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(standort)}` : "#";
      actions.innerHTML = `
        ${tel ? `<a class="btn" href="tel:${tel}"><i class="fas fa-phone"></i> Anrufen</a>` : `<button class="btn" disabled><i class="fas fa-phone"></i> Anrufen</button>`}
        <button class="btn" type="button" id="seller-msg-btn"><i class="fas fa-comment-dots"></i> Nachricht</button>
        <a class="btn" href="${mapsUrl}" target="_blank" rel="noopener"><i class="fas fa-map-marked-alt"></i> Route</a>
        <button class="btn" type="button" id="seller-allcars-btn"><i class="fas fa-car"></i> Alle Fahrzeuge</button>
        <button class="btn" type="button" id="seller-rate-btn"><i class="fas fa-star"></i> Bewerten</button>
      `;
      body.appendChild(actions);
  
      // Zusatz (Öffnungszeiten/Impressum/Privat)
      const section = el("div","seller-section");
      let extra = "";
      if (isDealer && opening) {
        extra += `<h4><i class="far fa-clock"></i> Öffnungszeiten</h4>${hoursList(opening)}`;
      }
      if (isDealer && (impressum.firma || impressum.ustid || impressum.hrb || impressum.rechtsform)) {
        extra += `
          <h4 style="margin-top:10px;"><i class="fas fa-info-circle"></i> Impressum (Kurz)</h4>
          <div class="seller-meta" style="grid-template-columns: 140px 1fr;">
            ${impressum.firma ? kv("Firma", impressum.firma) : ""}
            ${impressum.rechtsform ? kv("Rechtsform", impressum.rechtsform) : ""}
            ${impressum.hrb ? kv("Handelsregister", impressum.hrb) : ""}
            ${impressum.ustid ? kv("USt-ID", impressum.ustid) : ""}
          </div>
        `;
      }
      if (!isDealer) {
        extra += `
          <h4><i class="fas fa-user"></i> Privatverkauf</h4>
          <div class="kv-val" style="margin-top:-4px;">Privatverkauf – keine MwSt., in der Regel keine gesetzliche Gewährleistung.</div>
        `;
      }
      if (extra) { section.innerHTML = extra; body.appendChild(section); }
  
      // Rendern
      root.innerHTML = "";
      root.append(header, body);
  
      // Avatar-Bild (Safari-safe)
      if (logo) {
        img.addEventListener("load", () => { avatar.classList.add("has-logo"); }, { once:true });
        img.addEventListener("error", () => { avatar.classList.remove("has-logo"); img.removeAttribute("src"); }, { once:true });
        img.src = logo;
        if (img.complete && img.naturalWidth > 0) avatar.classList.add("has-logo");
      }
  
      // Buttons verbinden (nutzt bestehende Funktionen/Panels)
      $("#seller-msg-btn")?.addEventListener("click", () => {
        document.getElementById("contactPanel")?.classList.add("open");
      });
      $("#seller-rate-btn")?.addEventListener("click", () => {
        if (typeof toggleRatingPanel === "function") toggleRatingPanel();
      });
      $("#seller-allcars-btn")?.addEventListener("click", () => {
        if (sellerId) {
          window.location.href = `suche.html?seller=${encodeURIComponent(sellerId)}`;
        } else if (standort) {
          window.location.href = `suche.html?ort=${encodeURIComponent(standort)}`;
        } else {
          window.location.href = `suche.html`;
        }
      });
    }
  
    return { render };
  })();
  
  /* Beim DOM-Ready das Inserat holen und Karte rendern */
  document.addEventListener("DOMContentLoaded", () => {
    let inserat = {};
    try { inserat = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}"); } catch {}
    SellerCard.render(inserat);
  });
  
  /* ========================================================================
     …ab hier DEIN bestehender anzeige.js Code (setupAuthLink, Slider, etc.)
     ======================================================================== */
  