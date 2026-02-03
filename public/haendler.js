// haendler.js — EINHEITLICH
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Navbar / Dropdown (Klick)
     ========================= */
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");
  const authDisplayEl = document.getElementById("auth-display");
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");

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

  /* =========================
     Edit-Mode Bootstrap (Händler)
     - kompatibel zu übersicht.js
     ========================= */
  (function initEditModeHaendler() {
    const params = new URLSearchParams(location.search);
    const editParam = params.get("edit");
    if (!editParam) return;

    // ID aus URL oder Fallback aus Storage
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

    // Merker: Wir sind im Edit-Flow, aber bleiben auf haendler.html,
    // bis der User einen Schritt anklickt.
    sessionStorage.setItem("editPending", "1");

    // wichtig: diese beiden NICHT hier setzen (sonst springst du zu früh weiter)
    sessionStorage.removeItem("inseratGestartet");
    sessionStorage.removeItem("hatGespeichert");

    // Wenn Daten schon aus übersicht.js da sind → nichts überschreiben
    const hasAny =
      localStorage.getItem("fahrzeugdaten") ||
      localStorage.getItem("fahrzeugdetails") ||
      localStorage.getItem("medien");

    if (hasAny) return;

    // Optionaler Fallback: wenn jemand direkt haendler.html?edit=<id> aufruft,
    // kannst du später einen Endpoint anbieten.
    // Aktuell: bewusst leer lassen, um keine falschen Mappings reinzuschreiben.
  })();




  /* =========================
     Auth / Händler-Pflicht
     ========================= */
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(res => res.json())
    .then(user => {
      if (!user?.eingeloggt) {
        try {
          const url = location.search ? `haendler.html${location.search}` : "haendler.html";
          localStorage.setItem("redirectAfterLogin", url);
        } catch {}
        window.location.href = "login.html";
        return;
      }

      const roleRaw = String(user?.role || user?.rolle || "").toLowerCase();
      const isHaendler = roleRaw.includes("haend") || roleRaw.includes("händ");

      if (!isHaendler) {
        alert("Dieser Bereich ist nur für Händler zugänglich.");
        window.location.href = "verkaufen.html";
        return;
      }

      initAuthDisplay(user);

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
      initStepsUI();
      initMobileImport();
      initWizard();
      
    })
    .catch(err => console.error("❌ Fehler beim Login-Check:", err));

  function initAuthDisplay(user) {
    if (!authDisplayEl) return;

    const name = user?.name || user?.email || "";
    const roleRaw = String(user?.role || user?.rolle || "");
    const role = roleRaw.toLowerCase().includes("haend") || roleRaw.toLowerCase().includes("händ")
      ? "Händler"
      : roleRaw;

    const label = name
      ? `Eingeloggt${role ? " – " + role : ""}: ${name}`
      : `Eingeloggt${role ? " – " + role : ""}`;

    authDisplayEl.innerHTML = `<i class="fas fa-user-check"></i> ${label}`;
  }

  /* =========================
     Wizard / Steps
     ========================= */
  const STEP_STATE_KEY = "haendlerSteps";
  let stepsState = {};

  // Exponiere Mini-APIs für andere Seiten
  window.markStepDone = (step) => markStepDone(step);
  window.showToast    = (msg, type) => showToast(msg, type);

  function initStepsUI() {
    stepsState = loadSteps();
    setupToasts();
    renderStepsFromState();
    wireStepNavigation();
  }


  async function initWizard() {
    if (!document.getElementById("toast-container")) setupToasts();

    const isEditFlow =
      localStorage.getItem("editMode") === "1" ||
      sessionStorage.getItem("editPending") === "1" ||
      new URLSearchParams(location.search).has("edit");

    // A) Direkt nach dem Veröffentlichen?
    if (sessionStorage.getItem("resetWizard") === "1") {
      clearWizardState();
      sessionStorage.removeItem("resetWizard");
      showToast("Inserat veröffentlicht – Assistent zurückgesetzt ✅");
      return;
    }

    // B) Kein Draft mehr vorhanden? → zurücksetzen
    //    ABER: NICHT im Edit-Flow, sonst werden die edit-Daten aus localStorage gelöscht.
    if (!isEditFlow) {
      try {
        const drafts = await fetch("/getVehicleData", { credentials: "include" }).then(r => r.json());
        const hasDraft = Array.isArray(drafts) && drafts.some(v => !v.status || v.status === "draft");
        if (!hasDraft) clearWizardState();
      } catch (e) {
        console.warn("Entwurfs-Check fehlgeschlagen:", e);
      }
    }
  }

  function ensureWizardFlagsBeforeLeavingHaendler() {
    try {
      const isEdit =
        localStorage.getItem("editMode") === "1" ||
        sessionStorage.getItem("editPending") === "1" ||
        new URLSearchParams(location.search).has("edit");

      // Wizard ist gestartet, sobald man einen Schritt verlässt
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
          ensureWizardFlagsBeforeLeavingHaendler();
          window.location.href = targets[step];
        }
      });
    });
  }
  /* ---------- Steps ---------- */
  function markStepDone(step) {
    const box = document.querySelector(`.step-box[data-step="${step}"]`);
    if (box) {
      box.classList.add("completed");
      const status = box.querySelector(".step-status");
      if (status) status.textContent = "✔️";
    }
    stepsState[step] = true;
    saveSteps();
  }

  function renderStepsFromState() {
    Object.entries(stepsState).forEach(([step, val]) => {
      if (!val) return;
      const box = document.querySelector(`.step-box[data-step="${step}"]`);
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

});

/* =========================
   Wizard & lokale Draft-Daten zurücksetzen (global)
   ========================= */
function clearWizardState() {
  // Steps
  try { localStorage.removeItem("haendlerSteps"); } catch {}

  // Step-Daten (neuer Standard)
  try { localStorage.removeItem("fahrzeugdaten"); } catch {}
  try { localStorage.removeItem("fahrzeugdetails"); } catch {}
  try { localStorage.removeItem("medien"); } catch {}

  // Legacy/Alt-Keys (falls irgendwo noch genutzt)
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith("details_")) localStorage.removeItem(k);
    });
  } catch {}

  // Edit-Flags
  try { localStorage.removeItem("editMode"); } catch {}
  try { localStorage.removeItem("editInseratId"); } catch {}

  // Flow-Flags
  try { sessionStorage.removeItem("inseratGestartet"); } catch {}
  try { sessionStorage.removeItem("hatGespeichert"); } catch {}
  try { sessionStorage.removeItem("editPending"); } catch {}

  // UI sofort neutralisieren (falls haendler.html offen ist)
  document.querySelectorAll(".step-box").forEach(b => {
    b.classList.remove("completed");
    const s = b.querySelector(".step-status");
    if (s) s.textContent = "";
  });
}



