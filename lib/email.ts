export type EmailStatut = 'sent' | 'skipped' | 'failed';

// Sans domaine vérifié, Resend n'envoie qu'à l'adresse du compte, depuis onboarding@resend.dev.
const EXPEDITEUR_PAR_DEFAUT = 'Commandes <onboarding@resend.dev>';

/** Copie email via l'API HTTP Resend. Ne lève jamais : un échec ne doit pas bloquer la commande. */
export async function envoyerEmail(
  to: string,
  sujet: string,
  texte: string,
  env: { RESEND_API_KEY?: string; BREVO_API_KEY?: string; MAIL_FROM?: string },
  html?: string,
): Promise<EmailStatut> {
  if (env.BREVO_API_KEY) return envoyerBrevo(to, sujet, texte, env.BREVO_API_KEY, env.MAIL_FROM, html);
  if (!env.RESEND_API_KEY) return 'skipped';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || EXPEDITEUR_PAR_DEFAUT,
        to,
        subject: sujet,
        text: texte,
        ...(html && { html }),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return 'sent';
    console.error('[email] Resend a refusé la copie de commande :', res.status, (await res.text()).slice(0, 200));
    return 'failed';
  } catch (e) {
    console.error('[email] Resend injoignable :', e instanceof Error ? e.message : e);
    return 'failed';
  }
}

/** « Nom <a@b.c> » ou « a@b.c » → {name?, email}. */
export function expediteur(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { ...(m[1] && { name: m[1] }), email: m[2] } : { email: from.trim() };
}

/** Brevo (300 emails/jour gratuits) : l'expéditeur se valide par un simple clic sur un lien, sans DNS. */
async function envoyerBrevo(to: string, sujet: string, texte: string, cle: string, from: string | undefined, html?: string): Promise<EmailStatut> {
  if (!from) return 'skipped'; // Brevo exige un expéditeur validé : MAIL_FROM.
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': cle, 'content-type': 'application/json' },
      body: JSON.stringify({ sender: expediteur(from), to: [{ email: to }], subject: sujet, textContent: texte, ...(html && { htmlContent: html }) }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return 'sent';
    console.error('[email] Brevo a refusé l’email :', res.status, (await res.text()).slice(0, 200));
    return 'failed';
  } catch (e) {
    console.error('[email] Brevo injoignable :', e instanceof Error ? e.message : e);
    return 'failed';
  }
}
