'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Cliente, Venta, Abono, Zona } from '@/types';
import {
  MapPin,
  Users,
  Layers,
  Phone,
  MessageSquare,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Eye,
  Edit2,
  Maximize2,
  Filter,
  BarChart2,
} from 'lucide-react';

interface CarteraClientesMapViewProps {
  clientes: Cliente[];
  ventas: Venta[];
  abonos: Abono[];
  zonas: Zona[];
  selectedZonaId: string;
  onSelectZonaId: (zonaId: string) => void;
  onOpenGeoModal?: (cliente: Cliente) => void;
  onExpandClienteDetails?: (clienteId: number) => void;
}

// Zone Color Palette Map
const ZONE_COLORS = [
  { bg: '#6366f1', fill: '#818cf8', border: '#4338ca', name: 'indigo' }, // Indigo
  { bg: '#10b981', fill: '#34d399', border: '#047857', name: 'emerald' }, // Emerald
  { bg: '#f59e0b', fill: '#fbbf24', border: '#b45309', name: 'amber' }, // Amber
  { bg: '#f43f5e', fill: '#fb7185', border: '#be123c', name: 'rose' }, // Rose
  { bg: '#06b6d4', fill: '#22d3ee', border: '#0e7490', name: 'cyan' }, // Cyan
  { bg: '#a855f7', fill: '#c084fc', border: '#7e22ce', name: 'purple' }, // Purple
  { bg: '#3b82f6', fill: '#60a5fa', border: '#1d4ed8', name: 'blue' }, // Blue
];

export default function CarteraClientesMapView({
  clientes,
  ventas,
  abonos,
  zonas,
  selectedZonaId,
  onSelectZonaId,
  onOpenGeoModal,
  onExpandClienteDetails,
}: CarteraClientesMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [id: number]: any }>({});
  const zoneCirclesRef = useRef<any[]>([]);

  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showDensityCircles, setShowDensityCircles] = useState<boolean>(true);
  const [showOnlyWithBalance, setShowOnlyWithBalance] = useState<boolean>(false);

  // Map zoneId to color
  const zoneColorMap = useMemo(() => {
    const map: { [zonaId: number]: (typeof ZONE_COLORS)[0] } = {};
    zonas.forEach((z, idx) => {
      map[z.id] = ZONE_COLORS[idx % ZONE_COLORS.length];
    });
    return map;
  }, [zonas]);

  // Clients filtered for map display
  const mappedClients = useMemo(() => {
    return clientes.filter((c) => {
      const hasValidCoords = typeof c.latitud === 'number' && typeof c.longitud === 'number' && (c.latitud !== 0 || c.longitud !== 0);
      if (!hasValidCoords) return false;

      const venta = ventas.find((v) => v.clienteId === c.id);
      const saldoActual = venta ? venta.saldoActual : 0;

      if (showOnlyWithBalance && saldoActual <= 0) return false;
      return true;
    });
  }, [clientes, ventas, showOnlyWithBalance]);

  // Zone Density Statistics
  const zoneDensityData = useMemo(() => {
    return zonas.map((zona) => {
      const zonaClientes = clientes.filter((c) => c.zonaId === zona.id);
      const mappedInZone = zonaClientes.filter(
        (c) => typeof c.latitud === 'number' && typeof c.longitud === 'number' && (c.latitud !== 0 || c.longitud !== 0)
      );

      const totalBalanceInZone = zonaClientes.reduce((sum, c) => {
        const v = ventas.find((venta) => venta.clienteId === c.id);
        return sum + (v ? v.saldoActual : 0);
      }, 0);

      const morosidadVerde = zonaClientes.filter((c) => c.estadoMorosidad === 'VERDE').length;
      const morosidadAmarillo = zonaClientes.filter((c) => c.estadoMorosidad === 'AMARILLO').length;
      const morosidadRojo = zonaClientes.filter((c) => c.estadoMorosidad === 'ROJO').length;

      // Calculate centroid coordinates for density circle
      let centroidLat = 0;
      let centroidLng = 0;
      let maxDistanceMeters = 500;

      if (mappedInZone.length > 0) {
        centroidLat = mappedInZone.reduce((sum, c) => sum + c.latitud, 0) / mappedInZone.length;
        centroidLng = mappedInZone.reduce((sum, c) => sum + c.longitud, 0) / mappedInZone.length;

        // Estimate density radius in meters
        mappedInZone.forEach((c) => {
          const latDiff = (c.latitud - centroidLat) * 111000;
          const lngDiff = (c.longitud - centroidLng) * 111000 * Math.cos((centroidLat * Math.PI) / 180);
          const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          if (dist > maxDistanceMeters) maxDistanceMeters = dist;
        });
      }

      const totalPortfolio = clientes.length || 1;
      const densityPercent = Math.round((zonaClientes.length / totalPortfolio) * 100);

      return {
        zona,
        totalClientes: zonaClientes.length,
        mappedCount: mappedInZone.length,
        densityPercent,
        totalBalance: totalBalanceInZone,
        morosidadVerde,
        morosidadAmarillo,
        morosidadRojo,
        centroidLat,
        centroidLng,
        densityRadiusMeters: Math.min(Math.max(maxDistanceMeters + 150, 400), 3000),
        colorObj: zoneColorMap[zona.id] || ZONE_COLORS[0],
      };
    });
  }, [zonas, clientes, ventas, zoneColorMap]);

  // Total GPS Coverage metrics
  const totalMappedCount = mappedClients.length;
  const coveragePercent = clientes.length > 0 ? Math.round((totalMappedCount / clientes.length) * 100) : 0;

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    import('leaflet').then((L) => {
      if (!mapInstanceRef.current && mapContainerRef.current) {
        const initialLat = mappedClients.length > 0 ? mappedClients[0].latitud : 19.4326;
        const initialLng = mappedClients.length > 0 ? mappedClients[0].longitud : -99.1332;

        const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear previous markers
      Object.values(markersRef.current).forEach((marker: any) => marker.remove());
      markersRef.current = {};

      // Clear previous density circles
      zoneCirclesRef.current.forEach((circle: any) => circle.remove());
      zoneCirclesRef.current = [];

      // 1. Draw Density Circles per Zone if enabled
      if (showDensityCircles) {
        zoneDensityData.forEach((zd) => {
          if (zd.mappedCount === 0 || zd.centroidLat === 0) return;

          const circle = L.circle([zd.centroidLat, zd.centroidLng], {
            radius: zd.densityRadiusMeters,
            color: zd.colorObj.bg,
            fillColor: zd.colorObj.fill,
            fillOpacity: 0.18,
            weight: 2,
            dashArray: '6, 6',
          }).addTo(map);

          const circlePopup = `
            <div style="font-family: sans-serif; padding: 6px; color: #0f172a; min-width: 180px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${zd.colorObj.bg}; tracking: 1px;">
                CÚMULO Y DENSIDAD GEOGRÁFICA
              </div>
              <strong style="font-size: 14px; color: #0f172a;">${zd.zona.nombre}</strong><br/>
              <span style="font-size: 11px; color: #475569;">Día de cobro: <strong>${zd.zona.diaCobro}</strong></span><br/>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 11px; space-y: 2px;">
                <div>👥 <strong>${zd.totalClientes} clientes</strong> (${zd.densityPercent}% de cartera)</div>
                <div>💰 Saldo en zona: <strong>$${zd.totalBalance.toLocaleString()} MXN</strong></div>
              </div>
            </div>
          `;

          circle.bindPopup(circlePopup);
          zoneCirclesRef.current.push(circle);
        });
      }

      // 2. Add Individual Client Location Markers
      mappedClients.forEach((cliente) => {
        const venta = ventas.find((v) => v.clienteId === cliente.id);
        const saldoActual = venta ? venta.saldoActual : 0;
        const colorStyle = zoneColorMap[cliente.zonaId] || ZONE_COLORS[0];

        // Ring color based on Morosidad
        let ringColor = '#22c55e'; // Verde
        if (cliente.estadoMorosidad === 'AMARILLO') ringColor = '#f59e0b';
        if (cliente.estadoMorosidad === 'ROJO') ringColor = '#ef4444';

        const customIcon = L.divIcon({
          className: 'custom-cartera-icon',
          html: `
            <div style="
              background-color: ${colorStyle.bg};
              width: 32px;
              height: 32px;
              border-radius: 50%;
              border: 3px solid ${ringColor};
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 900;
              font-size: 11px;
              cursor: pointer;
            ">
              ${cliente.nombreCompleto.charAt(0).toUpperCase()}
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([cliente.latitud, cliente.longitud], { icon: customIcon }).addTo(map);

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px; color: #1e293b; min-width: 190px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
              <span style="font-size: 10px; font-weight: 900; color: ${colorStyle.bg}; font-mono: true;">
                FOLIO: ${cliente.folio}
              </span>
              <span style="font-size: 9px; font-weight: 800; background-color: ${ringColor}; color: white; padding: 1px 6px; border-radius: 10px;">
                ${cliente.estadoMorosidad}
              </span>
            </div>
            <strong style="font-size: 13px; color: #0f172a; display: block; line-height: 1.2;">${cliente.nombreCompleto}</strong>
            <span style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">
              📍 ${cliente.direccion} ${cliente.colonia ? `Col. ${cliente.colonia}` : ''}
            </span>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 11px; font-weight: bold; color: ${
              saldoActual > 0 ? '#d97706' : '#16a34a'
            };">
              ${saldoActual > 0 ? `Saldo Pendiente: $${saldoActual.toLocaleString()} MXN` : '✓ YA LIQUIDÓ SU CUENTA'}
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml);

        marker.on('click', () => {
          setSelectedCliente(cliente);
          if (cliente.zonaId) {
            onSelectZonaId(cliente.zonaId.toString());
          }
        });

        markersRef.current[cliente.id] = marker;
      });

      // Fit map bounds if clients exist
      if (mappedClients.length > 0) {
        const bounds = L.latLngBounds(mappedClients.map((c) => [c.latitud, c.longitud]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    });
  }, [mappedClients, ventas, showDensityCircles, zoneDensityData, zoneColorMap]);

  // Center Map on a specific Zone
  const handleCenterOnZone = (zonaId: number) => {
    onSelectZonaId(String(zonaId));
    const zd = zoneDensityData.find((item) => item.zona.id === zonaId);
    if (!zd || zd.mappedCount === 0 || zd.centroidLat === 0 || !mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      const zoneClients = mappedClients.filter((c) => c.zonaId === zonaId);
      if (zoneClients.length > 0) {
        const bounds = L.latLngBounds(zoneClients.map((c) => [c.latitud, c.longitud]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
      } else {
        mapInstanceRef.current.setView([zd.centroidLat, zd.centroidLng], 14, { animate: true });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* MAP HEADER & CONTROLS BAR */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Mapa Interactivo de Cartera y Densidades por Zona
              </h3>
              <p className="text-xs text-slate-300">
                Visualiza la distribución geográfica exacta de clientes, zonas de concentración y saldos por cobrado.
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              Con GPS Mapeado: <strong className="text-white">{totalMappedCount} / {clientes.length} ({coveragePercent}%)</strong>
            </span>
          </div>
        </div>

        {/* MAP TOGGLES AND FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Zone Selector */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedZonaId}
                onChange={(e) => onSelectZonaId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
              >
                <option value="TODAS">Todas las Zonas ({zonas.length})</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nombre} ({z.diaCobro})
                  </option>
                ))}
              </select>
            </div>

            {/* Show Density Circles Toggle */}
            <button
              onClick={() => setShowDensityCircles(!showDensityCircles)}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                showDensityCircles
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Cúmulos de Densidad {showDensityCircles ? 'ON' : 'OFF'}</span>
            </button>

            {/* Show Only Active Debt Toggle */}
            <button
              onClick={() => setShowOnlyWithBalance(!showOnlyWithBalance)}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                showOnlyWithBalance
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>Solo Cuentas con Saldo Pendiente</span>
            </button>
          </div>

          <div className="text-slate-400 text-[11px] font-medium">
            *Haz clic en los marcadores del mapa o de las zonas para ver detalles
          </div>
        </div>
      </div>

      {/* MAIN MAP CONTAINER AND SIDEBAR / DENSITY PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEAFLET MAP VIEW CONTAINER (2 COLS) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="w-full h-[500px] sm:h-[580px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl relative z-0">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* MAP FLOATING LEGEND */}
            <div className="absolute top-3 right-3 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl shadow-xl text-[10px] space-y-1.5">
              <span className="font-extrabold text-slate-300 block border-b border-slate-800 pb-1">
                Estatus de Morosidad
              </span>
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                <span>Al día (Verde)</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
                <span>Atendido hoy (Amarillo)</span>
              </div>
              <div className="flex items-center gap-2 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" />
                <span>Atrasado (Rojo)</span>
              </div>
            </div>
          </div>

          {/* SPOTLIGHT CLIENT DETAIL CARD (WHEN MARKER CLICKED) */}
          {selectedCliente && (
            <div className="bg-slate-800 border-2 border-indigo-500/80 rounded-2xl p-4 shadow-2xl space-y-3 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                    {selectedCliente.folio}
                  </span>
                  <span className="text-xs font-bold text-white">{selectedCliente.nombreCompleto}</span>
                </div>

                <button
                  onClick={() => setSelectedCliente(null)}
                  className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 bg-slate-700 rounded-lg cursor-pointer"
                >
                  ✕ Cerrar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {selectedCliente.direccion} {selectedCliente.colonia ? `Col. ${selectedCliente.colonia}` : ''}
                  </p>
                  <p className="text-slate-300 font-semibold mt-1">
                    Zona: <span className="text-indigo-300 font-bold">{selectedCliente.zonaNombre}</span>
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <a
                    href={`tel:${selectedCliente.telefono}`}
                    className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Llamar</span>
                  </a>

                  <a
                    href={`https://wa.me/52${selectedCliente.telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>

                  {onOpenGeoModal && (
                    <button
                      onClick={() => onOpenGeoModal(selectedCliente)}
                      className="px-3 py-2 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>GPS</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectZonaId(selectedCliente.zonaId.toString())}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-700 text-indigo-300 border border-indigo-800/80 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                    title="Filtrar vista por la zona de este cliente"
                  >
                    <Filter className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Filtrar Zona</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ZONE DENSITY ANALYTICS PANEL (1 COL) */}
        <div className="space-y-4">
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <h4 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-wider">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                Densidad de Clientes por Zona
              </h4>
              <span className="text-[10px] text-slate-400 font-bold">{zonas.length} Zonas</span>
            </div>

            {/* ZONE DENSITY CARDS LIST */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {zoneDensityData.map((zd) => {
                const isSelectedZone = selectedZonaId === String(zd.zona.id);

                return (
                  <div
                    key={zd.zona.id}
                    className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                      isSelectedZone
                        ? 'bg-indigo-950/70 border-indigo-500/80 shadow-indigo-950/40'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow"
                          style={{ backgroundColor: zd.colorObj.bg }}
                        />
                        <span className="font-extrabold text-xs text-white">{zd.zona.nombre}</span>
                      </div>

                      <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-md border border-slate-700">
                        {zd.zona.diaCobro}
                      </span>
                    </div>

                    {/* DENSITY PROGRESS BAR */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Clientes: <strong className="text-white">{zd.totalClientes}</strong> ({zd.densityPercent}% de cartera)</span>
                        <span className="text-emerald-400 font-bold">${zd.totalBalance.toLocaleString()} MXN</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${zd.densityPercent}%`,
                            backgroundColor: zd.colorObj.bg,
                          }}
                        />
                      </div>
                    </div>

                    {/* MOROSIDAD STATUS PILLS */}
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">🟢 {zd.morosidadVerde}</span>
                        <span className="text-amber-400 font-bold">🟡 {zd.morosidadAmarillo}</span>
                        <span className="text-rose-400 font-bold">🔴 {zd.morosidadRojo}</span>
                      </div>

                      <button
                        onClick={() => handleCenterOnZone(zd.zona.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Centrar mapa en este cúmulo de zona"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Centrar Mapa</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
