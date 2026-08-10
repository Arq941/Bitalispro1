'use client';

import React from 'react';
import { ShieldCheck, Lock, Database, Key, CheckCircle2, UserCheck, X, Server, Eye } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

interface SupabaseSecurityModalProps {
  isOpen?: boolean;
  userRole?: string;
  onClose: () => void;
}

export default function SupabaseSecurityModal({
  isOpen = true,
  userRole = 'General',
  onClose,
}: SupabaseSecurityModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 text-left relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Arquitectura de Seguridad Supabase RLS</h3>
              <p className="text-xs text-slate-400">Políticas Row Level Security & Encriptación de Datos BITALIS</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onClose();
            }}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-900/50 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>Row Level Security (RLS)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Las tablas <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">clientes</code>, <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">ventas</code> y <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">abonos</code> imponen políticas RLS automáticas vinculadas al ID de Zona asignada a cada vendedora y cobrador.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-900/50 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Database className="w-4 h-4" />
              <span>Aislamiento por Zona</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Incapacidad técnica de consulta de expedientes fuera de ruta. Ningún usuario puede descargar contratos ni fotos fuera de su zona geográfica asignada.
            </p>
          </div>
        </div>

        {/* RLS SQL Code Sample Box */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-400" />
            <span>Políticas de Seguridad Activas en PostgreSQL / Supabase:</span>
          </h4>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-[11px] font-mono text-indigo-200/90 leading-relaxed overflow-x-auto space-y-2">
            <div>
              <span className="text-purple-400 font-bold">CREATE POLICY</span> &quot;vendedora_zona_isolation&quot; <span className="text-purple-400">ON</span> clientes<br />
              &nbsp;&nbsp;<span className="text-indigo-400">FOR SELECT USING</span> (<br />
              &nbsp;&nbsp;&nbsp;&nbsp;zona_id = (SELECT zona_id FROM usuarios WHERE auth_uid = auth.uid())<br />
              &nbsp;&nbsp;&nbsp;&nbsp;OR auth.jwt() -&gt;&gt; &apos;role&apos; IN (&apos;admin&apos;, &apos;sup_vendedores&apos;)<br />
              &nbsp;&nbsp;);
            </div>
            <div className="pt-2 border-t border-slate-900">
              <span className="text-purple-400 font-bold">CREATE POLICY</span> &quot;cobrador_abonos_insert&quot; <span className="text-purple-400">ON</span> abonos<br />
              &nbsp;&nbsp;<span className="text-indigo-400">FOR INSERT WITH CHECK</span> (<br />
              &nbsp;&nbsp;&nbsp;&nbsp;cobrador_id = auth.uid()<br />
              &nbsp;&nbsp;);
            </div>
          </div>
        </div>

        {/* Key takeaways list */}
        <div className="space-y-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <h4 className="text-xs font-bold text-slate-200">Garantías de Protección en Trabajo de Campo:</h4>
          <ul className="text-xs text-slate-300 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Bloqueo por Inactividad (5 Min):</strong> Cierre de pantalla por PIN si el dispositivo de campo queda desatendido.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Cifrado de Fotografías e INE:</strong> Las imágenes subidas vía OCR se procesan con tokens temporales no públicos.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Logs de Auditoría Inmutables:</strong> Cada abono o modificación genera un registro no editable con timestamp y coordenadas GPS.</span>
            </li>
          </ul>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              onClose();
            }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
