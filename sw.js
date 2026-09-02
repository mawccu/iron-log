// Iron Log service worker: app shell precache + cache-first for photos and fonts.
// Bump VERSION on every deploy so clients pick up the new shell.
const VERSION = "v3";
const SHELL = "ironlog-shell-" + VERSION;
const RUNTIME = "ironlog-runtime";
const PRECACHE = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/app.css?v=2",
  "./js/app.js?v=2", "./js/store.js", "./js/cloud.js", "./js/config.js?v=3", "./js/program.js", "./js/ui.js", "./js/timer.js", "./js/charts.js",
  "./js/views/train.js", "./js/views/week.js", "./js/views/progress.js", "./js/views/me.js",
  "./img/ex/_meta.json", "./img/icon-192.png", "./img/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ironlog-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never touch Supabase traffic.
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;

  // Photos, fonts, and the supabase-js module: cache-first, fill on first use.
  const isAsset = url.pathname.includes("/img/") || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com" || url.hostname === "cdn.jsdelivr.net";
  if (isAsset) {
    e.respondWith(caches.open(RUNTIME).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
    return;
  }

  // App shell: network-first with cache fallback so updates land quickly but offline still opens.
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const c = await caches.open(SHELL); c.put(req, res.clone()); }
        return res;
      } catch (err) {
        const hit = await caches.match(req) || (req.mode === "navigate" ? await caches.match("./index.html") : null);
        return hit || Response.error();
      }
    })());
  }
});
