const CACHE_NAME = 'plerygun3d-v14';
const APP_FILES = [
  './',
  './PleryGun3D.html',
  './server-config.js',
  './styles.css',
  './game.js',
  './grass-texture.jpg',
  './skybox.jpg',
  './minecraft-tree.png',
  './minecraft-tree-model/Minecraft%20Tree/tex/Leaves%20Transparent.png',
  './minecraft-tree-model/Minecraft%20Tree/tex/Logs%20Side.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
