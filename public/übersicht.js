// uebersicht.js (clean + robust)
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", async () => {

  /* =========================================================
     Helpers
     ========================================================= */

  function formatEUR(value) {
    if (value == null || value === "") return null;
    const num = parseFloat(String(value).replace(/\./g, "").replace(",", "."));
    if (!isNaN(num)) return num.toLocaleString("de-DE") + " €";
    return String(value) + " €";
  }

  function sellerInitials(name = "") {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const ini = parts.map(p => p[0]?.toUpperCase() || "").join("");
    return ini || "AV";
  }

  function extractMongoId(doc) {
    if (!doc) return null;
    if (typeof doc._id === "string") return doc._id;
    if (doc._id && typeof doc._id === "object" && typeof doc._id.$oid === "string") return doc._id.$oid;
    if (typeof doc.id === "string") return doc.id;
    return null;
  }

  function splitErstzulassung(raw) {
    const s = String(raw || "").trim();
    if (!s) return { monat: "", jahr: "" };

    let m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) return { jahr: m[1], monat: m[2] };

    m = s.match(/^(\d{2})\/(\d{4})$/);
    if (m) return { monat: m[1], jahr: m[2] };

    m = s.match(/^(\d{4})\/(\d{2})$/);
    if (m) return { jahr: m[1], monat: m[2] };

    m = s.match(/^(\d{4})$/);
    if (m) return { jahr: m[1], monat: "" };

    return { monat: "", jahr: "" };
  }

  /* =========================================================
     Medien-Slider (EIN System, guard)
     ========================================================= */

  function initMediaSlider(container) {
    if (!container || container.dataset.sliderInit === "1") return;
    container.dataset.sliderInit = "1";

    const slidesWrapper = container.querySelector(".slides");
    if (!slidesWrapper) return;

    const slides = Array.from(slidesWrapper.children);
    if (!slides.length) return;

    const leftBtn  = container.querySelector(".media-arrow.left");
    const rightBtn = container.querySelector(".media-arrow.right");

    const state = {
      currentIndex: 0,
      isDragging: false,
      startX: 0,
      currentTranslate: 0,
      prevTranslate: 0,
      rafId: null,
    };

    slidesWrapper.style.display = "flex";
    slidesWrapper.style.willChange = "transform";

    slides.forEach(slide => {
      slide.style.flex = "0 0 100%";
      slide.style.minWidth = "100%";
    });

    function setTransition(on) {
      slidesWrapper.style.transition = on ? "transform 0.28s ease" : "none";
    }

    function setSliderPosition() {
      slidesWrapper.style.transform = `translateX(${state.currentTranslate}px)`;
    }

    function updateSlidePosition() {
      const w = container.clientWidth || 0;
      state.currentTranslate = -state.currentIndex * w;
      state.prevTranslate = state.currentTranslate;
      setTransition(true);
      setSliderPosition();
    }

    function onPointerDown(e) {
      state.isDragging = true;
      state.startX = e.clientX;
      setTransition(false);
      try { slidesWrapper.setPointerCapture(e.pointerId); } catch {}
      state.rafId = requestAnimationFrame(animation);
    }

    function onPointerMove(e) {
      if (!state.isDragging) return;
      const dx = e.clientX - state.startX;
      state.currentTranslate = state.prevTranslate + dx;
    }

    function onPointerUp(e) {
      if (!state.isDragging) return;
      state.isDragging = false;
      try { slidesWrapper.releasePointerCapture(e.pointerId); } catch {}
      cancelAnimationFrame(state.rafId);

      const movedBy = state.currentTranslate - state.prevTranslate;
      const threshold = Math.min(80, (container.clientWidth || 0) * 0.18);

      if (movedBy < -threshold && state.currentIndex < slides.length - 1) {
        state.currentIndex++;
      } else if (movedBy > threshold && state.currentIndex > 0) {
        state.currentIndex--;
      }

      updateSlidePosition();
    }

    function animation() {
      setSliderPosition();
      if (state.isDragging) state.rafId = requestAnimationFrame(animation);
    }

    slidesWrapper.addEventListener("pointerdown", onPointerDown);
    slidesWrapper.addEventListener("pointermove", onPointerMove);
    slidesWrapper.addEventListener("pointerup", onPointerUp);
    slidesWrapper.addEventListener("pointerleave", onPointerUp);
    slidesWrapper.addEventListener("pointercancel", onPointerUp);

    leftBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.currentIndex > 0) {
        state.currentIndex--;
        updateSlidePosition();
      }
    });
    rightBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.currentIndex < slides.length - 1) {
        state.currentIndex++;
        updateSlidePosition();
      }
    });

    window.addEventListener("resize", updateSlidePosition);
    updateSlidePosition();
  }

  function initAllSliders(root = document) {
    root.querySelectorAll(".media-container").forEach(initMediaSlider);
  }

  function markPortraitMedia(root = document) {
    root.querySelectorAll(".slide").forEach(media => {
      if (media.tagName === "VIDEO") {
        media.addEventListener("loadedmetadata", () => {
          if (media.videoHeight > media.videoWidth) media.classList.add("portrait-zoom");
        }, { once: true });
      } else if (media.tagName === "IMG") {
        media.addEventListener("load", () => {
          if (media.naturalHeight > media.naturalWidth) media.classList.add("portrait-zoom");
        }, { once: true });
      }
    });
  }

  /* =========================================================
     Navbar / Dropdowns (KLICK ONLY)
     ========================================================= */

  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function closeAllDropdowns(except = null) {
    dropdownLis.forEach(li => {
      if (li === except) return;
      li.classList.remove("open");

      const trigger = li.querySelector('a[aria-haspopup="true"]');
      const menu    = li.querySelector(".dropdown-menu");

      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (menu) {
        menu.classList.remove("show");
        menu.style.left = "";
        [...menu.children].forEach(item => (item.style.transitionDelay = ""));
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

    const center = tRect.left + tRect.width / 2;
    let leftAbs = center - mRect.width / 2;
    leftAbs = clamp(leftAbs, 16, vw - mRect.width - 16);

    const relLeft = leftAbs - liRect.left;
    menu.style.left = `${relLeft}px`;
  }

  function openDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
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
    li.classList.contains("open") ? closeAllDropdowns() : openDropdown(trigger);
  }

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

  document.addEventListener("click", () => {
    navLinks?.classList.remove("active");
    closeAllDropdowns();
  });

  const repositionOpen = () =>
    document.querySelectorAll(".dropdown.open").forEach(positionMenu);

  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  /* =========================================================
     Login-abhängige Weiterleitungen (Navbar -> Tabs)
     ========================================================= */

  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");
  const soldCarsLink  = document.getElementById("sold-cars-link");
  const messagesLink  = document.getElementById("messages-link");

  function checkLoginAndRedirect(targetHash) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data?.eingeloggt) {
          window.location.href = `übersicht.html${targetHash}`;
        } else {
          localStorage.setItem("redirectAfterLogin", `übersicht.html${targetHash}`);
          window.location.href = "login.html";
        }
      })
      .catch(() => {
        localStorage.setItem("redirectAfterLogin", `übersicht.html${targetHash}`);
        window.location.href = "login.html";
      });
  }

  savedCarsLink?.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("#saved-cars"); });
  myCarsLink?.addEventListener("click",    (e) => { e.preventDefault(); checkLoginAndRedirect("#car-list"); });
  soldCarsLink?.addEventListener("click",  (e) => { e.preventDefault(); checkLoginAndRedirect("#sold-cars"); });
  messagesLink?.addEventListener("click",  (e) => { e.preventDefault(); checkLoginAndRedirect("#messages-list"); });

  /* =========================================================
     Sidebar/Tabs + Hash
     ========================================================= */

  const sidebarLinks = document.querySelectorAll(".sidebar-link");
  const titleEl      = document.querySelector(".title");

  const sections = {
    "car-list":      document.querySelector(".car-list"),
    "messages-list": document.querySelector("#messages-list"),
    "saved-cars":    document.querySelector("#saved-cars"),
    "sold-cars":     document.querySelector("#sold-cars"),
  };

  const chatButton = `
    <a href="chat.html" class="all-chats-btn" style="margin-left:auto;">
      <i class="fas fa-envelope-open-text"></i> Alle Chats anzeigen
    </a>`;

  function showSection(sectionName) {
    Object.values(sections).forEach(section => {
      if (!section) return;
      section.classList.add("hidden");
      section.classList.remove("visible");
    });

    const target = sections[sectionName];
    if (target) {
      target.classList.remove("hidden");
      target.classList.add("visible");
    }

    const profileSection = document.querySelector(".profile-section");
    if (profileSection) {
      sectionName === "car-list"
        ? profileSection.classList.remove("hidden")
        : profileSection.classList.add("hidden");
    }

    const body = document.body;
    if (body) {
      body.classList.remove("meine-autos-seite", "nachrichten-seite", "gespeicherte-autos-seite");
      switch (sectionName) {
        case "messages-list":
          body.classList.add("nachrichten-seite");
          break;
        case "saved-cars":
          body.classList.add("gespeicherte-autos-seite");
          break;
        default:
          body.classList.add("meine-autos-seite");
      }
    }
  }

  function updateTitle(section) {
    if (!titleEl) return;
    switch (section) {
      case "car-list":
        titleEl.innerHTML = '<i class="fas fa-car"></i> Meine Autos';
        break;
      case "messages-list":
        titleEl.innerHTML = '<i class="fas fa-comments"></i> Nachrichten' + chatButton;
        break;
      case "saved-cars":
        titleEl.innerHTML = '<i class="fas fa-heart"></i> Gespeicherte Autos';
        break;
      case "sold-cars":
        titleEl.innerHTML = '<i class="fas fa-check-circle"></i> Verkaufte Autos';
        break;
      default:
        titleEl.innerHTML = '<i class="fas fa-car"></i> Meine Autos';
    }
  }

  function setActiveSidebar(section) {
    sidebarLinks.forEach(li => {
      li.classList.toggle("active", li.dataset.section === section);
    });
  }

  function sectionFromHash(h) {
    switch ((h || "").toLowerCase()) {
      case "#messages-list":
      case "#chats":
      case "#nachrichten":
        return "messages-list";
      case "#saved-cars":
      case "#saved":
        return "saved-cars";
      case "#sold-cars":
      case "#sold":
        return "sold-cars";
      case "#car-list":
      case "#my-cars":
      default:
        return "car-list";
    }
  }

  /* =========================================================
     Slides / Edit-Builds
     ========================================================= */

  function generateSlides(inserat) {
    const imgs =
      Array.isArray(inserat.images) ? inserat.images :
      Array.isArray(inserat.bilder) ? inserat.bilder :
      [];

    const vids =
      Array.isArray(inserat.videos) ? inserat.videos :
      (inserat.video ? [inserat.video] : []);

    const slides = [];

    imgs.forEach(url => {
      slides.push(`<img src="${url}" alt="Bild" class="slide" loading="lazy">`);
    });

    vids.forEach(url => {
      if (!url) return;
      slides.push(`
        <video class="slide" controls muted playsinline preload="metadata">
          <source src="${url}" type="video/mp4">
        </video>
      `);
    });

    return slides.join("");
  }

  function buildFahrzeugdatenFromInserat(ins) {
    const marke  = ins.marke || ins.verkauf_marke || "";
    const modell = ins.modell || ins.verkauf_modell || "";
    const titel  = ins.titel || ins.verkauf_titel || ins.verkauf_modell || `${marke} ${modell}`.trim();

    const preisNet = ins.preis || ins.verkauf_preis || "";
    const brutto   = ins["brutto-preis"] || ins.verkauf_brutto || "";
    const netto    = ins["netto-preis"]  || ins.verkauf_netto  || "";

    const ezRaw = ins.verkauf_erstzulassung || ins.erstzulassung || "";
    const { monat, jahr } = splitErstzulassung(ezRaw);

    const mwstFlag = Boolean(ins.verkauf_mwst || brutto);

    return {
      titel, marke, modell,

      preis: preisNet,
      "mwst-ausweisbar": mwstFlag ? "1" : "",
      "brutto-preis": brutto,
      "netto-preis": netto,

      verkauf_preis:  ins.verkauf_preis  || preisNet || "",
      verkauf_brutto: ins.verkauf_brutto || brutto   || "",
      verkauf_netto:  ins.verkauf_netto  || netto    || "",
      verkauf_mwst:   ins.verkauf_mwst   || (mwstFlag ? "1" : ""),

      verkauf_erstzulassung: ezRaw,
      erstzulassung: ezRaw,
      verkauf_ez_monat: monat,
      verkauf_ez_jahr:  jahr,

      kilometer:         ins.kilometer ?? ins.verkauf_kilometer ?? "",
      verkauf_kilometer: ins.verkauf_kilometer ?? ins.kilometer ?? "",

      leistung_ps:        ins.leistung_ps ?? ins.verkauf_leistung ?? ins.leistung ?? "",
      leistung_kw:        ins.leistung_kw ?? ins.verkauf_leistung_kw ?? "",
      verkauf_leistung:    ins.verkauf_leistung ?? ins.leistung_ps ?? ins.leistung ?? "",
      verkauf_leistung_kw: ins.verkauf_leistung_kw ?? ins.leistung_kw ?? "",

      hubraum:         ins.hubraum ?? ins.verkauf_hubraum ?? "",
      verkauf_hubraum: ins.verkauf_hubraum ?? ins.hubraum ?? "",

      kraftstoff:         ins.kraftstoff || ins.verkauf_kraftstoff || "",
      verkauf_kraftstoff: ins.verkauf_kraftstoff || ins.kraftstoff || "",

      getriebe:           ins.getriebe || ins.verkauf_getriebe || "",
      verkauf_getriebe:   ins.verkauf_getriebe || ins.getriebe || "",

      antriebsart:        ins.antriebsart || ins.antrieb || ins.verkauf_antrieb || "",
      verkauf_antrieb:    ins.verkauf_antrieb || ins.antriebsart || ins.antrieb || "",

      fahrzeugtyp:         ins.fahrzeugtyp || ins.verkauf_fahrzeugtyp || "",
      verkauf_fahrzeugtyp: ins.verkauf_fahrzeugtyp || ins.fahrzeugtyp || "",

      tueren:         ins.tueren || ins["türen"] || ins.türen || ins.verkauf_tueren || "",
      "türen":        ins["türen"] || ins.türen || ins.tueren || "",
      verkauf_tueren: ins.verkauf_tueren || ins.tueren || ins["türen"] || ins.türen || "",

      partikelfilter:         ins.partikelfilter || ins.verkauf_partikelfilter || "",
      verkauf_partikelfilter: ins.verkauf_partikelfilter || ins.partikelfilter || "",

      verbrauch_kombiniert: ins.verbrauch_kombiniert || ins.verkauf_verbrauch_kombiniert || "",
      verbrauch_innerorts:  ins.verbrauch_innerorts  || ins.verkauf_verbrauch_innerorts  || "",
      verbrauch_ausserorts: ins.verbrauch_ausserorts || ins.verkauf_verbrauch_ausserorts || "",
      co2_emission:         ins.co2_emission         || ins.verkauf_co2_emission         || "",

      verkauf_verbrauch_kombiniert: ins.verkauf_verbrauch_kombiniert || ins.verbrauch_kombiniert || "",
      verkauf_verbrauch_innerorts:  ins.verkauf_verbrauch_innerorts  || ins.verbrauch_innerorts  || "",
      verkauf_verbrauch_ausserorts: ins.verkauf_verbrauch_ausserorts || ins.verbrauch_ausserorts || "",
      verkauf_co2_emission:         ins.verkauf_co2_emission         || ins.co2_emission         || "",

      schadstoffklasse: ins.schadstoffklasse || ins.verkauf_schadstoffklasse || "",
      umweltplakette:  ins.umweltplakette  || ins.verkauf_umweltplakette  || "",
      emissionsklasse: ins.emissionsklasse || ins.verkauf_emissionsklasse || "",

      verkauf_schadstoffklasse: ins.verkauf_schadstoffklasse || ins.schadstoffklasse || "",
      verkauf_umweltplakette:   ins.verkauf_umweltplakette   || ins.umweltplakette  || "",
      verkauf_emissionsklasse:  ins.verkauf_emissionsklasse  || ins.emissionsklasse || "",

      verkauf_verkaeufer: ins.verkauf_verkaeufer || ""
    };
  }

  function buildFahrzeugdetailsFromInserat(ins) {
    const merkmale =
      Array.isArray(ins.merkmale) ? ins.merkmale :
      Array.isArray(ins.ausstattung) ? ins.ausstattung :
      Array.isArray(ins.verkauf_ausstattung) ? ins.verkauf_ausstattung :
      [];

    return {
      titel: ins.titel || ins.verkauf_titel || "",
      kurzbeschreibung: ins.kurzbeschreibung || ins.verkauf_kurzbeschreibung || "",
      beschreibung: ins.beschreibung || ins.verkauf_beschreibung || "",
      farbe: ins.farbe || ins.verkauf_farbe || "",
      merkmale,
      ausstattung: merkmale,
      ...ins,
      merkmale,
      ausstattung: merkmale
    };
  }

  function buildMedienFromInserat(ins) {
    const images =
      Array.isArray(ins.images) ? ins.images :
      Array.isArray(ins.bilder) ? ins.bilder :
      Array.isArray(ins.mediaImages) ? ins.mediaImages :
      [];

    const videosArr =
      Array.isArray(ins.videos) ? ins.videos :
      Array.isArray(ins.mediaVideos) ? ins.mediaVideos :
      [];

    const singleVideo = ins.video || "";
    const videos = videosArr.length ? videosArr : (singleVideo ? [singleVideo] : []);

    return {
      images,
      videos,
      bilder: images,
      video: singleVideo,
      media: [
        ...images.map(url => ({ type: "image", url })),
        ...videos.map(url => ({ type: "video", url }))
      ]
    };
  }

  /* =========================================================
     Profilbereich rendern (deine Version nutzen)
     ========================================================= */

  function renderProfileSection(nutzerData, drafts, online) {
    const section = document.querySelector(".profile-section");
    if (!section || !nutzerData) return;

    const roleRaw = (nutzerData.role || nutzerData.rolle || "privat").toLowerCase();
    const isHaendler =
      roleRaw.includes("händ") ||
      roleRaw.includes("haend") ||
      roleRaw === "haendler" ||
      roleRaw === "haendlerkonto";

    section.classList.toggle("profile--haendler", isHaendler);
    section.classList.toggle("profile--privat", !isHaendler);

    const displayName = isHaendler
      ? (nutzerData.firma || nutzerData.name || "Dein Autohaus")
      : (nutzerData.name || "Dein Profil");

    section.querySelector(".profile-name")?.textContent = displayName;
    section.querySelector(".profile-initials")?.textContent = sellerInitials(displayName);

    const logoWrapper = section.querySelector(".profile-logo-wrapper");
    const logoImg = section.querySelector(".profile-logo");
    const logoUrl = nutzerData.logoUrl || "";

    if (logoImg && logoWrapper) {
      if (logoUrl) {
        logoImg.src = logoUrl;
        logoImg.alt = displayName + " Logo";
        logoWrapper.classList.add("has-logo");
      } else {
        logoImg.removeAttribute("src");
        logoWrapper.classList.remove("has-logo");
      }
    }

    const locParts = [];
    if (nutzerData?.plz) locParts.push(String(nutzerData.plz).trim());
    if (nutzerData?.ort) locParts.push(String(nutzerData.ort).trim());
    const location =
      locParts.filter(Boolean).join(" ") ||
      String(nutzerData?.standort || "").trim();

    section.querySelector('[data-profile-field="location"]')?.textContent =
      location || "Ort noch nicht hinterlegt";

    section.querySelector('[data-profile-field="role"]')?.textContent =
      isHaendler ? "Händlerkonto" : "Privatkonto";

    const memberEl = section.querySelector('[data-profile-field="memberSince"]');
    const createdRaw = nutzerData.erstelltAm || nutzerData.createdAt || nutzerData.created || null;
    if (memberEl && createdRaw) {
      const d = new Date(createdRaw);
      if (!isNaN(d.getTime())) {
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        memberEl.textContent = `Bei Autovisa seit ${month}/${year}`;
      }
    }

    const addressEl = section.querySelector('[data-profile-field="address"]');
    if (addressEl) {
      const lines = [];
      const streetParts = [];
      if (nutzerData.strasse) streetParts.push(nutzerData.strasse);
      if (nutzerData.hausnummer) streetParts.push(nutzerData.hausnummer);
      if (streetParts.length) lines.push(streetParts.join(" "));
      const plzOrt = [];
      if (nutzerData.plz) plzOrt.push(nutzerData.plz);
      if (nutzerData.ort) plzOrt.push(nutzerData.ort);
      if (plzOrt.length) lines.push(plzOrt.join(" "));
      if (!lines.length && nutzerData.adresse) lines.push(nutzerData.adresse);

      addressEl.textContent = lines.length ? lines.join(", ") : "Noch keine Adresse hinterlegt";
    }

    const phoneEl = section.querySelector('[data-profile-field="phone"]');
    if (phoneEl) {
      const phone = nutzerData.telefon || nutzerData.phone || nutzerData.tel || nutzerData.telefonnummer || "";
      phoneEl.textContent = phone || "–";
    }

    const emailEl = section.querySelector('[data-profile-field="email"]');
    if (emailEl) {
      const email = nutzerData.email || nutzerData.mail || "";
      emailEl.textContent = "";
      if (email) {
        const a = document.createElement("a");
        a.href = `mailto:${email}`;
        a.textContent = email;
        emailEl.appendChild(a);
      } else {
        emailEl.textContent = "–";
      }
    }

    const websiteEl = section.querySelector('[data-profile-field="website"]');
    if (websiteEl) {
      const url = nutzerData.website || nutzerData.webseite || nutzerData.homepage || nutzerData.url || "";
      websiteEl.textContent = "";
      if (url) {
        const a = document.createElement("a");
        a.href = url.startsWith("http") ? url : `https://${url}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = url.replace(/^https?:\/\//i, "");
        websiteEl.appendChild(a);
      } else {
        websiteEl.textContent = "–";
      }
    }

    const openingEl = section.querySelector('[data-profile-field="openingHours"]');
    if (openingEl) {
      const text = nutzerData.oeffnungszeiten || nutzerData["öffnungszeiten"] || "";
      openingEl.textContent = text || openingEl.textContent || "Noch keine Öffnungszeiten hinterlegt.";
    }

    section.querySelectorAll(".haendler-only").forEach(el => {
      el.style.display = isHaendler ? "" : "none";
    });

    const activeCount = Array.isArray(online) ? online.length : 0;
    const draftCount  = Array.isArray(drafts) ? drafts.length : 0;

    section.querySelector('[data-stat="active"]')?.textContent = String(activeCount);
    section.querySelector('[data-stat="drafts"]')?.textContent = String(draftCount);
    section.querySelector('[data-stat="total"]')?.textContent  = String(activeCount + draftCount);
  }

  /* =========================================================
     Profil: Inline bearbeiten (deine Logik)
     ========================================================= */

  function enableProfileInlineEditing() {
    const editableGroups = document.querySelectorAll(
      ".profile-info-row.is-editable, .profile-opening-wrapper.is-editable"
    );

    editableGroups.forEach(group => {
      const valueEl =
        group.querySelector(".profile-info-value") ||
        group.querySelector(".profile-opening-text");
      const btn = group.querySelector(".profile-edit-inline");

      if (!valueEl || !btn) return;

      const fieldKey = valueEl.dataset.profileField;
      if (!fieldKey) return;

      function enterEditMode() {
        group.classList.add("is-editing");
        valueEl.setAttribute("contenteditable", "true");
        const range = document.createRange();
        range.selectNodeContents(valueEl);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        valueEl.focus();
      }

      function exitEditMode(save) {
        group.classList.remove("is-editing");
        valueEl.setAttribute("contenteditable", "false");

        if (save) {
          const newValue = valueEl.textContent.trim();
          saveProfileField(fieldKey, newValue);
        }
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        group.classList.contains("is-editing")
          ? exitEditMode(true)
          : enterEditMode();
      });

      valueEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          exitEditMode(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          exitEditMode(false);
        }
      });

      valueEl.addEventListener("blur", () => {
        if (group.classList.contains("is-editing")) exitEditMode(true);
      });
    });
  }

  async function saveProfileField(field, value) {
    try {
      const res = await fetch("/profil/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ field, value }),
      });

      if (!res.ok) {
        const msg = await res.text();
        console.error("Profil-Update fehlgeschlagen:", msg);
      }
    } catch (err) {
      console.error("Netzwerkfehler beim Profil-Update:", err);
    }
  }

  /* =========================================================
     Meine Autos laden + rendern
     ========================================================= */

  const carList = document.querySelector(".car-list");
  let nutzerData = null;

  async function loadMeineAutos() {
    if (!carList) return;

    const nutzerRes = await fetch("/getNutzerInfo", { credentials: "include" });
    nutzerData = await nutzerRes.json();

    if (!nutzerData?.eingeloggt || !nutzerData?.nutzerId) {
      alert("❌ Du bist nicht eingeloggt. Bitte logge dich zuerst ein.");
      window.location.href = "login.html";
      return;
    }

    const [draftRes, onlineRes] = await Promise.all([
      fetch("/getVehicleData", { credentials: "include" }),
      fetch("/meine-inserate", { credentials: "include" })
    ]);

    const drafts = await draftRes.json();
    const online = await onlineRes.json();

    renderProfileSection(nutzerData, drafts, online);
    enableProfileInlineEditing();

    const items = [
      ...(Array.isArray(drafts) ? drafts.map(d => ({ ...d, __status: "draft" })) : []),
      ...(Array.isArray(online) ? online.map(o => ({ ...o, __status: "online" })) : [])
    ];

    if (!items.length) {
      carList.innerHTML = "<p>Keine Inserate gefunden.</p>";
      return;
    }

    carList.innerHTML = items.map(inserat => {
      const realId = extractMongoId(inserat) || "";
      const isOnline = inserat.__status === "online";

      const publishBtnLabel = isOnline ? "Online" : "Veröffentlichen";
      const publishBtnAttrs = isOnline
        ? 'disabled class="publish-btn published"'
        : 'class="publish-btn"';

      const sellerName =
        inserat?.seller?.name ||
        inserat?.verkauf_name ||
        nutzerData?.firma ||
        nutzerData?.name ||
        "Anbieter";

      const sellerLocation =
        inserat?.standort ||
        [inserat?.plz, inserat?.ort].filter(Boolean).join(" ") ||
        "Standort nicht angegeben";

      return `
        <div class="car-card-wrapper" data-id="${realId}" data-status="${inserat.__status || ""}">
          <div class="car-card-actions mobile-only">
            <button ${publishBtnAttrs}><i class="fas fa-globe"></i> ${publishBtnLabel}</button>
            <button class="edit-btn"><i class="fas fa-pen"></i> Bearbeiten</button>
            <button class="remove-saved-btn"><i class="fas fa-trash"></i> Entfernen</button>
          </div>

          <div class="car-card horizontal">
            <div class="car-card-media">
              <div class="media-container">
                <div class="slides">
                  ${generateSlides(inserat)}
                </div>
                <button class="media-arrow left" type="button"><i class="fas fa-chevron-left"></i></button>
                <button class="media-arrow right" type="button"><i class="fas fa-chevron-right"></i></button>
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
                    <span class="dealer-initials">${sellerInitials(sellerName)}</span>
                  </div>
                  <div class="dealer-meta">
                    <div class="dealer-name">${sellerName}</div>
                    <div class="dealer-location">${sellerLocation}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="car-card-actions desktop-only">
            <button ${publishBtnAttrs}><i class="fas fa-globe"></i> ${publishBtnLabel}</button>
            <button class="edit-btn"><i class="fas fa-pen"></i> Bearbeiten</button>
            <button class="remove-saved-btn"><i class="fas fa-trash"></i> Entfernen</button>
          </div>
        </div>
      `;
    }).join("");

    // ✅ WICHTIG: erst NACH dem Rendern!
    initAllSliders(carList);
    markPortraitMedia(carList);
  }

  /* =========================================================
     Event Delegation: Publish / Remove / Edit / Card-Click
     ========================================================= */

  document.addEventListener("click", async (e) => {
    const wrapper = e.target.closest(".car-card-wrapper");

    // ---- Publish
    const publishBtn = e.target.closest(".publish-btn");
    if (publishBtn && wrapper) {
      e.preventDefault();
      e.stopPropagation();

      const inseratId = wrapper.dataset.id;
      const status    = wrapper.dataset.status;

      if (status !== "draft") return;

      if (!inseratId || !/^[a-f\d]{24}$/i.test(inseratId)) {
        alert("❌ Ungültige Inserat-ID.");
        return;
      }

      try {
        const res = await fetch("/inserat-veroeffentlichen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: inseratId })
        });

        const text = await res.text();

        if (res.ok) {
          publishBtn.innerHTML = `<i class="fas fa-globe"></i> Online`;
          publishBtn.classList.add("published");
          publishBtn.disabled = true;
          wrapper.dataset.status = "online";
          alert("✅ Inserat ist jetzt online!");
        } else {
          alert("❌ Fehler: " + text);
        }
      } catch (err) {
        console.error(err);
        alert("❌ Netzwerkfehler beim Veröffentlichen.");
      }
      return;
    }

    // ---- Remove (UI)
    const removeBtn = e.target.closest(".remove-saved-btn");
    if (removeBtn && wrapper) {
      e.preventDefault();
      e.stopPropagation();
      if (confirm("Möchtest du dieses Fahrzeug wirklich entfernen?")) {
        wrapper.remove();
      }
      return;
    }

    // ---- Edit
    const editBtn = e.target.closest(".edit-btn");
    if (editBtn && wrapper) {
      e.preventDefault();
      e.stopPropagation();

      const realId = wrapper.dataset.id || "";

      try {
        localStorage.setItem("editMode", "1");
        if (realId) localStorage.setItem("editInseratId", realId);

        const [draftRes, onlineRes] = await Promise.all([
          fetch("/getVehicleData", { credentials: "include" }),
          fetch("/meine-inserate", { credentials: "include" })
        ]);
        const drafts = await draftRes.json();
        const online = await onlineRes.json();
        const all = [...(Array.isArray(drafts) ? drafts : []), ...(Array.isArray(online) ? online : [])];
        const inserat = all.find(x => extractMongoId(x) === realId) || null;

        if (inserat) {
          localStorage.setItem("fahrzeugdaten", JSON.stringify(buildFahrzeugdatenFromInserat(inserat)));
          localStorage.setItem("fahrzeugdetails", JSON.stringify(buildFahrzeugdetailsFromInserat(inserat)));
          localStorage.setItem("medien", JSON.stringify(buildMedienFromInserat(inserat)));
        }

        sessionStorage.setItem("inseratGestartet", "true");
        sessionStorage.setItem("hatGespeichert", "true");
      } catch {}

      const roleRaw = String(nutzerData?.role || nutzerData?.rolle || "privat").toLowerCase();
      const isHaendlerUser = roleRaw.includes("haend") || roleRaw.includes("händ");

      const ziel = isHaendlerUser ? "haendler.html" : "privat.html";
      window.location.href = realId
        ? `${ziel}?edit=${encodeURIComponent(realId)}`
        : `${ziel}?edit=1`;

      return;
    }

    // ---- Card Click -> Anzeige
    if (wrapper) {
      const isActionButton = e.target.closest(".car-card-actions button");
      const isArrow = e.target.closest(".media-arrow");
      if (isActionButton || isArrow) return;

      window.location.href = "anzeige.html";
    }
  });

  /* =========================================================
     Nachrichten-Bereich (deine bestehende Logik)
     ========================================================= */

  async function getLoggedInUser() {
    const r = await fetch("/getNutzerInfo", { credentials: "include" });
    const u = await r.json();
    if (!u?.eingeloggt || !u?.nutzerId) throw new Error("Nicht eingeloggt");
    return u;
  }

  async function fetchInseratDetails(id) {
    try {
      const r = await fetch(`/inserat-details/${encodeURIComponent(id)}`, { credentials: "include" });
      if (!r.ok) throw new Error("404");
      return await r.json();
    } catch {
      return {
        titel: "Inserat nicht gefunden",
        preis: null,
        images: [],
        verkauf_kurzbeschreibung: "",
        verkauf_kilometer: "—",
        verkauf_erstzulassung: "—",
        verkauf_kraftstoff: "—",
        verkauf_leistung: "—",
        verkauf_getriebe: "—",
        verkauf_verbrauch_kombiniert: "—",
        verkauf_name: "",
        standort: ""
      };
    }
  }

  async function fetchInbox(empfaengerId) {
    const r = await fetch(`/nachrichten/${encodeURIComponent(empfaengerId)}`, { credentials: "include" });
    if (!r.ok) throw new Error("Fehler beim Abrufen der Nachrichten");
    return await r.json();
  }

  function renderMessageCard(msg, ins, currentUserId) {
    const firstImg = Array.isArray(ins.images) && ins.images[0] ? ins.images[0] : null;

    const preis = ins.preis != null
      ? (typeof ins.preis === "number"
        ? ins.preis.toLocaleString("de-DE") + " €"
        : String(ins.preis))
      : "";

    const chatUrl =
      `chat.html?user1=${encodeURIComponent(currentUserId)}&user2=${encodeURIComponent(msg.senderId)}&fahrzeugId=${encodeURIComponent(msg.fahrzeugId)}`;

    return `
      <div class="car-card-wrapper" data-msg-id="${msg.id}">
        <div class="car-card horizontal">
          <div class="car-card-media">
            <div class="media-container">
              <div class="slides">
                ${firstImg ? `<img src="${firstImg}" alt="Bild" class="slide" />` : ""}
              </div>
            </div>
          </div>
          <div class="car-details">
            <div class="car-top-row">
              <h2 class="car-title">${ins.titel || "Ohne Titel"}</h2>
              <p class="car-price">${preis || ""}</p>
            </div>
            <p class="car-subtitle">${ins.verkauf_kurzbeschreibung || ""}</p>
          </div>
        </div>

        <div class="car-card-actions desktop-only">
          <p class="interested-user">
            <i class="fas fa-user"></i>
            Nachricht von <strong>${msg.absenderName || "Unbekannt"}</strong>
          </p>
          <a href="${chatUrl}" class="chat-btn"><i class="fas fa-comments"></i> Zum Chat</a>
          <button class="mark-read-btn" data-id="${msg.id}">
            <i class="fas fa-check"></i> Als gelesen
          </button>
        </div>

        <div class="car-card-actions mobile-only">
          <p class="interested-user">
            <i class="fas fa-user"></i>
            Nachricht von <strong>${msg.absenderName || "Unbekannt"}</strong>
          </p>
          <a href="${chatUrl}" class="chat-btn"><i class="fas fa-comments"></i> Zum Chat</a>
          <button class="mark-read-btn" data-id="${msg.id}">
            <i class="fas fa-check"></i> Als gelesen
          </button>
        </div>
      </div>
    `;
  }

  async function loadMessagesSection() {
    const messagesSection =
      document.querySelector(".messages-list") ||
      document.querySelector("#messages-list");

    if (!messagesSection) return;

    try {
      const user = await getLoggedInUser();
      const inbox = await fetchInbox(user.nutzerId);

      if (!Array.isArray(inbox) || inbox.length === 0) {
        messagesSection.innerHTML = `<p>Keine Nachrichten vorhanden.</p>`;
        return;
      }

      const detailsMap = new Map();
      const uniqueFahrzeuge = [...new Set(inbox.map(m => m.fahrzeugId))];

      await Promise.all(uniqueFahrzeuge.map(async (fid) => {
        const det = await fetchInseratDetails(fid);
        detailsMap.set(fid, det);
      }));

      inbox.sort((a, b) => new Date(b.zeit) - new Date(a.zeit));

      messagesSection.innerHTML = inbox.map(msg => {
        const ins = detailsMap.get(msg.fahrzeugId) || {};
        return renderMessageCard(msg, ins, user.nutzerId);
      }).join("");

    } catch (e) {
      console.error(e);
      if (messagesSection) messagesSection.innerHTML = `<p>Fehler beim Laden der Nachrichten.</p>`;
    }
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".mark-read-btn");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    try {
      const r = await fetch(`/nachrichten/${encodeURIComponent(id)}/gelesen`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });

      if (r.ok) {
        btn.textContent = "Gelesen";
        btn.disabled = true;
        btn.classList.add("is-read");
      } else {
        const t = await r.text();
        alert("Konnte nicht als gelesen markieren: " + t);
      }
    } catch {
      alert("Netzwerkfehler.");
    }
  });

  function applyHash() {
    const section = sectionFromHash(location.hash);
    setActiveSidebar(section);
    showSection(section);
    updateTitle(section);

    if (section === "messages-list") {
      loadMessagesSection();
    }
  }

  sidebarLinks.forEach(link => {
    link.addEventListener("click", () => {
      const selected = link.dataset.section;
      if (selected && location.hash !== `#${selected}`) {
        history.replaceState(null, "", `#${selected}`);
      }
      applyHash();
    });
  });

  window.addEventListener("hashchange", applyHash);

  /* =========================================================
     Boot
     ========================================================= */

  try {
    await loadMeineAutos();
  } catch (err) {
    console.error("Fehler beim Laden der Inserate:", err);
  }

  applyHash();
});