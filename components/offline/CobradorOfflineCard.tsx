'use client';

import React, { useState, useEffect } from 'react';
import { offlineStorage, OfflineOperation } from '@/lib/offline-storage';
import { Database, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

export function CobradorOfflineCard() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingOps, setPendingOps] = useState<OfflineOperation[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadData = async () => {
    setIsOnline(navigator.onLine);
    try {
      const pending = await offlineStorage.getPending();
      setPendingOps(pending);
      const lastSync = localStorage.getItem('lastServerSyncAt');
      if (lastSync) setLastSyncTime(new Date(lastSync).toLocaleTimeString());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('online', loadData);
    window.addEventListener('offline', loadData);
    return () => {
      window.removeEventListener('online', loadData);
      window.removeEventListener('offline', loadData);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const pending = await offlineStorage.getPending();
      if (pending.length === 0) {
        setIsSyncing(false);
        return;
      }

      const response = await fetch('/api/offline/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || 'COBRADOR-01',
        },
        body: JSON.stringify({
          deviceId: localStorage.getItem('deviceId') || 'PWA-DEVICE-01',
          operations: pending.map((p) => ({
            idempotencyKey: p.idempotencyKey,
            operationType: p.operationType,
            payload: p.payload,
            clientCapturedAt: p.clientCapturedAt,
            deviceId: p.deviceId,
            userId: p.userId,
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        for (const item of pending) {
          await offlineStorage.markSynced(item.id);
        }
        await offlineStorage.clearSynced();
        const nowStr = new Date().toISOString();
        localStorage.setItem('lastServerSyncAt', nowStr);
        setLastSyncTime(new Date(nowStr).toLocaleTimeString());
      }
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              Modo Offline-First PWA
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </h3>
            <p className="text-xs text-slate-400">
              {isOnline ? 'Conexión activa — Listo para sincronizar' : 'Trabajando sin conexión localmente'}
            </p>
          </div>
        </div>

        <button
          onClick={handleManualSync}
          disabled={isSyncing || !isOnline || pendingOps.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
          <span className="text-xs text-slate-400 block mb-1">Operaciones en Cola</span>
          <span className="text-lg font-bold text-indigo-400 flex items-center gap-1.5">
            <Database className="w-4 h-4" />
            {pendingOps.length}
          </span>
        </div>

        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
          <span className="text-xs text-slate-400 block mb-1">Última Sincronización</span>
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mt-1">
            <Clock className="w-4 h-4 text-slate-400" />
            {lastSyncTime || 'No registrada'}
          </span>
        </div>

        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-400 block mb-1">Garantía Anti-Duplicados</span>
          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Idempotencia Activa
          </span>
        </div>
      </div>

      {pendingOps.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 mb-2">Operaciones pendientes por enviar:</h4>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {pendingOps.slice(0, 5).map((op) => (
              <div key={op.id} className="flex items-center justify-between text-xs bg-slate-800/40 p-2 rounded-lg border border-slate-700/30">
                <span className="font-mono text-indigo-300 font-semibold">{op.operationType}</span>
                <span className="text-slate-400 text-[11px]">{new Date(op.clientCapturedAt).toLocaleTimeString()}</span>
                <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px] font-medium">{op.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
