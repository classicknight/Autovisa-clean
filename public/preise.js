// preise.js (NEU)
document.addEventListener("DOMContentLoaded", () => {
  // Datum unten eintragen
  const el = document.getElementById("pricesDate");
  if (el) {
    const d = new Date();
    const fmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    el.textContent = fmt.format(d);
  }
  
  // Optional: nur ein FAQ gleichzeitig offen halten (sauberer UX)
  const faqs = Array.from(document.querySelectorAll(".prices-faq"));
  faqs.forEach(faq => {
    faq.addEventListener("toggle", () => {
      if (!faq.open) return;
      faqs.forEach(other => { if (other !== faq) other.open = false; });
    });
  });
});