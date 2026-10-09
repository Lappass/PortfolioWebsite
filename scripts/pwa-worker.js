/* Generated core and resource hashes; never registered in development. */
const VERSION = __CACHE_VERSION__;
const FILES = __PRECACHE_FILES__;
const HASHES = __RESOURCE_HASHES__;
const PREFIX = `rhine-lab:${new URL(self.registration.scope).pathname}:`;
const CACHE = PREFIX + VERSION;
const urls = FILES.map(path => new URL(path, self.registration.scope).href);
const expected = new Map(Object.entries(HASHES).map(([path, hash]) => [new URL(path, self.registration.scope).href, hash]));
const allowed = new Set(expected.keys());
const index = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // Only the small application core is downloaded during installation.
      // Keep successful files private until every core resource is present; failure
      // still deletes this entire release and leaves the active release intact.
      let next = 0;
      const workers = Array.from({ length: 6 }, async () => {
        while (next < urls.length) {
          const url = urls[next++];
          const immutable = /\/fonts\/misans-webfont-4\.3\.1\//.test(url) || /\/assets\/archive-(cassette|assembly)\.[a-f0-9]{16}\.glb$/.test(url);
          if (url === index) {
            // Pages redirects index.html to the directory URL. Keep the release's
            // cache key, but fetch the canonical page without a followed redirect.
            const response = await fetch(new Request(self.registration.scope, { cache: "no-cache" }));
            if (!response.ok) throw new Error(`Homepage download failed: ${response.status}`);
            await cache.put(url, response);
          } else {
            await cache.add(new Request(url, { cache: immutable ? "default" : "no-cache" }));
          }
        }
      });
      const results = await Promise.allSettled(workers);
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const current = await caches.open(CACHE);
    // Reuse previously downloaded resources only when their contents still match.
    // This also migrates the old full cache without fetching the font family again.
    for (const key of await caches.keys()) {
      if (!key.startsWith(PREFIX) || key === CACHE) continue;
      const previous = await caches.open(key);
      for (const request of await previous.keys()) {
        if (!allowed.has(request.url) || await current.match(request)) continue;
        const response = await previous.match(request);
        if (response && await matchesRelease(request.url, response)) {
          try { await current.put(request, response); } catch { /* Storage is optional for lazy resources. */ }
        }
      }
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "RHINE_APPLY_UPDATE") event.waitUntil(self.skipWaiting());
  // Resources loaded before the first worker took control are already in the
  // browser HTTP cache; save only those actually requested by the current page.
  if (event.data?.type === "RHINE_CACHE_USED" && Array.isArray(event.data.urls)) {
    event.waitUntil(Promise.allSettled(event.data.urls.filter(url => allowed.has(url)).map(url => cachedResource(url))));
  }
});
async function matchesRelease(key, response) {
  if (!response.ok || !expected.has(key)) return false;
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return hex === expected.get(key);
}
const pending = new Map();
function cachedResource(key, request = new Request(key)) {
  if (pending.has(key)) return pending.get(key).then(response => response.clone());
  const task = (async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(request);
    if (!await matchesRelease(key, response)) throw new Error('Resource unavailable for this release');
    try { await cache.put(key, response.clone()); } catch { /* Still serve online if storage is full. */ }
    return response;
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task.then(response => response.clone());
}
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  url.search = "";
  url.hash = "";
  const navigation = event.request.mode === "navigate" &&
    (url.href === self.registration.scope || url.href === index);
  const key = navigation ? index : url.href;
  if (!allowed.has(key)) return;
  const result = cachedResource(key, event.request).then(cached => {
    // A navigation uses redirect: manual and cannot consume a response whose
    // URL list contains a followed redirect (including older cached releases).
    if (navigation && cached?.redirected) {
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
      });
    }
    return cached;
  });
  event.respondWith(result);
  event.waitUntil(result.then(() => {}, () => {}));
});
