// Alerte « Nouvelle commande » sur le téléphone du livreur (Web Push), sans serveur à gérer.
// Le livreur ouvre /api/push?cle=… et active les notifications ; chaque commande envoie un push à ses appareils.
// Sans API Node : WebCrypto uniquement (testé avec vitest, exécuté par Cloudflare).
// ponytail: push SANS contenu (corps vide) : pas de chiffrement RFC 8291, le service worker affiche une notification
// générique (/sw-livreur.js). Le détail de la commande reste dans l'email / Telegram. Ajouter le chiffrement
// aes128gcm si un jour la notification doit montrer le montant ou le resto.

const SERVICES_PUSH = /(^|\.)(googleapis\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

/** Adresse d'abonnement acceptée : https et service push connu (Chrome/Android, Firefox, Safari, Edge). Évite qu'une adresse libre fasse appeler n'importe quel serveur. */
export function endpointValide(e: unknown): e is string {
  if (typeof e !== 'string' || e.length > 1000) return false;
  try {
    const u = new URL(e);
    return u.protocol === 'https:' && SERVICES_PUSH.test(u.hostname);
  } catch {
    return false;
  }
}

const enB64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const texteB64u = (t: string) => enB64u(new TextEncoder().encode(t));

type Jwk = { kty: string; crv: string; x: string; y: string; d: string };
const lireJwk = (json: string): Jwk => JSON.parse(json) as Jwk;

/** Clé publique VAPID (point non compressé, base64url) : ce que le navigateur reçoit pour s'abonner. */
export function cleVapidPublique(jwkJson: string): string {
  const { x, y } = lireJwk(jwkJson);
  const dec = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  return enB64u(Uint8Array.from([4, ...dec(x), ...dec(y)]));
}

/** JWT ES256 qui prouve au service push que l'envoi vient du détenteur de la clé (RFC 8292). */
export async function jwtVapid(endpoint: string, jwkJson: string, sujet: string, maintenantS = Math.floor(Date.now() / 1000)): Promise<string> {
  const cle = await crypto.subtle.importKey('jwk', lireJwk(jwkJson), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const corps = `${texteB64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))}.${texteB64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: maintenantS + 12 * 3600, sub: sujet }))}`;
  // WebCrypto rend la signature en r||s (64 octets), le format attendu par JWS ES256.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, new TextEncoder().encode(corps));
  return `${corps}.${enB64u(sig)}`;
}

/** Envoie un push (sans contenu) à chaque appareil. `expires` = adresses mortes (404/410) à retirer de la liste. */
export async function envoyerPush(endpoints: string[], jwkJson: string, sujet: string): Promise<{ envoyes: number; expires: string[] }> {
  const pub = cleVapidPublique(jwkJson);
  const expires: string[] = [];
  let envoyes = 0;
  await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `vapid t=${await jwtVapid(endpoint, jwkJson, sujet)}, k=${pub}`, TTL: '3600', Urgency: 'high', 'Content-Length': '0' },
        });
        if (res.status === 404 || res.status === 410) expires.push(endpoint);
        else if (res.ok) envoyes++;
        else console.error('[push] refusé', res.status);
      } catch (e) {
        console.error('[push] échec', e);
      }
    }),
  );
  return { envoyes, expires };
}

const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Petite page à ouvrir une fois sur le téléphone du livreur : active les notifications et envoie un test. */
export function htmlPush(o: { nom: string; couleur: string; cle: string; pub: string | null }): string {
  const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><meta name="theme-color" content="${echapper(o.couleur)}">
<link rel="manifest" href="/api/push?cle=${encodeURIComponent(o.cle)}&manifest=1"><link rel="apple-touch-icon" href="/icone-alertes.png"><link rel="icon" href="/icone-alertes.png"><meta name="apple-mobile-web-app-title" content="Alertes"><title>${echapper(o.nom)} — alertes commandes</title>
<style>
body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f6f7fb;color:#111;padding:max(20px,env(safe-area-inset-top)) 20px 40px}
main{max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
h1{font-size:24px;margin:0}
.carte{background:#fff;border-radius:22px;padding:18px}
button{width:100%;height:56px;border:0;border-radius:16px;font-size:18px;font-weight:800;color:#fff;background:${echapper(o.couleur)};margin-top:10px}
button.sec{background:#fff;color:#111;border:2px solid #ddd}
#etat{font-weight:700;margin:0}
.lien{display:block;text-align:center;background:#fff;border-radius:16px;padding:16px;font-weight:800;color:#111;text-decoration:none}
</style></head><body><main>
<h1>🔔 Alertes commandes</h1>
<div class="carte"><p>Votre téléphone sonne et vibre à chaque nouvelle commande, même quand cette page est fermée.</p>
<p id="etat"></p>
<button id="activer">Activer sur ce téléphone</button>
<button id="tester" class="sec">Envoyer une alerte test</button></div>
<a class="lien" href="/api/config?cle=${encodeURIComponent(o.cle)}#commandes">📋 Mes commandes (en cours et historique)</a>
<div class="carte"><b>Si vous ne recevez rien</b><br>Mettez le son des notifications au maximum, retirez le mode silencieux, et ne bloquez pas ce site dans les réglages du téléphone. Sur iPhone : « Partager » puis « Sur l’écran d’accueil », ouvrez la page depuis l’icône, puis activez.</div>
</main><script>
var K=${js(o.cle)},PUB=${js(o.pub)},etat=document.getElementById('etat');
function dire(t){etat.textContent=t}
function b2u(s){var b=atob((s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function envoyer(corps){return fetch('/api/push?cle='+encodeURIComponent(K),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(corps)}).then(function(r){return r.json()})}
var OK=window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&typeof Notification!=='undefined';
var RAISON=!PUB?'⚠️ Les alertes ne sont pas encore configurées sur ce site.'
:!window.isSecureContext?'⚠️ Cette adresse n’est pas sécurisée : ouvrez le lien en https:// (le site en ligne), pas en http://.'
:!OK?'⚠️ Ce navigateur ne gère pas les alertes. Sur iPhone : « Partager » puis « Sur l’écran d’accueil », ouvrez la page depuis l’icône, puis activez (iOS 16.4 ou plus).'
:Notification.permission==='denied'?'⛔ Notifications bloquées : autorisez-les dans les réglages du téléphone pour ce site.':'';
if(RAISON)dire(RAISON);
else navigator.serviceWorker.getRegistration().then(function(r){return r&&r.pushManager.getSubscription()}).then(function(s){dire(s?'✅ Alertes activées sur ce téléphone.':'⚪ Alertes pas encore activées.')});
document.getElementById('activer').onclick=async function(){
  try{
    if(RAISON){dire(RAISON);return}
    if(await Notification.requestPermission()!=='granted'){dire('⛔ Vous avez refusé les notifications.');return}
    var reg=await navigator.serviceWorker.register('/sw-livreur.js?cle='+encodeURIComponent(K));
    await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b2u(PUB)});
    var r=await envoyer({endpoint:sub.endpoint});
    dire(r.ok?'✅ Alertes activées sur ce téléphone.':'❌ '+(r.erreur||'Échec'));
  }catch(e){dire('❌ '+e.message)}
};
document.getElementById('tester').onclick=async function(){
  var r=await envoyer({test:true});
  dire(r.ok?(r.envoyes?'📨 Alerte envoyée à '+r.envoyes+' téléphone(s) activé(s) : regardez-les.':'⚠️ Aucun téléphone activé : touchez « Activer » d’abord.'):'❌ '+(r.erreur||'Échec'));
};
</script></body></html>`;
}
