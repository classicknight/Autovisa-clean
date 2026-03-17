// dokumente.js
// Minimaler Dokumenten-Builder fuer Autovisa

(function () {
  document.documentElement.classList.remove("no-js");

  const byId = (id) => document.getElementById(id);
  const formEl = byId("docsForm");

  const elements = {
    docType: byId("docType"),
    docNumber: byId("docNumber"),
    docDate: byId("docDate"),
    deliveryDate: byId("deliveryDate"),
    taxCase: byId("taxCase"),
    sellerCompany: byId("sellerCompany"),
    sellerName: byId("sellerName"),
    sellerStreet: byId("sellerStreet"),
    sellerHouse: byId("sellerHouse"),
    sellerZip: byId("sellerZip"),
    sellerCity: byId("sellerCity"),
    sellerCountry: byId("sellerCountry"),
    sellerTaxNumber: byId("sellerTaxNumber"),
    sellerVatId: byId("sellerVatId"),
    sellerEmail: byId("sellerEmail"),
    sellerPhone: byId("sellerPhone"),
    buyerType: byId("buyerType"),
    buyerCompany: byId("buyerCompany"),
    buyerName: byId("buyerName"),
    buyerStreet: byId("buyerStreet"),
    buyerHouse: byId("buyerHouse"),
    buyerZip: byId("buyerZip"),
    buyerCity: byId("buyerCity"),
    buyerCountry: byId("buyerCountry"),
    buyerVatId: byId("buyerVatId"),
    buyerEmail: byId("buyerEmail"),
    vehicleBrand: byId("vehicleBrand"),
    vehicleModel: byId("vehicleModel"),
    vehicleVariant: byId("vehicleVariant"),
    vehicleVin: byId("vehicleVin"),
    vehicleFirstReg: byId("vehicleFirstReg"),
    vehicleMileage: byId("vehicleMileage"),
    vehicleFuel: byId("vehicleFuel"),
    vehiclePower: byId("vehiclePower"),
    vehicleColor: byId("vehicleColor"),
    priceGross: byId("priceGross"),
    vatRate: byId("vatRate"),
    priceDeposit: byId("priceDeposit"),
    accessories: byId("accessories"),
    notes: byId("notes"),
    preview: byId("docPreview"),
    listingTitle: byId("docListingTitle"),
    backBtn: byId("backToOverview"),
    saveBtn: byId("saveDoc"),
    printBtn: byId("printDoc"),
    savedDocsBtn: byId("loadSavedDocs"),
    savedDocsModal: byId("savedDocsModal"),
    closeSavedDocs: byId("closeSavedDocs"),
    savedDocsList: byId("savedDocsList")
  };

  const state = {
    listingId: "",
    listingTitle: "",
    seller: {
      name: "",
      company: "",
      street: "",
      house: "",
      zip: "",
      city: "",
      country: "",
      email: "",
      phone: "",
      vatId: "",
      taxNumber: ""
    },
    docId: null
  };

  const DOC_LABELS = {
    invoice: "Rechnung",
    proforma: "Proforma / Anzahlung",
    credit: "Gutschrift",
    contract: "Kaufvertrag",
    delivery: "Uebergabeprotokoll"
  };

  const DOC_PREFIX = {
    invoice: "RE",
    proforma: "PF",
    credit: "GS",
    contract: "KV",
    delivery: "UE"
  };

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNumberLoose(value) {
    const s = String(value ?? "").replace(/\./g, "").replace(/,/g, ".").replace(/\s+/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function todayIso() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function autoDocNumber(type) {
    const prefix = DOC_PREFIX[type] || "DOC";
    const now = new Date();
    const y = now.getFullYear();
    const tail = String(now.getTime()).slice(-4);
    return `${prefix}-${y}-${tail}`;
  }

  function buildSellerBlock(payload) {
    const lines = [
      payload.sellerCompany || payload.sellerName,
      payload.sellerCompany ? payload.sellerName : "",
      [payload.sellerStreet, payload.sellerHouse].filter(Boolean).join(" "),
      [payload.sellerZip, payload.sellerCity].filter(Boolean).join(" "),
      payload.sellerCountry || "Deutschland",
      payload.sellerTaxNumber ? `Steuernr.: ${payload.sellerTaxNumber}` : "",
      payload.sellerVatId ? `USt-IdNr.: ${payload.sellerVatId}` : "",
      payload.sellerEmail ? `E-Mail: ${payload.sellerEmail}` : "",
      payload.sellerPhone ? `Tel.: ${payload.sellerPhone}` : ""
    ].filter(Boolean);
    return lines.map(escapeHTML).join("<br>");
  }

  function buildBuyerBlock(payload) {
    const lines = [
      payload.buyerCompany || payload.buyerName,
      payload.buyerCompany ? payload.buyerName : "",
      [payload.buyerStreet, payload.buyerHouse].filter(Boolean).join(" "),
      [payload.buyerZip, payload.buyerCity].filter(Boolean).join(" "),
      payload.buyerCountry || "Deutschland",
      payload.buyerVatId ? `USt-IdNr.: ${payload.buyerVatId}` : "",
      payload.buyerEmail ? `E-Mail: ${payload.buyerEmail}` : ""
    ].filter(Boolean);
    return lines.map(escapeHTML).join("<br>");
  }

  function buildVehicleRow(payload) {
    const title = [payload.vehicleBrand, payload.vehicleModel, payload.vehicleVariant]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      title: title || "Fahrzeug",
      vin: payload.vehicleVin,
      firstReg: payload.vehicleFirstReg,
      mileage: payload.vehicleMileage,
      fuel: payload.vehicleFuel,
      power: payload.vehiclePower,
      color: payload.vehicleColor
    };
  }

  function buildTaxNote(taxCase) {
    if (taxCase === "differenz") {
      return "Differenzbesteuerung nach §25a UStG. Umsatzsteuer nicht ausweisbar.";
    }
    if (taxCase === "reverse") {
      return "Steuerschuldnerschaft des Leistungsempfaengers (§13b UStG).";
    }
    if (taxCase === "igl") {
      return "Steuerfreie innergemeinschaftliche Lieferung.";
    }
    if (taxCase === "export") {
      return "Steuerfreie Ausfuhrlieferung.";
    }
    return "";
  }

  function buildInvoiceHtml(payload) {
    const docTitle = DOC_LABELS[payload.docType] || "Dokument";
    const vehicle = buildVehicleRow(payload);

    const gross = toNumberLoose(payload.priceGross);
    const vatRate = toNumberLoose(payload.vatRate);
    const taxCase = payload.taxCase;
    let net = gross;
    let vat = 0;

    if (taxCase === "standard" && Number.isFinite(gross) && Number.isFinite(vatRate)) {
      net = gross / (1 + vatRate / 100);
      vat = gross - net;
    }

    const sign = payload.docType === "credit" ? -1 : 1;

    const taxNote = buildTaxNote(taxCase);
    const sellerBlock = buildSellerBlock(payload);
    const buyerBlock = buildBuyerBlock(payload);

    const dateLabel = payload.docDate || "";
    const deliveryLabel = payload.deliveryDate || "";

    const priceLine = Number.isFinite(gross) ? formatMoney(gross * sign) : "";
    const netLine = Number.isFinite(net) ? formatMoney(net * sign) : "";
    const vatLine = Number.isFinite(vat) ? formatMoney(vat * sign) : "";

    const deposit = toNumberLoose(payload.priceDeposit);
    const depositLine = Number.isFinite(deposit) && deposit > 0 ? formatMoney(deposit * sign) : "";
    const remainingLine = (Number.isFinite(gross) && Number.isFinite(deposit) && deposit > 0)
      ? formatMoney((gross - deposit) * sign)
      : "";

    return `
      <div class="doc">
        <div class="doc-grid">
          <div>
            <strong>Verkaeufer</strong><br>
            ${sellerBlock}
          </div>
          <div>
            <strong>Kaeufer</strong><br>
            ${buyerBlock || "–"}
          </div>
        </div>
        <h2>${escapeHTML(docTitle)}</h2>
        <div class="doc-grid">
          <div>Dokumentnummer: ${escapeHTML(payload.docNumber || "-")}</div>
          <div>Datum: ${escapeHTML(dateLabel || "-")}</div>
          <div>Leistungsdatum: ${escapeHTML(deliveryLabel || "-")}</div>
          <div>Steuerfall: ${escapeHTML(payload.taxCase || "-")}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Beschreibung</th>
              <th>Betrag</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                ${escapeHTML(vehicle.title)}<br>
                ${vehicle.vin ? `FIN/VIN: ${escapeHTML(vehicle.vin)}<br>` : ""}
                ${vehicle.firstReg ? `EZ: ${escapeHTML(vehicle.firstReg)}<br>` : ""}
                ${vehicle.mileage ? `KM: ${escapeHTML(vehicle.mileage)}<br>` : ""}
                ${vehicle.fuel ? `Kraftstoff: ${escapeHTML(vehicle.fuel)}<br>` : ""}
                ${vehicle.power ? `Leistung: ${escapeHTML(vehicle.power)} PS<br>` : ""}
                ${vehicle.color ? `Farbe: ${escapeHTML(vehicle.color)}` : ""}
              </td>
              <td>${priceLine ? `${priceLine} €` : ""}</td>
            </tr>
          </tbody>
        </table>

        ${taxCase === "standard" ? `
          <table>
            <tbody>
              <tr><td>Netto</td><td>${netLine} €</td></tr>
              <tr><td>MwSt (${escapeHTML(String(payload.vatRate || ""))} %)</td><td>${vatLine} €</td></tr>
              <tr><td><strong>Brutto</strong></td><td><strong>${priceLine} €</strong></td></tr>
            </tbody>
          </table>
        ` : `
          <div class="doc-note"><strong>Gesamtbetrag:</strong> ${priceLine ? `${priceLine} €` : ""}</div>
        `}

        ${depositLine ? `
          <div class="doc-note">Anzahlung: ${depositLine} €${remainingLine ? ` · Restbetrag: ${remainingLine} €` : ""}</div>
        ` : ""}

        ${taxNote ? `<p class="doc-note">${escapeHTML(taxNote)}</p>` : ""}
        ${payload.notes ? `<p class="doc-note">${escapeHTML(payload.notes)}</p>` : ""}
      </div>
    `;
  }

  function buildContractHtml(payload) {
    const vehicle = buildVehicleRow(payload);
    const sellerBlock = buildSellerBlock(payload);
    const buyerBlock = buildBuyerBlock(payload);
    return `
      <div class="doc">
        <h2>Kaufvertrag</h2>
        <div class="doc-grid">
          <div>
            <strong>Verkaeufer</strong><br>
            ${sellerBlock}
          </div>
          <div>
            <strong>Kaeufer</strong><br>
            ${buyerBlock || "–"}
          </div>
        </div>
        <div class="doc-grid">
          <div>Vertragsnummer: ${escapeHTML(payload.docNumber || "-")}</div>
          <div>Datum: ${escapeHTML(payload.docDate || "-")}</div>
        </div>
        <table>
          <tbody>
            <tr><td>Fahrzeug</td><td>${escapeHTML(vehicle.title)}</td></tr>
            ${vehicle.vin ? `<tr><td>FIN/VIN</td><td>${escapeHTML(vehicle.vin)}</td></tr>` : ""}
            ${vehicle.firstReg ? `<tr><td>Erstzulassung</td><td>${escapeHTML(vehicle.firstReg)}</td></tr>` : ""}
            ${vehicle.mileage ? `<tr><td>Kilometer</td><td>${escapeHTML(vehicle.mileage)}</td></tr>` : ""}
            ${vehicle.fuel ? `<tr><td>Kraftstoff</td><td>${escapeHTML(vehicle.fuel)}</td></tr>` : ""}
            ${vehicle.power ? `<tr><td>Leistung</td><td>${escapeHTML(vehicle.power)} PS</td></tr>` : ""}
            ${vehicle.color ? `<tr><td>Farbe</td><td>${escapeHTML(vehicle.color)}</td></tr>` : ""}
          </tbody>
        </table>
        <p><strong>Kaufpreis:</strong> ${escapeHTML(payload.priceGross || "-")} €</p>
        ${payload.notes ? `<p class="doc-note">${escapeHTML(payload.notes)}</p>` : ""}
        <div class="doc-signatures">
          <div>
            <div class="sig-line">Unterschrift Verkaeufer</div>
          </div>
          <div>
            <div class="sig-line">Unterschrift Kaeufer</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildDeliveryHtml(payload) {
    const vehicle = buildVehicleRow(payload);
    const sellerBlock = buildSellerBlock(payload);
    const buyerBlock = buildBuyerBlock(payload);
    return `
      <div class="doc">
        <h2>Uebergabeprotokoll</h2>
        <div class="doc-grid">
          <div>
            <strong>Verkaeufer</strong><br>
            ${sellerBlock}
          </div>
          <div>
            <strong>Kaeufer</strong><br>
            ${buyerBlock || "–"}
          </div>
        </div>
        <div class="doc-grid">
          <div>Dokumentnummer: ${escapeHTML(payload.docNumber || "-")}</div>
          <div>Uebergabedatum: ${escapeHTML(payload.deliveryDate || payload.docDate || "-")}</div>
        </div>
        <table>
          <tbody>
            <tr><td>Fahrzeug</td><td>${escapeHTML(vehicle.title)}</td></tr>
            ${vehicle.vin ? `<tr><td>FIN/VIN</td><td>${escapeHTML(vehicle.vin)}</td></tr>` : ""}
            ${vehicle.firstReg ? `<tr><td>Erstzulassung</td><td>${escapeHTML(vehicle.firstReg)}</td></tr>` : ""}
            ${vehicle.mileage ? `<tr><td>Kilometer</td><td>${escapeHTML(vehicle.mileage)}</td></tr>` : ""}
          </tbody>
        </table>
        <p><strong>Zubehoer / Umfang:</strong> ${escapeHTML(payload.accessories || "-")}</p>
        ${payload.notes ? `<p class="doc-note">${escapeHTML(payload.notes)}</p>` : ""}
        <div class="doc-signatures">
          <div>
            <div class="sig-line">Unterschrift Verkaeufer</div>
          </div>
          <div>
            <div class="sig-line">Unterschrift Kaeufer</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildPreview(payload) {
    if (payload.docType === "contract") return buildContractHtml(payload);
    if (payload.docType === "delivery") return buildDeliveryHtml(payload);
    return buildInvoiceHtml(payload);
  }

  function collectFormPayload() {
    return {
      docType: elements.docType?.value || "invoice",
      docNumber: elements.docNumber?.value || "",
      docDate: elements.docDate?.value || "",
      deliveryDate: elements.deliveryDate?.value || "",
      taxCase: elements.taxCase?.value || "standard",
      sellerCompany: elements.sellerCompany?.value || "",
      sellerName: elements.sellerName?.value || "",
      sellerStreet: elements.sellerStreet?.value || "",
      sellerHouse: elements.sellerHouse?.value || "",
      sellerZip: elements.sellerZip?.value || "",
      sellerCity: elements.sellerCity?.value || "",
      sellerCountry: elements.sellerCountry?.value || "",
      sellerTaxNumber: elements.sellerTaxNumber?.value || "",
      sellerVatId: elements.sellerVatId?.value || "",
      sellerEmail: elements.sellerEmail?.value || "",
      sellerPhone: elements.sellerPhone?.value || "",
      buyerType: elements.buyerType?.value || "b2c",
      buyerCompany: elements.buyerCompany?.value || "",
      buyerName: elements.buyerName?.value || "",
      buyerStreet: elements.buyerStreet?.value || "",
      buyerHouse: elements.buyerHouse?.value || "",
      buyerZip: elements.buyerZip?.value || "",
      buyerCity: elements.buyerCity?.value || "",
      buyerCountry: elements.buyerCountry?.value || "",
      buyerVatId: elements.buyerVatId?.value || "",
      buyerEmail: elements.buyerEmail?.value || "",
      vehicleBrand: elements.vehicleBrand?.value || "",
      vehicleModel: elements.vehicleModel?.value || "",
      vehicleVariant: elements.vehicleVariant?.value || "",
      vehicleVin: elements.vehicleVin?.value || "",
      vehicleFirstReg: elements.vehicleFirstReg?.value || "",
      vehicleMileage: elements.vehicleMileage?.value || "",
      vehicleFuel: elements.vehicleFuel?.value || "",
      vehiclePower: elements.vehiclePower?.value || "",
      vehicleColor: elements.vehicleColor?.value || "",
      priceGross: elements.priceGross?.value || "",
      vatRate: elements.vatRate?.value || "",
      priceDeposit: elements.priceDeposit?.value || "",
      accessories: elements.accessories?.value || "",
      notes: elements.notes?.value || ""
    };
  }

  function updatePreview() {
    if (!elements.preview) return;
    const payload = collectFormPayload();
    const html = buildPreview(payload);
    elements.preview.innerHTML = html;
  }

  function setIfEmpty(el, value) {
    if (!el) return;
    if (!String(el.value || "").trim() && value) {
      el.value = value;
    }
  }

  function normalizeListingTitle(inserat) {
    const title = inserat?.titel || inserat?.title || "";
    const brand = inserat?.marke || inserat?.verkauf_marke || "";
    const model = inserat?.modell || inserat?.verkauf_modell || "";
    return title || [brand, model].filter(Boolean).join(" ").trim();
  }

  function prefillFromInserat(inserat) {
    if (!inserat) return;
    const title = normalizeListingTitle(inserat);
    state.listingTitle = title || state.listingTitle;
    if (elements.listingTitle && title) elements.listingTitle.textContent = title;

    const pick = (...vals) => vals.find(v => v != null && String(v).trim() !== "") || "";
    const ez = pick(inserat.verkauf_erstzulassung, inserat.erstzulassung);

    setIfEmpty(elements.vehicleBrand, pick(inserat.marke, inserat.verkauf_marke));
    setIfEmpty(elements.vehicleModel, pick(inserat.modell, inserat.verkauf_modell));
    setIfEmpty(elements.vehicleVariant, pick(inserat.modellausfuehrung, inserat.modellvariante, inserat.verkauf_modellvariante));
    setIfEmpty(elements.vehicleVin, pick(inserat.verkauf_vin, inserat.vin, inserat.fahrgestellnummer));
    setIfEmpty(elements.vehicleFirstReg, ez);
    setIfEmpty(elements.vehicleMileage, pick(inserat.verkauf_kilometer, inserat.kilometer, inserat.km));
    setIfEmpty(elements.vehicleFuel, pick(inserat.verkauf_kraftstoff, inserat.kraftstoff));
    setIfEmpty(elements.vehiclePower, pick(inserat.verkauf_leistung, inserat.leistung, inserat.ps));
    setIfEmpty(elements.vehicleColor, pick(inserat.karosseriefarbe, inserat.farbe, inserat.außenfarbe, inserat.aussenfarbe));

    const price = pick(
      inserat.verkauf_preis,
      inserat.preis,
      inserat["brutto-preis"],
      inserat.brutto_preis,
      inserat.verkauf_brutto
    );
    setIfEmpty(elements.priceGross, price);
  }

  async function fetchListingForDocs(listingId) {
    if (!listingId) return null;
    try {
      const res = await fetch(`/api/inserat/${encodeURIComponent(listingId)}/edit-data`, {
        credentials: "include"
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.ok) return null;
      return { ...data.fahrzeugdaten, ...data.fahrzeugdetails, _id: data.inseratId };
    } catch {
      return null;
    }
  }

  async function fetchSellerInfo() {
    try {
      const res = await fetch("/getNutzerInfo", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.eingeloggt) return;
      state.seller = {
        name: data.name || "",
        company: data.firma || "",
        street: data.strasse || "",
        house: data.hausnummer || "",
        zip: data.plz || "",
        city: data.ort || "",
        country: data.land || "",
        email: data.email || "",
        phone: data.telefon || "",
        vatId: data.ustid || data.ust_id || "",
        taxNumber: data.steuernummer || ""
      };

      setIfEmpty(elements.sellerCompany, state.seller.company);
      setIfEmpty(elements.sellerName, state.seller.name);
      setIfEmpty(elements.sellerStreet, state.seller.street);
      setIfEmpty(elements.sellerHouse, state.seller.house);
      setIfEmpty(elements.sellerZip, state.seller.zip);
      setIfEmpty(elements.sellerCity, state.seller.city);
      setIfEmpty(elements.sellerCountry, state.seller.country || "Deutschland");
      setIfEmpty(elements.sellerVatId, state.seller.vatId);
      setIfEmpty(elements.sellerTaxNumber, state.seller.taxNumber);
      setIfEmpty(elements.sellerEmail, state.seller.email);
      setIfEmpty(elements.sellerPhone, state.seller.phone);
    } catch {}
  }

  function toggleBuyerFields() {
    const isB2B = elements.buyerType?.value === "b2b";
    if (elements.buyerCompany) elements.buyerCompany.disabled = !isB2B;
    if (elements.buyerVatId) elements.buyerVatId.disabled = !isB2B;
  }

  function initDefaults() {
    if (elements.docDate) elements.docDate.value = todayIso();
    if (elements.deliveryDate) elements.deliveryDate.value = todayIso();
    if (elements.buyerCountry) elements.buyerCountry.value = "Deutschland";
    if (elements.sellerCountry) elements.sellerCountry.value = "Deutschland";
    if (elements.docNumber && !elements.docNumber.value) {
      elements.docNumber.value = autoDocNumber(elements.docType?.value || "invoice");
    }
  }

  async function openSavedDocsModal() {
    if (!elements.savedDocsModal) return;
    await refreshSavedDocs();
    elements.savedDocsModal.classList.add("show");
    elements.savedDocsModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeSavedDocsModal() {
    if (!elements.savedDocsModal) return;
    elements.savedDocsModal.classList.remove("show");
    elements.savedDocsModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function renderSavedDocs(list) {
    if (!elements.savedDocsList) return;
    if (!Array.isArray(list) || !list.length) {
      elements.savedDocsList.innerHTML = '<p class="muted">Noch keine Dokumente gespeichert.</p>';
      return;
    }
    elements.savedDocsList.innerHTML = "";
    list.forEach((doc) => {
      const item = document.createElement("div");
      item.className = "saved-docs-item";
      const label = DOC_LABELS[doc.type] || doc.type || "Dokument";
      const date = doc.docDate || (doc.createdAt ? String(doc.createdAt).slice(0, 10) : "");
      item.innerHTML = `
        <div>
          <strong>${escapeHTML(label)}</strong><br>
          <span class="meta">${escapeHTML(doc.docNumber || "")} ${date ? `· ${escapeHTML(date)}` : ""}</span>
        </div>
        <button class="btn-soft" type="button" data-doc-id="${escapeHTML(doc._id || "")}">Laden</button>
      `;
      const btn = item.querySelector("button");
      btn?.addEventListener("click", async () => {
        await loadDocument(doc._id);
        closeSavedDocsModal();
      });
      elements.savedDocsList.appendChild(item);
    });
  }

  async function refreshSavedDocs() {
    if (!state.listingId) return;
    try {
      const res = await fetch(`/api/documents?listingId=${encodeURIComponent(state.listingId)}`, {
        credentials: "include"
      });
      if (!res.ok) return;
      const data = await res.json();
      renderSavedDocs(data?.documents || []);
    } catch {}
  }

  async function loadDocument(docId) {
    if (!docId) return;
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        credentials: "include"
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.doc) return;
      const payload = data.doc.payload || {};
      state.docId = data.doc._id || null;

      Object.entries(payload).forEach(([key, value]) => {
        const el = elements[key];
        if (el) el.value = value;
      });

      if (elements.docType) elements.docType.value = payload.docType || "invoice";
      toggleBuyerFields();
      updatePreview();
    } catch {}
  }

  async function saveDocument() {
    if (!state.listingId) return alert("Inserat fehlt.");
    const payload = collectFormPayload();
    if (!payload.docNumber) {
      payload.docNumber = autoDocNumber(payload.docType);
      elements.docNumber.value = payload.docNumber;
    }

    const html = buildPreview(payload);
    const body = {
      listingId: state.listingId,
      type: payload.docType,
      docNumber: payload.docNumber,
      docDate: payload.docDate,
      payload,
      html,
      id: state.docId || null
    };

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Fehler beim Speichern.");
        return;
      }
      state.docId = data.id || state.docId;
      alert("Dokument gespeichert.");
    } catch {
      alert("Netzwerkfehler beim Speichern.");
    }
  }

  function printDocument() {
    const payload = collectFormPayload();
    const html = buildPreview(payload);
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${escapeHTML(DOC_LABELS[payload.docType] || "Dokument")}</title>
          <style>
            body{ font-family: Arial, sans-serif; padding: 24px; color: #1a2a33; }
            h2{ margin: 0 0 12px; }
            table{ width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td{ border: 1px solid #dfe6ee; padding: 6px 8px; text-align: left; }
            .doc-grid{ display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
            .doc-note{ margin-top: 10px; color: #4c5965; }
            .doc-signatures{ margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
            .sig-line{ border-top: 1px solid #9aa6b2; padding-top: 6px; font-size: 12px; color: #6b7a88; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  function attachEvents() {
    if (!formEl) return;
    formEl.addEventListener("input", updatePreview);
    elements.docType?.addEventListener("change", () => {
      if (!elements.docNumber?.value) {
        elements.docNumber.value = autoDocNumber(elements.docType.value);
      }
      updatePreview();
    });
    elements.buyerType?.addEventListener("change", () => {
      toggleBuyerFields();
      updatePreview();
    });

    elements.saveBtn?.addEventListener("click", saveDocument);
    elements.printBtn?.addEventListener("click", printDocument);
    elements.backBtn?.addEventListener("click", () => {
      const back = localStorage.getItem("docReturnUrl") || "übersicht.html";
      window.location.href = back;
    });
    elements.savedDocsBtn?.addEventListener("click", openSavedDocsModal);
    elements.closeSavedDocs?.addEventListener("click", closeSavedDocsModal);
    elements.savedDocsModal?.querySelector("[data-close]")?.addEventListener("click", closeSavedDocsModal);
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.listingId = params.get("id") || localStorage.getItem("docListingId") || "";

    initDefaults();
    await fetchSellerInfo();

    const cached = (() => {
      try {
        const raw = localStorage.getItem("docInserat");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    if (cached && state.listingId) {
      const cachedId = String(cached._id || cached.id || cached.fahrzeugId || "").trim();
      if (!cachedId || cachedId === state.listingId) {
        prefillFromInserat(cached);
      }
    }

    if (!state.listingTitle && state.listingId) {
      const data = await fetchListingForDocs(state.listingId);
      if (data) prefillFromInserat(data);
    }

    if (elements.listingTitle && state.listingTitle) {
      elements.listingTitle.textContent = state.listingTitle;
    }

    toggleBuyerFields();
    updatePreview();
  }

  attachEvents();
  init();
})();
