'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X, Bell } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  roleTarget?: string;
  duration?: number;
}

interface ToastNotificationProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export default function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  useEffect(() => {
    if (toast) {
      triggerHaptic([30, 50, 30]);
      const timer = setTimeout(() => {
        onClose();
      }, toast.duration || 4500);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  let bgClasses = 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200';
  let Icon = CheckCircle2;
  let iconColor = 'text-emerald-400';

  if (toast.type === 'info') {
    bgClasses = 'bg-indigo-950/95 border-indigo-500/80 text-indigo-200';
    Icon = Info;
    iconColor = 'text-indigo-400';
  } else if (toast.type === 'warning') {
    bgClasses = 'bg-amber-950/95 border-amber-500/80 text-amber-200';
    Icon = AlertTriangle;
    iconColor = 'text-amber-400';
  } else if (toast.type === 'error') {
    bgClasses = 'bg-rose-950/95 border-rose-500/80 text-rose-200';
    Icon = XCircle;
    iconColor = 'text-rose-400';
  }

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-70 animate-in slide-in-from-top-5 duration-300 pointer-events-auto">
      <div className={`p-4 rounded-2xl border-2 shadow-2xl backdrop-blur-md flex items-start gap-3 ${bgClasses}`}>
        <div className={`p-2 rounded-xl bg-slate-900/60 shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          {toast.roleTarget && (
            <span className="text-[10px] uppercase font-mono font-extrabold tracking-wider bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-700 block w-fit mb-1">
              🔔 Notificación Rol: {toast.roleTarget}
            </span>
          )}
          <h4 className="text-xs sm:text-sm font-extrabold text-white leading-snug">
            {toast.title}
          </h4>
          <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
            {toast.message}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-900/60 rounded-lg text-slate-300 hover:text-white transition cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
