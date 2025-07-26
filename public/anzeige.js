let mediaItems = [];
let currentIndex = 0;
let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isDragging = false;
let animationID;
let slider;
let container;

window.addEventListener("load", () => {
    const daten = localStorage.getItem("ausgewaehltesInserat");
    if (!daten) return;
  
    const inserat = JSON.parse(daten);
  
    // 🔹 Titel setzen
    const titelAnzeige = document.getElementById("titelAnzeige");
    const carTitle = document.getElementById("car-title");
    if (inserat.titel) {
      if (titelAnzeige) titelAnzeige.textContent = inserat.titel;
      if (carTitle) carTitle.textContent = inserat.titel;
    }
  
    // 🔹 Preis setzen
    const priceMain = document.getElementById("price-main");
    const priceNet = document.getElementById("price-net");
    const mwstType = document.getElementById("mwst-type");
    const priceType = document.getElementById("price-type");
  
    if (priceMain) {
      if (inserat.verkauf_brutto) {
        priceMain.textContent = `${Number(inserat.verkauf_brutto).toLocaleString("de-DE")} €`;
      } else if (inserat.verkauf_preis) {
        priceMain.textContent = `${Number(inserat.verkauf_preis).toLocaleString("de-DE")} €`;
      } else {
        priceMain.textContent = "–";
      }
    }
  
    if (priceNet && inserat.verkauf_netto) {
      priceNet.textContent = `${Number(inserat.verkauf_netto).toLocaleString("de-DE")} €`;
    }
  
    if (mwstType && inserat.verkauf_mwst) {
      mwstType.textContent = inserat.verkauf_mwst;
    }
  
    if (priceType) {
      priceType.textContent =
        inserat.verkauf_mwst === "Keine MwSt." ? "Endpreis" : "Brutto";
    }
  
    // 🔹 Medien vorbereiten
    mediaItems = [];
  
    if (Array.isArray(inserat.images)) {
      inserat.images.forEach((src) => {
        mediaItems.push({ type: "img", src });
      });
    }
  
    if (inserat.video && inserat.video.trim() !== "") {
      mediaItems.push({ type: "video", src: inserat.video });
    }
  
    initSlider();
    setMedia(0);
    setupSlider();
  
    const ezEl = document.getElementById("info-ez");
const kmEl = document.getElementById("info-km");
const psEl = document.getElementById("info-ps");
const kraftstoffEl = document.getElementById("info-kraftstoff");
const getriebeEl = document.getElementById("info-getriebe");
const sellerTypeEl = document.getElementById("seller-type");

if (inserat.verkauf_erstzulassung && ezEl) {
  ezEl.textContent = inserat.verkauf_erstzulassung;
}

if (inserat.verkauf_kilometer && kmEl) {
  kmEl.textContent = `${Number(inserat.verkauf_kilometer).toLocaleString("de-DE")} km`;
}

if (inserat.verkauf_leistung && psEl) {
  psEl.textContent = `${inserat.verkauf_leistung} PS`;
}

if (inserat.verkauf_kraftstoff && kraftstoffEl) {
  kraftstoffEl.textContent = inserat.verkauf_kraftstoff;
}

if (inserat.verkauf_getriebe && getriebeEl) {
  getriebeEl.textContent = inserat.verkauf_getriebe;
}

if (inserat.verkauf_verkaeufer && sellerTypeEl) {
  sellerTypeEl.textContent = inserat.verkauf_verkaeufer;
}



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
    "v-hu": "", // wird separat behandelt
    "v-klimatisierung": "klimatisierung",
    "v-einparkhilfe": "", // wird separat behandelt
    "v-airbags": "airbags",
    "v-innenausstattung": "innenmaterial"
  };
  
  // 🔹 Alle direkten Zuweisungen
  for (const [spanId, jsonKey] of Object.entries(technischeDatenMapping)) {
    const el = document.getElementById(spanId);
    if (!el) continue;
  
    if (jsonKey && inserat[jsonKey]) {
      el.textContent = inserat[jsonKey];
    }
  }
  
  // 🔹 Sonderfall HU
  const huEl = document.getElementById("v-hu");
  if (huEl && inserat.tuevMonat && inserat.tuevJahr) {
    huEl.textContent = `${inserat.tuevMonat} ${inserat.tuevJahr}`;
  }
  
  // 🔹 Sonderfall Einparkhilfe (zusammenfassend dargestellt)
  const einparkhilfeEl = document.getElementById("v-einparkhilfe");
  if (einparkhilfeEl) {
    const hilfen = [];
    if (inserat.einparkhilfeVorne) hilfen.push("vorn");
    if (inserat.einparkhilfeHinten) hilfen.push("hinten");
    if (inserat.einparkhilfeSelbstlenkend) hilfen.push("selbstlenkend");
    if (inserat.kameraHinten) hilfen.push("Kamera hinten");
    if (inserat.kamera360) hilfen.push("360° Kamera");
  
    einparkhilfeEl.textContent = hilfen.length > 0 ? hilfen.join(", ") : "–";
  }
  



  const ausstattungContainer = document.getElementById("v-ausstattung");
  const ausstattungBlock = document.getElementById("ausstattung-block");
  
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
    // ✍️ … (alle weiteren ausstattungLabels einfügen wie in vorschau.js)
  };
  let hatAusstattung = false;

  for (const key in ausstattungLabels) {
    const gespeichert = localStorage.getItem("details_" + key);
    const datenwert = inserat["verkauf_" + key] || inserat[key];
  
    const checked = gespeichert === "true" || datenwert === true || datenwert === "true";
  
    if (checked) {
      const div = document.createElement("div");
      div.classList.add("equipment-item");
      div.innerHTML = `<i class="fas fa-check"></i> ${ausstattungLabels[key]}`;
      ausstattungContainer.appendChild(div);
      hatAusstattung = true;
    }
  }
  
  if (hatAusstattung) {
    ausstattungBlock.style.display = "block";
  }
  
  const beschreibungEl = document.getElementById("car-description");
  const toggleBtn = document.getElementById("toggle-description-btn");
  
  if (inserat.fahrzeugbeschreibung && beschreibungEl) {
    beschreibungEl.textContent = inserat.fahrzeugbeschreibung;
  }
  
  // Falls Button existiert, Umschaltfunktion aktivieren
  toggleBtn?.addEventListener("click", () => {
    beschreibungEl.classList.toggle("expanded");
    toggleBtn.textContent = beschreibungEl.classList.contains("expanded")
      ? "Weniger anzeigen"
      : "Mehr anzeigen";
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
    const navLinks = document.getElementById("nav-links");
    const hamburger = document.getElementById("hamburger");
    const dropdownLinks = document.querySelectorAll(".dropdown > a");
  
    hamburger?.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks?.classList.toggle("active");
      closeAllDropdowns();
    });
  
    dropdownLinks.forEach(link => {
      const menu = link.nextElementSibling;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
  
        document.querySelectorAll(".dropdown-menu").forEach(otherMenu => {
          if (otherMenu !== menu) otherMenu.classList.remove("show");
        });
  
        menu.classList.toggle("show");
      });
    });
  
    document.addEventListener("click", () => {
      navLinks?.classList.remove("active");
      closeAllDropdowns();
    });
  
    function closeAllDropdowns() {
      document.querySelectorAll(".dropdown-menu").forEach(menu => {
        menu.classList.remove("show");
      });
    }
  
    // Beispiel-Login-Logik
    const isLoggedIn = false;
    document.getElementById("saved-cars-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isLoggedIn ? "gespeicherte-autos.html" : "login.html";
    });
    document.getElementById("my-cars-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isLoggedIn ? "meine-autos.html" : "login.html";
    });
  
    document.querySelector('a[href="#search-section"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
  
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
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  document.getElementById('toggle-description-btn').addEventListener('click', function() {
    document.querySelector('.car-description-box').classList.toggle('expanded');
    this.textContent = this.textContent.includes('Mehr') ? 'Weniger anzeigen' : 'Mehr anzeigen';
  });
  
  
  
  document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("messageForm");
  
    // 🔄 Fahrzeugdaten aus localStorage holen
    const fahrzeug = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}");
  
    if (!fahrzeug || !fahrzeug.id) {
      alert("❌ Kein Fahrzeug ausgewählt.");
      window.location.href = "übersicht.html";
      return;
    }
  
    // 📩 Formular absenden
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
  
      const nachricht = this.querySelector("textarea[name='nachricht']").value.trim();
      if (!nachricht) return;
  
      const senderId = localStorage.getItem("userId");
      const absenderName = localStorage.getItem("username");
  
      if (!senderId || !absenderName) {
        alert("Bitte logge dich ein, um eine Nachricht zu senden.");
        return;
      }
  
      const payload = {
        senderId,
        empfaengerId: fahrzeug.verkaeuferId, // ← wichtig
        fahrzeugId: fahrzeug.id,
        absenderName,
        nachricht
      };
  
      try {
        const res = await fetch("/nachricht-senden", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
  
        const result = await res.json();
        if (res.ok && result.success) {
          alert("Nachricht wurde erfolgreich gesendet.");
          this.reset();
        } else {
          alert("Fehler beim Senden: " + (result.error || "Unbekannt"));
        }
      } catch (err) {
        console.error("Fehler beim Senden:", err);
        alert("Serverfehler. Bitte später versuchen.");
      }
    });
  });
  
  
  
  
  
  
  
  function toggleRatingPanel() {
    const panel = document.getElementById("ratingPanel");
    panel.classList.toggle("show");
  }
  
  
  
  
  
  
  function toggleContactPanel() {
    const panel = document.getElementById("contactPanel");
    const overlay = document.getElementById("contactOverlay");
    panel.classList.toggle("open");
    overlay.classList.toggle("show");
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
  
  












