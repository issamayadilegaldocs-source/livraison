// Service Worker de mise en cache rapide pour les assets statiques, menus et images (Stale-While-Revalidate).
// Ne touche jamais aux requêtes /api/* pour garder les commandes, le GPS et les comptes toujours à jour.
const CACHE_NAME = 'livraison-app-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Jamais de cache sur les routes dynamiques API
  if (url.pathname.startsWith('/api/')) return;

  const estStatique =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/menu-data/') ||
      url.pathname.startsWith('/media/') ||
      url.pathname === '/restos.json' ||
      url.pathname === '/recherche.json' ||
      /\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(url.pathname));

  const estMediaExterne =
    url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/medias/');

  if (!estStatique && !estMediaExterne) return;

  // Stale-While-Revalidate : réponse instantanée depuis le cache + mise à jour en arrière-plan
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const reseau = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || reseau;
      }),
    ),
  );
});
