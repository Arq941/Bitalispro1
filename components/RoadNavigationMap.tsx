'use client';

import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type Point = { lat: number; lng: number };

type Props = {
  position: Point & { accuracy?: number };
  destination: Point & { name?: string };
  geometry: Point[];
  follow?: boolean;
};

function Camera({ position, destination, geometry, follow = true }: Props) {
  const map = useMap();
  useEffect(() => {
    if (follow) {
      map.setView([position.lat, position.lng], 17, { animate: true });
      return;
    }
    const points: [number, number][] = geometry.length
      ? geometry.map(p => [p.lat, p.lng])
      : [[position.lat, position.lng], [destination.lat, destination.lng]];
    map.fitBounds(points, { padding: [30, 30], maxZoom: 17 });
  }, [map, position.lat, position.lng, destination.lat, destination.lng, geometry, follow]);
  return null;
}

export default function RoadNavigationMap(props: Props) {
  const { position, destination, geometry, follow = true } = props;
  const line: [number, number][] = (geometry.length ? geometry : [position, destination]).map(p => [p.lat, p.lng]);
  return (
    <div className="overflow-hidden rounded-[26px] border border-white/5 bg-slate-900">
      <MapContainer center={[position.lat, position.lng]} zoom={17} scrollWheelZoom className="h-[54vh] min-h-[390px] w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Camera {...props} />
        <Polyline positions={line} pathOptions={{ weight: 6, opacity: 0.88 }} />
        <CircleMarker center={[position.lat, position.lng]} radius={10} pathOptions={{ weight: 4, fillOpacity: 1 }}>
          <Popup><b>Tu ubicación</b>{position.accuracy ? <><br/>Precisión {Math.round(position.accuracy)} m</> : null}</Popup>
        </CircleMarker>
        <CircleMarker center={[destination.lat, destination.lng]} radius={11} pathOptions={{ weight: 4, fillOpacity: 1 }}>
          <Popup><b>{destination.name || 'Destino'}</b></Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
