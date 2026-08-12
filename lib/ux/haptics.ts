export type HapticPattern = 'tap' | 'success' | 'warning' | 'error';

const patterns: Record<HapticPattern, number | number[]> = {
  tap: 12,
  success: [18, 35, 18],
  warning: [28, 45, 28],
  error: [45, 35, 45],
};

export function haptic(pattern: HapticPattern = 'tap') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(patterns[pattern]);
    }
  } catch {}
}
