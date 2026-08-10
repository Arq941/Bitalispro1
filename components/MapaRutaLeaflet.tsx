'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Cliente, PuntoRutaOptimizado } from '@/types';
import { LocateFixed, Maximize2, Navigation, MapPin } from 'lucide-react';

export type EstadoClienteRuta = 'pendiente' | 'en_camino' | 'cobrado' | 'fallido' | 'reagendado';

export interface MapaRutaLeafletProps {
  clientes?: Cliente[];
  puntosRuta?: PuntoRutaOptimizado[];
  clienteSeleccionadoId?: number | null;
  onSelectCliente?: (cliente: Cliente) => void;
  estadosClientes?: { [clienteId: number]: EstadoClienteRuta };
  userLocation?: { lat: number; lng: number } | null;
  height?: string;
  showRoutePolyline?: boolean;
  className?: string;
}

export default function MapaRutaLeaflet({
  clientes = [],
  puntosRuta,
  clienteSeleccionadoId,
  onSelectCliente,
  estadosClientes = {},
  userLocation,
  height = '400px',
  showRoutePolyline = true,
  className = '',
}: MapaRutaLeafletProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [id: number]: any }>({});
  const userMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [loadingRoute, setLoadingRoute] = useState<boolean>(false);
  const [osrmDistanceKm, setOsrmDistanceKm] = useState<number | null>(null);
  const [osrmDurationMin, setOsrmDurationMin] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Determine effective array of clients in sequence
  const displayClients: Cliente[] = useMemo(() => {
    if (puntosRuta && puntosRuta.length > 0) {
      return puntosRuta.map((p) => p.cliente);
    }
    return clientes;
  }, [puntosRuta, clientes]);

  // Sequence map for numbering (#1, #2, #3...)
  const sequenceMap = useMemo(() => {
    const map: { [clienteId: number]: number } = {};
    if (puntosRuta && puntosRuta.length > 0) {
      puntosRuta.forEach((p) => {
        map[p.cliente.id] = p.orden;
      });
    } else {
      displayClients.forEach((c, index) => {
        map[c.id] = c.ordenRuta ?? index + 1;
      });
    }
    return map;
  }, [puntosRuta, displayClients]);

  // Center Map on User GPS Position at high zoom level (Street level)
  const handleCenterOnUserLocation = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    setIsLocating(true);
    map.invalidateSize();

    const applyCenter = (lat: number, lng: number) => {
      map.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });

      import('leaflet').then((L) => {
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lat, lng]);
        } else {
          const userIcon = L.divIcon({
            className: 'user-gps-marker',
            html: `
              <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 42px; height: 42px; background-color: #3b82f6; opacity: 0.45; border-radius: 50%; animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></div>
                <div style="background-color: #2563eb; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 10;"></div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          userMarkerRef.current = L.marker([lat, lng], { icon: userIcon }).addTo(map);
        }
      });
      setIsLocating(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyCenter(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('Geolocation failed or denied, using fallback user location', err);
          if (userLocation) {
            applyCenter(userLocation.lat, userLocation.lng);
          } else if (displayClients.length > 0 && displayClients[0].latitud) {
            map.flyTo([displayClients[0].latitud, displayClients[0].longitud], 16, { animate: true });
            setIsLocating(false);
          } else {
            setIsLocating(false);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else if (userLocation) {
      applyCenter(userLocation.lat, userLocation.lng);
    } else {
      setIsLocating(false);
    }
  }, [userLocation, displayClients]);

  // Fit all stops safely in screen view with margin padding
  const handleFitAllStops = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.invalidateSize();

    const allPoints: Array<[number, number]> = [];
    if (userLocation) allPoints.push([userLocation.lat, userLocation.lng]);
    displayClients.forEach((c) => {
      if (c.latitud && c.longitud) allPoints.push([c.latitud, c.longitud]);
    });

    if (allPoints.length > 0) {
      import('leaflet').then((L) => {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      });
    }
  }, [userLocation, displayClients]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet to ensure SSR safety in Next.js
    import('leaflet').then((L) => {
      if (!isMounted) return;

      // Fix default leafet assets path if needed
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Initialize map instance if not already created
      if (!mapInstanceRef.current && mapContainerRef.current) {
        const initialLat = displayClients.length > 0 ? displayClients[0].latitud : (userLocation?.lat || 19.4326);
        const initialLng = displayClients.length > 0 ? displayClients[0].longitud : (userLocation?.lng || -99.1332);

        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: false,
        }).setView([initialLat, initialLng], 14);

        // Standard OpenStreetMap tiles (High readability & fast tile server)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear previous markers
      Object.values(markersRef.current).forEach((marker: any) => marker.remove());
      markersRef.current = {};

      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      // Render User Position Marker if available
      if (userLocation) {
        const userIcon = L.divIcon({
          className: 'user-gps-marker',
          html: `
            <div style="position: relative; width: 32px; height: 32px; display: flex; items-center; justify-content: center;">
              <div style="position: absolute; width: 32px; height: 32px; background-color: #3b82f6; opacity: 0.35; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="background-color: #2563eb; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 10;"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; font-weight: bold; color: #1e293b;">
              📍 Tu Ubicación Actual (Cobrador)
            </div>
          `);
      }

      // Build Waypoints list for OSRM Route Tracing
      const routeWaypoints: Array<[number, number]> = [];

      if (userLocation) {
        routeWaypoints.push([userLocation.lng, userLocation.lat]);
      }

      displayClients.forEach((c) => {
        if (c.latitud && c.longitud) {
          routeWaypoints.push([c.longitud, c.latitud]);
        }
      });

      // Fetch OSRM Route Polyline
      if (showRoutePolyline && routeWaypoints.length >= 2) {
        setLoadingRoute(true);
        const osrmString = routeWaypoints.map((pt) => `${pt[0]},${pt[1]}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmString}?overview=full&geometries=geojson`;

        fetch(osrmUrl)
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted || !mapInstanceRef.current) return;
            if (data?.routes?.[0]?.geometry?.coordinates) {
              const routeCoords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
              
              if (polylineRef.current) polylineRef.current.remove();

              polylineRef.current = L.polyline(routeCoords as any, {
                color: '#4f46e5', // Indigo-600
                weight: 5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
              }).addTo(mapInstanceRef.current);

              if (data.routes[0].distance) {
                setOsrmDistanceKm(Math.round((data.routes[0].distance / 1000) * 10) / 10);
              }
              if (data.routes[0].duration) {
                setOsrmDurationMin(Math.round(data.routes[0].duration / 60));
              }
            } else {
              throw new Error('OSRM geometry empty');
            }
          })
          .catch(() => {
            // Fallback straight-line polyline if OSRM fails
            if (!isMounted || !mapInstanceRef.current) return;
            const fallbackCoords = routeWaypoints.map((pt) => [pt[1], pt[0]]);
            if (polylineRef.current) polylineRef.current.remove();
            polylineRef.current = L.polyline(fallbackCoords as any, {
              color: '#6366f1',
              weight: 4,
              opacity: 0.7,
              dashArray: '8, 8',
            }).addTo(mapInstanceRef.current);
          })
          .finally(() => {
            if (isMounted) setLoadingRoute(false);
          });
      }

      // Render Custom Markers according to status
      displayClients.forEach((cliente) => {
        // Determine status: 'pendiente' | 'en_camino' | 'cobrado' | 'fallido'
        const customStatus = estadosClientes[cliente.id] || 'pendiente';

        let colorHex = '#2563eb'; // Pendiente: Azul
        let badgeIcon = '📍';
        let statusText = 'Pendiente';
        let isAnimated = false;

        if (customStatus === 'cobrado') {
          colorHex = '#10b981'; // Cobrado: Verde
          badgeIcon = '✓';
          statusText = 'Cobrado';
        } else if (customStatus === 'en_camino') {
          colorHex = '#f59e0b'; // En camino: Amarillo/Ámbar
          badgeIcon = '🚚';
          statusText = 'En Camino';
          isAnimated = true;
        } else if (customStatus === 'fallido') {
          colorHex = '#ef4444'; // Fallido: Rojo
          badgeIcon = '✕';
          statusText = 'No Cobrado';
        } else if (customStatus === 'reagendado') {
          colorHex = '#64748b'; // Reagendado: Gris
          badgeIcon = '🕒';
          statusText = 'Reagendado';
        } else {
          // Check morosidad fallback if pending
          if (cliente.estadoMorosidad === 'ROJO') colorHex = '#ef4444';
          if (cliente.estadoMorosidad === 'AMARILLO') colorHex = '#eab308';
        }

        const stepNum = sequenceMap[cliente.id] || '';

        const markerHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
            ${isAnimated ? `<div style="position: absolute; width: 38px; height: 38px; background-color: ${colorHex}; opacity: 0.4; border-radius: 50%; animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
            <div style="
              background: linear-gradient(135deg, ${colorHex}, #0f172a);
              width: 30px;
              height: 30px;
              border-radius: 50%;
              border: 2.5px solid white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.45);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 900;
              font-size: 11px;
              z-index: 5;
            ">
              ${stepNum ? `#${stepNum}` : badgeIcon}
            </div>
          </div>
        `;

        const customDivIcon = L.divIcon({
          className: 'leaflet-custom-route-marker',
          html: markerHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([cliente.latitud, cliente.longitud], { icon: customDivIcon }).addTo(map);

        const popupHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; color: #0f172a; min-width: 190px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 900; background-color: ${colorHex}; color: white; padding: 2px 6px; border-radius: 10px;">
                ${statusText} ${stepNum ? `(#${stepNum})` : ''}
              </span>
              <span style="font-size: 10px; font-weight: bold; color: #64748b;">Folio: ${cliente.folio}</span>
            </div>
            <strong style="font-size: 13px; color: #0f172a; display: block; line-height: 1.2;">${cliente.nombreCompleto}</strong>
            <span style="font-size: 11px; color: #475569; display: block; margin-top: 2px;">${cliente.direccion}</span>
            ${cliente.referencias ? `<span style="font-size: 10px; color: #64748b; display: block; margin-top: 2px; font-style: italic;">Ref: ${cliente.referencias}</span>` : ''}
            <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
              ${cliente.telefono ? `<a href="tel:${cliente.telefono}" style="font-size: 11px; font-weight: 800; background-color: #22c55e; color: white; padding: 4px 8px; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">📞 Llamar</a>` : ''}
              <button id="select-btn-${cliente.id}" style="font-size: 11px; font-weight: 800; background-color: #4f46e5; color: white; padding: 4px 8px; border-radius: 6px; border: none; cursor: pointer;">
                Gestionar ➔
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml);

        marker.on('click', () => {
          if (onSelectCliente) {
            onSelectCliente(cliente);
          }
        });

        // Add event listener inside popup button if opened
        marker.on('popupopen', () => {
          const btn = document.getElementById(`select-btn-${cliente.id}`);
          if (btn) {
            btn.onclick = () => {
              if (onSelectCliente) onSelectCliente(cliente);
            };
          }
        });

        markersRef.current[cliente.id] = marker;
      });

      // Fit bounds to cover all points
      const allPoints: Array<[number, number]> = [];
      if (userLocation) allPoints.push([userLocation.lat, userLocation.lng]);
      displayClients.forEach((c) => {
        if (c.latitud && c.longitud) allPoints.push([c.latitud, c.longitud]);
      });

      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [displayClients, sequenceMap, estadosClientes, userLocation, showRoutePolyline, onSelectCliente]);

  // Handle selected client highlight / pan
  useEffect(() => {
    if (clienteSeleccionadoId && markersRef.current[clienteSeleccionadoId] && mapInstanceRef.current) {
      const selected = displayClients.find((c) => c.id === clienteSeleccionadoId);
      if (selected) {
        mapInstanceRef.current.setView([selected.latitud, selected.longitud], 16, { animate: true });
        markersRef.current[clienteSeleccionadoId].openPopup();
      }
    }
  }, [clienteSeleccionadoId, displayClients]);

  return (
    <div
      style={{ height }}
      className={`w-full rounded-2xl overflow-hidden shadow-xl border border-slate-800 relative z-0 ${className}`}
    >
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Route Info Badge Overlay */}
      {showRoutePolyline && (osrmDistanceKm !== null || loadingRoute) && (
        <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md border border-indigo-500/60 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold text-white pointer-events-auto">
          {loadingRoute ? (
            <span className="flex items-center gap-1.5 text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              Calculando ruta OSRM...
            </span>
          ) : (
            <>
              <span className="text-emerald-400">🛣️ Ruta OSRM:</span>
              <span>{osrmDistanceKm} km</span>
              {osrmDurationMin !== null && <span className="text-slate-400">({osrmDurationMin} min)</span>}
            </>
          )}
        </div>
      )}

      {/* Floating GPS Location & Street Centering Controls */}
      <div className="absolute bottom-3 right-3 z-[400] flex flex-col sm:flex-row items-end sm:items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleCenterOnUserLocation}
          disabled={isLocating}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold px-3 py-2 rounded-xl text-xs flex items-center gap-2 shadow-2xl border border-indigo-300 cursor-pointer transition transform active:scale-95"
          title="Tomar mi ubicación GPS actual y centrar el mapa a nivel de calle"
        >
          <LocateFixed className={`w-4 h-4 text-cyan-300 ${isLocating ? 'animate-spin' : 'animate-pulse'}`} />
          <span>{isLocating ? 'Buscando GPS...' : '📍 Mi Ubicación (Calles)'}</span>
        </button>

        <button
          type="button"
          onClick={handleFitAllStops}
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xl border border-slate-700 cursor-pointer transition transform active:scale-95"
          title="Ver todas las paradas en pantalla sin salirse"
        >
          <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
          <span>🗺️ Toda la Ruta</span>
        </button>
      </div>
    </div>
  );
}
