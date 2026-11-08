import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { renderLabAsset } from './tooling/render-lab-asset';
import { catalogAssets } from './tooling/catalog-assets.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig(({ isPreview }) => isPreview ? {
  // Preview the Pages artifact alone, without SvelteKit's server build.
  base: process.env.BASE_PATH ?? '',
  build: { outDir: 'build' },
  appType: 'mpa',
  plugins: [{
    name: 'static-pages-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith(`${process.env.BASE_PATH ?? ''}/_app/immutable/`)) res.setHeader('Cache-Control', 'public,max-age=31536000,immutable');
        next();
      });
      return () => server.middlewares.use((req, res, next) => {
        // Vite has resolved extensionless routes, but serves their HTML after this hook.
        const pathname = new URL(req.url!, 'http://localhost').pathname;
        if (pathname.endsWith('.html') && existsSync(resolve('build', `.${decodeURIComponent(pathname)}`))) return next();
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(readFileSync('build/404.html'));
      });
    },
  }],
} : {
	plugins: [
    {
      name: 'require-production-build',
      configResolved(config) {
        if (config.command === 'build' && !config.isProduction) {
          throw new Error('Production builds require NODE_ENV=production. Use NPM_CONFIG_INCLUDE=dev to install build tools.');
        }
      },
    },
    renderLabAsset(), catalogAssets(), tailwindcss(), sveltekit(),
  ]
});
