// GA4 bootstrap + Consent Banner (Autovisa)
(function () {
  var GA_ID = "G-2P3XYPXHYC";
  var CONSENT_KEY = "av_analytics_consent";
  var GA_DISABLE_KEY = "ga-disable-" + GA_ID;

  function injectStyles() {
    if (document.getElementById("cookie-banner-styles")) return;
    var style = document.createElement("style");
    style.id = "cookie-banner-styles";
    style.textContent =
      ".cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0f1f26;color:#e9f1f5;padding:16px 18px;border-top:1px solid rgba(255,255,255,.08);box-shadow:0 -10px 30px rgba(0,0,0,.25);}" +
      ".cookie-banner .cookie-inner{max-width:1100px;margin:0 auto;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;}" +
      ".cookie-banner p{margin:0;font-size:14px;line-height:1.4;}" +
      ".cookie-banner a{color:#00ffcc;text-decoration:underline;}" +
      ".cookie-actions{display:flex;gap:10px;flex-wrap:wrap;}" +
      ".cookie-btn{border:none;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;}" +
      ".cookie-accept{background:linear-gradient(90deg,#00ffcc,#00bfa6);color:#002a2b;}" +
      ".cookie-decline{background:transparent;color:#00ffcc;border:1px solid #00ffcc;}" +
      ".cookie-settings-link{background:none;border:none;color:#00bfa6;font-weight:600;cursor:pointer;padding:0;margin-left:12px;}" +
      ".cookie-settings-wrap{display:flex;align-items:center;gap:6px;}";
    document.head.appendChild(style);
  }

  function loadGtag() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;

    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);

    gtag("js", new Date());
    gtag("config", GA_ID);
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {}
  }

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch {
      return null;
    }
  }

  function disableAnalytics() {
    window[GA_DISABLE_KEY] = true;
    // Best effort: delete GA cookies
    var suffix = GA_ID.replace("G-", "");
    var names = ["_ga", "_ga_" + suffix];
    var domains = [location.hostname, "." + location.hostname];
    names.forEach(function (n) {
      domains.forEach(function (d) {
        document.cookie = n + "=; Max-Age=0; path=/; domain=" + d + ";";
      });
    });
  }

  function enableAnalytics() {
    window[GA_DISABLE_KEY] = false;
    loadGtag();
  }

  function removeBanner() {
    var el = document.getElementById("cookie-banner");
    if (el) el.remove();
  }

  function showBanner() {
    if (document.getElementById("cookie-banner")) return;
    injectStyles();
    var banner = document.createElement("div");
    banner.id = "cookie-banner";
    banner.className = "cookie-banner";
    banner.innerHTML =
      '<div class="cookie-inner">' +
      "<p>Wir verwenden Cookies, um die Nutzung zu analysieren (Google Analytics). Mehr in der <a href=\"datenschutz.html\">Datenschutzerkl\u00e4rung</a>.</p>" +
      '<div class="cookie-actions">' +
      '<button type="button" class="cookie-btn cookie-decline" id="cookie-decline">Ablehnen</button>' +
      '<button type="button" class="cookie-btn cookie-accept" id="cookie-accept">Akzeptieren</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(banner);

    var accept = document.getElementById("cookie-accept");
    var decline = document.getElementById("cookie-decline");

    if (accept) {
      accept.addEventListener("click", function () {
        setConsent("granted");
        enableAnalytics();
        removeBanner();
      });
    }
    if (decline) {
      decline.addEventListener("click", function () {
        setConsent("denied");
        disableAnalytics();
        removeBanner();
      });
    }
  }

  function injectSettingsLink() {
    var footer = document.querySelector(".site-footer .footer-bottom .bottom-inner");
    if (!footer || document.getElementById("cookie-settings-link")) return;

    var wrap = document.createElement("span");
    wrap.className = "cookie-settings-wrap";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "cookie-settings-link";
    btn.className = "cookie-settings-link";
    btn.textContent = "Cookie-Einstellungen";
    btn.addEventListener("click", function () {
      showBanner();
    });

    wrap.appendChild(btn);
    footer.appendChild(wrap);
  }

  // Init
  var consent = getConsent();
  if (consent === "granted") {
    enableAnalytics();
  } else if (consent === "denied") {
    disableAnalytics();
  } else {
    showBanner();
  }
  injectSettingsLink();
})();
