// npm run vapid : génère la clé VAPID (JWK) d'un livreur pour les alertes push. À mettre en secret VAPID_JWK.
// La clé est affichée sur une ligne ; ne la committe jamais.
import { webcrypto } from 'node:crypto';

const { privateKey } = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
console.log(JSON.stringify(await webcrypto.subtle.exportKey('jwk', privateKey)));
