import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  // Site 100 % statique (Cloudflare Pages) : la commande passe par functions/api/commande.ts.
  output: 'export',
  // Id fixe : sinon il change à chaque build, donc dans tous les HTML, et `wrangler pages deploy` renvoie tout.
  generateBuildId: () => 'livreur',
  // Pin tracing root: stray lockfiles higher up the disk otherwise become the root.
  outputFileTracingRoot: path.join(__dirname),
  webpack(cfg, { dev }) {
    // Dev only: never watch the images or the city data. Watching them made the dev server grow to
    // 17 GB of RAM over a few hours and crash its workers.
    if (dev) cfg.watchOptions = { ...cfg.watchOptions, ignored: ['**/node_modules/**', '**/.next/**', '**/media/**', '**/villes/**', '**/out/**'] };
    return cfg;
  },
};

export default config;
