import type { Metadata } from 'next';
import Link from '@/app/components/Lien';
import { getLivreur } from '@/lib/livreur';

export function generateMetadata(): Metadata {
  const l = getLivreur();
  return {
    title: `Politique de confidentialité — ${l.nom}`,
    description: `Protection de vos données personnelles sur ${l.nom}.`,
  };
}

export default function PolitiqueConfidentialite() {
  const l = getLivreur();
  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="mb-4">
        <Link href="/" className="text-sm font-bold text-primary underline">
          ← Retour à l’accueil
        </Link>
      </div>
      <article className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Politique de confidentialité
        </h1>
        <p className="mt-2 text-xs font-semibold text-muted">
          Service de livraison {l.nom} ({l.ville}) · Dernière mise à jour : 2026
        </p>

        <section className="mt-6 space-y-4 text-sm leading-relaxed text-ink/90">
          <div>
            <h2 className="m-0 text-base font-extrabold text-ink">1. Données collectées</h2>
            <p className="mt-1">
              Lors de la création de votre compte (par email ou via Google) et lors de vos commandes, nous collectons
              uniquement les informations nécessaires à la livraison : nom, adresse email, numéro de téléphone, adresse
              de livraison et historique de vos commandes.
            </p>
          </div>

          <div>
            <h2 className="m-0 text-base font-extrabold text-ink">2. Utilisation des données</h2>
            <p className="mt-1">
              Vos données servent exclusivement à préparer, livrer et suivre vos commandes, vous contacter en cas de
              besoin pendant la livraison, gérer votre programme de parrainage et répondre à vos demandes d’assistance.
              Les restaurants partenaires ne reçoivent jamais vos coordonnées privées (téléphone ou adresse).
            </p>
          </div>

          <div>
            <h2 className="m-0 text-base font-extrabold text-ink">3. Connexion avec Google</h2>
            <p className="mt-1">
              Si vous choisissez « Continuer avec Google », nous recevons uniquement votre nom et votre adresse email
              pour créer ou ouvrir votre compte client en un clic. Nous n’accédons à aucune autre donnée de votre compte
              Google.
            </p>
          </div>

          <div>
            <h2 className="m-0 text-base font-extrabold text-ink">4. Conservation &amp; droits</h2>
            <p className="mt-1">
              Vous pouvez modifier vos informations à tout moment depuis votre espace{' '}
              <Link href="/compte" className="font-bold text-primary underline">
                Mon compte
              </Link>{' '}
              ou demander la suppression de votre compte et de vos données en nous écrivant à{' '}
              <a href={`mailto:${l.email}`} className="font-bold text-primary underline">
                {l.email}
              </a>
              .
            </p>
          </div>
        </section>
      </article>
    </div>
  );
}
