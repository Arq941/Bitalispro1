// Gestor de Service Worker y Notificaciones Push Avanzadas para Sistema BITALIS
import { Abono, Venta } from '@/types';

let swRegistration: ServiceWorkerRegistration | null = null;
let lastNotificationTime = 0;

export interface AdvancedPushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  priority?: 'ALTA' | 'MEDIA' | 'BAJA' | 'NORMAL';
  role?: string;
  url?: string;
  vibrate?: number[];
  actions?: Array<{ action: string; title: string }>;
  soundType?: 'alert' | 'success' | 'warning';
}

/**
 * Genera un sonido/chime sintético de alta potencia y volumen intensificado mediante Web Audio API para alertas push.
 */
export function playNotificationChime(type: 'alert' | 'success' | 'warning' = 'alert') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (type === 'success') {
      // Arpegio de alta claridad y potencia para confirmación
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.35);
      });
    } else if (type === 'warning') {
      // Tono de advertencia doble penetrante
      const bursts = [
        { freq1: 440, freq2: 880, time: 0 },
        { freq1: 392, freq2: 784, time: 0.15 }
      ];
      bursts.forEach(({ freq1, freq2, time }) => {
        [freq1, freq2].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
          gain.gain.setValueAtTime(0.4, ctx.currentTime + time);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + time);
          osc.stop(ctx.currentTime + time + 0.25);
        });
      });
    } else {
      // ALERTA URGENTE INTENSIFICADA BITALIS (Sirena doble ráfaga multi-armónica de alto volumen)
      const pulses = [
        { start: 0, f1: 659.25, f2: 1318.5 },   // E5 + E6
        { start: 0.14, f1: 880.00, f2: 1760.0 }, // A5 + A6
        { start: 0.28, f1: 1046.50, f2: 2093.0 } // C6 + C7
      ];

      pulses.forEach(({ start, f1, f2 }) => {
        // Oscilador Principal (Triángulo penetrante)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(f1, ctx.currentTime + start);
        osc1.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + start + 0.12);
        gain1.gain.setValueAtTime(0.75, ctx.currentTime + start);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.22);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime + start);
        osc1.stop(ctx.currentTime + start + 0.22);

        // Oscilador Secundario (Armónico de alta frecuencia para altavoz de celular)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(f2, ctx.currentTime + start);
        gain2.gain.setValueAtTime(0.4, ctx.currentTime + start);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.2);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + start);
        osc2.stop(ctx.currentTime + start + 0.2);
      });
    }
  } catch (err) {
    console.warn('[SW Manager] AudioContext no iniciado o bloqueado por navegador:', err);
  }
}

/**
 * Registra el Service Worker en el navegador.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SW Manager] Service Worker no es soportado en este entorno.');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[SW Manager] Service Worker registrado exitosamente con scope:', reg.scope);
    swRegistration = reg;
    return reg;
  } catch (error) {
    console.error('[SW Manager] Error al registrar Service Worker:', error);
    return null;
  }
}

/**
 * Solicita permiso de notificaciones push al usuario.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[SW Manager] El navegador no soporta notificaciones.');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('[SW Manager] Estado de permiso de notificaciones:', permission);
    
    if (permission === 'granted') {
      await registerServiceWorker();
    }
    return permission;
  } catch (err) {
    console.error('[SW Manager] Error al solicitar permiso de notificaciones:', err);
    return 'denied';
  }
}

/**
 * Habilita las notificaciones por defecto para todos los usuarios y solicita permisos automáticamente.
 */
export async function ensureDefaultPushEnabled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem('bitalis_push_enabled', 'true');

    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          await registerServiceWorker();
          return true;
        }
      } else if (Notification.permission === 'granted') {
        await registerServiceWorker();
        return true;
      }
    }
  } catch (e) {
    console.warn('[SW Manager] Error al inicializar notificaciones por defecto:', e);
  }

  return false;
}

/**
 * Envía una Notificación Push Avanzada completa con sonido, vibración, badges y acciones nativas.
 */
export async function sendAdvancedPushNotification(options: AdvancedPushNotificationOptions): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Intentar sonido sintético y vibración háptica
  playNotificationChime(options.soundType || 'alert');
  if (navigator.vibrate) {
    navigator.vibrate(options.vibrate || [200, 100, 200, 100, 200]);
  }

  if (!('Notification' in window)) {
    console.warn('[SW Manager] El navegador no soporta Notificaciones nativas.');
    return false;
  }

  // Si aún está en estado 'default', solicitar permiso automáticamente
  let currentPermission = Notification.permission;
  if (currentPermission === 'default') {
    currentPermission = await requestNotificationPermission();
  }

  if (currentPermission !== 'granted') {
    console.warn('[SW Manager] Permiso de notificaciones denegado o no concedido.');
    return false;
  }

  const iconUrl = options.icon || '/bitalis-symbol.svg';
  const badgeUrl = options.badge || '/bitalis-symbol.svg';
  const tag = options.tag || `bitalis-push-${Date.now()}`;
  const defaultActions = options.actions || [
    { action: 'ver_detalle', title: '👁️ Ver Detalle' },
    { action: 'descartar', title: '✕ Descartar' }
  ];

  // 1. Intentar envío vía Service Worker
  try {
    let reg = swRegistration;
    if (!reg && 'serviceWorker' in navigator) {
      reg = await navigator.serviceWorker.ready;
    }

    if (reg && reg.showNotification) {
      await reg.showNotification(options.title, {
        body: options.body,
        icon: iconUrl,
        badge: badgeUrl,
        tag: tag,
        renotify: true,
        vibrate: options.vibrate || [200, 100, 200, 100, 200],
        data: { url: options.url || '/', role: options.role || 'all' },
        actions: defaultActions,
      } as any);
      console.log('[SW Manager] Notificación avanzada lanzada con éxito vía Service Worker.');
      return true;
    }
  } catch (swErr) {
    console.warn('[SW Manager] Falló el Service Worker para la notificación, usando fallback nativo:', swErr);
  }

  // 2. Fallback mediante instancia nativa de Notification
  try {
    const nativeNotif = new Notification(options.title, {
      body: options.body,
      icon: iconUrl,
      tag: tag,
    });
    nativeNotif.onclick = () => {
      window.focus();
      nativeNotif.close();
    };
    console.log('[SW Manager] Notificación lanzada con éxito vía instancia nativa.');
    return true;
  } catch (nativeErr) {
    console.error('[SW Manager] Error crítico al lanzar notificación:', nativeErr);
    return false;
  }
}

/**
 * Evalúa si la captación de efectivo actual está por debajo del promedio semanal
 * y dispara una notificación Push mediante el Service Worker si corresponde.
 */
export async function checkCaptacionEfectivoAndNotify(
  abonos: Abono[],
  ventas: Venta[],
  forceNotify = false
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Captación de efectivo de hoy (Suma de abonos recibidos hoy)
  const abonosHoy = abonos.filter((a) => (a.fechaPago || '').split('T')[0] === todayStr);
  const montoAbonosHoy = abonosHoy.reduce((sum, a) => sum + (a.monto || 0), 0);

  // 2. Promedio Semanal Histórico (Últimos 28 días)
  const past28DaysAgo = new Date();
  past28DaysAgo.setDate(past28DaysAgo.getDate() - 28);
  const past28Str = past28DaysAgo.toISOString().split('T')[0];

  const abonosPast28 = abonos.filter((a) => (a.fechaPago || '').split('T')[0] >= past28Str);
  const totalMonto28 = abonosPast28.reduce((sum, a) => sum + (a.monto || 0), 0);
  
  const promedioSemanal = Math.round(totalMonto28 / 4) || 1000;
  const promedioDiarioProyectado = Math.round(promedioSemanal / 7) || 200;

  // 3. Evaluar si la captación está por debajo del promedio proyectado
  const estaPorDebajo = montoAbonosHoy < promedioDiarioProyectado;
  const porcentaje = promedioDiarioProyectado > 0 
    ? Math.round((montoAbonosHoy / promedioDiarioProyectado) * 100) 
    : 0;

  const now = Date.now();
  // Evitar notificaciones duplicadas en menos de 10 minutos a menos que sea forzado
  const COOLDOWN_MS = 10 * 60 * 1000;

  if ((estaPorDebajo && now - lastNotificationTime > COOLDOWN_MS) || forceNotify) {
    lastNotificationTime = now;

    const title = '⚠️ ALERTA: Captación de Efectivo Baja';
    const body = `La recolección de hoy ($${montoAbonosHoy.toLocaleString()} MXN) está a un ${porcentaje}% respecto al promedio diario esperado ($${promedioDiarioProyectado.toLocaleString()} MXN) del total semanal ($${promedioSemanal.toLocaleString()} MXN).`;

    await sendAdvancedPushNotification({
      title,
      body,
      tag: 'alerta-captacion-baja',
      priority: 'ALTA',
      soundType: 'alert',
    });
  }
}

