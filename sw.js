// Build marker. It must name APP_VERSION (test/sw.test.js checks), and it must
// change on every deploy, or installed phones decide they're already current
// and quietly keep the old build.
const CACHE = "axlepost-v0.1.1";

// Everything the app needs, so it opens and works at a scale in a dead zone.
// The ?v= URLs are the exact ones index.html requests; caching the bare path
// would miss on every lookup and fall through to the network.
const ASSETS = [
  "./",
  "./index.html",
  "./lib/limits.js?v=0.1.1",
  "./lib/slide.js?v=0.1.1",
  "./lib/format.js?v=0.1.1",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-1024.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first. The app never needs the network, so no signal changes nothing.
// Same-origin GETs only.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
