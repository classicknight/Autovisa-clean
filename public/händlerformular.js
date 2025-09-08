document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dealerForm");
  const fileInput = document.getElementById("logo"); // <input type="file" id="logo">

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (form.password.value !== form["confirm-password"].value) {
      alert("Die Passwörter stimmen nicht überein.");
      return;
    }

    const fd = new FormData();
    fd.append("firma", form.firma.value.trim());
    fd.append("strasse", form.strasse.value.trim());
    fd.append("hausnummer", form.hausnummer.value.trim());
    fd.append("plz", form.plz.value.trim());
    fd.append("ort", form.ort.value.trim());
    fd.append("land", form.land.value);
    fd.append("telefon", form.telefon.value.trim());
    fd.append("telefon2", form.telefon2.value.trim());
    fd.append("email", form.email.value.trim());
    fd.append("whatsapp", form.whatsapp.checked ? "true" : "false");
    fd.append("tarif", form.tarif.value);
    fd.append("zahlungsmethode", form.zahlungsmethode.value);
    fd.append("kontoinhaber", form.kontoinhaber.value.trim());
    fd.append("iban", form.iban.value.trim());
    fd.append("bic", form.bic.value.trim());
    fd.append("impressum", form.impressum.value.trim());
    fd.append("agb", form.agb.checked ? "true" : "false");
    fd.append("datenschutz", form.datenschutz.checked ? "true" : "false");
    fd.append("password", form.password.value);
    fd.append("confirmPassword", form["confirm-password"].value);
    // fd.append("role","haendler"); // nicht nötig – Server setzt das selbst

    if (fileInput && fileInput.files && fileInput.files[0]) {
      fd.append("logo", fileInput.files[0]); // <-- WICHTIG: Name = "logo"
    }

    try {
      const res = await fetch("/haendler-registrieren", {
        method: "POST",
        body: fd
      });
      const result = await res.json();

      if (res.ok) {
        alert("Registrierung erfolgreich! Bitte prüfen Sie Ihr E-Mail-Postfach.");
        window.location.href = "index.html";
      } else {
        alert(result.error || "Ein Fehler ist aufgetreten.");
      }
    } catch (err) {
      console.error(err);
      alert("Serverfehler. Bitte später erneut versuchen.");
    }
  });
});

