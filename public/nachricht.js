// nachricht.js – Einzel-Chat (Thread)  ✅ BEREINIGT

// ------- Helpers ------- //
const $ = (s, r=document) => r.querySelector(s);
const qs = new URLSearchParams(location.search);
const fahrzeugId = qs.get("fahrzeugId");
const user1 = qs.get("user1");
const user2 = qs.get("user2");

function fmtEUR(v){
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g,"").replace(",","."));
  return isNaN(n) ? String(v) : n.toLocaleString("de-DE") + " €";
}
function when(iso){
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit" });
}
function escapeHTML(s){
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ------- API ------- //
async function getMe(){
  const r = await fetch("/getNutzerInfo", { credentials:"include" });
  const j = await r.json();
  if (!j?.eingeloggt || !j?.nutzerId){
    alert("Bitte erst einloggen.");
    location.href = "login.html";
    throw new Error("Not logged in");
  }
  return j;
}

async function loadCar(fid){
  try{
    const r = await fetch(`/inserat-details/${encodeURIComponent(fid)}`, { credentials:"include" });
    if (!r.ok) return null;
    return await r.json();
  }catch{ return null; }
}

async function loadChat(u1, u2, fid){
  const url = `/chat?user1=${encodeURIComponent(u1)}&user2=${encodeURIComponent(u2)}&fahrzeugId=${encodeURIComponent(fid)}`;
  const r = await fetch(url, { credentials:"include" });
  if (!r.ok) throw new Error("Chat konnte nicht geladen werden.");
  return await r.json();
}

async function sendMessage({ empfaengerId, fahrzeugId, absenderName, nachricht }){
  const r = await fetch("/nachricht-senden", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ empfaengerId, fahrzeugId, absenderName, nachricht })
  });
  if (!r.ok){
    const t = await r.text().catch(()=> "");
    console.error("Senden fehlgeschlagen:", r.status, t);
    throw new Error(t || "Senden fehlgeschlagen");
  }
  return await r.json();
}

// ------- Rendering ------- //
function setHeader(car){
  const img = (Array.isArray(car?.images) && car.images[0]) ? car.images[0] : "";
  $("#car-img").src = img || "placeholder.png";
  $("#car-img").alt = car?.titel || "Fahrzeug";
  $("#car-title").textContent = car?.titel || "Fahrzeug";
  const preis = car?.verkauf_brutto ?? car?.verkauf_preis ?? car?.preis;
  $("#car-price").textContent = fmtEUR(preis) || "";
}

function messageHTML(msg, meId){
  const mine = msg.senderId === meId;
  const who = mine ? "Ich" : (msg.absenderName || "Nutzer");
  const safe = escapeHTML(msg.nachricht || "");
  return `
    <div class="message ${mine ? "from-me" : "from-other"}">
      <p>${safe}</p>
      <span>${who}, ${when(msg.zeit)}</span>
    </div>
  `;
}

function renderMessages(list, meId){
  const box = $("#chat-messages");
  box.innerHTML = list.map(m => messageHTML(m, meId)).join("");
  box.scrollTop = box.scrollHeight;
}

function isNearBottom(el){ return (el.scrollHeight - el.scrollTop - el.clientHeight) < 48; }

// ------- Live-Logik ------- //
let me, otherId;
let lastRenderedCount = 0;
let pollTimer = null;

async function init(){
  if (!fahrzeugId || !user1 || !user2){
    alert("Ungültiger Chat-Link.");
    history.back();
    return;
  }

  me = await getMe();
  otherId = (me.nutzerId === user1) ? user2 : user1;

  // Header (falls Endpoint existiert)
  const car = await loadCar(fahrzeugId);
  if (car) setHeader(car);

  // Initial laden + Polling
  await refreshChat(true);
  startPolling();

  bindForm();
}

async function refreshChat(forceScroll){
  try{
    const list = await loadChat(user1, user2, fahrzeugId);
    const box = $("#chat-messages");
    const stick = forceScroll || isNearBottom(box);

    renderMessages(list, me.nutzerId);

    if (stick || list.length !== lastRenderedCount){
      box.scrollTop = box.scrollHeight;
    }
    lastRenderedCount = list.length;
  }catch(e){
    console.error(e);
  }
}

function startPolling(){
  stopPolling();
  pollTimer = setInterval(()=> refreshChat(false), 5000);
}
function stopPolling(){
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// ------- Senden ------- //
function bindForm(){
  const form = $("#chat-form");
  const input = $("#chat-input");
  const box = $("#chat-messages");

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // Optimistisch anhängen
    const optimistic = {
      senderId: me.nutzerId,
      empfaengerId: otherId,
      fahrzeugId,
      absenderName: me.name || me.vorname || "Ich",
      nachricht: text,
      zeit: new Date().toISOString()
    };
    box.insertAdjacentHTML("beforeend", messageHTML(optimistic, me.nutzerId));
    box.scrollTop = box.scrollHeight;
    input.value = "";

    try{
      await sendMessage({
        empfaengerId: otherId,
        fahrzeugId,
        absenderName: me.name || me.vorname || "Ich",
        nachricht: text
      });
      await refreshChat(true); // echten Stand ziehen
    }catch(err){
      alert("Nachricht konnte nicht gesendet werden.");
      await refreshChat(true);
    }
  });
}

// Tab-Wechsel: Poll pausieren
document.addEventListener("visibilitychange", ()=>{
  if (document.hidden) stopPolling(); else startPolling();
});

document.addEventListener("DOMContentLoaded", init);
