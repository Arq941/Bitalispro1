'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert, RefreshCw, Eye, Check, X, Info } from 'lucide-react';

export function SupervisorConflictsDashboard() {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedConflict, setSelectedConflict] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('PENDING');

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/offline/conflicts?status=${statusFilter}`);
      const data = await res.json();
      if (data.success) {
        setConflicts(data.conflicts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, [statusFilter]);

  const handleResolve = async (resolution: 'FORCE_SYNC' | 'REJECT' | 'REVIEW') => {
    if (!selectedConflict) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/offline/conflicts/${selectedConflict.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || 'SUPERVISORA-01',
        },
        body: JSON.stringify({
          resolution,
          notes: resolutionNotes || `Conflicto resuelto como ${resolution} por supervisión`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedConflict(null);
        setResolutionNotes('');
        await fetchConflicts();
      } else {
        alert(data.error || 'Error al resolver conflicto');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Panel de Conflictos de Sincronización</h2>
            <p className="text-xs text-slate-400">Supervisión e Inmutabilidad Financiera (Fase 9)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === 'PENDING' ? 'bg-amber-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('RESOLVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === 'RESOLVED' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Resueltos
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === 'ALL' ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Todos
          </button>
          <button
            onClick={fetchConflicts}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* List / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando conflictos de sincronización...</div>
        ) : conflicts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
            <span>Sin conflictos pendientes en este momento. La integridad operativa está al 100%.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-700/60">
                <tr>
                  <th className="px-4 py-3">Tipo / Severidad</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Dispositivo / Captura</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {conflicts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.severity === 'HIGH' || c.severity === 'CRITICAL' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                        <span className="font-mono text-indigo-300">{c.conflictType}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">{c.severity}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-slate-300">{c.description || 'Sin descripción'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {c.clientCapturedAt ? new Date(c.clientCapturedAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      {c.resolvedAt ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                          Resuelto ({c.resolution})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedConflict(c)}
                        className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-all"
                      >
                        Revisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal / Resolution Dialog */}
      {selectedConflict && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Detalle del Conflicto de Sincronización
              </h3>
              <button onClick={() => setSelectedConflict(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <div>
                <span className="text-slate-400 block">Tipo Conflicto:</span>
                <span className="font-mono font-bold text-indigo-300">{selectedConflict.conflictType}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Severidad:</span>
                <span className="font-bold text-amber-400">{selectedConflict.severity}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Descripción:</span>
                <span className="text-slate-200">{selectedConflict.description}</span>
              </div>
            </div>

            {/* Original Payload vs Server State */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Payload Original (Captura Dispositivo):</span>
              <pre className="bg-slate-950 p-3 rounded-xl text-[11px] font-mono text-emerald-400 max-h-32 overflow-y-auto border border-slate-800">
                {selectedConflict.originalPayload || '{}'}
              </pre>
            </div>

            {/* Notes Input */}
            {!selectedConflict.resolvedAt && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Notas de Resolución Supervisora:</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Ej. Se verificó el comprobante físico en ruta. Se autoriza sincronización forzada."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  rows={3}
                />
              </div>
            )}

            {/* Actions */}
            {!selectedConflict.resolvedAt ? (
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => handleResolve('REJECT')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Rechazar (REJECT)
                </button>
                <button
                  onClick={() => handleResolve('FORCE_SYNC')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Forzar Sincronización (FORCE_SYNC)
                </button>
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Resuelto como {selectedConflict.resolution} el {new Date(selectedConflict.resolvedAt).toLocaleString()} por {selectedConflict.resolvedBy}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
