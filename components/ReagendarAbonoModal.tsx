'use client';

import React, { useState } from 'react';
import { Calendar, Clock, DollarSign, X, CheckCircle2, Sparkles, AlertCircle, TrendingDown } from 'lucide-react';
import { Cliente, Venta } from '@/types';
import { triggerHaptic } from '@/lib/utils';

interface ReagendarAbonoModalProps {
  cliente: Cliente | null;
  venta?: Venta;
  isOpen?: boolean;
  onClose: () => void;
  onConfirmReagendar?: (
    cliente: Cliente,
    nuevaFecha: string,
    notaExplicativa: string,
    montoPrometido: number
  ) => void;
  onConfirm?: (
    cliente: Cliente,
    nuevaFecha: string,
    notaExplicativa: string,
    montoPrometido: number
  ) => void;
}

export default function ReagendarAbonoModal({
  cliente,
  venta,
  isOpen = true,
  onClose,
  onConfirmReagendar,
  onConfirm,
}: ReagendarAbonoModalProps) {
  const [todayStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [nuevaFecha, setNuevaFecha] = useState<string>(() => {
    return new Date(Date.now() + 86400000).toISOString().split('T')[0];
  });
  const [notaExplicativa, setNotaExplicativa] = useState<string>('');
  
  const callback = onConfirmReagendar || onConfirm;
  const pagoSemanalHabitual = venta?.pagoSemanal || 100;
  const saldoActual = venta?.saldoActual || 0;
  const [montoPrometido, setMontoPrometido] = useState<number>(pagoSemanalHabitual);

  if (!isOpen || !cliente) return null;

  const esExcedente = montoPrometido > pagoSemanalHabitual;
  const montoExcedente = Math.max(0, montoPrometido - pagoSemanalHabitual);
  const saldoProyectado = Math.max(0, saldoActual - montoPrometido);
  const ahorroTotalAbonado = Math.min(saldoActual, montoPrometido);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaFecha) {
      alert('Por favor selecciona una fecha futura válida.');
      return;
    }
    if (!notaExplicativa.trim()) {
      alert('Por favor incluye una nota explicativa para el reagendamiento.');
      return;
    }

    triggerHaptic([40, 60, 40]);
    if (callback) {
      callback(cliente, nuevaFecha, notaExplicativa, montoPrometido);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/80 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl text-white space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Reagendar Abono & Visita</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {cliente.folio}
                </span>
              </div>
              <p className="text-xs text-amber-200/90 font-medium">
                {cliente.nombreCompleto} • {cliente.colonia || cliente.direccion}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Account Summary */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">Saldo Total Actual:</span>
            <span className="font-black text-emerald-400 text-sm font-mono">${saldoActual.toLocaleString('es-MX')} MXN</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Pago Semanal Habitual:</span>
            <span className="font-bold text-slate-200 text-xs font-mono">${pagoSemanalHabitual.toLocaleString('es-MX')} MXN/sem</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nueva Fecha Futura */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Seleccionar Fecha Futura de Cobro *</span>
            </label>
            <input
              type="date"
              required
              min={todayStr}
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Monto Prometido */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Monto Prometido a Abonar ($ MXN)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={montoPrometido}
                onChange={(e) => setMontoPrometido(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setMontoPrometido(pagoSemanalHabitual * 2)}
                className="px-3 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer"
              >
                Doble (${pagoSemanalHabitual * 2})
              </button>
            </div>
          </div>

          {/* IMPACTO PROYECTADO EN SALDO TOTAL */}
          <div className={`p-4 rounded-xl border space-y-2 text-xs transition ${
            esExcedente
              ? 'bg-gradient-to-br from-indigo-950/90 to-purple-950/90 border-indigo-500/80 shadow-lg'
              : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-extrabold text-white flex items-center gap-1.5">
                <TrendingDown className={`w-4 h-4 ${esExcedente ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span>Impacto Proyectado en Saldo Total</span>
              </span>
              {esExcedente && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-1 shadow">
                  <Sparkles className="w-3 h-3" />
                  <span>+${montoExcedente} MXN Excedente</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Saldo Actual</span>
                <span className="font-bold text-slate-300 text-xs">${saldoActual.toLocaleString('es-MX')}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Abono Prometido</span>
                <span className="font-bold text-emerald-400 text-xs">-${montoPrometido.toLocaleString('es-MX')}</span>
              </div>
              <div className="bg-indigo-900/60 p-2 rounded-lg border border-indigo-700">
                <span className="text-[10px] text-indigo-300 block font-sans">Saldo Proyectado</span>
                <span className="font-black text-amber-300 text-xs">${saldoProyectado.toLocaleString('es-MX')}</span>
              </div>
            </div>

            {esExcedente && (
              <p className="text-[11px] text-indigo-200 bg-indigo-950/80 p-2 rounded-lg border border-indigo-800/60 mt-2">
                ✨ <strong>Abono Mayor a la Cuota:</strong> Al abonar <strong>${montoPrometido} MXN</strong> (${montoExcedente} MXN por encima del pago semanal), los <strong>${montoExcedente} MXN adicionales amortizan directamente el saldo capital</strong>, acelerando la liquidación total de la deuda.
              </p>
            )}
          </div>

          {/* Nota Explicativa */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Nota Explicativa del Reagendamiento (Requerido) *</span>
            </label>
            <textarea
              required
              rows={3}
              value={notaExplicativa}
              onChange={(e) => setNotaExplicativa(e.target.value)}
              placeholder="ej. El cliente solicitó pasar el viernes a las 5:00 PM por cobro de nómina. Promete dar abono doble de $300 MXN."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>Confirmar Reagendación</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
