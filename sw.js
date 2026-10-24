// Ouverture hors ligne : l'appli est gardée sur l'appareil, mise à jour en arrière-plan quand internet revient
const CACHE = "carnet-v5";
const FICHIERS = ["./", "index.html", "manifest.webmanifest", "logo.jpg", "tampon.png", "logo-rond.png", "vendor/jspdf.umd.min.js", "favicon-48.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const garde = await c.match(e.request, { ignoreSearch: true });
    const reseau = fetch(e.request).then(r => { if (r.ok && (r.type === "basic" || r.type === "cors")) c.put(e.request, r.clone()); return r; }).catch(() => garde);
    return garde || reseau;
  }));
});
