// Service worker du livreur : affiche l'alerte quand le serveur envoie un push (corps vide, voir lib/push.ts).
// Il n'intercepte aucune requête : le site des clients n'est pas touché.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  e.waitUntil(
    // Les pages ouvertes (liste des commandes) se rafraîchissent d'elles-mêmes.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => l.forEach((c) => c.postMessage({ type: 'commande' }))),
  );
  e.waitUntil(
    self.registration.showNotification('🛵 Nouvelle commande', {
      body: 'Touchez pour voir la commande',
      tag: 'commande',
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500, 200, 500],
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  );
});

// La clé du livreur est dans l'adresse du service worker (…/sw-livreur.js?cle=…) : on rouvre sa page de commandes.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const cle = new URL(self.location.href).searchParams.get('cle') || '';
  const cible = cle ? '/api/config?cle=' + encodeURIComponent(cle) + '#commandes' : '/admin';
  e.waitUntil(self.clients.openWindow(cible));
});
