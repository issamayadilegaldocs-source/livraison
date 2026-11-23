// Fonctionnalités Application (parité hamma-app) : Avis restaurants, Chat temps réel Client <-> Livreur,
// Programme de Parrainage (codes & crédits) et Tickets Support Client <-> Admin.
import { z } from 'zod';
import { lireConfig, reglages } from './config';
import { envoyerEmail } from './email';
import type { Livreur } from './livreur';
import { verifierUtilisateur, type CommandeSuivi, type ProfilUtilisateur } from './plateforme';
import type { Env } from './serveur';
import { stockage, type EnvStockage } from './supabase';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const err = (status: number, message: string) => json({ erreur: message }, status);
const enc = encodeURIComponent;
const SLUG_RE = /^[a-z0-9-]{1,80}$/;

function normaliserTelephone(brut: string): string | null {
  const c = brut.replace(/\D/g, '');
  if (c.length === 8) return `216${c}`;
  if (c.length === 11 && c.startsWith('216')) return c;
  if (c.length === 13 && c.startsWith('00216')) return c.slice(2);
  return null;
}

function configSupabase(env: EnvStockage): { url: string; cle: string } | null {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const cle = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return url && cle ? { url, cle } : null;
}

function headersSupabase(cle: string, extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = { apikey: cle, ...extra };
  if (cle.startsWith('eyJ')) h.Authorization = `Bearer ${cle}`;
  return h;
}

function restFetch(
  sb: { url: string; cle: string },
  path: string,
  init: RequestInit = {},
  extra: Record<string, string> = {},
) {
  return fetch(`${sb.url}/rest/v1/${path}`, { ...init, headers: headersSupabase(sb.cle, extra) });
}

// --- Types exportés ---

export type AvisRestaurant = {
  id: string;
  resto_slug: string;
  resto_nom: string;
  commande_id: string | null;
  user_id: string | null;
  client_nom: string;
  note: number;
  commentaire: string | null;
  visible: boolean;
  created_at: string;
};

export type MessageChat = {
  id: string;
  commande_id: string;
  sender_role: 'client' | 'livreur' | 'admin';
  sender_nom: string;
  message: string;
  created_at: string;
};

export type TicketSupport = {
  id: string;
  user_id: string | null;
  client_nom: string;
  client_email: string | null;
  client_telephone: string | null;
  commande_ref: string | null;
  categorie: 'order related' | 'others';
  titre: string;
  statut: 'ouvert' | 'en_cours' | 'resolu';
  created_at: string;
  updated_at: string;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_role: 'client' | 'admin';
  sender_nom: string;
  message: string;
  created_at: string;
};

export type InfoParrainage = {
  code: string;
  actif: boolean;
  montantParrain: number;
  montantFilleul: number;
  creditBalance: number;
  invitedCount: number;
  hasAppliedCode: boolean;
  canApplyCode: boolean;
};

// ============================================================================
// 1. AVIS & NOTES RESTAURANTS (/api/avis)
// ============================================================================

const AvisSchema = z.object({
  resto_slug: z.string().regex(SLUG_RE),
  resto_nom: z.string().trim().min(1).max(120),
  commande_id: z.string().trim().max(120).optional().nullable(),
  note: z.coerce.number().int().min(1).max(5),
  commentaire: z.string().trim().max(500).optional().nullable(),
  // Optionnel si invité avec suivi ref + tel
  client_nom: z.string().trim().min(2).max(80).optional(),
  ref: z.string().trim().max(20).optional(),
  tel: z.string().trim().max(25).optional(),
});

export async function gererAvis(req: Request, env: Env): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Supabase non configuré.');
  const u = new URL(req.url);

  if (req.method === 'GET') {
    const tous = u.searchParams.get('tous') === '1';
    if (tous) {
      const user = await verifierUtilisateur(env, req);
      if (!user || user.role !== 'admin') return err(403, 'Réservé à l’administrateur.');
      const res = await restFetch(sb, 'avis_restaurants?select=*&order=created_at.desc&limit=200');
      const avis = res.ok ? ((await res.json()) as AvisRestaurant[]) : [];
      return json({ avis });
    }
    const slug = u.searchParams.get('resto') ?? '';
    if (!SLUG_RE.test(slug)) return err(400, 'Restaurant invalide.');
    const res = await restFetch(
      sb,
      `avis_restaurants?resto_slug=eq.${enc(slug)}&visible=eq.true&select=*&order=created_at.desc&limit=100`,
    );
    const avis = res.ok ? ((await res.json()) as AvisRestaurant[]) : [];
    const total = avis.length;
    const moyenne = total ? Number((avis.reduce((s, a) => s + Number(a.note), 0) / total).toFixed(1)) : 0;
    const repartition: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const a of avis) repartition[a.note] = (repartition[a.note] ?? 0) + 1;
    return json({ avis, moyenne, total, repartition });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => null);
    const parsed = AvisSchema.safeParse(body);
    if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Avis invalide.');
    const user = await verifierUtilisateur(env, req);

    let clientNom = user?.nom || parsed.data.client_nom || '';
    if (!user) {
      // Vérification légère invité par ref + téléphone de commande
      const telNorm = normaliserTelephone(parsed.data.tel ?? '');
      const refClean = (parsed.data.ref ?? '').toUpperCase();
      if (!telNorm || !refClean) {
        return err(401, 'Connectez-vous à votre compte client pour laisser un avis.');
      }
      const cmdRes = await restFetch(
        sb,
        `commandes?ref=eq.${enc(refClean)}&client_telephone=eq.${enc(telNorm)}&select=id,client_nom&limit=1`,
      );
      const rows = cmdRes.ok ? ((await cmdRes.json()) as { id: string; client_nom: string }[]) : [];
      if (!rows[0]) return err(403, 'Commande non trouvée pour ce numéro.');
      clientNom = rows[0].client_nom || clientNom || 'Client';
    }

    const res = await restFetch(
      sb,
      'avis_restaurants?select=*',
      {
        method: 'POST',
        body: JSON.stringify({
          resto_slug: parsed.data.resto_slug,
          resto_nom: parsed.data.resto_nom,
          commande_id: parsed.data.commande_id ?? null,
          user_id: user?.id ?? null,
          client_nom: clientNom || 'Client',
          note: parsed.data.note,
          commentaire: parsed.data.commentaire || null,
          visible: true,
        }),
      },
      { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    );
    if (!res.ok) return err(500, 'Impossible d’enregistrer votre avis.');
    const [created] = await res.json();
    return json({ avis: created }, 201);
  }

  if (req.method === 'DELETE') {
    const user = await verifierUtilisateur(env, req);
    if (!user || user.role !== 'admin') return err(403, 'Réservé à l’administrateur.');
    const id = u.searchParams.get('id') ?? '';
    if (!id) return err(400, 'Identifiant avis manquant.');
    const res = await restFetch(sb, `avis_restaurants?id=eq.${enc(id)}`, { method: 'DELETE' });
    if (!res.ok) return err(500, 'Suppression impossible.');
    return json({ ok: true });
  }

  return err(405, 'Méthode non autorisée.');
}

// ============================================================================
// 2. CHAT TEMPS RÉEL CLIENT <-> LIVREUR / ADMIN (/api/chat)
// ============================================================================

async function verifierAccesChat(
  sb: { url: string; cle: string },
  env: EnvStockage,
  req: Request,
  cmdId: string,
  refGuest?: string | null,
  telGuest?: string | null,
): Promise<
  | { ok: true; cmd: CommandeSuivi; role: 'client' | 'livreur' | 'admin'; nom: string }
  | { ok: false; status: number; erreur: string }
> {
  const cmdRes = await restFetch(sb, `commandes?id=eq.${enc(cmdId)}&select=*&limit=1`);
  const rows = cmdRes.ok ? ((await cmdRes.json()) as CommandeSuivi[]) : [];
  const cmd = rows[0];
  if (!cmd) return { ok: false, status: 404, erreur: 'Commande introuvable.' };

  const user = await verifierUtilisateur(env, req);
  if (user) {
    if (user.role === 'admin') {
      return { ok: true, cmd, role: 'admin', nom: user.nom || 'Admin' };
    }
    if (user.role === 'livreur') {
      const lRes = await restFetch(sb, `livreurs?user_id=eq.${enc(user.id)}&select=id,nom&limit=1`);
      const livs = lRes.ok ? ((await lRes.json()) as { id: string; nom: string }[]) : [];
      if (!livs[0] || cmd.livreur_id !== livs[0].id) {
        return { ok: false, status: 403, erreur: 'Cette commande ne vous est pas affectée.' };
      }
      return { ok: true, cmd, role: 'livreur', nom: livs[0].nom || user.nom || 'Livreur' };
    }
    // Client connecté : propriétaire par user_id ou par téléphone normalisé
    const telUser = normaliserTelephone(user.telephone ?? '');
    if (cmd.user_id === user.id || (telUser && cmd.client_telephone === telUser)) {
      return { ok: true, cmd, role: 'client', nom: user.nom || cmd.client_nom || 'Client' };
    }
  }

  // Client invité avec ref + téléphone
  const telNorm = normaliserTelephone(telGuest ?? '');
  if (refGuest && telNorm && cmd.ref.toUpperCase() === refGuest.trim().toUpperCase() && cmd.client_telephone === telNorm) {
    return { ok: true, cmd, role: 'client', nom: cmd.client_nom || 'Client' };
  }

  return { ok: false, status: 403, erreur: 'Accès non autorisé à ce chat.' };
}

export async function gererChat(req: Request, env: Env): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Supabase non configuré.');
  const u = new URL(req.url);

  if (req.method === 'GET') {
    const cmdId = u.searchParams.get('commande_id') ?? '';
    if (!cmdId) return err(400, 'Commande requise.');
    const acces = await verifierAccesChat(sb, env, req, cmdId, u.searchParams.get('ref'), u.searchParams.get('tel'));
    if (!acces.ok) return err(acces.status, acces.erreur);
    const res = await restFetch(
      sb,
      `chat_commandes?commande_id=eq.${enc(cmdId)}&select=*&order=created_at.asc&limit=100`,
    );
    const messages = res.ok ? ((await res.json()) as MessageChat[]) : [];
    return json({
      messages,
      moi: { role: acces.role, nom: acces.nom },
      commande: {
        id: acces.cmd.id,
        ref: acces.cmd.ref,
        titre: acces.cmd.titre,
        statut: acces.cmd.statut,
        livreur_nom: acces.cmd.livreur_nom,
      },
    });
  }

  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as {
      commande_id?: unknown;
      message?: unknown;
      ref?: unknown;
      tel?: unknown;
    } | null;
    const cmdId = typeof body?.commande_id === 'string' ? body.commande_id : '';
    const msg = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!cmdId || !msg || msg.length > 500) return err(400, 'Message invalide (1 à 500 caractères).');

    const acces = await verifierAccesChat(
      sb,
      env,
      req,
      cmdId,
      typeof body?.ref === 'string' ? body.ref : null,
      typeof body?.tel === 'string' ? body.tel : null,
    );
    if (!acces.ok) return err(acces.status, acces.erreur);

    const res = await restFetch(
      sb,
      'chat_commandes?select=*',
      {
        method: 'POST',
        body: JSON.stringify({
          commande_id: cmdId,
          sender_role: acces.role,
          sender_nom: acces.nom,
          message: msg,
        }),
      },
      { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    );
    if (!res.ok) return err(500, 'Envoi du message impossible.');
    const [created] = await res.json();
    return json({ message: created }, 201);
  }

  return err(405, 'Méthode non autorisée.');
}

// ============================================================================
// 3. PROGRAMME DE PARRAINAGE (/api/parrainage)
// ============================================================================

export function genererCodeParrainage(nom: string, prefixe = 'LIV'): string {
  const base = (nom || prefixe)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'CLI';
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${base}-${suffix}`;
}

async function lireConfigParrainage(env: Env, livreur: Livreur) {
  const store = stockage(env);
  const cfg = store ? await store.lireConfig(livreur.whatsapp).catch(() => lireConfig(null)) : lireConfig(null);
  const r = reglages(livreur, cfg);
  return r.parrainage;
}

async function construireInfoParrainage(
  sb: { url: string; cle: string },
  user: ProfilUtilisateur,
  conf: { actif: boolean; montantParrain: number; montantFilleul: number },
): Promise<InfoParrainage> {
  const pRes = await restFetch(
    sb,
    `profiles?id=eq.${enc(user.id)}&select=id,nom,code_parrainage,credit_parrainage,parraine_par&limit=1`,
  );
  const rows = pRes.ok
    ? ((await pRes.json()) as {
        id: string;
        nom: string;
        code_parrainage: string | null;
        credit_parrainage: number | string;
        parraine_par: string | null;
      }[])
    : [];
  let row = rows[0];
  let code = row?.code_parrainage ?? '';

  if (!code) {
    code = genererCodeParrainage(user.nom || 'CLI');
    await restFetch(
      sb,
      `profiles?id=eq.${enc(user.id)}`,
      { method: 'PATCH', body: JSON.stringify({ code_parrainage: code, updated_at: new Date().toISOString() }) },
      { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    ).catch(() => {});
  }

  const invRes = await restFetch(sb, `parrainages?parrain_user_id=eq.${enc(user.id)}&select=id&limit=500`);
  const invites = invRes.ok ? ((await invRes.json()) as { id: string }[]) : [];
  const hasAppliedCode = Boolean(row?.parraine_par);

  return {
    code,
    actif: conf.actif,
    montantParrain: conf.montantParrain,
    montantFilleul: conf.montantFilleul,
    creditBalance: Number(row?.credit_parrainage ?? 0),
    invitedCount: invites.length,
    hasAppliedCode,
    canApplyCode: conf.actif && !hasAppliedCode,
  };
}

export async function gererParrainage(req: Request, env: Env, livreur: Livreur): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Supabase non configuré.');
  const user = await verifierUtilisateur(env, req);
  if (!user) return err(401, 'Connexion requise.');

  const conf = await lireConfigParrainage(env, livreur);

  if (req.method === 'GET') {
    const info = await construireInfoParrainage(sb, user, conf);
    return json({ parrainage: info });
  }

  if (req.method === 'POST') {
    if (!conf.actif) return err(400, 'Le programme de parrainage est actuellement désactivé.');
    const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
    const codeSaisi = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!codeSaisi || codeSaisi.length < 4 || codeSaisi.length > 24) {
      return err(400, 'Code de parrainage invalide.');
    }

    const moi = await construireInfoParrainage(sb, user, conf);
    if (moi.hasAppliedCode) return err(409, 'Vous avez déjà utilisé un code de parrainage.');
    if (moi.code.toUpperCase() === codeSaisi) return err(400, 'Vous ne pouvez pas utiliser votre propre code.');

    const parRes = await restFetch(
      sb,
      `profiles?code_parrainage=eq.${enc(codeSaisi)}&select=id,nom,credit_parrainage&limit=1`,
    );
    const parRows = parRes.ok
      ? ((await parRes.json()) as { id: string; nom: string; credit_parrainage: number | string }[])
      : [];
    const parrain = parRows[0];
    if (!parrain) return err(404, 'Code de parrainage introuvable.');
    if (parrain.id === user.id) return err(400, 'Vous ne pouvez pas utiliser votre propre code.');

    const insRes = await restFetch(
      sb,
      'parrainages',
      {
        method: 'POST',
        body: JSON.stringify({
          parrain_user_id: parrain.id,
          filleul_user_id: user.id,
          code: codeSaisi,
          montant_parrain: conf.montantParrain,
          montant_filleul: conf.montantFilleul,
        }),
      },
      { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    );
    if (!insRes.ok) return err(409, 'Ce parrainage a déjà été appliqué.');

    const now = new Date().toISOString();
    const nouveauCreditFilleul = Number((moi.creditBalance + conf.montantFilleul).toFixed(3));
    const nouveauCreditParrain = Number((Number(parrain.credit_parrainage ?? 0) + conf.montantParrain).toFixed(3));

    await Promise.all([
      restFetch(
        sb,
        `profiles?id=eq.${enc(user.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ parraine_par: parrain.id, credit_parrainage: nouveauCreditFilleul, updated_at: now }),
        },
        { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      ),
      restFetch(
        sb,
        `profiles?id=eq.${enc(parrain.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ credit_parrainage: nouveauCreditParrain, updated_at: now }),
        },
        { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      ),
    ]);

    const updated = await construireInfoParrainage(sb, user, conf);
    return json({
      ok: true,
      message: `Bravo ! +${conf.montantFilleul} DT ajoutés à votre crédit parrainage (parrain : ${parrain.nom}).`,
      parrainage: updated,
    });
  }

  return err(405, 'Méthode non autorisée.');
}

// ============================================================================
// 4. SUPPORT & TICKETS D'AIDE (/api/support)
// ============================================================================

const NouveauTicketSchema = z.object({
  categorie: z.enum(['order related', 'others']).default('order related'),
  titre: z.string().trim().min(3).max(120),
  message: z.string().trim().min(3).max(1000),
  commande_ref: z.string().trim().max(20).optional().nullable(),
});

export async function gererSupport(req: Request, env: Env, livreur: Livreur): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Supabase non configuré.');
  const user = await verifierUtilisateur(env, req);
  if (!user) return err(401, 'Connexion requise.');
  const u = new URL(req.url);

  if (req.method === 'GET') {
    const ticketId = u.searchParams.get('ticket_id');
    if (ticketId) {
      const tRes = await restFetch(sb, `tickets_support?id=eq.${enc(ticketId)}&select=*&limit=1`);
      const rows = tRes.ok ? ((await tRes.json()) as TicketSupport[]) : [];
      const ticket = rows[0];
      if (!ticket) return err(404, 'Ticket introuvable.');
      if (user.role !== 'admin' && ticket.user_id !== user.id) return err(403, 'Accès refusé.');
      const mRes = await restFetch(
        sb,
        `tickets_messages?ticket_id=eq.${enc(ticketId)}&select=*&order=created_at.asc&limit=100`,
      );
      const messages = mRes.ok ? ((await mRes.json()) as TicketMessage[]) : [];
      return json({ ticket, messages });
    }

    const filtre = user.role === 'admin' ? '' : `user_id=eq.${enc(user.id)}&`;
    const res = await restFetch(sb, `tickets_support?${filtre}select=*&order=updated_at.desc&limit=100`);
    const tickets = res.ok ? ((await res.json()) as TicketSupport[]) : [];
    const ouverts = tickets.filter((t) => t.statut !== 'resolu').length;
    return json({ tickets, ouverts });
  }

  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return err(400, 'Requête invalide.');

    // Réponse à un ticket existant
    if (typeof body.ticket_id === 'string' && body.ticket_id) {
      const ticketId = body.ticket_id;
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 1000) return err(400, 'Message requis (1 à 1000 caractères).');

      const tRes = await restFetch(sb, `tickets_support?id=eq.${enc(ticketId)}&select=*&limit=1`);
      const rows = tRes.ok ? ((await tRes.json()) as TicketSupport[]) : [];
      const ticket = rows[0];
      if (!ticket) return err(404, 'Ticket introuvable.');
      if (user.role !== 'admin' && ticket.user_id !== user.id) return err(403, 'Accès refusé.');

      const senderRole: 'client' | 'admin' = user.role === 'admin' ? 'admin' : 'client';
      const ins = await restFetch(
        sb,
        'tickets_messages?select=*',
        {
          method: 'POST',
          body: JSON.stringify({
            ticket_id: ticketId,
            sender_role: senderRole,
            sender_nom: user.nom || (senderRole === 'admin' ? livreur.nom : 'Client'),
            message,
          }),
        },
        { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      );
      if (!ins.ok) return err(500, 'Envoi impossible.');
      const [created] = await ins.json();

      const nextStatut = senderRole === 'admin' && ticket.statut === 'ouvert' ? 'en_cours' : ticket.statut;
      await restFetch(
        sb,
        `tickets_support?id=eq.${enc(ticketId)}`,
        { method: 'PATCH', body: JSON.stringify({ statut: nextStatut, updated_at: new Date().toISOString() }) },
        { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      ).catch(() => {});

      // Notifier par email l'autre partie
      const origine = u.origin;
      if (senderRole === 'admin' && ticket.client_email) {
        await envoyerEmail(
          ticket.client_email,
          `🎧 Réponse à votre demande : ${ticket.titre}`,
          `Bonjour ${ticket.client_nom},\n\nL’équipe ${livreur.nom} a répondu à votre ticket « ${ticket.titre} » :\n\n"${message}"\n\nRépondre : ${origine}/compte`,
          env,
        ).catch(() => {});
      } else if (senderRole === 'client') {
        await envoyerEmail(
          livreur.email,
          `🎧 Nouveau message support : ${ticket.titre} (${ticket.client_nom})`,
          `${ticket.client_nom} a répondu au ticket « ${ticket.titre} » :\n\n"${message}"\n\nRépondre : ${origine}/admin`,
          env,
        ).catch(() => {});
      }

      return json({ message: created, statut: nextStatut }, 201);
    }

    // Création d'un nouveau ticket
    const parsed = NouveauTicketSchema.safeParse(body);
    if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Données du ticket invalides.');

    const tIns = await restFetch(
      sb,
      'tickets_support?select=*',
      {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          client_nom: user.nom || 'Client',
          client_email: user.email || null,
          client_telephone: user.telephone || null,
          commande_ref: parsed.data.commande_ref?.trim().toUpperCase() || null,
          categorie: parsed.data.categorie,
          titre: parsed.data.titre,
          statut: 'ouvert',
        }),
      },
      { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    );
    if (!tIns.ok) return err(500, 'Impossible de créer le ticket.');
    const [ticket] = (await tIns.json()) as TicketSupport[];

    await restFetch(
      sb,
      'tickets_messages',
      {
        method: 'POST',
        body: JSON.stringify({
          ticket_id: ticket.id,
          sender_role: 'client',
          sender_nom: user.nom || 'Client',
          message: parsed.data.message,
        }),
      },
      { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    ).catch(() => {});

    await envoyerEmail(
      livreur.email,
      `🎧 Nouveau ticket support : ${ticket.titre} (${user.nom})`,
      `Client : ${user.nom}${user.telephone ? ` (+${user.telephone})` : ''}\nCatégorie : ${ticket.categorie}${ticket.commande_ref ? `\nCommande : N° ${ticket.commande_ref}` : ''}\n\nMessage :\n${parsed.data.message}\n\nRépondre dans /admin : ${u.origin}/admin`,
      env,
    ).catch(() => {});

    return json({ ticket }, 201);
  }

  if (req.method === 'PATCH') {
    if (user.role !== 'admin') return err(403, 'Réservé à l’administrateur.');
    const body = (await req.json().catch(() => null)) as { ticket_id?: unknown; statut?: unknown } | null;
    const ticketId = typeof body?.ticket_id === 'string' ? body.ticket_id : '';
    const statut = body?.statut === 'ouvert' || body?.statut === 'en_cours' || body?.statut === 'resolu' ? body.statut : null;
    if (!ticketId || !statut) return err(400, 'Ticket et statut requis.');

    const res = await restFetch(
      sb,
      `tickets_support?id=eq.${enc(ticketId)}&select=*`,
      { method: 'PATCH', body: JSON.stringify({ statut, updated_at: new Date().toISOString() }) },
      { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    );
    if (!res.ok) return err(500, 'Mise à jour impossible.');
    const [updated] = await res.json();
    return json({ ticket: updated });
  }

  return err(405, 'Méthode non autorisée.');
}
