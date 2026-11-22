import { describe, expect, it } from 'vitest';
import { imageUrl, urlSecours } from './media';

describe('urls des images', () => {
  const B = 'https://livreur.hamma-delivery.com/media';
  it('remplace l’extension par .webp', () => expect(imageUrl('product', 'a-1.jpg', 'full', B)).toBe(`${B}/product/full/a-1.webp`));
  it('nom du dump finissant par un point nu : pas de « .. »', () => expect(imageUrl('product', '2024-03-04-65e60d6f170b3.', 'thumb', B)).toBe(`${B}/product/thumb/2024-03-04-65e60d6f170b3.webp`));
  it('sans fichier : null', () => expect(imageUrl('product', null, 'full', B)).toBeNull());
  it('repli sur l’autre hôte, dans les deux sens', () => {
    expect(urlSecours(`${B}/product/full/a.webp`)).toBe('https://media.hamma-delivery.com/product/full/a.webp');
    expect(urlSecours('https://media.hamma-delivery.com/product/full/a.webp')).toBe(`${B}/product/full/a.webp`);
    expect(urlSecours('https://autre.test/x.webp')).toBeNull();
  });
});
