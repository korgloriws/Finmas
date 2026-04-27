// Bump deste valor a CADA deploy invalida o cache do PWA em todos os clientes.
// Sintoma de cache preso: SPA antiga servida após deploy, fluxos novos quebrados
// (ex.: login Google caindo em LandingPage), enquanto F5 forçado funciona.
const CACHE_NAME = 'finmas-cache-2026-04-27-01'
const ASSETS = ['/']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request))
    return
  }
  
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    )
    return
  }
 
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})


