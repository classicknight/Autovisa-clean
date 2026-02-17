// privat.js — EINHEITLICH (inkl. Edit-Flow wie haendler.js)
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", () => {
  // Verkäufertyp merken
  try { localStorage.setItem("verkaeuferTyp", "Privat"); } catch {}

  /* =========================
     Navbar / Dropdown (Klick)
     ========================= */
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");
  const authLi        = document.getElementById("auth-link");
  const authLoginHTML = authLi ? authLi.innerHTML : "";

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

    const center  = tRect.left + tRect.width / 2;
    let leftAbs   = center - mRect.width / 2;
    leftAbs       = clamp(leftAbs, 16, vw - mRect.width - 16);

    menu.style.left = `${leftAbs - liRect.left}px`;
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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar")) {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  const repositionOpen = () =>
    document.querySelectorAll(".dropdown.open").forEach(positionMenu);

  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  const closeMenu = () => {
    navLinks?.classList.remove("active");
    hamburger?.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  };

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


  /* =========================
     Edit-Mode Bootstrap (Privat)
     - kompatibel zu übersicht.js
     - WICHTIG: bleibt auf privat.html, bis User einen Step klickt
     ========================= */
  (function initEditModePrivat() {
    const params = new URLSearchParams(location.search);
    const editParam = params.get("edit");
    if (!editParam) return;

    const editId =
      editParam !== "1"
        ? editParam
        : (localStorage.getItem("editInseratId") || sessionStorage.getItem("editInseratId") || "");

    if (editId) {
      localStorage.setItem("editInseratId", editId);
      sessionStorage.setItem("editInseratId", editId);
    }

    // Edit-Mode aktiv, aber Wizard noch NICHT "starten"
    localStorage.setItem("editMode", "1");
    sessionStorage.setItem("editPending", "1");

    // Diese beiden NICHT hier setzen (sonst startest du den Flow zu früh)
    sessionStorage.removeItem("inseratGestartet");
    sessionStorage.removeItem("hatGespeichert");

    // Wenn Daten schon aus übersicht.js da sind → nichts überschreiben
    const hasAny =
      localStorage.getItem("fahrzeugdaten") ||
      localStorage.getItem("fahrzeugdetails") ||
      localStorage.getItem("medien");

    if (hasAny) return;

    // Optionaler Fallback bei Direktaufruf privat.html?edit=<id>:
    // aktuell bewusst leer lassen, damit wir nichts falsch mappen.
  })();


  /* =========================
     Auth / Privat-Pflicht
     ========================= */
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(res => res.json())
    .then(user => {
      if (!user?.eingeloggt) {
        clearAuthFlags();
        renderLogin();
        try {
          const url = location.search ? `privat.html${location.search}` : "privat.html";
          localStorage.setItem("redirectAfterLogin", url);
        } catch {}
        window.location.href = "login.html";
        return;
      }

      try {
        localStorage.setItem("isLoggedIn", "true");
        const roleValue = user?.role || user?.rolle;
        if (roleValue) localStorage.setItem("userRole", String(roleValue));
        const userIdValue = user?.id || user?._id || user?.userId;
        if (userIdValue) localStorage.setItem("userId", String(userIdValue));
      } catch {}

      renderLogout();

      const roleRaw = String(user?.role || user?.rolle || "").toLowerCase();
      const isPrivat = roleRaw === "privat" || roleRaw.includes("privat");
      const isHaendler = roleRaw.includes("haend") || roleRaw.includes("händ");

      if (!isPrivat || isHaendler) {
        alert("Dieser Bereich ist nur für Privatverkäufer zugänglich.");
        window.location.href = "verkaufen.html";
        return;
      }

      // Navbar-Shortcuts → neue Übersicht-Hashes
      savedCarsLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "übersicht.html#saved-cars";
      });
      myCarsLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "übersicht.html#car-list";
      });

      // Nach Auth erst UI/Wizard initialisieren
      initStepsAndTarifUI();
      initWizard();
    })
    .catch(err => console.error("❌ Fehler beim Login-Check:", err));


  /* =========================
     Wizard / Steps / Tarif (Privat)
     ========================= */
  const STEP_STATE_KEY = "privatSteps";
  const TARIF_KEY      = "privatTarif"; // intern (code), Anzeige weiterhin "nutzerTarif"

  let stepsState = {};

  // Mini-APIs für andere Seiten (optional)
  window.markStepDonePrivat = (step) => markStepDone(step);
  window.togglePrivatTarife = () => togglePrivatTarife();

  function initStepsAndTarifUI() {
    stepsState = loadSteps();
    setupToasts();
    renderStepsFromState();
    wireStepNavigation();
    setupTarif();
    updateNavbarTarif();
  }

  async function initWizard() {
    if (!document.getElementById("toast-container")) setupToasts();

    // A) Direkt nach dem Veröffentlichen?
    if (sessionStorage.getItem("resetWizard") === "1") {
      clearWizardStatePrivat();
      sessionStorage.removeItem("resetWizard");
      showToast("Inserat veröffentlicht – Assistent zurückgesetzt");
      return;
    }

    // B) Kein Draft mehr vorhanden? → zurücksetzen
    // (Wenn du Privat-Drafts anders speicherst, hier anpassen.)
    try {
      const drafts = await fetch("/getVehicleData", { credentials: "include" }).then(r => r.json());
      const hasDraft = Array.isArray(drafts) && drafts.some(v => !v.status || v.status === "draft");
      if (!hasDraft) clearWizardStatePrivat();
    } catch (e) {
      // nicht hart abbrechen – UI soll weiter funktionieren
      console.warn("Entwurfs-Check fehlgeschlagen:", e);
    }
  }

  function ensureWizardFlagsBeforeLeavingPrivat() {
    try {
      const isEdit =
        localStorage.getItem("editMode") === "1" ||
        sessionStorage.getItem("editPending") === "1" ||
        new URLSearchParams(location.search).has("edit");

      // Wizard startet erst, wenn man privat.html verlässt (Step-Klick)
      sessionStorage.setItem("inseratGestartet", "true");

      // im Edit-Fall darf "hatGespeichert" gesetzt sein (deine Guards/Abbruchlogik)
      if (isEdit) sessionStorage.setItem("hatGespeichert", "true");
      else sessionStorage.removeItem("hatGespeichert");

      // pending ist ab jetzt erledigt
      sessionStorage.removeItem("editPending");
    } catch {}
  }

  function wireStepNavigation() {
    document.querySelectorAll(".step-box").forEach((box) => {
      box.addEventListener("click", () => {
        const step = String(box.dataset.step || "");
        const targets = {
          "1": "fahrzeugdaten.html",
          "2": "fahrzeugdetails.html",
          "3": "medien.html",
          "4": "vorschau.html",
        };

        if (targets[step]) {
          ensureWizardFlagsBeforeLeavingPrivat();
          window.location.href = targets[step];
        }
      });
    });
  }


  /* ---------- Tarif (Privat) ---------- */
  async function setupTarif() {
    const grid = document.getElementById("privatTarifGrid");
    if (!grid) return;

    const boxes = Array.from(grid.querySelectorAll(".tarif-box"));
    if (!boxes.length) return;

    // 1) Server-Tarif bevorzugen
    let serverTarif = "";
    try {
      const r = await fetch("/getTarif", { credentials: "include" });
      const data = await r.json().catch(() => ({}));
      serverTarif = String(data?.tarif || "").trim(); // z.B. "1 Inserat(e)"
    } catch {}

    // 2) Fallback LocalStorage
    let localTarif = "";
    try { localTarif = String(localStorage.getItem("nutzerTarif") || "").trim(); } catch {}

    const effectiveTarif = serverTarif || localTarif;

    // Selektieren
    if (effectiveTarif) {
      boxes.forEach(b => {
        const label = `${String(b.dataset.tarif || "").trim()} Inserat(e)`;
        b.classList.toggle("selected", label === effectiveTarif);
      });
      try { localStorage.setItem("nutzerTarif", effectiveTarif); } catch {}
    } else {
      // Default: erstes Paket
      const first = boxes[0];
      first.classList.add("selected");
      const initialTarif = `${String(first.dataset.tarif || "").trim()} Inserat(e)`;
      try { localStorage.setItem("nutzerTarif", initialTarif); } catch {}

      // direkt serverseitig speichern
      fetch("/saveTarif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tarif: initialTarif })
      }).catch(() => {});
    }

    updateNavbarTarif();

    // Klick speichern
    grid.addEventListener("click", async (e) => {
      const box = e.target.closest(".tarif-box");
      if (!box) return;

      boxes.forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");

      const tarifWert = `${String(box.dataset.tarif || "").trim()} Inserat(e)`;
      try { localStorage.setItem("nutzerTarif", tarifWert); } catch {}
      updateNavbarTarif();

      try {
        await fetch("/saveTarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tarif: tarifWert })
        });
        showToast("Tarif gespeichert");
      } catch {
        showToast("Tarif konnte nicht gespeichert werden", "error");
      }
    });
  }


  /* ---------- Steps-State ---------- */
  function markStepDone(step) {
    const s = String(step);
    stepsState[s] = true;
    saveSteps();

    const box = document.querySelector(`.step-box[data-step="${cssEscape(s)}"]`);
    if (!box) return;

    box.classList.add("completed");
    const status = box.querySelector(".step-status");
    if (status) status.textContent = "✔️";
  }

  function renderStepsFromState() {
    Object.entries(stepsState).forEach(([step, val]) => {
      if (!val) return;
      const box = document.querySelector(`.step-box[data-step="${cssEscape(step)}"]`);
      if (!box) return;
      box.classList.add("completed");
      const status = box.querySelector(".step-status");
      if (status) status.textContent = "✔️";
    });
  }

  function loadSteps() {
    try { return JSON.parse(localStorage.getItem(STEP_STATE_KEY)) || {}; }
    catch { return {}; }
  }

  function saveSteps() {
    try { localStorage.setItem(STEP_STATE_KEY, JSON.stringify(stepsState)); } catch {}
  }


  /* ---------- Toasts ---------- */
  function setupToasts() {
    let c = document.getElementById("toast-container");
    if (!c) {
      c = document.createElement("div");
      c.id = "toast-container";
      document.body.appendChild(c);
    }
  }

  function showToast(message, type = "success") {
    const c = document.getElementById("toast-container");
    if (!c) return;

    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = message;
    c.appendChild(t);

    requestAnimationFrame(() => t.classList.add("show"));

    setTimeout(() => {
      t.classList.remove("show");
      t.addEventListener("transitionend", () => t.remove(), { once: true });
    }, 3000);
  }


  /* ---------- Helpers ---------- */
  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }


  /* =========================
     Smooth Scroll (falls vorhanden)
     ========================= */
  const searchLink = document.querySelector('a[href="#search-section"]');
  searchLink?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
  });
});


/* =========================
   Kompat: alte Funktion (falls irgendwo noch genutzt)
   ========================= */
function updateStepStatus(currentStep) {
  const steps = document.querySelectorAll(".step-box");
  steps.forEach((step, idx) => {
    step.classList.remove("completed");
    const status = step.querySelector(".step-status");
    if (idx + 1 < currentStep) {
      step.classList.add("completed");
      if (status) status.textContent = "✔️";
    } else {
      if (status) status.textContent = "";
    }
  });
}


/* =========================
   Mobiles Tarif-Ausklappen (Privat)
   ========================= */
function togglePrivatTarife() {
  document.querySelectorAll("#privatTarifGrid .hide-mobile")
    .forEach(el => el.classList.toggle("hide-mobile"));

  const btn = document.querySelector(".tarif-toggle-btn");
  if (btn) {
    btn.textContent = btn.textContent.includes("Mehr")
      ? "Weniger anzeigen"
      : "Mehr Tarife anzeigen";
  }
}


/* =========================
   Tarif-Badge in Navbar
   ========================= */
function updateNavbarTarif() {
  const tarifBadge = document.getElementById("tarifAnzeige");
  if (!tarifBadge) return;

  const tarifPreise = {
    "1 Inserat(e)":   "Kostenlos",
    "2 Inserat(e)":   "2,90 € einmalig",
    "3 Inserat(e)":   "5,90 € einmalig",
    "4-5 Inserat(e)": "9,90 € einmalig"
  };

  let tarif = "";
  try { tarif = String(localStorage.getItem("nutzerTarif") || "").trim(); } catch {}

  if (!tarif) { tarifBadge.textContent = ""; return; }

  const preis = tarifPreise[tarif] || "";
  tarifBadge.innerHTML =
    `<i class="fas fa-tag"></i> Aktiver Tarif: ${tarif}${preis ? " – " + preis : ""}`;
}


/* =========================
   Wizard & lokale Draft-Daten zurücksetzen (Privat)
   ========================= */
function clearWizardStatePrivat() {
  // Steps
  try { localStorage.removeItem("privatSteps"); } catch {}

  // Step-Daten
  try { localStorage.removeItem("fahrzeugdaten"); } catch {}
  try { localStorage.removeItem("fahrzeugdetails"); } catch {}
  try { localStorage.removeItem("medien"); } catch {}

  // Legacy (falls vorhanden)
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith("details_")) localStorage.removeItem(k);
    });
  } catch {}

  // Edit-Flags
  try { localStorage.removeItem("editMode"); } catch {}
  try { localStorage.removeItem("editInseratId"); } catch {}

  // Flow-Flags (inkl. editPending!)
  try { sessionStorage.removeItem("inseratGestartet"); } catch {}
  try { sessionStorage.removeItem("hatGespeichert"); } catch {}
  try { sessionStorage.removeItem("editPending"); } catch {}

  // UI neutralisieren
  document.querySelectorAll(".step-box").forEach(b => {
    b.classList.remove("completed");
    const s = b.querySelector(".step-status");
    if (s) s.textContent = "";
  });
}
