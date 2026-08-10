'use client';

import React, { useState } from 'react';
import { PushNotificationRule, UserRole } from '@/types';
import {
  Bell,
  X,
  Save,
  Send,
  ShieldAlert,
  Users,
  Smartphone,
  CheckCircle2,
  Sliders,
  Sparkles
} from 'lucide-react';
import { sendAdvancedPushNotification, requestNotificationPermission } from '@/lib/serviceWorkerManager';

interface PushNotificationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerTestPush?: (rule: PushNotificationRule) => void;
}

const DEFAULT_PUSH_RULES: PushNotificationRule[] = [
  {
    id: 'push-admin',
    role: 'admin',
    roleName: '1. Nivel Administrador General',
    titulo: '🚨 ALERTA GLOBAL BITALIS',
    mensajePlantilla: 'Arqueo diario completado. Recaudación total acumulada de $12,450 MXN con 0 incidencias.',
    activa: true,
    prioridad: 'ALTA',
    icono: 'ShieldAlert',
  },
  {
    id: 'push-sup-vendedores',
    role: 'sup_vendedores',
    roleName: '2. Nivel Supervisora de Ventas',
    titulo: '📈 SOLICITUD DE ALTA RECIBIDA',
    mensajePlantilla: 'La vendedora Ana Lucía envió el expediente de Rosa María Hernández para validación de crédito.',
    activa: true,
    prioridad: 'ALTA',
    icono: 'Users',
  },
  {
    id: 'push-sup-cobradores',
    role: 'sup_cobradores',
    roleName: '3. Nivel Supervisor de Cobranza',
    titulo: '💰 CORTE DE RUTA Y MOROSIDAD',
    mensajePlantilla: 'El cobrador Juan Pérez completó el 85% de su ruta en Zona Lunes. Descuadre $0 MXN.',
    activa: true,
    prioridad: 'MEDIA',
    icono: 'Sliders',
  },
  {
    id: 'push-vendedora',
    role: 'vendedora',
    roleName: '4. Nivel Vendedora de Campo',
    titulo: '✅ EXPEDIENTE APROBADO',
    mensajePlantilla: 'Tu solicitud de venta #CLI-2026-981 fue APROBADA por la supervisora. Comisión agregada +$40 MXN.',
    activa: true,
    prioridad: 'MEDIA',
    icono: 'Smartphone',
  },
  {
    id: 'push-cobrador',
    role: 'cobrador',
    roleName: '5. Nivel Cobrador de Ruta',
    titulo: '📍 ASIGNACIÓN DE SECTOR DEL DÍA',
    mensajePlantilla: 'Tu ruta para hoy en Colonia Centro tiene 18 cobros agendados. ¡Éxito en el recorrido!',
    activa: true,
    prioridad: 'ALTA',
    icono: 'Send',
  },
];

export default function PushNotificationManagerModal({
  isOpen,
  onClose,
  onTriggerTestPush,
}: PushNotificationManagerModalProps) {
  const [rules, setRules] = useState<PushNotificationRule[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bitalis_push_rules');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return DEFAULT_PUSH_RULES;
  });

  if (!isOpen) return null;

  const handleUpdateRule = (id: string, field: keyof PushNotificationRule, value: any) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleTestRule = async (rule: PushNotificationRule) => {
    await requestNotificationPermission();
    await sendAdvancedPushNotification({
      title: rule.titulo,
      body: rule.mensajePlantilla,
      priority: rule.prioridad,
      role: rule.role,
      soundType: rule.prioridad === 'ALTA' ? 'alert' : 'success',
      vibrate: rule.prioridad === 'ALTA' ? [300, 100, 300, 100, 300] : [200, 100, 200]
    });
    if (onTriggerTestPush) {
      onTriggerTestPush(rule);
    }
  };

  const handleSaveAll = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bitalis_push_rules', JSON.stringify(rules));
      localStorage.setItem('bitalis_push_enabled', 'true');
    }
    alert('¡Configuración de Notificaciones Push Jerárquicas guardada y activada con éxito!');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-60 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full my-auto shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/50 rounded-2xl text-indigo-400">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Gestión de Notificaciones Push Jerárquicas</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">
                Ajusta las plantillas, prioridades y disparadores automáticos por Rol de Usuario.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* RULES LIST (SCROLLABLE) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-2xl border transition space-y-3 ${
                rule.activa
                  ? 'bg-slate-950 border-slate-700/90 shadow-lg'
                  : 'bg-slate-950/50 border-slate-850 opacity-60'
              }`}
            >
              {/* Top Row: Role Title & Active Switch */}
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-indigo-300">{rule.roleName}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                      rule.prioridad === 'ALTA'
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : rule.prioridad === 'MEDIA'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Prioridad: {rule.prioridad}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.activa}
                      onChange={(e) => handleUpdateRule(rule.id, 'activa', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <span className="text-xs font-bold text-slate-300">
                    {rule.activa ? 'Activa' : 'Pausada'}
                  </span>
                </div>
              </div>

              {/* Title Input & Priority Select */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Título de la Alerta Push:</label>
                  <input
                    type="text"
                    value={rule.titulo}
                    onChange={(e) => handleUpdateRule(rule.id, 'titulo', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Prioridad:</label>
                  <select
                    value={rule.prioridad}
                    onChange={(e) => handleUpdateRule(rule.id, 'prioridad', e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALTA">🔴 ALTA (Urgente)</option>
                    <option value="MEDIA">🟡 MEDIA (Normal)</option>
                    <option value="BAJA">🔵 BAJA (Informativa)</option>
                  </select>
                </div>
              </div>

              {/* Message Template Textarea */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-xs">
                  Plantilla de Mensaje (Editable por Rol):
                </label>
                <textarea
                  rows={2}
                  value={rule.mensajePlantilla}
                  onChange={(e) => handleUpdateRule(rule.id, 'mensajePlantilla', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Test Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleTestRule(rule)}
                  className="px-3.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-400" />
                  <span>⚡ Probar Disparo Push ({rule.role})</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Los avisos jerárquicos notifican automáticamente según las acciones realizadas en campo.
          </span>
          <button
            onClick={handleSaveAll}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Configuración</span>
          </button>
        </div>

      </div>
    </div>
  );
}
