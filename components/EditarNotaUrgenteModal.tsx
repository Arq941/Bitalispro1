'use client';

import React, { useState, useEffect } from 'react';
import { Cliente } from '@/types';
import { X, Pin, Save, Trash2, AlertCircle, Sparkles } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

interface EditarNotaUrgenteModalProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveNota: (clienteId: number, nota: string) => void;
}

const NOTAS_RAPIDAS = [
  '🚨 Llamar por teléfono antes de acudir',
  '🕒 Cobrar solo después de las 4:00 PM',
  '🐕 Perro bravo en patio, tocar timbre fuerte',
  '💼 Cobrar en lugar de trabajo (Negocio)',
  '🔴 Prometió pago completo en próximo cobro',
  '⚡ Dejar recado con familiar autorizado',
  '📍 Cambió de domicilio temporalmente',
];

export default function EditarNotaUrgenteModal({
  cliente,
  isOpen,
  onClose,
  onSaveNota,
}: EditarNotaUrgenteModalProps) {
  const [nota, setNota] = useState<string>('');

  useEffect(() => {
    if (cliente) {
      setNota(cliente.notaUrgente || '');
    }
  }, [cliente]);

  if (!isOpen || !cliente) return null;

  const handleSave = () => {
    triggerHaptic([50, 50]);
    onSaveNota(cliente.id, nota.trim());
    onClose();
  };

  const handleClear = () => {
    triggerHaptic([30]);
    onSaveNota(cliente.id, '');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 shadow-2xl text-white space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg">
              <Pin className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">Nota Urgente Visual</h2>
              <p className="text-xs text-amber-400 font-bold truncate max-w-[220px]">{cliente.nombreCompleto}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            Esta nota se mostrará de forma destacada con un distintivo visual en la tarjeta del cliente y en el mapa de cobros.
          </p>
        </div>

        {/* Text Area */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
            Escribe el aviso urgente para cobradores:
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder="Ej: Cobrar antes del mediodía. Tocar timbre de reja negra..."
            className="w-full p-3 bg-slate-950 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 transition resize-none"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wide flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets Rápidos:
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar p-1">
            {NOTAS_RAPIDAS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setNota(preset);
                  triggerHaptic(20);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 hover:border-amber-400 hover:text-amber-300 text-left transition cursor-pointer active:scale-95"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          {cliente.notaUrgente && (
            <button
              type="button"
              onClick={handleClear}
              className="py-3 px-4 bg-red-950/70 hover:bg-red-900 text-red-300 rounded-2xl font-bold text-xs border border-red-800 flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Quitar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 min-h-[48px] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-98 border border-amber-300"
          >
            <Save className="w-4 h-4 text-slate-950" />
            <span>Guardar Nota Urgente</span>
          </button>
        </div>
      </div>
    </div>
  );
}
