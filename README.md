# livreur-site

Le site de livraison d'un livreur indépendant, sur le modèle de hamma-delivery.com. Il contient **tous les restos d'une ville**, déjà remplis à partir d'un dump : menus, prix, options et images.

Le client cherche un resto ou un plat, choisit ses options et passe commande sans quitter le site. Une fois la commande confirmée, un **email** part automatiquement au livreur (plus les alertes Telegram / notification si activées). Le livreur organise ensuite tout lui-même.

Pas de base de données, pas de login, pas d'admin, pas de serveur à gérer : le site est **statique sur Cloudflare Pages**, la commande passe par une Pages Function. Une copie du site = un livreur = un projet Pages = un sous-domaine (ex. `ali-sousse.mondomaine.tn`). Toutes les copies partagent le même bucket d'images R2.

## Organisation

```
clients/<client>/livreur.json   config d'un livreur (un dossier par client, jamais mélangés)
villes/<ville>/                 données d'une ville (restos.json, menus/, cuisines.json), partagées par ses livreurs
media/                          images webp produites par `npm run images` (non commité, envoyé sur R2)
functions/                      Pages Functions : /api/commande, /api/bon/<id>, /api/etat, /api/config, /api/colis (tout sous /api/)
```

Le nom du dossier client sert aussi de **nom de projet Pages** : minuscules, chiffres et tirets (ex. `ali-sousse`).

## Ajouter un nouveau livreur

1. **Ville** (une seule fois par ville) : importer le dump, préparer et envoyer les images.

   ```bash
   npm run import -- C:/zigzag-data/sfax-backup/2026-10-14 sfax   # → villes/sfax/
   npm run images -- sfax C:/zigzag-data/sfax-backup/images         # → media/ (webp, relançable)
   npm run envoyer-images                                         # → bucket R2, n'envoie que ce qui manque
   ```

   `npm run images` compresse en webp (`thumb` 400 px, `full` 1000 px) uniquement les images utilisées. `npm run envoyer-images` liste le bucket et n'envoie que les fichiers absents (`-- --dry-run` pour voir sans envoyer). Si une image existe déjà avec une taille différente (deux villes avec le même nom d'image), il s'arrête sans rien envoyer. Cette vérification suppose un bucket neuf, ou rempli par ce même script : l'ancien bucket `media.hamma-delivery.com` a été rempli par un autre outil, ses fichiers peuvent avoir d'autres tailles et provoquer de faux conflits.

2. **Config du livreur** : créer `clients/<client>/livreur.json`. Le `whatsapp` doit être unique entre clients : les promos et réglages que le livreur enregistre sur sa page de config sont rangés par numéro (`config/<whatsapp>.json` dans R2), et `npm run dev/build/local` refuse deux clients au même numéro. `livreur.json` ne donne que les valeurs de départ (promos, frais…) ; ce que le livreur enregistre ensuite les remplace.

   ```json
   {
     "nom": "Ahmed Express",
     "slogan": "Tous les restos de Sfax livrés chez vous.",
     "couleur": "#1A6BE0",
     "whatsapp": "21622123456",
     "email": "ahmed@example.com",
     "ville": "Sfax",
     "service": { "ouvre": "11:00", "ferme": "23:30" },
     "livraison": { "base": 1, "parKm": 0.5, "min": 1, "max": 12, "rayonMaxKm": 15, "facteurRoute": 1.3 },
     "majoration": { "tous": { "montant": 2 }, "restos": { "chap-lab": { "pourcent": 10 } }, "plats": { "4512": { "montant": 1 } } }
   }
   ```

   - `ville` doit correspondre à un dossier de `villes/` (`Sfax` → `villes/sfax`, `Médenine` → `villes/medenine`).
   - `whatsapp` = `216` suivi de 8 chiffres : il reçoit les commandes (et le bouton « Contact »). `couleur` au format `#RRGGBB`. `logo` (URL d'image carrée, par ex. `/logos/<client>.png` avec le fichier dans `public/logos/`) est optionnel : sans lui, le site affiche le logo générique (sac de livraison + épingle, `lib/logo.tsx`) à la couleur du livreur, aussi sur l'icône de l'app.
   - `service` (optionnel) : horaires du livreur, tous les jours, heure de Tunis. En dehors, le site affiche « Livraison fermée, reprise à 11:00 » et refuse les commandes. `ferme` avant `ouvre` = passe minuit (ex. `18:00` → `02:00`). Sans `service` : toujours en service, sauf pause.
   - `majoration` (optionnel) : la marge du livreur, ajoutée aux prix du resto. Chaque règle est soit `{ "montant": 2 }` (2 DT ajoutés au prix de chaque plat, suppléments inchangés), soit `{ "pourcent": 10 }` (plat et suppléments, arrondis aux 100 millimes supérieurs : 12,500 DT + 10 % = 13,800 DT). Elle s'applique à `tous` les restos, à un resto (`restos`, par slug) ou à un plat (`plats`, par id). La règle du plat l'emporte sur celle du resto, qui l'emporte sur `tous`.
     - Le client ne voit que le prix majoré (pages, message WhatsApp). Les règles et les prix du resto ne sont pas envoyés au navigateur.
     - L'email du livreur montre, pour chaque plat, le prix du resto et la majoration, puis « dont à payer au resto » et « dont votre majoration ».
     - Le bon pour le resto est aux prix du resto, sans la majoration.
   - `colis` (optionnel) : tarif des colis, à part des repas : `{ "actif": true, "base": 2, "parKm": 1, "min": 3, "max": 20, "rayonMaxKm": 10, "moyen": 1, "grand": 2.5 }` (`moyen` et `grand` = suppléments de taille en DT ; `actif: false` ferme les colis). Absent = mêmes frais que la livraison d'un repas. Le livreur le règle sur sa page de config (écran « Tarif des colis »).
   - `livraisonGratuite` (optionnel) : `{}` (livraison gratuite pour tous) ou `{ "min": 30 }` (gratuite dès 30 DT de plats, avant promo). À la charge du livreur ; une bande l'annonce sur tout le site. Le livreur l'active et l'arrête sur sa page de config (écran « Livraison gratuite »).
   - `commission` et `promos` (optionnels) : valeurs de départ ; le livreur les règle sur sa page de config. Commission : `{ "tous": 5, "restos": { "chap-lab": 10 }, "categories": { "chap-lab": { "123": 12 } }, "plats": { "chap-lab": { "4512": 0 } } }` (en % du prix du resto, pour le livreur ; le plat l'emporte sur la catégorie, puis le resto, puis `tous`). Promo : `{ "id": "bienv001", "nom": "Bienvenue", "type": "pourcent", "valeur": 10, "max": 3, "min": 15, "resto": "chap-lab", "financeur": "partage", "partResto": 40, "actif": true }` (`financeur` : `livreur`, `resto` ou `partage`).
   - `telegram` (optionnel) : alerte gratuite et sonore sur le téléphone du livreur, en plus de l'email : `{ "chatId": "123456789", "appel": "@pseudo" }` (`appel` est optionnel : appel vocal Telegram via CallMeBot). Mise en place :
     1. Sur Telegram, parler à `@BotFather`, `/newbot`, copier le token.
     2. Le livreur ouvre le bot et écrit `/start`.
     3. Ouvrir `https://api.telegram.org/bot<TOKEN>/getUpdates` : le `chat.id` du message est son `chatId`.
     4. `npx wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name <client>`, puis redéployer avec le `telegram` dans `livreur.json`.
     5. Pour l'appel : le livreur écrit `/start` à `@CallMeBot_txtbot` une fois.
   - `fraisService` (optionnel) : frais de service pour le livreur, en plus de la livraison : `{ "pourcent": 8, "min": 0.8, "max": 5 }` (formule Zigzag : % des plats, borné). Absent = aucun frais. Le livreur le règle ensuite sur sa page de config (bouton « Mettre par défaut » = formule Zigzag). Le client voit une ligne « Frais de service » ; l'email du livreur l'ajoute à son gain.
   - `service` et `livraison` sont les valeurs de départ : le livreur peut ensuite les changer lui-même sur sa page de config.
   - `email` reçoit la copie automatique des commandes. Il est intégré au code de la Function, jamais publié comme fichier.
   - **Frais de livraison** : `base + parKm × distance`, où la distance vaut la ligne droite resto → client multipliée par `facteurRoute` (1,3, pour approcher le trajet en ville). Le résultat est arrondi au 0,5 DT supérieur et borné entre `min` et `max`. Au-delà de `rayonMaxKm`, la commande est refusée. Exemple : 3 km à vol d'oiseau donnent 3,9 km, soit 1 + 1,95 = 2,95, donc **3,000 DT**.

3. **Déployer** :

   ```bash
   npm test
   npm run deploy -- <client>             # build statique + wrangler pages deploy (projet Pages = <client>)
   npm run deploy -- <client> --dry-run   # build seulement, rien envoyé
   npm run deploy-tous [-- <client> ...] [--sans-images]   # tous les clients (ou ceux nommés) d'un coup
   ```

   `deploy-tous` lit `../secrets/clients.json` (dossier `secrets/` à la racine du dépôt, ignoré par git) : une entrée par client avec `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `MEDIA_BASE_URL_PROD`. Pour chaque client : envoi des images manquantes, puis déploiement ; un échec n'arrête pas les autres. Prévoir un token Cloudflare limité à Pages et R2 du compte.

   La première fois, wrangler demande de se connecter (`npx wrangler login`) et crée le projet. Un projet tout neuf est restreint pendant 48 h chez Cloudflare : prévoir la mise en ligne en conséquence.

4. **Secrets du projet** (une fois par projet ; dashboard → Pages → projet → Settings → Variables, ou en ligne de commande) :

   ```bash
   npx wrangler pages secret put RESEND_API_KEY --project-name <client>
   npx wrangler pages secret put MAIL_FROM --project-name <client>
   npx wrangler pages secret put BON_SECRET --project-name <client>   # une longue valeur aléatoire
   npx wrangler pages secret put CONFIG_CLE --project-name <client>   # clé du lien de config du livreur
   ```

   Puis redéployer (`npm run deploy -- <client>`) pour que les secrets soient pris en compte.

5. **Sous-domaine** : dashboard → Pages → projet → Custom domains → `<client>.mondomaine.tn`.

6. **Lien de config pour le livreur.** Génère une clé différente pour chaque livreur :

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

   Mets-la en secret `CONFIG_CLE` (étape 4), garde-la de ton côté (Cloudflare ne permet pas de relire un secret), puis envoie au livreur le lien `https://<client>.mondomaine.tn/api/config?cle=<clé>`, à garder en favori sur son téléphone. Il n'a pas besoin de compte Cloudflare. Sa page de config contient quatorze blocs, et chaque changement est en ligne pour les clients en moins de 2 minutes, sans redéploiement :
   - **Service** : « Mettre en pause » (avec, en option, « Je reviens » : date et heure) ou « Reprendre les commandes ». En pause, un grand bandeau rouge s'affiche en haut de toutes les pages (« Le livreur est en pause · retour aujourd'hui à 19:30 »), les restos de l'accueil sont grisés et la commande est bloquée. À l'heure de retour annoncée, les commandes reprennent toutes seules.
   - **Horaires** : fermeture automatique en dehors d'une plage horaire.
   - **Frais de livraison** : base, prix par km, minimum, maximum, distance maximale.
   - **Commission sur les restos** : un seul % par resto (Réglages › Commission par resto). Pas de commission générale, par menu ni par plat.
   - **Coupons** (écran à part de Promotions) : un code à donner à un client (ex. `BIENVENUE10`), avec les mêmes réglages de remise, qui paie, la case « s'ajoute aux promotions automatiques » et le nombre maximum d'utilisations. Le code n'est jamais affiché sur le site.
   - **Promotions** (automatiques, sans code) : nom, pourcentage ou montant, remise maximum, panier minimum, un resto ou tous, et qui paie (le livreur, le resto, ou les deux avec la part du resto). Activer, désactiver, supprimer.
   - **Message d'annonce** : une phrase courte affichée en haut de toutes les pages.
   - **Supplément pluie / nuit** : un bouton manuel (nom + montant) et/ou un supplément automatique la nuit, ajoutés au prix de la livraison, pour le livreur.
   - **Commande minimum** : montant minimum de plats pour pouvoir commander.
   - **Montants de pourboire** : les boutons proposés au client (jusqu'à 6).
   - **Fermer un resto** : bouton « Fermer ce resto / Rouvrir » sur la page du resto (Réglages › Plats, indisponible, fermer un resto).
   - **Tarif des colis** : son propre prix (départ, par km, minimum, maximum, distance), un supplément pour les colis moyens et grands, et un interrupteur pour prendre ou non les colis.
   - **Livraison gratuite** : un gros bouton « Mettre la livraison gratuite » (avec un montant minimum de commande facultatif) et « Arrêter ».
   - **Frais de service** : case à cocher, pourcentage des plats, minimum, maximum, et un bouton « Mettre par défaut » (formule Zigzag : 8 %, min 0,8 DT, max 5 DT).
   - **Prix des plats** : sur la page d'un plat, deux cases : le prix que **le resto lui demande maintenant** (le menu importé peut être périmé : c'est ce qu'il paie au resto) et le prix **que le client paie**. Il choisit un resto, met le prix **que le client paie** (le prix du resto reste celui du menu : c'est ce qu'il paie au resto, la différence est sa marge, affichée sur la page et dans l'email) ou coche « Indispo ». Les corrections sont propres à ce livreur. Ajouter un plat ou changer les options d'un plat n'est pas possible ici : il faut réimporter un dump récent.

   Si le lien fuite, génère une nouvelle clé, mets-la en secret, redéploie et envoie le nouveau lien : l'ancien ne marche plus. Ne réutilise jamais la même clé pour deux livreurs.

## Mise en place Cloudflare (une seule fois pour tout le compte)

- **Domaine** sur Cloudflare (nameservers Cloudflare). C'est obligatoire pour le domaine d'images R2 : vérifier que le registrar du `.tn` permet de changer les nameservers, sinon prendre un `.com`.
- **Bucket d'images** (public) : créer le bucket, lui brancher le domaine `media.mondomaine.tn` (R2 → bucket → Settings → Custom domains), puis autoriser le CORS en lecture, sinon les vignettes du bon de commande sont remplacées par une icône :

  ```bash
  npx wrangler r2 bucket cors set <bucket-images> --file cors.json
  # cors.json : {"rules":[{"allowed":{"origins":["*"],"methods":["GET"]}}]}
  ```

  Clés d'envoi (`.env.local`, jamais commité) : `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (R2 → Manage API tokens, droits « Object Read & Write » sur ce bucket).
  Au déploiement, `MEDIA_BASE_URL_PROD` (ex. `https://media.mondomaine.tn`) donne l'adresse des images ; sans elle, c'est `https://livreur.hamma-delivery.com/media` (là où sont les images ; `media.hamma-delivery.com` en a perdu la plupart).
- **Bucket des bons** (privé) : `npx wrangler r2 bucket create livreur-bons`, puis une règle de cycle de vie qui supprime `bons/` après 7 jours :

  ```bash
  npx wrangler r2 bucket lifecycle add livreur-bons bons-7j bons/ --expire-days 7
  ```

  Même bucket, historique des commandes du livreur : une règle qui supprime `commandes/` après 90 jours (à faire une seule fois) :

  ```bash
  npx wrangler r2 bucket lifecycle add livreur-bons commandes-90j commandes/ --expire-days 90
  ```

  La liaison `BONS` est déclarée dans `wrangler.toml` (partagée par tous les projets).
- **Rate limiting** (protège le quota de tous les livreurs) : Security → WAF → Rate limiting rules, une règle sur le domaine : `URI Path starts with /api/` (toutes les Functions sont sous `/api/`, y compris l'image du bon), par IP, période 10 s, par ex. 5 requêtes, action Block 10 s. Le plan gratuit en donne une, elle couvre tous les sous-domaines.

## Alertes push sur le téléphone du livreur

Une notification qui reste affichée, avec son et vibration, à chaque commande ou demande de colis, même page fermée. Gratuit, sans serveur : c'est une Function (`/api/push`) qui envoie le push. Ce n'est pas un appel téléphonique : aucune page web ne peut en déclencher un (il faudrait un opérateur payant ou une application native).

1. Générer la clé du livreur et la mettre en secret (une clé par livreur, à garder dans `secrets/<client>.cles.txt`) :

   ```bash
   npm run vapid     # affiche une ligne JSON : c'est la valeur de VAPID_JWK
   npx wrangler pages secret put VAPID_JWK --project-name <client>
   ```

   Puis redéployer. Pour `npm run local`, mettre `VAPID_JWK=...` dans `.dev.vars`.
2. Envoyer au livreur un **second lien** : `https://<client>.mondomaine.tn/api/push?cle=<CONFIG_CLE>` (la même clé que la page de réglages). Sur son téléphone : ouvrir le lien, toucher « Activer sur ce téléphone », accepter la notification, puis « Envoyer une alerte test ». Android : tout marche dans Chrome. iPhone (iOS 16.4 ou plus) : « Partager » puis « Sur l'écran d'accueil », ouvrir depuis l'icône, puis activer ; jamais testé sur iPhone.
3. **Ses commandes** sont dans la même application que ses réglages : premier onglet « Commandes » du lien de config (`/api/config?cle=<CONFIG_CLE>#commandes`), et une carte « N en cours » sur l'accueil. Deux onglets : « En cours » (nouvelles commandes et colis, avec téléphone cliquable) et « Historique ». Il touche « Livrée » ou « Annuler » : la commande passe dans l'historique, gardée 90 jours (40 dernières affichées). Toucher la notification ouvre cette page.
4. Le livreur règle le son des notifications au maximum et retire le mode silencieux. Les adresses de téléphone sont dans le bucket `BONS` (`push/<whatsapp>.json`, 5 appareils maximum) ; une adresse morte est retirée toute seule.

## Protection contre la copie et la revente

Un site statique est téléchargeable : on ne peut pas empêcher un script patient de copier les pages et les images. On rend la copie pénible et on garde un recours légal.

- **Licence et contrat** : `LICENSE` à la racine (tous droits réservés), `package.json` en `UNLICENSED`, et `contrat-livreur.md` (modèle à faire relire par un juriste) à faire signer à chaque livreur avant la mise en ligne.
- **Verrou de domaine (dans le code)** : les `POST` (`/api/commande`, `/colis`, `/coupon`, `/bon/<id>`, `/config`) refusent (403) une requête dont l'en-tête `Origin` n'a pas le même hôte que la Function (`autreOrigine` dans `lib/serveur.ts`). Un front copié sur un autre domaine ne peut donc pas utiliser tes Functions (fausses commandes, quota d'emails). Aucun réglage par domaine à faire : c'est le même hôte, quel que soit le livreur. Un script qui falsifie `Origin` passe : ce verrou arrête les sites copiés, pas les scrapers. Les `GET` ouverts par lien (bon, config) ne sont pas bloqués.
- **Réglages Cloudflare** (dashboard, zone du domaine ; pas du code, pas faisables avec les jetons par livreur de `secrets/clients.json`, qui ne couvrent que Pages et R2) :
  1. *Security → Bots → Bot Fight Mode* : activé.
  2. *Security → WAF → Rate limiting rules* : la règle `/api/` ci-dessus. Vérifie-la : envoie 20 requêtes rapides sur `https://<client>.mondomaine.tn/api/etat` et attends un 429.
  3. *Security → WAF → Custom rules* : **anti-hotlink des images** sur le domaine des images, Block si le `Referer` est présent et d'un autre domaine :
     `(http.host eq "media.mondomaine.tn" and http.referer ne "" and not http.referer contains "mondomaine.tn")`.
     Un `Referer` vide reste autorisé (ouverture directe, proxy d'images de Gmail). Après l'avoir activée, vérifie que les vignettes de l'email de commande, le bon de commande (images dessinées dans le canvas) et le site s'affichent encore.
- **Pas de filigrane** sur les images : ce sont les photos des restaurants, et il faudrait ré-encoder ~36 000 fichiers et les renvoyer dans chaque bucket.

**Limites du plan gratuit** (vérifiées le 2026-11-18) : 100 projets Pages par compte (donc ~90 livreurs avec de la marge), 100 000 requêtes de Functions par jour pour tout le compte (1 par commande, 1 par bon ouvert, 1 par visiteur et par tranche de 2 min sur l'accueil et sur chaque page resto pour lire les réglages du livreur ; les pages et fichiers statiques sont gratuits et illimités), 10 ms de CPU par requête, 20 000 fichiers par site (un build fait ~950 fichiers), R2 : 10 Go et lectures gratuites jusqu'à 10 millions par mois (~1,2 Go d'images par ville). Au-delà de ~90 livreurs : un deuxième compte ou le plan payant.

## Variables d'environnement

| Où | Variable | Rôle |
|---|---|---|
| Projet Pages (secret) | `RESEND_API_KEY` | Copie email des commandes (sans elle : pas d'email). |
| Projet Pages (secret) | `BREVO_API_KEY` | Option sans domaine : si présente, Brevo remplace Resend. Exige `MAIL_FROM` = expéditeur validé dans Brevo (Senders, simple lien de confirmation). |
| Projet Pages (secret) | `MAIL_FROM` | Expéditeur vérifié dans Resend. |
| Projet Pages (secret) | `BON_SECRET` | Signe les bons de commande. Sans elle : pas de bon, la commande part quand même. |
| Projet Pages (secret) | `CONFIG_CLE` | Clé du lien de config du livreur. Sans elle, pas de page de config (le site garde les réglages de `livreur.json`). |
| Projet Pages (secret) | `SUPABASE_URL` | Optionnel : URL du projet Supabase (`https://<ref>.supabase.co`). Avec `SUPABASE_SECRET_KEY`, remplace R2 pour le backend (config, commandes, coupons, push, bons). |
| Projet Pages (secret) | `SUPABASE_SECRET_KEY` | Clé secrète serveur Supabase (`sb_secret_…`, ou ancienne `SUPABASE_SERVICE_ROLE_KEY`). Jamais exposée au navigateur. |
| Projet Pages (secret) | `VAPID_JWK` | Optionnel : clé des alertes push du livreur (`npm run vapid`). Sans elle, pas d'alerte push. |
| Projet Pages (secret) | `CALLMEBOT_APIKEY` | Optionnel : envoi WhatsApp automatique en plus (CallMeBot, inscriptions parfois fermées). |
| Projet Pages (secret) | `TELEGRAM_BOT_TOKEN` | Optionnel : bot Telegram qui alerte le livreur (avec `telegram.chatId` dans `livreur.json`). |
| Build | `CLIENT` | Client à construire (dossier de `clients/`). Inutile s'il n'y a qu'un client ; `npm run deploy` le règle. Sur Vercel, sinon déduit si `VERCEL_PROJECT_NAME` / l'URL de prod contient le nom d'un seul client ; sinon le build échoue : pose `CLIENT` dans Settings → Environment Variables. |
| Build | `MEDIA_BASE_URL_PROD` | Adresse des images pour `npm run deploy` (https obligatoire). |
| Dev (`.env.local`) | `MEDIA_BASE_URL` | Base des images en dev. Par défaut le bucket R2. |
| Dev (`.env.local`) | `R2_*` | Clés pour `npm run envoyer-images`. |

## Développement

```bash
npm run dev       # http://localhost:3000 (CLIENT=<client> s'il y a plusieurs clients)
npm test
npm run build     # export statique dans out/
npm run local     # sert out/ + les Functions comme Cloudflare : http://localhost:8788
```

Pour `npm run local`, mettre `BON_SECRET=...` et `CONFIG_CLE=...` dans `.dev.vars` (non commité) ; le bucket des bons est simulé en local. Pour brancher le backend sur **Supabase** au lieu de R2, exécuter `supabase/schema.sql` dans *Supabase Dashboard → SQL Editor*, puis ajouter `SUPABASE_URL` et `SUPABASE_SECRET_KEY` (`sb_secret_…`) dans `.dev.vars` (local) ou via `npx wrangler pages secret put` (prod). Après avoir changé `.dev.vars`, arrête bien l'ancien `npm run local` : un serveur resté ouvert garde les anciennes valeurs. Ne passe pas `MEDIA_BASE_URL=/media` sur la ligne de commande sous Git Bash : `/media` y est réécrit en `C:/Program Files/Git/media`.

## Ce que fait le site

- **Accueil** (tient sur un écran de téléphone) : recherche, grande carte **Restaurants**, carte **Envoyer un colis**, puis les commerces de la ville en tuiles illustrées (Épicerie, Pâtisserie, Cafés & jus, Fleurs, Parapharmacie, Animaux ; une tuile sans commerce dans la ville est masquée).
- **Pages catégorie** (`/c/restaurants`, `/c/epicerie`…, `/c/tout` pour la recherche de l'accueil) :
  - recherche par resto, plat, cuisine ou catégorie, sans tenir compte des accents (les noms de plats sont chargés à la première recherche) ;
  - chips de cuisines (restaurants seulement) et filtre « Ouverts maintenant » ;
  - sections « Populaires » et « Mieux notés » ;
  - grille des commerces, ouverts en premier.
- **Colis** (`/colis`) : adresses de ramassage et de livraison placées sur la carte, taille, contenu, coordonnées du client et du destinataire, « dès que possible » ou une heure. Prix estimé avec les frais du livreur. Le livreur reçoit un email (« À faire : appeler le client », boutons Appeler et WhatsApp, liens Google Maps) et appelle le client pour confirmer prix et heure. Refusé pendant la pause ou hors horaires.
- **Page resto** :
  - couverture, note, délai et horaires (ouvert ou fermé, à l'heure de Tunis, calculé sur le téléphone du client) ;
  - onglets de catégories et recherche dans le menu ;
  - fenêtre plat avec les options obligatoires et facultatives et les suppléments payants ;
  - panier.
- **Position du client** : le bouton « Utiliser ma position » utilise le GPS du navigateur, et les frais s'affichent avant la commande. Le message au livreur contient deux liens Google Maps, vers le client et vers le resto.
- **Commande** : la Function recalcule le total (options et frais compris), refuse un resto fermé ou une adresse hors zone, envoie l'email au livreur, puis le client envoie le message WhatsApp pré-rempli (écran « Dernière étape », avec Réessayer / Copier / Appeler si besoin).
- **Réglages du livreur** (page de config) : pause et horaires (bandeau sur l'accueil et la page resto, commande bloquée), frais de livraison, prix corrigés et plats indisponibles.
- **Bon de commande** : une image sans données client, que le livreur transfère au resto. Elle est dessinée sur le téléphone du client et gardée 7 jours ; le lien est dans le message WhatsApp et dans l'email.
