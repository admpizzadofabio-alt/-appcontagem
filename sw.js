/* ============================================================
   SERVICE WORKER — Pizza do Fábio ERP
   Estratégia: Network First para index, Stale-While-Revalidate assets
   ============================================================ */

const CACHE_NAME = 'pf-bebidas-v7';
const OFFLINE_URL = '/index.html';

// Assets para cachear na instalação
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/js/utils.js',
  '/js/store.js',
  '/js/auth.js',
  '/js/audit.js',
  '/js/stock.js',
  '/js/movements.js',
  '/js/counting.js',
  '/js/users.js',
  '/js/products.js',
  '/js/reports.js',
  '/js/dashboard.js',
  '/js/orders.js',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

// ── INSTALL: cacheia todos os assets ──────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando v7...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando assets estáticos');
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => console.warn('[SW] Falha ao cachear:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches antigos ───────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando v7...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deletando cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: estratégia inteligente por tipo de requisição ──────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Firebase e APIs: Network First (requer dados sempre frescos)
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.pathname.includes('/api/')
  ) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 2. Página Principal (index.html): Network First
  // Isso garante que qualquer mudança estrutural ou de scripts seja vista no F5
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 3. Assets de Terceiros (Fonts/Icons): Cache First
  if (
    url.hostname.includes('fonts.') ||
    url.hostname.includes('cdnjs.')
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 4. Assets Locais (JS, CSS, Imagens): Stale-While-Revalidate
  // Rapidez do cache + atualização silenciosa em background
  if (event.request.method === 'GET') {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

// ── Estratégia: Stale-While-Revalidate ────────────────────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkFetch = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cachedResponse || networkFetch;
}

// ── Estratégia: Cache First ───────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Estratégia: Network First ─────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    // Se falhar rede e não tem cache, e for navegação, manda pro index
    if (!cached && request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── PUSH NOTIFICATIONS ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Pizza do Fábio ERP', {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
