// vorschau.js — konsolidiert & domänen-robust

// =========================
// API-Basis für Domain-Wechsel
// - optional <meta name="api-base" content="https://api.autovisa.de">
// - optional window.API_BASE = "https://www.autovisa.de"
// - Fallback: gleiche Origin
// =========================
const API_BASE =
  (typeof window !== "undefined" && window.API_BASE) ||
  document.querySelector('meta[name="api-base"]')?.content ||
  "";

const api = (path) => {
  const p = String(path || "");
  if (!API_BASE) return p; // relative (gleiche Origin)
  return API_BASE.replace(/\/+$/, "") + "/" + p.replace(/^\/+/, "");
};

// =========================
// Media-Slider-Status
// =========================
let mediaItems = [];
let currentIndex = 0;
let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isDragging = false;
let animationID;
let slider;
let container;

// Lightbox
let lastVehicle = null;
let lastTap = 0;
let currentLightboxIndex = 0;
let lightboxStartX = 0;
let lightboxIsDragging = false;

// =========================
// Utils
// =========================
const toNum = (v) => {
  if (v === null || v === undefined) return NaN;
  const s = String(v)
    .trim()
    .replace(/[\u202F\u00A0\s]/g, "")
    .replace(/[€]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const fmtEUR = (n) => (Number.isFinite(n) ? n.toLocaleString("de-DE") + " €" : "");

// =========================
// Media laden
// =========================
async function fetchMedia() {
  // wichtig: reset, sonst bleiben alte Items im Speicher
  mediaItems = [];
  lastVehicle = null;

  try {
    const res = await fetch(api(`/getVehicleData?_=${Date.now()}`), {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) {
      console.warn("⚠️ /getVehicleData HTTP", res.status, await res.text());
      return;
    }
    const data = await res.json().catch(() => []);
    if (!Array.isArray(data) || data.length === 0) return;

    lastVehicle = data[0] || {};


    if (Array.isArray(lastVehicle.images)) {
      mediaItems.push(...lastVehicle.images.map((src) => ({ type: "img", src })));
    }
    if (lastVehicle.video) {
      mediaItems.push({ type: "video", src: lastVehicle.video });
    }
  } catch (err) {
    console.error("❌ Fehler beim Laden der Fahrzeugdaten:", err);
  }
}


// =========================
// Slider
// =========================
function initSlider() {
  document.documentElement.style.setProperty("--media-count", mediaItems.length);
  slider = document.getElementById("media-slider");
  container = document.getElementById("media-display");
  if (!slider || !container) return;

  slider.innerHTML = "";
  const thumbContainer = document.getElementById("thumbnail-track");
  if (thumbContainer) thumbContainer.innerHTML = "";

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
      el.tabIndex = -1; // Fokus blockieren → kein Scroll-Jump
    } else {
      el.addEventListener("load", () => {
        if (el.naturalHeight > el.naturalWidth) el.classList.add("portrait");
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

    if (thumbContainer) {
      const thumb = document.createElement(item.type === "img" ? "img" : "video");
      thumb.src = item.src;
      thumb.classList.add("media-thumb");
      thumb.addEventListener("click", () => setMedia(i));
      thumbContainer.appendChild(thumb);
    }
  });

  setTimeout(() => updateSlider(false), 100);
}

function setupSlider() {
  if (!container) return;
  container.addEventListener("pointerdown", dragStart, { passive: false });
  container.addEventListener("pointermove", dragMove, { passive: false });
  container.addEventListener("pointerup", dragEnd);
  container.addEventListener("pointerleave", dragEnd);
  container.addEventListener("pointercancel", dragEnd);
  container.addEventListener("dblclick", () => nextMedia());
}

function dragStart(e) {
  isDragging = true;
  slider?.classList.add("dragging");
  startX = e.clientX;
  animationID = requestAnimationFrame(animation);
  if (slider) slider.style.transition = "none";
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
  slider?.classList.remove("dragging");
  const slideWidth = container?.offsetWidth || 0;
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
  if (slider) slider.style.transform = `translateX(${currentTranslate}px)`;
}

function updateSlider() {
  if (!container || !slider) return;
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

// =========================
// Lightbox
// =========================
function openFullscreen(media) {
  if (!media || !(media.tagName === "IMG" || media.tagName === "VIDEO")) return;
  const allSlides = document.querySelectorAll(".media-slide");
  currentLightboxIndex = Array.from(allSlides).findIndex((el) => el.src === media.src);
  const overlay = document.getElementById("lightbox-overlay");
  if (!overlay) {
    console.warn("⚠️ Lightbox-Overlay (#lightbox-overlay) nicht gefunden.");
    return;
  }
  overlay.classList.add("show");
  renderLightboxMedia(media);
  updateLightboxCounter();
}

function renderLightboxMedia(media) {
  const c = document.getElementById("lightbox-content");
  if (!c) return;
  c.innerHTML = "";
  const el = document.createElement(media.tagName.toLowerCase());
  el.src = media.src;
  el.className = "lightbox-inner-media";
  if (media.tagName === "VIDEO") {
    el.controls = true;
    el.autoplay = true;
    el.playsInline = true;
  }
  c.appendChild(el);
}

function updateLightboxCounter() {
  const counter = document.getElementById("lightbox-counter");
  if (counter) counter.textContent = `Bild ${currentLightboxIndex + 1} von ${mediaItems.length}`;
}

function closeLightbox() {
  const overlay = document.getElementById("lightbox-overlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  const c = document.getElementById("lightbox-content");
  if (c) c.innerHTML = "";
}

function navigateLightbox(direction) {
  const allSlides = document.querySelectorAll(".media-slide");
  currentLightboxIndex = Math.max(0, Math.min(currentLightboxIndex + direction, allSlides.length - 1));
  const nextMedia = allSlides[currentLightboxIndex];
  if (nextMedia) {
    renderLightboxMedia(nextMedia);
    updateLightboxCounter();
  }
}

function setupLightboxSwipe() {
  const overlay = document.getElementById("lightbox-overlay");
  const content = document.getElementById("lightbox-content");
  [overlay, content].forEach((el) => {
    if (!el) return;
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
  document.getElementById("lightbox-overlay")?.classList.add("dragging");
}

function lightboxDragMove(e) {
  if (!lightboxIsDragging) return;
  e.preventDefault();
  const deltaX = e.clientX - lightboxStartX;
  const media = document.querySelector("#lightbox-content .lightbox-inner-media");
  if (media) media.style.transform = `translateX(${deltaX}px)`;
  if (Math.abs(deltaX) > 50) {
    lightboxIsDragging = false;
    document.getElementById("lightbox-overlay")?.classList.remove("dragging");
    if (deltaX > 0) navigateLightbox(-1);
    else navigateLightbox(1);
  }
}

function lightboxDragEnd(e) {
  if (!lightboxIsDragging) return;
  lightboxIsDragging = false;
  document.getElementById("lightbox-overlay")?.classList.remove("dragging");
  const deltaX = e.clientX - lightboxStartX;
  if (Math.abs(deltaX) > 80) {
    if (deltaX > 0) navigateLightbox(-1);
    else navigateLightbox(1);
  } else {
    const media = document.querySelector("#lightbox-content .lightbox-inner-media");
    if (media) {
      media.style.transition = "transform 0.3s ease";
      media.style.transform = "translateX(0)";
      setTimeout(() => (media.style.transition = ""), 300);
    }
  }
}

function handleTapFullscreen(e) {
  const now = Date.now();
  const delta = now - lastTap;
  lastTap = now;
  if (delta < 300 && delta > 0) {
    const media =
      e.target.closest(".lightbox-inner-media") ||
      document.querySelector("#lightbox-content .lightbox-inner-media");
    if (media) {
      const request = media.requestFullscreen || media.webkitRequestFullscreen;
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        exit?.call(document);
      } else if (request) {
        request.call(media).catch((err) => console.error("Fullscreen konnte nicht aktiviert werden:", err));
      }
    }
  }
}

// =========================
// Tarif / Navbar
// =========================
function updateNavbarTarif() {
  const tarifBadge = document.getElementById("tarifAnzeige");
  if (!tarifBadge) return;
  const tarifPreise = {
    "0–3 Fahrzeuge": "Kostenlos",
    "4–10 Fahrzeuge": "4,90 € / Monat",
    "11–25 Fahrzeuge": "9,90 € / Monat",
    "26–50 Fahrzeuge": "17,90 € / Monat",
    "51–100 Fahrzeuge": "29,90 € / Monat",
    "100+ Fahrzeuge": "Auf Anfrage",
  };
  fetch(api("/getTarif"), { credentials: "include" })
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((data) => {
      if (data?.tarif) {
        const preis = tarifPreise[data.tarif] || "";
        tarifBadge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${data.tarif} – ${preis}`;
      }
    })
    .catch(async (err) => {
      const msg = err?.status ? `${err.status} ${await err.text().catch(() => "")}` : String(err);
      console.warn("⚠️ Tarif konnte nicht geladen werden:", msg);
    });
}

// =========================
// Kleine Router-Buttons
// =========================
function goBackToMedia() {
  window.location.href = "medien.html";
}
function goToEditVehicleData() {
  window.location.href = "fahrzeugdaten.html";
}
function goToEditDetails() {
  const userRole = localStorage.getItem("userRole");
  if (userRole === "haendler") {
    window.location.href = "fahrzeugdetails.html?rolle=haendler";
  } else {
    window.location.href = "fahrzeugdetails.html?rolle=privat";
  }
}

// Expose für onclick="" im HTML
window.goBackToMedia = goBackToMedia;
window.goToEditVehicleData = goToEditVehicleData;
window.goToEditDetails = goToEditDetails;
window.closeLightbox = closeLightbox;

// =========================
// Ausstattung (Whitelist + Labels)
// =========================
const ausstattungen = [
  "abstandsregeltempomat","applecarplay","androidauto","frontscheibenheizung","heckklappe",
  "led","multifunktion","navigation","sitzheizung","rueckfahrkamera","nichtraucher",
  "scheckheft","garantie","mettalic","abs","esp","asr","berganfahrassistent",
  "muedigkeitswarner","spurhalteassistent","totwinkelassistent","notbremsassistent",
  "notrufsystem","verkehrszeichenerkennung","isofixhinten","isofixbeifahrer",
  "scheinwerferreinigung","blendfreiesfernlicht","fernlichtassistent",
  "innenspiegelabblendend","nachtsichtassistent","nebelscheinwerfer","lichtsensor",
  "regensensor","alarmanlage","wegfahrsperre","keylesszv","zentralverriegelung",
  "standheizung","frontscheibebeheizbar","lenkradbeheizbar","einparkhilfeselbstlenkend",
  "kamerahinten","kamera360","sitzheizungvorne","sitzheizunghinten","sitzeelektrisch",
  "sportsitze","armlehne","lordosenstuetze","massagesitze","sitzbelueftung",
  "beifahrersitzumklappbar","elektrfensterheber","elektrspiegel","elektheckklappe",
  "servolenkung","ambientebeleuchtung","lederlenkrad","radio","dab","cd","tv","navi",
  "soundsystem","touchscreen","sprachsteuerung","multifunktionslenkrad",
  "freisprecheinrichtung","usb","bluetooth","wlan","streaming","induktionsladen",
  "bordcomputer","headup","volldigital","alufelgen","sommerreifen","winterreifen",
  "allwetterreifen","reifendruckkontrolle","winterpaket","raucherpaket","sportpaket",
  "sportfahrwerk","luftfederung","gepaeckabtrennung","skisack","schiebedach",
  "panoramadach","dachreling","behindertengerecht","taxi",
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
  multifunktionslenkrad: "Multifunktionslenkrad",
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
  taxi: "Taxi",
};

// =========================
// Kontakt-Popup
// =========================
function openKontaktPopup() {
  document.getElementById("kontaktOverlay")?.classList.add("show");
}
function closeKontaktPopup() {
  document.getElementById("kontaktOverlay")?.classList.remove("show");
}
window.openKontaktPopup = openKontaktPopup;
window.closeKontaktPopup = closeKontaktPopup;

// =========================
// Geo-Suggest (für Kontakt-Ort)
// =========================
function setupGeoSuggest() {
  const ortInput = document.getElementById("kontaktOrtInput");
  const plzInput = document.getElementById("kontaktPlzInput");
  const datalist = document.getElementById("kontaktOrtSuggestions");
  if (!ortInput || !datalist) return;

  let debounceTimer = null;
  let lastItems = [];

  const debounced = (fn, ms) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
  };

  ortInput.addEventListener("input", () => {
    const q = ortInput.value.trim();
    if (q.length < 2) {
      datalist.innerHTML = "";
      lastItems = [];
      return;
    }
    debounced(async () => {
      try {
        const res = await fetch(api(`/api/geosuggest?q=${encodeURIComponent(q)}&limit=6`), {
          credentials: "omit",
        });
        const data = (await res.json().catch(() => ({}))) || {};
        const items = Array.isArray(data.suggestions) ? data.suggestions : [];
        lastItems = items;
        datalist.innerHTML = items.map((s) => `<option value="${s.label}"></option>`).join("");
      } catch {
        datalist.innerHTML = "";
        lastItems = [];
      }
    }, 180);
  });

  // PLZ automatisch setzen
  ortInput.addEventListener("change", () => {
    const val = ortInput.value.trim();
    if (!val) return;
    const hit =
      lastItems.find((x) => x.label === val) ||
      lastItems.find((x) => val.toLowerCase().includes(String(x.city || "").toLowerCase()));
    if (hit?.postcode && !plzInput?.value?.trim()) {
      plzInput.value = hit.postcode;
    }
  });
}

// =========================
// Hauptinitialisierung
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  // ⬅️ NEU: userInfo außerhalb des try verfügbar machen
  let userInfo = null;

  // Nutzerinfo & Zugang
  try {
    const info = await fetch(api("/getNutzerInfo"), { credentials: "include" }).then((r) => r.json());
    if (!info?.eingeloggt || !info?.nutzerId) {
      const ziel = sessionStorage.getItem("verkaeuferTyp") === "haendler" ? "haendler.html" : "privat.html";
      console.warn("⛔ Nicht eingeloggt. Weiterleitung zu:", ziel);
      window.location.href = ziel;
      return;
    }
    userInfo = info; // ⬅️ NEU: merken
    localStorage.setItem("nutzerId", info.nutzerId);
    localStorage.setItem("userRole", info.rolle || "");
    try { updateNavbarTarif(); } catch (e) { console.error("❌ Fehler in updateNavbarTarif:", e); }
  } catch (err) {
    console.error("❌ Fehler beim Abrufen der Nutzerinfo:", err);
    const ziel = sessionStorage.getItem("verkaeuferTyp") === "haendler" ? "haendler.html" : "privat.html";
    window.location.href = ziel;
    return;
  }

  // Lightbox-Gesten
  try { setupLightboxSwipe(); } catch (e) { console.error("❌ Fehler in setupLightboxSwipe:", e); }

  // Beschreibung-Toggle
  try {
    const btn = document.getElementById("toggle-description-btn");
    const description = document.getElementById("car-description");
    if (btn && description) {
      btn.addEventListener("click", () => {
        description.classList.toggle("expanded");
        btn.textContent = description.classList.contains("expanded") ? "Weniger anzeigen" : "Mehr anzeigen";
      });
    }
  } catch (e) {
    console.error("❌ Fehler beim Toggle-Button:", e);
  }

  // Navbar, falls vorhanden
  try { if (typeof window.setupNavbar === "function") window.setupNavbar(); }
  catch (e) { console.error("❌ Fehler in setupNavbar:", e); }

  // Media holen
  await fetchMedia();

  // Fallback-Bilder
  if (mediaItems.length === 0) {
    mediaItems = [
      { type: "img", src: "platzhalter1.jpg" },
      { type: "img", src: "platzhalter2.jpg" },
    ];
  }

  initSlider();
  setMedia(0);
  setupSlider();

  // Kein Auto-Scroll
  setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 100);

  // =========================
  // Preis / Kopfbereich / Basisinfos
  // =========================
  try {
    if (!lastVehicle) {
      // Falls /getVehicleData nichts liefert, nicht crashen
      lastVehicle = {};
    }

    // Preise
    const priceMain = document.getElementById("price-main");
    const priceNet  = document.getElementById("price-net");
    const mwstType  = document.getElementById("mwst-type");
    const priceType = document.getElementById("price-type");

    const mwstRaw = String(lastVehicle.verkauf_mwst || "").trim().toLowerCase();
    const isKeine = mwstRaw.includes("keine");
    const isZzgl  = mwstRaw.includes("zzgl");

    const brutto = toNum(lastVehicle.verkauf_brutto ?? lastVehicle["brutto-preis"]);
    const netto  = toNum(lastVehicle.verkauf_netto  ?? lastVehicle["netto-preis"]);
    const einzel = toNum(lastVehicle.verkauf_preis  ?? lastVehicle.preis);

    let mainPriceNum = NaN;
    if (isKeine) {
      mainPriceNum = Number.isFinite(einzel) ? einzel : NaN;
    } else if (isZzgl) {
      mainPriceNum = Number.isFinite(brutto) ? brutto : Number.isFinite(einzel) ? einzel : NaN;
    } else {
      mainPriceNum = Number.isFinite(brutto) ? brutto : Number.isFinite(einzel) ? einzel : NaN;
    }

    if (priceMain) priceMain.textContent = Number.isFinite(mainPriceNum) ? fmtEUR(mainPriceNum) : "";
    if (priceNet)  priceNet.textContent  = isZzgl && Number.isFinite(netto) ? fmtEUR(netto) : "";
    if (mwstType)  mwstType.textContent  = lastVehicle.verkauf_mwst || (isKeine ? "Keine MwSt." : isZzgl ? "zzgl. MwSt." : "");
    if (priceType) priceType.textContent = isKeine ? "Endpreis" : "Brutto";

    // Titel
    const titleEl = document.getElementById("car-title");
    if (titleEl && lastVehicle.verkauf_modell) titleEl.textContent = lastVehicle.verkauf_modell;

    // ⬅️ KORRIGIERT: Verkäuferlabel robust bestimmen (Session → Seller-Snapshot → Entwurf → localStorage)
    const mapRoleToLabel = (roleOrLabel) => {
      const r = String(roleOrLabel || "").toLowerCase();
      if (r.includes("haendler") || r.includes("händler") || r === "dealer") return "Händler";
      if (r.includes("privat")) return "Privatverkäufer";
      if (roleOrLabel === "Händler" || roleOrLabel === "Privatverkäufer") return roleOrLabel;
      return "";
    };

    const sellerLabel =
      mapRoleToLabel(userInfo?.rolle) ||                              // aus aktueller Session
      mapRoleToLabel(lastVehicle?.seller?.type) ||                    // aus Seller-Snapshot von /getVehicleData
      mapRoleToLabel(lastVehicle?.verkauf_verkaeufer) ||              // aus Entwurf
      mapRoleToLabel(localStorage.getItem("userRole")) ||             // als Fallback localStorage
      "Verkäufer";

    // Kopfbereich-Label
    const sellerTypeEl = document.getElementById("seller-type");
    if (sellerTypeEl) sellerTypeEl.textContent = sellerLabel;

    // Beschreibung mit Toggle (Overflow-Erkennung)
    const descBox  = document.getElementById("car-description-box");
    const descEl   = document.getElementById("car-description");
    const toggleBtn = document.getElementById("toggle-description-btn");
    if (descEl && descBox) {
      const text = String(lastVehicle.fahrzeugbeschreibung || "").replace(/\r\n/g, "\n");
      descEl.textContent = text;
      requestAnimationFrame(() => {
        const needsToggle = descEl.scrollHeight > descEl.clientHeight;
        if (toggleBtn) {
          toggleBtn.style.display = needsToggle ? "inline-block" : "none";
          descBox.classList.remove("expanded");
          toggleBtn.setAttribute("aria-expanded", "false");
          toggleBtn.textContent = "Mehr anzeigen";
          toggleBtn.onclick = () => {
            const open = descBox.classList.toggle("expanded");
            toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
            toggleBtn.textContent = open ? "Weniger anzeigen" : "Mehr anzeigen";
          };
        }
      });
    }

  // =========================
// Weitere Fahrzeug-Infos
// =========================
const ez         = document.getElementById("info-ez");
const km         = document.getElementById("info-km");
const leistungEl = document.getElementById("info-ps"); // nutzt weiter die Stelle "info-ps"
const kraftstoff = document.getElementById("info-kraftstoff");
const getriebe   = document.getElementById("info-getriebe");
const verkaeufer = document.getElementById("info-verkaeufer");

if (ez && lastVehicle?.verkauf_erstzulassung) {
  ez.textContent = lastVehicle.verkauf_erstzulassung;
}
if (km && lastVehicle?.verkauf_kilometer) {
  km.textContent = `${Number(lastVehicle.verkauf_kilometer).toLocaleString("de-DE")} km`;
}

// Leistung: PS + kW zusammen anzeigen (kW wird genutzt, falls vorhanden;
// falls kW fehlt, wird aus PS ≈ PS*0.7355 berechnet, damit die Anzeige komplett ist)
// Leistung: erst Serverwerte, dann LS-Fallback. kW anzeigen, ggf. aus PS ableiten.
if (leistungEl) {
  const psVal = toNum(
    lastVehicle?.verkauf_leistung ??
    lastVehicle?.leistung ??
    localStorage.getItem("details_verkauf_leistung") ??
    localStorage.getItem("details_ps")
  );

  let kwVal = toNum(
    lastVehicle?.verkauf_leistung_kw ??
    lastVehicle?.leistung_kw ??
    localStorage.getItem("details_verkauf_leistung_kw") ??
    localStorage.getItem("details_kw")
  );

  if (!Number.isFinite(kwVal) && Number.isFinite(psVal)) {
    kwVal = Math.round(psVal * 0.7355);
  }

  let txt = "";
  if (Number.isFinite(psVal) && Number.isFinite(kwVal))      txt = `${psVal} PS (${kwVal} kW)`;
  else if (Number.isFinite(psVal))                           txt = `${psVal} PS`;
  else if (Number.isFinite(kwVal))                           txt = `${kwVal} kW`;
  leistungEl.textContent = txt;
}


if (kraftstoff && lastVehicle?.verkauf_kraftstoff) {
  kraftstoff.textContent = lastVehicle.verkauf_kraftstoff;
}
if (getriebe && lastVehicle?.verkauf_getriebe) {
  getriebe.textContent = lastVehicle.verkauf_getriebe;
}

// Verkäufer-Kachel konsistent
if (verkaeufer) verkaeufer.textContent = sellerLabel;
lastVehicle.verkauf_verkaeufer = sellerLabel;

// ===== Innenausstattung & Einparkhilfe in Vorschau einblenden =====
{
  const innenOut = document.getElementById("v-innenausstattung");
  if (innenOut) {
    const mat =
      localStorage.getItem("details_innenmaterial") ||
      lastVehicle?.verkauf_innenmaterial ||
      lastVehicle?.innenmaterial || "";
    const col =
      localStorage.getItem("details_innenfarbe") ||
      lastVehicle?.verkauf_innenfarbe ||
      lastVehicle?.innenfarbe || "";
    const txt = [mat, col].filter(Boolean).join(" / ");
    innenOut.textContent = txt;
  }
}
{
  const eph = document.getElementById("v-einparkhilfe");
  if (eph) {
    const ausLS = localStorage.getItem("details_einparkhilfe") || "";
    const ausDB = lastVehicle?.verkauf_einparkhilfe || lastVehicle?.einparkhilfe || "";
    eph.textContent = ausLS || ausDB || "";
  }
}

// =========================
// Technische Daten (Mapping)
// =========================
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
  // Neue Felder:
  fahrzeugart: "v-fahrzeugart",
  halter: "v-halter",
  fahrtauglich: "v-fahrtauglich",
  beschaedigt: "v-beschaedigt",
  unfall: "v-unfall",
  hu: "v-hu",
  karosseriefarbe: "v-karosseriefarbe",
  airbags: "v-airbags",
  klimatisierung: "v-klimatisierung",
  // Licht (Kurvenlicht NICHT hier – das kommt als Ausstattung)
  scheinwerfer: "v-scheinwerfer",
  tagfahrlicht: "v-tagfahrlicht",
  // ➕ Emissions-/Energieeffizienzklasse direkt anzeigen
  emissionsklasse: "v-emissionsklasse",
  // (optional) falls du kW auch als separate technische Zeile willst:
  // leistung_kw: "v-kw",
};

function pickTechValue(key) {
  const raw =
    // 1) frisch vom Server / Entwurf
    lastVehicle?.[`verkauf_${key}`] ??
    lastVehicle?.[key] ??
    // 2) nur falls oben nichts da ist → lokale Entwurfsreste
    localStorage.getItem("details_" + key) ??
    localStorage.getItem("details_verkauf_" + key) ??
    "";
  const val = String(raw).trim();
  if (!val || val === "-" || /^bitte\s*wähle?n?$/i.test(val) || /^please\s*select$/i.test(val)) return "";
  return val;
}


// Felder ausgeben
for (const key in td) {
  const outEl = document.getElementById(td[key]);
  if (!outEl) continue;
  const value = pickTechValue(key);
  outEl.textContent = value || "–";
}

// =========================
// Emissionsklasse direkt (ohne Berechnung) setzen
// =========================
{
  const el = document.getElementById("v-emissionsklasse");
  if (el) {
    const val =
      localStorage.getItem("details_emissionsklasse") ||
      localStorage.getItem("details_verkauf_emissionsklasse") ||
      lastVehicle?.verkauf_emissionsklasse ||
      lastVehicle?.emissionsklasse || "";
    if (val) el.textContent = val;
  }
}

// =========================
// Ausstattung
// =========================
const ausstattungContainer = document.getElementById("v-ausstattung");
const ausstattungBlock = document.getElementById("ausstattung-block");
if (ausstattungContainer) {
  let hatAusstattung = false;

  // Booleans aus Whitelist rendern
  ausstattungen.forEach((key) => {
    const checked =
      localStorage.getItem("details_" + key) === "true" ||
      localStorage.getItem("details_verkauf_" + key) === "true" ||
      lastVehicle?.[`verkauf_${key}`] === true ||
      lastVehicle?.[key] === true;

    if (checked && ausstattungLabels[key]) {
      const div = document.createElement("div");
      div.classList.add("equipment-item");
      div.innerHTML = `<i class="fas fa-check"></i> ${ausstattungLabels[key]}`;
      ausstattungContainer.appendChild(div);
      hatAusstattung = true;
    }
  });

  // Kurvenlicht (Select-Wert) als Ausstattung ergänzen
  {
    const kl = (
      localStorage.getItem("details_kurvenlicht") ||
      localStorage.getItem("details_verkauf_kurvenlicht") ||
      lastVehicle?.verkauf_kurvenlicht ||
      lastVehicle?.kurvenlicht ||
      ""
    ).trim();
    if (kl) {
      const div = document.createElement("div");
      div.classList.add("equipment-item");
      div.innerHTML = `<i class="fas fa-check"></i> ${kl}`;
      ausstattungContainer.appendChild(div);
      hatAusstattung = true;
    }
  }

  if (hatAusstattung && ausstattungBlock) ausstattungBlock.style.display = "block";

  // Sub-Highlight in der Unterzeile (zufällig aus erlaubter Liste)
  const erlaubteAusstattungen = [
    "Gepäckraumabtrennung", "Skisack", "Schiebedach", "Panorama-Dach", "Dachreling", "Behindertengerecht", "Taxi",
    "Winterpaket", "Raucherpaket", "Sportpaket", "Sportfahrwerk", "Luftfederung", "TV", "Navigationssystem",
    "Soundsystem", "Touchscreen", "Sprachsteuerung", "Multifunktionslenkrad", "Bluetooth", "Apple CarPlay",
    "Android Auto", "WLAN / Wifi Hotspot", "Musikstreaming integriert", "Induktionsladen für Smartphones",
    "Bordcomputer", "Head-up Display", "Volldigitales Kombiinstrument", "Leichtmetallfelgen", "Sommerreifen",
    "Winterreifen", "Allwetterreifen",
  ];

  const subtitle = document.getElementById("car-subtitle");
  if (subtitle) {
    const list = Array.isArray(lastVehicle?.verkauf_ausstattung)
      ? lastVehicle.verkauf_ausstattung
      : [];
    const gefiltert = list.filter((x) => erlaubteAusstattungen.includes(x));
    const pick = (arr, n) => arr.sort(() => 0.5 - Math.random()).slice(0, n);
    const text = gefiltert.length ? pick(gefiltert, 3).join(" • ") : "";
    if (text) subtitle.textContent = text;
  }
}

  } catch (err) {
    console.error("❌ Fehler beim Laden der Vorschau-Daten:", err);
  }

  // =========================
  // Veröffentlichen (Popup + Submit)
  // =========================
  (function setupPublishFlow() {
    let nutzer = null;
    let sellerId = null;

    const publishBtn = document.querySelector(".publish-button");
    const kontaktOverlay = document.getElementById("kontaktOverlay");
    const kontaktForm = document.getElementById("kontaktForm");

    publishBtn?.addEventListener("click", async () => {
      try {
        const info = await fetch(api("/getNutzerInfo"), { credentials: "include" }).then((r) => r.json());
        if (!info?.eingeloggt) {
          alert("❌ Du bist nicht eingeloggt!");
          window.location.href = "login.html";
          return;
        }
        nutzer = info;
        sellerId =
          info.id ||
          info._id ||
          info.userId ||
          info.userid ||
          info.nutzerId ||
          (info.user && (info.user.id || info.user._id)) ||
          null;
        if (!sellerId) {
          console.warn("Konnte sellerId aus /getNutzerInfo nicht ermitteln:", info);
          alert("❌ Verkäufer-ID konnte nicht ermittelt werden. Bitte neu einloggen.");
          return;
        }

        // Felder füllen
        document.getElementById("kontaktNameInput")?.setAttribute("value", info.firma || info.name || "");
        document.getElementById("kontaktStrasseInput")?.setAttribute("value", info.strasse || "");
        document.getElementById("kontaktPlzInput")?.setAttribute("value", info.plz || "");
        document.getElementById("kontaktOrtInput")?.setAttribute("value", info.ort || "");
        document.getElementById("kontaktTelefonInput")?.setAttribute("value", info.telefon || "");

        if (kontaktOverlay) kontaktOverlay.style.display = "flex";
      } catch (err) {
        console.error("Fehler beim Laden der Nutzerdaten:", err);
        alert("❌ Konnte Nutzerdaten nicht laden.");
      }
    });

    kontaktForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!sellerId) {
        alert("❌ Verkäufer-ID fehlt. Bitte Seite neu laden und erneut versuchen.");
        return;
      }

      const kontaktDaten = {
        verkaeuferId: sellerId,
        name: document.getElementById("kontaktNameInput")?.value.trim() || "",
        strasse: document.getElementById("kontaktStrasseInput")?.value.trim() || "",
        plz: document.getElementById("kontaktPlzInput")?.value.trim() || "",
        ort: document.getElementById("kontaktOrtInput")?.value.trim() || "",
        telefon: document.getElementById("kontaktTelefonInput")?.value.trim() || "",
        verkauf_verkaeufer: (nutzer?.rolle === "haendler") ? "Händler" : "Privatverkäufer",
        verkauf_name: document.getElementById("kontaktNameInput")?.value.trim() || "",
        standort: `${document.getElementById("kontaktPlzInput")?.value.trim() || ""} ${document
          .getElementById("kontaktOrtInput")
          ?.value.trim() || ""}`,
      };
      try {
        const isEdit = localStorage.getItem("editMode") === "1";
        const editId = localStorage.getItem("editInseratId");
        const endpoint = isEdit && editId
          ? api(`/veroeffentlichen/${encodeURIComponent(editId)}`)
          : api("/veroeffentlichen");
        const method = isEdit && editId ? "PUT" : "POST";
      
        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(kontaktDaten),
        });
      
        const text = await res.text();
      
        if (res.ok) {
          sessionStorage.setItem("resetWizard", "1");
          try {
            localStorage.removeItem("haendlerSteps");
            localStorage.removeItem("fahrzeugdaten");
            localStorage.removeItem("fahrzeugdetails");
            localStorage.removeItem("medien");
            localStorage.removeItem("editMode");
            localStorage.removeItem("editInseratId");
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith("details_")) localStorage.removeItem(k);
            });
            sessionStorage.removeItem("inseratGestartet");
            sessionStorage.removeItem("hatGespeichert");
          } catch {}
          alert(isEdit ? "✅ Inserat aktualisiert!" : "✅ Inserat veröffentlicht!");
          window.location.href = "übersicht.html";
        } else {
          alert("❌ Fehler beim Veröffentlichen:\n" + text);
        }
      } catch (err) {
        console.error("❌ Netzwerkfehler beim Veröffentlichen:", err);
        alert("Netzwerkfehler beim Veröffentlichen.");
      }
      
    });
  })();

  // Geo-Suggest für Kontaktformular
  setupGeoSuggest();
});






