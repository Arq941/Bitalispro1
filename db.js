import { createClient } from '@supabase/supabase-js';
import localforage from 'localforage';

// 1. Configuración del cliente Supabase dinámico
export function getSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    try {
      const savedUrl = localStorage.getItem('pwa_supabase_url');
      const savedKey = localStorage.getItem('pwa_supabase_anon_key');
      if (savedUrl && savedKey && !savedUrl.includes('your-supabase-project.supabase.co')) {
        return { url: savedUrl.trim(), key: savedKey.trim(), isCustom: true };
      }
    } catch (e) {
      console.warn('Error al leer credenciales de localStorage:', e);
    }
  }

  const envUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://eydeglqyvyqsiwuyegqn.supabase.co';

  const envKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5ZGVnbHF5dnlxc2l3dXllZ3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTEzMDcsImV4cCI6MjEwMDc2NzMwN30.avAd9N9chEGX2R7-cP8oY8o54gcT03R-TGxfQM7Jb-M';

  return { url: envUrl, key: envKey, isCustom: false };
}

let activeCreds = getSupabaseCredentials();
export let supabase = createClient(activeCreds.url, activeCreds.key);

export function saveSupabaseCredentials(url, key) {
  if (typeof window !== 'undefined') {
    if (url && key) {
      localStorage.setItem('pwa_supabase_url', url.trim());
      localStorage.setItem('pwa_supabase_anon_key', key.trim());
    } else {
      localStorage.removeItem('pwa_supabase_url');
      localStorage.removeItem('pwa_supabase_anon_key');
    }
  }
  activeCreds = getSupabaseCredentials();
  supabase = createClient(activeCreds.url, activeCreds.key);
  return activeCreds;
}

// 2. Control de Conteo de Cambios Pendientes y Cola de Sincronización (localforage)
export async function getPendingSyncCount() {
  if (typeof window === 'undefined') return 0;
  try {
    const queue = await getSyncQueue();
    if (queue.length > 0) {
      return queue.length;
    }
    const count = await localforage.getItem('pwa_pending_sync');
    return typeof count === 'number' ? count : 0;
  } catch (err) {
    console.error('Error al obtener pendingSyncCount de localforage:', err);
    return 0;
  }
}

export async function incrementPendingSyncCount(amount = 1) {
  if (typeof window === 'undefined') return 0;
  try {
    const current = await getPendingSyncCount();
    const next = current + amount;
    await localforage.setItem('pwa_pending_sync', next);
    return next;
  } catch (err) {
    console.error('Error al incrementar pendingSyncCount:', err);
    return 0;
  }
}

export async function resetPendingSyncCount() {
  if (typeof window === 'undefined') return 0;
  try {
    await localforage.setItem('pwa_pending_sync', 0);
    await localforage.setItem('pwa_sync_queue', []);
    return 0;
  } catch (err) {
    console.error('Error al reiniciar pendingSyncCount:', err);
    return 0;
  }
}

// COLA DE SINCRONIZACIÓN PERSISTENTE (localforage)
let isProcessingQueue = false;

export async function getSyncQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const queue = await localforage.getItem('pwa_sync_queue');
    return Array.isArray(queue) ? queue : [];
  } catch (err) {
    console.error('Error al obtener la cola de sincronización desde localforage:', err);
    return [];
  }
}

export async function enqueueSyncTask(type, table, records, errorMsg = '') {
  if (typeof window === 'undefined') return [];
  try {
    const queue = await getSyncQueue();
    const newTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type, // 'UPSERT' | 'DELETE'
      table, // 'clientes' | 'ventas' | 'abonos' | 'productos' | 'zonas'
      records: Array.isArray(records) ? records : [records],
      timestamp: new Date().toISOString(),
      attempts: 0,
      lastError: errorMsg || null,
      status: 'PENDING'
    };

    const updatedQueue = [...queue, newTask];
    await localforage.setItem('pwa_sync_queue', updatedQueue);
    await localforage.setItem('pwa_pending_sync', updatedQueue.length);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pwa-queue-updated', {
          detail: { queue: updatedQueue, count: updatedQueue.length }
        })
      );
    }

    // Auto-reintento si hay red disponible
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => processSyncQueue(), 300);
    }

    return updatedQueue;
  } catch (err) {
    console.error('Error al encolar tarea de sincronización:', err);
    return [];
  }
}

export async function clearSyncQueue() {
  if (typeof window === 'undefined') return;
  try {
    await localforage.setItem('pwa_sync_queue', []);
    await localforage.setItem('pwa_pending_sync', 0);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pwa-queue-updated', { detail: { queue: [], count: 0 } })
      );
    }
  } catch (err) {
    console.error('Error al limpiar la cola de sincronización:', err);
  }
}

export async function processSyncQueue() {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'SSR' };
  }
  if (!navigator.onLine) {
    console.log('🌐 Dispositivo Offline: La cola se procesará automáticamente al detectar conexión.');
    const queue = await getSyncQueue();
    return { success: false, offline: true, remainingCount: queue.length };
  }
  if (isProcessingQueue) {
    const queue = await getSyncQueue();
    return { success: true, busy: true, remainingCount: queue.length };
  }

  isProcessingQueue = true;
  console.log('⚡ Procesando cola de sincronización localforage -> Supabase...');

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      await localforage.setItem('pwa_pending_sync', 0);
      isProcessingQueue = false;
      return { success: true, processedCount: 0, remainingCount: 0 };
    }

    const remainingQueue = [];
    let processedCount = 0;
    const errors = [];

    const tableMappers = {
      clientes: mapClienteToDb,
      ventas: mapVentaToDb,
      abonos: mapAbonoToDb,
      productos: mapProductoToDb,
      zonas: mapZonaToDb,
      usuarios: mapUsuarioToDb,
      cortes: mapCorteToDb
    };

    for (const task of queue) {
      try {
        const mapper = tableMappers[task.table];
        const dbRecords = mapper ? task.records.map(mapper) : task.records;

        if (task.type === 'DELETE') {
          const ids = dbRecords.map((r) => r.id);
          const { error } = await supabase.from(task.table).delete().in('id', ids);
          if (error) throw error;
        } else {
          const { error } = await supabase.from(task.table).upsert(dbRecords, { onConflict: 'id' });
          if (error) throw error;
        }

        processedCount++;
        console.log(`✅ Tarea de cola '${task.id}' (${task.table}) enviada exitosamente a Supabase.`);
      } catch (taskErr) {
        const errorMsg = taskErr?.message || String(taskErr);
        console.warn(`⚠️ Error al procesar tarea de cola '${task.id}' (${task.table}):`, errorMsg);

        errors.push({ taskId: task.id, table: task.table, error: errorMsg });
        remainingQueue.push({
          ...task,
          attempts: (task.attempts || 0) + 1,
          lastError: errorMsg,
          status: 'FAILED',
          lastAttemptAt: new Date().toISOString()
        });
      }
    }

    await localforage.setItem('pwa_sync_queue', remainingQueue);
    await localforage.setItem('pwa_pending_sync', remainingQueue.length);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pwa-queue-updated', {
          detail: { queue: remainingQueue, count: remainingQueue.length, processedCount }
        })
      );
    }

    console.log(`📊 Fin de procesamiento de cola: ${processedCount} procesados, ${remainingQueue.length} pendientes en cola.`);

    isProcessingQueue = false;
    return {
      success: errors.length === 0,
      processedCount,
      remainingCount: remainingQueue.length,
      errors
    };
  } catch (err) {
    console.error('❌ Error general procesando cola de sincronización:', err);
    isProcessingQueue = false;
    return { success: false, error: err };
  }
}

// 3. Mapeadores de Transformación (JS camelCase <-> DB snake_case)

// CLIENTES
function mapClienteToDb(c) {
  return {
    id: c.id,
    folio: c.folio,
    nombre_completo: c.nombreCompleto || c.nombre_completo || '',
    direccion: c.direccion || '',
    colonia: c.colonia || '',
    referencias: c.referencias || '',
    telefono: c.telefono || '',
    latitud: c.latitud || 0,
    longitud: c.longitud || 0,
    latitud_secundaria: c.latitudSecundaria || c.latitud_secundaria || null,
    longitud_secundaria: c.longitudSecundaria || c.longitud_secundaria || null,
    zona_id: c.zonaId || c.zona_id || 1,
    zona_nombre: c.zonaNombre || c.zona_nombre || '',
    foto_fachada: c.fotoFachada || c.foto_fachada || '',
    foto_cliente: c.fotoCliente || c.foto_cliente || '',
    foto_contrato: c.fotoContrato || c.foto_contrato || '',
    tarjeta_impresa: c.tarjetaImpresa ? 1 : 0,
    estado_morosidad: c.estadoMorosidad || c.estado_morosidad || 'VERDE',
    creado_por_vendedora_id: c.creadoPorVendedoraId || c.creado_por_vendedora_id || 1,
    vendedora_nombre: c.vendedoraNombre || c.vendedora_nombre || '',
    fecha_registro: c.fechaRegistro || c.fecha_registro || new Date().toISOString()
  };
}

function mapClienteFromDb(db) {
  return {
    id: db.id,
    folio: db.folio,
    nombreCompleto: db.nombre_completo || db.nombreCompleto || '',
    direccion: db.direccion || '',
    colonia: db.colonia || '',
    referencias: db.referencias || '',
    telefono: db.telefono || '',
    latitud: Number(db.latitud) || 0,
    longitud: Number(db.longitud) || 0,
    latitudSecundaria: db.latitud_secundaria ? Number(db.latitud_secundaria) : undefined,
    longitudSecundaria: db.longitud_secundaria ? Number(db.longitud_secundaria) : undefined,
    zonaId: Number(db.zona_id) || 1,
    zonaNombre: db.zona_nombre || db.zonaNombre || '',
    fotoFachada: db.foto_fachada || db.fotoFachada || '',
    fotoCliente: db.foto_cliente || db.fotoCliente || '',
    fotoContrato: db.foto_contrato || db.fotoContrato || '',
    tarjetaImpresa: Boolean(db.tarjeta_impresa),
    estadoMorosidad: db.estado_morosidad || db.estadoMorosidad || 'VERDE',
    creadoPorVendedoraId: Number(db.creado_por_vendedora_id) || 1,
    vendedoraNombre: db.vendedora_nombre || db.vendedoraNombre || '',
    fechaRegistro: db.fecha_registro || new Date().toISOString().split('T')[0]
  };
}

// VENTAS
function mapVentaToDb(v) {
  return {
    id: v.id,
    cliente_id: v.clienteId || v.cliente_id,
    cliente_nombre: v.clienteNombre || v.cliente_nombre || '',
    cliente_folio: v.clienteFolio || v.cliente_folio || '',
    vendedora_id: v.vendedoraId || v.vendedora_id || 1,
    vendedora_nombre: v.vendedoraNombre || v.vendedora_nombre || '',
    producto_id: v.productoId || v.producto_id || 1,
    producto_nombre: v.productoNombre || v.producto_nombre || '',
    tipo: v.tipo || 'CREDITO',
    precio_base: v.precioBase || v.precio_base || 1490,
    enganche_monto: v.engancheMonto || v.enganche_monto || 0,
    aporte_empresa: v.aporteEmpresa || v.aporte_empresa || 0,
    descuento_otorgado: v.descuentoOtorgado || v.descuento_otorgado || 0,
    saldo_inicial: v.saldoInicial || v.saldo_inicial || 0,
    saldo_actual: v.saldoActual || v.saldo_actual || 0,
    pago_semanal: v.pagoSemanal || v.pago_semanal || 100,
    comision_vendedora: v.comisionVendedora || v.comision_vendedora || 0,
    estado: v.estado || 'PENDIENTE_VALIDACION',
    fecha_venta: v.fechaVenta || v.fecha_venta || new Date().toISOString(),
    fecha_primer_pago: v.fechaPrimerPago || v.fecha_primer_pago || new Date().toISOString().split('T')[0],
    dia_cobro_zona: v.diaCobroZona || v.dia_cobro_zona || 'Lunes'
  };
}

function mapVentaFromDb(db) {
  return {
    id: db.id,
    clienteId: Number(db.cliente_id || db.clienteId),
    clienteNombre: db.cliente_nombre || db.clienteNombre || '',
    clienteFolio: db.cliente_folio || db.clienteFolio || '',
    vendedoraId: Number(db.vendedora_id || db.vendedoraId || 1),
    vendedoraNombre: db.vendedora_nombre || db.vendedoraNombre || '',
    productoId: Number(db.producto_id || db.productoId || 1),
    productoNombre: db.producto_nombre || db.productoNombre || '',
    tipo: db.tipo || 'CREDITO',
    precioBase: Number(db.precio_base || db.precioBase || 1490),
    engancheMonto: Number(db.enganche_monto || db.engancheMonto || 0),
    aporteEmpresa: Number(db.aporte_empresa || db.aporteEmpresa || 0),
    descuentoOtorgado: Number(db.descuento_otorgado || db.descuentoOtorgado || 0),
    saldoInicial: Number(db.saldo_inicial || db.saldoInicial || 0),
    saldoActual: Number(db.saldo_actual || db.saldoActual || 0),
    pagoSemanal: Number(db.pago_semanal || db.pagoSemanal || 100),
    comisionVendedora: Number(db.comision_vendedora || db.comisionVendedora || 0),
    estado: db.estado || 'APROBADA',
    fechaVenta: db.fecha_venta || db.fechaVenta || new Date().toISOString().split('T')[0],
    fechaPrimerPago: db.fecha_primer_pago || db.fechaPrimerPago || new Date().toISOString().split('T')[0],
    diaCobroZona: db.dia_cobro_zona || db.diaCobroZona || 'Lunes'
  };
}

// ABONOS
function mapAbonoToDb(a) {
  return {
    id: a.id,
    venta_id: a.ventaId || a.venta_id,
    cliente_id: a.clienteId || a.cliente_id,
    cliente_nombre: a.clienteNombre || a.cliente_nombre || '',
    cliente_folio: a.clienteFolio || a.cliente_folio || '',
    cobrador_id: a.cobradorId || a.cobrador_id || 1,
    cobrador_nombre: a.cobradorNombre || a.cobrador_nombre || '',
    monto: a.monto || 0,
    tipo_pago: a.tipoPago || a.tipo_pago || 'EFECTIVO',
    semana_numero: a.semanaNumero || a.semana_numero || 1,
    observaciones: a.observaciones || '',
    fecha_pago: a.fechaPago || a.fecha_pago || new Date().toISOString(),
    wa_enviado: a.waEnviado ? 1 : 0
  };
}

function mapAbonoFromDb(db) {
  return {
    id: db.id,
    ventaId: Number(db.venta_id || db.ventaId),
    clienteId: Number(db.cliente_id || db.clienteId),
    clienteNombre: db.cliente_nombre || db.clienteNombre || '',
    clienteFolio: db.cliente_folio || db.clienteFolio || '',
    cobradorId: Number(db.cobrador_id || db.cobradorId || 1),
    cobradorNombre: db.cobrador_nombre || db.cobradorNombre || '',
    monto: Number(db.monto || 0),
    tipoPago: db.tipo_pago || db.tipoPago || 'EFECTIVO',
    semanaNumero: Number(db.semana_numero || db.semanaNumero || 1),
    observaciones: db.observaciones || '',
    fechaPago: db.fecha_pago || db.fechaPago || new Date().toISOString().split('T')[0],
    waEnviado: Boolean(db.wa_enviado)
  };
}

// PRODUCTOS
function mapProductoToDb(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    precio_base: Number(p.precioBase || p.precio_base || 0),
    enganche_minimo: Number(p.engancheMinimo || p.enganche_minimo || 0),
    descuento_empresa: Number(p.descuentoEmpresa || p.descuento_empresa || 0),
    pago_semanal_sugerido: Number(p.pagoSemanalSugerido || p.pago_semanal_sugerido || 0),
    descripcion: p.descripcion || '',
    categoria: p.categoria || '',
    foto_url: p.fotoUrl || p.foto_url || '',
    activo: p.activo ? 1 : 0
  };
}

function mapProductoFromDb(db) {
  return {
    id: db.id,
    nombre: db.nombre || '',
    precioBase: Number(db.precio_base || db.precioBase || 0),
    engancheMinimo: Number(db.enganche_minimo || db.engancheMinimo || 0),
    descuentoEmpresa: Number(db.descuento_empresa || db.descuentoEmpresa || 0),
    pagoSemanalSugerido: Number(db.pago_semanal_sugerido || db.pagoSemanalSugerido || 0),
    descripcion: db.descripcion || '',
    categoria: db.categoria || '',
    fotoUrl: db.foto_url || db.fotoUrl || '',
    activo: Boolean(db.activo)
  };
}

// ZONAS
function mapZonaToDb(z) {
  return {
    id: z.id,
    nombre: z.nombre,
    dia_cobro: z.diaCobro || z.dia_cobro || 'Lunes',
    colonias: Array.isArray(z.colonias) ? JSON.stringify(z.colonias) : z.colonias || '[]',
    cuadrante: z.cuadrante || '',
    descripcion: z.descripcion || ''
  };
}

function mapZonaFromDb(db) {
  let coloniasParsed = [];
  if (Array.isArray(db.colonias)) {
    coloniasParsed = db.colonias;
  } else if (typeof db.colonias === 'string') {
    try {
      coloniasParsed = JSON.parse(db.colonias);
    } catch {
      coloniasParsed = [db.colonias];
    }
  }
  return {
    id: db.id,
    nombre: db.nombre || '',
    diaCobro: db.dia_cobro || db.diaCobro || 'Lunes',
    colonias: coloniasParsed,
    cuadrante: db.cuadrante || '',
    descripcion: db.descripcion || ''
  };
}

// USUARIOS
function mapUsuarioToDb(u) {
  return {
    id: u.id,
    nombre: u.nombre || '',
    usuario: u.usuario || '',
    email: u.email || '',
    password: u.password || '',
    pin: u.pin || '1234',
    rol: u.rol || 'admin',
    telefono: u.telefono || '',
    activo: Boolean(u.activo),
    avatar_url: u.avatarUrl || u.avatar_url || '',
    sueldo_base: Number(u.sueldoBase || u.sueldo_base || 1500),
    porcentaje_comision: Number(u.porcentajeComision || u.porcentaje_comision || 5),
    comision_por_venta: Number(u.comisionPorVenta || u.comision_por_venta || 100)
  };
}

function mapUsuarioFromDb(db) {
  return {
    id: db.id,
    nombre: db.nombre || '',
    usuario: db.usuario || '',
    email: db.email || '',
    password: db.password || '',
    pin: db.pin || '1234',
    rol: db.rol || 'admin',
    telefono: db.telefono || '',
    activo: Boolean(db.activo),
    avatarUrl: db.avatar_url || db.avatarUrl || '',
    sueldoBase: Number(db.sueldo_base || db.sueldoBase || 1500),
    porcentajeComision: Number(db.porcentaje_comision || db.porcentajeComision || 5),
    comisionPorVenta: Number(db.comision_por_venta || db.comisionPorVenta || 100)
  };
}

// CORTES
function mapCorteToDb(c) {
  return {
    id: c.id,
    usuario_id: c.usuarioId || c.usuario_id || 1,
    usuario_nombre: c.usuarioNombre || c.usuario_nombre || '',
    rol_tipo: c.rolTipo || c.rol_tipo || 'VENDEDORA',
    fecha: c.fecha || new Date().toISOString().split('T')[0],
    fondo_inicial: c.fondoInicial || c.fondo_inicial || 0,
    gastos_gasolina: c.gastosGasolina || c.gastos_gasolina || 0,
    viaticos: c.viaticos || 0,
    efectivo_recolectado: c.efectivoRecolectado || c.efectivo_recolectado || 0,
    efectivo_entregado: c.efectivoEntregado || c.efectivo_entregado || 0,
    diferencia: c.diferencia || 0,
    estado: c.estado || 'ABIERTO',
    observaciones: c.observaciones || ''
  };
}

function mapCorteFromDb(db) {
  return {
    id: db.id,
    usuarioId: Number(db.usuario_id || db.usuarioId || 1),
    usuarioNombre: db.usuario_nombre || db.usuarioNombre || '',
    rolTipo: db.rol_tipo || db.rolTipo || 'VENDEDORA',
    fecha: db.fecha || new Date().toISOString().split('T')[0],
    fondoInicial: Number(db.fondo_inicial || db.fondoInicial || 0),
    gastosGasolina: Number(db.gastos_gasolina || db.gastosGasolina || 0),
    viaticos: Number(db.viaticos || 0),
    efectivoRecolectado: Number(db.efectivo_recolectado || db.efectivoRecolectado || 0),
    efectivoEntregado: Number(db.efectivo_entregado || db.efectivoEntregado || 0),
    diferencia: Number(db.diferencia || 0),
    estado: db.estado || 'ABIERTO',
    observaciones: db.observaciones || ''
  };
}

// Helper para registrar IDs eliminados localmente
export async function markAsDeletedLocally(tableName, id) {
  if (!id) return;
  try {
    const list = (await localforage.getItem('pwa_deleted_ids')) || [];
    const key = `${tableName}_${id}`;
    if (!list.includes(key)) {
      list.push(key);
      await localforage.setItem('pwa_deleted_ids', list);
    }
  } catch (err) {
    console.warn('Error guardando ID eliminado:', err);
  }
}

// 4. Lógica de Fusión y Resolución de Conflictos (Respetando registros eliminados)
function mergeArraysById(tableName, localArr = [], remoteArr = [], mapFromDb, deletedIdsSet = new Set()) {
  const itemMap = new Map();

  // Cargar elementos locales (filtrando si están eliminados)
  for (const item of localArr) {
    if (item && item.id != null) {
      const key = `${tableName}_${item.id}`;
      if (!deletedIdsSet.has(key)) {
        itemMap.set(item.id, item);
      }
    }
  }

  // Fusión con elementos de Supabase (omite los eliminados localmente)
  for (const remoteRaw of remoteArr) {
    const remoteItem = mapFromDb(remoteRaw);
    if (remoteItem && remoteItem.id != null) {
      const key = `${tableName}_${remoteItem.id}`;
      if (deletedIdsSet.has(key)) {
        // Ignorar elemento que fue eliminado
        continue;
      }
      if (itemMap.has(remoteItem.id)) {
        const existingLocal = itemMap.get(remoteItem.id);
        const merged = { ...existingLocal };
        for (const [key, val] of Object.entries(remoteItem)) {
          if (val !== undefined && val !== null && val !== '') {
            merged[key] = val;
          }
        }
        itemMap.set(remoteItem.id, merged);
      } else {
        itemMap.set(remoteItem.id, remoteItem);
      }
    }
  }

  return Array.from(itemMap.values());
}

// COMPROBACIÓN DE CONEXIÓN REAL CON SUPABASE
export async function checkSupabaseConnection() {
  if (typeof window === 'undefined') return { connected: false, latency: 0, error: 'SSR' };

  const creds = getSupabaseCredentials();
  if (!creds.url || creds.url.includes('your-supabase-project.supabase.co')) {
    return {
      connected: false,
      latency: 0,
      error: 'Sin URL de Supabase configurada. Ingresa las credenciales de tu proyecto Supabase.'
    };
  }

  try {
    const start = performance.now();
    const { data, error } = await supabase.from('usuarios').select('id').limit(1);
    const latency = Math.round(performance.now() - start);
    if (!error) {
      return { connected: true, latency, error: null };
    } else {
      const errMsg = error.message || 'Error en respuesta Supabase';
      if (
        errMsg.includes('schema cache') ||
        errMsg.includes('does not exist') ||
        errMsg.includes('public.usuarios') ||
        error.code === '42P01' ||
        error.code === 'PGRST301'
      ) {
        return {
          connected: false,
          tablesMissing: true,
          latency,
          error: '⚠️ Conexión con Supabase exitosa, pero las tablas aún no existen en la base de datos PostgreSQL. Copia y ejecuta el Script SQL de Inicialización en Supabase → SQL Editor.'
        };
      }
      return { connected: false, latency, error: errMsg };
    }
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
      return {
        connected: false,
        latency: 0,
        error: 'No se pudo contactar con Supabase (Error de Red / Failed to fetch). Configura tu URL y Llave en el panel.'
      };
    }
    return { connected: false, latency: 0, error: msg };
  }
}

// 5. Funciones auxiliares de sincronización por colección
async function pushCollection(tableName, localArr, mapToDb) {
  if (!localArr || localArr.length === 0) return { success: true, count: 0 };
  try {
    const dbRecords = localArr.map(mapToDb);
    const { error } = await supabase
      .from(tableName)
      .upsert(dbRecords, { onConflict: 'id' });

    if (error) {
      console.warn(`[Supabase Push] Aviso al enviar '${tableName}':`, error.message);
      if (tableName === 'usuarios' && error.message?.includes('column')) {
        const minimalRecords = dbRecords.map((r) => ({
          id: r.id,
          nombre: r.nombre,
          usuario: r.usuario,
          email: r.email,
          password: r.password,
          pin: r.pin,
          rol: r.rol,
          telefono: r.telefono,
          activo: r.activo
        }));
        const { error: minErr } = await supabase.from(tableName).upsert(minimalRecords, { onConflict: 'id' });
        if (!minErr) return { success: true, count: minimalRecords.length };
      }
      return { success: false, error };
    }
    return { success: true, count: dbRecords.length };
  } catch (err) {
    console.warn(`[Supabase Push Error] Error en '${tableName}':`, err);
    return { success: false, error: err };
  }
}

async function pullCollection(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      console.warn(`[Supabase Pull] Aviso al recibir '${tableName}':`, error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn(`[Supabase Pull Error] Error al recibir '${tableName}':`, err);
    return [];
  }
}

// 6. LÓGICA DE SINCRONIZACIÓN BIDIRECCIONAL COMPLETA (ULTRARRÁPIDA)
export async function syncLocalDataWithSupabase() {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'SSR Environment' };
  }

  console.log('🔄 Sincronizando datos con la nube de Supabase...');

  try {
    // A. Procesar cola de tareas pendientes reintentadas primero
    const queueRes = await processSyncQueue();

    // B. Leer datos locales
    const [
      localClientes,
      localVentas,
      localAbonos,
      localProductos,
      localZonas,
      localUsuarios,
      localCortes
    ] = await Promise.all([
      localforage.getItem('pwa_clientes').then(r => r || []),
      localforage.getItem('pwa_ventas').then(r => r || []),
      localforage.getItem('pwa_abonos').then(r => r || []),
      localforage.getItem('pwa_productos').then(r => r || []),
      localforage.getItem('pwa_zonas').then(r => r || []),
      localforage.getItem('pwa_usuarios').then(r => r || []),
      localforage.getItem('pwa_cortes').then(r => r || [])
    ]);

    // C. PUSH ligero: Solo push de colecciones si hay elementos o tareas reintentadas
    const pendingCount = await getPendingSyncCount();
    if (pendingCount > 0) {
      await Promise.all([
        pushCollection('clientes', localClientes, mapClienteToDb),
        pushCollection('ventas', localVentas, mapVentaToDb),
        pushCollection('abonos', localAbonos, mapAbonoToDb),
        pushCollection('productos', localProductos, mapProductoToDb),
        pushCollection('zonas', localZonas, mapZonaToDb),
        pushCollection('usuarios', localUsuarios, mapUsuarioToDb),
        pushCollection('cortes', localCortes, mapCorteToDb)
      ]);
    }

    // D. PULL: Descargar actualizaciones instantáneas desde Supabase en PARALELO
    const [
      remoteClientes,
      remoteVentas,
      remoteAbonos,
      remoteProductos,
      remoteZonas,
      remoteUsuarios,
      remoteCortes
    ] = await Promise.all([
      pullCollection('clientes'),
      pullCollection('ventas'),
      pullCollection('abonos'),
      pullCollection('productos'),
      pullCollection('zonas'),
      pullCollection('usuarios'),
      pullCollection('cortes')
    ]);

    // E. FUSIÓN Y RESOLUCIÓN DE CONFLICTOS RESPETANDO REGISTROS ELIMINADOS
    const deletedIdsList = (await localforage.getItem('pwa_deleted_ids')) || [];
    const deletedIdsSet = new Set(deletedIdsList);

    const mergedClientes = mergeArraysById('clientes', localClientes, remoteClientes, mapClienteFromDb, deletedIdsSet);
    const mergedVentas = mergeArraysById('ventas', localVentas, remoteVentas, mapVentaFromDb, deletedIdsSet);
    const mergedAbonos = mergeArraysById('abonos', localAbonos, remoteAbonos, mapAbonoFromDb, deletedIdsSet);
    const mergedProductos = mergeArraysById('productos', localProductos, remoteProductos, mapProductoFromDb, deletedIdsSet);
    const mergedZonas = mergeArraysById('zonas', localZonas, remoteZonas, mapZonaFromDb, deletedIdsSet);
    const mergedUsuarios = mergeArraysById('usuarios', localUsuarios, remoteUsuarios, mapUsuarioFromDb, deletedIdsSet);
    const mergedCortes = mergeArraysById('cortes', localCortes, remoteCortes, mapCorteFromDb, deletedIdsSet);

    // F. Guardar colecciones fusionadas en localforage en PARALELO
    await Promise.all([
      localforage.setItem('pwa_clientes', mergedClientes),
      localforage.setItem('pwa_ventas', mergedVentas),
      localforage.setItem('pwa_abonos', mergedAbonos),
      localforage.setItem('pwa_productos', mergedProductos),
      localforage.setItem('pwa_zonas', mergedZonas),
      localforage.setItem('pwa_usuarios', mergedUsuarios),
      localforage.setItem('pwa_cortes', mergedCortes)
    ]);

    // G. Actualizar conteo de cola restante
    const remainingQueue = await getSyncQueue();
    const finalPendingCount = remainingQueue.length;
    await localforage.setItem('pwa_pending_sync', finalPendingCount);

    const mergedData = {
      clientes: mergedClientes,
      ventas: mergedVentas,
      abonos: mergedAbonos,
      productos: mergedProductos,
      zonas: mergedZonas,
      usuarios: mergedUsuarios,
      cortes: mergedCortes
    };

    // H. Emitir evento global en navegador para actualización reactiva
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pwa-sync-complete', {
          detail: { mergedData, pendingSyncCount: finalPendingCount },
        })
      );
    }

    console.log('✅ Sincronización ultrarrápida completada.');
    return {
      success: true,
      pendingSyncCount: finalPendingCount,
      mergedData,
    };
  } catch (err) {
    console.error('❌ Error general durante la sincronización:', err);
    return {
      success: false,
      error: err,
    };
  }
}

// 7. Configuración de Listeners automáticos
export function setupSyncListeners(onSyncComplete, onSyncError) {
  if (typeof window === 'undefined') return () => {};

  const handleTriggerSync = async () => {
    try {
      const res = await syncLocalDataWithSupabase();
      if (res.success && onSyncComplete) {
        onSyncComplete(res);
      } else if (!res.success && onSyncError) {
        onSyncError(res.error);
      }
    } catch (err) {
      if (onSyncError) onSyncError(err);
    }
  };

  const handleProcessQueueOnly = async () => {
    try {
      const res = await processSyncQueue();
      if (res.success && res.processedCount > 0) {
        await handleTriggerSync();
      }
    } catch (err) {
      console.error('Error procesando cola:', err);
    }
  };

  const handleOnline = async () => {
    console.log('📶 Conexión restablecida (offline -> online): Reintentando envíos fallidos en la cola de localforage...');
    await processSyncQueue();
    await handleTriggerSync();
  };

  const handleSyncCompleteEvent = (e) => {
    if (onSyncComplete) {
      onSyncComplete(e.detail);
    }
  };

  // Reintento y sincronización periódica activa (cada 5s cuando hay conexión)
  const autoRetryInterval = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      processSyncQueue().then(() => {
        // Auto pull updates every 15s to keep all clients in sync
        if (Math.random() < 0.3) {
          syncLocalDataWithSupabase().then((res) => {
            if (res?.success && res?.mergedData && onSyncComplete) {
              onSyncComplete(res);
            }
          });
        }
      });
    }
  }, 5000);

  // Setup Supabase Realtime Channel
  let realtimeChannel = null;
  try {
    realtimeChannel = supabase
      .channel('bitalis_db_realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, async () => {
        console.log('⚡ Realtime notification from Supabase DB: Syncing...');
        const res = await syncLocalDataWithSupabase();
        if (res?.success && res?.mergedData && onSyncComplete) {
          onSyncComplete(res);
        }
      })
      .subscribe();
  } catch (rtErr) {
    console.warn('Realtime subscription fallback:', rtErr);
  }

  window.addEventListener('pwa-trigger-sync', handleTriggerSync);
  window.addEventListener('pwa-process-queue', handleProcessQueueOnly);
  window.addEventListener('pwa-sync-complete', handleSyncCompleteEvent);
  window.addEventListener('online', handleOnline);

  return () => {
    clearInterval(autoRetryInterval);
    if (realtimeChannel) {
      try {
        supabase.removeChannel(realtimeChannel);
      } catch (e) {}
    }
    window.removeEventListener('pwa-trigger-sync', handleTriggerSync);
    window.removeEventListener('pwa-process-queue', handleProcessQueueOnly);
    window.removeEventListener('pwa-sync-complete', handleSyncCompleteEvent);
    window.removeEventListener('online', handleOnline);
  };
}

// 8. Consultas directas a Supabase
export async function getClientes() {
  const { data, error } = await supabase.from('clientes').select('*');
  if (error) {
    console.error('Error al consultar clientes en Supabase:', error.message);
  }
  return { data, error };
}

export async function getVentas() {
  const { data, error } = await supabase.from('ventas').select('*');
  if (error) {
    console.error('Error al consultar ventas en Supabase:', error.message);
  }
  return { data, error };
}

export async function getAbonos() {
  const { data, error } = await supabase.from('abonos').select('*');
  if (error) {
    console.error('Error al consultar abonos en Supabase:', error.message);
  }
  return { data, error };
}

// 9. ENVÍO INSTANTÁNEO Y LIGERO PARA DATOS MÓVILES (SINGLE ITEM FAST PUSH)
export async function quickPushCliente(cliente) {
  if (!cliente || !cliente.id) return { success: false };
  try {
    const dbRecord = mapClienteToDb(cliente);
    const { error } = await supabase.from('clientes').upsert([dbRecord], { onConflict: 'id' });
    if (!error) {
      console.log('⚡ Cliente enviado e integrado instantáneamente en Supabase.');
      return { success: true };
    } else {
      console.warn('⚠️ Push directo de cliente falló, queda respaldado en cola local:', error.message);
      return { success: false, error };
    }
  } catch (err) {
    console.warn('⚠️ Error en push directo de cliente:', err);
    return { success: false, error: err };
  }
}

export async function quickPushVenta(venta) {
  if (!venta || !venta.id) return { success: false };
  try {
    const dbRecord = mapVentaToDb(venta);
    const { error } = await supabase.from('ventas').upsert([dbRecord], { onConflict: 'id' });
    if (!error) {
      console.log('⚡ Venta enviada e integrada instantáneamente en Supabase.');
      return { success: true };
    } else {
      console.warn('⚠️ Push directo de venta falló, queda respaldado en cola local:', error.message);
      return { success: false, error };
    }
  } catch (err) {
    console.warn('⚠️ Error en push directo de venta:', err);
    return { success: false, error: err };
  }
}

export async function quickPushAbono(abono) {
  if (!abono || !abono.id) return { success: false };
  try {
    const dbRecord = mapAbonoToDb(abono);
    const { error } = await supabase.from('abonos').upsert([dbRecord], { onConflict: 'id' });
    if (!error) {
      console.log('⚡ Abono enviado e integrado instantáneamente en Supabase.');
      return { success: true };
    } else {
      console.warn('⚠️ Push directo de abono falló, queda respaldado en cola local:', error.message);
      return { success: false, error };
    }
  } catch (err) {
    console.warn('⚠️ Error en push directo de abono:', err);
    return { success: false, error: err };
  }
}

export async function quickPushUsuario(usuario) {
  if (!usuario || !usuario.id) return { success: false };
  try {
    const dbRecord = mapUsuarioToDb(usuario);
    const { error } = await supabase.from('usuarios').upsert([dbRecord], { onConflict: 'id' });
    if (!error) {
      console.log('⚡ Usuario enviado e integrado instantáneamente en Supabase.');
      return { success: true };
    } else {
      // Fallback con esquema reducido
      const minimal = {
        id: dbRecord.id,
        nombre: dbRecord.nombre,
        usuario: dbRecord.usuario,
        email: dbRecord.email,
        password: dbRecord.password,
        pin: dbRecord.pin,
        rol: dbRecord.rol,
        telefono: dbRecord.telefono,
        activo: dbRecord.activo
      };
      const { error: err2 } = await supabase.from('usuarios').upsert([minimal], { onConflict: 'id' });
      if (!err2) {
        console.log('⚡ Usuario enviado con esquema básico a Supabase.');
        return { success: true };
      }
      console.warn('⚠️ Push directo de usuario falló:', error.message);
      return { success: false, error };
    }
  } catch (err) {
    console.warn('⚠️ Error en push directo de usuario:', err);
    return { success: false, error: err };
  }
}

export async function quickPushProducto(producto) {
  if (!producto || !producto.id) return { success: false };
  try {
    const dbRecord = mapProductoToDb(producto);
    const { error } = await supabase.from('productos').upsert([dbRecord], { onConflict: 'id' });
    if (!error) return { success: true };
    return { success: false, error };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function quickPushZona(zona) {
  if (!zona || !zona.id) return { success: false };
  try {
    const dbRecord = mapZonaToDb(zona);
    const { error } = await supabase.from('zonas').upsert([dbRecord], { onConflict: 'id' });
    if (!error) return { success: true };
    return { success: false, error };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function quickPushCorte(corte) {
  if (!corte || !corte.id) return { success: false };
  try {
    const dbRecord = mapCorteToDb(corte);
    const { error } = await supabase.from('cortes').upsert([dbRecord], { onConflict: 'id' });
    if (!error) return { success: true };
    return { success: false, error };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function quickDeleteCliente(id) {
  if (!id) return { success: false };
  try {
    await markAsDeletedLocally('clientes', id);
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (!error) {
      console.log('⚡ Cliente eliminado instantáneamente de Supabase.');
      return { success: true };
    }
    return { success: false, error };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function quickDeleteAbono(id) {
  if (!id) return { success: false };
  try {
    await markAsDeletedLocally('abonos', id);
    const { error } = await supabase.from('abonos').delete().eq('id', id);
    if (!error) {
      console.log('⚡ Abono eliminado instantáneamente de Supabase.');
      return { success: true };
    }
    return { success: false, error };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function quickDeleteVenta(id) {
  if (!id) return { success: false };
  try {
    await markAsDeletedLocally('ventas', id);
    const { error } = await supabase.from('ventas').delete().eq('id', id);
    if (!error) {
      console.log('⚡ Venta eliminada instantáneamente de Supabase.');
      return { success: true };
    }
    return { success: false, error };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function quickDeleteUsuario(id) {
  if (!id) return { success: false };
  try {
    await markAsDeletedLocally('usuarios', id);
    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (!error) {
      console.log('⚡ Usuario eliminado instantáneamente de Supabase.');
      return { success: true };
    }
    return { success: false, error };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function wipeDatabaseKeepUsers() {
  try {
    await localforage.setItem('pwa_clientes', []);
    await localforage.setItem('pwa_ventas', []);
    await localforage.setItem('pwa_abonos', []);
    await localforage.setItem('pwa_cortes', []);
    await localforage.setItem('pwa_audit_logs', []);
    await clearSyncQueue();

    const creds = getSupabaseCredentials();
    if (creds.url && !creds.url.includes('your-supabase-project.supabase.co')) {
      try {
        await supabase.from('clientes').delete().neq('id', 0);
        await supabase.from('ventas').delete().neq('id', 0);
        await supabase.from('abonos').delete().neq('id', 0);
        await supabase.from('cortes').delete().neq('id', 0);
      } catch (e) {
        console.warn('Advertencia al limpiar tablas remotas en Supabase:', e);
      }
    }
    return { success: true };
  } catch (err) {
    console.error('Error limpiando base de datos:', err);
    return { success: false, error: err ? err.message : String(err) };
  }
}

const defaultExport = {
  supabase,
  getSupabaseCredentials,
  saveSupabaseCredentials,
  checkSupabaseConnection,
  syncLocalDataWithSupabase,
  wipeDatabaseKeepUsers,
  quickPushCliente,
  quickPushVenta,
  quickPushAbono,
  quickPushUsuario,
  quickPushProducto,
  quickPushZona,
  quickPushCorte,
  quickDeleteAbono,
  getPendingSyncCount,
  incrementPendingSyncCount,
  resetPendingSyncCount,
  getSyncQueue,
  enqueueSyncTask,
  clearSyncQueue,
  processSyncQueue,
  setupSyncListeners,
  getClientes,
  getVentas,
  getAbonos,
};

export default defaultExport;
