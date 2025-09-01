document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("contactForm");
    const feedback = document.getElementById("formFeedback");
    
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      
      // Validierung
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const subject = form.subject.value.trim();
      const message = form.message.value.trim();
      
      if (!name || !email || !subject || !message) {
        feedback.textContent = "Bitte alle Felder ausfüllen.";
        feedback.className = "form-feedback error";
        return;
      }
      
      // (Optional) E-Mail-Format checken
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(email)) {
        feedback.textContent = "Bitte eine gültige E-Mail-Adresse eingeben.";
        feedback.className = "form-feedback error";
        return;
      }
      
      // Erfolg (Backend-Anbindung später möglich)
      feedback.textContent = "✅ Vielen Dank! Deine Nachricht wurde gesendet.";
      feedback.className = "form-feedback success";
      form.reset();
    });
  });