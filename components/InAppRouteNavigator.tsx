'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Cliente, PuntoRutaOptimizado, Venta, Abono, calcularDistanciaKm } from '@/types';
import ImageLightboxModal from '@/components/ImageLightboxModal';
import BitalisLogo from '@/components/BitalisLogo';
import { offlineRouteStorage, RutaGuardadaOffline } from '@/lib/offlineRouteStorage';
import {
  Compass,
  Navigation,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  MapPin,
  CheckCircle2,
  DollarSign,
  X,
  LocateFixed,
  Phone,
  RotateCcw,
  AlertTriangle,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerUpRight,
  CornerUpLeft,
  Flag,
  Zap,
  Maximize2,
  Minimize2,
  MessageSquare,
  RefreshCw,
  Sun,
  Moon,
  AlertCircle,
  ShieldCheck,
  Check,
  Sparkles,
  Camera,
  FileText,
  Eye,
  History,
  User,
  CreditCard,
  Calendar,
  ExternalLink,
  WifiOff,
  Wifi,
  Info,
  Trash2,
  DownloadCloud
} from 'lucide-react';

interface InAppRouteNavigatorProps {
  puntos: PuntoRutaOptimizado[];
  clientes: Cliente[];
  ventas?: Venta[];
  abonos?: Abono[];
  initialStopIndex?: number;
  userGpsCoords?: { lat: number; lng: number } | null;
  onClose: () => void;
  onArrivalAtClient?: (cliente: Cliente) => void;
  onPayAbono?: (cliente: Cliente) => void;
  onRegistrarAbonoDirecto?: (cliente: Cliente, monto: number, tipoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO', observaciones: string) => void;
  onReagendar?: (cliente: Cliente) => void;
  onSendMessage?: (cliente: Cliente) => void;
}

interface StepInstruction {
  instruction: string;
  distanceMeters: number;
  type: 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'arrive';
}

export default function InAppRouteNavigator({
  puntos,
  clientes,
  ventas,
  abonos,
  initialStopIndex = 0,
  userGpsCoords,
  onClose,
  onArrivalAtClient,
  onPayAbono,
  onRegistrarAbonoDirecto,
  onReagendar,
  onSendMessage,
}: InAppRouteNavigatorProps) {
  // Initial normalized stops list
  const initialStops: Cliente[] = useMemo(() => {
    if (puntos && puntos.length > 0) {
      return puntos.map((p) => p.cliente);
    }
    return clientes;
  }, [puntos, clientes]);

  // Active dynamic stops sequence (allows re-ordering / recalculation)
  const [activeStopsList, setActiveStopsList] = useState<Cliente[]>(initialStops);

  const [currentIndex, setCurrentIndex] = useState<number>(
    initialStopIndex >= 0 && initialStopIndex < initialStops.length ? initialStopIndex : 0
  );

  const activeClient = activeStopsList[currentIndex] || null;

  // Navigation state
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(
    userGpsCoords || (initialStops.length > 0 ? { lat: initialStops[0].latitud - 0.003, lng: initialStops[0].longitud - 0.003 } : null)
  );

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [speechRate] = useState<number>(1.0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState<number>(0);

  // Advanced features state
  const [mapTheme, setMapTheme] = useState<'DARK' | 'LIGHT'>('DARK');
  const [arrivalModalClient, setArrivalModalClient] = useState<Cliente | null>(null);
  const [activePopupTab, setActivePopupTab] = useState<'COBRAR' | 'FOTOS' | 'HISTORIAL' | 'DETALLES'>('COBRAR');
  const [montoAbonoInput, setMontoAbonoInput] = useState<number>(150);
  const [tipoPagoInput, setTipoPagoInput] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO'>('EFECTIVO');
  const [observacionesInput, setObservacionesInput] = useState<string>('');
  const [osrmSteps, setOsrmSteps] = useState<StepInstruction[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string; description?: string } | null>(null);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalculatingMessage, setRecalculatingMessage] = useState<string>('');
  const [hasDetourTraffic, setHasDetourTraffic] = useState<boolean>(false);
  const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);
  const [offlineModalRoutes, setOfflineModalRoutes] = useState<RutaGuardadaOffline[]>([]);

  // Auto-precargar la ruta activa en el almacenamiento local offline
  useEffect(() => {
    if (activeStopsList.length > 0) {
      offlineRouteStorage.precargarRutaActual(activeStopsList, 'Navegación Asistida GPS');
    }
  }, [activeStopsList]);

  // Center on User GPS and Streets
  const handleCenterOnUserGPS = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.invalidateSize();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentCoords({ lat, lng });
          map.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
        },
        () => {
          if (currentCoords) {
            map.flyTo([currentCoords.lat, currentCoords.lng], 17, { animate: true, duration: 1 });
          } else if (activeClient) {
            map.flyTo([activeClient.latitud, activeClient.longitud], 17, { animate: true, duration: 1 });
          }
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else if (currentCoords) {
      map.flyTo([currentCoords.lat, currentCoords.lng], 17, { animate: true, duration: 1 });
    }
  }, [currentCoords, activeClient]);

  // Fit all route stops on screen without overflowing
  const handleFitAllRouteStops = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.invalidateSize();

    const allPoints: Array<[number, number]> = [];
    if (currentCoords) allPoints.push([currentCoords.lat, currentCoords.lng]);
    activeStopsList.forEach((c) => {
      if (c.latitud && c.longitud) allPoints.push([c.latitud, c.longitud]);
    });

    if (allPoints.length > 0) {
      import('leaflet').then((L) => {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
      });
    }
  }, [currentCoords, activeStopsList]);

  // Map and simulation references (declared at top level)
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const stopMarkersGroupRef = useRef<any>(null);
  const activeLegPolylineRef = useRef<any>(null);
  const fullRoutePolylineRef = useRef<any>(null);
  const simIntervalRef = useRef<any>(null);

  // Compute the 3 required photos for arrivalModalClient
  const clientPhotos = useMemo(() => {
    if (!arrivalModalClient) return [];
    return [
      {
        id: 'fachada',
        title: '1. Fachada Domicilio',
        url: arrivalModalClient.fotoFachada || `https://picsum.photos/seed/fachada_${arrivalModalClient.id}/800/600`,
        isCustom: Boolean(arrivalModalClient.fotoFachada),
        badge: arrivalModalClient.fotoFachada ? 'Foto Real' : 'Muestra Domicilio',
        description: `Fachada del domicilio: ${arrivalModalClient.direccion} (${arrivalModalClient.colonia || 'S/C'})`
      },
      {
        id: 'cliente',
        title: '2. Identificación / Foto Cliente',
        url: arrivalModalClient.fotoCliente || arrivalModalClient.fotoIdentificacion || `https://picsum.photos/seed/cliente_${arrivalModalClient.id}/800/600`,
        isCustom: Boolean(arrivalModalClient.fotoCliente || arrivalModalClient.fotoIdentificacion),
        badge: (arrivalModalClient.fotoCliente || arrivalModalClient.fotoIdentificacion) ? 'Foto Validada' : 'Muestra Identificación',
        description: `Identificación oficial / Expediente de cliente: ${arrivalModalClient.nombreCompleto} (Folio ${arrivalModalClient.folio})`
      },
      {
        id: 'contrato',
        title: '3. Contrato / Pagaré Firmado',
        url: arrivalModalClient.fotoContrato || `https://picsum.photos/seed/contrato_${arrivalModalClient.id}/800/600`,
        isCustom: Boolean(arrivalModalClient.fotoContrato),
        badge: arrivalModalClient.fotoContrato ? 'Contrato Digital' : 'Muestra Pagaré',
        description: `Fotografía del contrato de crédito firmado y respaldado en sistema BITALIS`
      }
    ];
  }, [arrivalModalClient]);

  // Compute client sales info and payments history
  const clientVenta = useMemo(() => {
    if (!arrivalModalClient || !ventas) return null;
    return ventas.find(v => v.clienteId === arrivalModalClient.id || v.clienteFolio === arrivalModalClient.folio) || null;
  }, [arrivalModalClient, ventas]);

  const clientAbonos = useMemo(() => {
    if (!arrivalModalClient) return [];
    const found = abonos ? abonos.filter(a => a.clienteId === arrivalModalClient.id || a.clienteFolio === arrivalModalClient.folio) : [];
    if (found.length > 0) return found;

    // Default sample history if no db abonos
    return [
      {
        id: 901,
        ventaId: clientVenta?.id || 1,
        clienteId: arrivalModalClient.id,
        clienteNombre: arrivalModalClient.nombreCompleto,
        clienteFolio: arrivalModalClient.folio,
        cobradorId: 101,
        cobradorNombre: 'Cobrador Asignado',
        monto: clientVenta?.pagoSemanal || 150,
        tipoPago: 'EFECTIVO' as const,
        semanaNumero: 12,
        observaciones: 'Pago semanal en tiempo y forma recibido en domicilio',
        fechaPago: '2026-07-25'
      },
      {
        id: 902,
        ventaId: clientVenta?.id || 1,
        clienteId: arrivalModalClient.id,
        clienteNombre: arrivalModalClient.nombreCompleto,
        clienteFolio: arrivalModalClient.folio,
        cobradorId: 101,
        cobradorNombre: 'Cobrador Asignado',
        monto: clientVenta?.pagoSemanal || 150,
        tipoPago: 'TRANSFERENCIA' as const,
        semanaNumero: 11,
        observaciones: 'Abono verificado por transferencia bancaria',
        fechaPago: '2026-07-18'
      }
    ];
  }, [arrivalModalClient, abonos, clientVenta]);

  // Exit navigator safely with full interval & audio cleanup
  const handleExitNavigator = useCallback(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimulating(false);
    setArrivalModalClient(null);
    setLightboxPhoto(null);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onClose();
  }, [onClose]);

  // Handle ESC key listener to close modals or exit GPS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxPhoto) {
          setLightboxPhoto(null);
        } else if (arrivalModalClient) {
          setArrivalModalClient(null);
        } else {
          handleExitNavigator();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhoto, arrivalModalClient, handleExitNavigator]);

  // Speech assistant synthesis
  const speakText = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-MX';
      utterance.rate = speechRate;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech error', e);
    }
  }, [voiceEnabled, speechRate]);

  // Generate synthetic street turn-by-turn steps between current position and target
  const generateTurnInstructions = useCallback((origin: { lat: number; lng: number }, dest: { lat: number; lng: number }, clientName: string, isDetour = false) => {
    const totalDistKm = calcularDistanciaKm(origin.lat, origin.lng, dest.lat, dest.lng) + (isDetour ? 2.5 : 0);
    const totalMeters = Math.round(totalDistKm * 1000);

    if (totalMeters < 30) {
      return [
        { instruction: `¡Has llegado a tu destino! Domicilio de ${clientName}`, distanceMeters: 0, type: 'arrive' as const }
      ];
    }

    const m1 = Math.round(totalMeters * 0.35);
    const m2 = Math.round(totalMeters * 0.45);
    const m3 = Math.max(20, totalMeters - m1 - m2);

    if (isDetour) {
      return [
        { instruction: `⚠️ Desvío por tráfico: Toma la lateral izquierda por Av. Reforma`, distanceMeters: m1, type: 'slight-left' as const },
        { instruction: `Gira a la derecha en la segunda glorieta para reincorporarte`, distanceMeters: m2, type: 'right' as const },
        { instruction: `Avanza ${m3} metros directo al domicilio de ${clientName}`, distanceMeters: m3, type: 'straight' as const },
        { instruction: `¡Llegando! El domicilio de ${clientName} está a la derecha`, distanceMeters: 0, type: 'arrive' as const }
      ];
    }

    return [
      { instruction: `Dirígete al este por la calle principal hacia el domicilio de ${clientName}`, distanceMeters: m1, type: 'straight' as const },
      { instruction: `Gira a la derecha en la siguiente esquina`, distanceMeters: m2, type: 'right' as const },
      { instruction: `Gira a la izquierda y avanza ${m3} metros`, distanceMeters: m3, type: 'left' as const },
      { instruction: `¡Has llegado! El domicilio de ${clientName} está a la derecha`, distanceMeters: 0, type: 'arrive' as const }
    ];
  }, []);

  // Recalculate route metrics via useMemo
  const totalRouteDistKm = useMemo(() => {
    if (!currentCoords || activeStopsList.length === 0) return 0;
    let accumKm = 0;
    if (activeClient) {
      accumKm += calcularDistanciaKm(currentCoords.lat, currentCoords.lng, activeClient.latitud, activeClient.longitud);
    }
    for (let i = currentIndex; i < activeStopsList.length - 1; i++) {
      const p1 = activeStopsList[i];
      const p2 = activeStopsList[i + 1];
      accumKm += calcularDistanciaKm(p1.latitud, p1.longitud, p2.latitud, p2.longitud);
    }
    if (hasDetourTraffic) accumKm += 2.5;
    return Math.round(accumKm * 100) / 100;
  }, [currentCoords, activeClient, currentIndex, activeStopsList, hasDetourTraffic]);

  const remainingDistKm = useMemo(() => {
    if (!currentCoords || !activeClient) return 0;
    const legDist = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, activeClient.latitud, activeClient.longitud) + (hasDetourTraffic ? 2.5 : 0);
    return Math.round(legDist * 100) / 100;
  }, [currentCoords, activeClient, hasDetourTraffic]);

  const estimatedMinutes = useMemo(() => {
    return Math.max(1, Math.round((remainingDistKm / 25) * 60));
  }, [remainingDistKm]);

  const instructions = useMemo(() => {
    if (!currentCoords || !activeClient) return [];
    if (osrmSteps && osrmSteps.length > 0) return osrmSteps;
    return generateTurnInstructions(
      currentCoords,
      { lat: activeClient.latitud, lng: activeClient.longitud },
      activeClient.nombreCompleto,
      hasDetourTraffic
    );
  }, [currentCoords, activeClient, hasDetourTraffic, osrmSteps, generateTurnInstructions]);

  const prevClientIdRef = useRef(activeClient?.id);
  if (prevClientIdRef.current !== activeClient?.id) {
    prevClientIdRef.current = activeClient?.id;
    setCurrentInstructionIndex(0);
  }

  // Handle GPS arrival event trigger
  const triggerArrivalAtClient = useCallback((client: Cliente) => {
    setArrivalModalClient(client);
    setActivePopupTab('COBRAR');
    const venta = ventas?.find(v => v.clienteId === client.id || v.clienteFolio === client.folio);
    setMontoAbonoInput(venta?.pagoSemanal || 150);
    setObservacionesInput('');
    speakText(`¡Atención! Has llegado al domicilio de ${client.nombreCompleto}. Abriendo ficha de cobro.`);
    if (onArrivalAtClient) {
      onArrivalAtClient(client);
    }
  }, [speakText, onArrivalAtClient, ventas]);

  // RE-OPTIMIZE ENTIRE REMAINING ROUTE FROM CURRENT GPS
  const handleReoptimizeRouteFromGps = useCallback(() => {
    if (!currentCoords || activeStopsList.length === 0) return;

    setIsRecalculating(true);
    setRecalculatingMessage(`⚡ Recalculando Inteligencia de Ruta BITALIS...\nReordenando paradas por proximidad exacta a tu posición GPS actual...`);
    speakText(`Recalculando secuencia óptima de paradas por proximidad GPS en tiempo real.`);

    setTimeout(() => {
      const visitedSoFar = activeStopsList.slice(0, currentIndex);
      const remainingUnvisited = activeStopsList.filter((_, idx) => idx >= currentIndex);

      remainingUnvisited.sort((a, b) => {
        const dA = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, a.latitud, a.longitud);
        const dB = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, b.latitud, b.longitud);
        return dA - dB;
      });

      const reordered = [...visitedSoFar, ...remainingUnvisited];
      setActiveStopsList(reordered);
      setIsRecalculating(false);

      if (remainingUnvisited.length > 0) {
        const nextTarget = remainingUnvisited[0];
        const nextDist = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, nextTarget.latitud, nextTarget.longitud);
        speakText(`Ruta reoptimizada con éxito. Siguiente cliente prioritario: ${nextTarget.nombreCompleto}, a ${nextDist.toFixed(1)} kilómetros.`);
      }
    }, 1000);
  }, [currentCoords, activeStopsList, currentIndex, speakText]);

  // REGISTER ABONO IN-APP AND AUTOMATICALLY CONTINUE TO NEXT CLIENT
  const handleSaveAbonoInApp = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!arrivalModalClient) return;

    const currentClientToPay = arrivalModalClient;
    const paidAmount = montoAbonoInput;

    if (onRegistrarAbonoDirecto) {
      onRegistrarAbonoDirecto(currentClientToPay, paidAmount, tipoPagoInput, observacionesInput || 'Abono registrado en ruta asistida BITALIS');
    } else if (onPayAbono) {
      onPayAbono(currentClientToPay);
    }

    setArrivalModalClient(null);
    setIsRecalculating(true);
    setRecalculatingMessage(`💵 ¡Abono de $${paidAmount} MXN Registrado Con Éxito!\nRecalculando automáticamente la ruta para los clientes restantes...`);

    speakText(`Abono de ${paidAmount} pesos registrado exitosamente. Recalculando ruta para el siguiente cliente.`);

    setTimeout(() => {
      // Remove paid client from sequence
      const remainingUnvisited = activeStopsList.filter((c) => c.id !== currentClientToPay.id);

      if (currentCoords && remainingUnvisited.length > 0) {
        remainingUnvisited.sort((a, b) => {
          const dA = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, a.latitud, a.longitud);
          const dB = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, b.latitud, b.longitud);
          return dA - dB;
        });
      }

      setActiveStopsList(remainingUnvisited);
      setCurrentIndex(0);
      setIsRecalculating(false);

      if (remainingUnvisited.length > 0) {
        const nextTarget = remainingUnvisited[0];
        const nextDist = currentCoords ? calcularDistanciaKm(currentCoords.lat, currentCoords.lng, nextTarget.latitud, nextTarget.longitud) : 0;
        speakText(`Continuando navegación asistida. Siguiente cliente: ${nextTarget.nombreCompleto}, a ${nextDist.toFixed(1)} kilómetros.`);
      } else {
        speakText(`¡Felicidades! Has completado la cobranza de todos los clientes en la ruta del día.`);
      }
    }, 1200);
  }, [arrivalModalClient, montoAbonoInput, tipoPagoInput, observacionesInput, onRegistrarAbonoDirecto, onPayAbono, activeStopsList, currentCoords, speakText]);

  // OPTIMIZED ROUTE RECALCULATION FLOW ("Cliente No Estaba")
  const handleRecalculateSkipClient = useCallback((clientToSkip: Cliente) => {
    setIsRecalculating(true);
    setRecalculatingMessage(`🔄 Recalculando Inteligencia de Ruta BITALIS...\nOmitiendo temporalmente a ${clientToSkip.nombreCompleto} y reordenando clientes restantes por cercanía GPS...`);

    speakText(`Cliente ${clientToSkip.nombreCompleto} marcado como no localizable. Recalculando ruta en tiempo real.`);

    setTimeout(() => {
      // Create new stops list with skipped client moved to the very end of the day
      const remainingUnvisited = activeStopsList.filter((c, idx) => idx >= currentIndex && c.id !== clientToSkip.id);

      // Sort unvisited remaining by proximity from current GPS coords
      if (currentCoords) {
        remainingUnvisited.sort((a, b) => {
          const dA = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, a.latitud, a.longitud);
          const dB = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, b.latitud, b.longitud);
          return dA - dB;
        });
      }

      const visitedSoFar = activeStopsList.slice(0, currentIndex);
      const newSequence = [...visitedSoFar, ...remainingUnvisited, clientToSkip];

      setActiveStopsList(newSequence);
      setArrivalModalClient(null);
      setIsRecalculating(false);

      const nextTarget = newSequence[currentIndex] || null;
      if (nextTarget && currentCoords) {
        const nextDist = calcularDistanciaKm(currentCoords.lat, currentCoords.lng, nextTarget.latitud, nextTarget.longitud);
        speakText(`Ruta recalculada con éxito. Siguiente parada prioritaria: ${nextTarget.nombreCompleto}, a ${nextDist.toFixed(1)} kilómetros.`);
      }
    }, 1200);
  }, [activeStopsList, currentIndex, currentCoords, speakText]);

  // Watch real GPS position
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator) || isSimulating) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        setSpeedKmh(speed);
        setCurrentCoords({ lat, lng });

        // Auto-detect arrival if within 60 meters (Geofencing 50-80m) of active client
        if (activeClient && !arrivalModalClient) {
          const distMeters = calcularDistanciaKm(lat, lng, activeClient.latitud, activeClient.longitud) * 1000;
          if (distMeters < 60) {
            triggerArrivalAtClient(activeClient);
          }
        }
      },
      (err) => {
        console.warn('GPS error in navigator', err);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isSimulating, activeClient, arrivalModalClient, triggerArrivalAtClient]);

  // Leaflet map initialization & rendering
  useEffect(() => {
    if (!mapContainerRef.current) return;

    import('leaflet').then((L) => {
      if (!mapInstanceRef.current && mapContainerRef.current) {
        const startLat = currentCoords?.lat || 19.4326;
        const startLng = currentCoords?.lng || -99.1332;

        const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([startLat, startLng], 15);

        const tileUrl = mapTheme === 'DARK'
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        const tileLayer = L.tileLayer(tileUrl, {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          maxZoom: 19,
        }).addTo(map);

        tileLayerRef.current = tileLayer;
        stopMarkersGroupRef.current = L.layerGroup().addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Update tile layer theme if changed
      if (tileLayerRef.current) {
        const newUrl = mapTheme === 'DARK'
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        tileLayerRef.current.setUrl(newUrl);
      }

      // Update User Marker
      if (currentCoords) {
        if (!userMarkerRef.current) {
          const userIcon = L.divIcon({
            className: 'custom-user-gps-icon',
            html: `
              <div style="
                background: linear-gradient(135deg, #06b6d4, #3b82f6);
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 0 20px rgba(6, 182, 212, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                </svg>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          userMarkerRef.current = L.marker([currentCoords.lat, currentCoords.lng], { icon: userIcon }).addTo(map);
        } else {
          userMarkerRef.current.setLatLng([currentCoords.lat, currentCoords.lng]);
        }
      }

      // RENDER ALL STOP MARKERS FOR ENTIRE ROUTE
      if (stopMarkersGroupRef.current) {
        stopMarkersGroupRef.current.clearLayers();

        activeStopsList.forEach((client, idx) => {
          const isPassed = idx < currentIndex;
          const isActive = idx === currentIndex;

          let badgeBg = '#22c55e';
          if (client.estadoMorosidad === 'AMARILLO') badgeBg = '#f59e0b';
          if (client.estadoMorosidad === 'ROJO') badgeBg = '#ef4444';
          if (isPassed) badgeBg = '#64748b';

          const markerHtml = `
            <div style="
              background: ${isActive ? 'linear-gradient(135deg, #6366f1, #3b82f6)' : badgeBg};
              width: ${isActive ? '42px' : '32px'};
              height: ${isActive ? '42px' : '32px'};
              border-radius: 50%;
              border: ${isActive ? '4px solid #38bdf8' : '2px solid white'};
              box-shadow: ${isActive ? '0 0 20px rgba(99, 102, 241, 0.9)' : '0 2px 8px rgba(0,0,0,0.4)'};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 900;
              font-size: ${isActive ? '14px' : '11px'};
            ">
              ${isPassed ? '✓' : `#${idx + 1}`}
            </div>
          `;

          const stopIcon = L.divIcon({
            className: `stop-marker-${idx}`,
            html: markerHtml,
            iconSize: [isActive ? 42 : 32, isActive ? 42 : 32],
            iconAnchor: [isActive ? 21 : 16, isActive ? 21 : 16],
          });

          const m = L.marker([client.latitud, client.longitud], { icon: stopIcon });
          m.bindTooltip(`Parada #${idx + 1}: ${client.nombreCompleto}`, { direction: 'top' });
          m.on('click', () => {
            setCurrentIndex(idx);
          });
          stopMarkersGroupRef.current.addLayer(m);
        });
      }

      // DRAW FULL MULTI-STOP ROUTE POLYLINE WITH REAL STREET GEOMETRY
      if (activeLegPolylineRef.current) activeLegPolylineRef.current.remove();
      if (fullRoutePolylineRef.current) fullRoutePolylineRef.current.remove();

      if (currentCoords && activeStopsList.length > 0) {
        // 1. Active Leg Polyline (Current GPS -> Active Target via OSRM Real Streets)
        if (activeClient) {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentCoords.lng},${currentCoords.lat};${activeClient.longitud},${activeClient.latitud}?overview=full&steps=true&geometries=geojson`;
          
          fetch(osrmUrl)
            .then(res => res.json())
            .then(data => {
              if (data?.routes?.[0]?.geometry?.coordinates && mapInstanceRef.current) {
                const streetPoints = data.routes[0].geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
                if (activeLegPolylineRef.current) activeLegPolylineRef.current.remove();
                activeLegPolylineRef.current = L.polyline(streetPoints as any, {
                  color: '#06b6d4',
                  weight: 7,
                  opacity: 0.95,
                }).addTo(mapInstanceRef.current);

                // Parse real street turn instructions
                if (data.routes[0].legs?.[0]?.steps) {
                  const rawSteps = data.routes[0].legs[0].steps;
                  const parsed: StepInstruction[] = rawSteps.map((st: any) => {
                    const dist = Math.round(st.distance);
                    const name = st.name ? `por ${st.name}` : 'por la calle';
                    const modifier = st.maneuver?.modifier || '';
                    const type = st.maneuver?.type || '';

                    let turnType: 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'arrive' = 'straight';
                    let verb = 'Continúa';

                    if (type === 'arrive') {
                      turnType = 'arrive';
                      verb = 'Llegada a tu destino en';
                    } else if (modifier.includes('left')) {
                      turnType = modifier.includes('slight') ? 'slight-left' : 'left';
                      verb = 'Gira a la izquierda';
                    } else if (modifier.includes('right')) {
                      turnType = modifier.includes('slight') ? 'slight-right' : 'right';
                      verb = 'Gira a la derecha';
                    }

                    const txt = type === 'arrive'
                      ? `¡Has llegado! Domicilio de ${activeClient.nombreCompleto}`
                      : `En ${dist}m, ${verb} ${name}`;

                    return { instruction: txt, distanceMeters: dist, type: turnType };
                  });

                  if (parsed.length > 0) {
                    setOsrmSteps(parsed);
                  }
                }
              } else {
                throw new Error('OSRM fallback');
              }
            })
            .catch(() => {
              // Fallback
              const legCoords = [
                [currentCoords.lat, currentCoords.lng],
                [activeClient.latitud, activeClient.longitud],
              ];
              if (activeLegPolylineRef.current) activeLegPolylineRef.current.remove();
              activeLegPolylineRef.current = L.polyline(legCoords as any, {
                color: '#06b6d4',
                weight: 7,
                opacity: 0.95,
              }).addTo(map);
            });
        }

        // 2. Full Multi-stop Polyline
        const fullCoords: [number, number][] = [];
        if (activeClient) {
          fullCoords.push([activeClient.latitud, activeClient.longitud]);
        }
        for (let i = currentIndex + 1; i < activeStopsList.length; i++) {
          fullCoords.push([activeStopsList[i].latitud, activeStopsList[i].longitud]);
        }

        if (fullCoords.length >= 2) {
          fullRoutePolylineRef.current = L.polyline(fullCoords as any, {
            color: '#818cf8',
            weight: 5,
            opacity: 0.8,
            dashArray: '8, 12',
          }).addTo(map);
        }

        // Fit map bounds to view all route waypoints
        const boundsCoords: [number, number][] = [[currentCoords.lat, currentCoords.lng]];
        activeStopsList.slice(currentIndex, currentIndex + 4).forEach((c) => {
          boundsCoords.push([c.latitud, c.longitud]);
        });
        if (boundsCoords.length > 1) {
          map.fitBounds(L.latLngBounds(boundsCoords), { padding: [50, 50] });
        }
      }
    });
  }, [currentCoords, activeClient, currentIndex, activeStopsList, mapTheme]);

  // Recenter map on current GPS position
  const handleRecenterMap = () => {
    if (mapInstanceRef.current && currentCoords) {
      mapInstanceRef.current.flyTo([currentCoords.lat, currentCoords.lng], 16, { duration: 0.8 });
    }
  };

  // Simulation loop handler
  const handleToggleSimulation = () => {
    if (isSimulating) {
      clearInterval(simIntervalRef.current);
      setIsSimulating(false);
      setSpeedKmh(0);
      speakText('Simulación de recorrido pausada');
    } else {
      if (!activeClient || !currentCoords) return;
      setIsSimulating(true);
      setSpeedKmh(40);
      speakText('Iniciando simulación de navegación turn-by-turn');

      const startLat = currentCoords.lat;
      const startLng = currentCoords.lng;
      const targetLat = activeClient.latitud;
      const targetLng = activeClient.longitud;

      let steps = 0;
      const totalSteps = 20;

      simIntervalRef.current = setInterval(() => {
        steps++;
        const ratio = steps / totalSteps;
        const nextLat = startLat + (targetLat - startLat) * ratio;
        const nextLng = startLng + (targetLng - startLng) * ratio;

        setCurrentCoords({ lat: nextLat, lng: nextLng });

        if (ratio >= 0.33 && ratio < 0.66) {
          setCurrentInstructionIndex(1);
        } else if (ratio >= 0.66 && ratio < 0.9) {
          setCurrentInstructionIndex(2);
        } else if (ratio >= 0.9) {
          setCurrentInstructionIndex(3);
        }

        if (steps >= totalSteps) {
          clearInterval(simIntervalRef.current);
          setIsSimulating(false);
          setSpeedKmh(0);
          triggerArrivalAtClient(activeClient);
        }
      }, 600);
    }
  };

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const activeInstruction = instructions[currentInstructionIndex] || {
    instruction: `Navegando hacia ${activeClient?.nombreCompleto || 'destino'}`,
    distanceMeters: Math.round(remainingDistKm * 1000),
    type: 'straight'
  };

  const getInstructionIcon = (type: string) => {
    switch (type) {
      case 'left':
      case 'slight-left':
        return <CornerUpLeft className="w-8 h-8 text-emerald-400" />;
      case 'right':
      case 'slight-right':
        return <CornerUpRight className="w-8 h-8 text-emerald-400" />;
      case 'arrive':
        return <Flag className="w-8 h-8 text-indigo-400 animate-bounce" />;
      default:
        return <ArrowUp className="w-8 h-8 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-1 sm:p-3 md:p-4 animate-fadeIn">
      <div className="bg-slate-900 border-2 border-indigo-600/90 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full relative">
        
        {/* RECALCULATING ROUTE ANIMATED OVERLAY BANNER */}
        {isRecalculating && (
          <div className="absolute inset-0 z-[1100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="p-4 bg-indigo-600/30 text-indigo-300 rounded-full border-2 border-indigo-400 shadow-2xl animate-spin mb-4">
              <RefreshCw className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white mb-2">INTELIGENCIA DE RUTA BITALIS</h3>
            <p className="text-sm sm:text-base font-bold text-indigo-200 whitespace-pre-line max-w-md">
              {recalculatingMessage}
            </p>
          </div>
        )}

        {/* IN-APP ARRIVAL POP-UP MODAL OVERLAY (RENDERS DIRECTLY OVER NAVIGATOR MAP) */}
        {arrivalModalClient && (
          <div className="absolute inset-0 z-[1000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn overflow-y-auto">
            <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl p-4 sm:p-6 shadow-2xl max-w-xl w-full space-y-4 text-white relative max-h-[92vh] flex flex-col my-auto">
              {/* Close Pop-Up Button (Minimizes pop-up modal so it can be re-opened anytime) */}
              <button
                type="button"
                onClick={() => setArrivalModalClient(null)}
                className="absolute top-3.5 right-3.5 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full transition cursor-pointer z-10 shadow-lg border border-slate-700"
                title="Cerrar ventana emergente (Puedes volver a abrirla desde el mapa)"
              >
                <X className="w-5 h-5" />
              </button>

              {/* POP-UP HEADER */}
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3 shrink-0 pr-10">
                <div className="p-3 bg-emerald-950 text-emerald-400 rounded-2xl border border-emerald-600 shadow-lg animate-pulse shrink-0">
                  <LocateFixed className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest block">
                    📍 LLEGADA CONFIRMADA A DOMICILIO
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight truncate">
                    {arrivalModalClient.nombreCompleto}
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    FOLIO: {arrivalModalClient.folio} • PARADA #{currentIndex + 1}
                  </span>
                </div>
              </div>

              {/* SECCIÓN DESTACADA: LOG DE ÚLTIMAS VISITAS Y REGISTRO DE PAGO PREVIO */}
              <div className="bg-slate-950 p-2.5 sm:p-3 rounded-2xl border border-indigo-500/40 shadow-inner space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-300 uppercase tracking-wider">
                    <History className="w-3.5 h-3.5 text-emerald-400" />
                    <span>📋 Últimas Visitas ({clientAbonos.length})</span>
                  </div>
                  {clientAbonos.length > 0 && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800 font-bold">
                      Último Pago: ${clientAbonos[0].monto.toLocaleString('es-MX')} MXN
                    </span>
                  )}
                </div>

                {clientAbonos.length === 0 ? (
                  <div className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2 rounded-xl border border-amber-800/50 flex items-center gap-2 font-medium">
                    <Info className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Sin visitas/abonos anteriores registrados para este cliente (Primera visita).</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Última visita registrada */}
                    <div className="bg-slate-900/90 p-2 rounded-xl border border-emerald-500/40 flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-400 block tracking-tight">
                          ⭐ ÚLTIMA VISITA
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-sm font-black font-mono text-emerald-400">
                            ${clientAbonos[0].monto.toLocaleString('es-MX')}
                          </span>
                          <span className="text-[10px] text-slate-300">
                            ({clientAbonos[0].tipoPago})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          📅 {clientAbonos[0].fechaPago} • Sem #{clientAbonos[0].semanaNumero || 1}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 truncate max-w-[100px]" title={clientAbonos[0].observaciones}>
                        {clientAbonos[0].observaciones || 'Registrado'}
                      </span>
                    </div>

                    {/* Visita anterior si existe */}
                    {clientAbonos.length > 1 ? (
                      <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800 flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-black uppercase text-indigo-300 block tracking-tight">
                            ⏮️ VISITA ANTERIOR
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-sm font-black font-mono text-indigo-300">
                              ${clientAbonos[1].monto.toLocaleString('es-MX')}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({clientAbonos[1].tipoPago})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            📅 {clientAbonos[1].fechaPago}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-900/40 p-2 rounded-xl border border-slate-800/60 flex items-center justify-center text-[10px] text-slate-500 italic">
                        1 visita registrada
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* POP-UP TABS SELECTOR */}
              <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePopupTab('COBRAR')}
                  className={`py-2 px-1 text-[11px] font-black rounded-xl flex items-center justify-center gap-1 transition cursor-pointer ${
                    activePopupTab === 'COBRAR'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 text-amber-300" />
                  <span>Cobrar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePopupTab('FOTOS')}
                  className={`py-2 px-1 text-[11px] font-black rounded-xl flex items-center justify-center gap-1 transition cursor-pointer ${
                    activePopupTab === 'FOTOS'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-300" />
                  <span>3 Fotos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePopupTab('HISTORIAL')}
                  className={`py-2 px-1 text-[11px] font-black rounded-xl flex items-center justify-center gap-1 transition cursor-pointer ${
                    activePopupTab === 'HISTORIAL'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Historial ({clientAbonos.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePopupTab('DETALLES')}
                  className={`py-2 px-1 text-[11px] font-black rounded-xl flex items-center justify-center gap-1 transition cursor-pointer ${
                    activePopupTab === 'DETALLES'
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-amber-300" />
                  <span>Info</span>
                </button>
              </div>

              {/* TAB 0: FORMULARIO DE COBRO RÁPIDO Y CONTINUAR RUTA */}
              {activePopupTab === 'COBRAR' && (
                <form onSubmit={handleSaveAbonoInApp} className="space-y-3 overflow-y-auto pr-1 flex-1">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-amber-300" /> Registro de Abono en Campo
                      </span>
                      <span className="text-[10px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800">
                        Sugerido: ${clientVenta?.pagoSemanal || 150} MXN
                      </span>
                    </div>

                    {/* Presets de Monto */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {[50, 100, 150, 200, 300, 500].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMontoAbonoInput(preset)}
                          className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition border cursor-pointer shrink-0 ${
                            montoAbonoInput === preset
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>

                    {/* Input Custom Monto */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Monto Recibido ($ MXN)
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={montoAbonoInput}
                        onChange={(e) => setMontoAbonoInput(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-lg font-mono font-black text-emerald-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Tipo de Pago */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Método de Pago
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['EFECTIVO', 'TRANSFERENCIA', 'MIXTO'] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setTipoPagoInput(method)}
                            className={`py-1.5 text-[10px] font-black rounded-xl border transition cursor-pointer ${
                              tipoPagoInput === method
                                ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Observaciones */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Observaciones (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Pago en domicilio, entregó completo..."
                        value={observacionesInput}
                        onChange={(e) => setObservacionesInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl border border-emerald-400 cursor-pointer active:scale-95 transition"
                  >
                    <DollarSign className="w-5 h-5 text-amber-300 animate-bounce" />
                    <span>💵 Guardar Abono y Recalcular Ruta ➔</span>
                  </button>
                </form>
              )}

              {/* TAB 1: LAS 3 FOTOGRAFÍAS (FACHADA, IDENTIFICACIÓN, CONTRATO) */}
              {activePopupTab === 'FOTOS' && (
                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Camera className="w-4 h-4" /> Expediente Fotográfico del Cliente (Haz click para ampliar)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                      3/3 Disponibles
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {clientPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        onClick={() => setLightboxPhoto({ url: photo.url, title: photo.title, description: photo.description })}
                        className="group relative bg-slate-950 border border-slate-800 hover:border-indigo-500 rounded-2xl overflow-hidden cursor-pointer transition shadow-md flex flex-col"
                      >
                        {/* Image Preview Container */}
                        <div className="relative aspect-[4/3] w-full bg-slate-900 overflow-hidden">
                          <img
                            src={photo.url}
                            alt={photo.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 backdrop-blur-[2px]">
                            <Eye className="w-5 h-5 text-white drop-shadow-md" />
                            <span className="text-[10px] font-black text-white">Ver</span>
                          </div>
                          <span className="absolute top-1 right-1 bg-slate-900/90 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md text-slate-200 border border-slate-700/80">
                            {photo.badge}
                          </span>
                        </div>

                        {/* Photo Title Footer */}
                        <div className="p-1.5 bg-slate-900/90 border-t border-slate-800 text-center flex-1 flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-slate-200 truncate leading-tight block">
                            {photo.title}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-center">
                    💡 Haz clic sobre cualquiera de las 3 fotografías para abrir la vista en alta resolución con zoom y rotación.
                  </p>
                </div>
              )}

              {/* TAB 2: HISTORIAL DE PAGOS DEL CLIENTE */}
              {activePopupTab === 'HISTORIAL' && (
                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  {/* Financial Stats Bar */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800 text-center">
                    <div>
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Saldo Actual</span>
                      <span className="text-sm font-black text-amber-400 font-mono">
                        ${(clientVenta?.saldoActual || 1200).toLocaleString('es-MX')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Pago Semanal</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        ${(clientVenta?.pagoSemanal || 150).toLocaleString('es-MX')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Total Pagos</span>
                      <span className="text-sm font-black text-indigo-300 font-mono">
                        {clientAbonos.length} Pagos
                      </span>
                    </div>
                  </div>

                  {/* Payment Timeline List */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {clientAbonos.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs bg-slate-950 rounded-2xl border border-slate-800">
                        No hay abonos registrados para este cliente.
                      </div>
                    ) : (
                      clientAbonos.map((abono) => (
                        <div
                          key={abono.id}
                          className="p-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/80 shrink-0">
                              <CreditCard className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-emerald-400 text-sm">
                                  ${abono.monto.toLocaleString('es-MX')}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                                  {abono.tipoPago}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 block">
                                {abono.fechaPago} • Sem #{abono.semanaNumero || 1} • {abono.cobradorNombre || 'Cobrador'}
                              </span>
                            </div>
                          </div>
                          {abono.observaciones && (
                            <span className="text-[10px] text-slate-400 max-w-[120px] truncate text-right italic">
                              {abono.observaciones}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: DETALLES DOMICILIO Y CLIENTE */}
              {activePopupTab === 'DETALLES' && (
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2.5 text-xs overflow-y-auto flex-1">
                  <p className="text-slate-200">
                    🏠 <strong>Dirección Principal:</strong> {arrivalModalClient.direccion} ({arrivalModalClient.colonia || 'S/C'})
                  </p>
                  {arrivalModalClient.instruccionRuta && (
                    <p className="text-amber-300 bg-amber-950/80 p-2.5 rounded-xl border border-amber-800/80 font-medium">
                      💡 <strong>Referencia de Ubicación:</strong> {arrivalModalClient.instruccionRuta}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Teléfono:</span>
                      <span className="font-mono font-bold text-slate-200">{arrivalModalClient.telefono || 'Sin teléfono'}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Estado Morosidad:</span>
                      <span className={`px-2 py-0.5 rounded-full font-black text-[10px] inline-block mt-0.5 ${
                        arrivalModalClient.estadoMorosidad === 'VERDE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                        arrivalModalClient.estadoMorosidad === 'AMARILLO' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                        'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}>
                        {arrivalModalClient.estadoMorosidad || 'VERDE'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS GRID */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setArrivalModalClient(null);
                    if (onPayAbono) onPayAbono(arrivalModalClient);
                  }}
                  className="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Cobrar Abono</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRecalculateSkipClient(arrivalModalClient)}
                  className="py-3 bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-200 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                  title="Marca que el cliente no estaba y recalcula la ruta omitiéndolo temporalmente"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>No Estaba (Recalcular)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setArrivalModalClient(null);
                    if (onReagendar) onReagendar(arrivalModalClient);
                  }}
                  className="py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reagendar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onSendMessage) onSendMessage(arrivalModalClient);
                  }}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Aviso WhatsApp</span>
                </button>

                <a
                  href={`tel:${arrivalModalClient.telefono}`}
                  className="col-span-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                >
                  <Phone className="w-4 h-4 text-indigo-400" />
                  <span>Llamar al Cliente ({arrivalModalClient.telefono})</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE LIGHTBOX MODAL OVERLAY (FOR HIGH RES ZOOM / ROTATION / CLOSE & REOPEN) */}
        {lightboxPhoto && (
          <ImageLightboxModal
            isOpen={Boolean(lightboxPhoto)}
            imageUrl={lightboxPhoto.url}
            title={lightboxPhoto.title}
            description={lightboxPhoto.description}
            onClose={() => setLightboxPhoto(null)}
          />
        )}

        {/* OFFLINE ROUTES MANAGER MODAL OVERLAY */}
        {showOfflineModal && (
          <div className="absolute inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
            <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl p-5 shadow-2xl max-w-lg w-full space-y-4 text-white relative max-h-[85vh] flex flex-col">
              <button
                type="button"
                onClick={() => setShowOfflineModal(false)}
                className="absolute top-3.5 right-3.5 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full transition cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-800 pb-3 shrink-0 pr-10">
                <div className="p-3 bg-emerald-950 text-emerald-400 rounded-2xl border border-emerald-700 shrink-0">
                  <WifiOff className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    📂 Rutas Guardadas Offline (Sin Internet)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Navega y cobra sin conexión a internet usando la secuencia precargada.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                {offlineModalRoutes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs bg-slate-950 rounded-2xl border border-slate-800 p-4">
                    No hay rutas guardadas localmente en este dispositivo.
                  </div>
                ) : (
                  offlineModalRoutes.map((ruta) => (
                    <div
                      key={ruta.id}
                      className="p-3.5 bg-slate-950 border border-slate-800 hover:border-emerald-500/60 rounded-2xl space-y-2 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-400 truncate">
                          {ruta.nombre}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 shrink-0">
                          📅 {ruta.fechaRuta}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                        <div>
                          👥 Clientes: <strong>{ruta.totalClientes}</strong>
                        </div>
                        <div>
                          💵 Cobro Estimado: <strong>${ruta.montoTotalEsperado.toLocaleString('es-MX')} MXN</strong>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            offlineRouteStorage.delete(ruta.id);
                            setOfflineModalRoutes(offlineRouteStorage.getAll());
                          }}
                          className="px-2.5 py-1 text-[11px] bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl transition cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (ruta.clientes && ruta.clientes.length > 0) {
                              setActiveStopsList(ruta.clientes);
                              setCurrentIndex(0);
                              setShowOfflineModal(false);
                              speakText(`Ruta precargada offline activada con ${ruta.clientes.length} clientes.`);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Cargar esta Ruta</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TOP HUD NAV BAR */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-2.5 sm:p-3.5 border-b border-emerald-900 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <BitalisLogo size="sm" variant="dark" />
            <div className="min-w-0 border-l border-slate-800 pl-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-700 uppercase">
                  GPS NAVEGACIÓN
                </span>
                <span className="text-[11px] sm:text-xs font-mono font-black text-indigo-300">
                  Parada {currentIndex + 1} de {activeStopsList.length}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white truncate max-w-[200px] sm:max-w-md">
                {activeClient?.nombreCompleto || 'Cargando cliente...'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* CENTER LOCATION GPS & STREETS BUTTON */}
            <button
              type="button"
              onClick={handleCenterOnUserGPS}
              className="px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border border-cyan-300 shadow shadow-indigo-600/30"
              title="Centrar mapa en mi ubicación GPS actual a nivel de calle"
            >
              <LocateFixed className="w-3.5 h-3.5 text-cyan-200 animate-pulse" />
              <span>📍 Mi Ubicación</span>
            </button>

            {/* FIT ALL ROUTE STOPS BUTTON */}
            <button
              type="button"
              onClick={handleFitAllRouteStops}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
              title="Ajustar todas las paradas en pantalla"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ruta Completa</span>
            </button>

            {/* OFFLINE ROUTE STORAGE BUTTON */}
            <button
              type="button"
              onClick={() => {
                setOfflineModalRoutes(offlineRouteStorage.getAll());
                setShowOfflineModal(true);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer bg-slate-800 hover:bg-slate-700 border border-emerald-600/80 text-emerald-300 hover:text-white shadow"
              title="Ver o Cargar Rutas Precargadas para Uso Sin Internet"
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Offline</span>
            </button>

            {/* MAP THEME SWITCHER */}
            <button
              type="button"
              onClick={() => setMapTheme(mapTheme === 'DARK' ? 'LIGHT' : 'DARK')}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title={mapTheme === 'DARK' ? 'Modo Mapa Claro' : 'Modo Mapa Oscuro'}
            >
              {mapTheme === 'DARK' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>

            {/* TRAFFIC SIMULATION */}
            <button
              type="button"
              onClick={() => {
                setHasDetourTraffic(!hasDetourTraffic);
                speakText(hasDetourTraffic ? 'Tráfico despejado. Ruta normal restablecida.' : 'Alerta de tráfico. Desvío activado.');
              }}
              className={`p-2 rounded-xl border cursor-pointer ${
                hasDetourTraffic
                  ? 'bg-amber-950 border-amber-600 text-amber-300 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Simular alerta de tráfico y desvío"
            >
              <AlertCircle className="w-4 h-4" />
            </button>

            {/* VOICE TOGGLE & SPEED */}
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                voiceEnabled
                  ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={voiceEnabled ? 'Voz activada' : 'Voz desactivada'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* RE-CENTER GPS */}
            <button
              type="button"
              onClick={handleRecenterMap}
              className="p-2 bg-slate-800 border border-slate-700 text-indigo-300 hover:text-white rounded-xl cursor-pointer"
              title="Recentrar mapa en tu posición GPS"
            >
              <LocateFixed className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleSimulation}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer border ${
                isSimulating
                  ? 'bg-amber-600 text-white border-amber-500 shadow-lg animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400'
              }`}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isSimulating ? 'Pausar' : 'Simular'}</span>
            </button>

            <button
              type="button"
              onClick={handleExitNavigator}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-lg cursor-pointer border border-rose-400 transition"
              title="Salir de la navegación GPS BITALIS"
            >
              <X className="w-4 h-4" />
              <span>Salir GPS</span>
            </button>
          </div>
        </div>

        {/* TURN-BY-TURN HUD DISPLAY BANNER */}
        <div className="bg-slate-950 p-2.5 sm:p-3.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 z-10 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 border-2 border-emerald-500 rounded-2xl shadow-inner shrink-0">
              {getInstructionIcon(activeInstruction.type)}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
                MANIOBRA ({activeInstruction.distanceMeters > 0 ? `${activeInstruction.distanceMeters} m` : 'En Domicilio'})
              </span>
              <p className="text-xs sm:text-base font-extrabold text-white leading-tight">
                {activeInstruction.instruction}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end shrink-0 pl-4 border-l border-slate-800">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {remainingDistKm} <span className="text-xs text-slate-400">km leg</span>
            </span>
            <span className="text-[11px] font-bold text-indigo-300">
              Total Ruta: {totalRouteDistKm} km (~{estimatedMinutes} min)
            </span>
          </div>
        </div>

        {/* MIDDLE: INTERACTIVE MAP CANVAS (LEAFLET / OPENSTREETMAP VECTOR GPS) */}
        <div className="flex-1 relative w-full h-full min-h-[220px] bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* FLOATING SPEEDOMETER & DISTANCE BADGE (MOBILE) */}
          <div className="absolute top-3 left-3 z-20 bg-slate-950/90 backdrop-blur-md border border-indigo-500/80 rounded-2xl p-2 shadow-xl flex items-center gap-2.5 text-white">
            <div className="text-center px-1">
              <span className="block text-base sm:text-lg font-black font-mono text-amber-300 leading-none">{speedKmh}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">KM/H</span>
            </div>
            <div className="h-5 w-px bg-slate-800" />
            <div className="text-center px-1">
              <span className="block text-base sm:text-lg font-black font-mono text-emerald-400 leading-none">{remainingDistKm}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">PARADA</span>
            </div>
            <div className="h-5 w-px bg-slate-800" />
            <div className="text-center px-1">
              <span className="block text-base sm:text-lg font-black font-mono text-indigo-300 leading-none">{totalRouteDistKm}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">TOTAL</span>
            </div>
          </div>

          {/* FLOATING EMERGENCY EXIT BUTTON ON MAP */}
          <button
            type="button"
            onClick={handleExitNavigator}
            className="absolute top-3 right-3 z-20 px-3 py-2 bg-rose-600/90 hover:bg-rose-600 text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 shadow-2xl border border-rose-400 cursor-pointer backdrop-blur-md transition hover:scale-105"
            title="Cerrar navegador GPS y regresar"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Salir GPS</span>
          </button>

          {/* QUICK TARGET CLIENT CARD OVERLAY */}
          {activeClient && (
            <div className="absolute bottom-2 inset-x-2 sm:inset-x-6 z-20 bg-slate-950/95 backdrop-blur-md border-2 border-indigo-500/90 rounded-2xl p-3 shadow-2xl space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-black text-indigo-400">
                    PARADA #{currentIndex + 1} DE {activeStopsList.length} • FOLIO: {activeClient.folio}
                  </span>
                  <h3 className="font-black text-white text-sm sm:text-base truncate">
                    {activeClient.nombreCompleto}
                  </h3>
                </div>
                <a
                  href={`tel:${activeClient.telefono}`}
                  className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 font-bold rounded-xl text-xs flex items-center gap-1 transition shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Llamar</span>
                </a>
              </div>

              <p className="text-xs text-slate-300 truncate">
                📍 {activeClient.direccion} ({activeClient.colonia || 'S/C'})
              </p>

              {/* ACTION BUTTONS */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 pt-1">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeClient.latitud},${activeClient.longitud}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="col-span-2 sm:col-span-2 min-h-[44px] py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg border border-blue-400 cursor-pointer active:scale-95 transition"
                  title="Abrir navegación punto por punto en la aplicación Google Maps"
                >
                  <Navigation className="w-4 h-4 text-sky-300" />
                  <span>Google Maps GPS</span>
                  <ExternalLink className="w-3 h-3 text-sky-200" />
                </a>

                <button
                  type="button"
                  onClick={() => triggerArrivalAtClient(activeClient)}
                  className="min-h-[44px] py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow border border-slate-700 cursor-pointer"
                >
                  <LocateFixed className="w-4 h-4 text-emerald-400" />
                  <span>Ficha</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onPayAbono) onPayAbono(activeClient);
                  }}
                  className="min-h-[44px] py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 text-amber-300" />
                  <span>Cobrar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRecalculateSkipClient(activeClient)}
                  className="min-h-[44px] py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                  title="Marca no estaba y recalcula la ruta"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>No Estaba</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentIndex < activeStopsList.length - 1) {
                      setCurrentIndex(currentIndex + 1);
                    } else {
                      setCurrentIndex(0);
                    }
                  }}
                  className="min-h-[44px] py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM NAVIGATION STOP CONTROLLER */}
        <div className="bg-slate-950 p-2.5 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0 z-20">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="min-h-[44px] px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer border border-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <span className="text-xs font-mono font-bold text-slate-300">
            Parada {currentIndex + 1} / {activeStopsList.length}
          </span>

          <button
            type="button"
            disabled={currentIndex === activeStopsList.length - 1}
            onClick={() => setCurrentIndex((prev) => Math.min(activeStopsList.length - 1, prev + 1))}
            className="min-h-[44px] px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
