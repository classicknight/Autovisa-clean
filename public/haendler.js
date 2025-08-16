document.documentElement.classList.remove('no-js');

document.addEventListener("DOMContentLoaded", () => {
  // ====== Grund-Refs ======
  const navLinks       = document.getElementById("nav-links");
  const hamburger      = document.getElementById("hamburger");
  const dropdownLinks  = document.querySelectorAll(".dropdown > a");
  const dropdownLis    = document.querySelectorAll(".dropdown");
  const authDisplayEl  = document.getElementById("auth-display"); // <span id="auth-display">…</span> in Home-Dropdown
  const savedCarsLink  = document.getElementById("saved-cars-link");
  const myCarsLink     = document.getElementById("my-cars-link");

  // Händler-Modus merken (falls verwendet)
  try { localStorage.setItem("verkaeuferTyp", "Händler"); } catch {}

  // ====== Dropdown-Helpers (wie bei der neuen Navbar) ======
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

    // Stagger-Animation der Items
    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    // Nur Desktop zentrieren (Mobile hat position:static)
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }

  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    if (li.classList.contains("open")) {
      closeAllDropdowns();
    } else {
      openDropdown(trigger);
    }
  }

  // ====== Hamburger (klickt toggelt Panel) ======
  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !navLinks.classList.contains("active");
    navLinks.classList.toggle("active");
    closeAllDropdowns();
    hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  // ====== Dropdowns NUR per Klick ======
  dropdownLinks.forEach(link => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });

  // >>> KEIN Hover-Open (bewusst entfernt)

  // ====== Outside-Click schließt nur, wenn außerhalb der Navbar ======
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar")) {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // ESC schließt
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // Reposition bei Resize/Scroll (Desktop)
  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  // ====== Login-Pflicht + Rollencheck (Händler) ======
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(res => res.json())
    .then(user => {
      if (!user?.eingeloggt) {
        try { localStorage.setItem("redirectAfterLogin", "haendler.html"); } catch {}
        window.location.href = "login.html";
        return;
      }
      if (user.rolle !== "haendler") {
        // Falls versehentlich falsche Rolle aufgerufen: zurück zur Auswahl
        alert("Dieser Bereich ist nur für Händler zugänglich.");
        window.location.href = "verkaufen.html";
        return;
      }

      // Navbar „Eingeloggt“ + Logout-Link im Home-Dropdown
      initAuthDisplay(user);

      // Gespeicherte / Eigene Autos: mit Login schon klar → direkt springen
      savedCarsLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "gespeicherte-autos.html";
      });
      myCarsLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "meine-autos.html";
      });

      // Schritte- und Tarif-Logik erst nach erfolgreichem Login
      initStepsAndTariff(user);
    })
    .catch(err => console.error("❌ Fehler beim Login-Check:", err));

  // ====== Auth-UI im Home-Dropdown ======
  function initAuthDisplay(user) {
    if (!authDisplayEl) return;
    const name  = user?.name || user?.email || "";
    const role  = user?.rolle === "haendler" ? "Händler" : user?.rolle || "";
    const label = name ? `Eingeloggt${role ? " – " + role : ""}: ${name}` : `Eingeloggt${role ? " – " + role : ""}`;

    authDisplayEl.innerHTML = `
      <i class="fas fa-user-check"></i> ${label}
      &nbsp;&nbsp;•&nbsp;&nbsp;
      <a href="#" id="logout-link" style="color:#ffb3b3;text-decoration:underline">
        <i class="fas fa-sign-out-alt"></i> Abmelden
      </a>
    `;

    document.getElementById("logout-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      fetch("/logout", { method: "POST", credentials: "include" })
        .then(() => { try { localStorage.clear(); } catch {} location.reload(); })
        .catch(() => alert("Abmelden fehlgeschlagen."));
    });
  }

  // ====== Schritte & Tarife ======
  function initStepsAndTariff(user) {
    const userId = user?.id || localStorage.getItem("userId") || null;

    // Schrittboxen (1..4)
    document.querySelectorAll(".step-box").forEach((box) => {
      box.addEventListener("click", () => {
        const step = box.dataset.step;
        if      (step === "1") window.location.href = "fahrzeugdaten.html";
        else if (step === "2") window.location.href = "fahrzeugdetails.html";
        else if (step === "3") window.location.href = "medien.html";
        else if (step === "4") window.location.href = "vorschau.html";
      });
    });

    // Schrittanzeige updaten (hier: Beispiel „2“ – kannst du anpassen)
    updateStepStatus(2);

    // Inserat-Status anhand Referrer (Neustart?)
    const ref = document.referrer || "";
    const neutral = ["index.html", "verkaufen.html", "haendler.html"].some(p => ref.includes(p));
    if (neutral) {
      try {
        sessionStorage.setItem("inseratGestartet", "true");
        sessionStorage.removeItem("hatGespeichert");
      } catch {}
    }

    // Tarif-UI
    const boxes = document.querySelectorAll(".tarif-box");
    fetch("/getTarif", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        let tarif = data?.tarif || "";
        if (tarif) {
          boxes.forEach(box => {
            if (box.dataset.tarif + " Fahrzeuge" === tarif) box.classList.add("selected");
            else box.classList.remove("selected");
          });
          try { localStorage.setItem("nutzerTarif", tarif); } catch {}
        } else {
          const first = document.querySelector(".tarif-box");
          if (first) {
            first.classList.add("selected");
            const initial = first.dataset.tarif + " Fahrzeuge";
            try { localStorage.setItem("nutzerTarif", initial); } catch {}
            fetch("/saveTarif", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ tarif: initial, userId })
            });
          }
        }
        updateNavbarTarif();
      });

    boxes.forEach(box => {
      box.addEventListener("click", () => {
        boxes.forEach(b => b.classList.remove("selected"));
        box.classList.add("selected");
        const tarifWert = box.dataset.tarif + " Fahrzeuge";
        try { localStorage.setItem("nutzerTarif", tarifWert); } catch {}
        fetch("/saveTarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tarif: tarifWert, userId })
        });
        updateNavbarTarif();
      });
    });
  }

  // ====== Tarif-Badge in Navbar (falls vorhanden) ======
  function updateNavbarTarif() {
    const tarifBadge = document.getElementById("tarifAnzeige");
    if (!tarifBadge) return;

    const preisMap = {
      "0–3 Fahrzeuge":   "Kostenlos",
      "4–10 Fahrzeuge":  "4,90 € / Monat",
      "11–25 Fahrzeuge": "9,90 € / Monat",
      "26–50 Fahrzeuge": "17,90 € / Monat",
      "51–100 Fahrzeuge":"29,90 € / Monat",
      "100+ Fahrzeuge":  "Auf Anfrage"
    };

    let t = "";
    try { t = localStorage.getItem("nutzerTarif") || ""; } catch {}
    if (t) {
      const preis = preisMap[t] || "";
      tarifBadge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${t} – ${preis}`;
    }
  }

  // ====== Mobile „Mehr Tarife anzeigen“ (optional) ======
  window.toggleTarife = function toggleTarife() {
    const hiddenTarife = document.querySelectorAll(".hide-mobile");
    const btn = document.querySelector(".tarif-toggle-btn");
    if (!btn || !hiddenTarife.length) return;

    const currentlyHidden = Array.from(hiddenTarife).some(el => el.style.display === "none" || !el.style.display);
    hiddenTarife.forEach(el => { el.style.display = currentlyHidden ? "block" : "none"; });
    btn.textContent = currentlyHidden ? "Weniger anzeigen" : "Mehr Tarife anzeigen";
  };

  // ====== Smooth Scroll (falls vorhanden) ======
  const searchLink = document.querySelector('a[href="#search-section"]');
  searchLink?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
  });
});

// ====== Schrittvisualisierung (shared) ======
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
