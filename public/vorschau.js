// JavaScript für vorschau.html – korrigiert: kein automatisches Scrollen mehr

let mediaItems = [];
let currentIndex = 0;
let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isDragging = false;
let animationID;
let slider;
let container;

async function fetchMedia() {
  try {
    const res = await fetch("/getVehicleData");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;
    const lastVehicle = data[data.length - 1];
    if (Array.isArray(lastVehicle.images)) {
      mediaItems.push(...lastVehicle.images.map(src => ({ type: "img", src })));
    }
    if (lastVehicle.video) {
      mediaItems.push({ type: "video", src: lastVehicle.video });
    }
  } catch (err) {
    console.error("❌ Fehler beim Laden der Fahrzeugdaten:", err);
  }
}

window.addEventListener("load", async () => {
  await fetchMedia();

  // Fallback-Bilder
  if (mediaItems.length === 0) {
    mediaItems = [
      { type: "img", src: "platzhalter1.jpg" },
      { type: "img", src: "platzhalter2.jpg" }
    ];
  }

  initSlider();
  setMedia(0);
  setupSlider();

  // ✅ Verhindert automatisches Scrollen nach unten
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, 100);
});

function initSlider() {
    document.documentElement.style.setProperty('--media-count', mediaItems.length);
    slider = document.getElementById("media-slider");
    container = document.getElementById("media-display");
    slider.innerHTML = "";
    const thumbContainer = document.getElementById("thumbnail-track");
    thumbContainer.innerHTML = "";
  
    mediaItems.forEach((item, i) => {
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
        el.tabIndex = -1; // ✅ Fokus blockieren → kein Scroll-Jump
      } else {
        el.addEventListener("load", () => {
          if (el.naturalHeight > el.naturalWidth) {
            el.classList.add("portrait");
          }
        });
      }
  
      el.addEventListener("click", () => openFullscreen(el));
  
      const btn = document.createElement("div");
      btn.classList.add("fullscreen-btn");
      btn.innerHTML = `<i class="fas fa-expand"></i>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openFullscreen(el);
      });
  
      wrapper.appendChild(el);
      wrapper.appendChild(btn);
      slider.appendChild(wrapper);
  
      const thumb = document.createElement(item.type === "img" ? "img" : "video");
      thumb.src = item.src;
      thumb.classList.add("media-thumb");
      thumb.addEventListener("click", () => setMedia(i));
      thumbContainer.appendChild(thumb);
    });
  
    setTimeout(() => {
      updateSlider(false);
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
  if (movedBy < -50 && currentIndex < mediaItems.length - 1) currentIndex++;
  else if (movedBy > 50 && currentIndex > 0) currentIndex--;
  updateSlider();
}

function animation() {
  setSliderPosition();
  if (isDragging) requestAnimationFrame(animation);
}

function setSliderPosition() {
  slider.style.transform = `translateX(${currentTranslate}px)`;
}

function updateSlider() {
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
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle("active-thumb", i === currentIndex);
      if (i === currentIndex) {
        thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    });
  }
  

  function openFullscreen(media) {
    // ❌ Kein Bild oder Video übergeben → abbrechen
    if (!media || !(media.tagName === "IMG" || media.tagName === "VIDEO")) return;
  
    // 🔍 Alle Slides sammeln (Bilder + Videos)
    const allSlides = document.querySelectorAll(".media-slide");
  
    // 🔢 Aktuelles Medium im Array finden
    currentLightboxIndex = Array.from(allSlides).findIndex(el => el.src === media.src);
  
    // 📦 Lightbox-Overlay holen
    const overlay = document.getElementById("lightbox-overlay");
  
    // ❗ Fehler abfangen, wenn Overlay fehlt
    if (!overlay) {
      console.warn("⚠️ Lightbox-Overlay (#lightbox-overlay) nicht gefunden.");
      return;
    }
  
    // ✅ Overlay anzeigen
    overlay.classList.add("show");
  
    // 📸 Medium anzeigen
    renderLightboxMedia(media);
  
    // 🔢 Bildzähler aktualisieren
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

function updateLightboxCounter() {
  const counter = document.getElementById("lightbox-counter");
  if (counter) {
    counter.textContent = `Bild ${currentLightboxIndex + 1} von ${mediaItems.length}`;
  }
}

function closeLightbox() {
  const overlay = document.getElementById("lightbox-overlay");
  overlay.classList.remove("show");
  document.getElementById("lightbox-content").innerHTML = "";
}

function navigateLightbox(direction) {
  const allSlides = document.querySelectorAll(".media-slide");
  currentLightboxIndex = Math.max(0, Math.min(currentLightboxIndex + direction, allSlides.length - 1));
  const nextMedia = allSlides[currentLightboxIndex];
  renderLightboxMedia(nextMedia);
  updateLightboxCounter();
}

function setupLightboxSwipe() {
  const overlay = document.getElementById("lightbox-overlay");
  const content = document.getElementById("lightbox-content");
  [overlay, content].forEach(el => {
    el.addEventListener("pointerdown", lightboxDragStart);
    el.addEventListener("pointermove", lightboxDragMove);
    el.addEventListener("pointerup", lightboxDragEnd);
    el.addEventListener("pointercancel", lightboxDragEnd);
    el.addEventListener("pointerleave", lightboxDragEnd);
  });
}

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
  if (media) media.style.transform = `translateX(${deltaX}px)`;
  if (Math.abs(deltaX) > 50) {
    lightboxIsDragging = false;
    document.getElementById("lightbox-overlay").classList.remove("dragging");
    if (deltaX > 0) navigateLightbox(-1);
    else navigateLightbox(1);
  }
}

function lightboxDragEnd(e) {
  if (!lightboxIsDragging) return;
  lightboxIsDragging = false;
  document.getElementById("lightbox-overlay").classList.remove("dragging");
  const deltaX = e.clientX - lightboxStartX;
  if (Math.abs(deltaX) > 80) {
    if (deltaX > 0) navigateLightbox(-1);
    else navigateLightbox(1);
  } else {
    const media = document.querySelector("#lightbox-content .lightbox-inner-media");
    media.style.transition = "transform 0.3s ease";
    media.style.transform = "translateX(0)";
    setTimeout(() => media.style.transition = "", 300);
  }
}

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
        request.call(media).catch(err => console.error("Fullscreen konnte nicht aktiviert werden:", err));
      }
    }
  }
}

let lastTap = 0;
let currentLightboxIndex = 0;
let lightboxStartX = 0;
let lightboxIsDragging = false;

// Tarifanzeige
function updateNavbarTarif() {
  const tarifBadge = document.getElementById("tarifAnzeige");
  if (!tarifBadge) return;
  const tarifPreise = {
    "0–3 Fahrzeuge": "Kostenlos",
    "4–10 Fahrzeuge": "4,90 € / Monat",
    "11–25 Fahrzeuge": "9,90 € / Monat",
    "26–50 Fahrzeuge": "17,90 € / Monat",
    "51–100 Fahrzeuge": "29,90 € / Monat",
    "100+ Fahrzeuge": "Auf Anfrage"
  };
  fetch("/getTarif")
    .then(res => res.json())
    .then(data => {
      if (data.tarif) {
        const preis = tarifPreise[data.tarif] || "";
        tarifBadge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${data.tarif} – ${preis}`;
      }
    })
    .catch(err => console.warn("⚠️ Tarif konnte nicht geladen werden:", err));
}document.addEventListener("DOMContentLoaded", () => {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        console.log("✅ Daten von /getNutzerInfo erhalten:", data);
  
        if (!data.eingeloggt || !data.nutzer) {
          const ziel = sessionStorage.getItem("verkaeuferTyp") === "haendler" ? "haendler.html" : "privat.html";
          console.warn("⛔ Nicht eingeloggt. Weiterleitung zu:", ziel);
          window.location.href = ziel;
          return;
        }
  
        // 🟢 Nutzer-Infos speichern
        localStorage.setItem("nutzerId", data.nutzer.id); // 🔑 hinzugefügt
        localStorage.setItem("userRole", data.nutzer.role || "");
  
        // Restliche Setup-Logik mit try/catch:
        try {
          updateNavbarTarif();
          console.log("✅ updateNavbarTarif erfolgreich");
        } catch (e) {
          console.error("❌ Fehler in updateNavbarTarif:", e);
        }
  
        try {
          setupLightboxSwipe();
          console.log("✅ setupLightboxSwipe erfolgreich");
        } catch (e) {
          console.error("❌ Fehler in setupLightboxSwipe:", e);
        }
  
        try {
          const btn = document.getElementById("toggle-description-btn");
          const description = document.getElementById("car-description");
          if (btn && description) {
            btn.addEventListener("click", () => {
              description.classList.toggle("expanded");
              btn.textContent = description.classList.contains("expanded") ? "Weniger anzeigen" : "Mehr anzeigen";
            });
            console.log("✅ Toggle Beschreibung-Button aktiviert");
          }
        } catch (e) {
          console.error("❌ Fehler beim Toggle-Button:", e);
        }
  
        try {
          const fullscreenBtn = document.getElementById("lightbox-fullscreen-btn");
          if (fullscreenBtn) {
            fullscreenBtn.addEventListener("click", () => {
              const media = document.querySelector("#lightbox-content .lightbox-inner-media");
              if (media) {
                const request = media.requestFullscreen || media.webkitRequestFullscreen;
                if (request) {
                  request.call(media).catch(err => console.error("❌ Fullscreen-Fehler:", err));
                }
              }
            });
            console.log("✅ Fullscreen-Button aktiviert");
          }
        } catch (e) {
          console.error("❌ Fehler beim Fullscreen-Button:", e);
        }
  
        try {
          setupNavbar();
          console.log("✅ setupNavbar erfolgreich");
        } catch (e) {
          console.error("❌ Fehler in setupNavbar:", e);
        }
      })
      .catch(err => {
        console.error("❌ Fehler beim Abrufen der Nutzerinfo:", err);
        const ziel = sessionStorage.getItem("verkaeuferTyp") === "haendler" ? "haendler.html" : "privat.html";
        console.warn("⛔ Fehler → Weiterleitung zu:", ziel);
        window.location.href = ziel;
      });
  });
  




  function goBackToMedia() {
    window.location.href = "medien.html";
  }
  



  function goToEditVehicleData() {
    window.location.href = "fahrzeugdaten.html";
  }
  
  function goToEditDetails() {
    const userRole = localStorage.getItem("userRole");
  
    // 🔁 Leite korrekt weiter – je nach Rolle
    if (userRole === "haendler") {
      window.location.href = "fahrzeugdetails.html?rolle=haendler";
    } else {
      window.location.href = "fahrzeugdetails.html?rolle=privat";
    }
  }
  

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("/getVehicleData");
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
  
      const last = data[data.length - 1];
  
      // Preise
      const priceMain = document.getElementById("price-main");
      const priceNet = document.getElementById("price-net");
      const mwstType = document.getElementById("mwst-type");
      const priceType = document.getElementById("price-type");
  
      if (last.verkauf_brutto && priceMain) {
        priceMain.textContent = `${Number(last.verkauf_brutto).toLocaleString("de-DE")} €`;
      } else if (last.verkauf_preis && priceMain) {
        priceMain.textContent = `${Number(last.verkauf_preis).toLocaleString("de-DE")} €`;
      }
  
      if (priceNet && last.verkauf_netto) {
        priceNet.textContent = `${Number(last.verkauf_netto).toLocaleString("de-DE")} €`;
      }
  
      if (mwstType && last.verkauf_mwst) {
        mwstType.textContent = last.verkauf_mwst;
      }
  
      if (priceType) {
        if (last.verkauf_mwst === "Keine MwSt.") {
          priceType.textContent = "Endpreis";
        } else {
          priceType.textContent = "Brutto";
        }
      }
  
      // Titel
      const title = document.getElementById("car-title");
      if (title && last.verkauf_modell) {
        title.textContent = last.verkauf_modell;
      }
  
      // Verkäufer
      const sellerType = document.getElementById("seller-type");
      if (sellerType && last.verkauf_verkaeufer) {
        sellerType.textContent = last.verkauf_verkaeufer;
      }

      const innenmaterial = localStorage.getItem("details_innenmaterial") || last.verkauf_innenmaterial || "";
const innenfarbe = localStorage.getItem("details_innenfarbe") || last.verkauf_innenfarbe || "";

const innenText = [innenmaterial, innenfarbe].filter(Boolean).join(" / ");

const innenEl = document.getElementById("v-innenausstattung");
if (innenEl && innenText) {
  innenEl.textContent = innenText;
}


const einparkhilfe = localStorage.getItem("details_einparkhilfe") || last.verkauf_einparkhilfe;
const el = document.getElementById("v-einparkhilfe");
if (el && einparkhilfe) {
  el.textContent = einparkhilfe;
}

const beschreibungElement = document.getElementById("car-description");
if (last.fahrzeugbeschreibung && beschreibungElement) {
  const absätze = last.fahrzeugbeschreibung.split(/\n+/).filter(zeile => zeile.trim() !== "");
  beschreibungElement.innerHTML = absätze.map(absatz => `<p>${absatz}</p>`).join("");
}


  
      // Weitere Fahrzeug-Infos
      const ez = document.getElementById("info-ez");
      const km = document.getElementById("info-km");
      const ps = document.getElementById("info-ps");
      const kraftstoff = document.getElementById("info-kraftstoff");
      const getriebe = document.getElementById("info-getriebe");
      const verkaeufer = document.getElementById("info-verkaeufer");
  
      if (ez && last.verkauf_erstzulassung) {
        ez.textContent = last.verkauf_erstzulassung;
      }
  
      if (km && last.verkauf_kilometer) {
        km.textContent = `${Number(last.verkauf_kilometer).toLocaleString("de-DE")} km`;
      }
  
      if (ps && last.verkauf_leistung) {
        ps.textContent = `${last.verkauf_leistung} PS`;
      }
  
      if (kraftstoff && last.verkauf_kraftstoff) {
        kraftstoff.textContent = last.verkauf_kraftstoff;
      }
  
      if (getriebe && last.verkauf_getriebe) {
        getriebe.textContent = last.verkauf_getriebe;
      }
  
      if (verkaeufer && last.verkauf_verkaeufer) {
        verkaeufer.textContent = last.verkauf_verkaeufer;
      }


// Technische Daten (Vorschau-Zuweisungen)
const td = {
    typ: "v-typ",
    verbrauch_kombiniert: "v-verbrauch-kombiniert",
    verbrauch_innerorts: "v-verbrauch-innerorts",
    verbrauch_ausserorts: "v-verbrauch-ausserorts",
    vorbesitzer: "v-vorbesitzer",
    fahrzeugtyp: "v-fahrzeugtyp",
    hubraum: "v-hubraum",
    antrieb: "v-antrieb",
    co2_emission: "v-co2",
    schadstoffklasse: "v-schadstoffklasse",
    umweltplakette: "v-umweltplakette",
    tueren: "v-tueren",
    partikelfilter: "v-partikelfilter",
    zustand: "v-zustand",
     // 🟢 NEUE FELDER:
  fahrzeugart: "v-fahrzeugart",
  halter: "v-halter",
  fahrtauglich: "v-fahrtauglich",
  beschaedigt: "v-beschaedigt",
  unfall: "v-unfall",// ✅ Richtig eingefügt
  hu: "v-hu",
  karosseriefarbe: "v-karosseriefarbe",
  airbags: "v-airbags",
  klimatisierung: "v-klimatisierung"

  };
  
  // Werte aus localStorage (z. B. aus "fahrzeugdetails") anzeigen
  for (const key in td) {
    const el = document.getElementById(td[key]);
    const value = localStorage.getItem("details_" + key) || last[`verkauf_${key}`];
    if (el && value) {
      el.textContent = value;
    }
  }
  
  // ✅ Ausstattung laden und anzeigen
const ausstattungContainer = document.getElementById("v-ausstattung");
const ausstattungBlock = document.getElementById("ausstattung-block");

const ausstattungen = [
    "abstandsregeltempomat",
    "applecarplay",
    "androidauto",
    "frontscheibenheizung",
    "heckklappe",
    "led",
    "multifunktion",
    "navigation",
    "sitzheizung",
    "rueckfahrkamera",
    "nichtraucher",
    "scheckheft",
    "garantie",
    "mettalic",
    "abs",
    "esp",
    "asr",
    "berganfahrassistent",
    "muedigkeitswarner",
    "spurhalteassistent",
    "totwinkelassistent",
    "notbremsassistent",
    "notrufsystem",
    "verkehrszeichenerkennung",
    "isofixhinten",
    "isofixbeifahrer",
    "scheinwerferreinigung",
    "blendfreiesfernlicht",
    "fernlichtassistent",
    "innenspiegelabblendend",
    "nachtsichtassistent",
    "nebelscheinwerfer",
    "lichtsensor",
    "regensensor",
    "alarmanlage",
    "wegfahrsperre",
    "keylesszv",
    "zentralverriegelung",
    "standheizung",
    "frontscheibebeheizbar",
    "lenkradbeheizbar",
    "einparkhilfeselbstlenkend",
    
    "kamerahinten",
    "kamera360",
    "sitzheizungvorne",
    "sitzheizunghinten",
    "sitzeelektrisch",
    "sportsitze",
    "armlehne",
    "lordosenstuetze",
    "massagesitze",
    "sitzbelueftung",
    "beifahrersitzumklappbar",
    "elektrfensterheber",
    "elektrspiegel",
    "elektheckklappe",
    "servolenkung",
    "ambientebeleuchtung",
    "lederlenkrad",
    "radio",
    "dab",
    "cd",
    "tv",
    "navi",
    "soundsystem",
    "touchscreen",
    "sprachsteuerung",
    "multifunktionslenkrad",
    "freisprecheinrichtung",
    "usb",
    "bluetooth",
    "wlan",
    "streaming",
    "induktionsladen",
    "bordcomputer",
    "headup",
    "volldigital",
    "alufelgen",
    "sommerreifen",
    "winterreifen",
    "allwetterreifen",
    "reifendruckkontrolle",
    "winterpaket",
    "raucherpaket",
    "sportpaket",
    "sportfahrwerk",
    "luftfederung",
    "gepaeckabtrennung",
    "skisack",
    "schiebedach",
    "panoramadach",
    "dachreling",
    "behindertengerecht",
    "taxi"
  ];
  

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

ausstattungen.forEach(key => {
  const checked = localStorage.getItem("details_" + key) === "true" || last[`verkauf_${key}`] === true;
  if (checked && ausstattungLabels[key]) {
    const div = document.createElement("div");
    div.classList.add("equipment-item");
    div.innerHTML = `<i class="fas fa-check"></i> ${ausstattungLabels[key]}`;
    ausstattungContainer.appendChild(div);
    hatAusstattung = true;
  }
});

if (hatAusstattung) {
  ausstattungBlock.style.display = "block";
}

  
    } catch (err) {
      console.error("❌ Fehler beim Laden der Vorschau-Daten:", err);
    }
  });
  document.addEventListener("DOMContentLoaded", async () => {
    let nutzer = null; // ✅ globaler Zugriff
  
    const publishBtn = document.querySelector(".publish-button");
    const kontaktOverlay = document.getElementById("kontaktOverlay");
    const kontaktForm = document.getElementById("kontaktForm");
  
    publishBtn?.addEventListener("click", async () => {
      const verkaeuferId = localStorage.getItem("nutzerId");
      if (!verkaeuferId) {
        alert("❌ Du bist nicht eingeloggt!");
        return;
      }
  
      try {
        const res = await fetch("/nutzer.json");
        const nutzerListe = await res.json();
        nutzer = nutzerListe.find(n => n.id === verkaeuferId); // ✅ global speichern
  
        if (nutzer) {
          document.getElementById("kontaktNameInput").value = nutzer.firma || nutzer.name || "";
          document.getElementById("kontaktStrasseInput").value = nutzer.strasse || "";
          document.getElementById("kontaktPlzInput").value = nutzer.plz || "";
          document.getElementById("kontaktOrtInput").value = nutzer.ort || "";
          document.getElementById("kontaktTelefonInput").value = nutzer.telefon || "";
        }
      } catch (err) {
        console.error("Fehler beim Laden der Nutzerdaten:", err);
      }
  
      kontaktOverlay.style.display = "flex";
    });
  
    kontaktForm.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const verkaeuferId = localStorage.getItem("nutzerId");
  
      const kontaktDaten = {
        verkaeuferId,
        name: document.getElementById("kontaktNameInput").value.trim(),
        strasse: document.getElementById("kontaktStrasseInput").value.trim(),
        plz: document.getElementById("kontaktPlzInput").value.trim(),
        ort: document.getElementById("kontaktOrtInput").value.trim(),
        telefon: document.getElementById("kontaktTelefonInput").value.trim(),
  
        verkauf_verkaeufer: nutzer?.role === "haendler" ? "Händler" : "Privatverkäufer",
        verkauf_name: document.getElementById("kontaktNameInput").value.trim(),
        standort: `${document.getElementById("kontaktPlzInput").value.trim()} ${document.getElementById("kontaktOrtInput").value.trim()}`
      };
  
      try {
        const res = await fetch("/veroeffentlichen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kontaktDaten)
        });
  
        const text = await res.text();
        if (res.ok) {
          alert("✅ Inserat veröffentlicht!");
          localStorage.removeItem("fahrzeugId");
          window.location.href = "übersicht.html";
        } else {
          alert("❌ Fehler beim Veröffentlichen:\n" + text);
        }
      } catch (err) {
        alert("Netzwerkfehler beim Veröffentlichen.");
        console.error(err);
      }
    });
  });
  
  
  function closeKontaktPopup() {
    document.getElementById("kontaktOverlay").style.display = "none";
  }
  
  
  
  
  






  const erlaubteAusstattungen = [
    // Bisherige:
    "Gepäckraumabtrennung",
    "Skisack",
    "Schiebedach",
    "Panorama-Dach",
    "Dachreling",
    "Behindertengerecht",
    "Taxi",
    "Winterpaket",
    "Raucherpaket",
    "Sportpaket",
    "Sportfahrwerk",
    "Luftfederung",
  
    // Infotainment – Multimedia
  
  
    "TV",
    "Navigationssystem",
    "Soundsystem",
  
    // Bedienung & Steuerung
    "Touchscreen",
    "Sprachsteuerung",
    "Multifunktionslenkrad",
 
  
    // Konnektivität & Schnittstellen
    
    "Bluetooth",
    "Apple CarPlay",
    "Android Auto",
    "WLAN / Wifi Hotspot",
    "Musikstreaming integriert",
    "Induktionsladen für Smartphones",
  
    // Instrumentenanzeige
    "Bordcomputer",
    "Head-up Display",
    "Volldigitales Kombiinstrument",
  
    // Reifen und Felgen
    "Leichtmetallfelgen",
    "Sommerreifen",
    "Winterreifen",
    "Allwetterreifen"
  ];
  
  function getZufaelligeAusstattung(ausstattungArray) {
    if (!Array.isArray(ausstattungArray)) return "Besondere Ausstattung";
  
    const gefiltert = ausstattungArray.filter(item => erlaubt.includes(item));
    if (gefiltert.length === 0) return "Besondere Ausstattung";
  
    return gefiltert
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .join(" • ");
  }
  
  const subtitle = document.getElementById("car-subtitle");
  if (subtitle && last.verkauf_ausstattung) {
    subtitle.textContent = getZufaelligeAusstattung(last.verkauf_ausstattung);
  }
  