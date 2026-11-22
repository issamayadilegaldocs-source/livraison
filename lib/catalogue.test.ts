import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageUrl } from './catalogue';

afterEach(() => vi.unstubAllEnvs());

describe('imageUrl', () => {
  it('construit l’URL webp sur le média par défaut', () => {
    expect(imageUrl('product', '2024-a.jpg', 'thumb')).toBe('https://media.hamma-delivery.com/product/thumb/2024-a.webp');
  });
  it('respecte MEDIA_BASE_URL', () => {
    vi.stubEnv('MEDIA_BASE_URL', '/media');
    expect(imageUrl('restaurant', 'logo.png', 'full')).toBe('/media/restaurant/full/logo.webp');
  });
  it('accepte une base explicite (Function : base lue dans le fichier du resto)', () => {
    expect(imageUrl('product', 'a.jpg', 'thumb', 'https://media.x.tn/')).toBe('https://media.x.tn/product/thumb/a.webp');
  });
  it('renvoie null sans fichier', () => {
    expect(imageUrl('product', null, 'thumb')).toBeNull();
  });
});
