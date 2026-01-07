// Entfernt no-js Klasse (falls nicht schon in main.js)
document.documentElement.classList.remove("no-js");

(function initAutovisaNavbar(){
  const nav = document.querySelector(".av-nav");
  if (!nav) return;

  const toggle = nav.querySelector(".av-nav__toggle");
  const panel  = nav.querySelector(".av-nav__panel");
  const dropdowns = Array.from(nav.querySelectorAll("[data-dropdown]"));

  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function closeAllDropdowns(except = null){
    dropdowns.forEach(dd => {
      if (dd !== except) closeDropdown(dd);
    });
  }

  function openDropdown(dd){
    const btn = dd.querySelector(".av-dd__toggle");
    const menu = dd.querySelector(".av-dd__menu");
    if (!btn || !menu) return;

    dd.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
  }

  function closeDropdown(dd){
    const btn = dd.querySelector(".av-dd__toggle");
    const menu = dd.querySelector(".av-dd__menu");
    if (!btn || !menu) return;

    dd.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  }

  function toggleDropdown(dd){
    const isOpen = dd.classList.contains("is-open");
    closeAllDropdowns(dd);
    if (!isOpen) openDropdown(dd);
    else closeDropdown(dd);
  }

  function openNav(){
    nav.classList.add("is-open");
    toggle?.setAttribute("aria-expanded", "true");
  }

  function closeNav(){
    nav.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  }

  // Mobile hamburger
  if (toggle){
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.contains("is-open");
      if (isOpen) closeNav();
      else openNav();
    });
  }

  // Dropdown click handlers
  dropdowns.forEach(dd => {
    const btn = dd.querySelector(".av-dd__toggle");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(dd);
    });

    // Keyboard support
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDropdown(dd);
        btn.focus();
      }
      if (e.key === "ArrowDown") {
        openDropdown(dd);
        const first = dd.querySelector('.av-dd__menu a, .av-dd__menu button');
        first?.focus();
      }
    });

    const items = dd.querySelectorAll(".av-dd__menu a, .av-dd__menu button");
    items.forEach(el => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeDropdown(dd);
          btn.focus();
        }
      });
    });
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target)) {
      closeNav();
    }
  });

  // Close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  // Auth UI (minimal): cookie "session" vorhanden?
  const hasSession = document.cookie.split(";").some(c => c.trim().startsWith("session="));
  nav.querySelectorAll("[data-auth='in']").forEach(el => el.style.display = hasSession ? "" : "none");
  nav.querySelectorAll("[data-auth='out']").forEach(el => el.style.display = hasSession ? "none" : "");

  // Logout handler (falls du /logout hast)
  const logoutBtn = nav.querySelector(".av-dd__logout");
  if (logoutBtn){
    logoutBtn.addEventListener("click", async () => {
      try{
        // versuche POST, fallback GET
        const r = await fetch("/logout", { method: "POST", credentials: "include" });
        if (!r.ok) window.location.href = "/logout";
        else window.location.href = "index.html";
      }catch{
        window.location.href = "/logout";
      }
    });
  }
})();
