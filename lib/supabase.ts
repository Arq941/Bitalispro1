import {
  supabase,
  syncLocalDataWithSupabase,
  getPendingSyncCount,
  incrementPendingSyncCount,
  resetPendingSyncCount,
  getSyncQueue,
  enqueueSyncTask,
  clearSyncQueue,
  processSyncQueue,
  setupSyncListeners,
  quickPushAbono,
  quickPushCliente,
  quickPushVenta,
  getClientes,
  getVentas,
  getAbonos,
} from '../db.js';

export {
  supabase,
  syncLocalDataWithSupabase,
  getPendingSyncCount,
  incrementPendingSyncCount,
  resetPendingSyncCount,
  getSyncQueue,
  enqueueSyncTask,
  clearSyncQueue,
  processSyncQueue,
  setupSyncListeners,
  quickPushAbono,
  quickPushCliente,
  quickPushVenta,
  getClientes,
  getVentas,
  getAbonos,
};

export default supabase;
