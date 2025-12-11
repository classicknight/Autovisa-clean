


// uebersicht.js (klick-only, kein Hover-Open)
document.documentElement.classList.remove('no-js');

document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Medien-Slider (Swipe/Click)
     ========================= */
  function initMediaSlider(container) {
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
    slides.forEach(slide => {
      slide.style.flex = "0 0 100%";
      slide.style.minWidth = "100%";
    });

    const setSliderPosition = () => {
      slidesWrapper.style.transform = `translateX(${state.currentTranslate}px)`;
    };

    const animation = () => {
      setSliderPosition();
      if (state.isDragging) requestAnimationFrame(animation);
    };

    function pointerDown(event) {
      state.isDragging = true;
      state.startPos = event.clientX ?? (event.touches && event.touches[0]?.clientX) ?? 0;
      state.animationID = requestAnimationFrame(animation);
    }
    function pointerMove(event) {
      if (!state.isDragging) return;
      const currentPosition = event.clientX ?? (event.touches && event.touches[0]?.clientX) ?? 0;
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
      const containerWidth = container.clientWidth || 0;
      state.currentTranslate = -state.currentIndex * containerWidth;
      state.prevTranslate = state.currentTranslate;
      setSliderPosition();
    }

    ["pointerdown","pointermove","pointerup","pointerleave","pointercancel"].forEach(type => {
      slidesWrapper.addEventListener(type, (e) => {
        if (type === "pointerdown") pointerDown(e);
        if (type === "pointermove") pointerMove(e);
        if (type === "pointerup" || type === "pointercancel" || type === "pointerleave") pointerUp(e);
      }, { passive: true });
    });
    slides.forEach(slide => {
      ["pointerdown","pointermove","pointerup","pointerleave","pointercancel"].forEach(type => {
        slide.addEventListener(type, (e) => {
          if (type === "pointerdown") pointerDown(e);
          if (type === "pointermove") pointerMove(e);
          if (type === "pointerup" || type === "pointercancel" || type === "pointerleave") pointerUp(e);
        }, { passive: true });
      });
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
  document.querySelectorAll(".media-container").forEach(initMediaSlider);

  /* =========================
     Navbar / Dropdowns (KLICK ONLY)
     ========================= */
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");

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
    const menu    = li.querySelector('.dropdown-menu');
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

    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }

  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    li.classList.contains("open") ? closeAllDropdowns() : openDropdown(trigger);
  }

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

  document.addEventListener("click", () => {
    navLinks?.classList.remove("active");
    closeAllDropdowns();
  });

  const repositionOpen = () =>
    document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  /* =========================
     Login-abhängige Weiterleitungen (Navbar -> Tabs)
     ========================= */
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");
  const soldCarsLink  = document.getElementById("sold-cars-link");
  const messagesLink  = document.getElementById("messages-link");

  function checkLoginAndRedirect(targetHash) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.eingeloggt) {
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

  // >>> konsistente Hashes
  savedCarsLink?.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("#saved-cars"); });
  myCarsLink?.addEventListener("click",    (e) => { e.preventDefault(); checkLoginAndRedirect("#car-list"); });
  soldCarsLink?.addEventListener("click",  (e) => { e.preventDefault(); checkLoginAndRedirect("#sold-cars"); });
  messagesLink?.addEventListener("click",  (e) => { e.preventDefault(); checkLoginAndRedirect("#messages-list"); });

  /* =========================
     Sidebar/Tabs + Hash-Deep-Link
     ========================= */
  const sidebarLinks = document.querySelectorAll(".sidebar-link");
  const titleEl      = document.querySelector(".title");
  const sections = {
    "car-list":      document.querySelector(".car-list"),
    "messages-list": document.querySelector("#messages-list"),
    "saved-cars":    document.querySelector("#saved-cars"),
    "sold-cars":     document.querySelector("#sold-cars")
  };

  function showSection(sectionName) {
    // Inhalte-Tabs umschalten
    Object.values(sections).forEach(section => {
      if (!section) return;
      section.classList.add("hidden");
      section.classList.remove("visible");
    });
    if (sections[sectionName]) {
      sections[sectionName].classList.remove("hidden");
      sections[sectionName].classList.add("visible");
    }
  
    // Profil-Bereich nur bei "Meine Autos" anzeigen
    const profileSection = document.querySelector(".profile-section");
    if (profileSection) {
      if (sectionName === "car-list") {
        profileSection.classList.remove("hidden");
      } else {
        profileSection.classList.add("hidden");
      }
    }
  
    // Body-Klasse für evtl. seitenspezifische Styles/Ads
    const body = document.body;
    if (body) {
      body.classList.remove(
        "meine-autos-seite",
        "nachrichten-seite",
        "gespeicherte-autos-seite"
      );
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
  

  const chatButton = `
    <a href="chat.html" class="all-chats-btn" style="margin-left:auto;">
      <i class="fas fa-envelope-open-text"></i> Alle Chats anzeigen
    </a>`;

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

  function applyHash() {
    const section = sectionFromHash(location.hash);
    setActiveSidebar(section);
    showSection(section);
    updateTitle(section);
  }

  // Sidebar-Klicks
  sidebarLinks.forEach(link => {
    link.addEventListener("click", () => {
      const selected = link.dataset.section;
      // Hash setzen (auch für Back-Button)
      if (location.hash !== `#${selected}`) history.replaceState(null, "", `#${selected}`);
      applyHash();
    });
  });

  // Beim Laden + bei Hash-Änderung
  window.addEventListener("hashchange", applyHash);
  applyHash(); // initial


    /* =========================
     Profil: Inline bearbeiten
     ========================= */
     function enableProfileInlineEditing() {
      const editableGroups = document.querySelectorAll(
        ".profile-info-row.is-editable, .profile-opening-wrapper.is-editable"
      );
  
      editableGroups.forEach((group) => {
        const valueEl =
          group.querySelector(".profile-info-value") ||
          group.querySelector(".profile-opening-text");
        const btn = group.querySelector(".profile-edit-inline");
        if (!valueEl || !btn) return;
  
        const fieldKey = valueEl.dataset.profileField; // z.B. "address", "phone", "website", "openingHours"
        if (!fieldKey) return;
  
        function enterEditMode() {
          group.classList.add("is-editing");
          valueEl.setAttribute("contenteditable", "true");
  
          // Cursor ans Ende setzen
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
  
        // Stift-Button
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isEditing = group.classList.contains("is-editing");
          if (!isEditing) {
            enterEditMode();
          } else {
            exitEditMode(true);
          }
        });
  
        // Enter = speichern, Esc = abbrechen
        valueEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            exitEditMode(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            exitEditMode(false);
          }
        });
  
        // Blur = speichern
        valueEl.addEventListener("blur", () => {
          if (group.classList.contains("is-editing")) {
            exitEditMode(true);
          }
        });
      });
    }
  
    async function saveProfileField(field, value) {
      // TODO: Backend-Route anpassen, wenn du es wirklich in der DB speichern willst
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
  
    // direkt beim Laden aktivieren
    enableProfileInlineEditing();
  
  /* =========================
     Kleinkram
     ========================= */
  // Fahrzeug-Karte löschen (Demo)
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const card = this.closest(".car-card");
      if (card && confirm("Möchtest du dieses Inserat wirklich löschen?")) {
        card.remove();
      }
    });
  });

  // Hochkant-Erkennung
  document.querySelectorAll('.slide img, .slide video').forEach(media => {
    if (media.tagName === "VIDEO") {
      media.addEventListener("loadedmetadata", () => {
        if (media.videoHeight > media.videoWidth) media.classList.add("portrait-zoom");
      });
    } else {
      media.addEventListener("load", () => {
        if (media.naturalHeight > media.naturalWidth) media.classList.add("portrait-zoom");
      });
    }
  });

  // Gespeicherte Autos entfernen (Demo)
  document.querySelectorAll('.remove-saved-btn').forEach(button => {
    button.addEventListener('click', function() {
      const wrapper = this.closest('.car-card-wrapper');
      if (confirm("Möchtest du dieses Fahrzeug wirklich entfernen?")) {
        wrapper?.remove();
      }
    });
  });
});


  
  
  










document.addEventListener("DOMContentLoaded", async () => {
  // Preis hübsch formatieren
  function formatEUR(value) {
    if (value == null || value === "") return null;
    const num = parseFloat(String(value).replace(/\./g, "").replace(",", "."));
    if (!isNaN(num)) return num.toLocaleString("de-DE") + " €";
    return String(value) + " €";
  }

  // Initialen aus Namen
  function sellerInitials(name = "") {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const ini = parts.map(p => p[0]?.toUpperCase() || "").join("");
    return ini || "AV";
  }

  // Logo/Name robust bestimmen (mit Fallback auf aktuelles Nutzerlogo)
  function getSellerData(inserat, nutzerData) {
    const type =
      inserat?.seller?.type ||
      (String(inserat?.verkauf_verkaeufer || "").toLowerCase() === "händler"
        ? "haendler"
        : "privat");

    const name =
      inserat?.seller?.name ||
      inserat?.verkauf_name ||
      (type === "haendler" ? (nutzerData?.name || "Händler") : "Privatanbieter");

    // WICHTIG: Fallback für ONLINE-ANZEIGEN auf dein Nutzerlogo,
    // wenn die Anzeige (z.B. vor Logo-Upload) ohne seller.logoUrl veröffentlicht wurde.
    const logoUrl =
      inserat?.seller?.logoUrl ||
      ((inserat?.verkaeuferId && inserat.verkaeuferId === nutzerData?.nutzerId)
        ? (nutzerData?.logoUrl || "")
        : "");

    return { type, name, logoUrl };
  }

  // Echte Mongo-ID aus Dokument ziehen
  function extractMongoId(doc) {
    if (!doc) return null;
    if (typeof doc._id === "string") return doc._id;
    if (doc._id && typeof doc._id === "object" && typeof doc._id.$oid === "string") return doc._id.$oid;
    if (typeof doc.id === "string") return doc.id;
    return null;
  }
  function renderProfileSection(nutzerData, drafts, online) {
    const section = document.querySelector(".profile-section");
    if (!section || !nutzerData) return;
  
    // Rolle erkennen
    const roleRaw = (nutzerData.role || nutzerData.rolle || "privat").toLowerCase();
    const isHaendler =
      roleRaw.includes("händ") ||
      roleRaw.includes("haend") ||
      roleRaw === "haendler" ||
      roleRaw === "haendlerkonto";
  
    section.classList.toggle("profile--haendler", isHaendler);
    section.classList.toggle("profile--privat", !isHaendler);
  
    // Name (Autohaus vs. Privat)
    const displayName = isHaendler
      ? (nutzerData.firma || nutzerData.name || "Dein Autohaus")
      : (nutzerData.name || "Dein Profil");
    const initials = sellerInitials(displayName);
  
    const nameEl = section.querySelector(".profile-name");
    const initialsEl = section.querySelector(".profile-initials");
    if (nameEl) nameEl.textContent = displayName;
    if (initialsEl) initialsEl.textContent = initials;
  
    // Logo
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
  
    // Standort
    const locParts = [];
    if (nutzerData.plz) locParts.push(nutzerData.plz);
    if (nutzerData.ort) locParts.push(nutzerData.ort);
    const location = locParts.join(" ") || nutzerData.standort || "";
    const locationEl = section.querySelector('[data-profile-field="location"]');
    if (locationEl) {
      locationEl.textContent = location || "Ort noch nicht hinterlegt";
    }
  
    // Rolle-Label
    const roleEl = section.querySelector('[data-profile-field="role"]');
    if (roleEl) {
      roleEl.textContent = isHaendler ? "Händlerkonto" : "Privatkonto";
    }
  
    // Mitglied seit → „Bei Autovisa seit MM/JJJJ“
    const memberEl = section.querySelector('[data-profile-field="memberSince"]');
    const createdRaw =
      nutzerData.erstelltAm || nutzerData.createdAt || nutzerData.created || null;
  
    if (memberEl && createdRaw) {
      const d = new Date(createdRaw);
      if (!isNaN(d.getTime())) {
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        memberEl.textContent = `Bei Autovisa seit ${month}/${year}`;
      } else {
        memberEl.textContent = "";
      }
    } else if (memberEl) {
      memberEl.textContent = "";
    }
  
    // Adresse
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
  
      addressEl.textContent =
        lines.length ? lines.join(", ") : "Noch keine Adresse hinterlegt";
    }
  
    // Telefon
    const phoneEl = section.querySelector('[data-profile-field="phone"]');
    if (phoneEl) {
      const phone =
        nutzerData.telefon ||
        nutzerData.phone ||
        nutzerData.tel ||
        nutzerData.telefonnummer ||
        "";
      phoneEl.textContent = phone || "–";
    }
  
    // E-Mail
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
  
    // Website
    const websiteEl = section.querySelector('[data-profile-field="website"]');
    if (websiteEl) {
      const url =
        nutzerData.website ||
        nutzerData.webseite ||
        nutzerData.homepage ||
        nutzerData.url ||
        "";
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
  
    // Öffnungszeiten (Text)
    const openingEl = section.querySelector('[data-profile-field="openingHours"]');
    if (openingEl) {
      const text =
        nutzerData.oeffnungszeiten ||
        nutzerData["öffnungszeiten"] ||
        "";
      openingEl.textContent =
        text || openingEl.textContent || "Noch keine Öffnungszeiten hinterlegt.";
    }
  
    // Händler-spezifische Elemente ein-/ausblenden
    section.querySelectorAll(".haendler-only").forEach(el => {
      el.style.display = isHaendler ? "" : "none";
    });
  
    // =========================
    //  Bewertungen (nur Händler)
    // =========================
  
    const ratingAvg = typeof nutzerData.ratingAverage === "number"
      ? nutzerData.ratingAverage
      : null;
    const ratingCount = typeof nutzerData.ratingCount === "number"
      ? nutzerData.ratingCount
      : 0;
  
    const ratingAvgEl   = section.querySelector('[data-profile-field="ratingAverage"]');
    const ratingCountEl = section.querySelector('[data-profile-field="ratingCount"]');
    const starsContainer = section.querySelector('[data-profile-field="ratingStars"]');
  
    if (ratingAvgEl) {
      if (isHaendler && ratingAvg && ratingCount > 0) {
        ratingAvgEl.textContent = `${ratingAvg.toFixed(1)} / 5`;
      } else {
        ratingAvgEl.textContent = "– / 5";
      }
    }
  
    if (ratingCountEl) {
      if (isHaendler && ratingCount > 0) {
        ratingCountEl.textContent =
          `${ratingCount} Bewertung${ratingCount === 1 ? "" : "en"}`;
      } else if (isHaendler) {
        ratingCountEl.textContent = "Noch keine Bewertungen";
      } else {
        ratingCountEl.textContent = "";
      }
    }
  
    if (starsContainer) {
      const value = (isHaendler && ratingAvg && ratingCount > 0) ? ratingAvg : 0;
      const full = Math.floor(value);
      const half = value - full >= 0.5;
      const stars = starsContainer.querySelectorAll("i");
  
      stars.forEach((star, index) => {
        star.classList.remove("star-full", "star-half", "star-empty");
        if (value === 0) {
          star.classList.add("star-empty");
        } else if (index < full) {
          star.classList.add("star-full");
        } else if (index === full && half) {
          star.classList.add("star-half");
        } else {
          star.classList.add("star-empty");
        }
      });
    }
  
    // =========================
    //  Stats
    // =========================
  
    const activeCount = Array.isArray(online) ? online.length : 0;
    const draftCount  = Array.isArray(drafts) ? drafts.length : 0;
    const totalCount  = activeCount + draftCount;
  
    const activeEl = section.querySelector('[data-stat="active"]');
    const draftsEl = section.querySelector('[data-stat="drafts"]');
    const totalEl  = section.querySelector('[data-stat="total"]');
  
    if (activeEl) activeEl.textContent = String(activeCount);
    if (draftsEl) draftsEl.textContent = String(draftCount);
    if (totalEl)  totalEl.textContent  = String(totalCount);
  }
  

  const carList = document.querySelector(".car-list");

  try {
    // Login prüfen
    const nutzerRes = await fetch("/getNutzerInfo", { credentials: "include" });
    const nutzerData = await nutzerRes.json();
    if (!nutzerData.eingeloggt || !nutzerData.nutzerId) {
      alert("❌ Du bist nicht eingeloggt. Bitte logge dich zuerst ein.");
      window.location.href = "login.html";
      return;
    }

    // Beide Quellen parallel laden
    const [draftRes, onlineRes] = await Promise.all([
      fetch("/getVehicleData", { credentials: "include" }), // Entwürfe (fahrzeugeEntwurf)
      fetch("/meine-inserate", { credentials: "include" })  // Online (inserate)
    ]);

    const drafts = await draftRes.json();   // Array
    const online = await onlineRes.json();  // Array

    // 👉 Profil-Bereich befüllen
    renderProfileSection(nutzerData, drafts, online);

    // Vereinheitlichen + Status mitgeben
    const items = [
      ...(Array.isArray(drafts) ? drafts.map(d => ({ ...d, __status: "draft" })) : []),
      ...(Array.isArray(online) ? online.map(o => ({ ...o, __status: "online" })) : [])
    ];

    if (!items.length) {
      carList.innerHTML = "<p>Keine Inserate gefunden.</p>";
      return;
    }

    carList.innerHTML = "";

    items.forEach((inserat) => {
      const wrapper = document.createElement("div");
      wrapper.className = "car-card-wrapper";

      const realId = extractMongoId(inserat);
      wrapper.dataset.id = realId || "";                // echte MongoID
      wrapper.dataset.status = inserat.__status || "";  // "draft" | "online"

      const isOnline = wrapper.dataset.status === "online";
      const publishBtnLabel = isOnline ? "Online" : "Veröffentlichen";
      const publishBtnAttrs = isOnline
        ? 'disabled class="publish-btn published"'
        : 'class="publish-btn"';

      wrapper.innerHTML = `
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
              <p><i class="fas fa-road"></i> ${inserat.verkauf_kilometer ?? "—"} km</p>
              <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.verkauf_erstzulassung || "—"}</p>
              <p><i class="fas fa-gas-pump"></i> ${inserat.verkauf_kraftstoff || "—"}</p>
              <p><i class="fas fa-gauge-high"></i> ${inserat.verkauf_leistung ?? "—"} PS</p>
              <p><i class="fas fa-gears"></i> ${inserat.verkauf_getriebe || "—"}</p>
              <p><i class="fas fa-tint"></i> ${inserat.verkauf_verbrauch_kombiniert || "—"} l/100 km</p>
            </div>

            <!-- Verkäuferbereich -->
            <div class="dealer-info"></div>
          </div>
        </div>

        <div class="car-card-actions desktop-only">
          <button ${publishBtnAttrs}><i class="fas fa-globe"></i> ${publishBtnLabel}</button>
          <button class="edit-btn"><i class="fas fa-pen"></i> Bearbeiten</button>
          <button class="remove-saved-btn"><i class="fas fa-trash"></i> Entfernen</button>
        </div>
      `;



// =========================
// BEARBEITEN – NEU (Wizard-State setzen)
// =========================

function buildFahrzeugdatenFromInserat(ins) {
  // Ziel:
  // 1) FORM-Keys setzen (für fahrzeugdaten.js Vorbelegung)
  // 2) verkauf_* Keys setzen (für Vorschau/Legacy)
  // 3) robust gegen alte/uneinheitliche DB-Felder

  const marke  = ins.marke || ins.verkauf_marke || "";
  const modell = ins.modell || ins.verkauf_modell || "";
  const titel  = ins.titel || ins.verkauf_titel || ins.verkauf_modell || `${marke} ${modell}`.trim();

  const fd = {
    // ===== Basis =====
    titel,
    marke,
    modell,

    // ===== Preise =====
    preis: ins.preis || ins.verkauf_preis || "",
    "brutto-preis": ins["brutto-preis"] || ins.verkauf_brutto || "",
    "netto-preis":  ins["netto-preis"]  || ins.verkauf_netto  || "",

    verkauf_preis:  ins.verkauf_preis  || ins.preis || "",
    verkauf_brutto: ins.verkauf_brutto || ins["brutto-preis"] || "",
    verkauf_netto:  ins.verkauf_netto  || ins["netto-preis"]  || "",
    verkauf_mwst:   ins.verkauf_mwst   || "",

    // ===== Erstzulassung =====
    erstzulassung:         ins.erstzulassung || ins.verkauf_erstzulassung || "",
    verkauf_erstzulassung: ins.verkauf_erstzulassung || ins.erstzulassung || "",

    // ===== KILOMETER =====
    kilometer:         ins.kilometer ?? ins.verkauf_kilometer ?? "",
    verkauf_kilometer: ins.verkauf_kilometer ?? ins.kilometer ?? "",

    // ===== LEISTUNG =====
    // Form-IDs: leistung_ps + leistung_kw
    leistung_ps:        ins.leistung_ps ?? ins.verkauf_leistung ?? ins.leistung ?? "",
    leistung_kw:        ins.leistung_kw ?? ins.verkauf_leistung_kw ?? "",

    verkauf_leistung:    ins.verkauf_leistung ?? ins.leistung_ps ?? ins.leistung ?? "",
    verkauf_leistung_kw: ins.verkauf_leistung_kw ?? ins.leistung_kw ?? "",

    // ===== HUBRAUM =====
    hubraum:         ins.hubraum ?? ins.verkauf_hubraum ?? "",
    verkauf_hubraum: ins.verkauf_hubraum ?? ins.hubraum ?? "",

    // ===== KRAFTSTOFF / GETRIEBE / ANTRIEB =====
    kraftstoff:         ins.kraftstoff || ins.verkauf_kraftstoff || "",
    verkauf_kraftstoff: ins.verkauf_kraftstoff || ins.kraftstoff || "",

    getriebe:           ins.getriebe || ins.verkauf_getriebe || "",
    verkauf_getriebe:   ins.verkauf_getriebe || ins.getriebe || "",

    antriebsart:        ins.antriebsart || ins.antrieb || ins.verkauf_antrieb || "",
    verkauf_antrieb:    ins.verkauf_antrieb || ins.antriebsart || ins.antrieb || "",

    // ===== Fahrzeugtyp =====
    fahrzeugtyp:         ins.fahrzeugtyp || ins.verkauf_fahrzeugtyp || "",
    verkauf_fahrzeugtyp: ins.verkauf_fahrzeugtyp || ins.fahrzeugtyp || "",

    // ===== Türen =====
    tueren:         ins.tueren || ins["türen"] || ins.türen || ins.verkauf_tueren || "",
    "türen":        ins["türen"] || ins.türen || ins.tueren || "",
    verkauf_tueren: ins.verkauf_tueren || ins.tueren || ins["türen"] || ins.türen || "",

    // ===== Partikelfilter =====
    partikelfilter:         ins.partikelfilter || ins.verkauf_partikelfilter || "",
    verkauf_partikelfilter: ins.verkauf_partikelfilter || ins.partikelfilter || "",

    // ===== Verbrauch/CO2 =====
    verbrauch_kombiniert: ins.verbrauch_kombiniert || ins.verkauf_verbrauch_kombiniert || "",
    verbrauch_innerorts:  ins.verbrauch_innerorts  || ins.verkauf_verbrauch_innerorts  || "",
    verbrauch_ausserorts: ins.verbrauch_ausserorts || ins.verkauf_verbrauch_ausserorts || "",
    co2_emission:         ins.co2_emission         || ins.verkauf_co2_emission         || "",

    verkauf_verbrauch_kombiniert: ins.verkauf_verbrauch_kombiniert || ins.verbrauch_kombiniert || "",
    verkauf_verbrauch_innerorts:  ins.verkauf_verbrauch_innerorts  || ins.verbrauch_innerorts  || "",
    verkauf_verbrauch_ausserorts: ins.verkauf_verbrauch_ausserorts || ins.verbrauch_ausserorts || "",
    verkauf_co2_emission:         ins.verkauf_co2_emission         || ins.co2_emission         || "",

    // ===== Schadstoff/Plakette/Emission =====
    schadstoffklasse: ins.schadstoffklasse || ins.verkauf_schadstoffklasse || "",
    umweltplakette:  ins.umweltplakette  || ins.verkauf_umweltplakette  || "",
    emissionsklasse: ins.emissionsklasse || ins.verkauf_emissionsklasse || "",

    verkauf_schadstoffklasse: ins.verkauf_schadstoffklasse || ins.schadstoffklasse || "",
    verkauf_umweltplakette:   ins.verkauf_umweltplakette   || ins.umweltplakette  || "",
    verkauf_emissionsklasse:  ins.verkauf_emissionsklasse  || ins.emissionsklasse || "",

    // ===== Verkäuferlabel =====
    verkauf_verkaeufer: ins.verkauf_verkaeufer || ""
  };

  return fd;
}

function buildFahrzeugdetailsFromInserat(ins) {
  // Step 2 sollte konsistent "fahrzeugdetails" bekommen.
  // Wir normalisieren die wichtigsten erwarteten Keys UND lassen den Rest stehen.

  const merkmale =
    Array.isArray(ins.merkmale) ? ins.merkmale :
    Array.isArray(ins.ausstattung) ? ins.ausstattung :
    Array.isArray(ins.verkauf_ausstattung) ? ins.verkauf_ausstattung :
    [];

  return {
    // Normalisierte Kernfelder
    titel: ins.titel || ins.verkauf_titel || "",
    kurzbeschreibung: ins.kurzbeschreibung || ins.verkauf_kurzbeschreibung || "",
    beschreibung: ins.beschreibung || ins.verkauf_beschreibung || "",
    farbe: ins.farbe || ins.verkauf_farbe || "",

    merkmale,
    ausstattung: merkmale, // Alias für alte Stellen

    // Restliche Felder mitnehmen (schadet nicht)
    ...ins,

    // Sicherstellen, dass unsere Normalisierung gewinnt:
    merkmale,
    ausstattung: merkmale
  };
}

function buildMedienFromInserat(ins) {
  // Step 3 kann bei dir je nach Version verschiedene Strukturen erwarten.
  // Deshalb: mehrere Aliases liefern.

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
    // Neue/saubere Struktur
    images,
    videos,

    // Aliases für ältere Implementationen
    bilder: images,
    video: singleVideo,

    // Optional unified
    media: [
      ...images.map(url => ({ type: "image", url })),
      ...videos.map(url => ({ type: "video", url }))
    ]
  };
}
wrapper.querySelectorAll(".edit-btn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const realId = extractMongoId(inserat) || wrapper.dataset.id || "";
    if (!realId) return alert("ID fehlt");

    try {
      // 🟢 Statt Server-Request: Direkt Bearbeitungsmodus aktivieren
      localStorage.setItem("editMode", "1");
      localStorage.setItem("editInseratId", realId);

      localStorage.setItem("fahrzeugdaten", JSON.stringify(buildFahrzeugdatenFromInserat(inserat)));
      localStorage.setItem("fahrzeugdetails", JSON.stringify(buildFahrzeugdetailsFromInserat(inserat)));
      localStorage.setItem("medien", JSON.stringify(buildMedienFromInserat(inserat)));

      sessionStorage.setItem("inseratGestartet", "true");
      sessionStorage.setItem("hatGespeichert", "true");

      const roleRaw = String(nutzerData?.role || nutzerData?.rolle || "privat").toLowerCase();
      const isHaendlerUser = roleRaw.includes("haend") || roleRaw.includes("händ");

      const ziel = isHaendlerUser ? "haendler.html" : "privat.html";
      window.location.href = `${ziel}?edit=${encodeURIComponent(realId)}`;
    } catch (err) {
      console.warn("Konnte Edit-State nicht setzen:", err);
      alert("Fehler beim Bearbeiten.");
    }
  });
});



      // Karte klickbar (außer Buttons/Arrows)
      wrapper.addEventListener("click", (e) => {
        const isActionButton = e.target.closest(".car-card-actions button");
        const isArrow = e.target.closest(".media-arrow");
        if (isActionButton || isArrow) return;
        localStorage.setItem("ausgewaehltesInserat", JSON.stringify(inserat));
        window.location.href = "anzeige.html";
      });

      carList.appendChild(wrapper);
      initializeSlider(wrapper);

      // --- Verkäuferzeile (Logo + Name + Standort) ---
      const dealerInfoEl = wrapper.querySelector(".dealer-info");

      // 1) Typ bestimmen (robust)
      const rawType = String(
        inserat?.seller?.type ||
        inserat?.verkauf_verkaeufer ||
        ""
      ).toLowerCase();

      const isHaendler =
        rawType === "haendler" ||
        rawType === "händler" ||
        rawType.includes("händ") ||
        rawType.includes("haend");

      // 2) Name
      const sellerName =
        inserat?.seller?.name ||
        inserat?.verkauf_name ||
        nutzerData?.firma ||
        nutzerData?.name ||
        (isHaendler ? "Händler" : "Privatanbieter");

      // 3) Standort
      const sellerLocation =
        inserat?.standort ||
        [inserat?.plz, inserat?.ort].filter(Boolean).join(" ") ||
        "Standort nicht angegeben";

      // 4) Fallback-Regel für Logo:
      //    - wenn Inserat einen Seller-Snapshot hat → den nutzen
      //    - sonst, wenn es MEIN Inserat ist → mein Profil-Logo nutzen
      const belongsToMe = String(inserat?.verkaeuferId || "") === String(nutzerData?.nutzerId || "");
      const sellerLogo =
        (typeof inserat?.seller?.logoUrl === "string" && inserat.seller.logoUrl.trim()) ||
        (belongsToMe ? (nutzerData?.logoUrl || "") : "");

      dealerInfoEl.innerHTML = `
        <div class="dealer-row">
          <div class="dealer-avatar">
            <img alt="${sellerName} Logo" decoding="async" style="display:block">
            <span class="dealer-initials">${sellerInitials(sellerName)}</span>
          </div>
          <div class="dealer-meta">
            <div class="dealer-name">${sellerName}</div>
            <div class="dealer-location">${sellerLocation}</div>
          </div>
        </div>
      `;

      const avatar = dealerInfoEl.querySelector(".dealer-avatar");
      const img    = dealerInfoEl.querySelector(".dealer-avatar img");

      // Default: Initialen
      avatar.classList.remove("has-logo");
      img.removeAttribute("src");

      // Debug
      console.debug("INSERAT", extractMongoId(inserat), {
        sellerName, sellerLogo, sellerLocation, snapshot: inserat?.seller, nutzerLogo: nutzerData?.logoUrl
      });

      if (sellerLogo) {
        // Falls Browser lazy blockt, lade „eager“
        try { img.loading = "eager"; } catch {}

        img.addEventListener("load", () => {
          if (img.naturalWidth > 0) avatar.classList.add("has-logo");
        }, { once: true });

        img.addEventListener("error", () => {
          avatar.classList.remove("has-logo");
          img.removeAttribute("src");
          console.warn("Logo konnte nicht geladen werden:", sellerLogo);
        }, { once: true });

        img.src = sellerLogo;

        // Cache-Sofortfall
        if (img.complete && img.naturalWidth > 0) {
          avatar.classList.add("has-logo");
        }
      }

      // Hochformat-Erkennung
      wrapper.querySelectorAll(".slide").forEach((media) => {
        if (media.tagName === "VIDEO") {
          media.addEventListener("loadedmetadata", () => {
            if (media.videoHeight > media.videoWidth) media.classList.add("portrait-zoom");
          });
        } else if (media.tagName === "IMG") {
          media.addEventListener("load", () => {
            if (media.naturalHeight > media.naturalWidth) media.classList.add("portrait-zoom");
          });
        }
      });

      // Entfernen (nur UI)
      wrapper.querySelectorAll(".remove-saved-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("Möchtest du dieses Fahrzeug wirklich entfernen?")) wrapper.remove();
        });
      });
    });

  } catch (error) {
    console.error("Fehler beim Laden der Inserate:", error);
  }
});


// Slides erstellen (Bilder + Video)
function generateSlides(inserat) {
  const slides = [];
  if (Array.isArray(inserat.images)) {
    inserat.images.forEach((bild) => slides.push(`<img src="${bild}" alt="Bild" class="slide">`));
  }
  if (inserat.video && String(inserat.video).trim() !== "") {
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
    slidesContainer.style.transform = `translateX(${-currentIndex * 100}%)`;
  }
  leftArrow?.addEventListener("click", (e) => { e.stopPropagation(); if (currentIndex > 0) { currentIndex--; updateSlide(); }});
  rightArrow?.addEventListener("click", (e) => { e.stopPropagation(); if (currentIndex < slides.length - 1) { currentIndex++; updateSlide(); }});
  updateSlide();
}

// Veröffentlichen (nur für Entwürfe)
document.addEventListener("click", async (e) => {
  const button = e.target.closest(".publish-btn");
  if (!button) return;

  const card = button.closest(".car-card-wrapper");
  const inseratId = card?.dataset.id;
  const status    = card?.dataset.status;

  if (status !== "draft") return; // bereits online

  if (!inseratId || !/^[a-f\d]{24}$/i.test(inseratId)) {
    alert("❌ Ungültige Inserat-ID.");
    return;
  }

  try {
    const res  = await fetch("/inserat-veroeffentlichen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: inseratId })
    });
    const text = await res.text();

    if (res.ok) {
      button.textContent = "Online";
      button.classList.add("published");
      button.disabled = true;
      card.dataset.status = "online";
      alert("✅ Inserat ist jetzt online!");
    } else {
      alert("❌ Fehler: " + text);
    }
  } catch (err) {
    console.error("Netzwerkfehler:", err);
    alert("❌ Netzwerkfehler beim Veröffentlichen.");
  }
});















// -----------------------
// NACHRICHTEN LADEN/RENDERN
// -----------------------
async function getLoggedInUser() {
  const r = await fetch("/getNutzerInfo", { credentials: "include" });
  const u = await r.json();
  if (!u?.eingeloggt || !u?.nutzerId) throw new Error("Nicht eingeloggt");
  return u;
}

// Inserat-Details holen (benötigt kleinen Server-Endpoint, siehe Abschnitt B)
async function fetchInseratDetails(id) {
  try {
    const r = await fetch(`/inserat-details/${encodeURIComponent(id)}`, { credentials: "include" });
    if (!r.ok) throw new Error("404");
    return await r.json();
  } catch {
    // Fallback, wenn Inserat nicht gefunden ist
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
      verkauf_verkaeufer: "",
      verkauf_name: "",
      standort: ""
    };
  }
}

// Nachrichten des eingeloggten Users abrufen
async function fetchInbox(empfaengerId) {
  const r = await fetch(`/nachrichten/${encodeURIComponent(empfaengerId)}`, { credentials: "include" });
  if (!r.ok) throw new Error("Fehler beim Abrufen der Nachrichten");
  return await r.json(); // Array von Nachrichten
}

// Eine Nachrichten-Karte rendern
function renderMessageCard(msg, ins, currentUserId) {
  const firstImg = Array.isArray(ins.images) && ins.images[0] ? ins.images[0] : null;
  const preis = ins.preis != null
    ? (typeof ins.preis === "number"
        ? ins.preis.toLocaleString("de-DE") + " €"
        : String(ins.preis))
    : "";

  // Chat-URL so, wie dein /chat-Endpoint es erwartet:
  const chatUrl = `chat.html?user1=${encodeURIComponent(currentUserId)}&user2=${encodeURIComponent(msg.senderId)}&fahrzeugId=${encodeURIComponent(msg.fahrzeugId)}`;

  return `
    <div class="car-card-wrapper" data-msg-id="${msg.id}">
      <div class="car-card horizontal">
        <div class="car-card-media">
          <div class="media-container">
            <div class="slides">
              ${firstImg ? `<img src="${firstImg}" alt="Bild" class="slide active" />` : ""}
            </div>
          </div>
        </div>
        <div class="car-details">
          <div class="car-top-row">
            <h2 class="car-title">${ins.titel || "Ohne Titel"}</h2>
            <p class="car-price">${preis || ""}</p>
          </div>
          <p class="car-subtitle">${ins.verkauf_kurzbeschreibung || ""}</p>
          <div class="car-info-grid">
            <p><i class="fas fa-road"></i> ${ins.verkauf_kilometer ?? "—"} km</p>
            <p><i class="fas fa-calendar-alt"></i> EZ ${ins.verkauf_erstzulassung || "—"}</p>
            <p><i class="fas fa-gas-pump"></i> ${ins.verkauf_kraftstoff || "—"}</p>
            <p><i class="fas fa-gauge-high"></i> ${ins.verkauf_leistung ?? "—"} PS</p>
            <p><i class="fas fa-gears"></i> ${ins.verkauf_getriebe || "—"}</p>
            ${ins.verkauf_verbrauch_kombiniert ? `<p><i class="fas fa-tint"></i> ${ins.verkauf_verbrauch_kombiniert} l/100 km</p>` : ""}
          </div>
          <div class="dealer-info">
            <strong>${ins.verkauf_name || "Anbieter"}</strong><br>
            ${ins.standort || ""}
          </div>
        </div>
      </div>

      <!-- Desktop-Buttons -->
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

      <!-- Mobile-Buttons -->
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

// Haupt-Funktion zum Laden + Anzeigen
async function loadMessagesSection() {
  const messagesSection = document.querySelector(".messages-list");
  if (!messagesSection) return;

  try {
    const user = await getLoggedInUser();
    const inbox = await fetchInbox(user.nutzerId);   // nur empfangene Nachrichten

    if (!Array.isArray(inbox) || inbox.length === 0) {
      messagesSection.innerHTML = `<p>Keine Nachrichten vorhanden.</p>`;
      return;
    }

    // Inserat-Details in Parallel-Requests holen
    const detailsMap = new Map();
    const uniqueFahrzeuge = [...new Set(inbox.map(m => m.fahrzeugId))];

    await Promise.all(uniqueFahrzeuge.map(async (fid) => {
      const det = await fetchInseratDetails(fid);
      detailsMap.set(fid, det);
    }));

    // neueste oben
    inbox.sort((a,b) => new Date(b.zeit) - new Date(a.zeit));

    messagesSection.innerHTML = inbox.map(msg => {
      const ins = detailsMap.get(msg.fahrzeugId) || {};
      return renderMessageCard(msg, ins, user.nutzerId);
    }).join("");

  } catch (e) {
    console.error(e);
    document.querySelector(".messages-list").innerHTML = `<p>Fehler beim Laden der Nachrichten.</p>`;
  }
}

// Als gelesen markieren (PATCH)
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".mark-read-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;

  try {
    const r = await fetch(`/nachrichten/${encodeURIComponent(id)}/gelesen`, {
      method: "PATCH",
      headers: { "Content-Type":"application/json" },
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
  } catch (err) {
    console.error(err);
    alert("Netzwerkfehler.");
  }
});

// Beim Tab-Wechsel „Nachrichten“ laden
document.querySelectorAll(".sidebar-link").forEach(link => {
  link.addEventListener("click", () => {
    const target = link.getAttribute("data-section");
    if (target === "messages-list") loadMessagesSection();
  });
});

// Optional: auch direkt beim Laden, falls du „Nachrichten“ als Start-Tab nutzt
// loadMessagesSection();


