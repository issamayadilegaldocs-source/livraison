// Crée/met à jour les comptes de test (Admin + Client), le livreur par défaut et une commande d'exemple.
// Usage : node scripts/seed-comptes.mjs (lit SUPABASE_URL et SUPABASE_SECRET_KEY depuis env ou .dev.vars).
import fs from 'node:fs';
import path from 'node:path';

function chargerDevVars() {
  const p = path.resolve('.dev.vars');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

chargerDevVars();

const URL_SB = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const CLE = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!URL_SB || !CLE) {
  console.error('SUPABASE_URL et SUPABASE_SECRET_KEY requis.');
  process.exit(1);
}

const headers = (extra = {}) => ({
  apikey: CLE,
  ...(CLE.startsWith('sb_') ? {} : { Authorization: `Bearer ${CLE}` }),
  'Content-Type': 'application/json',
  ...extra,
});

async function authHeaders() {
  // Supabase Auth Admin API (/auth/v1/admin/*) exige `apikey` (et Bearer pour JWT).
  // Avec les nouvelles clés `sb_secret_…`, Supabase accepte `apikey: sb_secret_…` et `Authorization: Bearer sb_secret_…`.
  return { apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' };
}

async function assurerUtilisateur({ email, password, role, nom, telephone, adresse }) {
  const h = await authHeaders();
  // Chercher si l'utilisateur existe déjà
  const listRes = await fetch(`${URL_SB}/auth/v1/admin/users?page=1&per_page=100`, { headers: h });
  if (!listRes.ok) throw new Error(`list users ${listRes.status}: ${await listRes.text()}`);
  const listData = await listRes.json();
  const existant = (listData.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());

  let userId;
  if (existant) {
    userId = existant.id;
    const upd = await fetch(`${URL_SB}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: h,
      body: JSON.stringify({ password, email_confirm: true, app_metadata: { role }, user_metadata: { nom } }),
    });
    if (!upd.ok) throw new Error(`update user ${email} ${upd.status}: ${await upd.text()}`);
    console.log(`✓ Utilisateur mis à jour : ${email} (${role})`);
  } else {
    const cre = await fetch(`${URL_SB}/auth/v1/admin/users`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role }, user_metadata: { nom } }),
    });
    if (!cre.ok) throw new Error(`create user ${email} ${cre.status}: ${await cre.text()}`);
    const created = await cre.json();
    userId = created.id;
    console.log(`✓ Utilisateur créé : ${email} (${role})`);
  }

  // Upsert profile
  const profRes = await fetch(`${URL_SB}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({
      id: userId,
      email: email.toLowerCase(),
      role,
      nom,
      telephone,
      adresse,
      marketing_opt_in: true,
      actif: true,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!profRes.ok) throw new Error(`upsert profile ${email} ${profRes.status}: ${await profRes.text()}`);
  return userId;
}

async function main() {
  const adminId = await assurerUtilisateur({
    email: 'admin@livraison.tn',
    password: 'Admin2026!',
    role: 'admin',
    nom: 'Admin Livraison',
    telephone: '21693028832',
    adresse: 'Centre-ville, Sfax',
  });

  const clientId = await assurerUtilisateur({
    email: 'client@livraison.tn',
    password: 'Client2026!',
    role: 'client',
    nom: 'Sami Test',
    telephone: '21622111222',
    adresse: 'Route Gremda km 3, Sfax',
  });

  const sousLivreurId = await assurerUtilisateur({
    email: 'livreur@livraison.tn',
    password: 'Livreur2026!',
    role: 'livreur',
    nom: 'Karim Livreur',
    telephone: '21655111222',
    adresse: 'Sfax',
  });

  // Sous-livreur de test dans public.livreurs
  const subLivRes = await fetch(`${URL_SB}/rest/v1/livreurs?on_conflict=telephone`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify({
      user_id: sousLivreurId,
      nom: 'Karim Livreur',
      telephone: '21655111222',
      email: 'livreur@livraison.tn',
      ville: 'Sfax',
      vehicule: 'Scooter',
      actif: true,
      disponible: true,
      notes: 'Sous-livreur de test',
      updated_at: new Date().toISOString(),
    }),
  });
  if (!subLivRes.ok) throw new Error(`upsert sous-livreur ${subLivRes.status}: ${await subLivRes.text()}`);
  console.log('✓ Sous-livreur prêt : Karim Livreur (livreur@livraison.tn)');

  // Livreur principal (Ahmed Livraison)
  const livRes = await fetch(`${URL_SB}/rest/v1/livreurs?on_conflict=telephone`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify({
      user_id: adminId,
      nom: 'Ahmed Livraison',
      telephone: '21693028832',
      email: 'mohamedissamdinayadi@gmail.com',
      ville: 'Sfax',
      vehicule: 'Moto',
      actif: true,
      disponible: true,
      notes: 'Livreur principal Sfax',
      updated_at: new Date().toISOString(),
    }),
  });
  if (!livRes.ok) throw new Error(`upsert livreur ${livRes.status}: ${await livRes.text()}`);
  const [livreurRow] = await livRes.json();
  console.log(`✓ Livreur prêt : ${livreurRow.nom}`);

  // Client de test dans clients_crm
  const now = new Date().toISOString();
  const crmRes = await fetch(`${URL_SB}/rest/v1/clients_crm?on_conflict=telephone`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({
      telephone: '21622111222',
      user_id: clientId,
      nom: 'Sami Test',
      email: 'client@livraison.tn',
      derniere_adresse: 'Route Gremda km 3, Sfax',
      nb_commandes: 1,
      total_depense: 18.5,
      premiere_commande_at: now,
      derniere_commande_at: now,
      marketing_email: true,
      marketing_whatsapp: true,
      tags: ['test', 'sfax'],
      updated_at: now,
    }),
  });
  if (!crmRes.ok) throw new Error(`upsert clients_crm ${crmRes.status}: ${await crmRes.text()}`);
  console.log('✓ Client CRM prêt : Sami Test');

  // Une commande d'exemple liée au client test (pour voir le suivi immédiatement)
  const sampleId = `${String(9_999_999_999_999 - Date.now()).padStart(13, '0')}-TEST01`;
  // Vérifier si TEST01 existe déjà
  const checkCmd = await fetch(`${URL_SB}/rest/v1/commandes?ref=eq.TEST01&select=id`, { headers: headers() });
  const existingCmds = checkCmd.ok ? await checkCmd.json() : [];
  if (!existingCmds.length) {
    const cmdRes = await fetch(`${URL_SB}/rest/v1/commandes`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        id: sampleId,
        livreur_whatsapp: '21693028832',
        type: 'repas',
        ref: 'TEST01',
        statut: 'en_preparation',
        creee: now,
        titre: 'Chap Lab',
        lignes: ['1× Makloub Escalope (Harissa, Mayonnaise)', '1× Frites'],
        client_nom: 'Sami Test',
        client_telephone: '21622111222',
        client_email: 'client@livraison.tn',
        adresse: 'Route Gremda km 3, Sfax',
        note: 'Sonner au 2e étage',
        total: 18.5,
        user_id: clientId,
        resto_slug: 'chap-lab',
        livreur_id: livreurRow.id,
        livreur_nom: livreurRow.nom,
        statut_updated_at: now,
        historique_statuts: [
          { statut: 'nouvelle', at: now },
          { statut: 'confirmee', at: now },
          { statut: 'en_preparation', at: now },
        ],
      }),
    });
    if (!cmdRes.ok) throw new Error(`insert sample commande ${cmdRes.status}: ${await cmdRes.text()}`);
    console.log('✓ Commande de démonstration créée : TEST01 (en_preparation)');
  } else {
    console.log('✓ Commande de démonstration TEST01 déjà présente');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
