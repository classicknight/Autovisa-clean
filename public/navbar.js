document.documentElement.classList.remove("no-js");

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const navPanel = $('[data-nav-panel]');
  const overlay = $('[data-nav-overlay]');
  const btnToggle = $('[data-nav-toggle]');
  const btnClose = $('[data-nav-close]');
  const dropdownButtons = $$('button[data-dropdown]');
  const year = $("#year");

  const isMobile = () => window.matchMedia("(max-width: 980px)").matches;

  // ---------------------------
  // Utils: Dropdown handling
  // ---------------------------
  const closeAllDropdowns = (exceptLi = null) => {
    $$(".dropdown").forEach(li => {
      if (li !== exceptLi) {
        li.classList.remove("is-open");
        const btn = li.querySelector("button[data-dropdown]");
        if (btn) btn.setAttribute("aria-expanded", "false");
      }
    });
  };

  const toggleDropdown = (btn) => {
    const li = btn.closest(".dropdown");
    if (!li) return;

    const willOpen = !li.classList.contains("is-open");
    closeAllDropdowns(willOpen ? li : null);

    li.classList.toggle("is-open", willOpen);
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");

    // Desktop: wenn geöffnet, first item fokussierbar machen bei ArrowDown
    if (!isMobile() && willOpen) {
      const firstLink = li.querySelector(".dropdown-menu a");
      // nicht automatisch focusen (wirkt oft „sprunghaft“), nur vorbereitet
      if (firstLink) firstLink.tabIndex = 0;
    }
  };

  // ---------------------------
  // Mobile Drawer
  // ---------------------------
  const openDrawer = () => {
    if (!navPanel || !overlay) return;
    navPanel.classList.add("is-open");
    overlay.hidden = false;

    if (btnToggle) btnToggle.setAttribute("aria-expanded", "true");

    // Fokus auf erstes Bedienelement im Panel (nice UX)
    const firstFocusable = navPanel.querySelector('button, a, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus?.();
  };

  const closeDrawer = () => {
    if (!navPanel || !overlay) return;
    navPanel.classList.remove("is-open");
    overlay.hidden = true;

    if (btnToggle) btnToggle.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  };

  const drawerIsOpen = () => navPanel?.classList.contains("is-open");

  // ---------------------------
  // Bind events
  // ---------------------------
  dropdownButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(btn);
    });

    // Keyboard: Enter/Space toggles; ArrowDown opens & focuses first item; Escape closes
    btn.addEventListener("keydown", (e) => {
      const li = btn.closest(".dropdown");
      const menu = li?.querySelector(".dropdown-menu");
      const firstLink = menu?.querySelector("a");

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (li && !li.classList.contains("is-open")) toggleDropdown(btn);
        firstLink?.focus?.();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        closeAllDropdowns();
        btn.setAttribute("aria-expanded", "false");
        btn.focus();
      }
    });
  });

  // Drawer controls
  btnToggle?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!navPanel || !overlay) return;

    if (drawerIsOpen()) closeDrawer();
    else openDrawer();
  });

  btnClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeDrawer();
  });

  overlay?.addEventListener("click", () => closeDrawer());

  // Outside click (Desktop) closes dropdowns
  document.addEventListener("click", (e) => {
    const insideNav = e.target.closest(".av-nav");
    if (!insideNav) closeAllDropdowns();
  });

  // Escape closes everything
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (drawerIsOpen()) {
      closeDrawer();
      btnToggle?.focus?.();
      return;
    }

    closeAllDropdowns();
  });

  // On resize: close drawer if switching to desktop
  window.addEventListener("resize", () => {
    if (!isMobile() && drawerIsOpen()) closeDrawer();
  }, { passive: true });

  // Footer year
  if (year) year.textContent = String(new Date().getFullYear());

  // ---------------------------
  // Optional: Auth state (Autovisa endpoints)
  // - /getNutzerInfo  -> { eingeloggt: boolean, rolle?: string }
  // - /logout (POST)
  // ---------------------------
  const authSlot = $("#authSlot");
  const authSlotMobile = $("#authSlotMobile");

  const setAuthUI = (loggedIn) => {
    const htmlLoggedOut = `
      <a class="ghost-btn" href="login.html">
        <i class="fa-regular fa-user" aria-hidden="true"></i>
        <span>Login</span>
      </a>
    `;

    const htmlLoggedIn = `
      <button class="ghost-btn" type="button" id="logoutBtn">
        <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
        <span>Logout</span>
      </button>
    `;

    if (authSlot) authSlot.innerHTML = loggedIn ? htmlLoggedIn : htmlLoggedOut;
    if (authSlotMobile) {
      authSlotMobile.innerHTML = loggedIn
        ? `<button class="ghost-btn ghost-block" type="button" id="logoutBtnMobile">
             <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
             <span>Logout</span>
           </button>`
        : `<a class="ghost-btn ghost-block" href="login.html">
             <i class="fa-regular fa-user" aria-hidden="true"></i>
             <span>Login</span>
           </a>`;
    }

    // bind logout
    const bindLogout = (btnId) => {
      const b = document.getElementById(btnId);
      if (!b) return;

      b.addEventListener("click", async () => {
        try {
          await fetch("/logout", { method: "POST", credentials: "include" });
        } catch {}
        // minimal clean: reload, damit UI konsistent ist
        location.reload();
      });
    };

    bindLogout("logoutBtn");
    bindLogout("logoutBtnMobile");
  };

  const checkAuth = async () => {
    try {
      const res = await fetch("/getNutzerInfo", { credentials: "include" });
      if (!res.ok) throw new Error("auth");
      const data = await res.json();
      return !!data?.eingeloggt;
    } catch {
      return null; // endpoint evtl. nicht vorhanden -> UI bleibt Login
    }
  };

  // Guarded links: wenn nicht eingeloggt -> login + redirectAfterLogin
  const getRedirectTarget = (targetUrl) => {
    // wir speichern exakt das Ziel
    return String(targetUrl || "index.html");
  };

  const authGuardLinks = $$("[data-auth-guard]");
  const guardToLogin = async (targetUrl) => {
    localStorage.setItem("redirectAfterLogin", getRedirectTarget(targetUrl));
    window.location.href = "login.html";
  };

  const wireAuthGuards = async () => {
    const status = await checkAuth();
    if (status === null) return; // keine Auth-API: nicht blocken

    setAuthUI(status);

    authGuardLinks.forEach(a => {
      a.addEventListener("click", async (e) => {
        const targetUrl = a.getAttribute("data-auth-guard");
        if (!targetUrl) return;

        // wenn eingeloggt -> normal folgen lassen
        const current = await checkAuth();
        if (current) return;

        e.preventDefault();
        e.stopPropagation();
        await guardToLogin(targetUrl);
      });
    });
  };

  wireAuthGuards();
})();
