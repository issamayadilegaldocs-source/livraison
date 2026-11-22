import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { optimiser } from '../scripts/images.mjs';

const SRC = path.join(__dirname, '..', 'test', 'fixtures', 'images', 'plat.jpg');

describe('optimiser', () => {
  it('crée thumb (≤400px) et full (≤1000px) en webp, puis ignore au second passage', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
    expect(await optimiser(SRC, out, 'product', 'plat.jpg')).toBe('fait');
    const thumb = await sharp(path.join(out, 'product', 'thumb', 'plat.webp')).metadata();
    const full = await sharp(path.join(out, 'product', 'full', 'plat.webp')).metadata();
    expect(thumb.format).toBe('webp');
    expect(thumb.width).toBeLessThanOrEqual(400);
    expect(full.width).toBeLessThanOrEqual(1000);
    expect(await optimiser(SRC, out, 'product', 'plat.jpg')).toBe('ignore');
  });
  it('signale une source manquante', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
    expect(await optimiser(path.join(out, 'nope.jpg'), out, 'product', 'nope.jpg')).toBe('manquant');
  });
});
