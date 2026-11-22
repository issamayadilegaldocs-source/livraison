#!/usr/bin/env bash
# Déploie livreur-site (copie de travail locale) sur la VM preprod, derrière Caddy.
# Usage (Git Bash, depuis la racine du repo) : bash .claude/skills/vm/deploy.sh [--skip-tests]
set -euo pipefail

VM=ubuntu@88.96.34.1
KEY=~/.ssh/hamma-preprod-api
URL=https://livreur.hamma-delivery.com/
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$VM")

cd "$(git rev-parse --show-toplevel)/livreur-site"

if [ "${1:-}" != "--skip-tests" ]; then
  echo "== tests"
  npm test --silent
fi

echo "== archive"
TGZ="$(mktemp -d)/livreur-site.tgz"
# Même exclusions que .dockerignore ; les images vivent dans ~/hamma/livreur-media sur la VM.
tar -czf "$TGZ" --exclude=./node_modules --exclude=./.next --exclude=./public/media \
  --exclude=./test --exclude='./.env*' --exclude=./tsconfig.tsbuildinfo .
du -h "$TGZ" | cut -f1

echo "== envoi"
scp -q -i "$KEY" "$TGZ" "$VM:livreur-site.tgz"
rm -f "$TGZ"

echo "== bascule + build sur la VM"
"${SSH[@]}" 'bash -s' <<'EOF'
set -e
cd ~/hamma
rm -rf livreur-site.new && mkdir livreur-site.new
tar -xzf ~/livreur-site.tgz -C livreur-site.new && rm ~/livreur-site.tgz
# Les secrets restent sur la VM : on les reporte dans la nouvelle copie.
[ -f livreur-site/deploy/livreur.env ] && cp livreur-site/deploy/livreur.env livreur-site.new/deploy/
rm -rf livreur-site.prev
[ -d livreur-site ] && mv livreur-site livreur-site.prev
mv livreur-site.new livreur-site
cd livreur-site/deploy
rm -f ~/livreur-deploy.status
# Build détaché (survit à une coupure SSH), 3 essais. L'ancien conteneur tourne tant que le build n'a pas réussi.
(nohup sh -c 'for i in 1 2 3; do sudo docker compose build livreur && sudo docker compose up -d livreur && echo OK > ~/livreur-deploy.status && exit 0; sleep 20; done; echo FAIL > ~/livreur-deploy.status' > ~/livreur-deploy.log 2>&1 < /dev/null &)
EOF

echo "== attente du build (max 15 min)"
s=""
for _ in $(seq 1 90); do
  s=$("${SSH[@]}" 'cat ~/livreur-deploy.status 2>/dev/null' || true)
  [ -n "$s" ] && break
  sleep 10
done
if [ "$s" != "OK" ]; then
  echo "ECHEC build (statut: ${s:-timeout}). Fin du log :"
  "${SSH[@]}" 'tail -30 ~/livreur-deploy.log'
  echo "Ancienne copie : ~/hamma/livreur-site.prev (l'ancien conteneur tourne toujours si le build a échoué)."
  exit 1
fi

echo "== vérification"
sleep 5
code=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
echo "$URL -> $code"
[ "$code" = "200" ] || { "${SSH[@]}" 'cd ~/hamma/livreur-site/deploy && sudo docker compose logs --tail 30 livreur'; exit 1; }
echo "DEPLOY OK"
