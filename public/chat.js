// chat.js

// ---- Helpers ----
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function qs(name) {
  const v = new URLSearchParams(location.search).get(name);
  return v ? String(v) : "";
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function scrollToBottom() {
  const box = $("#messages");
  if (box) box.scrollTop = box.scrollHeight;
}

async function getMe() {
  const r = await fetch("/getNutzerInfo", { credentials: "include" });
  const j = await r.json();
  if (!j?.eingeloggt || !j?.nutzerId) throw new Error("Nicht eingeloggt");
  return j; // {eingeloggt:true, nutzerId:"...", name?: "..."}
}

async function fetchInseratDetails(id) {
  const r = await fetch(`/inserat-details/${encodeURIComponent(id)}`, { credentials: "include" });
  if (!r.ok) return null;
  return await r.json();
}

async function fetchChat(user1, user2, fahrzeugId) {
  const url = `/chat?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}&fahrzeugId=${encodeURIComponent(fahrzeugId)}`;
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("Chat konnte nicht geladen werden");
  return await r.json(); // Array
}

async function markAsRead(ids) {
  // nacheinander, simpel & robust
  for (const id of ids) {
    try {
      await fetch(`/nachrichten/${encodeURIComponent(id)}/gelesen`, {
        method: "PATCH",
        credentials: "include"
      });
    } catch {}
  }
}

async function sendMessage({ empfaengerId, fahrzeugId, absenderName, text }) {
  const r = await fetch("/nachricht-senden", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      empfaengerId,
      fahrzeugId,
      absenderName,
      nachricht: text
    })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Senden fehlgeschlagen");
  }
  return true;
}

// ---- Rendering ----
function renderHeader(ins) {
  const img = Array.isArray(ins?.images) && ins.images[0] ? ins.images[0] : "";
  if (img) {
    $("#car-thumb").src = img;
    $("#car-thumb").alt = ins?.titel || "Fahrzeug";
  } else {
    $("#car-thumb").removeAttribute("src");
    $("#car-thumb").alt = "";
  }
  $("#car-title").textContent = ins?.titel || "Unbekanntes Fahrzeug";
  const preis = ins?.preis != null
    ? (typeof ins.preis === "number" ? ins.preis.toLocaleString("de-DE") + " €" : String(ins.preis))
    : "";
  const metaParts = [];
  if (preis) metaParts.push(preis);
  if (ins?.verkauf_erstzulassung) metaParts.push("EZ " + ins.verkauf_erstzulassung);
  if (ins?.verkauf_kilometer != null) metaParts.push((ins.verkauf_kilometer + "").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " km");
  $("#car-meta").textContent = metaParts.join(" • ");
}

function renderPartnerName(me, user1, user2, firstMsg) {
  // Wir zeigen den "anderen" an. Wenn erste Nachricht existiert, nimm absenderName als Fallback.
  const otherId = (me.nutzerId === user1) ? user2 : user1;
  const name = firstMsg?.absenderName && firstMsg.senderId === otherId ? firstMsg.absenderName : (firstMsg?.absenderName || "Chat-Partner");
  $("#partner-name").textContent = name;
  return { otherId, name };
}

function renderMessages(list, meId) {
  const box = $("#messages");
  if (!Array.isArray(list) || list.length === 0) {
    box.innerHTML = `<p class="empty">Noch keine Nachrichten.</p>`;
    return;
  }
  const html = list.map(m => {
    const mine = m.senderId === meId;
    return `
      <div class="msg ${mine ? "me" : "them"}" data-id="${m.id}">
        <div class="bubble">
          ${!mine && m.absenderName ? `<div class="from">${m.absenderName}</div>` : ""}
          <div class="text">${(m.nachricht || "").replace(/\n/g, "<br>")}</div>
          <div class="meta">
            <time datetime="${m.zeit}">${formatTime(m.zeit)}</time>
            ${mine ? "" : (m.gelesen ? `<span class="read" title="Gelesen">✓</span>` : ``)}
          </div>
        </div>
      </div>`;
  }).join("");
  box.innerHTML = html;
}

function collectUnreadForMe(list, meId) {
  return list.filter(m => !m.gelesen && m.empfaengerId === meId).map(m => m.id);
}

// ---- Main ----
document.addEventListener("DOMContentLoaded", async () => {
  // Query-Parameter
  const user1 = qs("user1");
  const user2 = qs("user2");
  const fahrzeugId = qs("fahrzeugId");

  try {
    const me = await getMe();
    // Sicherheitscheck wie im Backend
    if (me.nutzerId !== user1 && me.nutzerId !== user2) {
      alert("Zugriff verweigert.");
      location.href = "übersicht.html";
      return;
    }
    if (!fahrzeugId) {
      alert("Kein Fahrzeug angegeben.");
      location.href = "übersicht.html";
      return;
    }

    // Fahrzeug laden (optional, aber hübsch)
    const ins = await fetchInseratDetails(fahrzeugId);
    if (ins) renderHeader(ins);

    // Chat laden & rendern
    async function refresh() {
      const verlauf = await fetchChat(user1, user2, fahrzeugId);
      renderMessages(verlauf, me.nutzerId);
      const { name } = renderPartnerName(me, user1, user2, verlauf[0]);
      // Ungelesene markieren
      const unread = collectUnreadForMe(verlauf, me.nutzerId);
      if (unread.length) markAsRead(unread);
      scrollToBottom();
      return name;
    }

    const partnerName = await refresh();

    // Composer
    const input = $("#message-input");
    const sendBtn = $("#send-btn");
    $("#composer").addEventListener("submit", async (e) => {
      e.preventDefault();
      const txt = (input.value || "").trim();
      if (!txt) return;

      // An wen geht's?
      const otherId = me.nutzerId === user1 ? user2 : user1;
      // Absendername nehmen, wenn vorhanden, sonst Partnername als Fallback
      const absenderName = me?.name || "Ich";

      sendBtn.disabled = true;
      try {
        await sendMessage({
          empfaengerId: otherId,
          fahrzeugId,
          absenderName,
          text: txt
        });
        input.value = "";
        await refresh();
      } catch (err) {
        console.error(err);
        alert("Konnte nicht senden.");
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    });

    // Enter = senden, Shift+Enter = neue Zeile
    $("#message-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("#composer").requestSubmit();
      }
    });

    // Polling
    let pollTimer = setInterval(() => {
      refresh().catch(() => {});
    }, 8000);

    // Optional: auf Sichtbarkeit reagieren
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearInterval(pollTimer);
      } else {
        refresh().catch(()=>{});
        pollTimer = setInterval(() => refresh().catch(()=>{}), 8000);
      }
    });

  } catch (err) {
    console.error(err);
    alert("Bitte zuerst einloggen.");
    location.href = "login.html";
  }
});

  
  
  
  
  
  
  
  
  
  





