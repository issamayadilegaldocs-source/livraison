// Envoi WhatsApp automatique au livreur via CallMeBot (gratuit, texte seulement) — optionnel.
// Sans CALLMEBOT_APIKEY, rien ne part ici : c'est le client qui envoie le message depuis le site.
// ponytail: unofficial free service, no SLA, currently closed to new sign-ups; the client-sent message
// and the email are the real channels.
export type EnvoiStatut = 'sent' | 'skipped' | 'failed';

export async function envoyerWhatsApp(
  numero: string,
  texte: string,
  env: { CALLMEBOT_APIKEY?: string },
): Promise<EnvoiStatut> {
  const apikey = env.CALLMEBOT_APIKEY;
  if (!apikey) return 'skipped';
  const url = `https://api.callmebot.com/whatsapp.php?${new URLSearchParams({ phone: `+${numero}`, text: texte, apikey })}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const corps = (await res.text()).slice(0, 300);
    // CallMeBot répond souvent 200 même en cas d'erreur : on lit le texte.
    if (res.ok && /queued|sent/i.test(corps) && !/error|invalid/i.test(corps)) return 'sent';
    console.error('[whatsapp] CallMeBot a refusé :', res.status, corps.replace(/<[^>]+>/g, ' ').trim());
    return 'failed';
  } catch (e) {
    console.error('[whatsapp] CallMeBot injoignable :', e instanceof Error ? e.message : e);
    return 'failed';
  }
}

/** Lien qui ouvre WhatsApp avec le message pré-rempli (lien direct : la redirection wa.me casse les emojis). */
export function lienEnvoiWhatsApp(numero: string, texte: string): string {
  return `https://api.whatsapp.com/send?${new URLSearchParams({ phone: numero, text: texte })}`;
}
