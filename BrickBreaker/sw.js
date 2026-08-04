/*
  BrickBreaker のアセットをキャッシュして、オフライン時にも表示できるようにする Service Worker です。
  初回アクセス時に主要ファイルを保存し、以降は "キャッシュ優先 + ネットワーク更新" で配信します。
*/

const CACHE_NAME = "brickbreaker-cache-v2";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./libs/phaser.min.js",
  "./css/styles.css",
  "./js/layouts.js",
  "./js/config.js",
  "./js/constants.js",
  "./js/render.js",
  "./js/sound.js",
  "./js/phaser-game.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
