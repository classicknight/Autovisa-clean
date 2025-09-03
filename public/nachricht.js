document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.getElementById("nav-links");
    const hamburger = document.getElementById("hamburger");
    const dropdownLinks = document.querySelectorAll(".dropdown > a");
    
    // Hamburger-Menü ein-/ausblenden
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("active");
      closeAllDropdowns(); // Immer Dropdowns schließen beim Öffnen
    });
    
    // Dropdown-Handling
    dropdownLinks.forEach(link => {
      const menu = link.nextElementSibling;
      
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Schließt alle Dropdowns außer das angeklickte
        document.querySelectorAll(".dropdown-menu").forEach(otherMenu => {
          if (otherMenu !== menu) {
            otherMenu.classList.remove("show");
          }
        });
        
        menu.classList.toggle("show");
      });
    });
    
    // Klick außerhalb: alles schließen
    document.addEventListener("click", () => {
      navLinks.classList.remove("active");
      closeAllDropdowns();
    });
    
    function closeAllDropdowns() {
      document.querySelectorAll(".dropdown-menu").forEach(menu => {
        menu.classList.remove("show");
      });
    }
    
    // Login-Handling
    const isLoggedIn = false; // später dynamisch setzen
    
    const savedCarsLink = document.getElementById("saved-cars-link");
    const myCarsLink = document.getElementById("my-cars-link");
    
    if (savedCarsLink) {
      savedCarsLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = isLoggedIn ? "gespeicherte-autos.html" : "login.html";
      });
    }
    
    if (myCarsLink) {
      myCarsLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = isLoggedIn ? "meine-autos.html" : "login.html";
      });
    }
    
    // Smooth Scroll
    const searchLink = document.querySelector('a[href="#search-section"]');
    if (searchLink) {
      searchLink.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  });
  
  
  
  
  
  document.getElementById("chat-form").addEventListener("submit", function(e) {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (message) {
      const container = document.getElementById("chat-messages");
      const bubble = document.createElement("div");
      bubble.className = "message from-me";
      bubble.innerHTML = `<p>${message}</p><span>Ich, jetzt</span>`;
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
      input.value = "";
    }
  });










  // nachrichten.js – Einzel-Chatansicht (Thread)

// ------- kleine Helfer ------- //
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
    alert("Bitte einloggen.");
    location.href = "login.html";
    throw new Error("Not logged in");
  }
  return j; // {nutzerId, name?, vorname?, nachname?}
}

async function loadCar(fid){
  // Wenn du diesen Endpoint noch nicht hast, kannst du ihn wie in der Übersicht anlegen.
  try{
    const r = await fetch(`/inserat-details/${encodeURIComponent(fid)}`, { credentials:"include" });
    if (!r.ok) return null;
    return await r.json();
  }catch{ return null; }
}

async function loadChat(u1, u2, fid){
  const url = `/chat?user1=${encodeURIComponent(u1)}&user2=${encodeURIComponent(u2)}&fahrzeugId=${encodeURIComponent(fid)}`;
  const r = await fetch(url, { credentials:"include" });
  if (!r.ok) throw new Error("Chat konnte nicht geladen werden");
  return await r.json(); // Array von Nachrichten
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

// Auto-Scroll nur, wenn der Nutzer am Ende ist
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
  // Wer ist „der andere“ in diesem Chat?
  otherId = (me.nutzerId === user1) ? user2 : user1;

  // Sicherheitscheck: requester muss user1 oder user2 sein (macht der Server auch)
  if (me.nutzerId !== user1 && me.nutzerId !== user2){
    alert("Kein Zugriff auf diesen Chat.");
    location.href = "chat.html";
    return;
  }

  // Header laden
  const car = await loadCar(fahrzeugId);
  if (car) setHeader(car);

  // Erstes Laden + Polling
  await refreshChat(true);
  startPolling();
}

async function refreshChat(forceScroll){
  try{
    const list = await loadChat(user1, user2, fahrzeugId);
    const box = $("#chat-messages");
    const stick = forceScroll || isNearBottom(box);

    renderMessages(list, me.nutzerId);

    // nur bei neuen Nachrichten automatisch nach unten
    if (stick || list.length !== lastRenderedCount){
      box.scrollTop = box.scrollHeight;
    }
    lastRenderedCount = list.length;

  }catch(e){
    console.error(e);
    // dezent, kein Alert-Spam
  }
}

function startPolling(){
  stopPolling();
  pollTimer = setInterval(()=> refreshChat(false), 5000); // 5s Poll
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

    // Optimistisch anzeigen
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
      // danach frisch ziehen, um serverseitige Felder (id/zeit) zu haben
      await refreshChat(true);
    }catch(err){
      console.error(err);
      // Fehlermeldung + Revert optisch (optional)
      alert("Nachricht konnte nicht gesendet werden.");
      await refreshChat(true);
    }
  });
}

// ------- Start ------- //
document.addEventListener("visibilitychange", ()=>{
  if (document.hidden) stopPolling(); else startPolling();
});

document.addEventListener("DOMContentLoaded", async ()=>{
  try{
    await init();
    bindForm();
  }catch(e){
    console.error(e);
  }
});
