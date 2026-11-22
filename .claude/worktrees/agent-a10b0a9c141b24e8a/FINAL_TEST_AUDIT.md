# Audit final — Campagne de remédiation de la couverture de tests

> Suite autonome à `TEST_COVERAGE_SUMMARY_PART1/2/3.md`. Ce document rapporte le travail effectué pendant la session de remédiation : tests ajoutés, bugs trouvés et corrigés, scénarios désormais couverts, ce qui a été volontairement laissé de côté, les risques restants, et une auto-évaluation.
>
> Travail effectué directement sur `main`, 7 commits, tous poussés sur `origin/main`.

---

## 1. Résumé exécutif

- **7 commits** poussés directement sur `main` (pas de branche, pas de PR, conformément à la consigne).
- **115 nouveaux tests unitaires backend** ajoutés (11 nouveaux fichiers de spec + additions dans 2 fichiers existants), portant la suite Jest de l'API de **~325 à 440 tests passants, sur 71 suites** (0 échec, 0 régression).
- **2 bugs de production réels trouvés et corrigés**, chacun avec des tests de non-régression :
  1. **Financier (P0)** — les commandes payées en ligne (FLOUCI) n'étaient jamais remboursées à l'annulation.
  2. **Sécurité (P0)** — trois mutations GraphQL (upload d'image, signature Cloudinary, enregistrement de token push) n'avaient **aucun guard d'authentification**, permettant un détournement de notifications push et un abus de stockage par un appelant non authentifié.
- Le périmètre couvert cette session est **exclusivement le backend** (`enatega-multivendor-api`). Le travail sur les 5 frontends (admin, web, 3 apps mobiles) a été explicitement écarté — voir section 4 pour la justification détaillée.
- La suite complète du backend a été relancée en fin de session : **71/71 suites vertes, 440/440 tests verts**, `npm run build` (nest build) sans erreur.

---

## 2. Nouveaux tests ajoutés

### 2.1 Sécurité / authentification (P0) — 42 tests, 6 fichiers

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `src/auth/clerk-auth.guard.spec.ts` | 11 | Token manquant/mal formé rejeté, token invalide/expiré rejeté, rôle lu depuis `publicMetadata` du token, fallback vers `clerkClient.users.getUser()` avec cache TTL 60s, non-mise en cache d'un rôle non résolu (retry), défaut `CUSTOMER` si aucun rôle trouvé, lecture du token depuis `connectionParams` (WebSocket, header direct ou imbriqué), `authorizedParties` transmis à `verifyToken`. |
| `src/auth/roles.guard.spec.ts` | 6 | Refus par défaut sans `@Roles()`, refus sur liste de rôles vide, refus sans utilisateur authentifié, refus sur rôle non autorisé, autorisation sur rôle correspondant, lecture de l'utilisateur depuis le contexte WebSocket. |
| `src/auth/gql-throttler.guard.spec.ts` | 4 | Extraction de la requête/réponse HTTP standard, fallback `extra.request` (graphql-ws), synthèse d'une requête minimale à partir de `connectionParams.ip`, défaut `"graphql-ws"` si aucune IP disponible. |
| `src/auth/clerk-webhook.controller.spec.ts` | 11 | Rejet si signature svix invalide, vérification avec le secret configuré, routage `user.created`/`user.updated` vers `UsersService` (CUSTOMER) ou `OwnersService` (ADMIN/VENDOR), non-provisioning pour STORE/RIDER (liés séparément par l'admin), désactivation double (`Promise.allSettled`) sur `user.deleted`, tolérance à l'échec partiel, ignorance des types d'événements inconnus. |
| `src/auth/clerk-role-conflict.util.spec.ts` | 7 | Promotion autorisée depuis un compte sans rôle ou `CUSTOMER`, ré-promotion idempotente vers le même rôle, rejet de réutilisation d'un compte ADMIN/VENDOR/RIDER pour un rôle différent, message d'erreur contextualisé. |
| `src/uploads/uploads.resolver.spec.ts` | 4 | Guard appliqué au niveau de la classe (vérifié via métadonnées réfléchies `__guards__`), `uploadToken` utilise désormais l'identité authentifiée et non un `id` fourni par le client. |

### 2.2 Financier / concurrence — 8 tests, 2 fichiers modifiés

| Fichier | Tests ajoutés | Ce qui est vérifié |
|---|---|---|
| `src/orders/orders.service.spec.ts` (bloc FIN-07 ajouté) | 7 | `abortOrder` rembourse un paiement FLOUCI capturé (bug corrigé), continue de rembourser WALLET (non-régression), ne tente aucun remboursement pour une commande COD non payée ; `cancelOrder` (store) rembourse FLOUCI et ignore COD ; `updateStatus` (admin, `CANCELLED` et `CANCELLEDBYREST`) rembourse FLOUCI. |
| `src/customer-wallet/customer-wallet.service.spec.ts` (test CNC-04 ajouté) | 1 | Deux débits concurrents dont la somme dépasse le solde : un seul réussit, l'autre est rejeté (simulation de l'atomicité `findOneAndUpdate` + garde `$expr`). |

### 2.3 Modules backend auparavant à couverture nulle (P1) — 65 tests, 8 fichiers

| Fichier | Tests | Domaine |
|---|---|---|
| `src/zones/zones.service.spec.ts` | 11 | Requête géospatiale `$geoIntersects`, création avec conversion en GeoJSON Polygon, édition partielle, **suppression bloquée si des livreurs sont encore rattachés à la zone** (intégrité référentielle). |
| `src/taxations/taxations.service.spec.ts` | 7 | Valeurs par défaut à la création, garde `_id` requis, `NotFoundException` si absent, patch partiel (taux vs activation indépendants). |
| `src/tippings/tippings.service.spec.ts` | 7 | Config singleton, valeurs par défaut, patch partiel des paliers de pourboire. |
| `src/audit/audit.service.spec.ts` | 4 | Forme de l'entrée d'audit (identité admin, action, cible, diff, horodatage), pagination (skip/limit/totalPages), payload de changement optionnel. |
| `src/support-tickets/support-tickets.service.spec.ts` | 7 | Création de ticket scopée à l'utilisateur, `NotFoundException` sur ticket/message inconnu, résolution du `senderType` (défaut vs explicite), transition de statut. |
| `src/banners/banners.service.spec.ts` | 8 | Filtrage des bannières inactives, valeurs par défaut, patch partiel (undefined ignorés), suppression idempotente (true/false). |
| `src/dashboard/dashboard.service.spec.ts` | 15 | Résolution `buildDateRange` (today/yesterday/month/year, alias insensibles à la casse, fallback dates explicites, mot-clé inconnu), calcul `pct` (croissance positive/négative, division par zéro → 0, croissance depuis zéro → 100, arrondi), requêtes vendeur avec zéro restaurant (4 endpoints retournent des zéros propres au lieu de planter). |
| `src/user-notifications/user-notifications.service.spec.ts` | 9 | Valeurs par défaut à la création, sérialisation JSON des données structurées, pagination par défaut, **`markRead`/`markAllRead` scopés à la fois aux ids ET au `userId` appelant** (un utilisateur ne peut pas marquer comme lues les notifications d'un autre). |

---

## 3. Bugs corrigés

### 3.1 [FINANCIER — P0] Absence de remboursement des paiements en ligne annulés

**Fichier** : `enatega-multivendor-api/src/orders/orders.service.ts`
**Commit** : `c7b2db80`

**Symptôme** : les trois chemins d'annulation de commande (`abortOrder` côté client, `cancelOrder` côté store, `updateStatus` côté admin) ne remboursaient le portefeuille client que si `paymentMethod === 'WALLET'`. Une commande payée en ligne (FLOUCI, la seule méthode de paiement en ligne active du projet) qui était annulée restait avec `orderStatus: CANCELLED` et `paymentStatus: PAID` — **l'argent du client restait capturé sans aucun remboursement automatique**, silencieusement, dans les trois chemins.

**Preuve que ce n'était pas un comportement voulu** : la mutation admin manuelle `refundOrderToWallet` (déclenchée à la main par un admin qui remarque le problème) traite déjà n'importe quelle commande `PAID` comme remboursable, quelle que soit la méthode de paiement — confirmant que le comportement automatique était une incohérence, pas un choix produit.

**Correctif** : la condition de remboursement est désormais basée sur `paymentStatus === 'PAID'` seul (au lieu de `paymentMethod === 'WALLET' && paymentStatus === 'PAID'`). Une commande COD n'atteint jamais `paymentStatus: PAID` avant la livraison (vérifié dans le code), donc ce changement ne peut pas rembourser à tort une commande cash non encaissée.

**Tests de non-régression** : 7 tests dans `orders.service.spec.ts` (bloc FIN-07), couvrant les 3 chemins × FLOUCI/WALLET/COD.

**Impact avant correction** : en production, chaque annulation d'une commande payée par FLOUCI (par le client, le restaurant, ou un admin) aurait résulté en une perte d'argent réelle pour le client, sans mécanisme de récupération automatique. C'est le type de bug qui génère des tickets support, des chargebacks, et une perte de confiance — exactement la catégorie de risque qu'un audit pré-production doit intercepter.

### 3.2 [SÉCURITÉ — P0] Mutations GraphQL sans authentification

**Fichier** : `enatega-multivendor-api/src/uploads/uploads.resolver.ts`
**Commit** : `f382f189`

**Symptôme** : contrairement à toutes les autres mutations de l'API (qui appliquent systématiquement `ClerkAuthGuard`), trois mutations dans `uploads.resolver.ts` n'avaient **aucun guard** :
- `uploadImageToS3` — n'importe quel appelant non authentifié pouvait faire uploader une image arbitraire (base64) vers le stockage S3 de la plateforme.
- `createCloudinaryUploadSignature` — n'importe quel appelant non authentifié pouvait obtenir une signature d'upload Cloudinary valide, permettant d'uploader librement vers le compte Cloudinary de la plateforme (abus de coût, de stockage, risque d'hébergement de contenu illégal).
- `uploadToken` — prenait un argument `id` fourni **directement par le client**, sans aucune vérification qu'il correspondait à l'appelant. N'importe qui pouvait enregistrer un token de notification push pour **n'importe quel identifiant utilisateur**, détournant ainsi les notifications de commande d'une victime vers un appareil contrôlé par l'attaquant.

**Analyse d'usage réel** : une recherche exhaustive dans les 6 apps confirme que `uploadImageToS3` et `createCloudinaryUploadSignature` sont activement utilisées (admin, store, rider) par des utilisateurs déjà authentifiés au moment de l'appel — ajouter un guard n'a donc **aucun impact fonctionnel** sur les parcours légitimes. `uploadToken` en revanche s'est révélé être du **code mort** : aucune app n'appelle réellement cette mutation par son nom GraphQL — le seul « faux positif » trouvé lors de la recherche était une variable JavaScript locale nommée `uploadToken` dans l'app client, qui pointe en réalité vers une mutation différente et déjà correctement authentifiée (`pushToken`, dans `notifications.resolver.ts`) selon le même principe (`@CurrentUser()` plutôt qu'un id client).

**Correctif** : ajout de `@UseGuards(ClerkAuthGuard)` au niveau de la classe du resolver (tout rôle authentifié suffit, aucune restriction de rôle nécessaire), et `uploadToken` utilise désormais `jwtUser.userId` (l'identité authentifiée) au lieu de l'argument `id` fourni par le client — exactement le même schéma que les mutations `pushToken` et `saveNotificationTokenWeb` déjà correctes ailleurs dans le code.

**Tests de non-régression** : nouveau fichier `uploads.resolver.spec.ts` (4 tests) — auparavant ce resolver n'avait **aucune** couverture de test, ce qui explique pourquoi ce trou de sécurité n'avait jamais été détecté.

**Impact avant correction** : un attaquant ayant connaissance du schéma GraphQL (introspection, ou `schema.gql` exposé) aurait pu détourner les notifications push de n'importe quel utilisateur, ou consommer les quotas de stockage Cloudinary/S3 de la plateforme sans aucune barrière.

---

## 4. Scénarios désormais couverts (synthèse)

- L'intégralité de la surface d'authentification/autorisation de l'API (guards Clerk, RBAC, webhook, throttling, conflits de rôle) — auparavant **zéro test**, maintenant 42 tests.
- Remboursement automatique cohérent sur les 3 chemins d'annulation, pour les 2 méthodes de paiement capturables (WALLET, FLOUCI) et non-déclenchement sur COD.
- Concurrence : débit simultané du portefeuille client au-delà du solde disponible (CNC-04), en complément des scénarios de concurrence déjà couverts avant cette session (coupons, course entre livreurs).
- Zones : géo-requête, CRUD, intégrité référentielle à la suppression (livreurs rattachés).
- Reporting/dashboard : logique de plage de dates et de calcul de croissance en pourcentage, y compris les cas limites (division par zéro, croissance depuis zéro), et comportement propre pour un vendeur sans restaurant.
- Notifications utilisateur : scoping strict par utilisateur sur les opérations de lecture/marquage (sécurité applicative, pas seulement fonctionnelle).
- Modules taxations, tippings, banners, audit, support-tickets : CRUD, gardes `NotFoundException`, sémantique de patch partiel.
- Sécurité applicative sur les mutations d'upload/token push (voir §3.2).

## 5. Scénarios volontairement laissés de côté (avec justification)

Cette session s'est concentrée **exclusivement sur le backend** (`enatega-multivendor-api`). Les lacunes suivantes, identifiées dans `TEST_COVERAGE_SUMMARY_PART1/2/3.md`, restent **non traitées** :

| Scénario laissé de côté | Justification |
|---|---|
| **Parcours utilisateur final complet** (panier, checkout, 4 gateways de paiement, historique) sur web et mobile | Nécessite des serveurs de dev démarrés (API + Expo web previews + admin/web Next.js) et une interaction navigateur réelle (Playwright), pas seulement des tests unitaires. Hors du périmètre exécutable de façon autonome et fiable dans cette session sans supervision humaine pour valider visuellement les résultats. C'est la plus grosse lacune du projet — voir risques restants. |
| **Tests d'intégration GraphQL de bout en bout** (supertest contre le schéma réel, avec guards/pipes/interceptors) | Absents avant cette session, toujours absents après. Nécessite une infrastructure de test dédiée (base MongoDB de test ou `mongodb-memory-server`, configuration Apollo de test) qui n'existe pas dans le repo — l'introduire est un changement d'infrastructure de test, pas une correction ponctuelle, et risquait de consommer tout le budget de la session sans garantir un résultat stable. Recommandé comme prochain chantier dédié. |
| **Suite de tests Cypress admin** (probablement non fonctionnelle — sélecteurs `data-testid` inexistants dans le code) | Corriger Cypress nécessite soit d'ajouter des `data-testid` dans des dizaines de composants admin (risque de régression visuelle/CSS si mal fait), soit de réécrire les sélecteurs — un chantier frontend, pas backend, hors périmètre de cette session. |
| **Réparation des suites Jest mobile store/rider** (échec `clearMocksOnScope is not a function` sur store, échec `getChangedFilesPromise`/`onlyChanged` sur rider) | **Confirmé pré-existant, non causé par cette session** (aucun fichier de `enatega-multivendor-store` ou `enatega-multivendor-rider` n'a été modifié). Cause probable : dérive de version entre `jest` et `jest-mock` dans `node_modules` (store : jest 30.4.2 vs jest-mock 30.4.1) et un environnement CLI incompatible côté rider (jest 25 très ancien vs `jest-expo` récent). Corriger ceci implique de toucher aux dépendances/lockfile d'apps Expo natives (risque de casser des builds Android/iOS déjà fonctionnels) sans pouvoir valider visuellement le résultat sur un émulateur pendant cette session autonome — jugé trop risqué à corriger à l'aveugle. **Documenté comme risque restant, pas corrigé.** |
| **Détox/Maestro/E2E mobile natif** | Aucune infrastructure de ce type n'existe dans le repo ; l'introduire est un chantier d'outillage complet (choix d'outil, configuration CI, écriture de scénarios), largement hors du périmètre d'une session de remédiation de tests. |
| **Intégration réelle des providers de paiement** (Stripe/Paypal/Flouci, webhooks entrants) | Les ports/adapters sont déjà mockés dans les tests existants ; tester les vrais SDK/webhooks nécessite des identifiants sandbox et un environnement réseau, non disponibles dans cette session. |
| **`general/staff` et `management/offers`** (pages admin totalement absentes de toute suite) | Frontend, nécessite Playwright + serveurs démarrés — même contrainte que le premier point. |
| **Refonte de `updateStatus`/`cancelOrder` au-delà du remboursement** (ex : remboursement partiel, gestion de la TVA sur remboursement) | Hors du périmètre du bug identifié ; le correctif appliqué est volontairement minimal et ciblé pour ne pas élargir la surface de changement au-delà de ce qui a été prouvé cassé. |

---

## 6. Risques restants avant production

Classés par sévérité perçue :

1. **[ÉLEVÉ] Parcours client quasi totalement non testé** (panier, checkout, paiement) sur web et mobile. C'est le chemin qui génère le chiffre d'affaires — une régression y serait catastrophique et invisible tant qu'un humain ne teste pas manuellement avant chaque déploiement.
2. **[ÉLEVÉ] Aucun test d'intégration GraphQL bout-en-bout.** Les tests unitaires vérifient la logique métier isolée avec des mocks, mais rien ne prouve que les guards, pipes de validation, et résolveurs fonctionnent ensemble correctement une fois assemblés par NestJS/Apollo au démarrage réel. Un guard mal câblé dans un module (oublié à l'enregistrement) ne serait détecté par aucun test actuel.
3. **[MOYEN] Suites Jest mobile store/rider cassées dans l'environnement actuel.** Même si les fichiers de test eux-mêmes sont corrects, ils ne s'exécutent pas du tout à cause d'un problème de dépendances — ce qui signifie que ces deux apps ont, en pratique, **zéro test qui tourne**, malgré l'existence de fichiers de test écrits.
4. **[MOYEN] Aucun autre resolver n'a été audité aussi systématiquement que `uploads.resolver.ts`.** La découverte de ce trou de sécurité était le fruit d'une recherche ciblée (`grep -rL "UseGuards"`) qui n'a couvert que les fichiers `*.resolver.ts` classiques — les contrôleurs REST (`clerk-webhook.controller.ts` a été audité, mais d'autres pourraient exister), les subscriptions, et les champs résolveurs imbriqués n'ont pas fait l'objet du même balayage exhaustif.
5. **[MOYEN] Remboursement des paiements en ligne : seulement vers le wallet, pas vers le moyen de paiement d'origine.** Le correctif appliqué fait ce que le code faisait déjà pour WALLET (recréditer le wallet interne) — c'est cohérent avec le comportement existant de `refundOrderToWallet`, mais ce n'est **pas** un vrai remboursement Flouci vers la carte/compte du client. Si le produit a besoin d'un vrai remboursement provider, c'est un chantier distinct (API Flouci de remboursement).
6. **[FAIBLE] Aucun test de charge/performance avec assertion bloquante** (le script `navigation-timing.spec.ts` existant mesure mais n'échoue jamais).
7. **[FAIBLE] Aucun test d'accessibilité ou de sécurité XSS/CSRF frontend.**
8. **[FAIBLE] Rate-limiting (`GqlThrottlerGuard`) testé uniquement au niveau extraction de requête**, pas au niveau comportemental réel (la logique de throttling elle-même vient de `@nestjs/throttler`, une librairie tierce déjà testée en amont — risque résiduel faible).

---

## 7. Estimation de la couverture globale du projet

| Périmètre | Avant cette session | Après cette session |
|---|---|---|
| Backend — logique métier/financière | Forte | Forte (inchangée, déjà bonne) |
| Backend — sécurité/auth | **Nulle** | **Forte** (guards, webhook, RBAC, upload/token) |
| Backend — modules périphériques (zones, taxations, tippings, audit, support, banners, dashboard, user-notifications) | Nulle | Bonne (CRUD + gardes + logique métier propre à chaque module) |
| Backend — intégration GraphQL bout-en-bout | Nulle | **Nulle (non traité)** |
| Admin (Playwright/Cypress) | Large en surface, peu profonde | Inchangée |
| Web client | Quasi nulle | Inchangée |
| Mobile (3 apps) | Très faible, scripts ad-hoc hors CI | Inchangée (store/rider cassés dans l'environnement) |

**Estimation chiffrée de la couverture globale du projet (tous périmètres confondus, pondérée par criticité métier) : ~35-40%.**

Cette estimation reste basse malgré les progrès de cette session parce que : (a) le backend ne représente qu'une partie du système, (b) le parcours client — la fonctionnalité la plus critique commercialement — reste presque entièrement non testé, et (c) l'absence de tests d'intégration bout-en-bout signifie que même la partie backend bien couverte en unitaire n'est pas prouvée fonctionner une fois assemblée.

**Avant cette session, l'estimation aurait été d'environ 25-30%** (en cohérence avec l'audit initial) — cette session a donc apporté une amélioration réelle mais partielle, concentrée sur la réduction du risque le plus dangereux (sécurité non testée) plutôt que sur une augmentation uniforme du pourcentage.

---

## 8. Auto-évaluation du niveau de confiance

**Confiance dans la qualité et la fiabilité des tests ajoutés cette session : 85%.**

- Chaque test ajouté a été exécuté et vérifié vert avant commit ; aucun test n'a été écrit sans exécution réelle.
- Les 2 bugs corrigés sont des bugs réels, vérifiés en lisant le code de production (pas des suppositions) et confirmés par une recherche d'usage réel dans les 6 apps avant modification.
- Le build de production (`nest build`) et la suite complète (440 tests) ont été revérifiés après le dernier changement.
- Les 15% manquants reflètent : l'impossibilité de valider ces correctifs contre une vraie base MongoDB/Clerk en conditions réelles (tests unitaires avec mocks uniquement), l'absence de revue humaine indépendante avant push, et le fait qu'un test unitaire bien conçu peut encore rater une interaction inattendue avec un autre module non touché cette session.

**Confiance que le produit est "prêt pour la production" au niveau Glovo/Uber Eats/Bolt Food : 30%.**

Cette note basse n'est pas une critique du travail effectué cette session, mais une évaluation honnête du chemin qu'il reste à parcourir : le parcours client (panier → checkout → paiement) — la fonctionnalité la plus critique commercialement d'une plateforme de livraison — reste presque entièrement non testé sur les 3 surfaces qui comptent (web, app mobile, et leur intégration avec le backend). Un produit de niveau Glovo/Uber Eats a des suites E2E qui couvrent ce parcours sur chaque plateforme, des tests de charge, une infrastructure de test d'intégration bout-en-bout, et des pipelines CI qui bloquent les déploiements sur échec de test — aucun de ces éléments n'existe encore dans ce projet. Cette session a traité les risques les plus dangereux et les plus faciles à corriger de façon autonome et sûre (sécurité non testée, bug financier silencieux) ; les risques restants nécessitent soit une infrastructure de test à construire (intégration bout-en-bout), soit une supervision humaine en temps réel (validation visuelle E2E frontend), qui dépassent le périmètre exécutable seul, sans validation humaine intermédiaire, en une session.

---

## 9. Prochaines étapes recommandées (par ordre de priorité)

1. Construire une infrastructure de test d'intégration GraphQL (mongodb-memory-server + supertest contre le schéma réel) — referme le risque #2 de la section 6, le plus structurant.
2. Réparer l'environnement Jest de `enatega-multivendor-store` et `enatega-multivendor-rider` (dérive de version jest/jest-mock) — risque #3, correction probablement rapide une fois qu'un humain peut valider que les apps continuent de builder normalement après le changement de dépendances.
3. Écrire une suite Playwright réelle pour le parcours panier → checkout → paiement sur `enatega-multivendor-web`, qui n'a aujourd'hui aucun test — risque #1, le plus critique commercialement.
4. Ajouter des `data-testid` systématiques dans l'admin pour rendre la suite Cypress existante réellement exécutable.
5. Élargir le balayage de sécurité (`@UseGuards` manquant) aux subscriptions et aux champs résolveurs imbriqués, pas seulement aux mutations/queries de premier niveau.
