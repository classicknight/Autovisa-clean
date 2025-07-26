document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.getElementById("nav-links");
    const hamburger = document.getElementById("hamburger");
    const dropdownLinks = document.querySelectorAll(".dropdown > a");
    
    // Hamburger-Menü ein-/ausblenden
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("active");
      closeAllDropdowns(); // Immer Dropdowns schließen beim Öffnen
    });
    
    // Dropdown-Handling
    dropdownLinks.forEach(link => {
      const menu = link.nextElementSibling;
      
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Schließt alle Dropdowns außer das angeklickte
        document.querySelectorAll(".dropdown-menu").forEach(otherMenu => {
          if (otherMenu !== menu) {
            otherMenu.classList.remove("show");
          }
        });
        
        menu.classList.toggle("show");
      });
    });
    
    // Klick außerhalb: alles schließen
    document.addEventListener("click", () => {
      navLinks.classList.remove("active");
      closeAllDropdowns();
    });
    
    function closeAllDropdowns() {
      document.querySelectorAll(".dropdown-menu").forEach(menu => {
        menu.classList.remove("show");
      });
    }
    
    // Login-Handling
    const isLoggedIn = false; // später dynamisch setzen
    
    const savedCarsLink = document.getElementById("saved-cars-link");
    const myCarsLink = document.getElementById("my-cars-link");
    
    if (savedCarsLink) {
      savedCarsLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = isLoggedIn ? "gespeicherte-autos.html" : "login.html";
      });
    }
    
    if (myCarsLink) {
      myCarsLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = isLoggedIn ? "meine-autos.html" : "login.html";
      });
    }
    
    // Smooth Scroll
    const searchLink = document.querySelector('a[href="#search-section"]');
    if (searchLink) {
      searchLink.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  });
  
  
  
  
  
  document.getElementById("chat-form").addEventListener("submit", function(e) {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (message) {
      const container = document.getElementById("chat-messages");
      const bubble = document.createElement("div");
      bubble.className = "message from-me";
      bubble.innerHTML = `<p>${message}</p><span>Ich, jetzt</span>`;
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
      input.value = "";
    }
  });