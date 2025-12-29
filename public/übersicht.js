
// uebersicht.js (klick-only, kein Hover-Open)
document.documentElement.classList.remove("no-js");

/* =========================================================
   Shared Utils (global, damit ALLE Bereiche dieselben Helfer nutzen)
   ========================================================= */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// WICHTIG: gibt "" zurück wenn leer -> damit || Fallbacks funktionieren
function formatEUR(value) {
  if (value == null || value === "") return "";
  const num = parseFloat(String(value).replace(/\./g, "").replace(",", "."));
  if (!isNaN(num)) return num.toLocaleString("de-DE") + " €";
  return String(value) + " €";
}

function formatKm(value) {
  if (value == null || value === "") return "— km";
  const n = Number(String(value).replace(/\./g, "").replace(",", "."));
  if (!isNaN(n)) return n.toLocaleString("de-DE") + " km";
  return String(value) + " km";
}

function formatEZ(value) {
  const v = String(value || "").trim();
  const m = v.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`; // MM/YYYY
  return v || "—";
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

/* =========================================================
   Slides erzeugen (Bilder + Videos) – robust für alte + neue Felder
   ========================================================= */
function generateSlides(inserat) {
  const slides = [];

  const images =
    Array.isArray(inserat?.images) ? inserat.images :
    Array.isArray(inserat?.bilder) ? inserat.bilder :
    Array.isArray(inserat?.mediaImages) ? inserat.mediaImages :
    [];

  const videos =
    Array.isArray(inserat?.videos) ? inserat.videos :
    Array.isArray(inserat?.mediaVideos) ? inserat.mediaVideos :
    (String(inserat?.video || "").trim() ? [String(inserat.video).trim()] : []);

  images.forEach((url) => {
    const safe = escapeHTML(url);
    slides.push(`<img src="${safe}" alt="Bild" class="slide" loading="lazy" decoding="async">`);
  });

  videos.forEach((url) => {
    const safe = escapeHTML(url);
    slides.push(`
      <video class="slide" controls muted playsinline preload="metadata">
        <source src="${safe}" type="video/mp4">
      </video>
    `);
  });

  if (!slides.length) {
    slides.push(`<div class="slide"></div>`);
  }

  return slides.join("");
}

/* =========================================================
   ONE Slider System (Swipe + Pfeile) – für alle Cards
   ========================================================= */
function initMediaSlider(mediaContainer) {
  if (!mediaContainer) return;
  if (mediaContainer.dataset.sliderBound === "1") return;
  mediaContainer.dataset.sliderBound = "1";

  const slidesWrapper = mediaContainer.querySelector(".slides");
  if (!slidesWrapper) return;

  const slides = Array.from(slidesWrapper.children);
  if (!slides.length) return;

  // Basis-Layout
  slidesWrapper.style.display = "flex";
  slidesWrapper.style.willChange = "transform";
  slidesWrapper.style.transition = "transform 0.25s ease";
  slides.forEach(slide => {
    slide.style.flex = "0 0 100%";
    slide.style.minWidth = "100%";
  });

  // wichtig für Touch: Vertical scroll erlauben, horizontal wird via Pointer handled
  try { slidesWrapper.style.touchAction = "pan-y"; } catch {}

  let index = 0;
  let dragging = false;
  let startX = 0;
  let currentX = 0;

  const getWidth = () => {
    const w = mediaContainer.clientWidth || mediaContainer.getBoundingClientRect().width;
    return w > 0 ? w : 1;
  };

  const setTranslatePx = (px, withTransition = true) => {
    slidesWrapper.style.transition = withTransition ? "transform 0.25s ease" : "none";
    slidesWrapper.style.transform = `translateX(${px}px)`;
  };

  const snap = () => {
    const w = getWidth();
    setTranslatePx(-index * w, true);
  };

  const onPointerDown = (e) => {
    // nur linke Maus / Touch / Pen
    if (e.pointerType === "mouse" && e.button !== 0) return;

    dragging = true;
    startX = e.clientX;
    currentX = startX;

    slidesWrapper.style.transition = "none";

    // Pointer Capture (damit Move/Up sicher kommen)
    try { slidesWrapper.setPointerCapture(e.pointerId); } catch {}

    // verhindert Text-Selection
    if (e.cancelable) e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!dragging) return;

    currentX = e.clientX;
    const dx = currentX - startX;
    const w = getWidth();
    const base = -index * w;

    // Edge-Resistance
    let next = base + dx;
    if (index === 0 && dx > 0) next = base + dx * 0.35;
    if (index === slides.length - 1 && dx < 0) next = base + dx * 0.35;

    if (e.cancelable) e.preventDefault();
    slidesWrapper.style.transform = `translateX(${next}px)`;
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;

    const dx = currentX - startX;
    const w = getWidth();
    const threshold = Math.min(90, w * 0.20);

    if (dx < -threshold && index < slides.length - 1) index++;
    else if (dx > threshold && index > 0) index--;

    try { slidesWrapper.releasePointerCapture(e.pointerId); } catch {}
    snap();
  };

  slidesWrapper.addEventListener("pointerdown", onPointerDown, { passive: false });
  slidesWrapper.addEventListener("pointermove", onPointerMove, { passive: false });
  slidesWrapper.addEventListener("pointerup", onPointerUp, { passive: true });
  slidesWrapper.addEventListener("pointercancel", onPointerUp, { passive: true });
  slidesWrapper.addEventListener("pointerleave", onPointerUp, { passive: true });

  // Pfeile
  const leftArrow = mediaContainer.querySelector(".media-arrow.left");
  const rightArrow = mediaContainer.querySelector(".media-arrow.right");

  leftArrow?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (index > 0) { index--; snap(); }
  });

  rightArrow?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (index < slides.length - 1) { index++; snap(); }
  });

  // resize-snap (und abmelden wenn Element weg ist)
  const onResize = () => {
    if (!document.body.contains(mediaContainer)) {
      window.removeEventListener("resize", onResize);
      return;
    }
    snap();
  };
  window.addEventListener("resize", onResize);

  snap();
}

function initializeSlider(root) {
  if (!root) return;
  const containers = root.querySelectorAll ? root.querySelectorAll(".media-container") : [];
  containers.forEach(initMediaSlider);
}

/* =========================================================
   UI / Navbar / Sidebar – DOMContentLoaded #1
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  if (document.documentElement.dataset.uebersichtUiBound === "1") return;
  document.documentElement.dataset.uebersichtUiBound = "1";

  /* =========================
     Navbar / Dropdowns (KLICK ONLY)
     ========================= */
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");

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
    li?.classList.contains("open") ? closeAllDropdowns() : openDropdown(trigger);
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
    Object.values(sections).forEach(section => {
      if (!section) return;
      section.classList.add("hidden");
      section.classList.remove("visible");
    });

    if (sections[sectionName]) {
      sections[sectionName].classList.remove("hidden");
      sections[sectionName].classList.add("visible");
    }

    const profileSection = document.querySelector(".profile-section");
    if (profileSection) {
      if (sectionName === "car-list") profileSection.classList.remove("hidden");
      else profileSection.classList.add("hidden");
    }

    const body = document.body;
    if (body) {
      body.classList.remove("meine-autos-seite", "nachrichten-seite", "gespeicherte-autos-seite");
      if (sectionName === "messages-list") body.classList.add("nachrichten-seite");
      else if (sectionName === "saved-cars") body.classList.add("gespeicherte-autos-seite");
      else body.classList.add("meine-autos-seite");
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
    sidebarLinks.forEach(link => {
      const host = link.closest("[data-section]") || link;
      const key = host.dataset.section || link.dataset.section;
      host.classList.toggle("active", key === section);
    });
  }

  function sectionFromHash(h = location.hash) {
    switch (String(h || "").toLowerCase()) {
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
    const sectionName = sectionFromHash(location.hash);
    setActiveSidebar(sectionName);
    showSection(sectionName);
    updateTitle(sectionName);

    if (sectionName === "messages-list") loadMessagesSection();
    if (sectionName === "saved-cars") loadSavedCarsSection();
  }

  sidebarLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const host = link.closest("[data-section]") || link;
      const selected = host.dataset.section || link.dataset.section;
      if (!selected) return;

      if (location.hash !== `#${selected}`) location.hash = selected;
      else applyHash();
    });
  });

  window.addEventListener("hashchange", applyHash);
  applyHash();

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
        const isEditing = group.classList.contains("is-editing");
        if (!isEditing) enterEditMode();
        else exitEditMode(true);
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

  enableProfileInlineEditing();
});

/* =========================================================
   Cars/Profile – DOMContentLoaded #2 (async)
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  if (document.documentElement.dataset.uebersichtCarsBound === "1") return;
  document.documentElement.dataset.uebersichtCarsBound = "1";

  const carList = document.querySelector(".car-list");
  if (!carList) return;

  async function ladeHändlerBewertung(userId) {
    if (!userId) return;
    try {
      const res = await fetch(`/api/bewertung/${userId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      const avg = data.avg ?? null;
      const count = data.count ?? 0;

      const avgEl = document.querySelector('[data-profile-field="ratingAverage"]');
      const countEl = document.querySelector('[data-profile-field="ratingCount"]');
      const stars = document.querySelectorAll('[data-profile-field="ratingStars"] i');

      if (avgEl) avgEl.textContent = avg ? `${avg.toFixed(1)} / 5` : "– / 5";
      if (countEl) countEl.textContent = count > 0 ? `${count} Bewertung${count === 1 ? "" : "en"}` : "Noch keine Bewertungen";

      stars.forEach((star, i) => {
        star.classList.remove("star-full", "star-half", "star-empty");
        if (avg >= i + 1) star.classList.add("star-full");
        else if (avg >= i + 0.5) star.classList.add("star-half");
        else star.classList.add("star-empty");
      });
    } catch (e) {
      console.warn("Konnte Händlerbewertung nicht laden", e);
    }
  }

  async function ladeBewertungen(nutzerId) {
    const ratingList = document.getElementById("ratingList");
    const toggleWrap = document.getElementById("toggleRatingListWrap");
    const toggleBtn  = document.getElementById("toggleRatingListBtn");

    if (!ratingList || !toggleWrap || !toggleBtn) return;

    if (toggleBtn.dataset.bound === "1") return;
    toggleBtn.dataset.bound = "1";

    ratingList.style.display = "none";
    let visible = false;
    let loaded = false;

    toggleBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Bewertungen anzeigen`;

    toggleBtn.addEventListener("click", async () => {
      visible = !visible;

      if (!visible) {
        ratingList.style.display = "none";
        toggleBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Bewertungen anzeigen`;
        return;
      }

      toggleBtn.innerHTML = `<i class="fas fa-chevron-up"></i> Bewertungen verbergen`;
      ratingList.style.display = "block";

      if (loaded) return;
      loaded = true;

      try {
        const res = await fetch(`/api/bewertungen/${encodeURIComponent(nutzerId)}`, {
          credentials: "include"
        });
        if (!res.ok) throw new Error();

        let data = await res.json();
        if (!Array.isArray(data)) data = [];

        data = data.filter(r => (r.text || "").trim() !== "");

        if (data.length === 0) {
          toggleWrap.style.display = "none";
          ratingList.style.display = "none";
          return;
        }

        ratingList.innerHTML = data.map(rating => {
          const sterne = Number(rating.rating ?? rating.sterne ?? 0);

          const stars = Array.from({ length: 5 }, (_, i) => {
            if (sterne >= i + 1) return '<i class="fas fa-star"></i>';
            if (sterne >= i + 0.5) return '<i class="fas fa-star-half-alt"></i>';
            return '<i class="far fa-star"></i>';
          }).join("");

          const kommentarRaw = (rating.text ?? rating.kommentar ?? "").trim();
          const kommentar = kommentarRaw ? `<p>${escapeHTML(kommentarRaw)}</p>` : "";

          const ts = rating.updatedAt || rating.createdAt || rating.zeitpunkt;
          const dateStr = ts ? new Date(ts).toLocaleDateString("de-DE") : "";

          return `
            <div class="rating-item">
              <div class="stars">${stars}</div>
              ${kommentar}
              ${dateStr ? `<small>${dateStr}</small>` : ""}
            </div>
          `;
        }).join("");

      } catch (err) {
        console.warn("Bewertungen konnten nicht geladen werden", err);
        ratingList.innerHTML = `<div class="rating-item"><small>Fehler beim Laden der Bewertungen.</small></div>`;
      }
    });
  }

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
    const initials = sellerInitials(displayName);

    const nameEl = section.querySelector(".profile-name");
    const initialsEl = section.querySelector(".profile-initials");
    if (nameEl) nameEl.textContent = displayName;
    if (initialsEl) initialsEl.textContent = initials;

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
    if (nutzerData.plz) locParts.push(nutzerData.plz);
    if (nutzerData.ort) locParts.push(nutzerData.ort);
    const location = locParts.join(" ") || nutzerData.standort || "";
    const locationEl = section.querySelector('[data-profile-field="location"]');
    if (locationEl) locationEl.textContent = location || "Ort noch nicht hinterlegt";

    const roleEl = section.querySelector('[data-profile-field="role"]');
    if (roleEl) roleEl.textContent = isHaendler ? "Händlerkonto" : "Privatkonto";

    const memberEl = section.querySelector('[data-profile-field="memberSince"]');
    const createdRaw = nutzerData.erstelltAm || nutzerData.createdAt || nutzerData.created || null;
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
    const totalCount  = activeCount + draftCount;

    const activeEl = section.querySelector('[data-stat="active"]');
    const draftsEl = section.querySelector('[data-stat="drafts"]');
    const totalEl  = section.querySelector('[data-stat="total"]');

    if (activeEl) activeEl.textContent = String(activeCount);
    if (draftsEl) draftsEl.textContent = String(draftCount);
    if (totalEl)  totalEl.textContent  = String(totalCount);
  }
// Builder (Edit-State) – vollständig korrigiert
function buildFahrzeugdatenFromInserat(ins) {
  const marke    = ins?.marke || ins?.verkauf_marke || "";
  const modell   = ins?.modell || ins?.verkauf_modell || "";
  const variante = ins?.variante || ins?.verkauf_variante || ins?.verkauf_ausstattung_variante || "";
  const titel    =
    ins?.titel ||
    ins?.verkauf_titel ||
    (ins?.verkauf_modell ? String(ins.verkauf_modell) : "") ||
    `${marke} ${modell}`.trim();

  // kleine Helfer
  const pick = (...vals) => {
    for (const v of vals) {
      if (v === 0) return 0;
      if (v == null) continue;
      const s = String(v).trim();
      if (s !== "") return v;
    }
    return "";
  };

  return {
    // ===== neue/„Form“-Keys =====
    titel,
    marke,
    modell,
    variante,

    // ===== WICHTIG: verkauf_* Keys immer mitschreiben (Wizard/Legacy) =====
    verkauf_titel: titel,
    verkauf_marke: marke,
    verkauf_modell: modell,
    verkauf_variante: variante,

    // ===== Preise =====
    preis: pick(ins?.preis, ins?.verkauf_preis),
    "brutto-preis": pick(ins?.["brutto-preis"], ins?.verkauf_brutto),
    "netto-preis":  pick(ins?.["netto-preis"],  ins?.verkauf_netto),

    verkauf_preis:  pick(ins?.verkauf_preis, ins?.preis),
    verkauf_brutto: pick(ins?.verkauf_brutto, ins?.["brutto-preis"]),
    verkauf_netto:  pick(ins?.verkauf_netto,  ins?.["netto-preis"]),
    verkauf_mwst:   pick(ins?.verkauf_mwst),

    // ===== Erstzulassung =====
    erstzulassung:         pick(ins?.erstzulassung, ins?.verkauf_erstzulassung),
    verkauf_erstzulassung: pick(ins?.verkauf_erstzulassung, ins?.erstzulassung),

    // ===== Kilometer =====
    kilometer:         (ins?.kilometer ?? ins?.verkauf_kilometer ?? ""),
    verkauf_kilometer: (ins?.verkauf_kilometer ?? ins?.kilometer ?? ""),

    // ===== Leistung =====
    leistung_ps:         (ins?.leistung_ps ?? ins?.verkauf_leistung ?? ins?.leistung ?? ""),
    leistung_kw:         (ins?.leistung_kw ?? ins?.verkauf_leistung_kw ?? ""),
    verkauf_leistung:    (ins?.verkauf_leistung ?? ins?.leistung_ps ?? ins?.leistung ?? ""),
    verkauf_leistung_kw: (ins?.verkauf_leistung_kw ?? ins?.leistung_kw ?? ""),

    // ===== Hubraum =====
    hubraum:         (ins?.hubraum ?? ins?.verkauf_hubraum ?? ""),
    verkauf_hubraum: (ins?.verkauf_hubraum ?? ins?.hubraum ?? ""),

    // ===== Kraftstoff / Getriebe / Antrieb =====
    kraftstoff:         pick(ins?.kraftstoff, ins?.verkauf_kraftstoff),
    verkauf_kraftstoff: pick(ins?.verkauf_kraftstoff, ins?.kraftstoff),

    getriebe:           pick(ins?.getriebe, ins?.verkauf_getriebe),
    verkauf_getriebe:   pick(ins?.verkauf_getriebe, ins?.getriebe),

    antriebsart:     pick(ins?.antriebsart, ins?.antrieb, ins?.verkauf_antrieb),
    verkauf_antrieb: pick(ins?.verkauf_antrieb, ins?.antriebsart, ins?.antrieb),

    // ===== Fahrzeugtyp =====
    fahrzeugtyp:         pick(ins?.fahrzeugtyp, ins?.verkauf_fahrzeugtyp),
    verkauf_fahrzeugtyp: pick(ins?.verkauf_fahrzeugtyp, ins?.fahrzeugtyp),

    // ===== Türen (tueren/türen) =====
    tueren:         pick(ins?.tueren, ins?.["türen"], ins?.türen, ins?.verkauf_tueren),
    "türen":        pick(ins?.["türen"], ins?.türen, ins?.tueren),
    verkauf_tueren: pick(ins?.verkauf_tueren, ins?.tueren, ins?.["türen"], ins?.türen),

    // ===== Partikelfilter =====
    partikelfilter:         pick(ins?.partikelfilter, ins?.verkauf_partikelfilter),
    verkauf_partikelfilter: pick(ins?.verkauf_partikelfilter, ins?.partikelfilter),

    // ===== Verbrauch / CO2 =====
    verbrauch_kombiniert: pick(ins?.verbrauch_kombiniert, ins?.verkauf_verbrauch_kombiniert),
    verbrauch_innerorts:  pick(ins?.verbrauch_innerorts,  ins?.verkauf_verbrauch_innerorts),
    verbrauch_ausserorts: pick(ins?.verbrauch_ausserorts, ins?.verkauf_verbrauch_ausserorts),
    co2_emission:         pick(ins?.co2_emission,         ins?.verkauf_co2_emission),

    verkauf_verbrauch_kombiniert: pick(ins?.verkauf_verbrauch_kombiniert, ins?.verbrauch_kombiniert),
    verkauf_verbrauch_innerorts:  pick(ins?.verkauf_verbrauch_innerorts,  ins?.verbrauch_innerorts),
    verkauf_verbrauch_ausserorts: pick(ins?.verkauf_verbrauch_ausserorts, ins?.verbrauch_ausserorts),
    verkauf_co2_emission:         pick(ins?.verkauf_co2_emission,         ins?.co2_emission),

    // ===== Schadstoff / Plakette / Emission =====
    schadstoffklasse: pick(ins?.schadstoffklasse, ins?.verkauf_schadstoffklasse),
    umweltplakette:   pick(ins?.umweltplakette,   ins?.verkauf_umweltplakette),
    emissionsklasse:  pick(ins?.emissionsklasse,  ins?.verkauf_emissionsklasse),

    verkauf_schadstoffklasse: pick(ins?.verkauf_schadstoffklasse, ins?.schadstoffklasse),
    verkauf_umweltplakette:   pick(ins?.verkauf_umweltplakette,   ins?.umweltplakette),
    verkauf_emissionsklasse:  pick(ins?.verkauf_emissionsklasse,  ins?.emissionsklasse),

    // ===== Verkäuferlabel (für Legacy/UI) =====
    verkauf_verkaeufer: pick(ins?.verkauf_verkaeufer)
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

    const singleVideo = String(ins.video || "").trim();
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

  const inseratById = new Map();

  try {
    const nutzerRes = await fetch("/getNutzerInfo", { credentials: "include" });
    const nutzerData = await nutzerRes.json();
    if (!nutzerData.eingeloggt || !nutzerData.nutzerId) {
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
    ladeHändlerBewertung(nutzerData.nutzerId);
    ladeBewertungen(nutzerData.nutzerId);

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
      wrapper.dataset.id = realId || "";
      wrapper.dataset.status = inserat.__status || "";

      if (realId) inseratById.set(String(realId), inserat);

      const isOnline = wrapper.dataset.status === "online";
      const publishBtnLabel = isOnline ? "Online" : "Veröffentlichen";
      const publishBtnAttrs = isOnline
        ? 'disabled class="publish-btn published" type="button"'
        : 'class="publish-btn" type="button"';

      const titleSafe = escapeHTML(inserat.titel || "Titel fehlt");
      const subtitleSafe = escapeHTML(inserat.verkauf_kurzbeschreibung || "Besondere Ausstattung");

      wrapper.innerHTML = `
        <div class="car-card-actions mobile-only">
          <button ${publishBtnAttrs}><i class="fas fa-globe"></i> ${publishBtnLabel}</button>
          <button class="edit-btn" type="button"><i class="fas fa-pen"></i> Bearbeiten</button>
          <button class="remove-saved-btn" type="button"><i class="fas fa-trash"></i> Entfernen</button>
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
              <h2 class="car-title">${titleSafe}</h2>
              <p class="car-price">${
                formatEUR(inserat.verkauf_brutto) ||
                formatEUR(inserat.verkauf_preis) ||
                formatEUR(inserat.preis) ||
                "Preis fehlt"
              }</p>
            </div>

            <p class="car-subtitle">${subtitleSafe}</p>

            <div class="car-info-grid">
              <p><i class="fas fa-road"></i> ${escapeHTML(String(inserat.verkauf_kilometer ?? "—"))} km</p>
              <p><i class="fas fa-calendar-alt"></i> EZ ${escapeHTML(String(inserat.verkauf_erstzulassung || "—"))}</p>
              <p><i class="fas fa-gas-pump"></i> ${escapeHTML(String(inserat.verkauf_kraftstoff || "—"))}</p>
              <p><i class="fas fa-gauge-high"></i> ${escapeHTML(String(inserat.verkauf_leistung ?? "—"))} PS</p>
              <p><i class="fas fa-gears"></i> ${escapeHTML(String(inserat.verkauf_getriebe || "—"))}</p>
              <p><i class="fas fa-tint"></i> ${escapeHTML(String(inserat.verkauf_verbrauch_kombiniert || "—"))} l/100 km</p>
            </div>

            <div class="dealer-info"></div>
          </div>
        </div>

        <div class="car-card-actions desktop-only">
          <button ${publishBtnAttrs}><i class="fas fa-globe"></i> ${publishBtnLabel}</button>
          <button class="edit-btn" type="button"><i class="fas fa-pen"></i> Bearbeiten</button>
          <button class="remove-saved-btn" type="button"><i class="fas fa-trash"></i> Entfernen</button>
        </div>
      `;

      // Karte klickbar (aber NICHT wenn auf Buttons/Links/Inputs/Arrows geklickt wurde)
      wrapper.addEventListener("click", (e) => {
        const isInteractive = e.target.closest("button, a, input, textarea, select, .media-arrow");
        if (isInteractive) return;

        try { localStorage.setItem("ausgewaehltesInserat", JSON.stringify(inserat)); } catch {}

        const id = wrapper.dataset.id || "";
        window.location.href = id ? `anzeige.html?id=${encodeURIComponent(id)}` : "anzeige.html";
      });

      carList.appendChild(wrapper);

      // Slider NACH dem Einfügen initialisieren (ein System)
      initializeSlider(wrapper);

      // --- Verkäuferzeile (Logo + Name + Standort) ---
      const dealerInfoEl = wrapper.querySelector(".dealer-info");

      const rawType = String(inserat?.seller?.type || inserat?.verkauf_verkaeufer || "").toLowerCase();
      const isHaendler =
        rawType === "haendler" ||
        rawType === "händler" ||
        rawType.includes("händ") ||
        rawType.includes("haend");

      const sellerName =
        inserat?.seller?.name ||
        inserat?.verkauf_name ||
        nutzerData?.firma ||
        nutzerData?.name ||
        (isHaendler ? "Händler" : "Privatanbieter");

      const sellerLocation =
        inserat?.standort ||
        [inserat?.plz, inserat?.ort].filter(Boolean).join(" ") ||
        "Standort nicht angegeben";

      const belongsToMe = String(inserat?.verkaeuferId || "") === String(nutzerData?.nutzerId || "");
      const sellerLogo =
        (typeof inserat?.seller?.logoUrl === "string" && inserat.seller.logoUrl.trim()) ||
        (belongsToMe ? (nutzerData?.logoUrl || "") : "");

      dealerInfoEl.innerHTML = `
        <div class="dealer-row">
          <div class="dealer-avatar">
            <img alt="${escapeHTML(sellerName)} Logo" decoding="async" style="display:block">
            <span class="dealer-initials">${sellerInitials(sellerName)}</span>
          </div>
          <div class="dealer-meta">
            <div class="dealer-name">${escapeHTML(sellerName)}</div>
            <div class="dealer-location">${escapeHTML(sellerLocation)}</div>
          </div>
        </div>
      `;

      const avatar = dealerInfoEl.querySelector(".dealer-avatar");
      const img    = dealerInfoEl.querySelector(".dealer-avatar img");

      avatar.classList.remove("has-logo");
      img.removeAttribute("src");

      if (sellerLogo) {
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

        if (img.complete && img.naturalWidth > 0) {
          avatar.classList.add("has-logo");
        }
      }

      // Hochformat-Erkennung (optional)
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
    });

    // =========================
    // BEARBEITEN – EINMALIG per Delegation
    // =========================
    if (document.documentElement.dataset.uebersichtEditDelegation !== "1") {
      document.documentElement.dataset.uebersichtEditDelegation = "1";

      document.addEventListener("click", (e) => {
        const btn = e.target.closest(".edit-btn");
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const wrapper = btn.closest(".car-card-wrapper");
        if (!wrapper) return;

        const realId = String(wrapper.dataset.id || "").trim();
        if (!realId) return alert("ID fehlt");

        const inserat = inseratById.get(realId);
        if (!inserat) return alert("Inserat nicht gefunden.");

        try {
          localStorage.setItem("editMode", "1");
          localStorage.setItem("editInseratId", realId);

          localStorage.setItem("fahrzeugdaten", JSON.stringify(buildFahrzeugdatenFromInserat(inserat)));
          localStorage.setItem("fahrzeugdetails", JSON.stringify(buildFahrzeugdetailsFromInserat(inserat)));
          localStorage.setItem("medien", JSON.stringify(buildMedienFromInserat(inserat)));

          sessionStorage.setItem("editPending", "1"); // erst auf haendler/privat landen, dann Schritt wählen


          const roleRaw = String(nutzerData?.role || nutzerData?.rolle || "privat").toLowerCase();
          const isHaendlerUser = roleRaw.includes("haend") || roleRaw.includes("händ");

          const typeRaw = String(inserat?.seller?.type || inserat?.verkauf_verkaeufer || "").toLowerCase();
          const isHaendlerInserat = typeRaw.includes("haend") || typeRaw.includes("händ");
          
          const ziel = (isHaendlerUser || isHaendlerInserat) ? "haendler.html" : "privat.html";
          window.location.href = `${ziel}?edit=${encodeURIComponent(realId)}`;
          
          
        } catch (err) {
          console.warn("Konnte Edit-State nicht setzen:", err);
          alert("Fehler beim Bearbeiten.");
        }
      }, true);
    }

    // Entfernen (UI-only)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-saved-btn");
      if (!btn) return;
      const wrapper = btn.closest(".car-card-wrapper");
      if (!wrapper) return;
      e.stopPropagation();
      if (confirm("Möchtest du dieses Fahrzeug wirklich entfernen?")) wrapper.remove();
    });

  } catch (error) {
    console.error("Fehler beim Laden der Inserate:", error);
  }
});

/* =========================================================
   Veröffentlichen (nur für Entwürfe) – Delegation
   ========================================================= */
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
      button.innerHTML = `<i class="fas fa-globe"></i> Online`;
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

/* =========================================================
   Nachrichten
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
      verkauf_verkaeufer: "",
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

  // besser: auch verkauf_* berücksichtigen, falls vorhanden
  const rawPrice = ins?.verkauf_brutto ?? ins?.verkauf_preis ?? ins?.preis;
  const preis = formatEUR(rawPrice);

  const chatUrl = `chat.html?user1=${encodeURIComponent(currentUserId)}&user2=${encodeURIComponent(msg.senderId)}&fahrzeugId=${encodeURIComponent(msg.fahrzeugId)}`;

  return `
    <div class="car-card-wrapper" data-msg-id="${escapeHTML(String(msg.id || ""))}">
      <div class="car-card horizontal">
        <div class="car-card-media">
          <div class="media-container">
            <div class="slides">
              ${firstImg ? `<img src="${escapeHTML(firstImg)}" alt="Bild" class="slide">` : ""}
            </div>
          </div>
        </div>
        <div class="car-details">
          <div class="car-top-row">
            <h2 class="car-title">${escapeHTML(ins.titel || "Ohne Titel")}</h2>
            <p class="car-price">${preis || ""}</p>
          </div>
          <p class="car-subtitle">${escapeHTML(ins.verkauf_kurzbeschreibung || "")}</p>
          <div class="car-info-grid">
            <p><i class="fas fa-road"></i> ${escapeHTML(String(ins.verkauf_kilometer ?? "—"))} km</p>
            <p><i class="fas fa-calendar-alt"></i> EZ ${escapeHTML(String(ins.verkauf_erstzulassung || "—"))}</p>
            <p><i class="fas fa-gas-pump"></i> ${escapeHTML(String(ins.verkauf_kraftstoff || "—"))}</p>
            <p><i class="fas fa-gauge-high"></i> ${escapeHTML(String(ins.verkauf_leistung ?? "—"))} PS</p>
            <p><i class="fas fa-gears"></i> ${escapeHTML(String(ins.verkauf_getriebe || "—"))}</p>
            ${ins.verkauf_verbrauch_kombiniert ? `<p><i class="fas fa-tint"></i> ${escapeHTML(String(ins.verkauf_verbrauch_kombiniert))} l/100 km</p>` : ""}
          </div>
          <div class="dealer-info">
            <strong>${escapeHTML(ins.verkauf_name || "Anbieter")}</strong><br>
            ${escapeHTML(ins.standort || "")}
          </div>
        </div>
      </div>

      <div class="car-card-actions desktop-only">
        <p class="interested-user">
          <i class="fas fa-user"></i>
          Nachricht von <strong>${escapeHTML(msg.absenderName || "Unbekannt")}</strong>
        </p>
        <a href="${chatUrl}" class="chat-btn"><i class="fas fa-comments"></i> Zum Chat</a>
        <button class="mark-read-btn" data-id="${escapeHTML(String(msg.id || ""))}">
          <i class="fas fa-check"></i> Als gelesen
        </button>
      </div>

      <div class="car-card-actions mobile-only">
        <p class="interested-user">
          <i class="fas fa-user"></i>
          Nachricht von <strong>${escapeHTML(msg.absenderName || "Unbekannt")}</strong>
        </p>
        <a href="${chatUrl}" class="chat-btn"><i class="fas fa-comments"></i> Zum Chat</a>
        <button class="mark-read-btn" data-id="${escapeHTML(String(msg.id || ""))}">
          <i class="fas fa-check"></i> Als gelesen
        </button>
      </div>
    </div>
  `;
}

async function loadMessagesSection() {
  const messagesSection = document.getElementById("messages-list");
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

    inbox.sort((a,b) => new Date(b.zeit) - new Date(a.zeit));

    messagesSection.innerHTML = inbox.map(msg => {
      const ins = detailsMap.get(msg.fahrzeugId) || {};
      return renderMessageCard(msg, ins, user.nutzerId);
    }).join("");

    // falls du später hier Slider brauchst:
    // initializeSlider(messagesSection);

  } catch (e) {
    console.error(e);
    messagesSection.innerHTML = `<p>Fehler beim Laden der Nachrichten.</p>`;
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

/* =========================================================
   Saved Cars
   ========================================================= */
function buildSavedCardHTML(inserat, userId) {
  const savedDocId = String(inserat?._id || "").trim();

  const fahrzeugId = String(
    inserat?.fahrzeugId || inserat?._id || ""
  ).trim();

  const title =
    inserat?.titel ||
    [inserat?.verkauf_marke, inserat?.verkauf_modell, inserat?.verkauf_variante]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Inserat";

  // WICHTIG: Kein ||-Chain mit formatEUR("—") mehr – wir nehmen die erste echte Zahl
  const rawPrice = inserat?.verkauf_brutto ?? inserat?.verkauf_preis ?? inserat?.preis;
  const price = formatEUR(rawPrice) || "—";

  const ez = formatEZ(inserat?.verkauf_erstzulassung || inserat?.erstzulassung);
  const km = formatKm(inserat?.verkauf_kilometer ?? inserat?.kilometer);
  const ps = inserat?.verkauf_leistung ? `${inserat.verkauf_leistung} PS` : "— PS";
  const fuel = inserat?.verkauf_kraftstoff || inserat?.kraftstoff || "—";
  const getriebe = inserat?.verkauf_getriebe || inserat?.getriebe || "—";

  const verbrauchRaw = inserat?.verkauf_verbrauch_kombiniert || inserat?.verbrauch_kombiniert || "";
  const verbrauch = verbrauchRaw
    ? (String(verbrauchRaw).includes("l/100") ? String(verbrauchRaw) : `${verbrauchRaw} l/100 km`)
    : "— l/100 km";

  const subtitle =
    (inserat?.verkauf_kurzbeschreibung || inserat?.kurzbeschreibung || "").trim() ||
    "Besondere Ausstattung";

  const standort = (inserat?.verkauf_standort || inserat?.standort || "").trim();
  const ort = (inserat?.verkauf_ort || inserat?.ort || "").trim();
  const plz = (inserat?.verkauf_plz || inserat?.plz || "").trim();
  const location = standort || [plz, ort].filter(Boolean).join(" ").trim() || "—";

  const sellerName =
    inserat?.seller?.name ||
    inserat?.sellerName ||
    inserat?.verkauf_name ||
    (String(inserat?.verkauf_verkaeufer || "").toLowerCase().includes("händ") ? "Händler" : "Privat");

  const sellerId = String(inserat?.verkaeuferId || inserat?.seller?.id || "").trim();
  const uid = String(userId || "").trim();

  const chatHref = (uid && sellerId && fahrzeugId)
    ? `chat.html?user1=${encodeURIComponent(uid)}&user2=${encodeURIComponent(sellerId)}&fahrzeugId=${encodeURIComponent(fahrzeugId)}`
    : `anzeige.html?id=${encodeURIComponent(fahrzeugId)}`;

  return `
    <div class="car-card-wrapper"
         data-saved-id="${escapeHTML(savedDocId)}"
         data-fahrzeug-id="${escapeHTML(fahrzeugId)}">

      <div class="car-card-actions mobile-only">
        <a href="${chatHref}" class="contact-btn">
          <i class="fas fa-comments"></i> Kontakt aufnehmen
        </a>
        <button class="remove-saved-btn" type="button" data-fahrzeug-id="${escapeHTML(fahrzeugId)}">
          <i class="fas fa-heart-broken"></i> Entfernen
        </button>
      </div>

      <div class="car-card horizontal">
        <div class="car-card-media">
          <div class="media-container">
            <div class="slides">
              ${generateSlides(inserat)}
            </div>
            <button class="media-arrow left" type="button" aria-label="Zurück">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="media-arrow right" type="button" aria-label="Weiter">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <div class="car-details">
          <div class="car-top-row">
            <h2 class="car-title">${escapeHTML(title)}</h2>
            <p class="car-price">${escapeHTML(price)}</p>
          </div>

          <p class="car-subtitle">${escapeHTML(subtitle)}</p>

          <div class="car-info-grid">
            <p><i class="fas fa-road"></i> ${escapeHTML(km)}</p>
            <p><i class="fas fa-calendar-alt"></i> EZ ${escapeHTML(ez)}</p>
            <p><i class="fas fa-gas-pump"></i> ${escapeHTML(fuel)}</p>
            <p><i class="fas fa-gauge-high"></i> ${escapeHTML(ps)}</p>
            <p><i class="fas fa-gears"></i> ${escapeHTML(getriebe)}</p>
            <p><i class="fas fa-tint"></i> ${escapeHTML(verbrauch)}</p>
          </div>

          <div class="dealer-info">
            <strong>${escapeHTML(sellerName)}</strong><br>
            ${escapeHTML(location)}
          </div>
        </div>
      </div>

      <div class="car-card-actions desktop-only">
        <a href="${chatHref}" class="contact-btn">
          <i class="fas fa-comments"></i> Kontakt aufnehmen
        </a>
        <button class="remove-saved-btn" type="button" data-fahrzeug-id="${escapeHTML(fahrzeugId)}">
          <i class="fas fa-heart-broken"></i> Entfernen
        </button>
      </div>
    </div>
  `;
}

async function loadSavedCarsSection() {
  const section = document.getElementById("saved-cars");
  if (!section) return;

  const loadingEl = document.getElementById("savedCarsLoading");
  const listEl = document.getElementById("savedCarsList");
  const emptyEl = document.getElementById("savedCarsEmpty");

  if (listEl) listEl.innerHTML = "";
  emptyEl?.classList.add("hidden");
  loadingEl?.classList.remove("hidden");

  try {
    const user = await getLoggedInUser();
    const userId = user?.nutzerId || user?.id;
    if (!userId) {
      window.location.href = "login.html";
      return;
    }

    const res = await fetch("/saved/list", { credentials: "include" });
    if (!res.ok) throw new Error("saved/list failed");

    const inserate = await res.json();
    loadingEl?.classList.add("hidden");

    if (!Array.isArray(inserate) || inserate.length === 0) {
      emptyEl?.classList.remove("hidden");
      return;
    }

    inserate.forEach((inserat) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = buildSavedCardHTML(inserat, userId);

      const cardWrap = tmp.firstElementChild;
      if (!cardWrap) return;

      // Klick auf Karte -> Inserat öffnen (aber nicht bei Buttons/Links)
      cardWrap.addEventListener("click", (e) => {
        const isInteractive = e.target.closest("button, a, input, textarea, select, .media-arrow");
        if (isInteractive) return;

        const fahrzeugId = cardWrap.getAttribute("data-fahrzeug-id") || "";
        try { localStorage.setItem("ausgewaehltesInserat", JSON.stringify(inserat)); } catch {}
        window.location.href = `anzeige.html?id=${encodeURIComponent(fahrzeugId)}`;
      });

      // Entfernen
      cardWrap.querySelectorAll(".remove-saved-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();

          const fahrzeugId = btn.getAttribute("data-fahrzeug-id");
          if (!fahrzeugId) return;

          const r = await fetch("/saved/toggle", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fahrzeugId })
          });

          if (!r.ok) return;

          const data = await r.json();
          if (data?.saved === false) {
            cardWrap.remove();
            if (listEl && !listEl.querySelector(".car-card-wrapper")) {
              emptyEl?.classList.remove("hidden");
            }
          }
        });
      });

      listEl.appendChild(cardWrap);

      // Slider init (Swipe + Pfeile)
      initializeSlider(cardWrap);
    });

  } catch (e) {
    console.error(e);
    loadingEl?.classList.add("hidden");
    if (listEl) listEl.innerHTML = `<p>Fehler beim Laden der gespeicherten Inserate.</p>`;
  }
}





