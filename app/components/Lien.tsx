'use client';

import NextLink from 'next/link';
import type { AnchorHTMLAttributes } from 'react';

/**
 * Navigation instantanée SPA via next/link (prefetch actif, zéro rechargement de page, zéro flash blanc)
 * pour tous les liens internes ; balise <a> classique pour les liens externes (https, tel, mailto, wa.me).
 */
export default function Lien({ href = '', target, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const estInterne =
    typeof href === 'string' &&
    href.startsWith('/') &&
    !href.startsWith('//') &&
    !href.startsWith('/api/') &&
    target !== '_blank';

  if (estInterne) {
    return <NextLink href={href} prefetch={true} {...props} />;
  }

  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <a href={href} target={target} {...props} />;
}
