'use client';

export type ClientNotification = {
  id: string;
  title?: string;
  message?: string;
  priority?: string;
  type?: string;
};

const STORAGE_KEY = 'bitalis_notified_ids_v1';
const MAX_IDS = 120;

export function notificationHref(item: ClientNotification) {
  const type = String(item.type || '').toUpperCase();
  if (['FIRST_COLLECTION_DUE', 'OVERDUE_CLIENT', 'COLLECTION_ROUTE_DUE', 'BROKEN_PROMISE', 'COLLECTION_RISK'].includes(type)) return '/route';
  if (type.includes('INVENTORY') || type.includes('PURCHASE_ORDER')) return '/inventory';
  if (type.includes('AUTHORIZATION')) return '/authorizations';
  if (type.includes('OFFLINE') || type.includes('CONFLICT')) return '/offline/conflicts';
  return '/notifications';
}

function notifiedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function remember(ids: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-MAX_IDS))); } catch {}
}

export function nativeNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported' as const;
  return Notification.permission;
}

export async function requestNativeNotificationPermission() {
  if (nativeNotificationPermission() === 'unsupported') return 'unsupported' as const;
  return Notification.requestPermission();
}

export async function showNewNativeNotifications(items: ClientNotification[]) {
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return;
  const seen = notifiedIds();
  const fresh = items.filter(item => item.id && !seen.has(item.id)).slice(0, 3);
  for (const item of fresh) {
    const priority = String(item.priority || 'INFO').toUpperCase();
    const urgent = priority === 'CRITICAL' || priority === 'HIGH';
    const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
      body: item.message || 'Tienes una tarea pendiente.',
      icon: '/bitalis-symbol.svg',
      badge: '/bitalis-symbol.svg',
      tag: `bitalis-${item.id}`,
      data: { href: notificationHref(item), notificationId: item.id },
      requireInteraction: urgent,
      renotify: false,
      vibrate: urgent ? [300, 140, 300, 140, 500] : [160, 100, 160],
    };
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) await registration.showNotification(item.title || 'Aviso BITALIS', options);
      else new Notification(item.title || 'Aviso BITALIS', options);
      seen.add(item.id);
    } catch {}
  }
  remember(seen);
}
