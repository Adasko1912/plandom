/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * PlanDom offline support (installable PWA).
 * - Pages, manifest and icons are cached on install, so the app opens offline.
 * - Hashed app code is cached the first time it is used (cache-first; names change with every build).
 * - Textures and models are cached on first use.
 * - Requests to other origins (AI providers, Supabase, manufacturer pages) are never touched.
 */
import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `plandom-${version}`;
const SHELL = [...prerendered, ...files.filter(f => /\/(manifest\.webmanifest|favicon\.svg|icons\/[^/]+)$/.test(f))];
const IMMUTABLE = new Set(build);

sw.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && key.startsWith('plandom-')) await caches.delete(key);
    await sw.clients.claim();
  })());
});

async function fromNetwork(request: Request, cache: Cache): Promise<Response> {
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
  return response;
}

sw.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin || url.search) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Pages: fresh when online, cached shell when offline.
    if (request.mode === 'navigate') {
      try { return await fromNetwork(request, cache); } catch {
        const scope = new URL(sw.registration.scope).pathname;
        return (await cache.match(request)) ?? (await cache.match(url.pathname.replace(/\/$/, '') || scope))
          ?? (await cache.match(scope)) ?? (await cache.match(scope.replace(/\/$/, ''))) ?? Response.error();
      }
    }
    const cached = await cache.match(request);
    if (cached && (IMMUTABLE.has(url.pathname) || SHELL.includes(url.pathname))) return cached;
    try { return await fromNetwork(request, cache); } catch { return cached ?? Response.error(); }
  })());
});
