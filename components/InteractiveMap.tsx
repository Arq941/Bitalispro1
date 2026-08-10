'use client';

import MapaRutaLeaflet, { EstadoClienteRuta } from './MapaRutaLeaflet';
import { Cliente, PuntoRutaOptimizado } from '@/types';

export interface InteractiveMapProps {
  clientes?: Cliente[];
  puntos?: PuntoRutaOptimizado[];
  onSelectCliente?: (cliente: Cliente) => void;
  clienteSeleccionadoId?: number | null;
  height?: string;
  isDensityMap?: boolean;
  onOpenInAppNavigator?: (cliente?: Cliente) => void;
  estadosClientes?: { [clienteId: number]: EstadoClienteRuta };
  userLocation?: { lat: number; lng: number } | null;
}

export { MapaRutaLeaflet };

export default function InteractiveMap({
  clientes = [],
  puntos,
  onSelectCliente,
  clienteSeleccionadoId,
  height = '350px',
  onOpenInAppNavigator,
  estadosClientes,
  userLocation,
}: InteractiveMapProps) {
  return (
    <div className="relative w-full">
      <MapaRutaLeaflet
        clientes={clientes}
        puntosRuta={puntos}
        clienteSeleccionadoId={clienteSeleccionadoId}
        onSelectCliente={onSelectCliente}
        estadosClientes={estadosClientes}
        userLocation={userLocation}
        height={height}
      />
      {onOpenInAppNavigator && (
        <div className="absolute top-3 right-3 z-[400]">
          <button
            type="button"
            onClick={() => onOpenInAppNavigator()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-2xl border border-indigo-400 cursor-pointer transition transform active:scale-95"
            title="Iniciar Navegación GPS Turn-by-Turn en la app"
          >
            <span className="text-sm">🧭</span>
            <span>Navegador GPS In-App</span>
          </button>
        </div>
      )}
    </div>
  );
}

