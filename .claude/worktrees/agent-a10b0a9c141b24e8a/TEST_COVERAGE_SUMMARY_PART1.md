# Audit de couverture de tests — Enatega Multivendor (Partie 1/3)

> Document généré pour analyse externe (LLM tiers). Objectif : donner une image complète et fidèle de la stratégie de test réelle du projet — ce qui est testé, comment, et ce qui ne l'est pas — sans nécessiter d'accès au code source.
>
> **Sommaire des 3 fichiers**
> - PART1 (ce fichier) : Vue d'ensemble + Couverture par application
> - PART2 : Couverture par domaine métier + Matrice des scénarios
> - PART3 : Cas limites, concurrence, financier, temps réel, sécurité, zones sans couverture, recommandations

---

## 1. Vue d'ensemble

### 1.1 Nombre total de tests (estimation par catégorie)

| Catégorie | Fichiers | Cas de test estimés | Statut CI |
|---|---|---|---|
| Backend API — Jest unitaires (`*.spec.ts`) | 57 | ~313 `it(`/`test(` | Probablement en CI (`npm test` = `jest`) |
| Admin — Playwright E2E (`tests/e2e/*.spec.ts`, 25 fichiers) | 25 | ~61 (revendiqué dans `QA_REPORT.md`) | Local uniquement (pas de preuve de CI ; `.auth-state.json`, `report/`, `run*.log` = exécutions locales) |
| Admin — Playwright audit console (`audit-console.spec.ts`) | 1 | ~29 (une par page, boucle paramétrée) | Local |
| Admin — Playwright timing (`navigation-timing.spec.ts`) | 1 | 1 script (mesure, **aucune assertion bloquante**) | Local, observabilité seule |
| Admin — Cypress (`cypress/e2e/*.cy.ts`) | 5 réels + 1 scaffold | ~12 | **Aucune preuve d'exécution récente** — probablement non vérifiés en pratique (voir §2) |
| Web — Cypress | 1 (scaffold uniquement) | 0 | Aucun test réel |
| App mobile client — Jest | 1 | ~4-5 | `npm test` configuré mais très peu de fichiers |
| App mobile store — Jest | 1 | ~4 | `test` = `jest --watchAll --passWithNoTests` (passe même à 0 test) |
| App mobile rider — Jest | 1 | ~3 | idem, `--passWithNoTests` |
| Scripts N2N ad-hoc multi-apps (`enatega-multivendor-admin/scripts/*.js`) | 9 | ~30-40 assertions PASS/FAIL réparties dans 9 scripts | **Hors CI**, exécution manuelle (`node scripts/xxx.js`) contre un environnement local démarré à la main |

**Total approximatif de cas de test automatisés formels (Jest/Playwright/Cypress) : ~430.**
**Total de scénarios métier vérifiés par scripts N2N ad-hoc (hors suite formelle) : ~9 scripts, dont 2 scripts de bout-en-bout multi-comptes (`test-real-world-scenarios.js`, `test-order-propagation.js`) couvrant à eux seuls plus d'une douzaine d'assertions métier critiques (courses concurrentes, annulations, garde-fous state machine, temps réel).**

### 1.2 Nombre de suites

- 1 suite Jest backend (mono-repo `enatega-multivendor-api`, config dans `package.json`, `testEnvironment: node`, `testRegex: .*\.spec\.ts$`)
- 1 suite Playwright admin (`playwright.config.ts`, `testDir: ./tests`, 1 projet Chromium, `workers: 2`, `retries: 1`)
- 1 suite Cypress admin, 1 suite Cypress web (quasi vide)
- 3 suites Jest mobile indépendantes (une par app : client / store / rider), toutes minimales
- 9 scripts Node/Playwright indépendants (pas une "suite" au sens outillé — chacun est un fichier exécutable autonome, sans runner commun, sans rapport agrégé)

### 1.3 Applications couvertes

| Application | Stack | Port | Couverture de test |
|---|---|---|---|
| `enatega-multivendor-api` | NestJS + GraphQL code-first + Mongoose | 4000 | **Forte en unitaire (logique métier/financière), nulle en intégration/E2E GraphQL** |
| `enatega-multivendor-admin` | Next.js 14 App Router + Apollo | 3000 | **Large en surface (smoke tests sur ~40+ pages) mais très peu profonde (quasi aucune mutation réellement soumise/vérifiée)** |
| `enatega-multivendor-web` | Next.js 16 App Router + Apollo | 3001 | **Quasi nulle** (scaffold Cypress uniquement) |
| `enatega-multivendor-app` (client) | Expo SDK 56 / React Native | 8083 (web preview) | **Très faible** (1 fichier de tests unitaires purs) + scénarios ad-hoc via scripts multi-apps |
| `enatega-multivendor-store` (vendeur) | Expo SDK 56 / expo-router | 8084 | **Très faible** (1-2 fichiers unitaires) + scénarios ad-hoc |
| `enatega-multivendor-rider` (livreur) | Expo SDK 56 / expo-router | 8085 | **Très faible** (i18n uniquement en unitaire) + scénarios ad-hoc (les plus nombreux, car le rider concentre plusieurs bugs temps réel historiques) |

### 1.4 Technologies utilisées

- **Backend** : Jest + ts-jest, mocks manuels de Mongoose/services (aucun `mongodb-memory-server`, aucune base de test réelle)
- **Admin** : Playwright (`@playwright/test`) pour le E2E "smoke", Cypress pour des scénarios CRUD plus riches (mais non vérifiés en pratique), scripts Node bruts avec `playwright` (chromium) pour les probes multi-apps
- **Web** : Cypress (scaffold seulement)
- **Mobile (3 apps)** : Jest + `jest-expo`, aucun framework d'E2E mobile (pas de Detox, Maestro, Appium, ni React Native Testing Library)
- **Scripts N2N** : Playwright `chromium.launch()` piloté à la main, combinant interactions UI réelles (login) et appels GraphQL directs via `fetch` avec les tokens Clerk extraits de la session navigateur (`window.Clerk.session.getToken()`)

### 1.5 Outils de test

| Outil | Usage |
|---|---|
| Jest / ts-jest | Tests unitaires backend (mocks complets) et mobile |
| jest-expo | Preset Jest pour les 3 apps Expo |
| Playwright | E2E admin (suite formelle `tests/e2e/`) + scripts ad-hoc multi-apps |
| Cypress | E2E admin (scénarios CRUD plus profonds, statut d'exécution incertain) + scaffold web inutilisé |
| `_helpers.ts` (admin) | Helper Playwright maison : capture console/`pageerror`/erreurs GraphQL avec une liste de bruit (`NOISE_PATTERNS`) à ignorer, `assertNoErrors` |
| `global-setup.ts` (admin) | Authentification unique en amont de la suite Playwright, réutilisation via `storageState` (`.auth-state.json`) |
| Scripts ad-hoc `enatega-multivendor-admin/scripts/*.js` | Probes manuelles multi-comptes (customer/store/rider simultanés) pour valider la propagation temps réel et les garde-fous métier — **pas de dépendance framework de test, juste `playwright` + `console.log` PASS/FAIL** |

---

## 2. Couverture par application

### 2.1 `enatega-multivendor-api` (backend)

**Fonctionnalités testées (unitairement, avec mocks) :**
- Moteur financier des commandes : normalisation Money, invariants de totaux (matrice combinatoire + campagne de fuzzing 200 scénarios aléatoires), autorité serveur sur quantités/prix/taxes/frais de livraison, gestion des remboursements/rollbacks
- Coupons : validation (code inconnu, désactivé, expiré, hors fenêtre, mauvaise portée), limites d'usage atomiques (course à la ressource, libération/réclamation)
- Wallet (portefeuille) : retraits (approve/reject/refund), split des gains (commission, pourboire, frais de livraison, taxes), plafonnement de la commission
- Dispatch et tracking temps réel : sélection des livreurs (fallback Mongo + Redis), tokens de tracking scopés, présence, trajectoire
- Notifications push : forme des payloads, hygiène des tokens invalides
- Paiements : initiation/confirmation, idempotence des tentatives, recharge wallet
- Identité/ownership : résolution `clerkId` ↔ `_id` Mongo pour owners/riders/users/restaurants, synchronisation Clerk (email/mot de passe)
- Catalogue, configuration, offres, fidélité : arithmétique en unité mineure (minor units), arrondis, plafonds de remise
- Estimation de livraison/frais : formules fixe/par-km/paliers, cache, fallback statique
- Utilitaires : horaires d'ouverture (fuseaux horaires, chevauchement de minuit), classe `Money` (arrondi half-even), scripts de backfill de migration

**Fonctionnalités NON testées (aucun fichier `.spec.ts`) :**
- **Guards d'authentification/autorisation** (`ClerkAuthGuard`, `RolesGuard`, `gql-throttler.guard`, webhook Clerk) — zéro test direct malgré leur rôle central
- Zones (CRUD/géométrie), Banners, Chat, Countries, Dashboard (agrégations admin), Health check, Staff, Support-tickets, Taxations (CRUD, seule l'*utilisation* du taux est testée indirectement), Tippings (module en tant que tel), User-notifications, Activity/Audit log
- Cuisines/Shop-types/Sub-categories : un seul scénario chacun (garde-fou de suppression), pas de create/update/list

**Principaux scénarios couverts :** invariants financiers multi-dimensions, course à la ressource sur coupons à usage unique, rollback wallet/coupon en cascade, autorité serveur sur les prix/quantités/taxes/frais, split de gains équilibré (SET-05 : les parts recomposent le montant collecté), state machine des commandes (ouverture horaires, pause manuelle, commandes programmées), sélection de livreurs par présence Redis+Mongo, latence de subscription (<100ms).

**Principaux scénarios absents :** tests d'intégration GraphQL de bout en bout (aucun `supertest` contre le schéma réel), tests des guards d'auth eux-mêmes, tests de charge/perf, tests de migration de schéma en conditions réelles (les tests de backfill sont des tests de fonctions pures, pas des tests contre une vraie base).

---

### 2.2 `enatega-multivendor-admin` (dashboard admin)

**Fonctionnalités testées :**
- Authentification complète (login valide/invalide, redirection protégée, session persistée) — le seul flux réellement "profond" de la suite Playwright
- Chargement sans erreur (console/GraphQL) de ~40+ pages : dashboard, users, riders, stores, vendors, banners, coupons, cuisines, shop-types, orders, dispatch, zones, wallet (earnings/transaction-history/withdraw-requests), configurations, commission-rates, tippings, settings/language, audit-logs, customer-support, notifications, 13 pages store-admin, 3 pages vendor-admin
- Ouverture (sans soumission) des dialogues d'ajout coupon/cuisine/shop-type
- Cypress (statut d'exécution incertain — voir plus bas) : login/erreur Clerk, sauvegarde+persistance d'un champ de configuration après reload, changement de statut d'une commande, CRUD complet d'un restaurant (create/edit/delete), ajout d'un rider, assignation d'un rider à une commande via Dispatch

**Fonctionnalités NON testées :**
- `general/staff` — absent de toutes les listes de test, y compris `audit-console.spec.ts`
- `management/offers` — absent de toute suite
- Sous-onglets `admin/store/general/location`, `general/payment`, `general/timing` (seul l'onglet parent est smoke-testé)
- Toute soumission réelle de formulaire dans la suite Playwright (les tests "dialog" s'arrêtent au remplissage, jamais au clic Save)
- Vérification fonctionnelle des résultats de recherche (le texte est tapé, mais la liste filtrée n'est jamais comparée)

**Principaux scénarios couverts :** absence d'erreurs console/GraphQL sur presque toute la surface de l'app (25 specs Playwright + audit-console 29 pages), authentification complète, CRUD Cypress sur restaurant/rider/configuration/commande (si ces tests sont effectivement exécutés — voir doute ci-dessous).

**Principaux scénarios absents :** aucune vérification de mutation de données de bout en bout dans la suite Playwright officielle (source principale de confiance actuelle), aucun test de permissions/rôles granulaires dans l'UI, aucun test de pagination/tri/export, aucun test d'accessibilité automatisé.

> **Point d'attention méthodologique** : les 5 specs Cypress réelles (`auth`, `configuration`, `orders`, `restaurant`, `rider`) contiennent des scénarios *nettement* plus profonds que la suite Playwright (vraies mutations, vraies assertions de persistance), mais elles s'appuient massivement sur des sélecteurs `data-testid` **qui n'existent nulle part dans le code source de l'app** (confirmé par recherche exhaustive) — donc ces tests, tels qu'écrits, échoueraient ou retomberaient sur des sélecteurs CSS fragiles. Combiné à l'absence de logs d'exécution récents (contrairement à Playwright qui a des `run*.log`, `.auth-state.json`, captures d'écran), ces specs Cypress sont probablement **écrites mais non vérifiées en pratique** — à traiter comme une couverture "aspirationnelle", pas confirmée.

---

### 2.3 `enatega-multivendor-web` (site client)

**Fonctionnalités testées :** aucune. Seul le scaffold Cypress par défaut (`todo.cy.ts`) est présent, jamais remplacé par de vrais tests.

**Fonctionnalités NON testées (liste des features identifiées dans le code source, sans aucun test) :**
- Découverte/parcours des restaurants, recherche, filtres par catégorie/type de commerce
- Panier et checkout complet
- Suivi de commande en temps réel, historique des commandes
- Gestion de compte/profil, adresses
- Wallet et fidélité
- Support client/tickets
- Carte (mapview), suivi du livreur

**Conclusion : couverture de test nulle pour l'intégralité de l'application web cliente.**

---

### 2.4 `enatega-multivendor-app` (application client mobile)

**Fonctionnalités testées :** uniquement la fonction pure `calculateAmount` (calcul des frais de livraison : fixe / par-km / paliers, avec arrondi et clamp) dans `customFunctions.test.ts`. Plus, de façon indirecte, un sous-ensemble du flux de commande via les scripts N2N ad-hoc décrits en PART3 (§ scripts, S1-S5, propagation).

**Fonctionnalités NON testées (aucun test unitaire ni E2E formel) :** navigation par onglets (validée seulement par script ad-hoc), panier/checkout, paiements (Stripe/Paypal/Flouci/COD — 4 intégrations de paiement, aucune testée), gestion des adresses (CRUD), favoris, notes/avis, chat avec le livreur, recherche, réapprovisionnement (reorder), notifications, profil/paramètres.

**Principaux scénarios couverts :** calcul des frais de livraison (unitaire), navigation SPA sans reload (ad-hoc), flux de commande bout-en-bout via API directe (ad-hoc), non-réception de notification au stade PENDING (ad-hoc), confirmation de livraison double (ad-hoc).

**Principaux scénarios absents :** tout le reste — en particulier les 4 gateways de paiement ne sont couvertes par **aucun** test, quel qu'il soit.

---

### 2.5 `enatega-multivendor-store` (application vendeur)

**Fonctionnalités testées :** upload/compression d'image (permissions refusées, redimensionnement, upload Cloudinary) dans `prepare-image-upload.spec.ts`. Plus, via scripts ad-hoc : acceptation de commande, marquage "préparée", navigation par onglets.

**Fonctionnalités NON testées :** dashboard/gestion des commandes en UI (au-delà de l'accept/prepare API), gestion du menu (food/catégories/options/add-ons), coupons côté store, earnings/wallet/bank-management, offres, notes/avis, paramètres du magasin (localisation, paiement, horaires).

**Principaux scénarios couverts :** upload d'image, garde-fou "no-op silencieux d'Alert.alert sur web" corrigé mais non testé formellement (juste documenté en commentaire), navigation SPA, accept/prepare via API.

**Principaux scénarios absents :** CRUD menu complet, gestion des retraits bancaires, offres, ratings.

---

### 2.6 `enatega-multivendor-rider` (application livreur)

**Fonctionnalités testées :** intégrité i18n uniquement en unitaire (pas de logique métier testée en Jest). C'est l'app la plus couverte par les **scripts ad-hoc** (5 des 9 scripts ciblent spécifiquement le rider), reflet d'un historique de bugs temps réel/web-preview sur cette app (cf. mémoire projet : sonnerie à PENDING au lieu de PREPARED, crash `order-details`, no-op `Alert.alert` sur web).

**Fonctionnalités NON testées :** navigation/carte, calcul d'itinéraire, earnings/wallet/bank-management, work-schedule/zone/vehicle-type, chat, historique de commandes, profil/paramètres.

**Principaux scénarios couverts (via scripts ad-hoc, pas de suite formelle) :** réclamation de commande dès ACCEPT, sonnerie temps réel sur `markOrderPrepared` pour un rider inactif sur l'écran d'accueil, transition d'écran après "marquer livré" (COD), navigation SPA par onglets, non-régression du statut ASSIGNED après `markOrderPrepared`.

**Principaux scénarios absents :** tout ce qui touche à la carte/géolocalisation en conditions réelles, la gestion des retraits, les paramètres de disponibilité (zone/horaires/véhicule).

---

*(Suite : voir PART2 pour la couverture par domaine métier et la matrice complète des scénarios.)*
