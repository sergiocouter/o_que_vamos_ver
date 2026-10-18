// Lembrete diário: carregado pelo service worker gerado (workbox.importScripts em vite.config.ts).

self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data ? event.data.json() : null
  } catch {
    payload = null
  }
  if (!payload || typeof payload.title !== 'string') return

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      image: payload.image,
      tag: payload.tag || 'lembrete-diario',
      data: { url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const appWindow = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (appWindow) {
        const navigated = await appWindow.navigate(target).catch(() => null)
        return (navigated || appWindow).focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
