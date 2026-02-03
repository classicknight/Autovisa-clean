
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Navbar / Dropdowns
  // =========================
  const navLinks = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis = document.querySelectorAll(".dropdown");

  // ===== SlimSelect Safe Init =====
  const hasSlim = typeof window.SlimSelect === "function";
  const initSlim = (selector, opts = {}) => {
    const el = document.querySelector(selector);
    if (!hasSlim || !el) return null;
    try {
      return new SlimSelect({ select: selector, ...opts });
    } catch (e) {
      console.warn("SlimSelect init failed for", selector, e);
      return null;
    }
  };

  // ===== Helpers =====
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function closeAllDropdowns(except = null) {
    dropdownLis.forEach((li) => {
      if (li !== except) {
        li.classList.remove("open");

        const trigger = li.querySelector('a[aria-haspopup="true"]');
        const menu = li.querySelector(".dropdown-menu");

        if (trigger) trigger.setAttribute("aria-expanded", "false");

        if (menu) {
          menu.classList.remove("show");
          menu.style.left = "";
          [...menu.children].forEach((item) => (item.style.transitionDelay = ""));
        }
      }
    });
  }

  function positionMenu(li) {
    const trigger = li.querySelector('a[aria-haspopup="true"]');
    const menu = li.querySelector(".dropdown-menu");
    if (!trigger || !menu) return;

    const tRect = trigger.getBoundingClientRect();
    const mRect = menu.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const vw = window.innerWidth;

    const center = tRect.left + tRect.width / 2;
    let leftAbs = center - mRect.width / 2;
    leftAbs = clamp(leftAbs, 16, vw - mRect.width - 16);

    const relativeLeft = leftAbs - liRect.left;
    menu.style.left = `${relativeLeft}px`;
  }

  function openDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    if (!li || !menu) return;

    closeAllDropdowns(li);

    li.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.classList.add("show");

    // Stagger der Items
    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    // Nur Desktop zentrieren
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }

  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    if (!li) return;

    const isOpen = li.classList.contains("open");
    if (isOpen) closeAllDropdowns();
    else openDropdown(trigger);
  }

  // ===== Hamburger =====
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !navLinks.classList.contains("active");
      navLinks.classList.toggle("active");
      closeAllDropdowns();
      hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  }

  // ===== Dropdown nur per Klick =====
  dropdownLinks.forEach((link) => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });

  // ===== Outside Click schließt =====
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar")) {
      if (navLinks) navLinks.classList.remove("active");
      if (hamburger) hamburger.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // ===== ESC schließt =====
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (navLinks) navLinks.classList.remove("active");
      if (hamburger) hamburger.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // ===== Reposition on resize/scroll =====
  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen, { passive: true });
  window.addEventListener("scroll", repositionOpen, { passive: true });

  // =========================
  // Login-abhängige Weiterleitungen
  // =========================
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink = document.getElementById("my-cars-link");
  const soldCarsLink = document.getElementById("sold-cars-link");
  const messagesLink = document.getElementById("messages-link");

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

  // Desktop/Dropdown-Links
  if (savedCarsLink) savedCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#saved-cars"); });
  if (myCarsLink) myCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#car-list"); });
  if (soldCarsLink) soldCarsLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#sold-cars"); });
  if (messagesLink) messagesLink.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndRedirect("übersicht.html#messages-list"); });

  // Mobile-Icons (Herz & Nachrichten)
  const mobileSaved = document.getElementById("mobile-saved");
  const mobileMessages = document.getElementById("mobile-messages");

  if (mobileSaved) {
    mobileSaved.addEventListener("click", (e) => {
      e.preventDefault();
      checkLoginAndRedirect("übersicht.html#saved-cars");
    });
  }
  if (mobileMessages) {
    mobileMessages.addEventListener("click", (e) => {
      e.preventDefault();
      checkLoginAndRedirect("übersicht.html#messages-list");
    });
  }

  // =========================
  // Smooth Scroll (nur wenn Anker existieren)
  // =========================
  const searchLink = document.querySelector('a[href="#search-section"]');
  const resultsLink = document.querySelector('a[href="#results-section"]');

  if (searchLink) {
    searchLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
  if (resultsLink) {
    resultsLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#results-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // =========================
  // Navbar Login/Logout (ohne localStorage.clear)
  // =========================
  const authLink = document.getElementById("auth-link");
  const authLoginHTML = authLink ? authLink.innerHTML : "";

  const clearAuthStorage = () => {
    ["isLoggedIn", "userRole", "userId"].forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("redirectAfterLogin");
  };

  function renderLogin() {
    if (!authLink) return;
    authLink.innerHTML = authLoginHTML;
  }

  function renderLogout() {
    if (!authLink) return;
    authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) logoutLink.addEventListener("click", handleLogout);
  }

  function handleLogout(e) {
    e.preventDefault();
    fetch("/logout", { method: "POST", credentials: "include" })
      .finally(() => {
        clearAuthStorage();
        location.reload();
      });
  }

  if (authLink) {
    // schnelle UI-Variante: wenn localStorage bereits sagt "eingeloggt", direkt anzeigen
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
          ["isLoggedIn", "userRole", "userId"].forEach((k) => localStorage.removeItem(k));
          renderLogin();
        }
      })
      .catch((err) => console.error("Fehler beim Abrufen des Login-Zustands:", err));
  }

  // =========================
  // Marke/Modell – Setup (bis modelData Start)
  // =========================
  const brandDropdown = document.getElementById("marke");
  const modelDropdown = document.getElementById("modell");

  // Wenn du SlimSelect für Marke direkt hier initialisieren willst:
  // initSlim("#marke", { placeholder: "Marke wählen", allowDeselect: true, showSearch: true });

  const modelData = {
    "Abarth": ["Beliebig", "124 Spider", "500", "500C", "595", "595C", "595 Competizione", "595 Turismo", "695", "695C", "Grande Punto", "Punto Evo", "Andere"],
    "AC": ["Beliebig", "Andere"],
    // ...

        "Acura": ["Beliebig", "MDX", "NSX", "RL", "RSX", "TL", "TSX", "Andere"],
        "Aiways": ["Beliebig", "U5", "Andere"],
        "Aixam": ["Beliebig", "City", "Crossline", "Roadline", "Scouty R", "Andere"],
        "Alfa Romeo": ["Beliebig", "4C", "8C", "Alfa 145", "Alfa 146", "Alfa 147", "Alfa 155", "Alfa 156", "Alfa 159", "Alfa 164", "Alfa 166", "Alfa 33", "Alfa 75", "Alfa 90", "Alfasud", "Alfetta", "Brera", "Crosswagon", "Giulia", "Giulietta", "GT", "GTV", "Junior", "MiTo", "Spider", "Sprint", "Stelvio", "Tonale", "Andere"],
        "ALPINA": ["Beliebig", "B10", "B12", "B3", "B4", "B5", "B6", "B7", "B8", "D10", "D3", "D4", "D5", "Roadster S", "XB7", "XD3", "XD4", "Andere"],
        "Alpine": ["Beliebig", "A110", "A310", "A610", "GTA", "Andere"],
        "Ariel": ["Beliebig", "Atom", "Andere"],
        "Artega": ["Beliebig", "GT", "Andere"],
        "Asia Motors": ["Beliebig", "Rocsta", "Andere"],
        "Aston Martin": ["Beliebig", "AR1", "Cygnet", "DB", "DB11", "DB12", "DB7", "DB9", "DBS", "DBX", "Lagonda", "Rapide", "V12 Vantage", "V8 Vantage", "Vanquish", "Virage", "Andere"],
        "Audi": ["Beliebig", "100", "200", "80", "90", "A1", "A2", "A3", "A4", "A4 Allroad", "A5", "A6", "A6 Allroad", "A7", "A8", "Cabriolet", "Coupé", "e-tron", "e-tron GT", "Q1", "Q2", "Q3", "Q4", "Q4 e-tron", "Q5", "Q6 e-tron", "Q7", "Q8", "Q8 e-tron", "quattro", "R8", "RS2", "RS3", "RS4", "RS5", "RS6", "RS7", "RS e-tron GT", "RSQ3", "RSQ8", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "SQ2", "SQ5", "SQ6 e-tron", "SQ7", "SQ8", "SQ8 e-tron", "TT", "TT RS", "TTS", "V8", "Andere"],
        "Austin": ["Beliebig", "Andere"],
        "Austin Healey": ["Beliebig", "Andere"],
        "BAIC": ["Beliebig", "Beijing X75", "BJ20", "BJ40", "Senova D20", "Senova X25", "Senova X35", "Senova X55", "Senova X65", "X55", "Andere"],
        "Barkas": ["Beliebig", "B1000", "Andere"],
        "Bentley": ["Beliebig", "Arnage", "Azure", "Bentayga", "Brooklands", "Continental", "Continental (Alle)", "Continental Flying Spur", "Continental GT", "Continental GTC", "Continental Supersports", "Eight", "Flying Spur", "Mulsanne", "S2", "Turbo R", "Turbo RT", "Turbo S", "Andere"],
       "BMW": [
  "Beliebig",
  "1er Reihe (Alle)", "114", "116", "118", "120", "123", "125", "128", "130", "135", "1er M Coupé",
  "2002",
  "2er Reihe (Alle)", "214 Active Tourer", "214 Gran Tourer", "216", "216 Active Tourer", "216 Gran Coupé", "216 Gran Tourer", "218", "218 Active Tourer", "218 Gran Coupé", "218 Gran Tourer", "220", "220 Active Tourer", "220 Gran Coupé", "220 Gran Tourer", "223 Active Tourer", "225", "225 Active Tourer", "228", "230", "2er Gran Coupé",
  "3er Reihe (Alle)", "315", "316", "318", "318 Gran Turismo", "320", "320 Gran Turismo", "323", "324", "325", "325 Gran Turismo", "328", "328 Gran Turismo", "330", "330 Gran Turismo", "335", "335 Gran Turismo", "340", "340 Gran Turismo", "ActiveHybrid 3",
  "4er Reihe (Alle)", "418", "418 Gran Coupé", "420", "420 Gran Coupé", "425", "425 Gran Coupé", "428", "428 Gran Coupé", "430", "430 Gran Coupé", "435", "435 Gran Coupé", "440", "440 Gran Coupé",
  "5er Reihe (Alle)", "518", "520", "520 Gran Turismo", "523", "524", "525", "528", "530", "530 Gran Turismo", "535", "535 Gran Turismo", "540", "545", "550", "550 Gran Turismo", "ActiveHybrid 5",
  "6er Reihe (Alle)", "620 Gran Turismo", "628", "630", "630 Gran Turismo", "633", "635", "640", "640 Gran Coupé", "640 Gran Turismo", "645", "650", "650 Gran Coupé",
  "7er Reihe (Alle)", "725", "728", "730", "732", "735", "740", "745", "750", "760", "ActiveHybrid 7",
  "840", "850",
  "i3", "i4", "i5", "i7", "i8", "iX", "iX1", "iX2", "iX3",
  "M-Modelle (Alle)", "M135", "M140i", "M2", "M235", "M240i", "M3", "M340d", "M340i", "M4", "M440", "M5", "M550", "M6", "M760", "M8", "M850",
  "X-Reihe (Alle)", "ActiveHybrid X6", "X1", "X2", "X3", "X3 M", "X3 M40", "X4", "X4 M", "X4 M40", "X5", "X5 M", "X5 M50", "X6", "X6 M", "X7", "X7 M50",
  "Z-Reihe (Alle)", "Z1", "Z3", "Z3 M", "Z4", "Z4 M", "Z8",
  "Andere"
],
        "Borgward": ["Beliebig", "Andere"],
        "Brilliance": ["Beliebig", "BC3", "BS2", "BS4", "BS6", "Andere"],
        "Bugatti": ["Beliebig", "Chiron", "EB 110", "Veyron", "Andere"],
        "Buick": ["Beliebig", "Century", "Electra", "Enclave", "La Crosse", "Le Sabre", "Park Avenue", "Regal", "Riviera", "Roadmaster", "Skylark", "Andere"],
        "BYD": ["Beliebig", "ATTO 3", "DOLPHIN", "HAN", "SEAL", "TANG", "Andere"],
        "Cadillac": ["Beliebig", "Allante", "ATS", "BLS", "CT6", "CTS", "Deville", "Eldorado", "Escalade", "Fleetwood", "Seville", "SRX", "STS", "XLR", "XT4", "XT5", "XT6", "Andere"],
        "Casalini": ["Beliebig", "Andere"],
        "Caterham": ["Beliebig", "Andere"],
        "Cenntro": ["Beliebig", "Andere"],
        "Chatenet": ["Beliebig", "Andere"],
        "Chevrolet": ["Beliebig", "2500", "Alero", "Astro", "Avalanche", "Aveo", "Beretta", "Blazer", "C1500", "Camaro", "Caprice", "Captiva", "Cavalier", "Chevelle", "Chevy Van", "Citation", "Colorado", "Corsica", "Cruze", "El Camino", "Epica", "Evanda", "Express", "G", "HHR", "Impala", "K1500", "K30", "Kalos", "Lacetti", "Lumina", "Malibu", "Matiz", "Niva", "Nubira", "Orlando", "Rezzo", "S-10", "Silverado", "Spark", "SSR", "Suburban", "Tahoe", "Trailblazer", "Trans Sport", "Traverse", "Trax", "Venture", "Volt", "Andere"],
        "Chrysler": ["Beliebig", "200", "300C", "300 M", "Aspen", "Crossfire", "Daytona", "ES", "Grand Voyager", "GS", "GTS", "Imperial", "Le Baron", "Neon", "New Yorker", "Pacifica", "PT Cruiser", "Saratoga", "Sebring", "Stratus", "Valiant", "Viper", "Vision", "Voyager", "Andere"],
        "Citroën": ["Beliebig", "2 CV", "AX", "Berlingo", "BX", "C1", "C2", "C3", "C3 Aircross", "C3 Picasso", "C4", "C4 Aircross", "C4 Cactus", "C4 Picasso", "C4 SpaceTourer", "C4 X", "C5", "C5 Aircross", "C5 X", "C6", "C8", "C-Crosser", "C-Elysée", "CX", "C-Zero", "DS", "DS3", "DS4", "DS4 Crossback", "DS5", "ë-Berlingo", "ë-C3 Aircross", "E-MEHARI", "Evasion", "Grand C4 Picasso / SpaceTourer", "GSA", "Jumper", "Jumpy", "Nemo", "SAXO", "SM", "SpaceTourer", "Visa", "Xantia", "XM", "Xsara", "Xsara Picasso", "ZX", "Andere"],
        "Cobra": ["Beliebig", "Andere"],
        "Corvette": ["Beliebig", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "Z06", "ZR 1", "Andere"],
        "Cupra": ["Beliebig", "Arona", "Ateca", "Born", "Formentor", "Ibiza", "Leon", "Tavascan", "Andere"],
        "Dacia": ["Beliebig", "Dokker", "Duster", "Jogger", "Lodgy", "Logan", "Logan Pick-Up", "Pick Up", "Sandero", "Spring", "Andere"],
        "Daewoo": ["Beliebig", "Espero", "Evanda", "Kalos", "Korando", "Lacetti", "Lanos", "Leganza", "Matiz", "Musso", "Nexia", "Nubira", "Rezzo", "Tacuma", "Andere"],
        "Daihatsu": ["Beliebig", "Applause", "Charade", "Charmant", "Copen", "Cuore", "Feroza/Sportrak", "Freeclimber", "Gran Move", "Hijet", "MATERIA", "Move", "Rocky/Fourtrak", "Sirion", "Terios", "TREVIS", "YRV", "Andere"],
        "DeTomaso": ["Beliebig", "Guarà", "Pantera", "Andere"],
        "DFSK": [
  "Beliebig", "EC31", "EC35", "Fengon", "Fengon (Alle)", "Fengon 5", "Fengon 500", "Fengon 580", "Fengon 600", "Fengon 7",
  "Forthing 4", "Forthing 5", "Glory", "K01", "Rich 6", "Seres 3", "Seres 5", "Andere"
],
        "Dodge": ["Beliebig", "Avenger", "Caliber", "Challenger", "Charger", "Coronet", "Dakota", "Dart", "Demon", "Durango", "Grand Caravan", "Hornet", "Journey", "Magnum", "Neon", "Nitro", "RAM", "Stealth", "Viper", "Andere"],
        "Donkervoort": ["Beliebig", "D8", "S7", "S8", "Andere"],
        "DS Automobiles": ["Beliebig", "DS3", "DS3 Crossback", "DS4", "DS4 Crossback", "DS5", "DS7 (Crossback)", "DS9", "Andere"],
        "e.GO": ["Beliebig", "e.wave X", "Life", "Andere"],
        "Elaris": ["Beliebig", "Andere"],
        "Estrima": ["Beliebig", "Andere"],
        "Ferrari": ["Beliebig", "208", "246", "250", "275", "288", "296 GTB", "296 GTS", "308", "328", "330", "348", "360", "365", "400", "412", "456", "458", "488 GTB", "488 Pista", "488 Spider", "512", "550", "575", "599 GTB", "599 GTO", "599 SA Aperta", "612", "750", "812", "California", "Daytona", "Dino GT4", "Enzo Ferrari", "F12", "F355", "F40", "F430", "F50", "F8", "FF", "GTC4Lusso", "LaFerrari", "Mondial", "Monza", "Portofino", "Purosangue", "Roma", "SF90", "Superamerica", "Testarossa", "Andere"],
        "Fiat": ["Beliebig", "124", "124 Spider", "126", "127", "130", "131", "500", "500C", "500e", "500L", "500L Cross", "500L Living", "500L Trekking", "500L Urban", "500L Wagon", "500S", "500X", "600", "600e", "Albea", "Barchetta", "Brava", "Bravo", "Cinquecento", "Coupe", "Croma", "Dino", "Doblo", "Ducato", "Fiorino", "Freemont", "Fullback", "Grande Punto", "Idea", "Linea", "Marea", "Marengo", "Multipla", "New Panda", "Palio", "Panda", "Punto", "Punto Evo", "Qubo", "Regata", "Ritmo", "Scudo", "Sedici", "Seicento", "Siena", "Spider Europa", "Stilo", "Strada", "Talento", "Tempra", "Tipo", "Ulysse", "Uno", "X 1/9", "Andere"],
        "Fisker": ["Beliebig", "Karma", "Ocean", "Andere"],
       "Ford": [
  "Beliebig", "Aerostar", "B-Max", "Bronco", "Bronco Sport", "Capri", "C-Max", "Cougar", "Courier", "Crown", "Econoline",
  "Econovan", "EcoSport", "Edge", "Escape", "Escort", "Excursion", "Expedition", "Explorer", "Express", "F 100", "F 150",
  "F 250", "F 350", "Fairlane", "Falcon", "Fiesta", "Flex", "Focus", "Fusion", "Galaxy", "Granada", "Grand C-Max",
  "Grand Tourneo", "GT", "Ka/Ka+", "Kuga", "Maverick", "Mercury", "Mondeo", "Mustang", "Mustang Mach-E", "Orion",
  "Probe", "Puma", "Ranger", "Raptor", "Scorpio", "Sierra", "S-Max", "Sportka", "Streetka", "Taunus", "Taurus",
  "Thunderbird", "Tourneo (alle)", "Tourneo", "Tourneo Connect", "Tourneo Courier", "Tourneo Custom",
  "Transit (Alle)", "Transit", "Transit Connect", "Transit Courier", "Transit Custom", "Windstar", "Andere"
],
        "GAC Gonow": ["Beliebig", "Andere"],
        "Gemballa": ["Beliebig", "Andere"],
        "Genesis": ["Beliebig", "G70", "G80", "G90", "GV60", "GV70", "GV80", "Andere"],
        "GMC": ["Beliebig", "Acadia", "Envoy", "Safari", "Savana", "Sierra", "Sonoma", "Syclone", "Terrain", "Typhoon", "Vandura", "Yukon", "Andere"],
        "Grecav": ["Beliebig", "Sonique", "Andere"],
        "GWM": ["Beliebig", "Ora 03", "Ora 07", "Wey 03", "Wey 05", "Andere"],
        "Hamann": ["Beliebig", "Andere"],
        "Holden": ["Beliebig", "Andere"],
        "Honda": ["Beliebig", "Accord", "Aerodeck", "City", "Civic", "Clarity", "Concerto", "CR-V", "CRX", "CR-Z", "e", "e:Ny1", "Element", "FR-V", "HR-V", "Insight", "Integra", "Jazz", "Legend", "Logo", "NSX", "Odyssey", "Pilot", "Prelude", "Ridgeline", "S2000", "Shuttle", "Stream", "ZR-V", "Andere"],
        "Hongqi": ["Beliebig", "E-HS9", "H9", "HS5", "Andere"],
        "Hummer": ["Beliebig", "H1", "H2", "H3", "Andere"],
        "Hyundai": ["Beliebig", "Accent", "Atos", "Azera", "Bayon", "Coupe", "Elantra", "Excel", "Galloper", "Genesis", "Getz", "Grandeur", "Grand Santa Fe", "H-1", "H 100", "H-1 Starex", "H 200", "H350", "i10", "i20", "i30", "i40", "IONIQ", "IONIQ 5", "IONIQ 6", "ix20", "ix35", "ix55", "Kona", "Lantra", "Matrix", "Nexo", "Pony", "Santa Fe", "Santamo", "S-Coupe", "Sonata", "Staria", "Terracan", "Trajet", "Tucson", "Veloster", "Veracruz", "XG 30", "XG 350", "Andere"],
        "INEOS": ["Beliebig", "Grenadier", "Andere"],
        "Infiniti": ["Beliebig", "EX30", "EX35", "EX37", "FX", "G35", "G37", "M30", "M35", "M37", "Q30", "Q45", "Q50", "Q60", "Q70", "QX30", "QX50", "QX56", "QX60", "QX70", "QX80", "Andere"],
        "Isuzu": ["Beliebig", "Campo", "D-Max", "Gemini", "Midi", "PICK UP", "Trooper", "Andere"],
        "Iveco": ["Beliebig", "Massif", "Andere"],
        "JAC": ["Beliebig", "8 Pro", "Andere"],
        "Jaguar": ["Beliebig", "Daimler", "E-Pace", "E-Type", "F-Pace", "F-Type", "I-Pace", "MK II", "S-Type", "XE", "XF", "XJ", "XJ12", "XJ40", "XJ6", "XJ8", "XJR", "XJS", "XJSC", "XK", "XK8", "XKR", "X-Type", "Andere"],
        "Jeep": ["Beliebig", "Avenger", "Cherokee", "CJ", "Comanche", "Commander", "Compass", "Gladiator", "Grand Cherokee", "Patriot", "Renegade", "Wagoneer", "Willys", "Wrangler", "Andere"],
        "Kia": ["Beliebig", "Besta", "Borrego", "Carens", "Carnival", "cee'd / Ceed", "cee'd Sportswagon", "Cerato", "Clarus", "Elan", "EV3", "EV6", "EV9", "Joice", "K2500", "K2700", "Leo", "Magentis", "Mentor", "Mini", "Niro", "Opirus", "Optima", "Picanto", "Pregio", "Pride", "pro cee'd / ProCeed", "Retona", "Rio", "Roadster", "Rocsta", "Sephia", "Shuma", "Sorento", "Soul", "Sportage", "Stinger", "Stonic", "Venga", "XCeed", "Andere"],
        "Koenigsegg": ["Beliebig", "Agera", "CCR", "CCXR", "Andere"],
        "KTM": ["Beliebig", "X-BOW", "Andere"],
        "Lada": ["Beliebig", "110", "111", "112", "1200", "2107", "2110", "2111", "2112", "Aleko", "Forma", "Granta", "Kalina", "Niva", "Nova", "Priora", "Samara", "Taiga", "Urban", "Vesta", "X-Ray", "Andere"],
        "Lamborghini": ["Beliebig", "Aventador", "Countach", "Diablo", "Espada", "Gallardo", "Huracán", "Jalpa", "LM", "Miura", "Murciélago", "Revuelto", "Urraco", "Urus", "Andere"],
        "Lancia": ["Beliebig", "Beta", "Dedra", "Delta", "Flaminia", "Flavia", "Fulvia", "Gamma", "Kappa", "Lybra", "MUSA", "Phedra", "Prisma", "Stratos", "Thema", "Thesis", "Voyager", "Ypsilon", "Zeta", "Andere"],
        "Land Rover": ["Beliebig", "Defender", "Discovery", "Discovery Sport", "Freelander", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar", "Serie I", "Serie II", "Serie III", "Andere"],
        "Landwind": ["Beliebig", "CV-9", "S", "SC2", "SC4", "Andere"],
        "LEVC": ["Beliebig", "Andere"],
        "Lexus": ["Beliebig", "CT 200h", "ES-Serie (Alle)", "ES 300", "ES 330", "ES 350", "GS-Serie (Alle)", "GS 250", "GS 300", "GS 350", "GS 430", "GS 450", "GS 460", "GS F", "GX Series (Alle)", "GX 460", "GX 470", "IS-Serie (Alle)", "IS 200", "IS 220", "IS 250", "IS 300", "IS 350", "IS-F", "LBX", "LC 500", "LC 500h", "LFA", "LM", "LS-Serie (Alle)", "LS 400", "LS 430", "LS 460", "LS 500", "LS 600", "LX-Serie (Alle)", "LX 450", "LX 470", "LX 500", "LX 570", "LX 600", "NX-Serie (Alle)", "NX 200", "NX 300", "NX 350", "NX 450", "RC-Serie (Alle)", "RC 200", "RC 300", "RC 350", "RC F", "RX-Serie (Alle)", "RX 200", "RX 300", "RX 330", "RX 350", "RX 400", "RX 450", "RX 500", "RZ", "SC 400", "SC 430", "UX", "Andere"],
        "Ligier": ["Beliebig", "Ambra", "Be Sun", "JS 50", "JS 50 L", "JS 60", "JS RC", "Myli", "Nova", "Optima", "X – Too", "Andere"],
        "Lincoln": ["Beliebig", "Aviator", "Continental", "LS", "Mark", "Navigator", "Town Car", "Andere"],
        "Lotus": ["Beliebig", "340 R", "Cortina", "Elan", "Eletre", "Elise", "Elite", "Emeya", "Emira", "Esprit", "Europa", "Evora", "Excel", "Exige", "Super Seven", "Andere"],
        "Lucid": ["Beliebig", "Air", "Andere"],
        "Lynk&Co": ["Beliebig", "01", "Andere"],
        "Mahindra": ["Beliebig", "Andere"],
        "MAN": ["Beliebig", "TGE", "Andere"],
        "Maserati": ["Beliebig", "222", "224", "228", "3200", "418", "420", "4200", "422", "424", "430", "Biturbo", "Ghibli", "GranCabrio", "Gransport", "Granturismo", "Grecale", "Indy", "Karif", "Levante", "MC12", "MC20", "Merak", "Quattroporte", "Shamal", "Spyder", "Andere"],
        "Maxus": ["Beliebig", "Deliver 9", "eDeliver 3", "eDeliver 9", "Euniq 5", "Euniq 6", "Mifa 9", "T90", "Andere"],
        "Maybach": ["Beliebig", "57", "62", "Pullman", "S650", "Andere"],
        "Mazda": ["Beliebig", "121", "2", "2 Hybrid", "3", "323", "5", "6", "626", "929", "Bongo", "B series", "BT-50", "CX-3", "CX-30", "CX-5", "CX-60", "CX-7", "CX-80", "CX-9", "Demio", "E series", "Millenia", "MPV", "MX-3", "MX-30", "MX-5", "MX-6", "Premacy", "Protege", "RX-6", "RX-7", "RX-8", "Tribute", "Xedos", "Andere"],
        "McLaren": ["Beliebig", "540C", "570GT", "570S", "600LT", "620R", "650S", "650S Coupé", "650S Spider", "675LT", "675LT Spider", "720S", "750S", "765", "765LT", "Artura", "Elva", "GT", "MP4-12C", "P1", "Senna GTR", "Speedtail", "Andere"],
        "Mercedes-Benz": [
            "Beliebig", "190", "200", "220", "230", "240", "250", "260", "270", "280", "290", "300",
  "320", "350", "380", "400", "416", "420", "450", "500", "560", "600",
  
  "A-Klasse (Alle)", "A 140", "A 150", "A 160", "A 170", "A 180", "A 190", "A 200", "A 210",
  "A 220", "A 250", "A 35 AMG", "A 45 AMG",
  
  "B-Klasse (Alle)", "B 150", "B 160", "B 170", "B 180", "B 200", "B 220", "B 250", "B Electric Drive",
  
  "C-Klasse (Alle)", "C 160", "C 180", "C 200", "C 220", "C 230", "C 240", "C 250",
  "C 270", "C 280", "C 300", "C 30 AMG", "C 320", "C 32 AMG", "C 350", "C 36 AMG",
  "C 400", "C 43 AMG", "C 450 AMG", "C 55 AMG", "C 63 AMG",
  
  "CE-Klasse (Alle)", "CE 200", "CE 220", "CE 230", "CE 280", "CE 300", "CE 320",
  
  "CLA-Klasse (Alle)", "CLA 180", "CLA 180 Shooting Brake", "CLA 200",
  "CLA 200 Shooting Brake", "CLA 220", "CLA 220 Shooting Brake", "CLA 250",
  "CLA 250 Shooting Brake", "CLA 35 AMG", "CLA 35 AMG Shooting Brake",
  "CLA 45 AMG", "CLA 45 AMG Shooting Brake", "CLA Shooting Brake",
  
  "CLC-Klasse (Alle)", "CLC 160", "CLC 180", "CLC 200", "CLC 220", "CLC 230",
  "CLC 250", "CLC 350",
  
  "CLE-Klasse (Alle)", "CLE 180", "CLE 200", "CLE 220", "CLE 300", "CLE 450", "CLE 53 AMG",
            "CLK-Klasse (Alle)", "CLK 200", "CLK 220", "CLK 230", "CLK 240", "CLK 270", "CLK 280", 
            "CLK 320", "CLK 350", "CLK 430", "CLK 500", "CLK 55 AMG", "CLK 63 AMG", 
            "CL-Klasse (Alle)", "CL 160", "CL 180", "CL 200", "CL 220", "CL 230", "CL 320", 
            "CL 420", "CL 500", "CL 55 AMG", "CL 600", "CL 63 AMG", "CL 65 AMG", 
            "CLS-Klasse (Alle)", "CLS 220", "CLS 220 Shooting Brake", "CLS 250", "CLS 250 Shooting Brake", 
            "CLS 280", "CLS 300", "CLS 320", "CLS 350", "CLS 350 Shooting Brake", 
            "CLS 400", "CLS 400 Shooting Brake", "CLS 450", "CLS 500", "CLS 500 Shooting Brake", 
            "CLS 53 AMG", "CLS 55 AMG", "CLS 63 AMG", "CLS 63 AMG Shooting Brake", "CLS Shooting Brake", 
            "E-Klasse (Alle)", "E 200", "E 220", "E 230", "E 240", "E 250", "E 260", "E 270", "E 280", 
            "E 290", "E 300", "E 320", "E 350", "E 36 AMG", "E 400", "E 420", "E 430", "E 43 AMG", 
            "E 450", "E 50", "E 500", "E 53 AMG", "E 55 AMG", "E 60 AMG", "E 63 AMG", 
            "EQA", "EQB", "EQC", "EQE", "EQE SUV", "EQS", "EQS SUV", "EQT", "EQV", 
            "G-Klasse (Alle)", "G 230", "G 240", "G 250", "G 270", "G 280", "G 290", "G 300", 
            "G 320", "G 350", "G 400", "G 450", "G 500", "G 55 AMG", "G 580", "G 63 AMG", "G 65 AMG", 
            "GLA-Klasse (Alle)", "GLA 180", "GLA 200", "GLA 220", "GLA 250", "GLA 35 AMG", "GLA 45 AMG", 
            "GLB-Klasse (Alle)", "GLB 180", "GLB 200", "GLB 220", "GLB 250", "GLB 35 AMG", 
            "GLC-Klasse (Alle)", "GLC 200", "GLC 220", "GLC 250", "GLC 300", "GLC 350", "GLC 400", 
            "GLC 43 AMG", "GLC 450", "GLC 63 AMG", 
            "GLE-Klasse (Alle)", "GLE 250", "GLE 300", "GLE 350", "GLE 400", "GLE 43 AMG", "GLE 450", 
            "GLE 500", "GLE 53 AMG", "GLE 580", "GLE 63 AMG", 
            "GLK-Klasse (Alle)", "GLK 200", "GLK 220", "GLK 250", "GLK 280", "GLK 300", 
            "GLK 320", "GLK 350", 
            "GL-Klasse (Alle)", "GL 320", "GL 350", "GL 400", "GL 420", "GL 450", 
            "GL 500", "GL 55 AMG", "GL 63 AMG", 
            "GLS-Klasse (Alle)", "GLS 350", "GLS 400", "GLS 450", "GLS 500", "GLS 580", 
            "GLS 600", "GLS 63 AMG", 
            "GT-Klasse (Alle)", "AMG GT", "AMG GT C", "AMG GT R", "AMG GT S", "MB 100", 
            "ML-Klasse (Alle)", "ML 230", "ML 250", "ML 270", "ML 280", "ML 300", 
            "ML 320", "ML 350", "ML 400", "ML 420", "ML 430", "ML 450", "ML 500", 
            "ML 55 AMG", "ML 63 AMG", 
            "R-Klasse (Alle)", "R 280", "R 300", "R 320", "R 350", "R 500", "R 63 AMG", 
            "S-Klasse (Alle)", "S 250", "S 260", "S 280", "S 300", "S 320", "S 350", "S 400", "S 420", "S 430", "S 450", "S 500", "S 55 AMG", "S 550", "S 560", "S 580", "S 600", "S 63 AMG", "S 650", "S 65 AMG", "S 680",
    "SLC-Klasse (Alle)", "SLC 180", "SLC 200", "SLC 250", "SLC 280", "SLC 300", "SLC 43 AMG",
    "SLK-Klasse (Alle)", "SLK 200", "SLK 230", "SLK 250", "SLK 280", "SLK 300", "SLK 320", "SLK 32 AMG", "SLK 350", "SLK 55 AMG",
    "SL-Klasse (Alle)", "SL 280", "SL 300", "SL 320", "SL 350", "SL 380", "SL 400", "SL 420", "SL 43 AMG", "SL 450", "SL 500", "SL 55 AMG", "SL 560", "SL 600", "SL 60 AMG", "SL 63 AMG", "SL 65 AMG", "SL 70 AMG", "SL 73 AMG",
    "SLR", "SLS AMG", "Sprinter", "T-Klasse", "Vaneo", "Vario", "Viano", "Vito",
    "V-Klasse (Alle)", "V 200", "V 220", "V 230", "V 250", "V 280", "V 300",
    "X-Klasse (Alle)", "X 220", "X 250", "X 350", "Andere"
        ],
        "MG": ["Beliebig", "EHS", "HS", "Marvel R", "MG3", "MG4", "MG5", "MGA", "MGB", "MGF", "Midget", "Montego", "TD", "TF", "ZR", "ZS", "ZT", "Andere"],
        "Microcar": ["Beliebig", "DUÈ", "Flex", "M.Go", "M-8", "MC1", "MC2", "Virgo", "Andere"],
        "Microlino": ["Beliebig", "Competizione", "Dolce", "Pioneer", "Andere"],
        "MINI": [
            "Beliebig", "Aceman",
            "Cabrio Serie (Alle)", "Cooper Cabrio", "Cooper D Cabrio", "Cooper S Cabrio", "Cooper SD Cabrio", "John Cooper Works Cabrio", "One Cabrio",
            "Clubman Serie (Alle)", "Cooper Clubman", "Cooper D Clubman", "Cooper S Clubman", "Cooper SD Clubman", "John Cooper Works Clubman", "One Clubman", "One D Clubman", "Clubvan",
            "Countryman Serie (Alle)", "Cooper C Countryman", "Cooper Countryman", "Cooper D Countryman", "Cooper E Countryman", "Cooper S Countryman", "Cooper SD Countryman", "Cooper SE Countryman", "John Cooper Works Countryman", "One Countryman", "One D Countryman",
            "Coupe Serie (Alle)", "Cooper Coupé", "Cooper S Coupé", "Cooper SD Coupé", "John Cooper Works Coupé",
            "MINI (Alle)", "1000", "1300", "Cooper", "Cooper C", "Cooper D", "Cooper E", "Cooper S", "Cooper SD", "Cooper SE", "John Cooper Works", "ONE", "One D", "One First",
            "Paceman Serie (Alle)", "Cooper D Paceman", "Cooper Paceman", "Cooper SD Paceman", "Cooper S Paceman", "John Cooper Works Paceman",
            "Roadster Serie (Alle)", "Cooper Roadster", "Cooper SD Roadster", "Cooper S Roadster", "John Cooper Works Roadster",
            "Andere"
        ],
        "Mitsubishi": [
            "Beliebig", "3000 GT", "ASX", "Canter", "Carisma", "Colt", "Cordia", "Cosmos", "Diamante", "Eclipse", "Eclipse Cross", "Galant", "Galloper", "Grandis", "i-MiEV", 
            "L200", "L300", "L400", "Lancer", "Mirage", "Montero", "Outlander", "Pajero", "Pajero Pinin", "Pick-up", "Plug-in Hybrid Outlander", "Santamo", "Sapporo", "Sigma", 
            "Space Gear", "Space Runner", "Space Star", "Space Wagon", "Starion", "Tredia", "Andere"
        ],
        "Morgan": ["Beliebig", "3 Wheeler", "4/4", "Aero 8", "Plus 4", "Plus 6", "Plus 8", "Roadster", "Andere"],
"NIO": ["Beliebig", "EL6", "EL7", "EL8", "ET5", "ET7", "Andere"],
"Nissan": ["Beliebig", "Navara", "Note", "NP 300", "NV200", "NV250", "NV300", "NV400", "Pathfinder", "Patrol", "PickUp", "Pixo", "Prairie", "Primastar", "Primera", "Pulsar", "Qashqai", "Qashqai+2", "Quest", "Sentra", "Serena", "Silvia", "Skyline", "Sunny", "Terrano", "Tiida", "Titan", "Townstar", "Trade", "Urvan", "Vanette", "X-Trail", "Andere"],
"NSU": ["Beliebig", "Andere"],
"Oldsmobile": ["Beliebig", "Bravada", "Custom Cruiser", "Cutlass", "Delta 88", "Silhouette", "Supreme", "Toronado", "Andere"],
"Opel": ["Beliebig", "Adam", "Agila", "Ampera", "Ampera-e", "Antara", "Arena", "Ascona", "Astra", "Calibra", "Campo", "Cascada", "Cavalier", "Combo", "Combo Electric", "Combo Life", "Commodore", "Corsa", "Crossland (X)", "Diplomat", "Frontera", "Grandland (X)", "GT", "Insignia", "Insignia CT", "Kadett", "Karl", "Manta", "Meriva", "Mokka", "Mokka-e", "Mokka X", "Monterey", "Monza", "Movano", "Nova", "Omega", "Pick Up Sportscap", "Rekord", "Rocks-e", "Senator", "Signum", "Sintra", "Speedster", "Tigra", "Vectra", "Vivaro", "Zafira", "Zafira Life", "Zafira Tourer", "Andere"],
"ORA": ["Beliebig", "Funky Cat", "Andere"],
"Pagani": ["Beliebig", "Huayra", "Zonda", "Andere"],
"Peugeot": ["Beliebig", "1007", "104", "106", "107", "108", "2008", "204", "205", "206", "207", "208", "3008", "301", "304", "305", "306", "307", "308", "309", "4007", "4008", "404", "405", "406", "407", "408", "5008", "504", "505", "508", "604", "605", "607", "806", "807", "Bipper", "Bipper Tepee", "Boxer", "Expert", "Expert Tepee", "iOn", "J5", "Partner", "Partner Tepee", "RCZ", "Rifter", "TePee", "Traveller", "Andere"],
"Piaggio": ["Beliebig", "APE", "APE TM", "Porter", "Andere"],
"Plymouth": ["Beliebig", "Prowler", "Andere"],
"Polestar": ["Beliebig", "1", "2", "3", "4", "Andere"],
"Pontiac": ["Beliebig", "6000", "Bonneville", "Fiero", "Firebird", "G6", "Grand-Am", "Grand-Prix", "GTO", "Montana", "Solstice", "Sunbird", "Sunfire", "Targa", "Trans Am", "Trans Sport", "Vibe", "Andere"],
"Porsche": ["Beliebig", "356", "911er Reihe (Alle)", "911 Urmodell", "930", "964", "991", "992", "993", "996", "997", "912", "914", "918", "924", "928", "944", "959", "962", "968", "Boxster", "Carrera GT", "Cayenne", "Cayman", "Macan", "Panamera", "Taycan", "Andere"],
"Proton": ["Beliebig", "300 Serie", "400 Serie", "Andere"],
"Renault": ["Beliebig", "Alaskan", "Alpine A110", "Alpine A310", "Alpine V6", "Arkana", "Austral", "Avantime", "Captur", "Clio", "Coupe", "Espace", "Express", "Fluence", "Fuego", "Grand Espace", "Grand Kangoo", "Grand Modus", "Grand Scenic", "Kadjar", "Kangoo", "Koleos", "Laguna", "Latitude", "Mascott", "Master", "Megane", "Modus", "P 1400", "R 11", "R 14", "R 18", "R 19", "R 20", "R 21", "R 25", "R 30", "R 4", "R 5", "R 6", "R 9", "Rafale", "Rapid", "Safrane", "Scenic", "Spider", "Symbioz", "Talisman", "Trafic", "Twingo", "Twizy", "Vel Satis", "Wind", "ZOE", "Andere"],
"Rolls-Royce": ["Beliebig", "Corniche", "Cullinan", "Dawn", "Flying Spur", "Ghost", "Park Ward", "Phantom", "Silver Cloud", "Silver Dawn", "Silver Seraph", "Silver Shadow", "Silver Spirit", "Silver Spur", "Spectre", "Wraith", "Andere"],
"Rover": ["Beliebig", "100", "111", "114", "115", "200", "213", "214", "216", "218", "220", "25", "400", "414", "416", "418", "420", "45", "600", "618", "620", "623", "75", "800", "820", "825", "827", "City Rover", "Metro", "Montego", "SD", "Streetwise", "Andere"],
"Ruf": ["Beliebig", "Andere"],
"Saab": ["Beliebig", "90", "900", "9000", "9-3", "9-4X", "9-5", "96", "9-7X", "99", "Andere"],
"Santana": ["Beliebig", "Andere"],
"Seat": ["Beliebig", "Alhambra", "Altea", "Arona", "Arosa", "Ateca", "Cordoba", "Exeo", "Ibiza", "Inca", "Leon", "Malaga", "Marbella", "Mii", "Tarraco", "Terra", "Toledo", "Andere"],
"Seres": ["Beliebig", "3", "5", "Andere"],
"Skoda": ["Beliebig", "105", "120", "130", "135", "Citigo", "Enyaq", "Fabia", "Favorit", "Felicia", "Forman", "Kamiq", "Karoq", "Kodiaq", "Octavia", "Pick-up", "Praktik", "Rapid", "Roomster", "Scala", "Superb", "Yeti", "Andere"],
"Smart": ["Beliebig", "#1", "#3", "Crossblade", "ForFour", "ForTwo", "Roadster", "Andere"],
"speedART": ["Beliebig", "Andere"],
"Spyker": ["Beliebig", "C8", "C8 AILERON", "C8 DOUBLE 12 S", "C8 LAVIOLETTE SWB", "C8 SPYDER SWB", "Andere"],
"Ssangyong": ["Beliebig", "Actyon", "Family", "Korando", "Kyron", "MUSSO", "REXTON", "Rodius", "Tivoli", "Torres", "XLV", "Andere"],
"Subaru": ["Beliebig", "B9 Tribeca", "Baja", "BRZ", "Crosstrek", "Forester", "Impreza", "Justy", "Legacy", "Levorg", "Libero", "Outback", "Solterra", "SVX", "Trezia", "Tribeca", "Vivio", "WRX STI", "XT", "XV", "Andere"],
"Suzuki": ["Beliebig", "(SX4) S-Cross", "Across", "Alto", "Baleno", "Cappuccino", "Carry", "Celerio", "Grand Vitara", "Ignis", "iK-2", "Jimny", "Kizashi", "Liana", "LJ", "SJ Samurai", "Splash", "Super-Carry", "Swace", "Swift", "SX4", "Vitara", "Wagon R+", "X-90", "Andere"],
"SWM": ["Beliebig", "G01", "Andere"],
"Tata": ["Beliebig", "Indica", "Indigo", "Nano", "Safari", "Sumo", "Telcoline", "Telcosport", "Xenon", "Andere"],
"TECHART": ["Beliebig", "Andere"],
"Tesla": ["Beliebig", "Model 3", "Model S", "Model X", "Model Y", "Roadster", "Andere"],
"Toyota": ["Beliebig", "4-Runner", "Alphard", "Auris", "Auris Touring Sports", "Avalon", "Avensis", "Avensis Verso", "Aygo (X)", "bZ4X", "Camry", "Carina", "Celica", "C-HR", "Corolla", "Corolla Cross", "Corolla Verso", "Cressida", "Crown", "Dyna", "FCV", "FJ", "Fortuner", "GR86", "GT86", "Hiace", "Highlander", "Hilux", "IQ", "Land Cruiser", "Lite-Ace", "Matrix", "Mirai", "MR 2", "Paseo", "Picnic", "Previa", "Prius", "Prius+", "Proace (Verso)", "PROACE CITY", "RAV 4", "Sequoia", "Sienna", "Starlet", "Supra", "Tacoma", "Tercel", "Tundra", "Urban Cruiser", "Verso", "Verso-S", "Yaris", "Yaris Cross", "Andere"],
"Trabant": ["Beliebig", "601", "Andere"],
"Triumph": ["Beliebig", "Dolomite", "Moss", "Spitfire", "TR3", "TR4", "TR5", "TR6", "TR7", "TR8", "Andere"],
"TVR": ["Beliebig", "Chimaera", "Griffith", "Tuscan", "Andere"],
"VinFast": ["Beliebig", "VF6", "VF7", "VF8", "VF9", "Andere"],
"Volkswagen": ["Beliebig", "181", "Amarok", "Arteon", "Beetle", "Bora", "Buggy", "Caddy", "Caddy Maxi", "CC", "Corrado", "Crafter", "Eos", "Fox", "Golf", "Golf (Alle)", "Golf Plus", "Golf Sportsvan", "ID.3", "ID.4", "ID.5", "ID.6", "ID.7", "ID. Buzz", "Iltis", "Jetta", "Käfer", "Karmann Ghia", "LT", "Lupo", "New Beetle", "Passat (alle)", "Passat", "Passat Alltrack", "Passat CC", "Passat Variant", "Phaeton", "Polo", "Routan", "Santana", "Scirocco", "Sharan", "T1", "T2", "T3 (Alle)", "T3 andere", "T3 Caravelle", "T3 Kombi", "T3 Multivan", "T4 (Alle)", "T4 andere", "T4 California", "T4 Caravelle", "T4 Kombi", "T4 Multivan", "T5 (Alle)", "T5 andere", "T5 California", "T5 Caravelle", "T5 Kombi", "T5 Multivan", "T5 Shuttle", "T5 Transporter", "T6 (Alle)", "T6 andere", "T6 California", "T6 Caravelle", "T6 Kombi", "T6 Multivan", "T6 Transporter", "T7 Multivan", "Taigo", "Taro", "T-Cross", "Tiguan", "Tiguan Allspace", "Touareg", "Touran", "T-Roc", "up!", "Vento", "XL1", "Andere"],
"Volvo": ["Beliebig", "240", "244", "245", "262", "264", "340", "360", "440", "460", "480", "740", "744", "745", "760", "780", "850", "855", "940", "944", "945", "960", "965", "Amazon", "C30", "C40", "C70", "EX30", "EX40", "EX90", "Polar", "S40", "S60", "S60 Cross Country", "S70", "S80", "S90", "V40", "V40 Cross Country", "V50", "V60", "V60 Cross Country", "V70", "V90", "V90 Cross Country", "XC40", "XC60", "XC70", "XC90", "Andere"],
"Westfield": ["Beliebig", "Andere"],
"WEY": ["Beliebig", "Coffee 01", "Coffee 02", "Andere"],
"Wiesmann": ["Beliebig", "MF 25", "MF 28", "MF 3", "MF 30", "MF 35", "MF 4", "MF 5", "Andere"],
"XEV": ["Beliebig", "YOYO", "Andere"],
"XPENG": ["Beliebig", "G6", "G9", "P7", "Andere"],
"Zhidou": ["Beliebig", "Andere"],
"Andere": ["Beliebig", "Andere"]
};

const modelGroups = {
    "1er Reihe (Alle)": /^1(1[0-9]|2[0-9]|3[0-9]|4[0-9]|14[0-9]|1er M Coupé)/i,
  "2er Reihe (Alle)": /^2(1[0-9]|2[0-9]|3[0-9])/i,
  "3er Reihe (Alle)": /^3[0-9]{2}|^ActiveHybrid 3/i,
  "4er Reihe (Alle)": /^4[0-9]{2}/i,
  "5er Reihe (Alle)": /^5[0-9]{2}|^ActiveHybrid 5/i,
  "6er Reihe (Alle)": /^6[0-9]{2}/i,
  "7er Reihe (Alle)": /^7[0-9]{2}|^ActiveHybrid 7/i,
  "M-Modelle (Alle)": /^M[0-9]|^M1[0-9]/i,
  "X-Reihe (Alle)": /^X[0-9]|^ActiveHybrid X6/i,
  "Z-Reihe (Alle)": /^Z[0-9]/i,
  "Fengon (Alle)": /^Fengon(\s\d+)?$/i,
    "Tourneo (alle)": /^Tourneo(?!\s*\(alle\))/i,
  "Transit (Alle)": /^Transit(?!\s*\(Alle\))/i,
  "Continental (Alle)": /^Continental\b/i,
  "A-Klasse (Alle)": /^A\s/i,
  "B-Klasse (Alle)": /^B\s/i,
  "C-Klasse (Alle)": /^C\s/i,
   "CE-Klasse (Alle)": /^CE\s/i,
 "CLA-Klasse (Alle)": /^CLA\s/i,
 "CLC-Klasse (Alle)": /^CLC\s/i,
 "CLE-Klasse (Alle)": /^CLE\s/i,
 "CLK-Klasse (Alle)": /^CLK\s/i,
 "CL-Klasse (Alle)": /^CL\s/i,
 "CLS-Klasse (Alle)": /^CLS\s/i,
 "E-Klasse (Alle)": /^E\s/i,
 "G-Klasse (Alle)": /^G\s/i,
 "GLA-Klasse (Alle)": /^GLA\s/i,
 "GLB-Klasse (Alle)": /^GLB\s/i,
 "GLC-Klasse (Alle)": /^GLC\s/i,
 "GLE-Klasse (Alle)": /^GLE\s/i,
 "GLK-Klasse (Alle)": /^GLK\s/i,
 "GL-Klasse (Alle)": /^GL\s/i,
 "GLS-Klasse (Alle)": /^GLS\s/i,
 "GT-Klasse (Alle)": /^AMG GT/i,
 "ML-Klasse (Alle)": /^ML\s/i,
 "R-Klasse (Alle)": /^R\s/i,
 "S-Klasse (Alle)": /^S\s/i,
 "SLC-Klasse (Alle)": /^SLC\s/i,
 "SLK-Klasse (Alle)": /^SLK\s/i,
 "SL-Klasse (Alle)": /^SL\s/i,
 "V-Klasse (Alle)": /^V\s/i,
 "X-Klasse (Alle)": /^X\s/i,
 "Tourneo (alle)": /^Tourneo\s/i,
 "Transit (Alle)": /^Transit\s/i,
    "ES-Serie (Alle)": /^ES\s/i,
  "GS-Serie (Alle)": /^GS\s/i,
  "GX Series (Alle)": /^GX\s/i,
  "IS-Serie (Alle)": /^IS\s/i,
  "LS-Serie (Alle)": /^LS\s/i,
  "LX-Serie (Alle)": /^LX\s/i,
  "NX-Serie (Alle)": /^NX\s/i,
  "RC-Serie (Alle)": /^RC\s/i,
  "RX-Serie (Alle)": /^RX\s/i,
    "Cabrio Serie (Alle)": /\bCabrio$/,
  "Clubman Serie (Alle)": /\bClubman$/,
  "Countryman Serie (Alle)": /\bCountryman$/,
  "Coupe Serie (Alle)": /\bCoupé$/,
  "MINI (Alle)": /^(1000|1300|Cooper|ONE|One)\b|John Cooper Works$/,
  "Paceman Serie (Alle)": /\bPaceman$/,
  "Roadster Serie (Alle)": /\bRoadster$/,
  "911er Reihe (Alle)": /^(911|930|964|991|992|993|996|997|912|914|918)\b/,
    "Golf (Alle)": /^Golf\s|^Golf$|^Golf-/i,
  "Passat (alle)": /^Passat\s|^Passat$|^Passat-/i,
  "T3 (Alle)": /^T3\s|^T3\b/i,
    // =========================================================
  // Modell-Gruppen (optional: "T4 (Alle)" selektiert alle T4-Modelle)
  // =========================================================

    "T4 (Alle)": /^T4(?:\s|$)/i,
    "T5 (Alle)": /^T5(?:\s|$)/i,
    "T6 (Alle)": /^T6(?:\s|$)/i,
    // ggf. erweitern
  };

  // =========================================================
  // SlimSelect – zentrale Safe-Helfer
  // (nutzt hasSlim/initSlim aus deinem ersten Teil)
  // =========================================================
  const safeDisable = (nativeEl, slimInstance) => {
    if (slimInstance && typeof slimInstance.disable === "function") {
      try { slimInstance.disable(); } catch {}
    }
    if (nativeEl) nativeEl.disabled = true;
  };

  const safeEnable = (nativeEl, slimInstance) => {
    if (slimInstance && typeof slimInstance.enable === "function") {
      try { slimInstance.enable(); } catch {}
    }
    if (nativeEl) nativeEl.disabled = false;
  };

  const safeSlimSetData = (slimInstance, data) => {
    if (!slimInstance) return;
    // SlimSelect v2: setData()
    if (typeof slimInstance.setData === "function") {
      try { slimInstance.setData(data); } catch {}
      return;
    }
    // Fallback: keine API → ignorieren (native Select reicht)
  };

  const safeSlimSetSelected = (slimInstance, values, trigger = false) => {
    if (!slimInstance) return;
    // SlimSelect v2: setSelected(values, trigger)
    if (typeof slimInstance.setSelected === "function") {
      try { slimInstance.setSelected(values, trigger); } catch {}
    }
  };

  // =========================================================
  // Erstzulassung (Jahr/Monat)
  // =========================================================
  const yearSelect = document.getElementById("first-registration-year");
  const monthSelect = document.getElementById("first-registration-month");

  // SlimSelect für Marke (nur falls vorhanden)
  const slimBrand = initSlim("#marke", {
    placeholder: "Marke wählen",
    allowDeselect: true,
    showSearch: true,
  });

  // Jahr-Optionen NUR einmal befüllen (falls Select existiert)
  if (yearSelect) {
    const hasYearsAlready = yearSelect.options.length > 2; // grober Guard (Placeholder + ggf. 1 Option)
    if (!hasYearsAlready) {
      const currentYear = new Date().getFullYear();
      for (let year = currentYear; year >= 1900; year--) {
        const option = document.createElement("option");
        option.value = String(year);
        option.textContent = String(year);
        yearSelect.appendChild(option);
      }
    }
  }

  // SlimSelect für Jahr/Monat (nur wenn Select existiert)
  const slimYear = initSlim("#first-registration-year", {
    placeholder: "Jahr wählen",
    allowDeselect: true,
    showSearch: false,
  });

  const slimMonth = initSlim("#first-registration-month", {
    placeholder: "Monat wählen",
    allowDeselect: true,
    showSearch: false,
  });

  // Monat initial deaktivieren, aktivieren sobald Jahr gesetzt ist
  if (monthSelect) {
    safeDisable(monthSelect, slimMonth);
  }

  if (yearSelect) {
    yearSelect.addEventListener("change", () => {
      const hasYear = !!yearSelect.value;
      if (!monthSelect) return;

      if (hasYear) {
        safeEnable(monthSelect, slimMonth);
      } else {
        safeDisable(monthSelect, slimMonth);
        monthSelect.selectedIndex = 0;
        // UI ggf. syncen
        safeSlimSetSelected(slimMonth, [""], false);
      }
    });
  }

  // =========================================================
  // Modell – dynamisch abhängig von Marke (inkl. Gruppen-Logik)
  // =========================================================
  let slimModell = initSlim("#modell", {
    placeholder: "Bitte zuerst Marke wählen",
    closeOnSelect: false,
    allowDeselect: true,
    hideSelected: false,
    showSearch: false,
  });

  const setModellPlaceholder = () => {
    if (!modelDropdown) return;
    modelDropdown.innerHTML = `<option value="" disabled selected hidden>Bitte zuerst Marke wählen</option>`;
    safeSlimSetData(slimModell, [
      { text: "Bitte zuerst Marke wählen", value: "", placeholder: true, disabled: true, selected: true },
    ]);
  };

  // aktuelle Modellwerte pro Marke merken (für Gruppen-RegEx)
  let currentModelValues = [];
  let suppressModelSync = false;

  const expandModelGroups = (selectedValues) => {
    const all = new Set();

    selectedValues.forEach((val) => {
      if (!val) return;

      const rx = modelGroups[val];
      if (rx) {
        currentModelValues.forEach((m) => {
          if (/\(alle\)/i.test(m)) return;
          if (rx.test(m)) all.add(m);
        });
        return;
      } else {
        all.add(val);
      }
    });

    return all;
  };

  const applySelectedToNative = (selectedSet) => {
    if (!modelDropdown) return;
    modelDropdown.querySelectorAll("option").forEach((opt) => {
      opt.selected = selectedSet.has(opt.value);
    });
  };

  const syncModelGroupsFromNative = () => {
    if (!modelDropdown) return;
    if (suppressModelSync) return;

    const selectedValues = Array.from(modelDropdown.selectedOptions)
      .map((o) => o.value)
      .filter(Boolean);

    const expanded = expandModelGroups(selectedValues);

    // Wenn keine Expansion notwendig → fertig
    const already = new Set(selectedValues);
    let changed = false;
    if (expanded.size !== already.size) changed = true;
    else {
      for (const v of expanded) {
        if (!already.has(v)) { changed = true; break; }
      }
    }
    if (!changed) return;

    suppressModelSync = true;
    applySelectedToNative(expanded);
    safeSlimSetSelected(slimModell, [...expanded], false);
    suppressModelSync = false;
  };

  const setModelOptionsForBrand = (brand) => {
    if (!brand || !modelData?.[brand] || !modelDropdown) {
      currentModelValues = [];
      setModellPlaceholder();
      return;
    }

    const models = modelData[brand];
    const options = models.map((m) => ({ text: m, value: m }));

    // Native Optionen neu
    modelDropdown.innerHTML = "";
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.text;
      modelDropdown.appendChild(opt);
    });

    currentModelValues = models.slice();

    // SlimSelect Daten setzen
    safeSlimSetData(slimModell, options);

    // optional: nach Markenwechsel Auswahl resetten
    modelDropdown.selectedIndex = 0;
    safeSlimSetSelected(slimModell, [], false);
  };

  if (brandDropdown && modelDropdown) {
    // initialer Zustand
    if (!brandDropdown.value) setModellPlaceholder();

    brandDropdown.addEventListener("change", () => {
      setModelOptionsForBrand(brandDropdown.value);
    });

    // Gruppen-Logik über native change (funktioniert auch mit SlimSelect)
    modelDropdown.addEventListener("change", syncModelGroupsFromNative);

    // falls Marke beim Laden schon gesetzt ist
    if (brandDropdown.value) setModelOptionsForBrand(brandDropdown.value);
  }

  // =========================================================
  // Preis/Kilometer – Select + Custom Input (ohne doppelte Blöcke)
  // =========================================================
  const wireSelectWithCustom = ({ selectId, customId, placeholder }) => {
    const sel = document.getElementById(selectId);
    const custom = document.getElementById(customId);

    if (!sel) return { sel: null, custom: null, slim: null };

    const slim = initSlim(`#${selectId}`, {
      placeholder,
      allowDeselect: true,
      showSearch: false,
    });

    const showCustom = (show) => {
      if (!custom) return;
      custom.style.display = show ? "block" : "none";
      if (!show) custom.value = "";
      if (show) custom.focus();
    };

    sel.addEventListener("change", () => {
      showCustom(sel.value === "custom");
    });

    // initial
    if (custom) showCustom(sel.value === "custom");

    return { sel, custom, slim };
  };

  wireSelectWithCustom({
    selectId: "price-select",
    customId: "price-custom",
    placeholder: "Preis wählen",
  });

  wireSelectWithCustom({
    selectId: "kilometer-select",
    customId: "kilometer-custom",
    placeholder: "Kilometer wählen",
  });

  // =========================================================
  // Getriebe / Kraftstoff
  // =========================================================
  initSlim("#gear", {
    placeholder: "Getriebe wählen",
    allowDeselect: true,
    showSearch: false,
  });

  initSlim("#fuel", {
    placeholder: "Kraftstoff wählen",
    allowDeselect: true,
    showSearch: false,
  });

  // =========================================================
  // Umkreis (aktiv erst, wenn Ort gesetzt)
  // =========================================================
  const distanceSelect = document.getElementById("distance-select");
  const distanceCustom = document.getElementById("distance-custom");
  const locationInput = document.getElementById("location");

  const slimDistance = initSlim("#distance-select", {
    placeholder: "Umkreis wählen",
    allowDeselect: true,
    showSearch: false,
  });

  const showDistanceCustom = (show) => {
    if (!distanceCustom) return;
    distanceCustom.style.display = show ? "block" : "none";
    if (!show) distanceCustom.value = "";
    if (show) distanceCustom.focus();
  };

  const setDistanceEnabled = (enabled) => {
    if (!distanceSelect) return;
    if (enabled) safeEnable(distanceSelect, slimDistance);
    else safeDisable(distanceSelect, slimDistance);
  };

  if (distanceSelect) {
    // initial
    const hasLoc = !!locationInput?.value?.trim();
    setDistanceEnabled(hasLoc);

    if (!hasLoc) {
      distanceSelect.selectedIndex = 0;
      showDistanceCustom(false);
    }

    // Ort Input steuert Enable/Disable
    if (locationInput) {
      locationInput.addEventListener("input", () => {
        const ok = !!locationInput.value.trim();
        setDistanceEnabled(ok);

        if (!ok) {
          distanceSelect.selectedIndex = 0;
          showDistanceCustom(false);
          safeSlimSetSelected(slimDistance, [""], false);
        }
      });
    }

    // custom toggle
    distanceSelect.addEventListener("change", () => {
      showDistanceCustom(distanceSelect.value === "custom");
    });
  }

  // =========================================================
  // Media Sliders: alle statischen Container initialisieren
  // (für dynamische auf Startseite: wird zusätzlich in loadHomeListings gemacht)
  // =========================================================
  document.querySelectorAll(".media-container").forEach(initMediaSlider);

  // =========================================================
  // Startseite: Neueste Inserate nur laden, wenn Container existiert
  // =========================================================
  if (document.getElementById("homeResults")) {
    loadHomeListings();
  }

  // =========================================================
  // Footer Jahr sicher setzen
  // =========================================================
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // =========================================================
  // Nur auf Startseite: sessionStorage reset
  // =========================================================
  {
    const path = window.location.pathname;
    const isIndex = path === "/" || path.endsWith("/index.html");
    if (isIndex) {
      sessionStorage.removeItem("inseratGestartet");
      sessionStorage.removeItem("hatGespeichert");
    }
  }

}); // Ende DOMContentLoaded (dein erster Teil muss bis hierhin offen gewesen sein)


// ============================================================================
// Global: Verkauf-Click / Logout (falls du es via onclick im HTML nutzt)
// ============================================================================

async function handleVerkaufenClick() {
  // robust: lieber Cookie/Session checken als localStorage
  try {
    const res = await fetch("/getNutzerInfo", { credentials: "include" });
    const data = await res.json();

    if (!data?.eingeloggt) {
      localStorage.setItem("redirectAfterLogin", "verkaufen.html");
      window.location.href = "login.html";
      return;
    }

    const rolle = (data.rolle || "").toLowerCase();
    if (rolle === "haendler" || rolle === "händler") {
      window.location.href = "haendler.html";
    } else {
      window.location.href = "privat.html";
    }
  } catch {
    // Fallback: altes Verhalten
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    const role = localStorage.getItem("userRole");

    if (!isLoggedIn) window.location.href = "login.html";
    else if (role === "haendler") window.location.href = "haendler.html";
    else window.location.href = "privat.html";
  }
}

function logout() {
  fetch("/logout", { method: "POST", credentials: "include" })
    .finally(() => {
      ["isLoggedIn", "userRole", "userId", "redirectAfterLogin"].forEach((k) => localStorage.removeItem(k));
      window.location.href = "index.html";
    });
}

window.handleVerkaufenClick = handleVerkaufenClick;
window.logout = logout;


// ============================================================================
// Startseite: Neueste Inserate + Slider + Click-through zu anzeige.html
// ============================================================================

// ===== Helpers =====
function toNum(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const s = String(v)
    .trim()
    .replace(/[\u202F\u00A0\s]/g, "")
    .replace(/[€]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function pickPrice(...vals) {
  for (const v of vals) {
    const n = toNum(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
}

function fmtEUR(v) {
  const n = toNum(v);
  return Number.isFinite(n) ? n.toLocaleString("de-DE") + " €" : "Preis n. a.";
}

function sanitizePhone(raw) {
  return raw ? String(raw).replace(/[^\d+]/g, "") : "";
}

function getDocId(doc) {
  if (!doc) return null;
  if (doc._id && typeof doc._id === "object" && typeof doc._id.$oid === "string") return doc._id.$oid;
  if (typeof doc._id === "string") return doc._id;
  if (typeof doc.id === "string") return doc.id;
  return null;
}

function sellerInitials(name = "") {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || "").toUpperCase()).join("") || "AV";
}

function toAnzeigePayload(item) {
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const merged = { ...raw, ...item };

  if (merged.verkauf_kilometer == null && item.verkauf_kilometer != null) merged.verkauf_kilometer = item.verkauf_kilometer;
  if (!merged.verkauf_erstzulassung && item.verkauf_erstzulassung) merged.verkauf_erstzulassung = item.verkauf_erstzulassung;
  if (!merged.verkauf_kraftstoff && item.verkauf_kraftstoff) merged.verkauf_kraftstoff = item.verkauf_kraftstoff;
  if (!merged.verkauf_getriebe && item.verkauf_getriebe) merged.verkauf_getriebe = item.verkauf_getriebe;
  if (!merged.verkauf_leistung && item.verkauf_leistung) merged.verkauf_leistung = item.verkauf_leistung;
  if (!merged.verkauf_verbrauch_kombiniert && item.verkauf_verbrauch_kombiniert) merged.verkauf_verbrauch_kombiniert = item.verkauf_verbrauch_kombiniert;
  if (!merged.verkauf_verkaeufer && item.verkauf_verkaeufer) merged.verkauf_verkaeufer = item.verkauf_verkaeufer;
  if (!merged.verkauf_name && item.verkauf_name) merged.verkauf_name = item.verkauf_name;

  if (merged.verkauf_brutto == null && merged.brutto_preis != null) merged.verkauf_brutto = merged.brutto_preis;
  if (merged.verkauf_brutto == null && merged["brutto-preis"] != null) merged.verkauf_brutto = merged["brutto-preis"];
  if (merged.verkauf_preis == null && item.preis != null) merged.verkauf_preis = item.preis;

  if (!merged.telefon && item.telefon) merged.telefon = item.telefon;
  return merged;
}

// ===== Server laden =====
async function fetchInserate(page = 1, limit = 9) {
  const url = `/inserate?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("Fetch /inserate fehlgeschlagen");
  return res.json();
}

// ===== Slider Init (einmalig pro Container) =====
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
// ===== Startseite: Listings rendern =====
async function loadHomeListings() {
  const container = document.getElementById("homeResults");
  if (!container) return;

  container.innerHTML = "<p style='opacity:.7'>Lade Inserate…</p>";

  try {
    const { items } = await fetchInserate(1, 9);
    const list = Array.isArray(items) ? items : [];

    if (!list.length) {
      container.innerHTML = "<p>Aktuell sind keine Fahrzeuge online.</p>";
      return;
    }

    const fmtRating = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n.toFixed(1).replace(".", ",") : "";
    };

    const starsHTML = (avg) => {
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
    };

    const ratingBlock = ({ isHaendler, avg, count }) => {
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
    };

    container.innerHTML = "";

    list.forEach((inserat) => {
      const imgs = Array.isArray(inserat.images) ? inserat.images : [];
      const tel = sanitizePhone(inserat.telefon);
      const titel = inserat.titel || "Unbekanntes Fahrzeug";

      const preisNum = pickPrice(
        inserat["brutto-preis"],
        inserat.brutto_preis,
        inserat.verkauf_brutto,
        inserat.preis,
        inserat.verkauf_preis,
        inserat.verkauf_netto
      );
      const preis = fmtEUR(preisNum);

      const kurz = inserat.verkauf_kurzbeschreibung || "";
      const _id = getDocId(inserat) || "";

      const rawType = String(inserat.seller?.type || inserat.verkauf_verkaeufer || "").toLowerCase();
      const isHaendler =
        rawType === "haendler" || rawType === "händler" || rawType.includes("händ") || rawType.includes("haend");

      const sellerName =
        inserat.seller?.name || inserat.verkauf_name || (isHaendler ? "Händler" : "Privatanbieter");

      const sellerLogo =
        inserat.seller?.logoUrl ||
        inserat.raw?.seller?.logoUrl ||
        inserat.logoUrl ||
        "";

      const sellerLocation =
        inserat.standort || [inserat.plz, inserat.ort].filter(Boolean).join(" ") || "Standort nicht angegeben";

      const dealerRatingHTML = ratingBlock({
        isHaendler,
        avg: inserat.seller?.ratingAvg,
        count: inserat.seller?.ratingCount,
      });

      const card = document.createElement("div");
      card.className = "car-card";
      card.innerHTML = `
        <div class="car-card-media">
          <div class="card-actions mobile-only">

            <button
              class="save-btn"
              type="button"
              title="Auto speichern"
              aria-pressed="false"
              data-inserat-id="${_id}"
              ${_id ? "" : "disabled aria-disabled='true'"}
            >
              <i class="far fa-heart" aria-hidden="true"></i>
            </button>

            <a href="${tel ? `tel:${tel}` : "#"}"
               class="contact-btn clean-phone"
               title="Verkäufer kontaktieren"
               role="button"
               ${tel ? "" : "aria-disabled='true'"} >
              <i class="fas fa-phone"></i>
            </a>

          </div>

          <div class="media-container">
            <div class="slides">
              ${imgs.map((src) => `<img src="${src}" class="slide" alt="">`).join("")}
              ${
                inserat.video
                  ? `<video class="slide" playsinline controls preload="metadata">
                       <source src="${inserat.video}" type="video/mp4">
                     </video>`
                  : ""
              }
            </div>

            <button class="media-arrow left"  type="button"><i class="fas fa-chevron-left"></i></button>
            <button class="media-arrow right" type="button"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>

        <div class="car-details">
          <div class="car-top-row">
            <h2 class="car-title">${titel}</h2>
            <p class="car-price">${preis}</p>
          </div>

          <p class="car-subtitle">${kurz}</p>

          <div class="car-info-grid">
            <p><i class="fas fa-road"></i> ${inserat.verkauf_kilometer ?? "—"} km</p>
            <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.verkauf_erstzulassung || "—"}</p>
            <p><i class="fas fa-gas-pump"></i> ${inserat.verkauf_kraftstoff || "—"}</p>
            <p><i class="fas fa-gauge-high"></i> ${inserat.verkauf_leistung ?? "—"} PS</p>
            <p><i class="fas fa-gears"></i> ${inserat.verkauf_getriebe || "—"}</p>
           <p><i class="fas fa-tint"></i> ${
  formatConsumption(inserat.verkauf_verbrauch_kombiniert, inserat.verkauf_kraftstoff)
}</p>

          </div>

          <div class="dealer-info">
            <div class="dealer-row">
              <div class="dealer-avatar">
                <img alt="${sellerName} Logo">
                <span class="dealer-initials">${sellerInitials(sellerName)}</span>
              </div>

              <div class="dealer-meta">
                <div class="dealer-name">${sellerName}</div>
                ${dealerRatingHTML}
                <div class="dealer-location">${sellerLocation}</div>
              </div>
            </div>
          </div>
        </div>
      `;

      card.addEventListener("click", (e) => {
        const isAction = e.target.closest(".card-actions button, .card-actions a, .media-arrow, video");
        if (isAction) return;

        try {
          const payload = toAnzeigePayload(inserat);
          localStorage.setItem("ausgewaehltesInserat", JSON.stringify(payload));
        } catch {}

        window.location.href = _id ? `anzeige.html?id=${encodeURIComponent(_id)}` : "anzeige.html";
      });

      container.appendChild(card);

      // Slider init
      initMediaSlider(card.querySelector(".media-container"));

      // Video darf nicht Card-Klick auslösen
      card.querySelectorAll("video").forEach((v) => {
        v.setAttribute("playsinline", "");
        v.addEventListener("pointerdown", (ev) => ev.stopPropagation(), { passive: true });
        v.addEventListener("click", (ev) => ev.stopPropagation());
      });

      // Logo safe
      const avatar = card.querySelector(".dealer-avatar");
      const img = avatar.querySelector("img");
      avatar.classList.remove("has-logo");
      img.removeAttribute("src");

      if (sellerLogo) {
        img.addEventListener("load", () => {
          if (img.naturalWidth > 0) avatar.classList.add("has-logo");
        }, { once: true });

        img.addEventListener("error", () => {
          avatar.classList.remove("has-logo");
          img.removeAttribute("src");
        }, { once: true });

        img.src = sellerLogo;
        if (img.complete && img.naturalWidth > 0) avatar.classList.add("has-logo");
      }

      // Hochformat-Erkennung optional
      card.querySelectorAll(".slide").forEach((m) => {
        if (m.tagName === "VIDEO") {
          m.addEventListener("loadedmetadata", () => {
            if (m.videoHeight > m.videoWidth) m.classList.add("portrait-zoom");
          });
        } else if (m.tagName === "IMG") {
          m.addEventListener("load", () => {
            if (m.naturalHeight > m.naturalWidth) m.classList.add("portrait-zoom");
          });
        }
      });
    });

    // WICHTIG: Nach dem Rendern gespeicherte Herzen „hydraten“
    hydrateSaveButtons(container);

  } catch (err) {
    console.error("Fehler beim Laden der Start-Inserate:", err);
    container.innerHTML = "<p>Fehler beim Laden der Inserate.</p>";
  }
}

function formatConsumption(value, fuelType) {
  if (value == null) return "—";

  const s = String(value).trim();
  if (!s) return "—";

  // Wenn bereits eine Einheit drinsteht (z.B. "l/100km", "kWh/100 km", "kg/100km"), nichts anhängen
  if (/(l|kwh|kg)\s*\/\s*100\s*km/i.test(s)) return s;

  const f = String(fuelType || "").toLowerCase();

  // Einheit je nach Antrieb (optional, aber sinnvoll)
  let unit = "l/100km";
  if (/(elektro|electric|bev|strom|ev)/i.test(f)) unit = "kWh/100km";
  else if (/(wasserstoff|hydrogen|h2|cng|erdgas)/i.test(f)) unit = "kg/100km";

  return `${s} ${unit}`;
}

/* =========================
   Saved (Herz) – global für Karten (Startseite / später auch Suche)
   Nutzt: /saved/status/:id  und  /saved/toggle
========================= */

function setSaveBtnUI(btn, saved) {
  if (!btn) return;

  const isSaved = !!saved;

  // Button state
  btn.classList.toggle("is-saved", isSaved);
  btn.setAttribute("aria-pressed", isSaved ? "true" : "false");
  btn.title = isSaved ? "Gespeichert" : "Auto speichern";

  // Icon state (robust für FA5 + FA6)
  const icon = btn.querySelector("i");
  if (icon) {
    // Grundklasse sicherstellen
    icon.classList.add("fa-heart");

    // Reset: erst alle Varianten raus, dann gezielt setzen
    icon.classList.remove("fa-solid", "fa-regular", "fas", "far");

    if (isSaved) {
      // Solid / filled
      icon.classList.add("fa-solid"); // FA6
      icon.classList.add("fas");      // FA5 fallback
    } else {
      // Regular / outline
      icon.classList.add("fa-regular"); // FA6
      icon.classList.add("far");        // FA5 fallback
    }
  }

  // Pulse nur beim Aktivieren (gespeichert)
  if (isSaved) {
    btn.classList.remove("pulse");
    void btn.offsetWidth; // reflow -> Animation zuverlässig
    btn.classList.add("pulse");
    window.setTimeout(() => btn.classList.remove("pulse"), 500);
  } else {
    btn.classList.remove("pulse");
  }
}


function getRedirectTarget() {
  const path = window.location.pathname || "";
  const isRoot = path === "/" || path === "";
  const file = isRoot ? "index.html" : (path.split("/").pop() || "index.html");
  return file + (window.location.search || "") + (window.location.hash || "");
}

async function fetchSaveStatus(fahrzeugId) {
  const res = await fetch(`/saved/status/${encodeURIComponent(fahrzeugId)}`, {
    credentials: "include",
  });

  if (res.status === 401 || res.status === 403) return null; // nicht eingeloggt
  if (!res.ok) throw new Error("Fehler beim Laden des Save-Status");

  const data = await res.json().catch(() => ({}));
  return !!data.saved;
}

async function toggleSaveBtn(btn) {
  const fahrzeugId = (btn?.dataset?.inseratId || "").trim();
  if (!fahrzeugId) return;

  if (btn.dataset.busy === "1") return;
  btn.dataset.busy = "1";

  try {
    const res = await fetch("/saved/toggle", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fahrzeugId }),
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.setItem("redirectAfterLogin", getRedirectTarget());
      window.location.href = "login.html";
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Speichern fehlgeschlagen");

    setSaveBtnUI(btn, !!data.saved);
  } catch (err) {
    console.error("❌ Save toggle error:", err);
  } finally {
    btn.dataset.busy = "0";
  }
}

function hydrateSaveButtons(scope = document) {
  const buttons = Array.from(scope.querySelectorAll("button.save-btn[data-inserat-id]"));
  if (!buttons.length) return;

  Promise.allSettled(
    buttons.map(async (btn) => {
      const id = (btn.dataset.inseratId || "").trim();
      if (!id) return;

      const saved = await fetchSaveStatus(id);
      if (saved === null) return; // nicht eingeloggt -> UI bleibt Outline
      setSaveBtnUI(btn, saved);
    })
  ).catch(() => {});
}

// Click-Delegation: funktioniert auch für dynamisch gerenderte Cards
if (!window.__autovisaSaveDelegationBound) {
  window.__autovisaSaveDelegationBound = true;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button.save-btn[data-inserat-id]");
    if (!btn) return;

    // verhindert Card-Klick/Weiterleitung
    e.preventDefault();
    e.stopPropagation();

    toggleSaveBtn(btn);
  });
}

// Optional: falls du irgendwo inline onclick="toggleSave(this)" nutzt
if (!window.toggleSave) {
  window.toggleSave = (btn) => toggleSaveBtn(btn);
}
