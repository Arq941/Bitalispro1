'use client';

import React, { useState, useEffect } from 'react';
import { offlineStorage, OfflineOperation } from '@/lib/offline-storage';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, Database } from 'lucide-react';

export function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingOps, setPendingOps] = useState<OfflineOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const checkOnlineAndPending = async () => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    try {
      const pending = await offlineStorage.getPending();
      setPendingOps(pending);
    } catch {
      // ignore SSR or IndexedDB unavailable
    }
  };

  useEffect(() => {
    checkOnlineAndPending();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkOnlineAndPending, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg('Sincronizando operaciones...');

    try {
      const pending = await offlineStorage.getPending();
      if (pending.length === 0) {
        setSyncStatusMsg('Todo está actualizado');
        setTimeout(() => setSyncStatusMsg(null), 3000);
        setIsSyncing(false);
        return;
      }

      const deviceId = localStorage.getItem('deviceId') || 'PWA-DEVICE-01';
      const userId = localStorage.getItem('userId') || 'COBRADOR-01';

      const response = await fetch('/api/offline/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          deviceId,
          userId,
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
        setSyncStatusMsg(`Sincronización exitosa (${data.syncedCount || pending.length})`);
      } else {
        setSyncStatusMsg(`Sincronización parcial/con conflictos (${data.conflictCount || 0} conflictos)`);
      }
      await checkOnlineAndPending();
    } catch (error: any) {
      setSyncStatusMsg('Error de red al sincronizar');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur shadow-md">
      {/* Network Badge */}
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
        {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
      </div>

      {/* Queue Count */}
      {pendingOps.length > 0 && (
        <div className="flex items-center gap-1 bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
          <Database className="w-3.5 h-3.5" />
          <span>{pendingOps.length} pendientes</span>
        </div>
      )}

      {/* Sync Status Message */}
      {syncStatusMsg && <span className="text-slate-300 hidden sm:inline text-[11px]">{syncStatusMsg}</span>}

      {/* Manual Sync Button */}
      <button
        onClick={triggerSync}
        disabled={isSyncing || !isOnline}
        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-2.5 py-1 rounded-full transition-all text-xs active:scale-95 ml-1"
        title="Sincronizar ahora"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>Sincronizar</span>
      </button>
    </div>
  );
}
