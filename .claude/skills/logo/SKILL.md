---
name: logo
description: Change the logo or the cover photo of one or a few restaurants in livreur-site (new image → webp in media/ → restos.json). User-triggered via /logo.
disable-model-invocation: true
---

# /logo : changer le logo ou la couverture d'un resto

The user gives, in any words: the restaurant (name or slug), what to change (`logo` or `couverture`), and the image file (path on disk). Several restaurants at once is fine: repeat the steps for each. If one of the three is missing, ask for it in one short question.

Never overwrite an existing image: the R2 bucket is shared by every copy, `envoyer-images` refuses overwrites, and phones cache old images. Always use a new file name.

## Steps (from `livreur-site/`)

1. **Find the restaurant** in `villes/<ville>/restos.json` (default ville: `sfax`). Match the name case- and accent-insensitively. If several restos match, list them (name + address) and ask which one. Note its `slug` and the current value of the field.

2. **Check the image**: it exists, it is jpg/png/webp. Logo: ideally square, ≥ 400 px. Couverture: landscape (~16:10), ≥ 1000 px wide. If it is too small, say so, but continue if the user agrees.

3. **New name**: `perso-<slug>-<logo|cover>-<YYYYMMDDHHmm>.jpg` (the extension is only part of the name; the files produced are webp).

4. **Convert** with sharp, at the same sizes as `scripts/images.mjs`, into `media/restaurant/{thumb,full}/<name without extension>.webp`:

   ```bash
   cd livreur-site && node -e "
   const sharp=require('sharp'),fs=require('fs'),[src,nom]=process.argv.slice(1);
   (async()=>{for(const [t,w,q] of [['thumb',400,70],['full',1000,75]]){
     fs.mkdirSync('media/restaurant/'+t,{recursive:true});
     await sharp(src).rotate().resize({width:w,withoutEnlargement:true}).webp({quality:q}).toFile('media/restaurant/'+t+'/'+nom+'.webp');}
   console.log('ok')})()" "<image path>" "<name without extension>"
   ```

5. **Point the resto at the new image**: in `villes/<ville>/restos.json`, set that resto's `logo` or `couverture` to the new name (with `.jpg`). Change only that field: edit the JSON with a small node script (read, change, `JSON.stringify` with the file's existing formatting), never by hand-replacing text across the file.

6. **Write it down** in `villes/<ville>/images-perso.md` (create it if missing), one line per change, so it can be reapplied after a new `npm run import` (the import rewrites `restos.json`):

   ```
   - 2026-11-18 · snack-attack-sekiet-ezzit · logo · perso-snack-attack-sekiet-ezzit-logo-202611181530.jpg (avant : 2025-01-29-679a21499af51.jpg)
   ```

   After any `npm run import`, read this file and reapply every line (step 5 only; the webp files already exist).

7. **Check locally** if the dev server runs with `MEDIA_BASE_URL` pointing at local `media/`: open the resto page and look at the new image. Otherwise say plainly that it was not checked in the browser.

8. **Report and stop.** Tell the user what changed (resto, field, new name) and the two remaining steps, which you do NOT run without their explicit go:
   - `npm run envoyer-images` (sends only the new images to R2);
   - redeploy the site.

Do not commit unless the user asks.
