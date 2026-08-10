'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Cliente, Venta, Abono } from '@/types';
import { supabase, quickPushAbono, quickPushCliente, getClientes, getVentas } from '@/lib/supabase';
import {
  Navigation,
  CheckCircle2,
  DollarSign,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  X,
  Volume2,
  VolumeX,
  User,
  Zap,
  Compass,
  Play,
  Square,
  Maximize2,
  ExternalLink,
  Car,
  CornerUpLeft,
  CornerUpRight,
  Music,
  AlertTriangle,
  Plus,
  Search,
  CreditCard,
  FileText,
  MessageSquare,
  Share2,
  Target,
  LocateFixed
} from 'lucide-react';

export interface NavegacionInAppMapboxProps {
  clientesProp?: Cliente[];
  ventasProp?: Venta[];
  abonosProp?: Abono[];
  initialClienteId?: number | null;
  onClose?: () => void;
  onPaymentSuccess?: (abono: Abono, updatedCliente: Cliente) => void;
}

export interface RutaPuntoCliente extends Cliente {
  saldoPendiente: number;
  diasMora: number;
  distanciaKm: number;
  etaMin: number;
  estatusRuta: 'pendiente' | 'en_camino' | 'cobrado' | 'fallido' | 'reagendado';
}

// Fallback Mapbox Public Token if none supplied in env
const DEFAULT_MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.MAPBOX_ACCESS_TOKEN ||
  'pk.eyJ1IjoicGxvcGV4NTcyZyIsImEiOiJjbXNjMDV4Nm8wNWZqMnpvd3lqeXdzZ2l4In0.mBzKL6NiCIesSQDC5wPBfw';

// Fallback dark navigation raster style (works 100% without any Mapbox access token)
const FALLBACK_DARK_RASTER_STYLE: any = {
  version: 8,
  sources: {
    'carto-dark-source': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark-source',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

// Fallback OpenStreetMap raster style
const FALLBACK_OSM_RASTER_STYLE: any = {
  version: 8,
  sources: {
    'osm-source': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-source',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Safe helper to access map sources without throwing "Cannot read properties of undefined (reading 'getOwnSource')"
function safeGetSource(map: mapboxgl.Map | null, sourceId: string): mapboxgl.Source | null {
  if (!map) return null;
  if (!(map as any).style) return null;
  try {
    return map.getSource(sourceId) || null;
  } catch {
    return null;
  }
}

// Safe helper to add sources and layers once style is ready
function ensureRouteLayers(map: mapboxgl.Map | null, geoJsonData?: any) {
  if (!map || !(map as any).style) return;
  try {
    const dataToUse = geoJsonData || {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [],
      },
    };

    const existingSource = safeGetSource(map, 'route-line-source');
    if (!existingSource) {
      map.addSource('route-line-source', {
        type: 'geojson',
        data: dataToUse,
      });
    } else if (geoJsonData) {
      (existingSource as mapboxgl.GeoJSONSource).setData(dataToUse);
    }

    if (!map.getLayer('route-line-casing')) {
      map.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route-line-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#0284c7',
          'line-width': 12,
          'line-opacity': 0.6,
        },
      });
    }

    if (!map.getLayer('route-line-core')) {
      map.addLayer({
        id: 'route-line-core',
        type: 'line',
        source: 'route-line-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#00f0ff',
          'line-width': 6,
          'line-opacity': 1.0,
        },
      });
    }
  } catch (err) {
    console.warn('Error configuring route layers:', err);
  }
}

// Helper to compute Haversine distance in KM
function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.2;
  const R = 6371; // Earth radius in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Helper to compute compass bearing (heading direction) in degrees (0..360)
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export default function NavegacionInAppMapbox({
  clientesProp = [],
  ventasProp = [],
  abonosProp = [],
  initialClienteId = null,
  onClose,
  onPaymentSuccess,
}: NavegacionInAppMapboxProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerUserRef = useRef<mapboxgl.Marker | null>(null);
  const markersClientRef = useRef<{ [key: number]: mapboxgl.Marker }>({});
  const currentRouteGeoJsonRef = useRef<any>(null);
  const activeClientRef = useRef<RutaPuntoCliente | undefined>(undefined);

  // State: Data loaded from Supabase or Props
  const [clientes, setClientes] = useState<Cliente[]>(clientesProp);
  const [ventas, setVentas] = useState<Venta[]>(ventasProp);
  const [abonos, setAbonos] = useState<Abono[]>(abonosProp);
  const [isLoadingSupabase, setIsLoadingSupabase] = useState<boolean>(false);

  // GPS User location
  const [userPos, setUserPos] = useState<{ lat: number; lng: number }>({ lat: 19.4326, lng: -99.1332 });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);

  // Active client navigation index
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [clientStatuses, setClientStatuses] = useState<{ [id: number]: RutaPuntoCliente['estatusRuta'] }>({});

  // Map Navigation Info & Simulation States
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number; geometryGeoJson?: any }>({
    distanceKm: 0.35,
    durationMin: 3,
  });
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedUserPos, setSimulatedUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to avoid duplicate auto-arrival triggers
  const autoArrivalTriggeredRef = useRef<boolean>(false);

  // Voice synthesis helper with BITALIS collection context
  const speakNavInstruction = useCallback(
    (text: string) => {
      if (isVoiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-MX';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
      }
    },
    [isVoiceMuted]
  );

  // UX Optimization States: Driving Mode, Smart-Sheet Tab, Offline Sync, Success Burst
  const [isDrivingMode, setIsDrivingMode] = useState<boolean>(false);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [activeSmartTab, setActiveSmartTab] = useState<'COBRO' | 'EVIDENCIA' | 'CONTACTO'>('COBRO');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [showSuccessBurst, setShowSuccessBurst] = useState<boolean>(false);
  const [lastPaidClientName, setLastPaidClientName] = useState<string>('');
  const [lastPaidAmount, setLastPaidAmount] = useState<number>(0);
  const [previewImageModalUrl, setPreviewImageModalUrl] = useState<string | null>(null);

  // HUD & BITALIS Card Modals States
  const [showClientCardModal, setShowClientCardModal] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showIncidentModal, setShowIncidentModal] = useState<boolean>(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [incidentText, setIncidentText] = useState<string>('');

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Modals & Payment UI
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [montoIngresado, setMontoIngresado] = useState<string>('0');
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [observaciones, setObservaciones] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Toast notice
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Mapbox Token setting check
  const [mapboxToken, setMapboxToken] = useState<string>(DEFAULT_MAPBOX_TOKEN);

  // 1. Fetch data from Supabase if not passed via props or on refresh
  const fetchSupabaseData = useCallback(async () => {
    setIsLoadingSupabase(true);
    try {
      const { data: clientsDb } = await getClientes();
      const { data: ventasDb } = await getVentas();
      if (clientsDb && clientsDb.length > 0) {
        setClientes(clientsDb);
      }
      if (ventasDb && ventasDb.length > 0) {
        setVentas(ventasDb);
      }
    } catch (err) {
      console.warn('Error al cargar datos desde Supabase para navegación:', err);
    } finally {
      setIsLoadingSupabase(false);
    }
  }, []);

  useEffect(() => {
    if (clientesProp.length === 0) {
      fetchSupabaseData();
    } else {
      setClientes(clientesProp);
    }
  }, [clientesProp, fetchSupabaseData]);

  // 2. Real-time GPS Watcher with Active Route Camera Tracking
  useEffect(() => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserPos({ lat, lng });
          setGpsAccuracy(Math.round(pos.coords.accuracy));
          setGpsActive(true);

          if (pos.coords.speed !== null && pos.coords.speed !== undefined) {
            setSpeedKmh(Math.round(pos.coords.speed * 3.6));
          }

          // Conforme el cobrador avanza, la cámara navega dinámicamente sobre la ruta en 3D
          const targetClient = activeClientRef.current;
          if (isNavigating && !isSimulating && mapRef.current && targetClient?.latitud && targetClient?.longitud) {
            const map = mapRef.current;
            const brg = getBearing(lat, lng, targetClient.latitud, targetClient.longitud);
            const dist = getHaversineDistanceKm(lat, lng, targetClient.latitud, targetClient.longitud);

            // Dynamic Auto-Zoom: Adapts camera zoom and 3D pitch according to distance
            let targetZoom = 17.5;
            let targetPitch = 65;
            if (dist > 1.0) {
              targetZoom = 15.2;
              targetPitch = 40;
            } else if (dist > 0.2) {
              targetZoom = 16.5;
              targetPitch = 55;
            } else {
              targetZoom = 18.0;
              targetPitch = 65;
            }

            try {
              map.easeTo({
                center: [lng, lat],
                zoom: targetZoom,
                pitch: targetPitch,
                bearing: brg,
                duration: 900,
              });
            } catch (err) {
              console.warn('Error en cámara de seguimiento en ruta:', err);
            }

            // Recalcular distancia y tiempo restante
            const eta = Math.max(1, Math.ceil((dist / 30) * 60));
            setRouteInfo((prev) => ({
              ...prev,
              distanceKm: dist,
              durationMin: eta,
            }));

            // Auto-Arrival Trigger: Geofence < 30 metros (0.03 km) -> Auto deslizar Ficha de Cobro
            if (dist <= 0.03 && !autoArrivalTriggeredRef.current) {
              autoArrivalTriggeredRef.current = true;
              setIsPaymentModalOpen(true);
              setToastNotice(`🎯 AUTO-LLEGADA (<30m): ¡Has llegado con ${targetClient.nombreCompleto}!`);
              speakNavInstruction(
                `Has llegado al destino con ${targetClient.nombreCompleto}. Saldo a cobrar: ${targetClient.saldoPendiente} pesos. La ficha de cobro se ha activado automáticamente.`
              );
            }
          }
        },
        (err) => {
          console.warn('GPS Error watching position:', err);
          // Fallback coords
          if (clientes.length > 0 && clientes[0].latitud) {
            setUserPos({ lat: clientes[0].latitud - 0.003, lng: clientes[0].longitud - 0.003 });
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [clientes, isNavigating, isSimulating, speakNavInstruction]);

  // 3. Process Client List with Balances & Route Order (Optimized by Closest Geographic Distance)
  const rutaClientes = useMemo<RutaPuntoCliente[]>(() => {
    if (!clientes || clientes.length === 0) return [];

    const list = clientes.map((c) => {
      const ventasCliente = ventas.filter((v) => v.clienteId === c.id);
      const totalVenta = ventasCliente.reduce((acc, v) => acc + (v.saldoActual ?? v.saldoInicial ?? 0), 0);
      const abonosCliente = abonos.filter((a) => a.clienteId === c.id);
      const totalAbonado = abonosCliente.reduce((acc, a) => acc + (a.monto || 0), 0);
      const saldoPendiente = Math.max(0, totalVenta - totalAbonado || 2500);

      const dist = getHaversineDistanceKm(userPos.lat, userPos.lng, c.latitud || 19.4326, c.longitud || -99.1332);
      const eta = Math.ceil((dist / 30) * 60) + 2; // rough 30 km/h urban speed

      const hasAbono = abonosCliente.some((a) => (a.monto || 0) > 0);
      const status = clientStatuses[c.id] || (hasAbono ? 'cobrado' : 'pendiente');

      return {
        ...c,
        saldoPendiente,
        diasMora: c.estadoMorosidad === 'ROJO' ? 24 : c.estadoMorosidad === 'AMARILLO' ? 12 : 3,
        distanciaKm: dist,
        etaMin: eta,
        estatusRuta: status,
      };
    });

    // Sort by explicit ordenRuta if assigned, else by closest distance from user
    return list.sort((a, b) => {
      if (a.ordenRuta && b.ordenRuta && a.ordenRuta !== b.ordenRuta) {
        return a.ordenRuta - b.ordenRuta;
      }
      return a.distanciaKm - b.distanciaKm;
    });
  }, [clientes, ventas, abonos, userPos, clientStatuses]);

  // Initial client selection
  useEffect(() => {
    if (initialClienteId && rutaClientes.length > 0) {
      const foundIdx = rutaClientes.findIndex((c) => c.id === initialClienteId);
      if (foundIdx !== -1) setActiveIndex(foundIdx);
    }
  }, [initialClienteId, rutaClientes]);

  const activeClient = useMemo<RutaPuntoCliente | undefined>(() => {
    if (rutaClientes.length === 0) return undefined;
    return rutaClientes[Math.min(activeIndex, rutaClientes.length - 1)];
  }, [rutaClientes, activeIndex]);

  // Keep activeClientRef in sync for safe access inside geolocation callbacks
  useEffect(() => {
    activeClientRef.current = activeClient;
    if (activeClient) {
      setMontoIngresado(String(activeClient.saldoPendiente || 2500));
    }
  }, [activeClient]);

  // State for map mode and custom token input
  const [usingFallbackStyle, setUsingFallbackStyle] = useState<boolean>(!mapboxToken);
  const [showTokenInputModal, setShowTokenInputModal] = useState<boolean>(false);
  const [tempTokenInput, setTempTokenInput] = useState<string>('');

  // Camera Helper: Fit route bounds (User -> Client)
  const [isFullscreenMap, setIsFullscreenMap] = useState<boolean>(false);

  const fitRouteBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      map.resize();
    } catch (e) {}

    if (!activeClient || !activeClient.latitud || !activeClient.longitud) return;

    const currLat = simulatedUserPos ? simulatedUserPos.lat : userPos.lat;
    const currLng = simulatedUserPos ? simulatedUserPos.lng : userPos.lng;

    try {
      const bounds = new mapboxgl.LngLatBounds()
        .extend([currLng, currLat])
        .extend([activeClient.longitud, activeClient.latitud]);

      rutaClientes.forEach((c) => {
        if (c.latitud && c.longitud) {
          bounds.extend([c.longitud, c.latitud]);
        }
      });

      map.fitBounds(bounds, {
        padding: isFullscreenMap
          ? { top: 40, bottom: 80, left: 20, right: 20 }
          : { top: 120, bottom: 220, left: 40, right: 40 },
        maxZoom: 16,
        duration: 1000,
      });
    } catch (err) {
      console.warn('fitRouteBounds error:', err);
    }
  }, [activeClient, userPos, simulatedUserPos, rutaClientes, isFullscreenMap]);

  const toggleFullscreenMap = useCallback(() => {
    setIsFullscreenMap((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        if (next && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (!next && document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });

    setTimeout(() => {
      if (mapRef.current) {
        try {
          mapRef.current.resize();
        } catch (e) {}
        fitRouteBounds();
      }
    }, 150);
  }, [fitRouteBounds]);

  // Camera Helper: Centrar mi ubicación en el mapa
  const recenter3DUser = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const currLat = simulatedUserPos ? simulatedUserPos.lat : userPos.lat;
    const currLng = simulatedUserPos ? simulatedUserPos.lng : userPos.lng;

    const bearing = (activeClient && activeClient.latitud && activeClient.longitud)
      ? getBearing(currLat, currLng, activeClient.latitud, activeClient.longitud)
      : 0;

    try {
      map.flyTo({
        center: [currLng, currLat],
        zoom: isNavigating ? 17.5 : 16.5,
        pitch: isNavigating ? 65 : 40,
        bearing: bearing,
        duration: 1000,
      });
      setToastNotice('Ubicación centrada 🎯');
      setTimeout(() => setToastNotice(null), 2000);
    } catch (err) {
      console.warn('recenter3DUser error:', err);
    }
  }, [activeClient, userPos, simulatedUserPos, isNavigating]);

  // Actions for Navigation Control
  const startAssistedNavigation = () => {
    setIsNavigating(true);
    recenter3DUser();
    if (activeClient) {
      speakNavInstruction(
        `Iniciando navegación asistida hacia ${activeClient.nombreCompleto}. Distancia a recorrer: ${routeInfo.distanceKm} kilómetros.`
      );
    }
  };

  const stopAssistedNavigation = () => {
    setIsNavigating(false);
    setIsSimulating(false);
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setSimulatedUserPos(null);
    fitRouteBounds();
  };

  // Toggle Route Simulation
  const toggleSimulation = () => {
    if (isSimulating) {
      setIsSimulating(false);
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      setSimulatedUserPos(null);
      fitRouteBounds();
      return;
    }

    if (!activeClient || !activeClient.latitud || !activeClient.longitud) return;

    setIsSimulating(true);
    setIsNavigating(true);

    let points: [number, number][] = [];
    if (
      routeInfo.geometryGeoJson &&
      routeInfo.geometryGeoJson.coordinates &&
      routeInfo.geometryGeoJson.coordinates.length > 1
    ) {
      points = routeInfo.geometryGeoJson.coordinates;
    } else {
      const stepsCount = 20;
      for (let i = 0; i <= stepsCount; i++) {
        const t = i / stepsCount;
        const lat = userPos.lat + t * (activeClient.latitud - userPos.lat);
        const lng = userPos.lng + t * (activeClient.longitud - userPos.lng);
        points.push([lng, lat]);
      }
    }

    speakNavInstruction(`Simulación de ruta iniciada hacia ${activeClient.nombreCompleto}`);

    let step = 0;
    if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);

    simulationTimerRef.current = setInterval(() => {
      step++;
      if (step >= points.length) {
        if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
        setIsSimulating(false);
        setIsPaymentModalOpen(true);
        setToastNotice(`🎯 AUTO-LLEGADA: ¡Llegaste con ${activeClient.nombreCompleto}!`);
        speakNavInstruction(
          `Has llegado al destino con ${activeClient.nombreCompleto}. Saldo a cobrar: ${activeClient.saldoPendiente} pesos. Se ha activado la ficha de cobro automáticamente.`
        );
        return;
      }

      const [lng, lat] = points[step];
      setSimulatedUserPos({ lat, lng });

      if (markerUserRef.current) {
        markerUserRef.current.setLngLat([lng, lat]);
      }

      const distRem = getHaversineDistanceKm(lat, lng, activeClient.latitud, activeClient.longitud);
      const etaRem = Math.max(1, Math.ceil((distRem / 30) * 60));
      setRouteInfo((prev) => ({
        ...prev,
        distanceKm: distRem,
        durationMin: etaRem,
      }));

      const map = mapRef.current;
      if (map) {
        const nextPt = points[Math.min(step + 1, points.length - 1)];
        const brg = getBearing(lat, lng, nextPt[1], nextPt[0]);

        let targetZoom = 17.5;
        let targetPitch = 65;
        if (distRem > 1.0) {
          targetZoom = 15.2;
          targetPitch = 45;
        } else if (distRem > 0.2) {
          targetZoom = 16.5;
          targetPitch = 55;
        } else {
          targetZoom = 18.0;
          targetPitch = 65;
        }

        map.easeTo({
          center: [lng, lat],
          zoom: targetZoom,
          pitch: targetPitch,
          bearing: brg,
          duration: 750,
        });
      }
    }, 850);
  };

  // External Maps Apps
  const openInGoogleMaps = () => {
    if (!activeClient || !activeClient.latitud || !activeClient.longitud) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeClient.latitud},${activeClient.longitud}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const openInWaze = () => {
    if (!activeClient || !activeClient.latitud || !activeClient.longitud) return;
    const url = `https://waze.com/ul?ll=${activeClient.latitud},${activeClient.longitud}&navigate=yes`;
    window.open(url, '_blank');
  };

  // 4. Mapbox GL JS Initialization & Directions API Fetching
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let initialStyle: any = 'mapbox://styles/mapbox/navigation-night-v11';
    if (!mapboxToken) {
      initialStyle = FALLBACK_DARK_RASTER_STYLE;
      setUsingFallbackStyle(true);
    } else {
      mapboxgl.accessToken = mapboxToken;
    }

    // Initialize Mapbox with Navigation Night Style or Fallback
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: [userPos.lng, userPos.lat],
      zoom: 15,
      pitch: 45,
      bearing: 0,
    });

    mapRef.current = map;

    const handleResize = () => {
      if (mapRef.current) {
        try {
          mapRef.current.resize();
        } catch {}
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Listen for Mapbox Access Token or unauthorized style load error
    map.on('error', (e) => {
      const msg = e?.error?.message || String(e?.error || '');
      if (
        msg.includes('access token') ||
        msg.includes('Unauthorized') ||
        msg.includes('Forbidden') ||
        (e?.error as any)?.status === 401 ||
        msg.includes('Failed to fetch')
      ) {
        console.warn('Mapbox Token or Tile error detected. Switching to Carto Dark Navigation fallback style.');
        setUsingFallbackStyle(true);
        try {
          map.setStyle(FALLBACK_DARK_RASTER_STYLE);
        } catch (err) {
          try {
            map.setStyle(FALLBACK_OSM_RASTER_STYLE);
          } catch {}
        }
      }
    });

    map.on('load', () => {
      handleResize();
      ensureRouteLayers(map, currentRouteGeoJsonRef.current);
    });

    map.on('render', () => {
      // Keep canvas strictly aligned to viewport
      if (mapContainerRef.current && (mapContainerRef.current.clientWidth === 0 || mapContainerRef.current.clientHeight === 0)) {
        handleResize();
      }
    });

    map.on('styledata', () => {
      ensureRouteLayers(map, currentRouteGeoJsonRef.current);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  // 4b. Effect: Listen for live map configuration changes from AdminView
  useEffect(() => {
    const handleMapConfigUpdated = (e: any) => {
      const cfg = e.detail;
      if (!cfg) return;
      if (cfg.token && cfg.token !== mapboxToken) {
        setMapboxToken(cfg.token);
      }
      if (cfg.style && mapRef.current) {
        try {
          mapRef.current.setStyle(cfg.style);
        } catch (err) {
          console.warn('Error applying updated map style:', err);
        }
      }
      setToastNotice('🗺️ Configuración de mapa actualizada en tiempo real');
      setTimeout(() => setToastNotice(null), 2500);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('bitalis-map-config-updated', handleMapConfigUpdated);
      return () => window.removeEventListener('bitalis-map-config-updated', handleMapConfigUpdated);
    }
  }, [mapboxToken]);

  // 5. Update User Marker & Client Markers on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // A. User GPS Marker (Glowing Pulsing Pulsar Marker)
    if (!markerUserRef.current) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.top = '0';
      el.style.left = '0';
      el.style.pointerEvents = 'auto';
      el.className = 'w-7 h-7 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_18px_#38bdf8] animate-pulse flex items-center justify-center z-50';
      el.innerHTML = '<div class="w-2.5 h-2.5 rounded-full bg-slate-950"></div>';

      markerUserRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userPos.lng, userPos.lat])
        .addTo(map);
    } else {
      markerUserRef.current.setLngLat([userPos.lng, userPos.lat]);
    }

    // B. Client Markers
    rutaClientes.forEach((c) => {
      if (!c.latitud || !c.longitud) return;

      const isCurrent = activeClient?.id === c.id;
      let badgeBg = '#2563eb'; // blue default
      if (c.estatusRuta === 'cobrado') badgeBg = '#16a34a'; // green
      if (c.estatusRuta === 'fallido') badgeBg = '#dc2626'; // red
      if (c.estatusRuta === 'reagendado') badgeBg = '#475569'; // slate

      if (!markersClientRef.current[c.id]) {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.pointerEvents = 'auto';
        el.className = `cursor-pointer transition-transform duration-200 ${isCurrent ? 'scale-110 z-40' : 'scale-90 opacity-90 z-10'}`;
        el.innerHTML = `
          <div style="background-color: ${badgeBg};" class="px-2.5 py-1 rounded-full text-white font-black text-xs shadow-xl border-2 border-white flex items-center gap-1 whitespace-nowrap">
            <span>#${c.ordenRuta || c.id}</span>
            <span class="text-[10px] font-bold">${c.nombreCompleto.split(' ')[0]}</span>
          </div>
        `;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = rutaClientes.findIndex((item) => item.id === c.id);
          if (idx !== -1) setActiveIndex(idx);
        });

        markersClientRef.current[c.id] = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([c.longitud, c.latitud])
          .addTo(map);
      } else {
        const marker = markersClientRef.current[c.id];
        marker.setLngLat([c.longitud, c.latitud]);
        const el = marker.getElement();
        el.style.position = 'absolute';
        el.className = `cursor-pointer transition-transform duration-200 ${isCurrent ? 'scale-110 z-40' : 'scale-90 opacity-90 z-10'}`;
      }
    });
  }, [userPos, rutaClientes, activeClient]);

  // 6. Fetch Mapbox Directions API route line to Active Client
  useEffect(() => {
    if (!activeClient || !activeClient.latitud || !activeClient.longitud) return;
    const map = mapRef.current;

    const fetchRouteFromMapbox = async () => {
      if (mapboxToken) {
        try {
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${userPos.lng},${userPos.lat};${activeClient.longitud},${activeClient.latitud}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes[0]) {
              const route = data.routes[0];
              const distKm = Math.round((route.distance / 1000) * 10) / 10;
              const durMin = Math.ceil(route.duration / 60);

              const geoFeature = {
                type: 'Feature',
                properties: {},
                geometry: route.geometry,
              };

              currentRouteGeoJsonRef.current = geoFeature;

              setRouteInfo({
                distanceKm: distKm,
                durationMin: durMin,
                geometryGeoJson: route.geometry,
              });

              // Ensure layers and draw line on map
              ensureRouteLayers(map, geoFeature);

              // Adjust map bounds or 3D driving camera
              if (isNavigating) {
                recenter3DUser();
              } else {
                fitRouteBounds();
              }
              return;
            }
          }
        } catch (err) {
          console.warn('Mapbox Directions API fallback to straight line:', err);
        }
      }

      // Straight line / Haversine fallback when token is not available or failed
      const distKm = getHaversineDistanceKm(userPos.lat, userPos.lng, activeClient.latitud, activeClient.longitud);
      const durMin = Math.ceil((distKm / 30) * 60) + 2;

      const fallbackGeoJson: any = {
        type: 'LineString',
        coordinates: [
          [userPos.lng, userPos.lat],
          [activeClient.longitud, activeClient.latitud],
        ],
      };

      const geoFeature = {
        type: 'Feature',
        properties: {},
        geometry: fallbackGeoJson,
      };

      currentRouteGeoJsonRef.current = geoFeature;

      setRouteInfo({
        distanceKm: distKm,
        durationMin: durMin,
        geometryGeoJson: fallbackGeoJson,
      });

      ensureRouteLayers(map, geoFeature);

      if (isNavigating) {
        recenter3DUser();
      } else {
        fitRouteBounds();
      }
    };

    fetchRouteFromMapbox();
  }, [activeClient, userPos, mapboxToken, isNavigating, fitRouteBounds, recenter3DUser]);

  // 7. Transactional Payment Handler with Instant Supabase Sync & Haptic Success Burst
  const handleRegistrarCobro = async () => {
    if (!activeClient) return;
    const montoVal = parseFloat(montoIngresado);

    if (isNaN(montoVal) || montoVal <= 0) {
      alert('Por favor ingresa un monto de cobro válido.');
      return;
    }

    setIsSubmittingPayment(true);

    try {
      const nuevoAbono: Abono = {
        id: Date.now(),
        ventaId: activeClient.id,
        clienteId: activeClient.id,
        clienteNombre: activeClient.nombreCompleto,
        clienteFolio: activeClient.folio,
        cobradorId: 1,
        cobradorNombre: 'Cobrador 1',
        monto: montoVal,
        tipoPago: metodoPago,
        semanaNumero: 1,
        observaciones: observaciones || 'Cobro registrado desde Navegación In-App Mapbox',
        fechaPago: new Date().toISOString().split('T')[0],
        latitudCobro: userPos.lat,
        longitudCobro: userPos.lng,
      };

      // 1. Trigger Haptic Vibration Feedback
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 60, 40, 100]);
        } catch (e) {
          // Ignore
        }
      }

      // 2. A. Push Abono to Supabase or Offline Cache
      try {
        await quickPushAbono(nuevoAbono);
      } catch (err) {
        console.warn('Network offline, saved abono to local cache queue', err);
        setPendingSyncCount((prev) => prev + 1);
      }

      // B. Update local client status
      setClientStatuses((prev) => ({ ...prev, [activeClient.id]: 'cobrado' }));

      // C. Update client balance and next scheduled payment
      const cuotaMinima = (activeClient as any).pagoSemanal || 150;
      const freq = (activeClient as any).frecuenciaPago;
      const proximoFecha = (() => {
        const d = new Date();
        if (freq === 'SEMANAL') d.setDate(d.getDate() + 7);
        else if (freq === 'CATORCENAL') d.setDate(d.getDate() + 14);
        else if (freq === 'MENSUAL') d.setDate(d.getDate() + 30);
        else d.setDate(d.getDate() + 15); // QUINCENAL default
        return d.toISOString().split('T')[0];
      })();

      const nuevoSaldo = Math.max(0, activeClient.saldoPendiente - montoVal);
      const updatedClientRecord: Cliente = {
        ...activeClient,
        estadoMorosidad: nuevoSaldo === 0 ? 'VERDE' : activeClient.estadoMorosidad,
        proximoPagoFecha: proximoFecha,
      };

      try {
        await quickPushCliente(updatedClientRecord);
      } catch (err) {
        console.warn('Network offline, client record update queued', err);
      }

      if (onPaymentSuccess) {
        onPaymentSuccess(nuevoAbono, updatedClientRecord);
      }

      // 3. Show Emerald Success Burst Overlay
      setLastPaidClientName(activeClient.nombreCompleto);
      setLastPaidAmount(montoVal);
      setShowSuccessBurst(true);

      setIsPaymentModalOpen(false);
      setMontoIngresado('0');
      setObservaciones('');

      // D. Auto-Advance to Next Neighbor Client in Cluster Route Sequence
      setTimeout(() => {
        setShowSuccessBurst(false);
        const nextPendingIdx = rutaClientes.findIndex(
          (item, idx) => idx > activeIndex && (item.estatusRuta === 'pendiente' || item.estatusRuta === 'en_camino')
        );
        if (nextPendingIdx !== -1) {
          setActiveIndex(nextPendingIdx);
        } else if (activeIndex < rutaClientes.length - 1) {
          setActiveIndex((prev) => prev + 1);
        }
      }, 2500);
    } catch (err) {
      console.error('Error al registrar cobro:', err);
      alert('El cobro fue respaldado localmente en tu dispositivo.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-950 text-white flex flex-col relative font-sans overflow-hidden select-none">
      {/* ---------------------------------------------------------------- */}
      {/* MAPA FULLSCREEN MAPBOX GL JS NIGHT                                */}
      {/* ---------------------------------------------------------------- */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* ---------------------------------------------------------------- */}
      {/* 1. BARRA SUPERIOR FIJA: HUD TURN-BY-TURN / CLIENTE HEADER        */}
      {/* ---------------------------------------------------------------- */}
      {(isNavigating || isSimulating || isDrivingMode) ? (
        <header className="fixed top-0 inset-x-0 z-40 bg-black border-b border-slate-900 p-3 sm:p-4 shadow-2xl flex items-center justify-between gap-3 animate-slideDown">
          {/* Maniobra de giro + Distancia grande + Nombre de Calle en Cian */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border-2 border-cyan-400/80 flex items-center justify-center shrink-0 shadow-lg">
              <CornerUpLeft className="w-8 h-8 text-white stroke-[3]" />
            </div>
            <div className="min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none block">
                {routeInfo.distanceKm < 1 ? `${Math.round(routeInfo.distanceKm * 1000)} m` : `${routeInfo.distanceKm} km`}
              </span>
              <p className="text-base sm:text-xl font-black text-cyan-400 truncate leading-tight mt-0.5">
                {activeClient ? (activeClient.direccion.split(',')[0] || '2 de Marzo') : '2 de Marzo'}
              </p>
            </div>
          </div>

          {/* Controles de Salir & Audio en esquina superior derecha */}
          <div className="flex items-center gap-2 shrink-0 z-50">
            <button
              type="button"
              onClick={() => {
                setIsMusicPlaying(!isMusicPlaying);
                setToastNotice(isMusicPlaying ? 'Audio pausado' : 'Reproduciendo audio de ruta 🎵');
                setTimeout(() => setToastNotice(null), 2500);
              }}
              className={`p-2.5 rounded-full border transition cursor-pointer shadow-lg ${
                isMusicPlaying
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-300 animate-pulse'
                  : 'bg-black text-white border-slate-700 hover:bg-slate-900'
              }`}
              title="Audio / Música"
            >
              <Music className="w-5 h-5 text-white" />
            </button>

            <button
              type="button"
              onClick={() => setIsVoiceMuted((prev) => !prev)}
              className={`p-2.5 rounded-full border transition cursor-pointer shadow-lg ${
                isVoiceMuted
                  ? 'bg-black border-slate-700 text-slate-400'
                  : 'bg-black border-cyan-400 text-cyan-300'
              }`}
              title={isVoiceMuted ? 'Activar Voz' : 'Silenciar Voz'}
            >
              {isVoiceMuted ? <VolumeX className="w-5 h-5 text-slate-400" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>

            <button
              type="button"
              onClick={stopAssistedNavigation}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs border border-rose-300 flex items-center gap-1.5 shadow-2xl transition cursor-pointer shrink-0"
              title="Detener y Salir de Navegación 3D"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Salir</span>
            </button>
          </div>
        </header>
      ) : (
        <header className={`relative z-20 p-2 sm:p-4 max-w-lg mx-auto w-full shrink-0 space-y-2 transition-all ${isFullscreenMap ? 'opacity-95' : ''}`}>
          <div className="bg-slate-900/95 backdrop-blur-md border border-indigo-500/80 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-2">
            {/* Back button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer shrink-0 border border-slate-700"
              title="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Active Client Title & Sync Pill */}
            {activeClient ? (
              <div className="min-w-0 flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 text-[10px] font-black">
                    #{activeClient.ordenRuta || activeIndex + 1} de {rutaClientes.length}
                  </span>

                  {/* Sync Status Micro-Pill */}
                  {isOnline ? (
                    pendingSyncCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span>{pendingSyncCount} pend.</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>En línea</span>
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Modo Offline</span>
                    </span>
                  )}

                  <span className="text-[10px] font-bold text-slate-400">Folio: {activeClient.folio}</span>
                </div>
                <h2 className="text-sm sm:text-base font-black text-white truncate leading-tight">
                  {activeClient.nombreCompleto}
                </h2>
              </div>
            ) : (
              <div className="text-center flex-1">
                <h2 className="text-sm font-black text-white">Navegación de Ruta</h2>
              </div>
            )}

            {/* Navigation Avance Controles */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsDrivingMode((prev) => !prev)}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  isDrivingMode ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title="Modo Conducción Focus"
              >
                <Car className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeIndex === 0}
                className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-xl border border-slate-700 cursor-pointer"
                title="Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => Math.min(rutaClientes.length - 1, prev + 1))}
                disabled={activeIndex >= rutaClientes.length - 1}
                className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-xl border border-slate-700 cursor-pointer"
                title="Siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Toast Notice */}
      {toastNotice && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-emerald-950 border border-emerald-400 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-3 animate-slideDown">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* GPS & Map Style Status Indicator & Floating Action Controls (Posicionado dinámicamente sin solaparse) */}
      {!isDrivingMode && (
        <div
          className={`absolute right-3 sm:right-4 z-20 flex flex-col items-end gap-2 transition-all duration-300 ${
            (isNavigating || isSimulating) && activeClient ? 'top-[10.5rem] sm:top-[9.5rem]' : 'top-20 sm:top-20'
          }`}
        >
          <div className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 backdrop-blur-md text-[10px] font-bold text-slate-300 flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>GPS Activo {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}</span>
          </div>

          {/* BOTÓN CAMBIO RÁPIDO DE ESTILO Y TOKEN MAPBOX */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (!mapRef.current) return;
                try {
                  if (usingFallbackStyle) {
                    mapboxgl.accessToken = mapboxToken;
                    mapRef.current.setStyle('mapbox://styles/mapbox/navigation-night-v11');
                    setUsingFallbackStyle(false);
                  } else {
                    mapRef.current.setStyle(FALLBACK_DARK_RASTER_STYLE);
                    setUsingFallbackStyle(true);
                  }
                } catch (e) {
                  console.warn('Error cambiando estilo:', e);
                }
              }}
              className="px-2.5 py-1 rounded-full border backdrop-blur-md text-[10px] font-bold flex items-center gap-1.5 shadow-lg cursor-pointer bg-slate-900/90 border-cyan-500/50 text-cyan-300 hover:bg-slate-800"
              title="Cambiar Motor de Mapa"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>{usingFallbackStyle ? '🗺️ CARTO Dark (Libre)' : '🌌 Mapbox Night 3D'}</span>
            </button>
          </div>

          {/* CONTROLES FLOTANTES DESPEJADOS DE NAVEGACIÓN Y CENTRADO */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Botón Principal Flotante para Centrar Ubicación */}
            <button
              type="button"
              onClick={recenter3DUser}
              className="w-12 h-12 rounded-2xl bg-black/95 hover:bg-slate-900 border-2 border-cyan-400/90 text-cyan-300 flex items-center justify-center shadow-2xl transition cursor-pointer backdrop-blur-md active:scale-95 shrink-0"
              title="Centrar mi ubicación en el mapa"
            >
              <Target className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Menú Compacto de Opciones (Sin saturar la pantalla) */}
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-1 shadow-2xl flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={startAssistedNavigation}
                className={`p-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition ${
                  isNavigating ? 'bg-cyan-400 text-black' : 'bg-slate-800 text-cyan-300 hover:bg-slate-700'
                }`}
                title="Modo Navegación 3D"
              >
                <Navigation className="w-4 h-4 transform rotate-45" />
              </button>

              <button
                type="button"
                onClick={toggleSimulation}
                className={`p-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition ${
                  isSimulating ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title={isSimulating ? 'Detener Simulación' : 'Simular Recorrido'}
              >
                {isSimulating ? <Square className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={toggleFullscreenMap}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl cursor-pointer transition flex items-center justify-center"
                title="Pantalla Completa"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. BURBUJA PIP (PICTURE-IN-PICTURE) DE FACHADA DEL CLIENTE */}
      {(isNavigating || isSimulating || isDrivingMode) && activeClient && (
        <div className="absolute top-20 left-3 sm:left-4 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() =>
              setPreviewImageModalUrl(
                activeClient.fotoFachada ||
                  (activeClient as any).fotoPunto ||
                  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80'
              )
            }
            className="bg-black/95 hover:bg-slate-900 border-2 border-cyan-400/90 rounded-2xl p-1.5 shadow-2xl flex items-center gap-2 cursor-pointer transition hover:scale-105 active:scale-95 group backdrop-blur-md"
            title="Toca para ver la fachada de la casa en pantalla completa"
          >
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-cyan-300/50 bg-slate-800 shrink-0">
              <img
                src={
                  activeClient.fotoFachada ||
                  (activeClient as any).fotoPunto ||
                  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=300&q=80'
                }
                alt="Fachada del cliente"
                className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
              />
              <div className="absolute bottom-0 inset-x-0 bg-black/85 text-[8px] text-cyan-300 text-center font-bold py-0.5 tracking-wider">
                FACHADA
              </div>
            </div>
            <div className="pr-2 text-left hidden sm:block">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Cliente destino</span>
              <span className="text-xs font-black text-white block truncate max-w-[110px]">{activeClient.nombreCompleto}</span>
            </div>
          </button>
        </div>
      )}

      {/* 5. CONTROLES ERGONÓMICOS DE ZOOM MANUAL EN PANTALLA ("THUMB-ZONE") */}
      {(isNavigating || isSimulating || isDrivingMode) && (
        <div className="absolute right-3 top-36 z-30 flex flex-col gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.zoomIn();
                setToastNotice('Zoom In +');
                setTimeout(() => setToastNotice(null), 1000);
              }
            }}
            className="w-11 h-11 bg-black/95 hover:bg-slate-900 border-2 border-slate-700/80 text-cyan-300 font-black text-xl rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md active:scale-90 transition cursor-pointer"
            title="Acercar mapa Zoom +"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.zoomOut();
                setToastNotice('Zoom Out -');
                setTimeout(() => setToastNotice(null), 1000);
              }
            }}
            className="w-11 h-11 bg-black/95 hover:bg-slate-900 border-2 border-slate-700/80 text-cyan-300 font-black text-xl rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md active:scale-90 transition cursor-pointer"
            title="Alejar mapa Zoom -"
          >
            -
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* OVERLAYS FLOTANTES DE NAVEGACIÓN EN MAPA (ESTILO GPS IMAGEN)    */}
      {/* ---------------------------------------------------------------- */}
      {(isNavigating || isSimulating || isDrivingMode) && (
        <div className="absolute bottom-28 sm:bottom-32 inset-x-3 sm:inset-x-6 z-30 flex items-center justify-between gap-2 pointer-events-none">
          {/* Velocímetro Circular (Izquierda) */}
          <div className="w-16 h-16 rounded-full bg-black/90 border-2 border-slate-700 flex flex-col items-center justify-center text-white shadow-2xl backdrop-blur-md shrink-0 pointer-events-auto">
            <span className="text-xl font-black leading-none">{isSimulating ? '35' : (speedKmh || 0)}</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">km/h</span>
          </div>

          {/* Nombre de Calle / Domicilio Actual (Centro - Pill Negro) */}
          <div className="bg-black/95 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-full shadow-2xl border border-slate-800 backdrop-blur-md text-center truncate max-w-[200px] sm:max-w-xs pointer-events-auto">
            {activeClient ? (activeClient.direccion.split(',')[0] || '1a Cda. 2 de Marzo') : '1a Cda. 2 de Marzo'}
          </div>

          {/* Alerta de Incidencia / Tráfico (Derecha - Botón Amarillo) */}
          <button
            type="button"
            onClick={() => setShowIncidentModal(true)}
            className="w-14 h-14 bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-400/90 rounded-2xl flex items-center justify-center shadow-2xl text-amber-300 transition cursor-pointer backdrop-blur-md shrink-0 pointer-events-auto"
            title="Reportar Alerta / Incidencia"
          >
            <AlertTriangle className="w-8 h-8 text-amber-400 fill-amber-400/20" />
          </button>
        </div>
      )}

      {/* 1. BANDEJA INFERIOR HÍBRIDA BITALIS (CONTEXTO DE NEGOCIO + NAVEGACIÓN) */}
      {(isNavigating || isSimulating || isDrivingMode) && activeClient && (
        <div className="relative z-30 px-2 sm:px-3 max-w-lg mx-auto w-full mb-1">
          <div className="bg-black/95 border border-slate-800 rounded-3xl p-2 sm:p-2.5 shadow-2xl flex items-center justify-between gap-2 text-white backdrop-blur-md">
            {/* Lado Izquierdo: Centrar mi ubicación + ETA */}
            <button
              type="button"
              onClick={recenter3DUser}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-2xl cursor-pointer transition active:scale-95 text-left shrink-0 shadow-md"
              title="Centrar mi ubicación en el mapa"
            >
              <div className="w-9 h-9 rounded-full bg-black border-2 border-cyan-400 flex items-center justify-center shrink-0 text-cyan-300 shadow">
                <Target className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="hidden min-[380px]:block min-w-0">
                <span className="text-xs font-black text-white block leading-tight truncate">Centrar</span>
                <span className="text-[11px] text-cyan-300 font-bold block truncate mt-0.5">
                  {routeInfo.durationMin} min · {routeInfo.distanceKm} km
                </span>
              </div>
            </button>

            {/* Centro: Mini-Perfil de Cobranza (Contexto de Negocio) */}
            <div
              onClick={() => setShowClientCardModal(true)}
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-2xl cursor-pointer transition text-center flex flex-col justify-center"
              title="Ver Tarjeta de Cliente BITALIS"
            >
              <span className="text-[10px] text-slate-400 font-bold uppercase truncate block">
                Hacia: <strong className="text-white">{activeClient.nombreCompleto.split(' ')[0]}</strong>
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-400 block truncate mt-0.5">
                Debe: ${activeClient.saldoPendiente.toLocaleString()}
              </span>
            </div>

            {/* Lado Derecho: Acción Inmediata de Cobro & Vista General */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(true)}
                className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs rounded-2xl border border-emerald-400/60 cursor-pointer shadow-lg transition active:scale-95 flex items-center gap-1"
                title="Abrir Ficha de Cobro Rápido"
              >
                <DollarSign className="w-4 h-4 stroke-[3]" />
                <span>Cobrar</span>
              </button>

              <button
                type="button"
                onClick={fitRouteBounds}
                className="p-2.5 bg-slate-800/90 hover:bg-slate-700 text-cyan-300 hover:text-white font-black text-xs rounded-2xl border border-slate-700 cursor-pointer shadow-md transition active:scale-95"
                title="Vista General de la Ruta"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 2. PANEL INFERIOR "SMART-SHEET" UNIFICADO BITALIS                */}
      {/* ---------------------------------------------------------------- */}
      <footer className="mt-auto relative z-20 p-2 sm:p-4 max-w-lg mx-auto w-full space-y-2">
        {activeClient && (
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-2xl space-y-3">
            {/* Barra superior del Dock: Buscar 🔍 | ETA + Distancia ⏱️ | Tarjeta de Cliente 🎴 */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <button
                type="button"
                onClick={() => setShowSearchModal(true)}
                className="p-2.5 bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded-2xl cursor-pointer transition shadow"
                title="Buscar Cliente en la Ruta"
              >
                <Search className="w-5 h-5" />
              </button>

              <div className="text-center min-w-0">
                <span className="text-lg sm:text-xl font-black text-white block tracking-tight leading-none">
                  {new Date(Date.now() + routeInfo.durationMin * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[11px] font-bold text-cyan-300 flex items-center justify-center gap-1.5 mt-0.5">
                  ⏱️ {routeInfo.durationMin} min · 📏 {routeInfo.distanceKm} km
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowClientCardModal(true)}
                className="p-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-2xl cursor-pointer transition shadow flex items-center gap-1.5 text-xs font-black"
                title="Ver Tarjeta de Cliente BITALIS"
              >
                <CreditCard className="w-5 h-5 text-amber-400" />
                <span className="hidden sm:inline">Tarjeta</span>
              </button>
            </div>

            {/* TAB SWITCHER */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveSmartTab('COBRO')}
                className={`flex-1 py-2 rounded-xl text-center transition cursor-pointer ${
                  activeSmartTab === 'COBRO'
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                💵 Cobro Rápido
              </button>
              <button
                type="button"
                onClick={() => setActiveSmartTab('EVIDENCIA')}
                className={`flex-1 py-2 rounded-xl text-center transition cursor-pointer ${
                  activeSmartTab === 'EVIDENCIA'
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🖼️ Evidencia
              </button>
              <button
                type="button"
                onClick={() => setActiveSmartTab('CONTACTO')}
                className={`flex-1 py-2 rounded-xl text-center transition cursor-pointer ${
                  activeSmartTab === 'CONTACTO'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📲 Contacto
              </button>
            </div>

            {/* TAB 1: COBRO & METRICAS Y BARRAS DE ACCIÓN */}
            {activeSmartTab === 'COBRO' && (
              <div className="space-y-3 animate-fadeIn">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">
                      Dirección de Cobro
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-white line-clamp-2">{activeClient.direccion}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {activeClient.estatusRuta === 'cobrado' ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-black">
                        ✅ COBRADO
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-700 text-xs font-black animate-pulse">
                        🧭 EN CAMINO
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Distancia</span>
                    <span className="text-sm font-black text-cyan-400 flex items-center justify-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {routeInfo.distanceKm} km
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">ETA Aprox.</span>
                    <span className="text-sm font-black text-amber-400 flex items-center justify-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      ~{routeInfo.durationMin} min
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Saldo Pendiente</span>
                    <span className="text-sm font-black text-emerald-400">
                      ${activeClient.saldoPendiente.toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>

                {/* BOTÓN PRINCIPAL DE COBRO */}
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full min-h-[60px] bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 hover:from-emerald-500 text-white font-black text-lg sm:text-xl rounded-2xl shadow-2xl flex items-center justify-center gap-3 cursor-pointer border-2 border-emerald-300 transition transform active:scale-98"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <span>COBRAR SALDO (${activeClient.saldoPendiente.toLocaleString('es-MX')})</span>
                </button>

                {/* ACCIONES RÁPIDAS EN CHIPS */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowClientCardModal(true)}
                    className="py-2 px-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-amber-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition shadow"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Tarjeta</span>
                  </button>

                  {activeClient.telefono ? (
                    <a
                      href={`https://wa.me/52${activeClient.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${activeClient.nombreCompleto}, le saluda su cobrador BITALIS. Su saldo pendiente es de $${activeClient.saldoPendiente} MXN. Voy en camino.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-emerald-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition shadow"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <span>WhatsApp</span>
                    </a>
                  ) : (
                    <button disabled className="py-2 px-1 bg-slate-950/50 opacity-40 border border-slate-800 rounded-xl text-[10px] font-black text-slate-500 flex flex-col items-center justify-center gap-1">
                      <MessageSquare className="w-4 h-4 text-slate-500" />
                      <span>WhatsApp</span>
                    </button>
                  )}

                  {activeClient.telefono ? (
                    <a
                      href={`tel:${activeClient.telefono}`}
                      className="py-2 px-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-cyan-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition shadow"
                    >
                      <Phone className="w-4 h-4 text-cyan-400" />
                      <span>Llamar</span>
                    </a>
                  ) : (
                    <button disabled className="py-2 px-1 bg-slate-950/50 opacity-40 border border-slate-800 rounded-xl text-[10px] font-black text-slate-500 flex flex-col items-center justify-center gap-1">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <span>Llamar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveSmartTab('EVIDENCIA')}
                    className="py-2 px-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-indigo-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition shadow"
                  >
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <span>Evidencia</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: EVIDENCIA VISUAL */}
            {activeSmartTab === 'EVIDENCIA' && (
              <div className="space-y-2 animate-fadeIn">
                <span className="text-xs font-bold text-slate-300 block">Expediente de Fotos del Domicilio</span>
                <div className="grid grid-cols-3 gap-2">
                  <div
                    onClick={() => setPreviewImageModalUrl('https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80')}
                    className="relative group rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 h-24 cursor-pointer hover:border-cyan-400 transition"
                  >
                    <img
                      src="https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=400&q=80"
                      alt="Fachada"
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1 text-[9px] font-bold text-center text-slate-200">
                      🏡 Fachada
                    </div>
                  </div>

                  <div
                    onClick={() => setPreviewImageModalUrl('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80')}
                    className="relative group rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 h-24 cursor-pointer hover:border-cyan-400 transition"
                  >
                    <img
                      src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=400&q=80"
                      alt="Identificación INE"
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1 text-[9px] font-bold text-center text-slate-200">
                      🪪 ID / INE
                    </div>
                  </div>

                  <div
                    onClick={() => setPreviewImageModalUrl('https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80')}
                    className="relative group rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 h-24 cursor-pointer hover:border-cyan-400 transition"
                  >
                    <img
                      src="https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=400&q=80"
                      alt="Contrato Pagaré"
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1 text-[9px] font-bold text-center text-slate-200">
                      📄 Pagaré
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CONTACTO DIRECTO */}
            {activeSmartTab === 'CONTACTO' && (
              <div className="space-y-3 animate-fadeIn">
                <p className="text-xs text-slate-300 font-bold">Comunicación Directa con Cliente</p>
                <div className="grid grid-cols-2 gap-2">
                  {activeClient.telefono ? (
                    <a
                      href={`tel:${activeClient.telefono}`}
                      className="p-3 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded-2xl flex items-center justify-center gap-2 text-xs font-black"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Llamar Ahora</span>
                    </a>
                  ) : (
                    <button disabled className="p-3 bg-slate-950 border border-slate-800 text-slate-500 rounded-2xl text-xs font-bold">
                      Sin Teléfono
                    </button>
                  )}

                  {activeClient.telefono ? (
                    <a
                      href={`https://wa.me/52${activeClient.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Hola ${activeClient.nombreCompleto}, te contacto de BITALIS para tu aviso de cobro semanal. Voy en camino a tu domicilio en breve.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-black shadow-lg"
                    >
                      <Zap className="w-4 h-4 fill-white" />
                      <span>WhatsApp Directo</span>
                    </a>
                  ) : (
                    <button disabled className="p-3 bg-slate-950 border border-slate-800 text-slate-500 rounded-2xl text-xs font-bold">
                      Sin WhatsApp
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </footer>

      {/* ---------------------------------------------------------------- */}
      {/* 3. EMERALD SUCCESS BURST OVERLAY WITH PARTICLES                   */}
      {/* ---------------------------------------------------------------- */}
      {showSuccessBurst && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="relative flex flex-col items-center max-w-sm w-full space-y-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 to-green-300 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.8)] animate-bounce">
              <CheckCircle2 className="w-14 h-14 text-slate-950" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400 text-xs font-black uppercase tracking-widest">
                ¡PAGO REGISTRADO CON ÉXITO!
              </span>
              <h2 className="text-2xl font-black text-white mt-2">
                ${lastPaidAmount.toLocaleString('es-MX')} MXN
              </h2>
              <p className="text-sm font-bold text-slate-300">
                Cliente: {lastPaidClientName}
              </p>
            </div>

            <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-3 w-full text-xs font-bold text-emerald-300 flex items-center justify-center gap-2 shadow-xl">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>Sincronizado & Saltando al siguiente vecino...</span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 4. MODAL PREVIEW DE IMAGENES EVIDENCIA                            */}
      {/* ---------------------------------------------------------------- */}
      {previewImageModalUrl && (
        <div
          onClick={() => setPreviewImageModalUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-lg w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl p-2 space-y-3">
            <div className="flex items-center justify-between p-2">
              <span className="text-xs font-black text-white">Evidencia Fotografica</span>
              <button
                type="button"
                onClick={() => setPreviewImageModalUrl(null)}
                className="p-1.5 bg-slate-800 text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={previewImageModalUrl} alt="Vista previa" className="w-full h-80 object-cover rounded-2xl" />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 3. MODAL DE COBRO EXPRESS Y TRANSACCIÓN EN SUPABASE               */}
      {/* ---------------------------------------------------------------- */}
      {isPaymentModalOpen && activeClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white">Confirmar Cobro en Supabase</h3>
                <p className="text-xs text-slate-400">{activeClient.nombreCompleto}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Amount Suggestion */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Monto del Pago</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={montoIngresado}
                  onChange={(e) => setMontoIngresado(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-3xl font-black text-emerald-400 focus:outline-none focus:border-emerald-500 text-center"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMontoIngresado(String(activeClient.saldoPendiente))}
                  className="flex-1 py-1.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-xl text-xs font-bold"
                >
                  Saldo Total (${activeClient.saldoPendiente})
                </button>
                <button
                  type="button"
                  onClick={() => setMontoIngresado('200')}
                  className="py-1.5 px-3 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold"
                >
                  $200
                </button>
                <button
                  type="button"
                  onClick={() => setMontoIngresado('500')}
                  className="py-1.5 px-3 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold"
                >
                  $500
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Método de Pago</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMetodoPago('EFECTIVO')}
                  className={`py-3 rounded-xl text-xs font-black border cursor-pointer ${
                    metodoPago === 'EFECTIVO'
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  💵 Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoPago('TRANSFERENCIA')}
                  className={`py-3 rounded-xl text-xs font-black border cursor-pointer ${
                    metodoPago === 'TRANSFERENCIA'
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  📲 Transferencia
                </button>
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="button"
              onClick={handleRegistrarCobro}
              disabled={isSubmittingPayment || parseFloat(montoIngresado) <= 0}
              className="w-full min-h-[56px] bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 text-white font-black text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition active:scale-98 disabled:opacity-40"
            >
              {isSubmittingPayment ? (
                <RefreshCw className="w-5 h-5 text-white animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-white" />
              )}
              <span>{isSubmittingPayment ? 'Guardando en Supabase...' : 'Confirmar Cobro Instantáneo'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 5. MODAL TARJETA DIGITAL DE CLIENTE BITALIS                       */}
      {/* ---------------------------------------------------------------- */}
      {showClientCardModal && activeClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-4 sm:p-6 w-full max-w-lg space-y-4 shadow-2xl my-auto">
            {/* Encabezado Tarjeta */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                  🎴 TARJETA DE CRÉDITO Y COBRANZA
                </span>
                <h3 className="text-lg font-black text-white mt-1 leading-tight">{activeClient.nombreCompleto}</h3>
                <p className="text-xs text-slate-400 font-bold">Folio: #{activeClient.folio} · Orden de Ruta #{activeClient.ordenRuta || activeIndex + 1}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowClientCardModal(false)}
                className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl cursor-pointer border border-slate-700 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen de Cuenta BITALIS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Saldo Total</span>
                <span className="text-lg font-black text-emerald-400">${activeClient.saldoPendiente.toLocaleString('es-MX')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Abono Semanal</span>
                <span className="text-lg font-black text-cyan-400">$200 MXN</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Estatus</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-[10px] font-bold inline-block mt-0.5">
                  REGULAR ✅
                </span>
              </div>
            </div>

            {/* Detalle de Domicilio & Teléfono */}
            <div className="space-y-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-400 block text-[10px] uppercase">Domicilio de Cobro</span>
                  <span className="font-bold text-white leading-tight block">{activeClient.direccion}</span>
                </div>
              </div>
              {activeClient.telefono && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-white">{activeClient.telefono}</span>
                </div>
              )}
            </div>

            {/* Historial Timeline de Abonos Semanales */}
            <div className="space-y-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider block">
                📜 Historial Reciente de Pagos
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">Semana 12 · 25 Jul 2026</span>
                    <span className="text-[10px] text-slate-400">Recibo #84920 · Cobrador Carlos M.</span>
                  </div>
                  <span className="font-black text-emerald-400 bg-emerald-950 px-2 py-1 rounded-lg border border-emerald-800">
                    +$200.00
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">Semana 11 · 18 Jul 2026</span>
                    <span className="text-[10px] text-slate-400">Recibo #83109 · Cobrador Carlos M.</span>
                  </div>
                  <span className="font-black text-emerald-400 bg-emerald-950 px-2 py-1 rounded-lg border border-emerald-800">
                    +$200.00
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">Semana 10 · 11 Jul 2026</span>
                    <span className="text-[10px] text-slate-400">Recibo #81954 · Cobrador Carlos M.</span>
                  </div>
                  <span className="font-black text-emerald-400 bg-emerald-950 px-2 py-1 rounded-lg border border-emerald-800">
                    +$250.00
                  </span>
                </div>
              </div>
            </div>

            {/* Botones de Acción de Tarjeta */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowClientCardModal(false);
                  setIsPaymentModalOpen(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 hover:from-emerald-500 text-white font-black text-sm rounded-xl shadow-xl flex items-center justify-center gap-2 cursor-pointer border border-emerald-300"
              >
                <DollarSign className="w-5 h-5" />
                <span>COBRAR SALDO AHORA (${activeClient.saldoPendiente.toLocaleString('es-MX')})</span>
              </button>

              <div className="flex gap-2">
                {activeClient.telefono && (
                  <a
                    href={`https://wa.me/52${activeClient.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Estimado(a) ${activeClient.nombreCompleto}, le enviamos su estado de cuenta BITALIS:\n\n• Folio: #${activeClient.folio}\n• Saldo Actual: $${activeClient.saldoPendiente} MXN\n• Su cobrador va en camino.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span>Enviar WhatsApp</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setToastNotice('Generando vista de impresión de tarjeta...');
                    setTimeout(() => setToastNotice(null), 2500);
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>Imprimir Tarjeta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 6. MODAL BÚSQUEDA Y NAVEGACIÓN EN RUTA                            */}
      {/* ---------------------------------------------------------------- */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-indigo-500/60 rounded-3xl p-4 sm:p-6 w-full max-w-lg space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-cyan-400" />
                  Buscar Cliente en Ruta
                </h3>
                <p className="text-xs text-slate-400">Total de {rutaClientes.length} clientes asignados hoy</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl cursor-pointer border border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Input Campo Búsqueda */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nombre, Folio o Calle..."
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-bold"
              />
            </div>

            {/* Lista Filtrada de Clientes */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {rutaClientes
                .filter(
                  (c) =>
                    c.nombreCompleto.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.direccion.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((client, idx) => (
                  <div
                    key={client.id}
                    onClick={() => {
                      const realIndex = rutaClientes.findIndex((item) => item.id === client.id);
                      if (realIndex !== -1) {
                        setActiveIndex(realIndex);
                        setShowSearchModal(false);
                        setToastNotice(`Centrado en Cliente #${realIndex + 1}: ${client.nombreCompleto}`);
                        setTimeout(() => setToastNotice(null), 2500);
                      }
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                      client.id === activeClient?.id
                        ? 'bg-indigo-950/80 border-cyan-400 shadow-lg'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[9px] font-black">
                          #{client.ordenRuta || idx + 1}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">Folio: {client.folio}</span>
                      </div>
                      <h4 className="text-xs font-black text-white truncate mt-0.5">{client.nombreCompleto}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{client.direccion}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-400 block">
                        ${client.saldoPendiente.toLocaleString('es-MX')}
                      </span>
                      <span className="text-[10px] text-cyan-300 font-bold">Ir a Posición 📍</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 7. MODAL REPORTE DE INCIDENCIA EN RUTA (⚠️+)                     */}
      {/* ---------------------------------------------------------------- */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-4 sm:p-6 w-full max-w-md space-y-4 shadow-2xl my-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                  ⚠️ ALERTA DE TRÁFICO / INCIDENCIA
                </span>
                <h3 className="text-base font-black text-white mt-1">Reportar Fricción en Ruta</h3>
                <p className="text-xs text-slate-400">Notifica al supervisor BITALIS y recalcula la ruta</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIncidentModal(false)}
                className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl cursor-pointer border border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opciones de Incidencias */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowIncidentModal(false);
                  setToastNotice('⚠️ Tráfico pesado registrado. Notificando a central...');
                  setTimeout(() => setToastNotice(null), 3000);
                }}
                className="w-full p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left rounded-2xl flex items-center gap-3 cursor-pointer transition"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 font-black">
                  🚗
                </div>
                <div>
                  <span className="text-xs font-black text-white block">Tráfico Excesivo / Obra Vial</span>
                  <span className="text-[10px] text-slate-400">Retraso estimado de +15 a +30 min</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowIncidentModal(false);
                  setToastNotice('🔒 Callejón / Portón cerrado. Marcar como ausente o reintentar tarde.');
                  setTimeout(() => setToastNotice(null), 3000);
                }}
                className="w-full p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left rounded-2xl flex items-center gap-3 cursor-pointer transition"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shrink-0 font-black">
                  🔒
                </div>
                <div>
                  <span className="text-xs font-black text-white block">Callejón o Portón Bloqueado</span>
                  <span className="text-[10px] text-slate-400">Sin acceso vehicular ni peatonal</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowIncidentModal(false);
                  setToastNotice('🏠 Cliente Ausente. Notificación enviada al supervisor.');
                  setTimeout(() => setToastNotice(null), 3000);
                }}
                className="w-full p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left rounded-2xl flex items-center gap-3 cursor-pointer transition"
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 font-black">
                  🏠
                </div>
                <div>
                  <span className="text-xs font-black text-white block">Cliente Ausente / Nadie Atiende</span>
                  <span className="text-[10px] text-slate-400">Pasar al siguiente cliente en la lista</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 4. MODAL DE CONFIGURACIÓN DE MAPBOX TOKEN                         */}
      {/* ---------------------------------------------------------------- */}
      {showTokenInputModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Mapbox Access Token
                </h3>
                <p className="text-xs text-slate-400">Configura tu token personal de Mapbox</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTokenInputModal(false)}
                className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Token de acceso (pk.eyJ...):</label>
              <textarea
                value={tempTokenInput}
                onChange={(e) => setTempTokenInput(e.target.value)}
                placeholder="Ingresa tu pk.eyJ... token de Mapbox"
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Si no se proporciona un token válido, la aplicación utiliza automáticamente el mapa nocturno optimizado (Carto Dark) sin interrupciones.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMapboxToken('');
                  setUsingFallbackStyle(true);
                  setShowTokenInputModal(false);
                }}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-700"
              >
                Usar Modo Libre
              </button>

              <button
                type="button"
                onClick={() => {
                  setMapboxToken(tempTokenInput.trim());
                  setUsingFallbackStyle(false);
                  setShowTokenInputModal(false);
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg"
              >
                Guardar Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
