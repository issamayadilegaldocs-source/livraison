import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  esbuild: { jsx: 'automatic' },
  // Tests run on fixtures, so a real copy (other WhatsApp, fee, city) stays green.
  // lib/copie.test.ts checks the copy's real livreur.json and data/ separately.
  test: { environment: 'node', env: { LIVREUR_FILE: 'test/fixtures/livreur.json', DATA_DIR: 'test/fixtures/data' } },
});
