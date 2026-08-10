'use client';

import { useEffect, useRef } from 'react';

export interface TouchGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
  minDistance?: number;
  maxCrossDistance?: number;
  edgeOnly?: boolean; // Only trigger swipe right if swipe started near left edge (< 40px)
  enabled?: boolean;
}

export function useTouchGestures<T extends HTMLElement = HTMLDivElement>(
  options: TouchGestureOptions
) {
  const {
    onSwipeRight,
    onSwipeLeft,
    onSwipeDown,
    onSwipeUp,
    minDistance = 60,
    maxCrossDistance = 60,
    edgeOnly = false,
    enabled = true,
  } = options;

  const elementRef = useRef<T | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const el = elementRef.current || document.body;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const start = touchStartRef.current;
      touchStartRef.current = null;

      if (e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const deltaTime = Date.now() - start.time;

      // Ignore very slow dragging (> 600ms)
      if (deltaTime > 600) return;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Horizontal swipes
      if (absX >= minDistance && absY <= maxCrossDistance) {
        if (deltaX > 0) {
          // Swipe Right
          if (!edgeOnly || start.x <= 50) {
            if (onSwipeRight) onSwipeRight();
          }
        } else {
          // Swipe Left
          if (onSwipeLeft) onSwipeLeft();
        }
      }

      // Vertical swipes
      if (absY >= minDistance && absX <= maxCrossDistance) {
        if (deltaY > 0) {
          // Swipe Down (Pull down to dismiss)
          if (start.y <= 120 && onSwipeDown) {
            onSwipeDown();
          }
        } else {
          // Swipe Up
          if (onSwipeUp) onSwipeUp();
        }
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeRight, onSwipeLeft, onSwipeDown, onSwipeUp, minDistance, maxCrossDistance, edgeOnly, enabled]);

  return elementRef;
}
