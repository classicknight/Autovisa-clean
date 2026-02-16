
// uebersicht.js (klick-only, kein Hover-Open)
document.documentElement.classList.remove("no-js");

/* =========================================================
   Shared Utils (global, damit ALLE Bereiche dieselben Helfer nutzen)
   ========================================================= */

let cachedMyInserate = [];
let cachedUserData = null;

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

function sanitizeImpressumHTML(input = "") {
  const raw = String(input || "");
  if (!raw.trim()) return "";

  const hasTags = /<[^>]+>/.test(raw);
  const source = hasTags
    ? raw
    : escapeHTML(raw).replace(/\r\n/g, "\n").replace(/\n/g, "<br>");

  const allowedTags = new Set([
    "B","STRONG","I","EM","BR","P","DIV"
  ]);

  const doc = new DOMParser().parseFromString(source, "text/html");
  const walk = (node) => {
    [...node.children].forEach((child) => {
      if (!allowedTags.has(child.tagName)) {
        const frag = document.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        child.replaceWith(frag);
        return;
      }

      [...child.attributes].forEach((attr) => {
        child.removeAttribute(attr.name);
      });

      walk(child);
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

// WICHTIG: gibt "" zurück wenn leer -> damit || Fallbacks funktionieren
function formatEUR(value) {
  if (value == null || value === "") return "";
  const num = parseFloat(String(value).replace(/\./g, "").replace(",", "."));
  if (!isNaN(num)) return num.toLocaleString("de-DE") + " €";
  return String(value) + " €";
}

function extractPriceValue(obj) {
  const unwrap = (v) => {
    if (v == null) return null;
    if (typeof v === "object") {
      if (typeof v.value === "number" || typeof v.value === "string") return v.value;
      if (typeof v.amount === "number" || typeof v.amount === "string") return v.amount;
      if (typeof v.$numberDecimal === "string") return v.$numberDecimal;
    }
    return v;
  };

  const candidates = [
    obj?.verkauf_brutto,
    obj?.verkauf_preis,
    obj?.preis,
    obj?.verkauf_netto,
    obj?.["netto-preis"],
    obj?.["brutto-preis"],
    obj?.brutto_preis,
    obj?.netto_preis,
    obj?.price,
    obj?.price_eur,
  ];

  for (const c of candidates) {
    const v = unwrap(c);
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    return v;
  }
  return "";
}

function hasMwstHint(obj) {
  const raw =
    obj?.verkauf_mwst ??
    obj?.mwst ??
    obj?.mwst_type ??
    obj?.mwstType ??
    obj?.raw?.verkauf_mwst ??
    obj?.raw?.mwst ??
    obj?.raw?.mwst_type ??
    obj?.raw?.mwstType ??
    "";

  if (raw === true) return true;
  if (raw === false) return false;

  const str = String(raw || "").trim();
  if (!str) return false;
  const low = str.toLowerCase();
  if (low.includes("keine") || low.includes("nicht")) return false;
  if (low.includes("zzgl")) return true;
  if (low.includes("inkl")) return true;
  if (low.includes("mwst") || low.includes("ust")) return true;
  return false;
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

function formatDateShort(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE");
}

function getListingTimestamp(ins) {
  const candidates = [
    ins?.updatedAt,
    ins?.veroeffentlichtAm,
    ins?.createdAt,
    ins?.erstelltAm,
    ins?.lastEditedAt,
    ins?.publishedAt
  ];
  let best = 0;
  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!Number.isNaN(t)) best = Math.max(best, t);
  }
  return best;
}

function sellerInitials(name = "") {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const ini = parts.map(p => p[0]?.toUpperCase() || "").join("");
  return ini || "AV";
}

function applyDealerAvatar(avatarEl, imgEl, logoUrl) {
  if (!avatarEl || !imgEl) return;

  avatarEl.classList.remove("has-logo");
  imgEl.removeAttribute("src");

  if (!logoUrl) return;

  try { imgEl.loading = "eager"; } catch {}

  imgEl.addEventListener("load", () => {
    if (imgEl.naturalWidth > 0) avatarEl.classList.add("has-logo");
  }, { once: true });

  imgEl.addEventListener("error", () => {
    avatarEl.classList.remove("has-logo");
    imgEl.removeAttribute("src");
  }, { once: true });

  imgEl.src = logoUrl;

  if (imgEl.complete && imgEl.naturalWidth > 0) {
    avatarEl.classList.add("has-logo");
  }
}

function fmtRating(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1).replace(".", ",") : "";
}

function starsHTML(avg) {
  const a = Number(avg);
  if (!Number.isFinite(a) || a <= 0) return "";
  let out = `<span class="stars" aria-hidden="true">`;
  for (let i = 1; i <= 5; i++) {
    if (a >= i - 0.25) out += `<i class="fa-solid fa-star"></i>`;
    else if (a >= i - 0.75) out += `<i class="fa-solid fa-star-half-stroke"></i>`;
    else out += `<i class="fa-regular fa-star"></i>`;
  }
  out += `</span>`;
  return out;
}

function ratingBlock({ isHaendler, avg, count }) {
  const c = Number(count);
  const a = Number(avg);

  if (!isHaendler) return "";
  if (!Number.isFinite(c) || c <= 0) return "";
  if (!Number.isFinite(a) || a <= 0) return "";

  const label = `Bewertung ${fmtRating(a)} von 5 Sternen (${c} Bewertungen)`;
  return `
    <div class="dealer-rating" aria-label="${label}">
      ${starsHTML(a)}
      <span class="dealer-rating__value">${fmtRating(a)}</span>
      <span class="dealer-rating__count" title="${c} Bewertungen">(${c})</span>
    </div>
  `;
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
function initMediaSlider(container) {
  if (!container) return;

  // nicht doppelt initialisieren
  if (container.dataset.sliderInit === "1") return;
  container.dataset.sliderInit = "1";

  const slidesWrapper = container.querySelector(".slides");
  if (!slidesWrapper) return;

  const slides = Array.from(slidesWrapper.children || []);
  if (!slides.length) return;

  const state = {
    index: 0,
    dragging: false,
    axis: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    prevTranslate: 0,
    currentTranslate: 0,
    blockClickUntil: 0,
    hadRealSwipe: false,
    captured: false,
  };

  slidesWrapper.style.display = "flex";
  slidesWrapper.style.willChange = "transform";
  slides.forEach((slide) => {
    slide.style.flex = "0 0 100%";
    slide.style.minWidth = "100%";
  });

  const btnLeft = container.querySelector(".media-arrow.left");
  const btnRight = container.querySelector(".media-arrow.right");

  const width = () => (container.getBoundingClientRect().width || container.clientWidth || 1);

  const setTranslate = (x, animate) => {
    slidesWrapper.style.transition = animate
      ? "transform 0.28s cubic-bezier(.2,.8,.2,1)"
      : "none";
    slidesWrapper.style.transform = `translateX(${x}px)`;
  };

  const updateArrows = () => {
    if (btnLeft) btnLeft.disabled = state.index <= 0;
    if (btnRight) btnRight.disabled = state.index >= slides.length - 1;
  };

  const pauseInactiveVideos = () => {
    slides.forEach((s, idx) => {
      const v = s?.tagName === "VIDEO" ? s : s?.querySelector?.("video");
      if (!v) return;
      if (idx !== state.index && !v.paused) {
        try { v.pause(); } catch {}
      }
    });
  };

  const snapTo = (i, animate = true) => {
    state.index = Math.max(0, Math.min(i, slides.length - 1));
    state.prevTranslate = -state.index * width();
    state.currentTranslate = state.prevTranslate;
    setTranslate(state.currentTranslate, animate);
    updateArrows();
    pauseInactiveVideos();
  };

  // Swipe → Click block (nur nach echtem Swipe)
  container.addEventListener("click", (e) => {
    if (Date.now() < state.blockClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  const startDrag = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target?.closest?.(".media-arrow")) return;

    state.dragging = true;
    state.axis = null;
    state.pointerId = e.pointerId ?? null;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.hadRealSwipe = false;

    state.captured = false;
    slidesWrapper.style.transition = "none";
  };

  const moveDrag = (e) => {
    if (!state.dragging) return;
    if (state.pointerId != null && e.pointerId != null && e.pointerId !== state.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (state.axis == null) {
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx < 6 && ady < 6) return;

      state.axis = adx > ady ? "x" : "y";
      if (state.axis === "y") {
        state.dragging = false;
        state.pointerId = null;
        return;
      }

      if (!state.captured && e.pointerId != null && container.setPointerCapture) {
        try {
          container.setPointerCapture(e.pointerId);
          state.captured = true;
        } catch {}
      }
    }

    if (state.axis !== "x") return;

    if (Math.abs(dx) > 10) state.hadRealSwipe = true;
    if (e.cancelable) e.preventDefault();

    state.currentTranslate = state.prevTranslate + dx;
    setTranslate(state.currentTranslate, false);
  };

  const endDrag = (e) => {
    if (!state.dragging) return;
    if (state.pointerId != null && e?.pointerId != null && e.pointerId !== state.pointerId) return;

    state.dragging = false;

    const movedBy = state.currentTranslate - state.prevTranslate;
    const w = width();
    const threshold = Math.max(40, w * 0.12);

    if (movedBy < -threshold && state.index < slides.length - 1) state.index++;
    else if (movedBy > threshold && state.index > 0) state.index--;

    state.blockClickUntil = state.hadRealSwipe ? Date.now() + 220 : 0;

    snapTo(state.index, true);

    if (state.captured && e?.pointerId != null && container.releasePointerCapture) {
      try { container.releasePointerCapture(e.pointerId); } catch {}
    }

    state.pointerId = null;
    state.axis = null;
    state.captured = false;
    state.hadRealSwipe = false;
  };

  container.addEventListener("pointerdown", startDrag, { passive: false });
  container.addEventListener("pointermove", moveDrag, { passive: false });
  container.addEventListener("pointerup", endDrag, { passive: true });
  container.addEventListener("pointercancel", endDrag, { passive: true });
  container.addEventListener("pointerleave", endDrag, { passive: true });

  btnRight?.addEventListener("click", (e) => {
    e.stopPropagation();
    snapTo(state.index + 1, true);
  });

  btnLeft?.addEventListener("click", (e) => {
    e.stopPropagation();
    snapTo(state.index - 1, true);
  });

  window.addEventListener("resize", () => snapTo(state.index, false), { passive: true });

  snapTo(0, false);
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
  const authLi        = document.getElementById("auth-link");
  const authLoginHTML = authLi ? authLi.innerHTML : "";

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

  const closeMenu = () => {
    navLinks?.classList.remove("active");
    hamburger?.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  };

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
    closeMenu();
  });

  const repositionOpen = () =>
    document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  /* =========================
     Auth UI (Login/Logout Button)
     ========================= */
  const clearAuthStorage = () => {
    ["isLoggedIn", "userRole", "userId"].forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("redirectAfterLogin");
  };

  const clearAuthFlags = () => {
    ["isLoggedIn", "userRole", "userId"].forEach((k) => localStorage.removeItem(k));
  };

  function renderLogin() {
    if (!authLi) return;
    authLi.innerHTML = authLoginHTML;
  }

  function renderLogout() {
    if (!authLi) return;
    authLi.innerHTML = `
      <a href="#" class="nav-link" id="logout-link">
        <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
        <span>Abmelden</span>
      </a>
    `;
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
      logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        closeMenu();
        fetch("/logout", { method: "POST", credentials: "include" })
          .finally(() => {
            clearAuthStorage();
            window.location.href = "index.html";
          });
      });
    }
  }

  if (authLi) {
    const isLoggedInLS = localStorage.getItem("isLoggedIn") === "true";
    if (isLoggedInLS) {
      renderLogout();
    }
  }

  fetch("/getNutzerInfo", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (data?.eingeloggt) {
        try {
          localStorage.setItem("isLoggedIn", "true");
          const roleValue = data?.role || data?.rolle;
          if (roleValue) localStorage.setItem("userRole", String(roleValue));
          const userIdValue = data?.id || data?._id || data?.userId || data?.nutzerId;
          if (userIdValue) localStorage.setItem("userId", String(userIdValue));
        } catch {}
        renderLogout();
      } else {
        clearAuthFlags();
        renderLogin();
      }
    })
    .catch(() => {});

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

  const chatButton = "";

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
    if (sectionName === "sold-cars") loadSoldCarsSection();
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
     Impressum Editor (Modal)
     ========================= */
  const impressumModal = document.getElementById("impressumModal");
  const impressumEditor = document.getElementById("impressumEditor");
  const impressumSaveBtn = document.getElementById("impressumSave");
  const impressumCancelBtn = document.getElementById("impressumCancel");
  const impressumBackdrop = impressumModal?.querySelector("[data-close]");
  const impressumToolbar = impressumModal?.querySelector(".impressum-toolbar");
  const impressumValueEl = document.querySelector('[data-profile-field="impressum"]');
  const impressumEditBtn = document.querySelector('[data-edit-type="impressum"]');

  function openImpressumModal() {
    if (!impressumModal || !impressumEditor || !impressumValueEl) return;
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {}

    const raw = impressumValueEl.dataset.rawImpressum || "";
    const html = sanitizeImpressumHTML(raw);
    impressumEditor.innerHTML = html || "";

    impressumModal.classList.add("show");
    impressumModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    setTimeout(() => {
      impressumEditor.focus();
      updateImpressumToolbarState();
    }, 50);
  }

  function closeImpressumModal() {
    if (!impressumModal) return;
    impressumModal.classList.remove("show");
    impressumModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function applySpanClass(className) {
    if (!impressumEditor) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString();
    if (!text) return;
    const html = `<span class="${className}">${escapeHTML(text)}</span>`;
    try {
      document.execCommand("insertHTML", false, html);
    } catch {}
  }

  function handleImpressumCommand(cmd) {
    if (!impressumEditor) return;
    impressumEditor.focus();

    switch (cmd) {
      case "bold":
        document.execCommand("bold");
        break;
      case "italic":
        document.execCommand("italic");
        break;
      case "p":
        document.execCommand("formatBlock", false, "p");
        break;
      default:
        break;
    }
  }

  function updateImpressumToolbarState() {
    if (!impressumToolbar || !impressumEditor) return;

    const selection = window.getSelection();
    const anchor = selection?.anchorNode || null;
    if (!anchor || !impressumEditor.contains(anchor)) {
      impressumToolbar.querySelectorAll(".impressum-tool").forEach((btn) => {
        btn.classList.remove("is-active");
      });
      return;
    }

    let formatBlock = "";
    try {
      formatBlock = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
    } catch {}

    const isBold = !!document.queryCommandState("bold");
    const isItalic = !!document.queryCommandState("italic");
    const isNormal = !formatBlock || formatBlock === "p" || formatBlock === "div";

    const setActive = (cmd, active) => {
      const btn = impressumToolbar.querySelector(`.impressum-tool[data-cmd="${cmd}"]`);
      if (btn) btn.classList.toggle("is-active", !!active);
    };

    setActive("bold", isBold);
    setActive("italic", isItalic);
    setActive("p", isNormal);
  }

  if (impressumToolbar) {
    impressumToolbar.addEventListener("click", (e) => {
      const btn = e.target.closest(".impressum-tool");
      if (!btn) return;
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      if (cmd) handleImpressumCommand(cmd);
      updateImpressumToolbarState();
    });
  }

  if (impressumEditBtn) {
    impressumEditBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openImpressumModal();
      updateImpressumToolbarState();
    });
  }

  if (impressumEditor) {
    impressumEditor.addEventListener("keyup", updateImpressumToolbarState);
    impressumEditor.addEventListener("mouseup", updateImpressumToolbarState);
    impressumEditor.addEventListener("input", updateImpressumToolbarState);
  }

  document.addEventListener("selectionchange", () => {
    if (!impressumModal?.classList.contains("show")) return;
    updateImpressumToolbarState();
  });

  if (impressumCancelBtn) impressumCancelBtn.addEventListener("click", closeImpressumModal);
  if (impressumBackdrop) impressumBackdrop.addEventListener("click", closeImpressumModal);

  if (impressumSaveBtn) {
    impressumSaveBtn.addEventListener("click", async () => {
      if (!impressumEditor || !impressumValueEl) return;
      const rawHtml = impressumEditor.innerHTML || "";
      const sanitized = sanitizeImpressumHTML(rawHtml);

      if (sanitized) {
        impressumValueEl.innerHTML = sanitized;
        impressumValueEl.dataset.rawImpressum = sanitized;
      } else {
        impressumValueEl.textContent = "Noch kein Impressum hinterlegt";
        impressumValueEl.dataset.rawImpressum = "";
      }

      const result = await saveProfileField("impressum", sanitized);
      if (!result?.ok) return;
      closeImpressumModal();
    });
  }

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

      if (fieldKey === "impressum") {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openImpressumModal();
        });
        return;
      }

      function enterEditMode() {
        group.classList.add("is-editing");
        valueEl.dataset.originalValue = valueEl.textContent.trim();
        valueEl.setAttribute("contenteditable", "true");

        const range = document.createRange();
        range.selectNodeContents(valueEl);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        valueEl.focus();
      }

      async function exitEditMode(save) {
        group.classList.remove("is-editing");
        valueEl.setAttribute("contenteditable", "false");
        if (save) {
          const newValue = valueEl.textContent.trim();
          const result = await saveProfileField(fieldKey, newValue);
          if (!result?.ok) {
            const fallback = valueEl.dataset.originalValue;
            if (typeof fallback === "string") valueEl.textContent = fallback;
            return;
          }
          if (fieldKey === "address") {
            const normalized = result?.data?.normalizedAddress;
            if (normalized) valueEl.textContent = normalized;

            const addr = result?.data?.address || null;
            if (addr?.postcode || addr?.city) {
              const locationEl = document.querySelector('[data-profile-field="location"]');
              const loc = [addr?.postcode, addr?.city].filter(Boolean).join(" ");
              if (locationEl && loc) locationEl.textContent = loc;
            }
          }
        }
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isEditing = group.classList.contains("is-editing");
        if (!isEditing) enterEditMode();
        else void exitEditMode(true);
      });

      valueEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const allowNewline = fieldKey === "impressum" && e.shiftKey;
          if (!allowNewline) {
            e.preventDefault();
            void exitEditMode(true);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          void exitEditMode(false);
        }
      });

      valueEl.addEventListener("blur", () => {
        if (group.classList.contains("is-editing")) void exitEditMode(true);
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

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg =
          data?.error ||
          data?.message ||
          "Profil-Update fehlgeschlagen.";
        console.error("Profil-Update fehlgeschlagen:", msg);
        alert(msg);
        return { ok: false, error: msg, data };
      }

      return { ok: true, data };
    } catch (err) {
      console.error("Netzwerkfehler beim Profil-Update:", err);
      alert("Netzwerkfehler beim Speichern. Bitte erneut versuchen.");
      return { ok: false, error: "Netzwerkfehler" };
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

  // CSV-Import (Händler)
  function setupDealerCsvImport() {
    const fileEl = document.getElementById("dealerCsvFile");
    const btnPreview = document.getElementById("dealerCsvPreview");
    const btnImport = document.getElementById("dealerCsvImport");
    const statusEl = document.getElementById("dealerCsvStatus");
    const summaryEl = document.getElementById("dealerCsvSummary");
    const errorsEl = document.getElementById("dealerCsvErrors");

    if (!fileEl || !btnPreview || !btnImport) return;

    const MAX_CSV_SIZE = 8 * 1024 * 1024;
    const ALLOWED_EXT = [".csv", ".tsv", ".txt", ".json", ".jsonl", ".ndjson"];
    const ALLOWED_TYPES = [
      "text/csv",
      "application/vnd.ms-excel",
      "text/plain",
      "application/json",
      "application/x-ndjson",
      "application/jsonl"
    ];

    let lastFile = null;
    let lastPreviewOk = false;

    const setStatus = (msg = "") => {
      if (statusEl) statusEl.textContent = msg;
    };

    const clearSummary = () => {
      if (!summaryEl) return;
      summaryEl.classList.remove("is-visible");
      summaryEl.innerHTML = "";
    };

    const clearErrors = () => {
      if (!errorsEl) return;
      errorsEl.classList.remove("is-visible");
      errorsEl.innerHTML = "";
    };

    const renderSummary = (s) => {
      if (!summaryEl) return;
      if (!s) {
        clearSummary();
        return;
      }
      summaryEl.classList.add("is-visible");
      const delim = s?.delimiter === ";" ? "Semikolon" : (s?.delimiter === "\t" ? "Tab" : "Komma");
      const format = s?.format ? String(s.format).toUpperCase() : "";
      summaryEl.innerHTML =
        `Neu: <b>${s?.newCount ?? 0}</b> · ` +
        `Updates: <b>${s?.updateCount ?? 0}</b> · ` +
        `Fehler: <b>${s?.errorCount ?? 0}</b> · ` +
        `Zeilen: <b>${s?.total ?? 0}</b>` +
        `${format ? ` · Format: <b>${format}</b>` : ""}` +
        `${s?.delimiter ? ` · Trennzeichen: <b>${delim}</b>` : ""}`;
    };

    const renderErrors = (errs = []) => {
      if (!errorsEl) return;
      if (!Array.isArray(errs) || errs.length === 0) {
        clearErrors();
        return;
      }
      const maxShown = 6;
      const items = errs.slice(0, maxShown).map((e) => {
        const row = escapeHTML(String(e?.row ?? "—"));
        const msg = escapeHTML(String(e?.message ?? "Unbekannter Fehler"));
        return `<li><b>Zeile ${row}</b>: ${msg}</li>`;
      }).join("");
      const more = errs.length > maxShown
        ? `<div class="muted">… ${errs.length - maxShown} weitere Fehler (gekürzt)</div>`
        : "";
      errorsEl.classList.add("is-visible");
      errorsEl.innerHTML = `
        <div><b>Fehler in der CSV</b></div>
        <ul>${items}</ul>
        ${more}
      `;
    };

    const validateFile = (file) => {
      if (!file) return { ok: false, message: "Bitte zuerst eine CSV auswählen." };
      const name = String(file.name || "");
      const dot = name.lastIndexOf(".");
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
      const type = String(file.type || "");
      const extOk = ALLOWED_EXT.includes(ext);
      const typeOk = !type || ALLOWED_TYPES.includes(type);
      if (!extOk && !typeOk) {
        return { ok: false, message: "Bitte eine CSV/TSV-Datei hochladen." };
      }
      if (file.size > MAX_CSV_SIZE) {
        return { ok: false, message: "Datei ist zu groß (max. 8 MB)." };
      }
      return { ok: true };
    };

    const redirectToLogin = () => {
      try {
        localStorage.setItem("redirectAfterLogin", `übersicht.html${location.hash || ""}`);
      } catch {}
      window.location.href = "login.html";
    };

    const handleResponse = async (res, label) => {
      if (res.status === 401 || res.status === 403) {
        redirectToLogin();
        throw new Error("Bitte einloggen.");
      }
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        let hint = text?.trim() || res.statusText || "Unbekannter Fehler";
        if (res.status === 413) hint = "Datei ist zu groß (max. 8 MB).";
        throw new Error(`${label} fehlgeschlagen (${res.status}): ${hint}`);
      }
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Unerwartete Serverantwort.");
      }
    };

    async function callPreview(file) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/haendler/import/preview", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      return handleResponse(res, "Vorschau");
    }

    async function callCommit(file) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/haendler/import/commit", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      return handleResponse(res, "Import");
    }

    fileEl.addEventListener("change", () => {
      const file = fileEl.files && fileEl.files[0];
      lastFile = file || null;
      lastPreviewOk = false;
      btnImport.disabled = true;
      clearSummary();
      clearErrors();

      if (!file) {
        setStatus("Keine Datei ausgewählt.");
        return;
      }
      const v = validateFile(file);
      if (!v.ok) {
        setStatus(v.message);
        return;
      }
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setStatus(`Datei gewählt: ${file.name} (${sizeMb} MB)`);
    });

    btnPreview.addEventListener("click", async () => {
      const file = fileEl.files && fileEl.files[0];
      const v = validateFile(file);
      if (!v.ok) { setStatus(v.message); return; }

      btnPreview.disabled = true;
      btnImport.disabled = true;
      lastPreviewOk = false;
      lastFile = file;

      setStatus("Vorschau wird geladen…");
      try {
        const data = await callPreview(file);
        const summary = data?.summary || null;
        const errors = Array.isArray(data?.errors) ? data.errors : [];
        renderSummary(summary);
        renderErrors(errors);

        const total = Number(summary?.total || 0);
        const valid = Number(summary?.newCount || 0) + Number(summary?.updateCount || 0);

        if (total === 0) {
          lastPreviewOk = false;
          btnImport.disabled = true;
          setStatus("Keine Daten gefunden. Prüfe, ob die CSV eine Header-Zeile hat.");
          return;
        }
        if (valid === 0) {
          lastPreviewOk = false;
          btnImport.disabled = true;
          setStatus("Keine gültigen Zeilen gefunden. Bitte CSV prüfen.");
          return;
        }

        lastPreviewOk = true;
        btnImport.disabled = false;
        setStatus(errors.length ? `Vorschau geladen (${errors.length} Fehler).` : "Vorschau geladen. Prüfen und dann Import starten.");
      } catch (err) {
        renderSummary(null);
        renderErrors([]);
        setStatus(err.message || "Vorschau fehlgeschlagen.");
      } finally {
        btnPreview.disabled = false;
      }
    });

    btnImport.addEventListener("click", async () => {
      const currentFile = fileEl.files && fileEl.files[0];
      if (!currentFile) {
        setStatus("Bitte zuerst eine CSV auswählen.");
        return;
      }
      if (lastFile && lastFile !== currentFile) {
        setStatus("Datei wurde geändert. Bitte Vorschau erneut laden.");
        return;
      }
      if (!lastFile || !lastPreviewOk) {
        setStatus("Bitte zuerst eine Vorschau laden.");
        return;
      }
      const v = validateFile(currentFile);
      if (!v.ok) { setStatus(v.message); return; }

      btnImport.disabled = true;
      btnPreview.disabled = true;
      setStatus("Import läuft…");

      try {
        const result = await callCommit(lastFile);
        setStatus(`Import fertig: Neu ${result.created}, Updates ${result.updated}, Fehler ${result.failed}.`);
        // Nach Import einmal neu laden, damit neue Inserate erscheinen
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        setStatus(err.message || "Import fehlgeschlagen.");
      } finally {
        btnPreview.disabled = false;
      }
    });
  }

  setupDealerCsvImport();

  const actionModal = document.getElementById("listingActionModal");
  const markSoldBtn = document.getElementById("markSoldBtn");
  const deleteListingBtn = document.getElementById("deleteListingBtn");
  const cancelListingBtn = document.getElementById("cancelListingBtn");
  const modalBackdrop = actionModal?.querySelector("[data-close]");
  const listingActionName = document.getElementById("listingActionName");

  const listingActionState = {
    id: "",
    status: ""
  };

  function openListingActionModal({ id, status }) {
    if (!actionModal) return;
    listingActionState.id = id || "";
    listingActionState.status = status || "";
    if (listingActionName) {
      const inserat = inseratById.get(String(id || ""));
      const title =
        inserat?.titel ||
        [inserat?.verkauf_marke, inserat?.verkauf_modell, inserat?.verkauf_variante]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        "";
      listingActionName.textContent = title || "–";
    }
    actionModal.classList.add("show");
    actionModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeListingActionModal() {
    if (!actionModal) return;
    actionModal.classList.remove("show");
    actionModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function removeListingFromCache(listingId) {
    const id = String(listingId || "");
    cachedMyInserate = Array.isArray(cachedMyInserate)
      ? cachedMyInserate.filter(ins => {
          const insId = String(extractMongoId(ins) || ins?.fahrzeugId || ins?._id || "");
          return insId !== id;
        })
      : [];
    inseratById.delete(id);
  }

  function updateListingAsSold(listingId) {
    const id = String(listingId || "");
    const soldPatch = {
      status: "verkauft",
      verkauf_status: "verkauft",
      verkauft: true,
      verkauftAm: new Date().toISOString()
    };
    if (!Array.isArray(cachedMyInserate)) return;
    cachedMyInserate = cachedMyInserate.map(ins => {
      const insId = String(extractMongoId(ins) || ins?.fahrzeugId || ins?._id || "");
      if (insId !== id) return ins;
      return { ...ins, ...soldPatch };
    });
    if (inseratById.has(id)) {
      const current = inseratById.get(id);
      inseratById.set(id, { ...current, ...soldPatch });
    }
  }

  function updateListingAsOnline(listingId) {
    const id = String(listingId || "");
    const patch = {
      status: "online",
      verkauf_status: "online",
      verkauft: false,
      veroeffentlichtAm: new Date().toISOString()
    };
    if (!Array.isArray(cachedMyInserate)) return;
    cachedMyInserate = cachedMyInserate.map(ins => {
      const insId = String(extractMongoId(ins) || ins?.fahrzeugId || ins?._id || "");
      if (insId !== id) return ins;
      const clean = { ...ins, ...patch };
      delete clean.verkauftAm;
      return clean;
    });
    if (inseratById.has(id)) {
      const current = inseratById.get(id);
      const clean = { ...current, ...patch };
      delete clean.verkauftAm;
      inseratById.set(id, clean);
    }
  }

  if (cancelListingBtn) cancelListingBtn.addEventListener("click", closeListingActionModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", closeListingActionModal);

  if (markSoldBtn) {
    markSoldBtn.addEventListener("click", async () => {
      const id = listingActionState.id;
      const status = String(listingActionState.status || "").toLowerCase();
      if (!id) return closeListingActionModal();

      if (status !== "online") {
        alert("Nur Online-Inserate können als verkauft markiert werden.");
        return closeListingActionModal();
      }

      try {
        const res = await fetch(`/inserat/${encodeURIComponent(id)}/sold`, {
          method: "POST",
          credentials: "include"
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          alert("Fehler beim Markieren: " + (msg || res.status));
          return;
        }

        updateListingAsSold(id);
        document.querySelectorAll(`.car-card-wrapper[data-id="${CSS.escape(id)}"]`).forEach(el => el.remove());
        alert("✅ Inserat wurde als verkauft markiert.");
      } catch (err) {
        console.error(err);
        alert("❌ Netzwerkfehler.");
      } finally {
        closeListingActionModal();
      }
    });
  }

  if (deleteListingBtn) {
    deleteListingBtn.addEventListener("click", async () => {
      const id = listingActionState.id;
      if (!id) return closeListingActionModal();

      const ok = confirm("Inserat wirklich löschen? Das kann nicht rückgängig gemacht werden.");
      if (!ok) return;

      try {
        const res = await fetch(`/inserat/${encodeURIComponent(id)}/delete`, {
          method: "POST",
          credentials: "include"
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          alert("Fehler beim Löschen: " + (msg || res.status));
          return;
        }

        removeListingFromCache(id);
        document.querySelectorAll(`.car-card-wrapper[data-id="${CSS.escape(id)}"]`).forEach(el => el.remove());
        alert("✅ Inserat wurde gelöscht.");
      } catch (err) {
        console.error(err);
        alert("❌ Netzwerkfehler.");
      } finally {
        closeListingActionModal();
      }
    });
  }

  async function fetchInseratStats(ids) {
    const out = new Map();
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!list.length) return out;

    try {
      const query = encodeURIComponent(list.join(","));
      const res = await fetch(`/inserat/stats?ids=${query}`, { credentials: "include" });
      if (!res.ok) return out;
      const data = await res.json();
      Object.entries(data || {}).forEach(([id, stats]) => {
        out.set(String(id), {
          views: Number(stats?.views || 0),
          saves: Number(stats?.saves || 0)
        });
      });
    } catch (err) {
      console.warn("Konnte Inserat-Stats nicht laden:", err);
    }

    return out;
  }

  async function getMessageThreadCounts(userId) {
    const counts = new Map();
    if (!userId) return counts;
    try {
      const messages = await loadAllMessagesFor(userId);
      if (!Array.isArray(messages)) return counts;

      const perFahrzeug = new Map();
      for (const m of messages) {
        const fid = String(m?.fahrzeugId || "").trim();
        if (!fid) continue;
        const otherId = (m.senderId === userId) ? m.empfaengerId : m.senderId;
        const threadKey = `${otherId || "unknown"}::${fid}`;
        if (!perFahrzeug.has(fid)) perFahrzeug.set(fid, new Set());
        perFahrzeug.get(fid).add(threadKey);
      }

      for (const [fid, set] of perFahrzeug.entries()) {
        counts.set(fid, set.size);
      }
    } catch (err) {
      console.warn("Konnte Nachrichten-Counts nicht laden:", err);
    }

    return counts;
  }

  function getOnlineSinceLabel(inserat) {
    const statusRaw = String(
      inserat?.__status ||
      inserat?.status ||
      inserat?.verkauf_status ||
      inserat?.verkaufsstatus ||
      ""
    ).toLowerCase();

    const isOnline = statusRaw.includes("online");
    if (!isOnline) return "Noch nicht online";

    const rawDate =
      inserat?.veroeffentlichtAm ||
      inserat?.veroeffentlicht_at ||
      inserat?.publishedAt ||
      inserat?.createdAt ||
      inserat?.erstelltAm ||
      "";

    if (!rawDate) return "Online seit –";

    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return "Online seit –";

    const dateStr = d.toLocaleDateString("de-DE");
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (!Number.isFinite(days)) return `Online seit ${dateStr}`;

    if (days <= 0) return `Online seit ${dateStr} (heute)`;
    return `Online seit ${dateStr} (${days} Tag${days === 1 ? "" : "e"})`;
  }

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
    const logoInput = section.querySelector(".profile-logo-input");
    const logoEditBtn = section.querySelector(".profile-logo-edit");
    const logoUrl = nutzerData.logoUrl || "";
    if (logoImg && logoWrapper) {
      if (logoUrl) logoImg.alt = displayName + " Logo";
      else logoImg.removeAttribute("alt");
      applyDealerAvatar(logoWrapper, logoImg, logoUrl);
    }

    if (logoWrapper) {
      logoWrapper.classList.toggle("is-editable", isHaendler);
    }
    if (logoEditBtn) {
      logoEditBtn.style.display = isHaendler ? "" : "none";
    }
    if (logoInput) {
      logoInput.disabled = !isHaendler;
    }

    if (logoWrapper && logoInput && logoEditBtn && !logoWrapper.dataset.logoUploadBound) {
      logoWrapper.dataset.logoUploadBound = "1";

      const openPicker = () => {
        if (logoInput.disabled) return;
        logoInput.click();
      };

      logoEditBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPicker();
      });

      logoWrapper.addEventListener("click", (e) => {
        if (e.target?.closest?.(".profile-logo-edit")) return;
        if (!isHaendler) return;
        openPicker();
      });

      logoInput.addEventListener("change", async () => {
        const file = logoInput.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          alert("Bitte eine Bilddatei (PNG/JPG/WEBP) auswählen.");
          logoInput.value = "";
          return;
        }

        const formData = new FormData();
        formData.append("logo", file);

        logoEditBtn.classList.add("is-loading");

        try {
          const res = await fetch("/haendler/logo", {
            method: "POST",
            credentials: "include",
            body: formData
          });

          if (!res.ok) {
            const t = await res.text().catch(() => "");
            throw new Error(t || "Upload fehlgeschlagen");
          }

          const data = await res.json();
          const newUrl = data?.logoUrl || "";
          if (newUrl && logoImg) {
            logoImg.alt = displayName + " Logo";
            applyDealerAvatar(logoWrapper, logoImg, newUrl);
          }
        } catch (err) {
          console.error(err);
          alert("Logo konnte nicht aktualisiert werden.");
        } finally {
          logoEditBtn.classList.remove("is-loading");
          logoInput.value = "";
        }
      });
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

    const phone2El = section.querySelector('[data-profile-field="phone2"]');
    if (phone2El) {
      const phone2 =
        nutzerData.telefon2 ||
        nutzerData.phone2 ||
        nutzerData.tel2 ||
        nutzerData.telefonnummer2 ||
        "";
      phone2El.textContent = phone2 || "–";
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

    const languagesEl = section.querySelector('[data-profile-field="languages"]');
    if (languagesEl) {
      const langs = nutzerData.sprachen || nutzerData.languages || [];
      const langMap = {
        de: "Deutsch",
        en: "Englisch",
        tr: "Türkisch",
        ar: "Arabisch",
        ru: "Russisch",
        pl: "Polnisch",
        fr: "Französisch",
        it: "Italienisch",
        es: "Spanisch"
      };
      let text = "";
      if (Array.isArray(langs)) {
        text = langs
          .map((l) => {
            const key = String(l || "").trim().toLowerCase();
            return langMap[key] || l;
          })
          .filter(Boolean)
          .join(", ");
      } else if (typeof langs === "string") {
        text = langs.trim();
      }
      languagesEl.textContent = text || "–";
    }

    const impressumEl = section.querySelector('[data-profile-field="impressum"]');
    if (impressumEl) {
      const imprRaw = String(nutzerData.impressum || "");
      const html = sanitizeImpressumHTML(imprRaw);
      if (html) {
        impressumEl.innerHTML = html;
        impressumEl.dataset.rawImpressum = imprRaw;
      } else {
        impressumEl.textContent = "Noch kein Impressum hinterlegt";
        impressumEl.dataset.rawImpressum = "";
      }
    }

    const openingEl = section.querySelector('[data-profile-field="openingHours"]');
    if (openingEl) {
      const text = nutzerData.oeffnungszeiten || nutzerData["öffnungszeiten"] || "";
      openingEl.textContent = text || "";
    }

    section.querySelectorAll(".haendler-only").forEach(el => {
      el.style.display = isHaendler ? "" : "none";
    });

    const onlineItems = Array.isArray(online) ? online : [];
    const onlineCount = onlineItems.filter((item) => {
      const raw = String(item?.status || item?.verkauf_status || "").toLowerCase();
      if (!raw) return true;
      return raw.includes("online");
    }).length;
    const offlineCount = onlineItems.length - onlineCount;

    const activeCount = onlineCount;
    const draftCount  = (Array.isArray(drafts) ? drafts.length : 0) + Math.max(offlineCount, 0);
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
      try {
        const targetHash = location.hash || "";
        localStorage.setItem("redirectAfterLogin", `übersicht.html${targetHash}`);
      } catch {}
      window.location.href = "login.html";
      return;
    }

    const [draftRes, onlineRes] = await Promise.all([
      fetch("/getVehicleData", { credentials: "include" }),
      fetch("/meine-inserate", { credentials: "include" })
    ]);

    const drafts = await draftRes.json();
    const onlineAll = await onlineRes.json();

    renderProfileSection(nutzerData, drafts, onlineAll);
    ladeHändlerBewertung(nutzerData.nutzerId);
    ladeBewertungen(nutzerData.nutzerId);

    const deriveStatus = (item) => {
      const raw = String(item?.status || item?.verkauf_status || "").toLowerCase().trim();
      if (!raw) return "online";
      if (raw.includes("online")) return "online";
      if (raw.includes("offline") || raw.includes("draft") || raw.includes("entwurf")) return "offline";
      if (raw.includes("verkauft") || raw.includes("sold")) return "sold";
      return "offline";
    };

    const items = [
      ...(Array.isArray(drafts) ? drafts.map(d => ({ ...d, __status: "draft" })) : []),
      ...(Array.isArray(onlineAll)
        ? onlineAll.map(o => ({ ...o, __status: deriveStatus(o) }))
        : [])
    ];

    cachedMyInserate = items;
    cachedUserData = nutzerData;

    const allItems = items.filter(ins => !isSoldInserat(ins));

    const idsForStats = allItems
      .map((ins) => String(extractMongoId(ins) || ins?.fahrzeugId || ins?._id || "").trim())
      .filter(Boolean);
    const statsById = await fetchInseratStats(idsForStats);
    const messageCounts = await getMessageThreadCounts(nutzerData.nutzerId);

    const searchEl = document.getElementById("overviewSearch");
    const statusEl = document.getElementById("overviewStatus");
    const resetEl = document.getElementById("overviewFilterReset");

    const filterState = {
      q: "",
      status: "all"
    };

    const getStatus = (ins) => {
      const raw = String(ins?.__status || deriveStatus(ins) || "").toLowerCase();
      if (raw.includes("online")) return "online";
      if (raw.includes("draft") || raw.includes("offline") || raw.includes("entwurf")) return "offline";
      if (raw.includes("verkauft") || raw.includes("sold")) return "sold";
      return "offline";
    };

    const toSearchString = (ins) => {
      const parts = [
        ins?.titel,
        ins?.verkauf_titel,
        ins?.verkauf_marke,
        ins?.verkauf_modell,
        ins?.verkauf_variante,
        ins?.marke,
        ins?.modell,
        ins?.variante,
        ins?.stockNumber,
        ins?.stock_number,
        ins?.interne_nummer,
        ins?.fahrzeugId,
        extractMongoId(ins)
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return parts.join(" ");
    };

    const renderCarList = (list) => {
      carList.innerHTML = "";
      const footnote = document.getElementById("vatFootnoteMyCars");
      let hasMwstAny = false;

      if (!list.length) {
        carList.innerHTML = "<p>Keine Inserate gefunden.</p>";
        if (footnote) footnote.hidden = true;
        return;
      }

      const sorted = [...list].sort((a, b) => getListingTimestamp(b) - getListingTimestamp(a));

      sorted.forEach((inserat) => {
      const wrapper = document.createElement("div");
      wrapper.className = "car-card-wrapper";

      const realId = extractMongoId(inserat);
      wrapper.dataset.id = realId || "";
      wrapper.dataset.status = inserat.__status || getStatus(inserat);

      if (realId) inseratById.set(String(realId), inserat);

      const listingId = String(realId || inserat?.fahrzeugId || inserat?._id || "").trim();
      const stats = statsById.get(listingId) || { views: 0, saves: 0 };
      const messageCount = messageCounts.get(listingId) || 0;
      const onlineSinceLabel = getOnlineSinceLabel(inserat);

      const isOnline = wrapper.dataset.status === "online";
      const publishTitle = isOnline ? "Bereits online" : "Veröffentlichen";
      const publishBtnAttrs =
        `class="publish-btn${isOnline ? " published" : ""}" ` +
        `type="button" ` +
        `${isOnline ? "disabled aria-disabled='true'" : ""} ` +
        `title="${publishTitle}" aria-label="${publishTitle}"`;

      const titleSafe = escapeHTML(inserat.titel || inserat.verkauf_titel || "Titel fehlt");
      const subtitleSafe = escapeHTML(inserat.verkauf_kurzbeschreibung || "Besondere Ausstattung");
      const views = Number(stats.views || 0);
      const saves = Number(stats.saves || 0);
      const hasMwst = hasMwstHint(inserat);
      const mwstSup = hasMwst ? `<sup class="price-sup">1</sup>` : "";
      if (hasMwst) hasMwstAny = true;

      const actionButtonsHTML = `
        <button ${publishBtnAttrs}><i class="fas fa-globe"></i></button>
        <button class="edit-btn" type="button" title="Bearbeiten" aria-label="Bearbeiten"><i class="fas fa-pen"></i></button>
        <button class="remove-saved-btn" type="button" title="Verwalten" aria-label="Verwalten"><i class="fas fa-ellipsis-v"></i></button>
      `;

      wrapper.innerHTML = `
        <div class="car-card horizontal">
          <div class="car-card-media">
            <div class="card-actions mobile-only">
              ${actionButtonsHTML}
            </div>
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
              <div class="car-price-wrap">
                <p class="car-price">${
                  formatEUR(extractPriceValue(inserat)) || "Preis fehlt"
                }${mwstSup}</p>
              </div>
            </div>

            <p class="car-subtitle">${subtitleSafe}</p>

            <div class="car-info-grid">
              <p><i class="fas fa-road"></i> ${escapeHTML(formatKm(inserat.verkauf_kilometer ?? inserat.kilometer))}</p>
              <p><i class="fas fa-calendar-alt"></i> EZ ${escapeHTML(formatEZ(inserat.verkauf_erstzulassung || inserat.erstzulassung))}</p>
              <p><i class="fas fa-gas-pump"></i> ${escapeHTML(String(inserat.verkauf_kraftstoff || "—"))}</p>
              <p><i class="fas fa-gauge-high"></i> ${escapeHTML(String(inserat.verkauf_leistung ?? "—"))} PS</p>
              <p><i class="fas fa-gears"></i> ${escapeHTML(String(inserat.verkauf_getriebe || "—"))}</p>
              <p><i class="fas fa-tint"></i> ${escapeHTML(String(inserat.verkauf_verbrauch_kombiniert || "—"))} l/100 km</p>
            </div>

            <div class="car-stats-row">
              <div class="car-stats">
                <span class="car-stat">
                  <i class="fas fa-eye"></i> ${views} Aufruf${views === 1 ? "" : "e"}
                </span>
                <span class="car-stat">
                  <i class="fas fa-heart"></i> ${saves} gespeichert
                </span>
                <span class="car-stat">
                  <i class="fas fa-comments"></i> ${messageCount} Anfrage${messageCount === 1 ? "" : "n"}
                </span>
                <span class="car-stat car-stat--wide" title="${escapeHTML(onlineSinceLabel)}">
                  <i class="fas fa-calendar-day"></i> ${escapeHTML(onlineSinceLabel)}
                </span>
              </div>
              <div class="card-actions desktop-only">
                ${actionButtonsHTML}
              </div>
            </div>
          </div>
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

      if (footnote) footnote.hidden = !hasMwstAny;
    };

    const applyFilters = () => {
      let list = [...allItems];

      if (filterState.status !== "all") {
        list = list.filter((ins) => {
          const s = getStatus(ins);
          if (filterState.status === "online") return s === "online";
          if (filterState.status === "offline") return s !== "online";
          return true;
        });
      }

      if (filterState.q) {
        const q = filterState.q.trim().toLowerCase();
        if (q) {
          list = list.filter((ins) => toSearchString(ins).includes(q));
        }
      }

      renderCarList(list);
    };

    if (searchEl) {
      searchEl.addEventListener("input", () => {
        filterState.q = searchEl.value || "";
        applyFilters();
      });
    }

    if (statusEl) {
      statusEl.addEventListener("change", () => {
        filterState.status = statusEl.value || "all";
        applyFilters();
      });
    }

    if (resetEl) {
      resetEl.addEventListener("click", () => {
        filterState.q = "";
        filterState.status = "all";
        if (searchEl) searchEl.value = "";
        if (statusEl) statusEl.value = "all";
        applyFilters();
      });
    }

    applyFilters();

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

    // Entfernen (Meine Autos -> Auswahl: verkauft oder löschen)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-saved-btn");
      if (!btn) return;
      const wrapper = btn.closest(".car-card-wrapper");
      if (!wrapper) return;

      // Nur für "Meine Autos" (nicht gespeicherte Autos)
      if (!wrapper.closest("#car-list")) return;

      e.stopPropagation();
      const realId = String(wrapper.dataset.id || "").trim();
      if (!realId) return alert("ID fehlt");

      openListingActionModal({
        id: realId,
        status: wrapper.dataset.status || ""
      });
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

  if (status !== "draft" && status !== "offline") return; // bereits online

  if (!inseratId || !/^[a-f\d]{24}$/i.test(inseratId)) {
    alert("❌ Ungültige Inserat-ID.");
    return;
  }

  try {
    const res = status === "draft"
      ? await fetch("/inserat-veroeffentlichen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: inseratId })
        })
      : await fetch(`/inserat/${encodeURIComponent(inseratId)}/relist`, {
          method: "POST",
          credentials: "include"
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
   Wieder online stellen (Verkaufte Autos)
   ========================================================= */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".relist-btn");
  if (!btn) return;

  const wrapper = btn.closest(".car-card-wrapper");
  const inseratId = wrapper?.dataset?.id || "";
  if (!inseratId || !/^[a-f\d]{24}$/i.test(inseratId)) return;

  e.preventDefault();
  e.stopPropagation();

  const ok = confirm("Inserat wieder online stellen?");
  if (!ok) return;

  try {
    const res = await fetch(`/inserat/${encodeURIComponent(inseratId)}/relist`, {
      method: "POST",
      credentials: "include"
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      alert("Fehler: " + (msg || res.status));
      return;
    }

    updateListingAsOnline(inseratId);
    wrapper?.remove();

    const listEl = document.getElementById("soldCarsList");
    const emptyEl = document.getElementById("soldCarsEmpty");
    if (listEl && emptyEl) {
      const hasAny = listEl.querySelector(".car-card-wrapper");
      emptyEl.classList.toggle("hidden", !!hasAny);
    }

    alert("✅ Inserat ist wieder online.");
  } catch (err) {
    console.error(err);
    alert("❌ Netzwerkfehler.");
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

function shortId(id){ return (id || "").slice(0,6) + "…"; }
function timeDesc(iso){
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

async function loadAllMessagesFor(userId){
  try{
    const t = await fetch("/meine-nachrichten", { credentials: "include" });
    if (t.ok) return await t.json();
  }catch(_){}
  return await fetchInbox(userId);
}

function groupThreads(messages, meId){
  const map = new Map();
  for (const m of messages){
    const otherId = (m.senderId === meId) ? m.empfaengerId : m.senderId;
    const key = `${otherId}::${m.fahrzeugId}`;
    if (!map.has(key)) map.set(key, { otherId, fahrzeugId: m.fahrzeugId, items: [] });
    map.get(key).items.push(m);
  }

  const threads = [];
  for (const t of map.values()){
    t.items.sort((a,b)=> new Date(a.zeit) - new Date(b.zeit));
    const last = t.items[t.items.length - 1];
    const unread = t.items.filter(x => !x.gelesen && x.empfaengerId === meId).length;
    const lastFromOther = last.senderId !== meId;
    const nameForPreview = lastFromOther ? (last.absenderName || `Nutzer ${shortId(t.otherId)}`) : "Du";

    threads.push({
      otherId: t.otherId,
      fahrzeugId: t.fahrzeugId,
      last,
      unread,
      previewName: nameForPreview
    });
  }

  threads.sort((a,b)=> new Date(b.last.zeit) - new Date(a.last.zeit));
  return threads;
}

function renderThreadCard({ car, thread, meId }){
  const titel = car?.titel || "Unbekanntes Fahrzeug";
  const preis = formatEUR(extractPriceValue(car));
  const carTitleLine = preis ? `${titel} • ${preis}` : titel;

  const img =
    (Array.isArray(car?.images) && car.images[0]) ? car.images[0] :
    (Array.isArray(car?.bilder) && car.bilder[0]) ? car.bilder[0] :
    "";

  const previewText = (thread.last?.nachricht || "").split("\n").slice(0,2).join(" ");
  const stamp = timeDesc(thread.last?.zeit);
  const unreadBadge = thread.unread > 0 ? ` <span class="unread-badge">+${thread.unread}</span>` : "";

  const openUrl = `nachricht.html?user1=${encodeURIComponent(meId)}&user2=${encodeURIComponent(thread.otherId)}&fahrzeugId=${encodeURIComponent(thread.fahrzeugId)}`;

  return `
    <div class="chat-card" data-thread="${thread.otherId}::${thread.fahrzeugId}" data-open-url="${escapeHTML(openUrl)}">
      <div class="chat-media">
        ${img ? `<img src="${escapeHTML(img)}" alt="Auto">` : `<div class="chat-placeholder"></div>`}
      </div>
      <div class="chat-info">
        <h2 class="chat-car-title">${escapeHTML(carTitleLine)}</h2>
        <p class="chat-message-preview"><strong>${escapeHTML(thread.previewName)}:</strong> ${escapeHTML(previewText || "…")}</p>
        <small class="chat-time">${escapeHTML(stamp)}${unreadBadge}</small>
      </div>
    </div>
    <div class="chat-buttons">
      <a href="${escapeHTML(openUrl)}" class="open-chat-btn"><i class="fas fa-comments"></i> Chat öffnen</a>
    </div>
  `;
}

async function loadMessagesSection() {
  const messagesSection = document.getElementById("messages-list");
  if (!messagesSection) return;

  try {
    const loadingEl = messagesSection.querySelector("[data-loading]");
    const listEl = document.getElementById("chat-list");
    const emptyEl = document.getElementById("chat-empty");

    loadingEl?.classList.remove("hidden");
    if (listEl) listEl.innerHTML = "";
    emptyEl?.classList.add("hidden");

    const user = await getLoggedInUser();
    const allMessages = await loadAllMessagesFor(user.nutzerId);

    if (!Array.isArray(allMessages) || allMessages.length === 0) {
      loadingEl?.classList.add("hidden");
      emptyEl?.classList.remove("hidden");
      return;
    }

    const threads = groupThreads(allMessages, user.nutzerId);
    const uniqueFahrzeuge = [...new Set(threads.map(t => t.fahrzeugId))];

    const detailsMap = new Map();
    await Promise.all(uniqueFahrzeuge.map(async (fid) => {
      const det = await fetchInseratDetails(fid);
      detailsMap.set(fid, det);
    }));

    if (listEl) {
      listEl.innerHTML = threads.map((thread) => {
        const car = detailsMap.get(thread.fahrzeugId) || null;
        return renderThreadCard({ car, thread, meId: user.nutzerId });
      }).join("");
    }

    loadingEl?.classList.add("hidden");

    if (!document.documentElement.dataset.uebersichtChatDelegation) {
      document.documentElement.dataset.uebersichtChatDelegation = "1";
      document.addEventListener("click", (e) => {
        const card = e.target.closest(".chat-card");
        if (!card) return;
        if (e.target.closest("a, button")) return;
        const url = card.getAttribute("data-open-url");
        if (url) window.location.href = url;
      });
    }

  } catch (e) {
    console.error(e);
    messagesSection.innerHTML = `<p>Fehler beim Laden der Nachrichten.</p>`;
  }
}

function isSoldInserat(inserat) {
  const statusRaw = String(
    inserat?.status ||
    inserat?.verkauf_status ||
    inserat?.verkaufsstatus ||
    inserat?.verkauf_status_text ||
    ""
  ).toLowerCase();

  if (statusRaw.includes("verkauft") || statusRaw.includes("sold")) return true;
  if (inserat?.verkauft === true || inserat?.sold === true) return true;

  return false;
}

function buildSoldCardHTML(inserat) {
  const title =
    inserat?.titel ||
    [inserat?.verkauf_marke, inserat?.verkauf_modell, inserat?.verkauf_variante]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Inserat";

  const rawPrice = extractPriceValue(inserat);
  const price = formatEUR(rawPrice) || "—";
  const hasMwst = hasMwstHint(inserat);
  const mwstSup = hasMwst ? `<sup class="price-sup">1</sup>` : "";

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

  const soldDate = formatDateShort(
    inserat?.verkauftAm ||
    inserat?.soldAt ||
    inserat?.verkauf_verkauftAm ||
    inserat?.verkauf_sold_at ||
    ""
  );

  const standort = (inserat?.verkauf_standort || inserat?.standort || "").trim();
  const ort = (inserat?.verkauf_ort || inserat?.ort || "").trim();
  const plz = (inserat?.verkauf_plz || inserat?.plz || "").trim();
  const location = standort || [plz, ort].filter(Boolean).join(" ").trim() || "—";

  const rawType = String(
    inserat?.seller?.type ||
    inserat?.verkauf_verkaeufer ||
    inserat?.verkaeufer ||
    ""
  ).toLowerCase();
  const isHaendler =
    rawType === "haendler" ||
    rawType === "händler" ||
    rawType.includes("händ") ||
    rawType.includes("haend");

  const sellerName = isHaendler
    ? (
        inserat?.seller?.name ||
        inserat?.sellerName ||
        inserat?.verkauf_name ||
        "Händler"
      )
    : "Privatanbieter";

  const sellerLogo =
    inserat?.seller?.logoUrl ||
    inserat?.logoUrl ||
    "";

  const ratingAvg =
    inserat?.seller?.ratingAvg ??
    inserat?.seller?.rating_avg ??
    inserat?.ratingAvg ??
    inserat?.rating_avg;

  const ratingCount =
    inserat?.seller?.ratingCount ??
    inserat?.seller?.rating_count ??
    inserat?.ratingCount ??
    inserat?.rating_count;

  const dealerRatingHTML = ratingBlock({
    isHaendler,
    avg: ratingAvg,
    count: ratingCount
  });

  const fahrzeugId = extractMongoId(inserat) || inserat?.id || inserat?._id || "";

  return `
    <div class="car-card-wrapper" data-id="${escapeHTML(String(fahrzeugId || ""))}">
      <div class="car-card horizontal">
        <div class="car-card-media">
          <div class="card-actions mobile-only sold-actions">
            <span class="sold-date"><i class="fas fa-check-circle"></i> Verkauft am ${escapeHTML(soldDate)}</span>
            <button class="relist-btn" type="button" title="Wieder online" aria-label="Wieder online">
              <i class="fas fa-undo"></i>
            </button>
          </div>
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
            <div class="car-price-wrap">
              <p class="car-price">${escapeHTML(price)}${mwstSup}</p>
            </div>
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

          <div class="dealer-info-row">
            <div class="dealer-row">
              <div class="dealer-avatar" data-logo="${escapeHTML(sellerLogo)}">
                <img alt="${escapeHTML(sellerName)} Logo" decoding="async">
                <span class="dealer-initials">${escapeHTML(sellerInitials(sellerName))}</span>
              </div>
              <div class="dealer-meta">
                <div class="dealer-name">${escapeHTML(sellerName)}</div>
                ${dealerRatingHTML}
                <div class="dealer-location">${escapeHTML(location)}</div>
              </div>
            </div>
            <div class="card-actions desktop-only sold-actions">
              <span class="sold-date"><i class="fas fa-check-circle"></i> Verkauft am ${escapeHTML(soldDate)}</span>
              <button class="relist-btn" type="button" title="Wieder online" aria-label="Wieder online">
                <i class="fas fa-undo"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function loadSoldCarsSection() {
  const section = document.getElementById("sold-cars");
  if (!section) return;

  const loadingEl = document.getElementById("soldCarsLoading");
  const listEl = document.getElementById("soldCarsList");
  const emptyEl = document.getElementById("soldCarsEmpty");

  if (listEl) listEl.innerHTML = "";
  emptyEl?.classList.add("hidden");
  loadingEl?.classList.remove("hidden");

  try {
    let items = Array.isArray(cachedMyInserate) ? cachedMyInserate : [];

    if (!items.length) {
      const [draftRes, onlineRes] = await Promise.all([
        fetch("/getVehicleData", { credentials: "include" }),
        fetch("/meine-inserate", { credentials: "include" })
      ]);
      const drafts = await draftRes.json();
      const online = await onlineRes.json();
      items = [
        ...(Array.isArray(drafts) ? drafts.map(d => ({ ...d, __status: "draft" })) : []),
        ...(Array.isArray(online) ? online.map(o => ({ ...o, __status: "online" })) : [])
      ];
    }

    const soldItems = items.filter(isSoldInserat);

    loadingEl?.classList.add("hidden");

    if (!soldItems.length) {
      emptyEl?.classList.remove("hidden");
      const footnote = document.getElementById("vatFootnoteSold");
      if (footnote) footnote.hidden = true;
      return;
    }

    let hasMwstAny = false;
    soldItems.forEach((inserat) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = buildSoldCardHTML(inserat);

      const cardWrap = tmp.firstElementChild;
      if (!cardWrap) return;

      const avatar = cardWrap.querySelector(".dealer-avatar");
      const img = cardWrap.querySelector(".dealer-avatar img");
      const logo = avatar?.dataset?.logo || "";
      applyDealerAvatar(avatar, img, logo);
      initializeSlider(cardWrap);

      cardWrap.addEventListener("click", (e) => {
        const isInteractive = e.target.closest("button, a, input, textarea, select, .media-arrow");
        if (isInteractive) return;

        const fahrzeugId = extractMongoId(inserat) || inserat?.id || inserat?._id || "";
        try { localStorage.setItem("ausgewaehltesInserat", JSON.stringify(inserat)); } catch {}
        if (fahrzeugId) {
          window.location.href = `anzeige.html?id=${encodeURIComponent(fahrzeugId)}`;
        } else {
          window.location.href = "anzeige.html";
        }
      });

      listEl?.appendChild(cardWrap);
      if (hasMwstHint(inserat)) hasMwstAny = true;
    });

    const footnote = document.getElementById("vatFootnoteSold");
    if (footnote) footnote.hidden = !hasMwstAny;
  } catch (err) {
    console.error("Fehler beim Laden verkaufter Autos:", err);
    loadingEl?.classList.add("hidden");
    emptyEl?.classList.remove("hidden");
    const footnote = document.getElementById("vatFootnoteSold");
    if (footnote) footnote.hidden = true;
  }
}

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
  const rawPrice = extractPriceValue(inserat);
  const price = formatEUR(rawPrice) || "—";
  const hasMwst = hasMwstHint(inserat);
  const mwstSup = hasMwst ? `<sup class="price-sup">1</sup>` : "";

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

  const rawType = String(
    inserat?.seller?.type ||
    inserat?.verkauf_verkaeufer ||
    inserat?.verkaeufer ||
    ""
  ).toLowerCase();
  const isHaendler =
    rawType === "haendler" ||
    rawType === "händler" ||
    rawType.includes("händ") ||
    rawType.includes("haend");

  const sellerName = isHaendler
    ? (
        inserat?.seller?.name ||
        inserat?.sellerName ||
        inserat?.verkauf_name ||
        "Händler"
      )
    : "Privatanbieter";

  const sellerLogo =
    inserat?.seller?.logoUrl ||
    inserat?.logoUrl ||
    "";

  const ratingAvg =
    inserat?.seller?.ratingAvg ??
    inserat?.seller?.rating_avg ??
    inserat?.ratingAvg ??
    inserat?.rating_avg;

  const ratingCount =
    inserat?.seller?.ratingCount ??
    inserat?.seller?.rating_count ??
    inserat?.ratingCount ??
    inserat?.rating_count;

  const dealerRatingHTML = ratingBlock({
    isHaendler,
    avg: ratingAvg,
    count: ratingCount
  });

  const sellerId = String(inserat?.verkaeuferId || inserat?.seller?.id || "").trim();
  const uid = String(userId || "").trim();

  const statusRaw = String(
    inserat?.status ||
    inserat?.verkauf_status ||
    inserat?.verkaufsstatus ||
    ""
  ).toLowerCase();
  const isUnavailable = isSoldInserat(inserat) || (statusRaw && statusRaw !== "online");

  const chatHref = (uid && sellerId && fahrzeugId)
    ? `nachricht.html?user1=${encodeURIComponent(uid)}&user2=${encodeURIComponent(sellerId)}&fahrzeugId=${encodeURIComponent(fahrzeugId)}`
    : `anzeige.html?id=${encodeURIComponent(fahrzeugId)}`;

  const contactBtnHTML = `
    <a href="${chatHref}" class="contact-btn" title="Kontakt aufnehmen" aria-label="Kontakt aufnehmen">
      <i class="fas fa-comments"></i>
    </a>
  `;
  const removeBtnHTML = `
    <button class="remove-saved-btn" type="button" data-fahrzeug-id="${escapeHTML(fahrzeugId)}" title="Entfernen" aria-label="Entfernen">
      <i class="fas fa-heart-broken"></i>
    </button>
  `;
  const actionButtonsHTML = isUnavailable ? `${removeBtnHTML}` : `${contactBtnHTML}${removeBtnHTML}`;
  const unavailableBadge = isUnavailable
    ? `<div class="listing-unavailable-badge"><i class="fas fa-ban"></i> Nicht verfügbar</div>`
    : "";

  return `
    <div class="car-card-wrapper${isUnavailable ? " is-unavailable" : ""}"
         data-saved-id="${escapeHTML(savedDocId)}"
         data-fahrzeug-id="${escapeHTML(fahrzeugId)}">

      <div class="car-card horizontal">
        <div class="car-card-media">
          ${unavailableBadge}
          <div class="card-actions mobile-only">
            ${actionButtonsHTML}
          </div>
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
            <div class="car-price-wrap">
              <p class="car-price">${escapeHTML(price)}${mwstSup}</p>
            </div>
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

          <div class="dealer-info-row">
            <div class="dealer-row">
          <div class="dealer-avatar" data-logo="${escapeHTML(sellerLogo)}">
            <img alt="${escapeHTML(sellerName)} Logo" decoding="async">
            <span class="dealer-initials">${escapeHTML(sellerInitials(sellerName))}</span>
          </div>
            <div class="dealer-meta">
                <div class="dealer-name">${escapeHTML(sellerName)}</div>
                ${dealerRatingHTML}
                <div class="dealer-location">${escapeHTML(location)}</div>
              </div>
            </div>
            <div class="card-actions desktop-only">
              ${actionButtonsHTML}
            </div>
          </div>
        </div>
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
      try {
        const targetHash = location.hash || "#saved-cars";
        localStorage.setItem("redirectAfterLogin", `übersicht.html${targetHash}`);
      } catch {}
      window.location.href = "login.html";
      return;
    }

    const res = await fetch("/saved/list", { credentials: "include" });
    if (!res.ok) throw new Error("saved/list failed");

    const inserate = await res.json();
    loadingEl?.classList.add("hidden");

    if (!Array.isArray(inserate) || inserate.length === 0) {
      emptyEl?.classList.remove("hidden");
      const footnote = document.getElementById("vatFootnoteSaved");
      if (footnote) footnote.hidden = true;
      return;
    }

    let hasMwstAny = false;
    inserate.forEach((inserat) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = buildSavedCardHTML(inserat, userId);

      const cardWrap = tmp.firstElementChild;
      if (!cardWrap) return;

      const avatar = cardWrap.querySelector(".dealer-avatar");
      const img = cardWrap.querySelector(".dealer-avatar img");
      const logo = avatar?.dataset?.logo || "";
      applyDealerAvatar(avatar, img, logo);

      initializeSlider(cardWrap);

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

      if (hasMwstHint(inserat)) hasMwstAny = true;
    });

    const footnote = document.getElementById("vatFootnoteSaved");
    if (footnote) footnote.hidden = !hasMwstAny;

  } catch (e) {
    console.error(e);
    loadingEl?.classList.add("hidden");
    if (listEl) listEl.innerHTML = `<p>Fehler beim Laden der gespeicherten Inserate.</p>`;
    const footnote = document.getElementById("vatFootnoteSaved");
    if (footnote) footnote.hidden = true;
  }
}
