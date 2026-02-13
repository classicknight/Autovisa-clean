// GA4 bootstrap (Autovisa)
(function () {
  var GA_ID = "G-2P3XYPXHYC";
  if (window.gtag) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  // Load gtag.js
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
  document.head.appendChild(s);

  gtag("js", new Date());
  gtag("config", GA_ID);
})();
