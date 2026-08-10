import { Cliente } from '@/types';

export interface RutaGuardadaOffline {
  id: string;
  nombre: string;
  fechaCreacion: string;
  fechaRuta: string;
  zonaId?: number;
  zonaNombre?: string;
  totalClientes: number;
  montoTotalEsperado: number;
  clientes: Cliente[];
  ultimaSincronizacion: string;
}

const STORAGE_KEY = 'BITALIS_RUTAS_OFFLINE_V1';

export const offlineRouteStorage = {
  // Obtener todas las rutas guardadas localmente en el dispositivo
  getAll(): RutaGuardadaOffline[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error al leer rutas offline de localStorage:', e);
      return [];
    }
  },

  // Guardar o actualizar una ruta offline precargada
  save(ruta: Omit<RutaGuardadaOffline, 'id' | 'fechaCreacion' | 'ultimaSincronizacion'> & { id?: string }): RutaGuardadaOffline {
    const rutas = this.getAll();
    const id = ruta.id || `ruta-offline-${Date.now()}`;
    const now = new Date().toISOString();

    const nuevaRuta: RutaGuardadaOffline = {
      ...ruta,
      id,
      fechaCreacion: now,
      ultimaSincronizacion: now,
    };

    const index = rutas.findIndex((r) => r.id === id);
    if (index >= 0) {
      rutas[index] = nuevaRuta;
    } else {
      rutas.unshift(nuevaRuta);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rutas));
    } catch (e) {
      console.error('Error al guardar ruta offline en localStorage:', e);
    }

    return nuevaRuta;
  },

  // Precargar / Cachear la ruta actual de hoy automáticamente para navegación sin internet
  precargarRutaActual(clientes: Cliente[], zonaNombre: string = 'Ruta General'): RutaGuardadaOffline {
    const hoy = new Date().toISOString().split('T')[0];
    const totalMonto = clientes.length * 150;
    return this.save({
      id: `ruta-precargada-hoy-${hoy}`,
      nombre: `Ruta Precargada ${hoy} - ${zonaNombre}`,
      fechaRuta: hoy,
      zonaNombre,
      totalClientes: clientes.length,
      montoTotalEsperado: totalMonto,
      clientes,
    });
  },

  // Obtener ruta por ID
  getById(id: string): RutaGuardadaOffline | null {
    const rutas = this.getAll();
    return rutas.find((r) => r.id === id) || null;
  },

  // Eliminar ruta guardada
  delete(id: string): void {
    const rutas = this.getAll().filter((r) => r.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rutas));
    } catch (e) {
      console.error('Error al eliminar ruta offline:', e);
    }
  },

  // Limpiar todas las rutas
  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }
};
