// Inlined in <body> by layout.tsx — __APP_VERSION__ is replaced at build time.
(function () {
  var CV = '__APP_VERSION__';
  var reloading = false;

  function doReload() {
    if (reloading) return;
    reloading = true;
    if ('caches' in window) {
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }).then(function () { location.reload(); });
    } else {
      location.reload();
    }
  }

  function showUpdateBanner() {
    if (reloading) return;
    var b = document.createElement('div');
    b.setAttribute('style', 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#1e293b;color:#f1f5f9;padding:12px 20px;border-radius:8px;font-size:14px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:system-ui,sans-serif');
    b.innerHTML = 'Mise \u00e0 jour disponible <button style="background:#3b82f6;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">Recharger</button>';
    b.querySelector('button').onclick = function () { location.reload(); };
    document.body.appendChild(b);
  }

  // ChunkLoadError recovery
  window.addEventListener('error', function (e) {
    if (e.message && e.message.indexOf('ChunkLoadError') !== -1) {
      var k = 'chunk_reload:' + location.pathname;
      if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); doReload(); }
    }
  });

  // Listen for SW version mismatch messages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'VERSION_CHANGED') doReload();
    });
  }

  // Version check — on visibility change and navigation
  function checkVersion() {
    // Only reload once per session to avoid loops (ISR pages may serve stale HTML)
    if (sessionStorage.getItem('version_reload')) return;
    fetch('/api/version', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.version && CV && d.version !== CV) {
          sessionStorage.setItem('version_reload', d.version);
          doReload();
        }
      })
      .catch(function () {});
  }

  // Service worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      var h = location.hostname;
      if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost') || h.endsWith('.local')) {
        navigator.serviceWorker.getRegistrations().then(function (r) { r.forEach(function (w) { w.unregister(); }); });
      } else {
        var hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (!hadController) { hadController = true; return; }
          doReload();
          setTimeout(showUpdateBanner, 2000);
        });
        navigator.serviceWorker.register('/sw.js').then(function (reg) {
          // Check for updates shortly after load, then every 5 minutes
          setTimeout(function () { reg.update(); checkVersion(); }, 10000);
          setInterval(function () { reg.update(); checkVersion(); }, 5 * 60 * 1000);

          document.addEventListener('visibilitychange', function () {
            if (!document.hidden) { reg.update(); checkVersion(); }
          });
          var p = history.pushState;
          history.pushState = function () { p.apply(this, arguments); reg.update(); };
        });
      }
    });
  }
})();
