document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search || "");
  let id = params.get("id") || params.get("inserat") || params.get("listing") || "";

  if (!id) {
    try {
      const raw = localStorage.getItem("ausgewaehltesInserat");
      if (raw) {
        const doc = JSON.parse(raw);
        id = (doc._id && (doc._id.$oid || doc._id)) || doc.id || "";
      }
    } catch {}
  }

  $("printDate").textContent = new Date().toLocaleDateString("de-DE");
  if (id) $("printListingId").textContent = `Inserat-ID: ${id}`;

  const shareUrl = id ? `${window.location.origin}/anzeige.html?id=${encodeURIComponent(id)}` : window.location.origin;
  $("printUrl").textContent = shareUrl;
  $("printQr").src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(shareUrl)}`;

  $("printBtn")?.addEventListener("click", () => window.print());
  $("closeBtn")?.addEventListener("click", () => window.close());

  if (!id) {
    $("printTitle").textContent = "Inserat nicht gefunden";
    return;
  }

  const res = await fetch(`/inserat-details/${encodeURIComponent(id)}`, { credentials: "include" });
  if (!res.ok) {
    $("printTitle").textContent = "Inserat konnte nicht geladen werden";
    return;
  }
  const inserat = await res.json();

  const pick = (...vals) => {
    for (const v of vals) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return "";
  };

  const truncateText = (text, maxChars) => {
    const raw = String(text || "").trim();
    if (!raw || raw.length <= maxChars) return raw;
    let cut = raw.slice(0, maxChars);
    cut = cut.replace(/\s+\S*$/, "");
    return `${cut}… (mehr online)`;
  };

  const toNum = (v) => {
    if (v === null || v === undefined || v === "") return NaN;
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    let s = String(v).trim();
    if (!s) return NaN;
    s = s.replace(/[\u202F\u00A0\s]/g, "").replace(/[€]/g, "");
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      const decPos = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
      const intPart = s.slice(0, decPos).replace(/[.,]/g, "");
      const fracPart = s.slice(decPos + 1).replace(/[.,]/g, "");
      s = `${intPart}.${fracPart}`;
    } else if (hasComma || hasDot) {
      const sep = hasComma ? "," : ".";
      const parts = s.split(sep);
      if (parts.length === 2) {
        const frac = parts[1];
        if (/^\d{1,2}$/.test(frac)) s = parts[0].replace(/[.,]/g, "") + "." + frac;
        else s = s.replace(/[.,]/g, "");
      } else {
        s = s.replace(/[.,]/g, "");
      }
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const fmtEUR = (n) => Number(n).toLocaleString("de-DE") + " €";
  const fmtInt = (n) => Number(n).toLocaleString("de-DE");

  const brand = pick(inserat.verkauf_marke, inserat.marke, inserat.brand, inserat.make);
  const model = pick(inserat.verkauf_modell, inserat.modell, inserat.model);
  const variant = pick(
    inserat.verkauf_variante,
    inserat.variante,
    inserat.verkauf_ausstattung_variante,
    inserat.modellvariante
  );
  const title = pick(inserat.titel, [brand, model].filter(Boolean).join(" "));
  $("printTitle").textContent = title || "—";
  $("printSubtitle").textContent = variant || "";
  $("printSubtitle").style.display = variant ? "" : "none";

  const mwstRaw = String(inserat.verkauf_mwst || inserat.mwst || inserat.mwst_type || "").toLowerCase();
  let priceNote = "";
  if (/keine|nicht/.test(mwstRaw)) priceNote = "Endpreis";
  else if (/zzgl/.test(mwstRaw)) priceNote = "zzgl. MwSt.";
  else if (/inkl|mwst|ust|vat/.test(mwstRaw)) priceNote = "inkl. MwSt.";

  const priceNum = [
    inserat.verkauf_brutto, inserat.brutto_preis, inserat["brutto-preis"],
    inserat.verkauf_preis, inserat.preis, inserat.price, inserat.price_eur, inserat.priceEUR,
    inserat.verkauf_netto, inserat.netto_preis, inserat["netto-preis"]
  ].map(toNum).find((n) => Number.isFinite(n));

  $("printPrice").textContent = Number.isFinite(priceNum) ? fmtEUR(priceNum) : "Preis auf Anfrage";
  $("printPriceNote").textContent = priceNote || "";

  const imgs = []
    .concat(inserat.images || [])
    .concat(inserat.fotos || [])
    .concat((inserat.media || []).map((m) => m?.url || m))
    .filter(Boolean);
  if (imgs.length) {
    $("printImage").src = imgs[0];
  } else {
    $("printImageWrap").style.display = "none";
  }

  const specs = [];
  const ez = pick(inserat.erstzulassung, inserat.verkauf_erstzulassung);
  if (ez) specs.push(["Erstzulassung", ez]);
  const km = toNum(inserat.verkauf_kilometer ?? inserat.kilometer ?? inserat.km);
  if (Number.isFinite(km)) specs.push(["Kilometer", `${fmtInt(km)} km`]);
  const ps = toNum(inserat.verkauf_leistung ?? inserat.leistung ?? inserat.ps);
  if (Number.isFinite(ps)) specs.push(["Leistung", `${fmtInt(ps)} PS`]);
  const fuel = pick(inserat.verkauf_kraftstoff, inserat.kraftstoff, inserat.kraftstoffart);
  if (fuel) specs.push(["Kraftstoff", fuel]);
  const gear = pick(inserat.verkauf_getriebe, inserat.getriebe, inserat.getriebeart);
  if (gear) specs.push(["Getriebe", gear]);
  const ccm = toNum(inserat.verkauf_hubraum ?? inserat.hubraum ?? inserat.ccm);
  if (Number.isFinite(ccm)) specs.push(["Hubraum", `${fmtInt(ccm)} cm³`]);
  const color = pick(inserat.farbe, inserat.aussenfarbe, inserat.außenfarbe, inserat.karosseriefarbe);
  if (color) specs.push(["Farbe", color]);
  const doors = pick(inserat.tueren, inserat["türen"], inserat.anzahl_tueren, inserat.anzahl_türen);
  if (doors) specs.push(["Türen", doors]);
  const seats = pick(inserat.sitze, inserat.sitzplaetze, inserat.sitzplätze);
  if (seats) specs.push(["Sitze", seats]);
  const hu = pick(inserat.hu, inserat.verkauf_hu, inserat.hu_bis, inserat.verkauf_hu_bis);
  if (hu) specs.push(["HU", hu]);

  $("printSpecs").innerHTML = `<div class="specs-grid">
    ${specs.map(([label, value]) => `
      <div class="spec">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      </div>
    `).join("")}
  </div>`;

  const desc = pick(
    inserat.beschreibung,
    inserat.verkauf_beschreibung,
    inserat.beschreibung_lang,
    inserat.beschreibung_long
  );
  if (desc) {
    $("printDescription").textContent = truncateText(desc, 700);
  } else {
    $("printDescriptionSection").style.display = "none";
  }

  const equip = []
    .concat(inserat.ausstattung || [])
    .concat(inserat.verkauf_ausstattung || [])
    .concat(inserat.equipment_keys || [])
    .concat(inserat.equipment_text || [])
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  const uniqueEquip = Array.from(new Set(equip));
  if (uniqueEquip.length) {
    const maxEquip = 26;
    const list = uniqueEquip.slice(0, maxEquip).map((e) => `<li>${e}</li>`).join("");
    const rest = uniqueEquip.length > maxEquip ? `<li>+ ${uniqueEquip.length - maxEquip} weitere online</li>` : "";
    $("printFeatures").innerHTML = `<ul class="features-list">${list}${rest}</ul>`;
  } else {
    $("printFeaturesSection").style.display = "none";
  }

  const seller = inserat.seller || {};
  const isDealer = String(seller.type || "").toLowerCase().includes("haend");
  const sellerName = pick(seller.firma, seller.name, inserat.verkauf_name, isDealer ? "Händler" : "Privatanbieter");
  const addr = [
    [seller.strasse, seller.hausnummer].filter(Boolean).join(" "),
    [seller.plz, seller.ort].filter(Boolean).join(" "),
    seller.land
  ].filter(Boolean).join(", ");
  const phone = pick(seller.telefon, seller.telefon2, inserat.telefon);
  const web = pick(seller.website, seller.webseite);

  const sellerLines = [
    `<p><strong>${sellerName}</strong></p>`,
    addr ? `<p>${addr}</p>` : "",
    phone ? `<p>Telefon: ${phone}</p>` : "",
    web ? `<p>Web: ${web}</p>` : ""
  ].filter(Boolean).join("");
  $("printSeller").innerHTML = sellerLines || "<p>Privatanbieter</p>";
});
