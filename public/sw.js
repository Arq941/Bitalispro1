// Service Worker para Sistema de Ventas y Cobranza Campo (PWA)
const CACHE_NAME = 'pwa-cobranza-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.ico'
];

// Instalar Service Worker y almacenar en caché recursos clave
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando SW y guardando caché inicial...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[Service Worker] Fallo parcial al precargar caché:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activar Service Worker y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando SW y limpiando cachés previas...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Manejo de eventos de notificaciones PUSH remotas
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Evento Push recibido:', event);

  let data = {
    title: '⚠️ Alerta de Captación de Efectivo',
    body: 'La captación de efectivo en ruta está por debajo del promedio semanal proyectado.',
    icon: '/favicon.ico',
    tag: 'alerta-captacion-baja',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'alerta-captacion-baja',
    renotify: true,
    data: data.data || { url: '/' },
    actions: [
      { action: 'ver_cartera', title: '📊 Ver Cartera' },
      { action: 'cobrar', title: '⚡ Registrar Abono' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Manejo de clics en Notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Clic en notificación:', event.notification);
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Manejo de mensajes desde el cliente principal
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Mensaje recibido del cliente:', event.data);

  if (event.data && event.data.type === 'SHOW_CAPTACION_ALERT') {
    const { title, body, montoActual, promedioSemanal, porcentaje } = event.data;
    
    const notificationTitle = title || '⚠️ ALERTA CRÍTICA: Captación Baja de Efectivo';
    const notificationBody = body || `La recolección actual ($${montoActual?.toLocaleString() || 0} MXN) está a un ${porcentaje || 0}% respecto al promedio semanal ($${promedioSemanal?.toLocaleString() || 0} MXN).`;

    self.registration.showNotification(notificationTitle, {
      body: notificationBody,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [300, 100, 300],
      tag: 'captacion-baja-alert',
      renotify: true,
      data: { url: '/' },
      actions: [
        { action: 'ver_cartera', title: '📊 Revisar Cartera' },
        { action: 'cerrar', title: 'Entendido' }
      ]
    });
  }
});
