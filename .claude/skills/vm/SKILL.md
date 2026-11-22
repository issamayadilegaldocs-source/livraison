---
name: vm
description: Deploy livreur-site to the preprod VM (88.96.34.1, https://livreur.hamma-delivery.com). User-triggered only via /vm.
disable-model-invocation: true
---

# /vm : deploy livreur-site to the VM

The user typing `/vm` IS the explicit go for this deploy. Do not ask again. Run it once; never deploy outside `/vm`.

## Steps

1. Run the script with the Bash tool (Git Bash), `run_in_background: true`, from the repo root:

   ```bash
   bash .claude/skills/vm/deploy.sh
   ```

   If the user wrote `/vm skip-tests` (or "sans tests"), add `--skip-tests`.

2. When the background task finishes, read its output and report in one or two lines:
   - `DEPLOY OK` → say it is live on https://livreur.hamma-delivery.com.
   - Tests fail → show the failing tests; nothing was sent to the VM.
   - Build `FAIL`/timeout or HTTP code ≠ 200 → show the log lines the script printed. The previous copy is in `~/hamma/livreur-site.prev` on the VM; propose rolling back, do not do it without OK.

## What the script does

Tests (vitest) → tars the **local working tree** of `livreur-site/` (uncommitted changes included; excludes node_modules, .next, public/media, test, .env*) → scp → on the VM, extracts into a fresh `~/hamma/livreur-site`, keeps `deploy/livreur.env` (secrets), keeps the old copy as `livreur-site.prev` → detached `docker compose build && up -d` (3 tries) → polls `~/livreur-deploy.status` → `curl` checks the site answers 200.

Images (`~/hamma/livreur-media`) and the order-ticket volume (`~/hamma/livreur-bons`) are not touched.
