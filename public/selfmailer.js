document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const imageInput = $("smImageInput");
  const carImage = $("smCarImage");

  const titleInput = $("smTitleInput");
  const priceInput = $("smPriceInput");
  const yearInput = $("smYearInput");
  const powerInput = $("smPowerInput");
  const kmInput = $("smKmInput");
  const highlightsInput = $("smHighlightsInput");
  const dealerInput = $("smDealerInput");
  const locationInput = $("smLocationInput");
  const phoneInput = $("smPhoneInput");
  const websiteInput = $("smWebsiteInput");
  const ctaInput = $("smCtaInput");
  const qrInput = $("smQrInput");

  const priceEl = $("smPrice");
  const backPriceEl = $("smBackPrice");
  const titleEl = $("smTitle");
  const backTitleEl = $("smBackTitle");
  const specYearEl = $("smSpecYear");
  const specPowerEl = $("smSpecPower");
  const specKmEl = $("smSpecKm");
  const highlightsList = $("smHighlightsList");
  const dealerEl = $("smDealer");
  const locationEl = $("smLocation");
  const phoneEl = $("smPhone");
  const websiteEl = $("smWebsite");
  const ctaEl = $("smCta");
  const qrImage = $("smQrImage");

  const frontBtn = $("smDownloadFront");
  const backBtn = $("smDownloadBack");

  const defaultHighlights = ["Scheckheft gepflegt", "1. Hand", "Klimaautomatik"];
  const defaultQr = "https://www.autovisa.de";

  const formatNumber = (input) => {
    const v = String(input || "").trim();
    if (!v) return "";
    const cleaned = v.replace(/[^\d]/g, "");
    if (!cleaned) return "";
    return Number(cleaned).toLocaleString("de-DE");
  };

  const formatPrice = (input) => {
    const formatted = formatNumber(input);
    return formatted ? `${formatted} EUR` : "Preis auf Anfrage";
  };

  const formatKm = (input) => {
    const formatted = formatNumber(input);
    return formatted || "—";
  };

  const formatText = (input, fallback) => {
    const v = String(input || "").trim();
    return v || fallback;
  };

  const updateHighlights = () => {
    if (!highlightsList) return;
    const raw = String(highlightsInput?.value || "");
    const lines = raw
      .split(/\n|,/)
      .map((l) => l.trim())
      .filter(Boolean);
    const list = lines.length ? lines.slice(0, 3) : defaultHighlights;
    highlightsList.innerHTML = list.map((item) => `<li>${item}</li>`).join("");
  };

  const updateQr = () => {
    if (!qrImage) return;
    const raw = String(qrInput?.value || "").trim();
    const url = raw || defaultQr;
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(url)}`;
  };

  const updatePreview = () => {
    const title = formatText(titleInput?.value, "Audi Q5 2.0 TDI");
    const price = formatPrice(priceInput?.value);
    const year = formatText(yearInput?.value, "2016");
    const power = formatText(powerInput?.value, "190");
    const km = formatKm(kmInput?.value) || "120.000";

    if (titleEl) titleEl.textContent = title;
    if (backTitleEl) backTitleEl.textContent = title;
    if (priceEl) priceEl.textContent = price;
    if (backPriceEl) backPriceEl.textContent = price;

    if (specYearEl) specYearEl.textContent = year;
    if (specPowerEl) specPowerEl.textContent = power;
    if (specKmEl) specKmEl.textContent = km;

    if (dealerEl) dealerEl.textContent = formatText(dealerInput?.value, "Autohaus Muster GmbH");
    if (locationEl) locationEl.textContent = formatText(locationInput?.value, "Dortmund");
    if (phoneEl) phoneEl.textContent = formatText(phoneInput?.value, "0231 123456");
    if (websiteEl) websiteEl.textContent = formatText(websiteInput?.value, "autovisa.de");
    if (ctaEl) ctaEl.textContent = formatText(ctaInput?.value, "Jetzt Probefahrt sichern");

    updateHighlights();
    updateQr();
  };

  if (imageInput && carImage) {
    imageInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        carImage.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  [
    titleInput,
    priceInput,
    yearInput,
    powerInput,
    kmInput,
    highlightsInput,
    dealerInput,
    locationInput,
    phoneInput,
    websiteInput,
    ctaInput,
    qrInput
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", updatePreview);
  });

  updatePreview();

  async function waitForImage(img) {
    if (!img) return;
    if (img.complete && img.naturalWidth) return;
    await new Promise((resolve) => img.addEventListener("load", resolve, { once: true }));
  }

  async function exportSide(el, filename) {
    if (!el || !window.html2canvas) {
      alert("Export nicht moeglich: html2canvas fehlt.");
      return;
    }

    document.body.classList.add("is-exporting");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    await waitForImage(carImage);
    await waitForImage(qrImage);

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const rect = el.getBoundingClientRect();
    const targetWidth = 2480; // A5 quer bei 300 dpi
    let scale = rect.width ? targetWidth / rect.width : 3;
    scale = Math.max(2, Math.min(6, scale));

    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        backgroundColor: null,
        scale
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      console.error("Export-Fehler:", err);
      alert("Das Bild konnte nicht generiert werden. Bitte erneut versuchen.");
    } finally {
      document.body.classList.remove("is-exporting");
    }
  }

  frontBtn?.addEventListener("click", () => exportSide($("smFront"), "selfmailer-front.png"));
  backBtn?.addEventListener("click", () => exportSide($("smBack"), "selfmailer-back.png"));
});
