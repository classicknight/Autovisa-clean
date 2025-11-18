document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
  
    const tokenInput   = document.getElementById("resetToken");
    const form         = document.getElementById("resetForm");
    const pw1          = document.getElementById("resetPassword");
    const pw2          = document.getElementById("resetPasswordRepeat");
    const msgEl        = document.getElementById("resetMessage");
    const submitBtn    = document.getElementById("resetSubmit");
  
    if (tokenInput) tokenInput.value = token;
  
    // Wenn kein Token da ist → Fehlermeldung & Form deaktivieren
    if (!token || !form || !pw1 || !pw2) {
      if (msgEl) {
        msgEl.textContent = "Dieser Link ist ungültig oder unvollständig.";
        msgEl.classList.add("error");
      }
      if (submitBtn) submitBtn.disabled = true;
      return;
    }
  
    // Toggle Passwort-Sichtbarkeit (wie bei login.js)
    document.querySelectorAll(".toggle-password").forEach(icon => {
      icon.addEventListener("click", () => {
        const targetId = icon.getAttribute("data-target");
        const input = document.getElementById(targetId);
        if (!input) return;
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
  
        const iTag = icon.querySelector("i");
        if (iTag) {
          iTag.classList.toggle("fa-eye", !isHidden);
          iTag.classList.toggle("fa-eye-slash", isHidden);
        }
        icon.setAttribute("aria-label", isHidden ? "Passwort verbergen" : "Passwort anzeigen");
      });
    });
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!tokenInput.value) {
        msgEl.textContent = "Dieser Link ist ungültig oder abgelaufen.";
        msgEl.classList.remove("success");
        msgEl.classList.add("error");
        return;
      }
  
      const pass1 = pw1.value;
      const pass2 = pw2.value;
  
      if (pass1.length < 8) {
        msgEl.textContent = "Das Passwort muss mindestens 8 Zeichen lang sein.";
        msgEl.classList.remove("success");
        msgEl.classList.add("error");
        return;
      }
      if (pass1 !== pass2) {
        msgEl.textContent = "Die Passwörter stimmen nicht überein.";
        msgEl.classList.remove("success");
        msgEl.classList.add("error");
        return;
      }
  
      try {
        submitBtn.disabled = true;
        msgEl.textContent = "Speichere neues Passwort …";
        msgEl.classList.remove("error");
        msgEl.classList.remove("success");
  
        const res = await fetch("/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: tokenInput.value,
            password: pass1
          })
        });
  
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          msgEl.textContent = data.error || "Dieser Link ist ungültig oder abgelaufen.";
          msgEl.classList.remove("success");
          msgEl.classList.add("error");
          submitBtn.disabled = false;
          return;
        }
  
        msgEl.textContent = "✅ Passwort wurde aktualisiert. Du kannst dich jetzt einloggen.";
        msgEl.classList.remove("error");
        msgEl.classList.add("success");
  
        // Optional: nach ein paar Sekunden zurück zum Login
        setTimeout(() => {
          window.location.href = "login.html";
        }, 2000);
      } catch (err) {
        console.error("Reset-Passwort Fehler:", err);
        msgEl.textContent = "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.";
        msgEl.classList.remove("success");
        msgEl.classList.add("error");
        submitBtn.disabled = false;
      }
    });
  });
  