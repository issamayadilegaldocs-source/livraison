---
name: nouveau-domaine
description: Checklist pour mettre en ligne un nouveau livreur / un nouveau nom de domaine du site livreur-site, avec la protection anti-copie et revente (contrat, verrou d'origine, clés, Cloudflare). À utiliser dès que l'utilisateur crée un nouveau domaine ou sous-domaine, ajoute un client, "nouveau livreur", "nouveau client", "mettre en ligne", "protéger le site", ou veut déployer une copie du site, même s'il ne dit pas "checklist".
---

# Nouveau domaine / nouveau livreur

Les étapes de déploiement détaillées sont dans `livreur-site/README.md` (section « Ajouter un livreur » et « Mise en place Cloudflare »). Ne les recopie pas : suis-les et ajoute les étapes de protection ci-dessous. Le pourquoi de la protection est dans `livreur-site/ARCHITECTURE.md` (« Copy protection »).

**Autorisation (donnée par l'utilisateur le 2026-11-20).** Quand l'utilisateur lance cette skill pour un nouveau livreur ou domaine, il t'autorise à faire toutes les étapes ci-dessous sans redemander à chaque fois : créer le client, générer les clés, mettre les secrets, créer bucket et projet Pages, régler Cloudflare dans Chrome, déployer, tester. Il ne connaît pas Cloudflare : fais le travail jusqu'au bout et rapporte à la fin. Cette autorisation couvre uniquement ces étapes, pour le client demandé.

**Arrête-toi et demande quand :**
- une étape va **écraser ou supprimer** quelque chose qui existe déjà (projet Pages, secret, bucket, règle, DNS, autre client) : regarde d'abord ce qui est là ;
- une connexion est nécessaire (`wrangler login`, Cloudflare dans Chrome, 2FA) : l'utilisateur la fait lui-même, tu ne demandes jamais ses identifiants ;
- l'action sort de la liste (autre compte, paiement, changement de plan, DNS d'un autre site) ;
- un test échoue : dis-le avec la sortie exacte, ne déclare pas « fini ».

## 1. Collecter (demander ce qui manque, ne rien inventer)

- Nom du client (dossier `clients/<client>`, = nom du projet Pages : minuscules, chiffres, tirets).
- Domaine ou sous-domaine final, ex. `ahmed.hamma-delivery.com`.
- Ville (doit exister dans `villes/`), WhatsApp `216` + 8 chiffres, email, couleur, frais de livraison.
- Le **WhatsApp doit être unique** dans `clients/` : `scripts/preparer.mjs` refuse sinon.

## 2. Créer le client

Crée `livreur-site/clients/<client>/livreur.json` (modèle : `clients/ahmed/livreur.json`). Aucun champ « domaine » à ajouter : le verrou d'origine compare avec l'hôte de la requête.

## 3. Clés (génère-les toi-même ; jamais dans un fichier suivi par git)

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"   # CONFIG_CLE
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # BON_SECRET
```

```bash
npm run vapid   # (dans livreur-site) une ligne JSON = VAPID_JWK, la clé des alertes push du livreur
```

Une clé différente par livreur, jamais réutilisée. Cloudflare ne permet pas de relire un secret : écris les deux clés dans `secrets/<client>.cles.txt` (dossier `secrets/` ignoré par git, le vérifier avec `git check-ignore`) pour que rien ne se perde, et donne à l'utilisateur le lien de config final à la fin. Pour le local, elles vont dans `livreur-site/.dev.vars` (non commité).

## 4. Cloudflare (suivre le README, avec accord de l'utilisateur pour chaque commande qui écrit)

1. Compte du livreur : projet Pages `<client>`, bucket R2 `livreur-bons` (+ règle de cycle de vie 7 jours), puis les secrets avec `wrangler pages secret put <NOM> --project-name <client>` en passant la valeur par l'entrée standard (`printf '%s' "$VALEUR" | npx wrangler ...`), jamais dans Chrome ni dans la ligne de commande affichée. `BON_SECRET`, `CONFIG_CLE` et `VAPID_JWK` sont ceux de l'étape 3. Emails : `BREVO_API_KEY` et `MAIL_FROM`, voir la sous-section « Emails » ci-dessous (Resend `RESEND_API_KEY` reste possible seulement avec un domaine vérifié). Les secrets ne comptent qu'après un redéploiement.
2. Domaine personnalisé du projet : Pages → Custom domains.
3. Images : `npm run envoyer-images`, puis vérifier que `MEDIA_BASE_URL_PROD` pointe vers le bon domaine d'images.
4. Déploiement : `npm run deploy -- <client>` (ou `npm run deploy-tous`).

### Emails (livreur + client) : Brevo, sans domaine à vérifier

L'email au livreur et le récapitulatif au client (email facultatif saisi à la commande) partent par `lib/email.ts`. Si le secret `BREVO_API_KEY` existe, Brevo est utilisé pour tous les emails du projet (il passe avant Resend) et `MAIL_FROM` devient obligatoire. Resend n'envoie qu'à l'adresse de son compte tant qu'un domaine n'est pas vérifié par DNS : le client ne recevrait rien. Brevo (gratuit, 300 emails/jour) valide un expéditeur par un simple lien de confirmation.

À faire pour chaque livreur (secrets d'un projet Pages = par client) :
1. Compte Brevo (un par propriétaire suffit). Brevo → Expéditeurs, domaines → **Ajouter un expéditeur** : l'adresse qui enverra (nom + email). Un lien de confirmation arrive sur cette adresse : l'utilisateur clique. Statut « Vérifié » avant de continuer. Les expéditeurs Gmail marchent mais Brevo avertit (DMARC freemail) : les emails peuvent aller en spam. Un domaine à soi, authentifié (DKIM/DMARC), est meilleur.
2. Clé API : Brevo → SMTP et API → Clés API → Générer, accès **Restreint**, seulement « Emails transactionnels » = Tous. Brevo demande de vérifier le téléphone (SMS) puis un code envoyé par email : **l'utilisateur** saisit ces codes, tu ne peux pas les lire. La clé (`xkeysib-…`) ne s'affiche qu'une fois : bouton copier, ne la colle jamais dans le chat.
3. Secrets, depuis le presse-papiers et **sans retour à la ligne final** (un `Get-Clipboard | wrangler` en PowerShell ajoute `\r\n` et Brevo répond `401 Key not found`) : écris la valeur dans un fichier temporaire avec `[IO.File]::WriteAllText` (ou `printf '%s'` en bash), `npx wrangler pages secret put BREVO_API_KEY --project-name <client> < fichier`, idem `MAIL_FROM` (`Nom <adresse validée>`), puis supprime le fichier.
4. **Redéployer** : un secret ne compte qu'après un nouveau déploiement.
5. **Tester pour de vrai** : `POST /api/commande` avec `client.email` = une adresse de test, la réponse doit contenir `"email":"sent"` et les deux emails (livreur, client) arrivent. Sinon `npx wrangler pages deployment tail <id-déploiement> --project-name <client>` pendant une commande : le log dit `[email] Brevo a refusé l’email : <code> …`. Brevo → Transactionnel → Logs montre ce qui est vraiment parti (un 401/400 n'y apparaît pas).

## 5. Protection anti-copie (checklist zone Cloudflare)

Ces réglages sont dans le dashboard de la **zone du domaine, compte du propriétaire**. Les jetons par livreur de `secrets/clients.json` ne les couvrent pas. Si le nouveau domaine est dans une zone déjà protégée, vérifie seulement que les règles s'appliquent encore ; sinon, applique-les (détail et expression de la règle dans le README, « Protection contre la copie et la revente ») :

- [ ] Bot Fight Mode activé.
- [ ] Règle de rate limiting sur `/api/` (par IP, 10 s). **Test** : 20 requêtes rapides sur `https://<domaine>/api/etat` doivent finir en 429. La règle gratuite n'a jamais été testée sur un sous-domaine d'un projet Pages d'un autre compte : le vérifier une fois et noter le résultat.
- [ ] Règle WAF anti-hotlink sur le domaine des images (Referer présent et d'un autre domaine = Block). **Test après activation** : les vignettes de l'email de commande, le bon de commande et les pages du site affichent toujours leurs images.
- [ ] Verrou d'origine (code) : après déploiement, `curl -i -X POST -H "Origin: https://autre.com" https://<domaine>/api/coupon` doit répondre 403.

### Ce qui se fait avec Claude in Chrome

Les réglages du dashboard Cloudflare n'ont pas d'outil en ligne de commande avec les jetons actuels : fais-les dans le Chrome de l'utilisateur (invoque d'abord la skill `claude-in-chrome`, qui charge les outils `mcp__claude-in-chrome__*`). Chrome utilise la session déjà connectée de l'utilisateur : l'utilisateur se connecte lui-même à Cloudflare (mot de passe, 2FA) et tu ne demandes jamais ses identifiants.

À faire dans Chrome, dans un nouvel onglet (jamais un onglet existant), un réglage à la fois :
- Pages → projet `<client>` → Custom domains : ajouter le domaine.
- Zone du domaine → Security → Bots : Bot Fight Mode.
- Zone → Security → WAF → Rate limiting rules : règle `/api/`.
- Zone → Security → WAF → Custom rules : règle anti-hotlink (expression dans le README).
- Contrôles en lecture seule : lire les pages de réglages pour confirmer que tout est actif (Chrome sans rien modifier), puis faire les tests de la checklist ci-dessus.

Les réglages sont couverts par l'autorisation ci-dessus : annonce chacun en une ligne, fais-le, puis relis la page pour confirmer qu'il est actif. Avant de remplacer une règle existante, lis-la d'abord. Évite les boutons qui ouvrent une boîte de dialogue du navigateur (alert, confirm) : ils bloquent Chrome. Si la page ne répond pas ou qu'un élément reste introuvable après 2-3 essais, arrête-toi et explique à l'utilisateur ce qui bloque.

À ne **pas** faire dans Chrome : saisir ou afficher des valeurs de secrets (`CONFIG_CLE`, `BON_SECRET`, clés Resend/R2) : ils passent par `wrangler` dans le terminal (étape 4). Le contrat reste hors Chrome, signé à la main par l'utilisateur et le livreur.

## 6. Contrat

- [ ] `livreur-site/contrat-livreur.md` rempli (nom, domaine, WhatsApp, prix) et signé **avant** de donner le lien de config. Rappeler à l'utilisateur de le faire relire par un juriste la première fois.

## 7. Remise au livreur

Envoie deux liens (à garder en favori ; il ne doit les donner à personne) : ses réglages `https://<domaine>/api/config?cle=<CONFIG_CLE>`, et ses alertes de commande `https://<domaine>/api/push?cle=<CONFIG_CLE>` (il l'ouvre sur son téléphone, touche « Activer sur ce téléphone », accepte, puis « Envoyer une alerte test » : fais-lui confirmer qu'il a reçu la notification, et qu'il met le son au maximum sans mode silencieux). Fais un test de commande de bout en bout, et dis clairement ce que tu as vérifié ou non.

## Limites à rappeler honnêtement

Le verrou d'origine arrête les fronts copiés ailleurs, pas un script qui falsifie l'en-tête `Origin`. Rien n'empêche un script patient de télécharger les pages publiques et les images : la vraie protection est le contrat, la preuve d'origine et le service (mises à jour, nouveaux restos, support).
