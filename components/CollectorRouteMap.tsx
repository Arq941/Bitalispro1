'use client';

import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type Position = { lat: number; lng: number; accuracy?: number };
type Stop = {
  id: string;
  order: number;
  lat: number;
  lng: number;
  name: string;
  clientNumber?: string;
  balance?: number;
  riskLevel?: string;
  active?: boolean;
};

type Props = {
  position: Position;
  stops: Stop[];
  onSelect?: (id: string) => void;
  mode?: 'overview' | 'navigation';
};

function MapViewport({ position, stops, mode = 'overview' }: Props) {
  const map = useMap();
  useEffect(() => {
    if (mode === 'navigation') {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16), { animate: true });
      return;
    }
    const pts: [number, number][] = [[position.lat, position.lng], ...stops.map(s => [s.lat, s.lng] as [number, number])];
    if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
  }, [map, mode, position.lat, position.lng, stops]);
  return null;
}

export default function CollectorRouteMap({ position, stops, onSelect, mode = 'overview' }: Props) {
  const active = stops.find(s => s.active);
  const lineStops = mode === 'navigation' && active ? [active] : stops;
  const line: [number, number][] = [[position.lat, position.lng], ...lineStops.map(s => [s.lat, s.lng] as [number, number])];

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/5 bg-slate-900">
      <MapContainer center={[position.lat, position.lng]} zoom={14} scrollWheelZoom className="h-[420px] w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapViewport position={position} stops={stops} mode={mode} />
        <Polyline positions={line} pathOptions={{ weight: 4, opacity: 0.72 }} />
        <CircleMarker center={[position.lat, position.lng]} radius={10} pathOptions={{ weight: 4, fillOpacity: 1 }}>
          <Popup><b>Tu ubicación</b>{position.accuracy ? <><br/>Precisión: {Math.round(position.accuracy)} m</> : null}</Popup>
        </CircleMarker>
        {stops.map(stop => (
          <CircleMarker key={stop.id} center={[stop.lat, stop.lng]} radius={stop.active ? 11 : 8} pathOptions={{ weight: stop.active ? 5 : 3, fillOpacity: 0.92 }} eventHandlers={{ click: () => onSelect?.(stop.id) }}>
            <Popup>
              <div style={{ minWidth: 150 }}>
                <b>{stop.order}. {stop.name}</b><br/>
                {stop.clientNumber ? <>Folio: {stop.clientNumber}<br/></> : null}
                {typeof stop.balance === 'number' ? <>Saldo: ${stop.balance.toLocaleString('es-MX')}<br/></> : null}
                {stop.riskLevel ? <>Riesgo: {stop.riskLevel}</> : null}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
