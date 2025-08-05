document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");

  // === Dropdown-Menüs & Hamburger ===
  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks?.classList.toggle("active");
    closeAllDropdowns();
  });

  dropdownLinks.forEach(link => {
    const menu = link.nextElementSibling;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll(".dropdown-menu").forEach(other => {
        if (other !== menu) other.classList.remove("show");
      });
      menu.classList.toggle("show");
    });
  });

  document.addEventListener("click", () => {
    navLinks?.classList.remove("active");
    closeAllDropdowns();
  });

  function closeAllDropdowns() {
    document.querySelectorAll(".dropdown-menu").forEach(menu => {
      menu.classList.remove("show");
    });
  }

  // === Navbar Login/Logout (LocalStorage & Fetch Fallback) ===
  const authLink = document.getElementById("auth-link");

  function handleLogout(e) {
    e.preventDefault();
    fetch("/logout", { method: "POST", credentials: "include" })
      .then(() => {
        localStorage.clear();
        location.reload();
      })
      .catch(() => alert("Abmelden fehlgeschlagen."));
  }

  function setLoggedInNavbar() {
    authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
    document.getElementById("logout-link").addEventListener("click", handleLogout);
  }

  const isLoggedInLocal = localStorage.getItem("isLoggedIn") === "true";
  if (isLoggedInLocal) {
    setLoggedInNavbar();
  } else {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.eingeloggt) setLoggedInNavbar();
      })
      .catch(err => {
        console.error("Fehler beim Abrufen des Login-Zustands:", err);
      });
  }

  // === Login-Zustand & Navigation für verkaufen.html ===
  fetch("/getNutzerInfo", {
    method: "GET",
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      const isLoggedIn = data.eingeloggt === true;
      const rolle = data.rolle;

      const privatLink = document.getElementById("privat-link");
      const haendlerLink = document.getElementById("haendler-link");

      if (isLoggedIn) {
        if (rolle === "privat") {
          haendlerLink?.classList.add("disabled");
          haendlerLink.title = "Als Privatverkäufer nicht verfügbar";
        } else if (rolle === "haendler") {
          privatLink?.classList.add("disabled");
          privatLink.title = "Als Händler nicht verfügbar";
        }
      }

      privatLink?.addEventListener("click", (e) => {
        e.preventDefault();
        if (!isLoggedIn || rolle !== "privat") return;
        window.location.href = "privat.html";
      });

      haendlerLink?.addEventListener("click", (e) => {
        e.preventDefault();
        if (!isLoggedIn || rolle !== "haendler") return;
        window.location.href = "haendler.html";
      });

      const savedCarsLink = document.getElementById("saved-cars-link");
      const myCarsLink = document.getElementById("my-cars-link");

      savedCarsLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = isLoggedIn ? "gespeicherte-autos.html" : "login.html";
      });

      myCarsLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = isLoggedIn ? "meine-autos.html" : "login.html";
      });
    })
    .catch(err => {
      console.error("❌ Fehler beim Login-Check:", err);
    });

  // === Smooth scroll
  const searchLink = document.querySelector('a[href="#search-section"]');
  if (searchLink) {
    searchLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
});








document.documentElement.classList.remove('no-js');

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");

  // Hamburger-Menü
  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks.classList.toggle("active");
    hamburger.setAttribute("aria-expanded", navLinks.classList.contains("active"));
    closeAllDropdowns();
  });

  // Dropdowns
  dropdownLinks.forEach(link => {
    const menu = link.nextElementSibling;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      document.querySelectorAll(".dropdown-menu").forEach(otherMenu => {
        if (otherMenu !== menu) otherMenu.classList.remove("show");
      });

      menu.classList.toggle("show");
      link.setAttribute("aria-expanded", menu.classList.contains("show"));
    });
  });

  document.addEventListener("click", () => {
    navLinks.classList.remove("active");
    hamburger.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks.classList.remove("active");
      hamburger.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  function closeAllDropdowns() {
    document.querySelectorAll(".dropdown-menu").forEach(menu => menu.classList.remove("show"));
    dropdownLinks.forEach(link => link.setAttribute("aria-expanded", "false"));
  }

  // Login-abhängige Weiterleitungen
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink = document.getElementById("my-cars-link");
  const soldCarsLink = document.getElementById("sold-cars-link");
  const messagesLink = document.getElementById("messages-link");

  function checkLoginAndRedirect(targetUrl) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        window.location.href = data.eingeloggt ? targetUrl : "login.html";
      });
  }

  if (savedCarsLink) savedCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#saved"); });
  if (myCarsLink) myCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#my-cars"); });
  if (soldCarsLink) soldCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#sold"); });
  if (messagesLink) messagesLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#chats"); });

  // Smooth Scroll
  const searchLink = document.querySelector('a[href="#search-section"]');
  if (searchLink) {
    searchLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Filter Toggle
  const form = document.querySelector('.search-form');
  const advancedBtn = form?.querySelector('.btn-advanced');
  const filters = document.getElementById('extra-filters');
  if (advancedBtn && filters) {
    advancedBtn.addEventListener("click", () => {
      filters.classList.toggle('show');
      advancedBtn.textContent = filters.classList.contains('show') ? 'Filter schließen' : 'Weitere Filter';
    });
  }

  // Navbar Login/Logout
  const authLink = document.getElementById("auth-link");

  if (authLink) {
    // LocalStorage Check zuerst (schneller als fetch)
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

    if (isLoggedIn) {
      authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
      document.getElementById("logout-link").addEventListener("click", handleLogout);
    } else {
      // Falls LocalStorage nicht vorhanden — sichere Abfrage über Server
      fetch("/getNutzerInfo", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data.eingeloggt) {
            authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
            document.getElementById("logout-link").addEventListener("click", handleLogout);
          }
        })
        .catch(err => {
          console.error("Fehler beim Abrufen des Login-Zustands:", err);
        });
    }
  }

  function handleLogout(e) {
    e.preventDefault();
    fetch("/logout", { method: "POST", credentials: "include" })
      .then(() => {
        localStorage.clear();
        location.reload();
      })
      .catch(() => alert("Abmelden fehlgeschlagen."));
  }

});
