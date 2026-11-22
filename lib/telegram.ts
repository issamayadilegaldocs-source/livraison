// Alerte gratuite au livreur : message Telegram (notification sonore, boutons Itinéraire / WhatsApp client) et,
// en option, appel vocal Telegram via CallMeBot. Sans TELEGRAM_BOT_TOKEN ou sans `telegram` dans livreur.json,
// rien ne part : l'email et WhatsApp restent les canaux.
// ponytail: CallMeBot est un service gratuit sans garantie ; le message Telegram est le canal fiable.
import { formaterPrix, gain, lienMaps, type CommandeCalculee } from './commande';
import type { EnvoiStatut } from './whatsapp';

const echapper = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

/** Texte court (HTML Telegram) : l'essentiel pour décider vite. Le détail complet reste dans l'email. */
export function messageTelegram(c: CommandeCalculee, ref: string): string {
  return [
    `🛵 <b>NOUVELLE COMMANDE N° ${ref}</b>`,
    `🏪 ${echapper(c.resto.nom)}`,
    `💵 À encaisser : <b>${formaterPrix(c.total)}</b>`,
    `🧾 Somme due au restaurant : <b>${formaterPrix(c.sousTotalResto)}</b>`,
    `🤑 Votre gain : <b>${formaterPrix(gain(c))}</b>`,
    '',
    `👤 ${echapper(c.client.nom)} · +${c.client.telephone}`,
    `🏠 ${echapper(c.client.adresse)}`,
    ...(c.client.note ? [`📝 ${echapper(c.client.note)}`] : []),
  ].join('\n');
}

export async function envoyerTelegram(chatId: string, texte: string, c: CommandeCalculee, env: { TELEGRAM_BOT_TOKEN?: string }): Promise<EnvoiStatut> {
  if (!env.TELEGRAM_BOT_TOKEN) return 'skipped';
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texte,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗺️ Resto', url: lienMaps(c.resto.position) }, { text: '📍 Client', url: lienMaps(c.position) }],
            [{ text: '💬 WhatsApp client', url: `https://wa.me/${c.client.telephone}` }],
          ],
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return 'sent';
    console.error('[telegram] refusé :', res.status, (await res.text()).slice(0, 200));
    return 'failed';
  } catch (e) {
    console.error('[telegram] injoignable :', e instanceof Error ? e.message : e);
    return 'failed';
  }
}

/** Appel vocal Telegram (le livreur a autorisé @CallMeBot_txtbot une fois). `utilisateur` : @pseudo ou +216… */
export async function appelerTelegram(utilisateur: string, ref: string): Promise<EnvoiStatut> {
  const url = `https://api.callmebot.com/start.php?${new URLSearchParams({ user: utilisateur, text: `Nouvelle commande ${ref.split('').join(' ')}`, lang: 'fr-FR-Standard-A', rpt: '2' })}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.ok) return 'sent';
    console.error('[telegram] appel refusé :', res.status);
    return 'failed';
  } catch (e) {
    console.error('[telegram] appel injoignable :', e instanceof Error ? e.message : e);
    return 'failed';
  }
}
