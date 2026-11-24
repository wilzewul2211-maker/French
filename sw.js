/**
 * Service worker French Beauty Network.
 * Отвечает за офлайн-оболочку и push-уведомления (сообщения и новые записи).
 */
'use strict';

const SHELL_CACHE = 'french-shell-v2';

const OFFLINE_HTML = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Нет соединения</title>' +
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0A0A0C;color:#fff;text-align:center;padding:24px}' +
  'h1{font-size:20px;margin:0 0 8px}p{color:#a1a1aa;font-size:14px;margin:0 0 20px}' +
  'button{padding:12px 22px;border:0;border-radius:12px;background:#f43f5e;color:#fff;font-weight:700;font-size:13px}' +
  '</style></head><body><div><h1>Нет соединения</h1><p>Проверьте интернет и попробуйте снова.</p>' +
  '<button onclick="location.reload()">Обновить</button></div></body></html>';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== SHELL_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => new Response(OFFLINE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.json') {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/** Отдаём из кэша сразу, а в фоне обновляем копию. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request).then((response) => {
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached || new Response('', { status: 504, statusText: 'Offline' }));

  return cached || network;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(showPush(data));
});

/**
 * Показываем уведомление только если приложение закрыто или свёрнуто:
 * — сайт открыт и виден — не показываем (это покажет сам интерфейс);
 * — приложение закрыто/в фоне — показываем.
 */
async function showPush(data) {
  if (await isBeingViewed(data.chatId)) {
    return;
  }

  await self.registration.showNotification(data.title || 'French Beauty Network', {
    body: data.body || '',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/badge-72.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    vibrate: [80, 40, 80],
    data: {
      url: data.url || '/',
      chatId: data.chatId || null
    }
  });
}

/**
 * Открыт ли сейчас сайт у пользователя (хотя бы одно видимое окно).
 * Если да — push не нужен: уведомление отображает сам интерфейс приложения.
 */
async function isBeingViewed() {
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windowClients.some((client) => client.visibilityState === 'visible');
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(openOrFocus(target));
});

/** Открыть приложение на нужном экране или перевести фокус в уже открытое окно. */
async function openOrFocus(url) {
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of windowClients) {
    if ('focus' in client) {
      await client.focus();
      if ('navigate' in client) {
        try {
          await client.navigate(url);
        } catch (error) {
          // Переход не критичен: окно уже в фокусе.
        }
      }
      return;
    }
  }

  if (self.clients.openWindow) {
    await self.clients.openWindow(url);
  }
}
