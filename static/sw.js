const ASSET_VERSION = "20260424-2";
const CACHE_NAME = `physics-agent-pwa-v${ASSET_VERSION}`;
const APP_SHELL = [
  "/",
  `/manifest.webmanifest?v=${ASSET_VERSION}`,
  `/static/style.css?v=${ASSET_VERSION}`,
  `/static/app.js?v=${ASSET_VERSION}`,
  `/static/lite-backend.js?v=${ASSET_VERSION}`,
  `/static/mobile-config.js?v=${ASSET_VERSION}`,
  "/static/offline.html",
  "/app-icon-192.png",
  "/app-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isCoreAsset = [
    "/manifest.webmanifest",
    "/static/style.css",
    "/static/app.js",
    "/static/lite-backend.js",
    "/static/mobile-config.js",
  ].includes(url.pathname);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put("/", response.clone());
          return response;
        } catch {
          return (await caches.match(request)) || (await caches.match("/")) || caches.match("/static/offline.html");
        }
      })()
    );
    return;
  }

  if (isCoreAsset) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, { cache: "no-store" });
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (await caches.match(request)) || caches.match(url.pathname) || caches.match("/static/offline.html");
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const networkPromise = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      return cached || (await networkPromise) || caches.match("/static/offline.html");
    })()
  );
});
