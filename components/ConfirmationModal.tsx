'use client';

import React from 'react';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description?: React.ReactNode;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose?: () => void;
  onCancel?: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  message,
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isDestructive,
  isLoading = false,
  onConfirm,
  onClose,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const handleClose = onClose || onCancel || (() => {});
  const modalDescription = description || message;
  const effectiveVariant = isDestructive ? 'danger' : variant;

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-500/20 text-red-400 border-red-500/30',
      buttonBg: 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40',
      icon: Trash2,
    },
    warning: {
      iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      buttonBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40',
      icon: AlertTriangle,
    },
    info: {
      iconBg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40',
      icon: AlertCircle,
    },
  };

  const style = variantStyles[effectiveVariant] || variantStyles.danger;
  const IconComponent = style.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scaleUp relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header with Icon */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl border ${style.iconBg} shrink-0`}>
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 pr-4">
            <h3 className="text-lg font-black text-white tracking-tight">{title}</h3>
            <div className="text-xs sm:text-sm text-slate-300 leading-relaxed">{modalDescription}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2 cursor-pointer ${style.buttonBg}`}
          >
            {isLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
