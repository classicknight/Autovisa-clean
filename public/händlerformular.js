document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dealerForm");

  // --- Logo-Vorschau Elemente
  const fileInput  = document.getElementById("logo");       // <input type="file" name="logo" ...>
  const imgEl      = document.getElementById("logoImg");
  const initialsEl = document.getElementById("logoInitials");
  const removeBtn  = document.getElementById("logoRemove");

  // Initialen aus Firmenname
  function initialsFromName(name = "") {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const ini = parts.map(p => (p[0] || "").toUpperCase()).join("");
    return ini || "AV";
  }
  function updateInitials() {
    if (initialsEl && form?.firma) {
      initialsEl.textContent = initialsFromName(form.firma.value);
    }
  }
  updateInitials();
  form?.firma?.addEventListener("input", updateInitials);

  // Vorschau zurücksetzen
  function resetPreview() {
    if (imgEl) {
      imgEl.removeAttribute("src");
      imgEl.style.display = "none";
    }
    if (initialsEl) {
      initialsEl.style.display = "flex";
      updateInitials();
    }
  }

  // Logo-Datei auswählen → Vorschau
  fileInput?.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) { resetPreview(); return; }

    const okTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(f.type)) {
      alert("Bitte PNG, JPEG oder WEBP hochladen.");
      fileInput.value = "";
      resetPreview();
      return;
    }
    const maxBytes = 1.5 * 1024 * 1024; // 1.5 MB
    if (f.size > maxBytes) {
      alert("Das Bild ist größer als 1.5 MB.");
      fileInput.value = "";
      resetPreview();
      return;
    }

    const url = URL.createObjectURL(f);
    imgEl.src = url;
    imgEl.onload = () => URL.revokeObjectURL(url);
    imgEl.style.display = "block";
    initialsEl.style.display = "none";
  });

  // Logo entfernen
  removeBtn?.addEventListener("click", () => {
    fileInput.value = "";
    resetPreview();
  });

  // --- Formular absenden (MULTIPART inkl. optionalem LOGO)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Client-Checks
    if (!form.agb.checked || !form.datenschutz.checked) {
      alert("Bitte AGB und Datenschutz akzeptieren.");
      return;
    }
    if (form.password.value !== form["confirm-password"].value) {
      alert("Die Passwörter stimmen nicht überein.");
      return;
    }

    // (Sicherheits-)Checks fürs Logo nochmal vorm Absenden
    const f = fileInput?.files?.[0];
    if (f) {
      const okTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!okTypes.includes(f.type)) {
        alert("Bitte PNG, JPEG oder WEBP hochladen.");
        return;
      }
      if (f.size > 1.5 * 1024 * 1024) {
        alert("Das Bild ist größer als 1.5 MB.");
        return;
      }
    }

    const submitBtn = form.querySelector(".submit-btn");
    submitBtn.disabled = true;

    try {
      // WICHTIG: FormData statt JSON, Feldname fürs Logo MUSS "logo" sein
      const fd = new FormData();
      fd.append("firma",            form.firma.value.trim());
      fd.append("strasse",          form.strasse.value.trim());
      fd.append("hausnummer",       form.hausnummer.value.trim());
      fd.append("plz",              form.plz.value.trim());
      fd.append("ort",              form.ort.value.trim());
      fd.append("land",             form.land.value);
      fd.append("telefon",          form.telefon.value.trim());
      fd.append("telefon2",         form.telefon2.value.trim());
      fd.append("email",            form.email.value.trim());
      fd.append("whatsapp",         form.whatsapp.checked ? "true" : "false");
      fd.append("tarif",            form.tarif.value);
      fd.append("zahlungsmethode",  form.zahlungsmethode.value);
      fd.append("kontoinhaber",     form.kontoinhaber.value.trim());
      fd.append("iban",             form.iban.value.trim());
      fd.append("bic",              form.bic.value.trim());
      fd.append("impressum",        form.impressum.value.trim());
      fd.append("agb",              form.agb.checked ? "true" : "false");
      fd.append("datenschutz",      form.datenschutz.checked ? "true" : "false");
      fd.append("password",         form.password.value);
      fd.append("confirmPassword",  form["confirm-password"].value);

      if (f) fd.append("logo", f); // <— schickt die Datei mit

      // KEIN Content-Type-Header setzen! Browser setzt Boundary automatisch.
      const res = await fetch("/haendler-registrieren", {
        method: "POST",
        body: fd
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok) {
        alert("Registrierung erfolgreich! Bitte E-Mail zur Bestätigung prüfen.");
        // Nach Verifizierung ist logoUrl im Profil; neue Inserate bekommen es automatisch.
        window.location.href = "index.html";
      } else {
        alert(result.error || "Ein Fehler ist aufgetreten.");
        submitBtn.disabled = false;
      }
    } catch (err) {
      console.error(err);
      alert("Serverfehler. Bitte später erneut versuchen.");
      submitBtn.disabled = false;
    }
  });
});
