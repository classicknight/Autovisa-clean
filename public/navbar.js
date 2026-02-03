document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");

  // Links, die Login brauchen
  const savedCarsLink = document.getElementById("saved-cars-link");
  const messagesLink = document.getElementById("messages-link");
  const overviewLink = document.getElementById("overview-link");

  const mobileSaved = document.getElementById("mobile-saved");
  const mobileMessages = document.getElementById("mobile-messages");
  const mobileOverview = document.getElementById("mobile-overview");

  // Auth container (Login/Logout)
  const authLi = document.getElementById("auth-link");
  const authLoginHTML = authLi ? authLi.innerHTML : "";

  const closeMenu = () => {
    if (navLinks) navLinks.classList.remove("active");
    if (hamburger) hamburger.setAttribute("aria-expanded", "false");
  };

  // Hamburger toggle
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !navLinks.classList.contains("active");
      navLinks.classList.toggle("active");
      hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  }

  // Outside click closes on mobile
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar")) closeMenu();
  });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // === Login Check + Redirect helper ===
  function checkLoginAndRedirect(targetUrl) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.eingeloggt) {
          window.location.href = targetUrl;
        } else {
          localStorage.setItem("redirectAfterLogin", targetUrl);
          window.location.href = "login.html";
        }
      })
      .catch(() => {
        localStorage.setItem("redirectAfterLogin", targetUrl);
        window.location.href = "login.html";
      });
  }

  // Übersicht: darf ohne Login erreichbar sein -> normaler Link, kein Handler nötig.
  // Saved/Messages: Login-Guard
  const bindGuard = (el, url) => {
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeMenu();
      checkLoginAndRedirect(url);
    });
  };

  bindGuard(savedCarsLink, "übersicht.html#saved-cars");
  bindGuard(messagesLink, "übersicht.html#messages-list");
  bindGuard(mobileSaved, "übersicht.html#saved-cars");
  bindGuard(mobileMessages, "übersicht.html#messages-list");

  // Mobile overview normal
  if (mobileOverview) {
    mobileOverview.addEventListener("click", () => closeMenu());
  }
  if (overviewLink) {
    overviewLink.addEventListener("click", () => closeMenu());
  }

  // === Auth UI (Login/Logout) ===
  const clearAuthStorage = () => {
    ["isLoggedIn", "userRole", "userId"].forEach((k) => localStorage.removeItem(k));
    // redirectAfterLogin nicht immer löschen, aber nach Logout schon:
    localStorage.removeItem("redirectAfterLogin");
  };

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

  function renderLogin() {
    if (!authLi) return;
    authLi.innerHTML = authLoginHTML;
  }

  const clearAuthFlags = () => {
    ["isLoggedIn", "userRole", "userId"].forEach((k) => localStorage.removeItem(k));
  };

  // Optional: schnelle UI via localStorage
  const isLoggedInLS = localStorage.getItem("isLoggedIn") === "true";
  if (isLoggedInLS) {
    renderLogout();
  }
  fetch("/getNutzerInfo", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (data?.eingeloggt) {
        renderLogout();
      } else {
        clearAuthFlags();
        renderLogin();
      }
    })
    .catch(() => {});
});
