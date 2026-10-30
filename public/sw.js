/**
 * SplitSmart Service Worker
 *
 * Caching Strategies:
 * 1. Static Assets (HTML, JS, CSS, Fonts, Images, Icons) -> Cache-First
 * 2. Dynamic Services (Balances, Settlements, Sync, APIs) -> Network-First
 * 3. AI / ML Models (WASM, ONNX weights, Tesseract traineddata, HuggingFace Hub) -> Cache-First
 */

const STATIC_CACHE = 'splitsmart-static-v1';
const DYNAMIC_CACHE = 'splitsmart-dynamic-v1';
const MODEL_CACHE = 'splitsmart-models-v1';

const ALL_CACHES = [STATIC_CACHE, DYNAMIC_CACHE, MODEL_CACHE];

// Core static assets for pre-caching during Service Worker install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg',
  '/Images/SplitSmart Neon Receipt Logo.png',
  '/Images/Avatar1.png',
  '/Images/Avatar2.png',
  '/Images/Avatar3.png',
  '/Images/Avatar4.png',
  '/Images/Avatar5.png',
  '/Images/Avatar6.png',
  '/Images/Avatar7.png',
  '/Images/Avatar8.png',
];

// Helper: Determine if a request is for an AI / ML Model or WebAssembly asset
function isModelRequest(url) {
  const modelExtensions = /\.(wasm|onnx|bin|proto|traineddata)(\.gz)?($|\?)/i;
  const modelHosts = /(huggingface\.co|cdn-lfs\.huggingface\.co|tessdata|tesseract\.js-core)/i;
  const modelPaths = /(\/models\/|Xenova\/|ort-wasm)/i;

  return (
    modelExtensions.test(url.pathname) ||
    modelExtensions.test(url.href) ||
    modelHosts.test(url.hostname) ||
    modelPaths.test(url.pathname)
  );
}

// Helper: Determine if a request is for dynamic data (balances, settlements, APIs)
function isDynamicRequest(url) {
  const dynamicPaths = /(\/api\/|\/balances|\/settlements|\/sync|\/export)/i;
  return dynamicPaths.test(url.pathname) || dynamicPaths.test(url.href);
}

// Helper: Determine if a request is for static assets
function isStaticAsset(url) {
  const staticExtensions = /\.(js|css|svg|png|jpg|jpeg|webp|ico|json|woff|woff2|ttf|eot)($|\?)/i;
  const staticHosts = /(fonts\.googleapis\.com|fonts\.gstatic\.com)/i;

  return (
    url.origin === self.location.origin ||
    staticExtensions.test(url.pathname) ||
    staticHosts.test(url.hostname)
  );
}

/**
 * Cache-First Strategy
 * Used for: Static Assets and Machine Learning Models
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    // Cache valid responses (status 200 or opaque responses from CDNs like Google Fonts/HF)
    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // If navigation request fails offline, fallback to cached index.html
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/index.html');
      if (fallback) return fallback;
    }
    throw error;
  }
}

/**
 * Network-First Strategy
 * Used for: Balances, Settlements, and other dynamic services
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  // Attempt network fetch with a 4-second timeout so poor connectivity doesn't hang
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), 4000)
    );

    const networkResponse = await Promise.race([fetch(request), timeoutPromise]);

    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }

    // Non-200 response from network: check if we have a cached copy
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    return networkResponse;
  } catch (_networkError) {
    // Network failed or timed out: fall back to cached dynamic data
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Add custom header to indicate offline cached response
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-SplitSmart-Cache', 'HIT-OFFLINE');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    }

    // Neither network nor cache available: return informative offline fallback JSON
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'Unable to reach the network, and no cached dynamic data is available.',
        offline: true,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        statusText: 'Service Unavailable (Offline)',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Service Worker Installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        // Precache available assets gracefully
        await Promise.all(
          PRECACHE_ASSETS.map((asset) =>
            cache.add(asset).catch((err) => {
              // Ignore individual missing precache assets in development
              console.warn(`[SW] Precache skipped for ${asset}:`, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Service Worker Activation & Cache Cleanup
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (!ALL_CACHES.includes(name)) {
              console.log('[SW] Purging outdated cache:', name);
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch Interception
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // 1. AI/ML Models & WebAssembly (Weights, ONNX, Tesseract, HuggingFace) -> Cache-First
  if (isModelRequest(url)) {
    event.respondWith(cacheFirst(request, MODEL_CACHE));
    return;
  }

  // 2. Dynamic Services (Balances, Settlements, APIs) -> Network-First
  if (isDynamicRequest(url)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // 3. Static Assets (UI, JS, CSS, Fonts, Images, App Shell) -> Cache-First
  if (isStaticAsset(url) || request.mode === 'navigate') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
});

// Communication with clients
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});
