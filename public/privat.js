// privat.js
document.documentElement.classList.remove('no-js');

document.addEventListener("DOMContentLoaded", () => {
  // Verkäufertyp merken
  try { localStorage.setItem("verkaeuferTyp", "Privat"); } catch {}

  // ===== Navbar / Dropdowns (wie neue Navbar) =====
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");
  const authDisplayEl = document.getElementById("auth-display");

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

    // leichte Stagger-Animation
    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    // nur Desktop zentrieren
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }

  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    li.classList.contains("open") ? closeAllDropdowns() : openDropdown(trigger);
  }

  // Hamburger
  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !navLinks.classList.contains("active");
    navLinks.classList.toggle("active");
    closeAllDropdowns();
    hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  // Dropdowns nur per Klick
  dropdownLinks.forEach(link => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });

  // kein Hover-Open (absichtlich entfernt)

  // außerhalb klicken / ESC
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

  // Reposition bei Resize/Scroll
  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  // ===== Login-Pflicht + Rollencheck (Privat) =====
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(res => res.json())
    .then(user => {
      if (!user?.eingeloggt) {
        try { localStorage.setItem("redirectAfterLogin", "privat.html"); } catch {}
        window.location.href = "login.html";
        return;
      }
      if (user.rolle !== "privat") {
        alert("Dieser Bereich ist nur für Privatverkäufer zugänglich.");
        window.location.href = "verkaufen.html";
        return;
      }

      // Eingeloggt: Anzeige (ohne Logout-Link)
      initAuthDisplay(user);

      // interne Links
      const savedCarsLink = document.getElementById("saved-cars-link");
      const myCarsLink    = document.getElementById("my-cars-link");
      savedCarsLink?.addEventListener("click", (e) => { e.preventDefault(); window.location.href = "gespeicherte-autos.html"; });
      myCarsLink?.addEventListener("click", (e) => { e.preventDefault(); window.location.href = "meine-autos.html"; });

      // Steps + Tarife
      initStepsAndTariffs(user);
    })
    .catch(() => {
      if (authDisplayEl) authDisplayEl.innerHTML = `<i class="fas fa-user-slash"></i> Fehler beim Laden`;
    });

  function initAuthDisplay(user) {
    if (!authDisplayEl) return;
    const name  = user?.name || user?.email || "";
    const label = name ? `Eingeloggt – Privat: ${name}` : `Eingeloggt – Privat`;
    authDisplayEl.innerHTML = `<i class="fas fa-user-check"></i> ${label}`;
  }

  function initStepsAndTariffs(user) {
    // Schritt-Boxen Navigation
    document.querySelectorAll(".step-box").forEach((box) => {
      box.addEventListener("click", () => {
        const step = box.dataset.step;
        if      (step === "1") window.location.href = "fahrzeugdaten.html";
        else if (step === "2") window.location.href = "fahrzeugdetails.html";
        else if (step === "3") window.location.href = "medien.html";
        else if (step === "4") window.location.href = "vorschau.html";
      });
    });

    // Schrittstatus (bei Bedarf anpassen)
    updateStepStatus(1);

    // Inserat neu gestartet?
    const ref = document.referrer || "";
    const neutral = ["index.html", "verkaufen.html", "privat.html"].some(p => ref.includes(p));
    if (neutral) {
      try {
        sessionStorage.setItem("inseratGestartet", "true");
        sessionStorage.removeItem("hatGespeichert");
      } catch {}
    }

    // Tarif-Grid (Privat: „Inserat(e)“)
    const boxes = document.querySelectorAll("#privatTarifGrid .tarif-box");

    fetch("/getTarif", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        let tarif = data?.tarif || "";
        if (tarif) {
          boxes.forEach(box => {
            box.classList.toggle("selected", box.dataset.tarif + " Inserat(e)" === tarif);
          });
          try { localStorage.setItem("nutzerTarif", tarif); } catch {}
        } else if (boxes.length) {
          const first = boxes[0];
          first.classList.add("selected");
          const initialTarif = first.dataset.tarif + " Inserat(e)";
          try { localStorage.setItem("nutzerTarif", initialTarif); } catch {}
          fetch("/saveTarif", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ tarif: initialTarif })
          });
        }
        updateNavbarTarif();
      });

    boxes.forEach(box => {
      box.addEventListener("click", () => {
        boxes.forEach(b => b.classList.remove("selected"));
        box.classList.add("selected");
        const tarifWert = box.dataset.tarif + " Inserat(e)";
        try { localStorage.setItem("nutzerTarif", tarifWert); } catch {}
        fetch("/saveTarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tarif: tarifWert })
        });
        updateNavbarTarif();
      });
    });
  }

  // Smooth Scroll (falls vorhanden)
  const searchLink = document.querySelector('a[href="#search-section"]');
  searchLink?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
  });
});

// ===== Schritt-Visualisierung (shared) =====
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

// ===== Mobiles Tarif-Ausklappen (Privat) =====
function togglePrivatTarife() {
  const hiddenTarife = document.querySelectorAll("#privatTarifGrid .hide-mobile");
  const btn = document.querySelector(".tarif-toggle-btn");
  if (!btn || !hiddenTarife.length) return;

  const currentlyHidden = Array.from(hiddenTarife).some(el => el.style.display === "none" || !el.style.display);
  hiddenTarife.forEach(el => { el.style.display = currentlyHidden ? "block" : "none"; });
  btn.textContent = currentlyHidden ? "Weniger anzeigen" : "Mehr Tarife anzeigen";
}

// ===== Tarif-Badge in Navbar =====
function updateNavbarTarif() {
  const tarifBadge = document.getElementById("tarifAnzeige");
  if (!tarifBadge) return;

  const tarifPreise = {
    "1 Inserat(e)":   "Kostenlos",
    "2 Inserat(e)":   "2,90 € einmalig",
    "3 Inserat(e)":   "5,90 € einmalig",
    "4-5 Inserat(e)": "9,90 € einmalig"
  };

  let gespeicherterTarif = "";
  try { gespeicherterTarif = localStorage.getItem("nutzerTarif"); } catch {}
  if (gespeicherterTarif) {
    const preis = tarifPreise[gespeicherterTarif] || "";
    tarifBadge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${gespeicherterTarif} – ${preis}`;
  }
}
