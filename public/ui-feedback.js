(() => {
  if (window.__uiFeedbackInit) return;
  window.__uiFeedbackInit = true;

  const css = `
    :root{
      --toast-bg:#0f1f26;
      --toast-text:#ffffff;
      --toast-shadow:0 10px 30px rgba(0,0,0,0.2);
      --toast-success:#00b894;
      --toast-error:#e74c3c;
      --toast-warning:#f39c12;
      --toast-info:#3498db;
    }

    .toast-container{
      position:fixed;
      top:18px;
      right:18px;
      display:flex;
      flex-direction:column;
      gap:10px;
      z-index:5000;
      max-width:min(420px, 92vw);
    }

    .toast{
      display:flex;
      gap:10px;
      align-items:flex-start;
      background:var(--toast-bg);
      color:var(--toast-text);
      border-radius:12px;
      padding:12px 14px;
      box-shadow:var(--toast-shadow);
      font-size:14px;
      line-height:1.45;
      border:1px solid rgba(255,255,255,0.08);
      animation:toast-in .25s ease-out;
    }

    .toast__icon{
      width:10px;
      height:10px;
      margin-top:6px;
      border-radius:50%;
      flex:0 0 10px;
      background:var(--toast-info);
    }

    .toast--success .toast__icon{ background:var(--toast-success); }
    .toast--error .toast__icon{ background:var(--toast-error); }
    .toast--warning .toast__icon{ background:var(--toast-warning); }

    .toast__content{
      flex:1 1 auto;
      min-width:0;
      word-break:break-word;
    }

    .toast__close{
      margin-left:8px;
      background:transparent;
      border:none;
      color:rgba(255,255,255,0.7);
      cursor:pointer;
      font-size:16px;
      line-height:1;
      padding:2px 4px;
    }

    .toast__close:hover{
      color:#ffffff;
    }

    @keyframes toast-in{
      from{ transform:translateY(-6px); opacity:0; }
      to{ transform:translateY(0); opacity:1; }
    }

    @media (max-width: 700px){
      .toast-container{
        left:50%;
        right:auto;
        transform:translateX(-50%);
        top:12px;
      }
    }
  `;

  function injectStyles() {
    if (document.getElementById("ui-feedback-style")) return;
    const style = document.createElement("style");
    style.id = "ui-feedback-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  let container = null;
  const pending = [];

  function ensureContainer() {
    if (container) return container;
    if (!document.body) return null;
    container = document.createElement("div");
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("role", "status");
    document.body.appendChild(container);
    return container;
  }

  function parseType(message = "") {
    const m = String(message);
    if (m.includes("❌")) return "error";
    if (m.includes("✅")) return "success";
    if (m.includes("⚠️") || m.includes("⚠")) return "warning";
    return "info";
  }

  function stripLeadingIcon(message = "") {
    return String(message).replace(/^\s*[✅❌⚠️⚠]\s*/u, "");
  }

  function createTextContent(message, el) {
    const parts = String(message).split(/\n+/);
    parts.forEach((part, idx) => {
      if (idx > 0) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(part));
    });
  }

  function showToast(message, opts = {}) {
    const msg = String(message ?? "");
    const type = opts.type || parseType(msg);
    const text = opts.keepIcon ? msg : stripLeadingIcon(msg);
    const duration =
      typeof opts.duration === "number"
        ? opts.duration
        : (type === "error" || type === "warning" ? 5500 : 3200);

    if (!document.body) {
      pending.push({ message: msg, opts });
      return;
    }

    const wrap = ensureContainer();
    if (!wrap) return;

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;

    const icon = document.createElement("span");
    icon.className = "toast__icon";

    const content = document.createElement("div");
    content.className = "toast__content";
    createTextContent(text, content);

    const close = document.createElement("button");
    close.className = "toast__close";
    close.type = "button";
    close.setAttribute("aria-label", "Schließen");
    close.textContent = "×";
    close.addEventListener("click", () => toast.remove());

    toast.appendChild(icon);
    toast.appendChild(content);
    toast.appendChild(close);
    wrap.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-4px)";
        toast.style.transition = "opacity .2s ease, transform .2s ease";
        setTimeout(() => toast.remove(), 200);
      }, duration);
    }
  }

  window.showToast = showToast;

  const nativeAlert = window.alert?.bind(window);
  window.alert = (message) => {
    try {
      showToast(message);
    } catch {
      nativeAlert?.(message);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectStyles();
      ensureContainer();
      while (pending.length) {
        const item = pending.shift();
        showToast(item.message, item.opts);
      }
    });
  } else {
    injectStyles();
    ensureContainer();
  }
})();
