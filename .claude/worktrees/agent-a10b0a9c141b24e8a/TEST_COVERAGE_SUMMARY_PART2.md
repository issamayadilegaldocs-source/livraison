# Audit de couverture de tests — Enatega Multivendor (Partie 2/3)

> Suite de PART1 (vue d'ensemble + couverture par application). Voir PART3 pour cas limites, concurrence, financier, temps réel, sécurité, zones sans couverture, recommandations.

---

## 3. Couverture par domaine métier

Légende : ✅ Couvert · 🟡 Partiellement couvert · ❌ Non couvert

### Authentification
**🟡 Partiellement couvert**
- ✅ Login valide/invalide sur admin (Playwright + Cypress) : redirection, message d'erreur Clerk
- ✅ Accès direct non-authentifié → redirection login (admin)
- ✅ Session persistée (`storageState`) réutilisable sans re-login
- ✅ Résolution `clerkId` ↔ `_id` Mongo testée côté service (owners/riders/users/restaurants)
- ❌ **Aucun test des guards eux-mêmes** (`ClerkAuthGuard`, `RolesGuard`, `gql-throttler.guard`) côté API
- ❌ Aucun test du webhook Clerk (`clerk-webhook.controller.ts`)
- ❌ Aucun test de login sur l'app client (mobile) — seulement store/rider via scripts ad-hoc
- ❌ Aucun test d'expiration/renouvellement de token en dehors du helper de scripts ad-hoc (qui documente le TTL ~60s comme contrainte à gérer, pas un scénario testé formellement)

### Création de compte
**❌ Non couvert**
- Aucun test de `register`/`createAccount` côté client, ni de provisioning automatique de compte rider par l'admin (fonctionnalité existante d'après la mémoire projet — "admin createRider crée un compte Clerk"), ni de flux OTP/téléphone.

### Restaurants (gestion)
**🟡 Partiellement couvert**
- ✅ Ownership et identité Clerk par restaurant (rejet de réutilisation de compte, aborts sur échec de sync) — service-layer, backend
- ✅ Zone de livraison (polygone, bounds) — backend service-layer
- ✅ CRUD restaurant via Cypress admin (create/edit/delete) — **statut d'exécution incertain**
- ✅ Smoke test de chargement des pages stores/vendors (admin)
- ❌ Aucun test de recherche/filtrage de restaurant côté web/mobile
- ❌ Aucun test des horaires d'ouverture depuis l'UI (seule la logique pure `opening-hours.util` est testée backend)

### Catalogue (menu, plats)
**🟡 Partiellement couvert**
- ✅ Arithmétique minor-units sur food/variation/option (backend)
- ✅ Garde-fou suppression catégorie/sous-catégorie référencée (backend)
- ❌ Aucun test de CRUD menu depuis l'UI store (ajout/édition/suppression de plat, catégorie, option)
- ❌ Aucun test de disponibilité (`isActive`/`isOutOfStock`) piloté depuis l'UI

### Variantes / Extras (addons/options)
**❌ Non couvert (UI) / 🟡 (arithmétique backend seule)**
- ✅ Minor-units et prix backend pour options/variations
- ❌ Aucun test UI de sélection de variante/extra dans le panier client
- ❌ Aucun test de gestion des options/add-ons côté store UI

### Panier
**❌ Non couvert**
- Aucun test (unitaire ou E2E) du panier lui-même (ajout, modification de quantité, suppression, calcul du sous-total affiché). Seul le calcul pur des frais de livraison est testé (`customFunctions.test.ts`), pas le panier en tant que composant/flux.

### Checkout
**🟡 Partiellement couvert (indirect, via API)**
- ✅ `placeOrder` testé en profondeur côté backend (autorité serveur sur prix/quantité/taxe/frais de livraison)
- ✅ Placement de commande bout-en-bout via scripts ad-hoc (appel API direct, pas de remplissage UI du formulaire de checkout)
- ❌ Aucun test du **formulaire de checkout UI** lui-même (sélection d'adresse, mode de paiement, validation)
- ❌ Aucun test des 4 gateways de paiement (Stripe, Paypal, Flouci, COD) au niveau UI/intégration

### Coupons
**✅ Couvert (backend) / ❌ Non couvert (UI)**
- ✅ Validation exhaustive backend : code inconnu, désactivé, expiré, hors fenêtre, mauvaise portée, `lifeTimeActive`
- ✅ Limites d'usage atomiques (single-use, N-use, race de réclamation, libération sur annulation/rollback)
- 🟡 Admin : ouverture du dialogue d'ajout coupon (sans soumission) ; Cypress : pas de scénario coupon dédié identifié
- ❌ Aucun test de saisie/application d'un code promo dans le panier client (ni web ni mobile)

### Promotions / Offres
**🟡 Partiellement couvert**
- ✅ Arrondi de remise en pourcentage et plafond (`maxDiscount`) — backend service-layer
- ❌ `management/offers` (admin) : **absent de toute suite de test**, y compris l'audit console exhaustif
- ❌ Aucun test de l'affichage/application d'une offre côté client

### Minimum de commande
**✅ Couvert (backend + script ad-hoc)**
- ✅ Rejet backend si en dessous du minimum (test unitaire)
- ✅ Scénario S4 du script `test-real-world-scenarios.js` : rejet réel via API avec message d'erreur attendu
- ❌ Aucun test de l'affichage du minimum de commande côté UI panier/checkout

### Livraison (calcul des frais, zones)
**✅ Couvert (backend, unitaire dense)**
- ✅ Formules fixe/par-km/paliers, arrondi, clamp négatif→0 (backend + mobile `customFunctions.test.ts`, testés indépendamment aux deux endroits)
- ✅ Mode statique vs dynamique, cache, fallback sur échec provider (Google Routes)
- ✅ Autorité serveur : le client ne peut pas injecter ses propres frais de livraison
- ❌ Aucun test de l'affichage des frais de livraison dans l'UI checkout

### Matching / Dispatch livreur
**🟡 Partiellement couvert**
- ✅ Sélection de livreurs par présence Redis + fallback Mongo (backend, mais seulement 2 tests dans `dispatch.service.spec.ts` — couverture "thin")
- ✅ Scénario de course entre deux livreurs (S1, script ad-hoc) : premier arrivé gagne, second reçoit un conflit propre, disparition de liste sans reload
- ✅ Escalade de dispatch (rayon élargi) — backend
- ❌ Aucun test unitaire de l'algorithme de matching géographique lui-même (distance, zone) en dehors du fallback Mongo
- ❌ Aucun test de montée en charge (plusieurs dizaines de livreurs simultanés)

### Notifications
**🟡 Partiellement couvert**
- ✅ Forme des payloads push, hygiène des tokens invalides (backend)
- ✅ Non-réception au stade PENDING, réception au stade PREPARED pour un rider inactif (script ad-hoc `test-rider-ring-on-prepared.js`)
- ❌ Aucun test de `user-notifications` (module distinct, backend, non testé)
- ❌ `management/notifications` (admin) : un seul test superficiel ("loads if exists")
- ❌ Aucun test du centre de notifications in-app côté mobile

### Wallet
**✅ Couvert (backend) / 🟡 (UI)**
- ✅ Retraits (approve/reject/refund, débit unique garanti), split des gains, plafonnement commission, minor-units
- 🟡 Admin : smoke tests des 3 pages wallet (earnings/transaction-history/withdraw-requests) — chargement seul, pas de vérification de données
- ❌ Aucun test UI du flux de demande de retrait (store/rider)
- ❌ Aucun test du wallet client (recharge, solde, utilisation en paiement)

### Paiement / Cash on Delivery
**🟡 Partiellement couvert**
- ✅ COD : flux complet testé via scripts ad-hoc (`codCollected: true` dans `updateOrderStatusRider`) et backend (comptabilisation)
- ✅ Backend : initiation/confirmation de paiement en ligne, idempotence des tentatives, recharge wallet
- ❌ Aucun test d'intégration avec les vrais providers Stripe/Paypal/Flouci (ports/adapters non testés en dehors du service générique)
- ❌ Aucun test UI de sélection/saisie de moyen de paiement

### Fidélité (loyalty)
**🟡 Partiellement couvert**
- ✅ Valorisation des points échangés à l'échelle de la devise configurée (backend)
- ❌ Aucun test du flux d'accumulation/dépense de points depuis l'UI (mémoire projet indique une UI "profil fidélité" ajoutée en 2026-06-24, non testée depuis)

### Commandes programmées (scheduled orders)
**🟡 Partiellement couvert (backend uniquement)**
- ✅ `activateScheduledOrders` : filet de sécurité si restaurant fermé/en pause au moment de l'activation (`SCHEDULED_UNFULFILLED` sans publication `ORDER_PLACED`)
- ✅ Rejet de placement programmé sur un jour de fermeture
- ❌ Aucun test UI de sélection d'un créneau programmé côté client

### Temps réel (subscriptions, WebSocket)
**✅ Couvert (backend, dense) + 🟡 (multi-app)**
- ✅ Latence des subscriptions `<100ms` (`subscribePlaceOrder`, `subscriptionZoneOrders`, `subscriptionAssignRider`), filtrage par restaurant/zone (backend)
- ✅ Propagation bout-en-bout sans reload entre customer/store/rider (script `test-order-propagation.js`) : apparition commande côté store, non-apparition côté rider avant ACCEPT, ring temps réel, progression de livraison
- ❌ Aucun test formel (dans une suite CI) de robustesse WebSocket : reconnexion après coupure réseau, comportement multi-onglets, ordre de livraison des événements sous charge
- ❌ Pas de couverture du protocole legacy `subscriptions-transport-ws` distinctement de `graphql-ws`

### Annulations
**✅ Couvert (backend + script ad-hoc, assez dense)**
- ✅ Garde-fous state machine : client ne peut plus annuler après ASSIGNED, store ne peut plus annuler après PICKED (backend + script S3)
- ✅ Annulation store en pleine course avec rider déjà assigné : propagation sans reload à toutes les parties (script S2)
- ✅ Annulation client à PENDING vs à ACCEPTED, avec effets différents sur les listes rider (script S5)
- ✅ Broadcast d'annulation vers les riders déjà sonnés (mentionné en mémoire projet comme fix vérifié par script dédié)
- ❌ Aucun test des remboursements associés à une annulation (impact wallet/paiement en ligne au-delà du COD)

### ReOrder
**🟡 Partiellement couvert (backend uniquement)**
- ✅ `reOrder` re-applique le pricing serveur-autoritaire et rejette un article dont la variation catalogue a été supprimée (backend)
- ❌ Aucun test UI du bouton "recommander" côté client

### Historique
**❌ Non couvert**
- Aucun test (UI ou API dédié) de l'historique de commandes, ni côté client (`MyOrders`/`Reorder`), ni côté store/rider.

### Administration (RBAC, gestion utilisateurs)
**🟡 Partiellement couvert**
- ✅ Smoke tests de chargement pour users/riders/stores/vendors/staff… (staff exclu, voir gaps)
- ✅ Cypress : ajout d'un rider avec vérification d'apparition en liste
- ❌ Aucun test de contrôle d'accès granulaire par rôle depuis l'UI (au-delà du filtrage de bruit `Insufficient role` dans les helpers, qui *masque* plutôt qu'il ne *vérifie* ce comportement)
- ❌ `general/staff` totalement absent de toute suite

### Reporting / Dashboard
**❌ Non couvert (au-delà du smoke)**
- ✅ KPI du dashboard admin "visibles et numériques" (assertion de présence, pas de valeur attendue)
- ❌ Module `dashboard` backend (agrégations) : aucun test
- ❌ Aucun test de cohérence entre les chiffres affichés et les données réelles

### Audit logs
**🟡 Partiellement couvert**
- 🟡 Smoke test de chargement de page (admin)
- ❌ Module `audit`/`activity` backend : aucun test
- ❌ Aucune vérification qu'une action déclenche bien une entrée d'audit

### Support client
**❌ Non couvert (au-delà du smoke)**
- 🟡 Page `customerSupport` (admin) : chargement seul
- ❌ Module `support-tickets`, `chat` (backend) : aucun test
- ❌ Chat client↔rider/store : aucun test malgré son existence dans les 3 apps mobiles

---

## 4. Matrice des scénarios

| ID | Nom du scénario | Applications concernées | Type de test | Description | Statut |
|---|---|---|---|---|---|
| FIN-01 | Invariants financiers combinatoires | API | Unitaire | Totaux de commande cohérents sur matrice de dimensions (livraison, coupon, taxe, addons) | ✅ Couvert |
| FIN-02 | Fuzzing financier 200 scénarios | API | Unitaire (property-based) | Invariants tenus sur 200 commandes aléatoires | ✅ Couvert |
| FIN-03 | Rollback commande + libération coupon sur échec wallet | API | Unitaire | Échec débit wallet → suppression commande + libération du coupon réclamé | ✅ Couvert |
| FIN-04 | Split des gains équilibré (SET-05) | API | Unitaire | Somme des parts (rider/store/plateforme) = montant collecté | ✅ Couvert |
| FIN-05 | Plafonnement commission rider | API | Unitaire | Commission ne peut dépasser les frais de livraison | ✅ Couvert |
| FIN-06 | Autorité serveur sur prix/quantité | API | Unitaire | Client ne peut injecter prix/quantité invalides | ✅ Couvert |
| CNC-01 | Course sur coupon single-use | API | Unitaire (concurrence simulée) | Une seule réclamation gagne parmi N concurrentes | ✅ Couvert |
| CNC-02 | Course entre deux livreurs (claim) | API + Rider + Store + Customer | E2E ad-hoc (script) | Premier `assignOrder` gagne, second reçoit conflit, disparition liste temps réel | ✅ Couvert |
| CNC-03 | Annulation store pendant course rider | API + Store + Rider + Customer | E2E ad-hoc (script) | Propagation cohérente à toutes les parties sans reload | ✅ Couvert |
| SM-01 | Garde-fou : store ne peut accepter commande d'un autre restaurant | API + Store + Customer | E2E ad-hoc (script) | Rejet avec message attendu | ✅ Couvert |
| SM-02 | Garde-fou : store ne peut annuler après PICKED | API | Unitaire + E2E ad-hoc | Rejet | ✅ Couvert |
| SM-03 | Garde-fou : client ne peut annuler après ASSIGNED | API | Unitaire + E2E ad-hoc | Rejet | ✅ Couvert |
| SM-04 | Garde-fou : rider ne peut réclamer commande déjà prise/terminée | API | E2E ad-hoc (script) | Rejet "already claimed" | ✅ Couvert |
| MIN-01 | Minimum de commande refusé | API + Customer | Unitaire + E2E ad-hoc | Rejet API avec message | ✅ Couvert |
| RT-01 | Propagation commande store sans reload | API + Store | E2E ad-hoc (script) | Nouvelle commande visible via subscription | ✅ Couvert |
| RT-02 | Non-réception rider au stade PENDING | API + Rider | E2E ad-hoc (script) | Absence de notification/liste avant ACCEPT | ✅ Couvert |
| RT-03 | Ring temps réel à markOrderPrepared | API + Rider | E2E ad-hoc (script) | Modal Accept/Reject apparaît en <20s pour rider inactif | ✅ Couvert |
| RT-04 | Non-régression statut après markOrderPrepared post-assignation | API | E2E ad-hoc (script) | Statut reste ASSIGNED | ✅ Couvert |
| RT-05 | Double confirmation de livraison | API + Rider + Customer | E2E ad-hoc (script) | DELIVERED atteint seulement après confirmation client | ✅ Couvert |
| AUTH-01 | Login admin valide/invalide | Admin | E2E (Playwright + Cypress) | Redirection / message d'erreur Clerk | ✅ Couvert |
| AUTH-02 | Accès protégé sans session | Admin | E2E (Playwright) | Redirection vers login | ✅ Couvert |
| AUTH-03 | Login store avec bug "Missing bearer token" | Store | E2E ad-hoc (script) | Régression : plus d'erreur UNAUTHENTICATED | ✅ Couvert |
| AUTH-04 | Login rider avec session existante | Rider | E2E ad-hoc (script) | Régression : redirection home au lieu d'erreur | ✅ Couvert |
| NAV-01/02/03 | Navigation par onglets sans reload | Customer/Store/Rider | E2E ad-hoc (script) | SPA/expo-router, pas de full reload | ✅ Couvert |
| CRASH-01 | Repro crash order-details rider | Rider | E2E ad-hoc (script, non assertif) | Capture du crash BottomSheetScrollView | 🟡 Repro seul, pas de fix vérifié par assertion |
| CRUD-01 | CRUD restaurant admin | Admin | E2E (Cypress) | Create/edit/delete restaurant | 🟡 Écrit, exécution non confirmée |
| CRUD-02 | CRUD rider admin | Admin | E2E (Cypress) | Ajout rider + assignation dispatch | 🟡 Écrit, exécution non confirmée |
| CRUD-03 | Persistance configuration | Admin | E2E (Cypress) | Modifie `orderIdPrefix`, reload, vérifie | 🟡 Écrit, exécution non confirmée |
| SMOKE-01..40+ | Chargement de page sans erreur console/GraphQL | Admin | E2E (Playwright) | ~40+ pages admin (dashboard, management/*, wallet/*, store-admin/*, vendor-admin/*) | ✅ Couvert (surface) mais 🟡 en profondeur |
| MOB-01 | Calcul frais de livraison | Customer (mobile) | Unitaire | fixe/par-km/paliers, arrondi, clamp | ✅ Couvert |
| MOB-02 | Upload/compression image store | Store (mobile) | Unitaire | Permission refusée, resize, upload Cloudinary | ✅ Couvert |
| MOB-03 | Intégrité fichiers i18n | Store + Rider (mobile) | Unitaire | Toutes locales chargent, pas de clé avec espace | ✅ Couvert |
| CHK-01 | Formulaire checkout UI (adresse, paiement) | Customer (web + mobile) | — | — | ❌ Non couvert |
| PAY-01..04 | Intégration Stripe/Paypal/Flouci/COD (UI) | Customer (mobile) | — | — | ❌ Non couvert (COD couvert côté API/E2E ad-hoc uniquement) |
| CART-01 | Panier (ajout/édition/suppression) | Customer (web + mobile) | — | — | ❌ Non couvert |
| MENU-01 | CRUD menu/catégorie/option store UI | Store | — | — | ❌ Non couvert |
| OFFER-01 | Affichage/application offre côté client | Customer | — | — | ❌ Non couvert |
| HIST-01 | Historique de commandes | Customer/Store/Rider | — | — | ❌ Non couvert |
| STAFF-01 | Gestion du staff admin | Admin | — | — | ❌ Non couvert (page absente de toute suite) |

---

*(Suite : voir PART3 pour les cas limites, la concurrence, le financier, le temps réel, la sécurité, les zones sans couverture, et les recommandations.)*
