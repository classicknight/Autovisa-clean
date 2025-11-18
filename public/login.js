document.addEventListener("DOMContentLoaded", () => {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginContent = document.getElementById("login");
  const registerContent = document.getElementById("register");

  // === Tabs umschalten ===
  function showTab(tab) {
    if (tab === "login") {
      loginTab.classList.add("active");
      registerTab.classList.remove("active");
      loginContent.classList.remove("hidden");
      registerContent.classList.add("hidden");
    } else {
      registerTab.classList.add("active");
      loginTab.classList.remove("active");
      registerContent.classList.remove("hidden");
      loginContent.classList.add("hidden");
    }
  }

  loginTab?.addEventListener("click", () => showTab("login"));
  registerTab?.addEventListener("click", () => showTab("register"));

  // === LOGIN senden ===
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const loginBtn = loginForm.querySelector("button[type='submit']");
      if (loginBtn) loginBtn.disabled = true;

      try {
        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          alert("✅ Login erfolgreich!");

          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("userRole", data.role || "privat");
          localStorage.setItem("userId", data.id || "");
          localStorage.setItem("username", data.name || "");

          const redirectPage = localStorage.getItem("redirectAfterLogin");
          const role = data.role || "privat";

          if (redirectPage) {
            localStorage.removeItem("redirectAfterLogin");
            const lowerRedirect = redirectPage.toLowerCase();

            if ((role === "haendler" && lowerRedirect.includes("privat")) ||
                (role === "privat" && lowerRedirect.includes("haendler"))) {
              window.location.href = "index.html";
            } else {
              window.location.href = redirectPage;
            }
          } else {
            window.location.href = "index.html";
          }

          loginForm.reset();
        } else {
          alert("❌ " + (data.error || "Login fehlgeschlagen"));
        }

      } catch (err) {
        console.error("Login Fehler:", err);
        alert("⚠️ Serverfehler. Bitte später versuchen.");
      } finally {
        if (loginBtn) loginBtn.disabled = false;
      }
    });
  }

  // === REGISTRIERUNG senden ===
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("registerName").value.trim();
      const email = document.getElementById("registerEmail").value.trim();
      const password = document.getElementById("registerPassword").value;
      const passwordRepeat = document.getElementById("registerPasswordRepeat").value;
      const agbChecked = document.querySelector('input[name="agb"]')?.checked;

      if (password.length < 8) {
        return alert("❌ Das Passwort muss mindestens 8 Zeichen lang sein!");
      }

      if (password !== passwordRepeat) {
        return alert("❌ Passwörter stimmen nicht überein!");
      }

      if (!agbChecked) {
        return alert("❌ Bitte AGB und Datenschutz akzeptieren.");
      }

      try {
        const res = await fetch("/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          alert("✅ Registrierung erfolgreich! Bitte bestätige deine E-Mail.");
          registerForm.reset();
          loginTab?.click(); // Wechsel zum Login
        } else {
          alert("❌ " + (data.error || "Registrierung fehlgeschlagen"));
        }
      } catch (err) {
        console.error("Registrierung Fehler:", err);
        alert("⚠️ Serverfehler. Bitte später versuchen.");
      }
    });
  }

  // === Toggle Passwort-Sichtbarkeit ===
  document.querySelectorAll(".toggle-password").forEach(icon => {
    icon.addEventListener("click", () => {
      const targetId = icon.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      icon.classList.toggle("fa-eye", !isHidden);
      icon.classList.toggle("fa-eye-slash", isHidden);
      icon.setAttribute("aria-label", isHidden ? "Passwort verbergen" : "Passwort anzeigen");
    });
  });

    // === "Passwort vergessen?" – Modal & Request ===
    const forgotLink  = document.getElementById("forgotPasswordLink");
    const forgotModal = document.getElementById("forgotPasswordModal");
    const forgotForm  = document.getElementById("forgotPasswordForm");
    const forgotClose = document.getElementById("forgotClose");
    const forgotInfo  = document.getElementById("forgotInfo");
  
    function openForgot() {
      if (!forgotModal) return;
      forgotModal.classList.remove("hidden");
      forgotModal.setAttribute("aria-hidden", "false");
      document.getElementById("forgotEmail")?.focus();
    }
  
    function closeForgot() {
      if (!forgotModal) return;
      forgotModal.classList.add("hidden");
      forgotModal.setAttribute("aria-hidden", "true");
      if (forgotInfo) forgotInfo.textContent = "";
    }
  
    // Öffnen/Schließen
    forgotLink?.addEventListener("click", openForgot);
    forgotClose?.addEventListener("click", closeForgot);
  
    // Klick außerhalb vom Inner schließt auch
    forgotModal?.addEventListener("click", (e) => {
      if (e.target === forgotModal) closeForgot();
    });
  
    // Formular: Reset-Link anfordern
    if (forgotForm) {
      forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("forgotEmail").value.trim();
        if (!email) return;
  
        if (forgotInfo) {
          forgotInfo.textContent = "Einen Moment…";
        }
  
        try {
          const res = await fetch("/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          });
  
          // Immer dieselbe Meldung – egal ob E-Mail existiert (kein User-Leak)
          if (forgotInfo) {
            forgotInfo.textContent =
              "Wenn die E-Mail bei Autovisa registriert ist, haben wir dir einen Link geschickt.";
          }
        } catch (err) {
          console.error("Forgot password Fehler:", err);
          if (forgotInfo) {
            forgotInfo.textContent =
              "Es ist ein Fehler aufgetreten. Bitte versuch es später noch einmal.";
          }
        }
      });
    }
  
});
