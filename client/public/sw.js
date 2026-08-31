const CACHE_NAME = "carnavales-static-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexResponse = await fetch("/index.html", { cache: "no-store" });
  const html = await indexResponse.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
  await cache.put("/index.html", indexResponse);
  await cache.addAll([...APP_SHELL.filter((path) => path !== "/index.html"), ...assets]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key !== CACHE_NAME)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && (url.pathname === "/" || url.pathname === "/index.html" || url.pathname.startsWith("/assets/"))) {
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  })));
});
