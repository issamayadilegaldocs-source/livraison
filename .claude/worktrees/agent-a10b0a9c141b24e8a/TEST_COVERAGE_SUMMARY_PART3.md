# Audit de couverture de tests — Enatega Multivendor (Partie 3/3)

> Suite de PART1 (vue d'ensemble + couverture par application) et PART2 (couverture par domaine métier + matrice des scénarios).

---

## 5. Cas limites déjà testés

**Financier / arithmétique (`common/money`, `orders`, `wallet`) :**
- Arrondi half-even (pas systématiquement "vers le haut") sur les montants
- Devises à échelle différente : TND (3 décimales) vs USD (2 décimales)
- Grandes valeurs (précision conservée)
- Frais de livraison : distance/coordonnées non-finies → 0 (jamais négatif)
- Commission rider plafonnée pour ne jamais dépasser les frais de livraison (pas de "sur-débit" de la plateforme)
- Commande "pickup" (sans livraison) : aucun crédit rider/frais de livraison généré
- Taux de commission gelé à 0 : recalcul depuis le taux courant ; taux gelé positif : priorité au gel sur le taux courant

**Commandes / catalogue :**
- Quantité négative, nulle ou fractionnaire → rejet
- Référence à un plat/variation supprimé ou inconnu → rejet
- Client tentant d'injecter son propre prix/frais de livraison/taxe → ignoré, recalcul serveur
- Taxe négative envoyée par le client (tentative de "remise cachée") → rejet
- Frais de livraison à 0 même si envoyés par le client sur une commande "pickup"
- Commandes legacy sans champ `orderStatus` → toujours incluses dans les requêtes actives
- `reOrder` sur un article dont la variation catalogue a été supprimée entre-temps → rejet propre

**Horaires d'ouverture (`opening-hours.util`) :**
- Restaurant 24/7, pause manuelle, fermeture du jour, inclusivité des bornes horaires, chevauchement de minuit (horaires "overnight"), évaluation sensible au fuseau horaire à travers les frontières de jour, fuseau horaire invalide → fallback UTC

**Coupons :**
- Coupon `lifeTimeActive` contournant la fenêtre de dates
- Compteur de libération (`releaseUse`) ne devient jamais négatif même en cas de libérations multiples

**Identité / ownership :**
- Nom complet en un seul mot, priorité explicite prénom/nom sur découpage automatique
- Réutilisation d'un email Clerk déjà lié à un autre compte → rejet
- Provisioning Clerk échoué → fallback sur l'enregistrement Mongo seul
- Owner legacy sans prénom/nom séparés → dérivation à la lecture

**Estimation de livraison :**
- Cache-only mode ne déclenche jamais d'appel provider externe (protection contre les coûts d'API)
- "Concurrent-miss coalescing" : plusieurs requêtes simultanées sur un cache manquant ne déclenchent qu'un seul appel provider
- Temps de préparation négatif normalisé + fallback si l'API Routes échoue

**Multi-app (scripts ad-hoc) :**
- Restaurant sans coordonnées → dispatch ignoré proprement (pas de crash)
- Commande annulée alors que déjà réclamée par plusieurs riders sonnés simultanément → tous les riders voient la disparition

## 6. Tests de concurrence

| Scénario | Où | Nature |
|---|---|---|
| Réclamation simultanée d'un coupon single-use par N utilisateurs | API (unitaire, simulation) | Une seule réclamation gagne, compteur atomique |
| Réclamation simultanée d'un coupon N-use | API (unitaire) | Exactement N gagnent, pas de sur-réclamation |
| Libération de coupon rejouée (annulation puis nouvelle commande) | API (unitaire) | Réclamation à nouveau possible, compteur cohérent |
| Course entre deux livreurs sur `assignOrder` | Script ad-hoc multi-app (E2E réel, navigateurs concurrents) | Premier gagne (ASSIGNED), second reçoit une erreur de conflit explicite, sa liste se met à jour sans reload |
| Annulation store pendant qu'un rider est déjà ASSIGNED | Script ad-hoc multi-app | Toutes les parties (2 riders, store, customer) convergent vers un état cohérent sans reload |
| Dispatch simultané à plusieurs riders (broadcast de zone) | Backend (indirect, via tests de publication d'événements) | Vérifie que l'événement est publié sans zoneId à la création puis avec zoneId à PREPARED, mais pas de test de charge réel avec N riders simultanés |

**Non couvert en concurrence :** débit simultané du wallet (deux retraits concurrents sur le même solde — les tests wallet sont séquentiels), montée en charge du dispatch avec un grand nombre de riders/commandes simultanés, écriture concurrente sur le même document de commande par deux acteurs différents (ex: store et admin modifiant la même commande en parallèle) en dehors du cas rider/rider déjà couvert.

## 7. Tests financiers

**Backend (couverture la plus dense du projet) :**
- Campagne d'invariants financiers combinatoires (`financial-invariants.spec.ts`)
- Campagne de fuzzing 200 scénarios aléatoires — vérifie que la somme des composants (sous-total, taxe, livraison, pourboire, remise) reconstitue toujours le total final
- Campagne de robustesse (`financial-robustness.spec.ts`) : stampede sur coupon, rollback wallet+coupon en cascade, re-order avec pricing serveur-autoritaire
- Split des gains (`earnings-split.spec.ts`) : commission uniquement sur la nourriture (pas sur livraison/pourboire/taxe), rider reçoit 100% du pourboire + commission sur livraison, store jamais crédité de livraison/pourboire/taxe/frais express, plateforme conserve le reliquat livraison/taxe/express, clamp de la commission pour ne jamais excéder les frais de livraison, équilibre spécifique aux commandes "pickup"
- Retraits (wallet) : débit unique garanti à l'approbation (pas de double débit), remboursement automatique si un retrait payé est annulé, rejet si solde insuffisant (rider ET store), métadonnées en unité mineure correctement configurées
- Paiements en ligne : rejet d'initiation sur commande déjà payée, rejet de confirmation sans session active, pas de marquage "payé" sur échec provider, idempotence des tentatives par référence provider
- Recharge wallet : normalisation en unité mineure avant appel gateway, crédit depuis le snapshot minor-unit stocké (pas recalculé à la volée)

**Non couvert financièrement :**
- Aucun test de bout en bout d'un paiement réel via Stripe/Paypal/Flouci (les ports sont mockés, pas les vrais SDK/webhooks)
- Aucun test de réconciliation comptable à l'échelle (rapprochement entre wallet, commandes et retraits sur une période)
- Aucun test de remboursement lié à une annulation de commande payée en ligne (le remboursement COD/"rien à rembourser" est implicite, mais un remboursement de paiement en ligne suite à annulation n'apparaît dans aucun scénario relevé)
- Aucun test fiscal/réglementaire (facturation, export comptable)

## 8. Tests temps réel (WebSocket / subscriptions)

**Couverts :**
- Latence de livraison des subscriptions `subscribePlaceOrder`, `subscriptionZoneOrders`, `subscriptionAssignRider` : chacune vérifiée `<100ms` (backend, unitaire avec PubSub en mémoire)
- Filtrage correct : un abonné sur un autre restaurant/zone ne reçoit pas l'événement (backend)
- Propagation réelle navigateur-à-navigateur sans reload entre customer/store/rider (script `test-order-propagation.js`) : apparition immédiate côté store, absence côté rider avant ACCEPT, apparition côté rider dès ACCEPT (flux "Sfax"), non-régression du statut après `markOrderPrepared`, progression visible côté client jusqu'à confirmation
- Ring temps réel pour un rider inactif sur l'écran d'accueil (pas sur l'onglet commandes) lors de `markOrderPrepared` (script `test-rider-ring-on-prepared.js`)
- Disparition de commande sans reload après réclamation perdue, après annulation, dans toutes les listes concernées (scripts S1/S2/S5)

**Non couverts :**
- Reconnexion après coupure réseau/WebSocket
- Comportement multi-onglets/multi-appareils pour un même compte
- Ordre garanti de livraison des événements sous forte charge
- Distinction testée entre le protocole legacy (`subscriptions-transport-ws`) et `graphql-ws` — les deux sont activés en production mais aucun test ne cible spécifiquement l'un ou l'autre
- Comportement de `networkidle`/attente réseau (connu comme problématique en Playwright à cause des WebSockets ouvertes en continu — contournement documenté dans `QA_REPORT.md` mais pas un scénario testé, juste un ajustement d'outillage)

## 9. Tests de sécurité

**Couverts (indirectement, au niveau service, pas au niveau guard/transport) :**
- Autorité serveur systématique sur prix/quantité/taxe/frais de livraison (protection contre l'injection de prix côté client)
- Rejet de réutilisation d'un compte Clerk ADMIN/VENDOR comme identifiant de login store
- Rejet de liaison d'une identité Clerk déjà associée à un autre restaurant
- Un store ne peut pas accepter/annuler la commande d'un autre restaurant (garde-fou d'appartenance testé via script ad-hoc)
- Token de tracking scopé par commande (rejet si le client n'est pas propriétaire de la commande, rejet de token invalide)
- Filtrage explicite des erreurs `Insufficient role` dans les helpers de test admin — reconnaît l'existence du contrôle de rôle mais ne le teste pas positivement/négativement de façon dédiée

**Non couverts :**
- **Aucun test direct des guards d'authentification/autorisation** (`ClerkAuthGuard`, `RolesGuard`, `gql-throttler.guard`) — c'est la lacune de sécurité la plus significative identifiée
- Aucun test du webhook Clerk (validation de signature, rejet de payload falsifié)
- Aucun test d'injection GraphQL (requêtes profondément imbriquées, alias abusifs, introspection en production)
- Aucun test de rate-limiting / throttling en conditions réelles (le guard existe — `gql-throttler.guard.ts` — mais n'est testé nulle part)
- Aucun test XSS/CSRF côté frontend (admin/web)
- Aucun test de fuite de données entre tenants (un vendeur voyant les données d'un autre vendeur) en dehors du cas "accept order d'un autre restaurant"
- **Fuite de secret identifiée en cours d'audit** (hors périmètre des tests, mais pertinente pour un audit de sécurité) : un token Sentry en clair dans `enatega-multivendor-rider/package.json` (script `upload-sourcemaps`)
- Headers de sécurité (`X-Frame-Options`, CSP, HSTS) mentionnés comme obligatoires dans les instructions du projet admin, mais aucun test n'en vérifie la présence effective sur les réponses HTTP

## 10. Zones sans couverture

**Backend — modules sans aucun fichier de test :**
`auth` (guards, webhook), `zones`, `banners`, `chat`, `countries`, `dashboard`, `health`, `staff`, `support-tickets`, `taxations` (CRUD), `tippings` (module), `user-notifications`, `activity`/`audit`.

**Frontend admin — pages sans aucune trace dans une suite de test :**
`general/staff`, `management/offers`, sous-onglets `admin/store/general/{location,payment,timing}`.

**Application web client :** couverture totale nulle (scaffold Cypress uniquement).

**Applications mobiles — fonctionnalités jamais testées, sous aucune forme :**
- Panier et checkout (les 3 apps mobiles/web)
- 4 gateways de paiement (Stripe, Paypal, Flouci, COD au niveau UI — COD couvert seulement côté API/E2E ad-hoc)
- Gestion des adresses (CRUD)
- Favoris, notes/avis, recherche
- Chat (contenu des messages, pas seulement la présence de l'écran)
- CRUD menu complet côté store (food/catégories/options/add-ons) au niveau UI
- Earnings/wallet/bank-management côté store et rider (UI)
- Offres côté store et affichage côté client
- Work-schedule/zone/vehicle-type (disponibilité rider)
- Historique de commandes (toutes apps)
- Profil/paramètres (toutes apps)
- Carte/géolocalisation en conditions réelles (rider et client)

**Transversal :**
- Aucun test d'intégration GraphQL de bout en bout (schéma réel + guards + résolveurs ensemble) côté backend
- Aucun test de charge/performance formalisé (le seul script de timing n'a pas d'assertion bloquante)
- Aucun test d'accessibilité automatisé
- Aucun test de compatibilité multi-navigateurs (Playwright configuré uniquement sur Chromium)
- Aucun test de montée en charge du dispatch/matching à grande échelle
- Aucune preuve d'intégration CI/CD des suites Playwright/Cypress (aucun fichier de workflow CI trouvé référencé dans cet audit — à vérifier séparément si un pipeline existe ailleurs)

## 11. Recommandations

*(Section volontairement omise du contenu correctif — cet audit décrit l'état actuel de la couverture sans proposer de corrections, conformément à la consigne. Cette section est laissée en placeholder pour l'analyse indépendante demandée à un autre LLM.)*

---

## Annexe — points méthodologiques pour l'analyse externe

1. **Deux populations de tests très différentes en fiabilité** : les tests unitaires backend (Jest, mocks complets) sont probablement fiables et exécutés en continu ; la suite Cypress admin est probablement écrite mais non vérifiée en pratique (sélecteurs `data-testid` inexistants dans le code) ; les scripts N2N ad-hoc sont des probes manuelles fiables *au moment de leur écriture* mais fragiles dans le temps (identifiants Mongo, comptes de test, et données seedées codés en dur, pas rejouables automatiquement en CI).
2. **La suite Playwright officielle de l'admin (25 fichiers) est large en surface mais peu profonde** : elle prouve l'absence d'erreurs de rendu sur ~40+ pages, pas la correction fonctionnelle des données ou des mutations.
3. **La couverture métier la plus solide et la plus fiable du projet est backend + scripts ad-hoc multi-apps**, concentrée sur : l'intégrité financière, les garde-fous de state machine des commandes, la concurrence sur les coupons et le dispatch, et la propagation temps réel. C'est aussi la zone qui a fait l'objet du plus grand nombre de campagnes de durcissement récentes (voir historique de commits : invariants financiers, robustesse coupons/wallet, scénarios "terrain" concurrents).
4. **La couverture la plus faible du projet est l'intégralité du parcours utilisateur final** (web et mobile) : panier, checkout, paiement, historique, profil — c'est-à-dire la majorité de ce qu'un utilisateur final touche réellement au quotidien.
