// Ouverture hors ligne : l'appli est gardée sur l'appareil, version par version.
// Une nouvelle version s'installe en arrière-plan puis attend que Mel touche « Mettre à jour » dans l'appli.
// À chaque publication : même numéro ici, dans index.html (VERSION) et dans version.json.
const VERSION = "1.0";
const CACHE = "mel-dantan-" + VERSION;
const FICHIERS = ["./", "index.html", "manifest.webmanifest", "logo.jpg", "tampon.png", "mel.webp", "mel-avatar.png", "logo-rond.png", "vendor/jspdf.umd.min.js", "favicon-48.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

// cache: "reload" : les fichiers viennent du serveur, jamais d'un ancien cache du navigateur
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS.map(f => new Request(f, { cache: "reload" }))))
  // Anciennes versions (avant les numéros) : elles n'ont pas le bouton « Mettre à jour », on passe directement
  .then(() => caches.keys()).then(k => { if (k.some(x => x.startsWith("carnet-"))) return self.skipWaiting(); })));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("message", e => { if (e.data === "activer") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Mel (/api/…) et le numéro de la dernière version passent toujours par internet
  if (e.request.method !== "GET" || url.pathname.includes("/api/") || url.pathname.endsWith("/version.json")) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const garde = await c.match(e.request, { ignoreSearch: true });
    if (garde) return garde;
    return fetch(e.request).then(r => { if (r.ok && (r.type === "basic" || r.type === "cors")) c.put(e.request, r.clone()); return r; });
  }));
});

// Notification « nouvelle version » touchée : l'appli s'ouvre (ou revient au premier plan)
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => l.length ? l[0].focus() : self.clients.openWindow("./")));
});
