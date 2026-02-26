document.addEventListener("DOMContentLoaded", () => {
  const dealerListEl = document.getElementById("dealerList");
  const dealerPagerEl = document.getElementById("dealerPager");
  const dealerMetaEl = document.getElementById("dealerMeta");
  const dealerSearchEl = document.getElementById("dealerSearch");
  const dealerSearchBtn = document.getElementById("dealerSearchBtn");
  const dealerIdInput = document.getElementById("dealerIdInput");
  const loadDealerBtn = document.getElementById("loadDealerBtn");
  const openSellerSearch = document.getElementById("openSellerSearch");
  const dealerProfileEl = document.getElementById("dealerProfile");
  const dealerListingsEl = document.getElementById("dealerListings");
  const refreshListingsBtn = document.getElementById("refreshListingsBtn");

  const listingIdInput = document.getElementById("listingIdInput");
  const loadListingBtn = document.getElementById("loadListingBtn");
  const listingDetailEl = document.getElementById("listingDetail");

  const statusEl = document.getElementById("adminStatus");

  const state = {
    dealers: { page: 1, limit: 20, total: 0, q: "" },
    currentDealerId: "",
    currentListingId: ""
  };

  const setStatus = (msg) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.add("show");
    clearTimeout(statusEl._t);
    statusEl._t = setTimeout(() => statusEl.classList.remove("show"), 2600);
  };

  const esc = (v) => String(v || "").replace(/[&<>"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[c]));

  const fmtDate = (d) => {
    if (!d) return "–";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "–";
    return date.toLocaleDateString("de-DE");
  };

  async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, { credentials: "include", ...opts });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ---------------- Händlerübersicht ----------------
  async function loadDealers(page = 1) {
    state.dealers.page = page;
    const q = state.dealers.q;
    dealerMetaEl.textContent = "Lade Händler…";
    dealerListEl.innerHTML = "";
    dealerPagerEl.innerHTML = "";

    try {
      const data = await fetchJSON(`/api/admin/haendler?q=${encodeURIComponent(q)}&page=${page}&limit=${state.dealers.limit}`);
      state.dealers.total = data.total || 0;
      dealerMetaEl.textContent = `${(data.total || 0).toLocaleString("de-DE")} Händler gefunden`;
      renderDealerList(data.results || []);
      renderPager(data.total || 0, page);
    } catch (e) {
      dealerMetaEl.textContent = "Fehler beim Laden der Händler.";
      setStatus("Händler konnten nicht geladen werden.");
    }
  }

  function renderDealerList(items) {
    if (!items.length) {
      dealerListEl.innerHTML = `<div class="empty-state">Keine Händler gefunden.</div>`;
      return;
    }

    dealerListEl.innerHTML = items.map((d) => {
      const name = d.firma || d.name || "Händler";
      const counts = d.listings || { total: 0, online: 0, sold: 0 };
      return `
        <div class="dealer-card" data-id="${esc(d.id)}">
          <div class="dealer-row">
            <div>
              <div class="dealer-name">${esc(name)}</div>
              <div class="dealer-id">ID: ${esc(d.id)} · ${esc(d.email || "—")}</div>
            </div>
            <div class="dealer-stats">
              <span class="stat-pill">Gesamt ${counts.total || 0}</span>
              <span class="stat-pill">Online ${counts.online || 0}</span>
              <span class="stat-pill">Verkauft ${counts.sold || 0}</span>
            </div>
          </div>
          <div class="dealer-actions">
            <button class="btn-ghost" data-action="select"><i class="fa-solid fa-eye"></i> Anzeigen</button>
          </div>
        </div>
      `;
    }).join("");

    dealerListEl.querySelectorAll(".dealer-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        const id = card.getAttribute("data-id");
        if (!id) return;
        if (e.target.closest("[data-action='select']") || e.currentTarget) {
          selectDealer(id);
        }
      });
    });
  }

  function renderPager(total, current) {
    const pages = Math.max(1, Math.ceil(total / state.dealers.limit));
    if (pages <= 1) return;
    const btn = (p) => `<button class="${p === current ? "active" : ""}" data-page="${p}">${p}</button>`;
    let html = "";
    const windowSize = 5;
    let start = Math.max(1, current - Math.floor(windowSize / 2));
    let end = Math.min(pages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) html += btn(1);
    for (let p = start; p <= end; p++) html += btn(p);
    if (end < pages) html += btn(pages);
    dealerPagerEl.innerHTML = html;
    dealerPagerEl.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => loadDealers(parseInt(b.dataset.page || "1", 10)));
    });
  }

  // ---------------- Händlerdetails ----------------
  async function selectDealer(id) {
    if (!id) return;
    state.currentDealerId = id;
    dealerIdInput.value = id;
    openSellerSearch.href = `suche.html?sellerId=${encodeURIComponent(id)}`;
    await loadDealerProfile(id);
    await loadDealerListings(id);
  }

  async function loadDealerProfile(id) {
    dealerProfileEl.innerHTML = `<div class="empty-state">Lade Händlerprofil…</div>`;
    try {
      const d = await fetchJSON(`/api/admin/user?id=${encodeURIComponent(id)}`);
      const name = d.firma || d.name || "Händler";
      const address = [d.strasse, d.hausnummer, d.plz, d.ort, d.land]
        .filter(Boolean)
        .join(" ");

      dealerProfileEl.innerHTML = `
        <div class="profile-grid">
          <div><strong>Name:</strong> <span>${esc(name)}</span></div>
          <div><strong>ID:</strong> <span>${esc(d.id)}</span></div>
          <div><strong>Rolle:</strong> <span>${esc(d.role)}</span></div>
          <div><strong>E-Mail:</strong> <span>${esc(d.email || "—")}</span></div>
          <div><strong>Telefon:</strong> <span>${esc(d.telefon || "—")}</span></div>
          <div><strong>Adresse:</strong> <span>${esc(address || "—")}</span></div>
          <div><strong>Website:</strong> <span>${esc(d.website || "—")}</span></div>
          <div><strong>Erstellt:</strong> <span>${fmtDate(d.createdAt)}</span></div>
          <div><strong>Verifiziert:</strong> <span>${d.verified ? "Ja" : "Nein"}</span></div>
        </div>
      `;
    } catch (e) {
      dealerProfileEl.innerHTML = `<div class="empty-state">Profil konnte nicht geladen werden.</div>`;
      setStatus("Händlerprofil konnte nicht geladen werden.");
    }
  }

  async function loadDealerListings(id) {
    dealerListingsEl.innerHTML = `<div class="empty-state">Lade Inserate…</div>`;
    try {
      const res = await fetch(`/api/search?sellerId=${encodeURIComponent(id)}&page=1&limit=50&sort=neueste`);
      if (!res.ok) throw new Error("search");
      const data = await res.json();
      const list = Array.isArray(data.results) ? data.results : [];
      if (!list.length) {
        dealerListingsEl.innerHTML = `<div class="empty-state">Keine Inserate gefunden.</div>`;
        return;
      }
      dealerListingsEl.innerHTML = list.map((item) => {
        const lid = item._id?.$oid || item._id || item.id || "";
        const title = item.titel || [item.marke, item.modell].filter(Boolean).join(" ");
        const price = item.preis || item.verkauf_preis || item.verkauf_brutto || item.brutto_preis || item["brutto-preis"] || "";
        const status = item.status || item.verkauf_status || "online";
        return `
          <div class="listing-card" data-id="${esc(lid)}">
            <div class="listing-title">${esc(title || "Inserat")}</div>
            <div class="listing-meta">
              <span>ID: ${esc(lid)}</span>
              <span>Preis: ${esc(price ? `${price} €` : "—")}</span>
              <span>Status: ${esc(status)}</span>
            </div>
            <div class="listing-actions">
              <button data-action="open">Anzeigen</button>
              <button data-action="sold">Verkauft</button>
              <button data-action="relist">Online</button>
              <button data-action="delete">Löschen</button>
            </div>
          </div>
        `;
      }).join("");

      dealerListingsEl.querySelectorAll(".listing-card").forEach((card) => {
        const id = card.getAttribute("data-id");
        card.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const action = btn.getAttribute("data-action");
            if (!id || !action) return;
            await handleListingAction(id, action);
          });
        });
      });
    } catch (e) {
      dealerListingsEl.innerHTML = `<div class="empty-state">Fehler beim Laden der Inserate.</div>`;
    }
  }

  async function handleListingAction(id, action) {
    if (action === "open") {
      window.open(`anzeige.html?id=${encodeURIComponent(id)}`, "_blank");
      return;
    }

    if (action === "delete") {
      const ok = confirm("Inserat wirklich löschen?");
      if (!ok) return;
    }

    const endpoint =
      action === "sold" ? `/inserat/${id}/sold` :
      action === "relist" ? `/inserat/${id}/relist` :
      action === "delete" ? `/inserat/${id}/delete` :
      "";
    if (!endpoint) return;

    try {
      await fetchJSON(endpoint, { method: "POST" });
      setStatus("Aktion erfolgreich.");
      if (state.currentDealerId) loadDealerListings(state.currentDealerId);
    } catch {
      setStatus("Aktion fehlgeschlagen.");
    }
  }

  // ---------------- Inserat-Tools ----------------
  async function loadListingById(id) {
    listingDetailEl.innerHTML = `<div class="empty-state">Lade Inserat…</div>`;
    try {
      const res = await fetch(`/inserat-details/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      const title = data?.titel || [data?.marke, data?.modell].filter(Boolean).join(" ");
      const price = data?.preis || data?.verkauf_preis || data?.verkauf_brutto || data?.brutto_preis || data?.["brutto-preis"] || "";
      const sellerId = data?.seller?.id || data?.verkaeuferId || data?.nutzerId || "";
      listingDetailEl.innerHTML = `
        <div class="listing-card" data-id="${esc(id)}">
          <div class="listing-title">${esc(title || "Inserat")}</div>
          <div class="listing-meta">
            <span>ID: ${esc(id)}</span>
            <span>Preis: ${esc(price ? `${price} €` : "—")}</span>
            <span>Händler: ${esc(sellerId || "—")}</span>
          </div>
          <div class="listing-actions">
            <button data-action="open">Anzeigen</button>
            <button data-action="sold">Verkauft</button>
            <button data-action="relist">Online</button>
            <button data-action="delete">Löschen</button>
          </div>
        </div>
      `;

      listingDetailEl.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const action = btn.getAttribute("data-action");
          await handleListingAction(id, action);
        });
      });
    } catch {
      listingDetailEl.innerHTML = `<div class="empty-state">Inserat nicht gefunden.</div>`;
      setStatus("Inserat nicht gefunden.");
    }
  }

  // ---------------- Events ----------------
  dealerSearchBtn?.addEventListener("click", () => {
    state.dealers.q = dealerSearchEl.value.trim();
    loadDealers(1);
  });

  dealerSearchEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      state.dealers.q = dealerSearchEl.value.trim();
      loadDealers(1);
    }
  });

  loadDealerBtn?.addEventListener("click", () => {
    const id = dealerIdInput.value.trim();
    if (id) selectDealer(id);
  });

  refreshListingsBtn?.addEventListener("click", () => {
    if (state.currentDealerId) loadDealerListings(state.currentDealerId);
  });

  loadListingBtn?.addEventListener("click", () => {
    const id = listingIdInput.value.trim();
    if (id) loadListingById(id);
  });

  // init
  loadDealers(1);
});
