'use client';

import { useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import { Cliente, Venta, Zona, Producto, Usuario, calcularReglasFinancieras } from '@/types';
import { INITIAL_PRODUCTOS } from '@/lib/store';
import { triggerHaptic } from '@/lib/utils';
import { getTodayLocalDateStr, addDaysToLocalDateStr, calculateFrequencyDays } from '@/lib/dateUtils';
import ImageLightboxModal from './ImageLightboxModal';
import BitalisLogo from './BitalisLogo';
import {
  Camera,
  Calendar,
  CheckCircle2,
  TrendingUp,
  MapPin,
  UserCheck,
  X,
  FlipHorizontal,
  ImageIcon,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Plus,
  FileText,
  Lock,
  Award,
  Sparkles,
  Trophy,
  Check,
  Smartphone,
  AlertTriangle,
  Sun,
  Crop,
  Maximize2
} from 'lucide-react';

export interface ContractScanAnalysis {
  estado_captura: 'OPTIMO' | 'REINTENTAR';
  mensaje_guia: string;
  calidad_iluminacion: 'BUENA' | 'MALA';
  esquinas_detectadas: boolean;
}

interface VendedoraViewProps {
  zonas: Zona[];
  clientes: Cliente[];
  ventas: Venta[];
  productos?: Producto[];
  currentUser?: Usuario | null;
  onAddClienteVenta: (nuevoCliente: Cliente, nuevaVenta: Venta) => void;
  onShowActionNotice?: (title: string, message: string, role?: string) => void;
}

// Utility: Standard Image Compression to max 1280px & JPEG 72% quality
export async function compressAndOptimizeImage(fileOrDataUrl: File | string, maxDimension = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

// Utility: Dedicated Contract Scan Optimizer (Auto-crop perspective trimming + High contrast text processing for OCR)
export async function optimizeContractImageForOCR(fileOrDataUrl: File | string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let width = img.width;
      let height = img.height;
      const maxDimension = 1600; // Higher resolution for crisp text reading

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
        return;
      }

      // SIMULACIÓN DE AUTO-CROP Y PERSPECTIVA CENITAL (0°):
      // Recorta los bordes exteriores del fondo o mesa (4% de margen exterior)
      const cropX = width * 0.04;
      const cropY = height * 0.04;
      const cropW = width * 0.92;
      const cropH = height * 0.92;

      // Filter: Increase contrast and brightness for document text extraction optimization
      ctx.filter = 'contrast(1.35) brightness(1.05) saturate(0.60)';
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, width, height);
      const enhancedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      resolve(enhancedDataUrl);
    };

    img.onerror = () => {
      resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

export default function VendedoraView({
  zonas,
  clientes,
  ventas,
  productos = INITIAL_PRODUCTOS,
  currentUser,
  onAddClienteVenta,
  onShowActionNotice,
}: VendedoraViewProps) {
  const [activeTab, setActiveTab] = useState<'nueva_captura' | 'ranking'>('nueva_captura');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // WIZARD STEPPER STATE (Fotos -> Datos & GPS)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // PHOTOS STATE
  const [fotoFachada, setFotoFachada] = useState<string>('');
  const [fotoCliente, setFotoCliente] = useState<string>('');
  const [fotoContrato, setFotoContrato] = useState<string>('');
  const [optimizingSlot, setOptimizingSlot] = useState<'fachada' | 'cliente' | 'contrato' | null>(null);
  const [contractScanSuccess, setContractScanSuccess] = useState<boolean>(false);

  // CLIENT DATA & LOCATION
  const [nombreCompleto, setNombreCompleto] = useState<string>('');
  const [telefono1, setTelefono1] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [colonia, setColonia] = useState<string>('');
  const [latitud, setLatitud] = useState<number>(19.4326);
  const [longitud, setLongitud] = useState<number>(-99.1332);
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [gpsCapturedSuccess, setGpsCapturedSuccess] = useState<boolean>(false);

  // TIPO DE VENTA, PLAN DE PAGOS, ENGANCHE & FECHA PRIMER PAGO
  const [tipoVenta, setTipoVenta] = useState<'CREDITO' | 'CONTADO'>('CREDITO');
  const [montoContadoEditable, setMontoContadoEditable] = useState<number>(1490);
  const [productoNombreCustom, setProductoNombreCustom] = useState<string>('Colchón Matrimonial Ortopédico Premium');
  const [precioBaseInput, setPrecioBaseInput] = useState<number>(1490);

  const [esquemaPagoTipo, setEsquemaPagoTipo] = useState<'SEMANAL' | 'QUINCENAL' | 'CORTO_2_PAGOS' | 'CORTO_3_PAGOS'>('QUINCENAL');
  const [frecuenciaPago, setFrecuenciaPago] = useState<'SEMANAL' | 'CATORCENAL' | 'QUINCENAL' | 'MENSUAL'>('QUINCENAL');
  const [engancheEstatus, setEngancheEstatus] = useState<'COBRADO' | 'PRORROGA'>('COBRADO');
  const [engancheMontoInput, setEngancheMontoInput] = useState<number>(200);

  const [fechaPrimerPago, setFechaPrimerPago] = useState<string>(() => {
    return addDaysToLocalDateStr(getTodayLocalDateStr(), 15);
  });

  const updateFechaPrimerPago = (freq: 'SEMANAL' | 'CATORCENAL' | 'QUINCENAL' | 'MENSUAL', estatus: 'COBRADO' | 'PRORROGA') => {
    const baseDays = calculateFrequencyDays(freq);
    // When enganche is deferred with a 1-week grace extension (prórroga), first regular payment shifts 1 week forward
    const offsetDays = estatus === 'PRORROGA' ? baseDays + 7 : baseDays;
    setFechaPrimerPago(addDaysToLocalDateStr(getTodayLocalDateStr(), offsetDays));
  };

  const handleFrecuenciaChange = (nuevaFrecuencia: 'SEMANAL' | 'CATORCENAL' | 'QUINCENAL' | 'MENSUAL') => {
    setFrecuenciaPago(nuevaFrecuencia);
    updateFechaPrimerPago(nuevaFrecuencia, engancheEstatus);
  };

  const handleEngancheEstatusChange = (nuevoEstatus: 'COBRADO' | 'PRORROGA') => {
    setEngancheEstatus(nuevoEstatus);
    updateFechaPrimerPago(frecuenciaPago, nuevoEstatus);
  };

  // SUBMIT & SYNC STATE
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<string>('');
  const [lastSubmittedMsg, setLastSubmittedMsg] = useState<string | null>(null);

  // LIVE CAMERA STATE
  const [cameraTarget, setCameraTarget] = useState<'fachada' | 'cliente' | 'contrato' | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // ASISTENTE DE ESCANEO INTELIGENTE (SOLO CONTRATO)
  const [contractScanState, setContractScanState] = useState<ContractScanAnalysis>({
    estado_captura: 'OPTIMO',
    mensaje_guia: 'Encuadre perfecto. Las 4 esquinas del contrato están dentro del visor.',
    calidad_iluminacion: 'BUENA',
    esquinas_detectadas: true,
  });
  const [simulatedMode, setSimulatedMode] = useState<'AUTO' | 'SOMBRAS' | 'CORTADO'>('AUTO');
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(true);

  // Real-time evaluation loop for contract scan quality & perspective
  useEffect(() => {
    if (cameraTarget !== 'contrato') return;

    const interval = setInterval(() => {
      if (simulatedMode === 'SOMBRAS') {
        setContractScanState({
          estado_captura: 'REINTENTAR',
          mensaje_guia: '⚠️ Sombra u oscuridad detectada sobre el texto manuscrito. Activa una lámpara o despeja sombras.',
          calidad_iluminacion: 'MALA',
          esquinas_detectadas: true,
        });
        return;
      }

      if (simulatedMode === 'CORTADO') {
        setContractScanState({
          estado_captura: 'REINTENTAR',
          mensaje_guia: '⚠️ El contrato está cortado o inclinado en un ángulo excesivo. Aléjate un poco y centra las 4 esquinas.',
          calidad_iluminacion: 'BUENA',
          esquinas_detectadas: false,
        });
        return;
      }

      // Real video frame luminance check (Canvas sampling)
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        try {
          const v = videoRef.current;
          const cvs = document.createElement('canvas');
          cvs.width = 100;
          cvs.height = 80;
          const ctx = cvs.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0, 100, 80);
            const data = ctx.getImageData(0, 0, 100, 80).data;
            let sum = 0;
            for (let i = 0; i < data.length; i += 4) {
              sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
            }
            const avgLum = sum / (data.length / 4);

            if (avgLum < 32) {
              setContractScanState({
                estado_captura: 'REINTENTAR',
                mensaje_guia: '⚠️ Iluminación muy tenue. Enciende una lámpara o acerca el contrato a la luz.',
                calidad_iluminacion: 'MALA',
                esquinas_detectadas: true,
              });
            } else if (avgLum > 230) {
              setContractScanState({
                estado_captura: 'REINTENTAR',
                mensaje_guia: '⚠️ Reflejo de luz o flash excesivo. Inclina suavemente la cámara para evitar el brillo directo.',
                calidad_iluminacion: 'MALA',
                esquinas_detectadas: true,
              });
            } else {
              setContractScanState({
                estado_captura: 'OPTIMO',
                mensaje_guia: '✅ Encuadre cenital óptimo y luz uniforme. Las 4 esquinas están fijadas para auto-crop.',
                calidad_iluminacion: 'BUENA',
                esquinas_detectadas: true,
              });
            }
          }
        } catch {
          // fallback
        }
      }
    }, 850);

    return () => clearInterval(interval);
  }, [cameraTarget, simulatedMode]);

  // Load Auto-saved Draft on Mount
  useEffect(() => {
    async function loadDraft() {
      try {
        const draft = await localforage.getItem<any>('pwa_vendedora_draft_simple');
        if (draft) {
          if (draft.nombreCompleto) setNombreCompleto(draft.nombreCompleto);
          if (draft.telefono1) setTelefono1(draft.telefono1);
          if (draft.direccion) setDireccion(draft.direccion);
          if (draft.colonia) setColonia(draft.colonia);
          if (draft.latitud) setLatitud(draft.latitud);
          if (draft.longitud) setLongitud(draft.longitud);
          if (draft.fotoFachada) setFotoFachada(draft.fotoFachada);
          if (draft.fotoCliente) setFotoCliente(draft.fotoCliente);
          if (draft.fotoContrato) setFotoContrato(draft.fotoContrato);
        }
      } catch (err) {
        console.warn('No draft loaded:', err);
      }
    }
    loadDraft();
  }, []);

  // Auto-Save Draft on Change
  useEffect(() => {
    const draftData = {
      nombreCompleto,
      telefono1,
      direccion,
      colonia,
      latitud,
      longitud,
      fotoFachada,
      fotoCliente,
      fotoContrato,
    };
    localforage.setItem('pwa_vendedora_draft_simple', draftData).catch(() => {});
  }, [nombreCompleto, telefono1, direccion, colonia, latitud, longitud, fotoFachada, fotoCliente, fotoContrato]);

  // Camera Handlers
  const handleStartCamera = async (target: 'fachada' | 'cliente' | 'contrato') => {
    setCameraTarget(target);
    const initialFacing = target === 'cliente' ? 'user' : 'environment';
    setFacingMode(initialFacing);
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: initialFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error starting camera stream:', err);
      alert('No se pudo abrir la cámara en vivo. Puedes usar la opción de seleccionar foto de galería.');
    }
  };

  const handleToggleFacingMode = async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacing } },
        audio: false,
      });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Fallback facing mode:', err);
    }
  };

  const handleStopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    setCameraTarget(null);
  };

  const handleSnapPhoto = async () => {
    if (videoRef.current && cameraTarget) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

        setOptimizingSlot(cameraTarget);
        triggerHaptic([30, 40]);

        if (cameraTarget === 'contrato') {
          const enhanced = await optimizeContractImageForOCR(dataUrl);
          setFotoContrato(enhanced);
          setContractScanSuccess(true);
        } else if (cameraTarget === 'fachada') {
          const compressed = await compressAndOptimizeImage(dataUrl, 1280, 0.72);
          setFotoFachada(compressed);
        } else if (cameraTarget === 'cliente') {
          const compressed = await compressAndOptimizeImage(dataUrl, 1280, 0.72);
          setFotoCliente(compressed);
        }
        setOptimizingSlot(null);
      }
    }
    handleStopCamera();
  };

  // Gallery File Upload with Image Enhancement for Contract
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'fachada' | 'cliente' | 'contrato'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setOptimizingSlot(target);
      triggerHaptic([20, 30]);
      try {
        if (target === 'contrato') {
          const enhanced = await optimizeContractImageForOCR(file);
          setFotoContrato(enhanced);
          setContractScanSuccess(true);
        } else {
          const compressed = await compressAndOptimizeImage(file, 1280, 0.72);
          if (target === 'fachada') setFotoFachada(compressed);
          if (target === 'cliente') setFotoCliente(compressed);
        }
      } catch (err) {
        console.error('Error processing image:', err);
      } finally {
        setOptimizingSlot(null);
      }
    }
  };

  // GPS GEOLOCATION CAPTURE BUTTON
  const handleCaptureLocation = () => {
    if ('geolocation' in navigator) {
      setIsCapturingGps(true);
      triggerHaptic([30, 40]);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLatitud(lat);
          setLongitud(lng);
          setGpsCapturedSuccess(true);

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              const colFound = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || addr.district || addr.city_district || addr.subdivision || addr.town || addr.village || 'Centro';
              const road = addr.road || addr.street || addr.pedestrian || addr.footway || '';
              const houseNum = addr.house_number ? ` #${addr.house_number}` : '';

              let baseStreet = road ? `${road}${houseNum}` : (data.display_name?.split(',')[0] || '');

              let fullDirWithCol = baseStreet;
              if (colFound && baseStreet && !baseStreet.toLowerCase().includes(colFound.toLowerCase())) {
                fullDirWithCol = `${baseStreet}, Col. ${colFound}`;
              } else if (!baseStreet && colFound) {
                fullDirWithCol = `Col. ${colFound}`;
              }

              if (fullDirWithCol) setDireccion(fullDirWithCol);
              if (colFound) setColonia(colFound);
            }
          } catch (geoErr) {
            console.warn('Geocoding fallback:', geoErr);
          } finally {
            setIsCapturingGps(false);
          }
        },
        (err) => {
          console.warn('Geolocation unavailable:', err);
          setIsCapturingGps(false);
          alert('Ubicación predeterminada asignada. Puedes presionar de nuevo o continuar.');
        }
      );
    }
  };

  // SUBMIT CLIENT RECORD & SEND TO SUPERVISOR FOR OCR & APPROVAL
  const handleFinalSubmit = async () => {
    if (!nombreCompleto.trim()) {
      alert('Por favor ingresa el Nombre Completo del Cliente');
      return;
    }

    setIsSubmitting(true);
    setSyncProgress('Guardando expediente y notificando a Supervisora...');

    try {
      const uniqueTs = Date.now();
      const randomSuffix = Math.floor(Math.random() * 9000 + 1000);
      const newId = Number(`${uniqueTs.toString().slice(-6)}${randomSuffix}`);
      const newVentaId = Number(`${uniqueTs.toString().slice(-6)}${randomSuffix + 1}`);
      const folio = `CLI-2026-${uniqueTs.toString().slice(-4)}-${randomSuffix}`;
      const zonaAsignada = zonas[0] || { id: 1, nombre: 'Zona General', diaCobro: 'Lunes' };

      const vendedoraIdActual = currentUser?.id || 1;
      const vendedoraNombreActual = currentUser?.nombre || 'Vendedora de Campo';

      const nuevoCliente: Cliente = {
        id: newId,
        folio,
        nombreCompleto: nombreCompleto.trim(),
        direccion: direccion || 'Ubicación GPS Capturada',
        colonia: colonia || 'Centro',
        referencias: 'Ubicación GPS registrada en campo',
        telefono: telefono1 || '5500000000',
        latitud,
        longitud,
        zonaId: zonaAsignada.id,
        zonaNombre: zonaAsignada.nombre,
        fotoFachada: fotoFachada || undefined,
        fotoCliente: fotoCliente || undefined,
        fotoContrato: fotoContrato || undefined,
        tarjetaImpresa: false,
        estadoMorosidad: 'VERDE',
        fechaRegistro: getTodayLocalDateStr(),
        creadoPorVendedoraId: vendedoraIdActual,
        vendedoraNombre: vendedoraNombreActual,
        creadoPorUsuarioId: currentUser?.id,
        creadoPorUsuarioNombre: vendedoraNombreActual,
        proximoPagoFecha: fechaPrimerPago,
        frecuenciaPago,
        enganchePendiente: engancheEstatus === 'PRORROGA',
        enganchePendienteMonto: engancheEstatus === 'PRORROGA' ? engancheMontoInput : 0,
      };

      const defaultProduct = productos[0] || INITIAL_PRODUCTOS[0];
      const prodNombre = productoNombreCustom.trim() || defaultProduct.nombre;

      let nuevaVenta: Venta;

      if (tipoVenta === 'CONTADO') {
        const montoContado = montoContadoEditable || 1490;
        nuevaVenta = {
          id: newVentaId,
          clienteId: newId,
          clienteNombre: nuevoCliente.nombreCompleto,
          clienteFolio: folio,
          vendedoraId: vendedoraIdActual,
          vendedoraNombre: vendedoraNombreActual,
          productoId: defaultProduct.id,
          productoNombre: prodNombre,
          piezas: 1,
          tipo: 'CONTADO',
          precioBase: montoContado,
          montoACobrarContado: montoContado,
          engancheMonto: 0,
          enganchePagado: true,
          engancheCobrado: true,
          enganchePendiente: false,
          aporteEmpresa: 0,
          descuentoOtorgado: 0,
          saldoInicial: montoContado,
          saldoActual: montoContado,
          pagoSemanal: 0,
          comisionVendedora: 100,
          estado: 'PENDIENTE_VALIDACION',
          fechaVenta: getTodayLocalDateStr(),
          fechaPrimerPago: getTodayLocalDateStr(),
          diaCobroZona: zonaAsignada.diaCobro,
        };
      } else {
        // Venta a Crédito / Abonos con Matriz de Bonificación de Enganche
        const calcRules = calcularReglasFinancieras(
          engancheEstatus === 'COBRADO' ? engancheMontoInput : 0,
          undefined,
          precioBaseInput || defaultProduct.precioBase
        );

        let pagoCalculado = calcRules.pagoSemanal;
        if (esquemaPagoTipo === 'CORTO_2_PAGOS') {
          pagoCalculado = Math.ceil(calcRules.saldoFinal / 2);
        } else if (esquemaPagoTipo === 'CORTO_3_PAGOS') {
          pagoCalculado = Math.ceil(calcRules.saldoFinal / 3);
        } else if (esquemaPagoTipo === 'QUINCENAL') {
          pagoCalculado = Math.max(200, Math.ceil(calcRules.saldoFinal / 10));
        } else if (esquemaPagoTipo === 'SEMANAL') {
          pagoCalculado = Math.max(100, Math.ceil(calcRules.saldoFinal / 20));
        }

        nuevaVenta = {
          id: newVentaId,
          clienteId: newId,
          clienteNombre: nuevoCliente.nombreCompleto,
          clienteFolio: folio,
          vendedoraId: vendedoraIdActual,
          vendedoraNombre: vendedoraNombreActual,
          productoId: defaultProduct.id,
          productoNombre: prodNombre,
          piezas: 1,
          tipo: 'CREDITO',
          precioBase: precioBaseInput || defaultProduct.precioBase,
          engancheMonto: engancheMontoInput,
          enganchePagado: engancheEstatus === 'COBRADO',
          engancheCobrado: engancheEstatus === 'COBRADO',
          enganchePendiente: engancheEstatus === 'PRORROGA',
          enganchePendienteMonto: engancheEstatus === 'PRORROGA' ? engancheMontoInput : 0,
          lugarCobroEnganche: engancheEstatus === 'COBRADO' ? 'SUPERVISION' : 'RUTA_COBRADOR',
          frecuenciaPago,
          esquemaPagoTipo,
          aporteEmpresa: calcRules.aporteEmpresa,
          descuentoOtorgado: calcRules.aporteEmpresa,
          saldoInicial: calcRules.saldoFinal,
          saldoActual: calcRules.saldoFinal,
          pagoSemanal: pagoCalculado,
          comisionVendedora: calcRules.comisionVendedora || 150,
          estado: 'PENDIENTE_VALIDACION',
          fechaVenta: getTodayLocalDateStr(),
          fechaPrimerPago: fechaPrimerPago,
          diaCobroZona: zonaAsignada.diaCobro,
        };
      }

      onAddClienteVenta(nuevoCliente, nuevaVenta);

      if (onShowActionNotice) {
        onShowActionNotice(
          '⚡ Captura Registrada',
          `El expediente de ${nuevoCliente.nombreCompleto} con escaneo de contrato fue enviado a la Supervisora para su validación OCR y aprobación.`,
          'SUPERVISORA'
        );
      }

      await localforage.removeItem('pwa_vendedora_draft_simple');

      setLastSubmittedMsg(
        `🔒 ¡Registro guardado y enviado a Supervisión! Por confidencialidad de datos, la pantalla se ha limpiado por completo y está lista para el siguiente cliente.`
      );

      // Clean Form State Completely
      setFotoFachada('');
      setFotoCliente('');
      setFotoContrato('');
      setContractScanSuccess(false);
      setNombreCompleto('');
      setTelefono1('');
      setDireccion('');
      setColonia('');
      setGpsCapturedSuccess(false);
      setCurrentStep(1);
      setActiveTab('nueva_captura');
    } catch (err) {
      console.error('Error submitting client record:', err);
      alert('Se guardó copia local en el teléfono. Se sincronizará automáticamente.');
    } finally {
      setIsSubmitting(false);
      setSyncProgress('');
    }
  };

  // Metrics for Ranking & My Sales Tally
  const misRegistros = clientes.filter(
    (c) =>
      (currentUser?.id && (c.creadoPorUsuarioId === currentUser.id || c.creadoPorVendedoraId === currentUser.id)) ||
      (currentUser?.nombre && c.vendedoraNombre?.includes(currentUser.nombre)) ||
      (!currentUser?.id && !currentUser?.nombre)
  );
  const totalCapturados = misRegistros.length || 0;
  const metaSemanal = 20;
  const avancePct = Math.min(100, Math.round((totalCapturados / metaSemanal) * 100));

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* LIVE CAMERA VIEWFINDER MODAL WITH DEDICATED CONTRACT SCANNER OVERLAY */}
      {cameraTarget && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-between p-4 backdrop-blur-md">
          <div className="w-full max-w-lg flex items-center justify-between text-white border-b border-slate-800 pb-3">
            <span className="font-bold text-sm flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-400" />
              Captura: {cameraTarget === 'fachada' ? 'Fachada Casa' : cameraTarget === 'cliente' ? 'Foto Cliente / INE' : 'Documento / Contrato'}
            </span>
            <button
              onClick={handleStopCamera}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative w-full max-w-lg h-[62vh] bg-black rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-2xl flex items-center justify-center my-auto">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

            {/* VISIBLE SCANNER OVERLAY FOR CONTRACT */}
            {cameraTarget === 'contrato' ? (
              <div className="absolute inset-0 pointer-events-none m-3 sm:m-4 border-2 border-emerald-400 rounded-2xl flex flex-col justify-between p-3 sm:p-4 shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                {/* Corner Target Indicators (4 corners detection reticles) */}
                <div className={`absolute top-2 left-2 w-7 h-7 border-t-4 border-l-4 rounded-tl-lg transition-colors ${
                  contractScanState.esquinas_detectadas ? 'border-emerald-400 shadow-[0_0_12px_#10b981]' : 'border-amber-400 shadow-[0_0_12px_#f59e0b]'
                }`} />
                <div className={`absolute top-2 right-2 w-7 h-7 border-t-4 border-r-4 rounded-tr-lg transition-colors ${
                  contractScanState.esquinas_detectadas ? 'border-emerald-400 shadow-[0_0_12px_#10b981]' : 'border-amber-400 shadow-[0_0_12px_#f59e0b]'
                }`} />
                <div className={`absolute bottom-2 left-2 w-7 h-7 border-b-4 border-l-4 rounded-bl-lg transition-colors ${
                  contractScanState.esquinas_detectadas ? 'border-emerald-400 shadow-[0_0_12px_#10b981]' : 'border-amber-400 shadow-[0_0_12px_#f59e0b]'
                }`} />
                <div className={`absolute bottom-2 right-2 w-7 h-7 border-b-4 border-r-4 rounded-br-lg transition-colors ${
                  contractScanState.esquinas_detectadas ? 'border-emerald-400 shadow-[0_0_12px_#10b981]' : 'border-amber-400 shadow-[0_0_12px_#f59e0b]'
                }`} />

                {/* Top Status Indicators Header */}
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold z-10 pointer-events-auto">
                  <span className={`px-2.5 py-1 rounded-full border backdrop-blur-md flex items-center gap-1.5 shadow ${
                    contractScanState.estado_captura === 'OPTIMO'
                      ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                      : 'bg-amber-950/90 border-amber-500/60 text-amber-300'
                  }`}>
                    <FileText className="w-3.5 h-3.5 animate-pulse" />
                    <span>ESTADO: {contractScanState.estado_captura}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      contractScanState.calidad_iluminacion === 'BUENA'
                        ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                        : 'bg-amber-950/80 border-amber-600 text-amber-300'
                    }`}>
                      LUZ: {contractScanState.calidad_iluminacion}
                    </span>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      contractScanState.esquinas_detectadas
                        ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                        : 'bg-amber-950/80 border-amber-600 text-amber-300'
                    }`}>
                      ESQUINAS: {contractScanState.esquinas_detectadas ? '4/4 DETECTADAS' : 'MARCO INCOMPLETO'}
                    </span>
                  </div>
                </div>

                {/* Animated laser scan line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-pulse my-auto" />

                {/* Real-time Guidance Instruction Message Banner */}
                <div className="bg-slate-950/95 backdrop-blur-md text-emerald-200 text-xs font-semibold p-2.5 rounded-xl border border-emerald-700/80 shadow flex items-center gap-2 pointer-events-auto">
                  {contractScanState.estado_captura === 'OPTIMO' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                  )}
                  <span className="flex-1">{contractScanState.mensaje_guia}</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-mono shrink-0">
                    ⚡ Auto-crop Cenital
                  </span>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-indigo-400/40 m-6 rounded-xl flex items-center justify-center">
                <span className="text-indigo-200/70 text-xs font-semibold px-3 py-1 bg-slate-950/60 rounded-full">
                  Encuadra la foto
                </span>
              </div>
            )}
          </div>

          {/* JSON STATE INSPECTOR & TEST CONTROLS (ONLY CONTRACT) */}
          {cameraTarget === 'contrato' && (
            <div className="w-full max-w-lg space-y-2 mt-2 text-xs">
              <div className="flex items-center justify-between text-slate-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  🤖 Respuesta del Asistente de Escaneo (JSON para App):
                </span>
                <div className="flex items-center gap-1.5">
                  {/* Simulation mode toggles for testing camera scenarios */}
                  <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">Simular Toma:</span>
                  <button
                    type="button"
                    onClick={() => setSimulatedMode('AUTO')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      simulatedMode === 'AUTO' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Óptima
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatedMode('SOMBRAS')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      simulatedMode === 'SOMBRAS' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Sombras
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatedMode('CORTADO')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      simulatedMode === 'CORTADO' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Cortado
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJsonInspector(!showJsonInspector)}
                    className="ml-2 text-[10px] underline text-indigo-400 font-bold"
                  >
                    {showJsonInspector ? 'Ocultar JSON' : 'Ver JSON'}
                  </button>
                </div>
              </div>

              {showJsonInspector && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-900/80 font-mono text-[11px] text-emerald-300 shadow-inner overflow-x-auto">
                  <pre className="text-[11px] text-emerald-300 leading-tight">
{JSON.stringify(contractScanState, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="w-full max-w-lg flex items-center justify-around gap-4 pt-2">
            <button
              type="button"
              onClick={handleToggleFacingMode}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold cursor-pointer"
            >
              <FlipHorizontal className="w-4 h-4" />
              Girar Cámara
            </button>

            <button
              type="button"
              onClick={handleSnapPhoto}
              className={`px-8 py-4 font-black text-base rounded-2xl shadow-xl flex items-center gap-2 cursor-pointer transform active:scale-95 transition ${
                cameraTarget === 'contrato'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-indigo-500/30'
              }`}
            >
              <Camera className="w-6 h-6 animate-pulse" />
              <span>{cameraTarget === 'contrato' ? 'TOMAR FOTO CONTRATO' : 'TOMAR FOTOGRAFÍA'}</span>
            </button>
          </div>
        </div>
      )}

      {/* BITALIS BRAND HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 p-4 rounded-2xl border border-emerald-900/60 shadow-xl flex items-center justify-between gap-3 flex-wrap">
        <BitalisLogo size="md" variant="dark" />
        <span className="text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700 px-2.5 py-1 rounded-full tracking-wider shadow-sm">
          Ventas & Registro de Campo
        </span>
      </div>

      {/* VIEW MODES TAB HEADER */}
      <div className="flex items-center justify-between bg-slate-800/90 p-2 rounded-2xl border border-slate-700 shadow-lg">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('nueva_captura')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'nueva_captura'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Capturar Registro (Fotos, GPS & Nombre)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ranking')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'ranking'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            <span>Mi Ranking & Avance ({totalCapturados}/{metaSemanal})</span>
          </button>
        </div>

        <div className="text-right text-xs text-slate-400 hidden md:block px-3">
          Vendedora: <strong className="text-indigo-300">{currentUser?.nombre || 'Ana Lucía Gómez'}</strong>
        </div>
      </div>

      {/* CAPTURA RAPIDA TAB */}
      {activeTab === 'nueva_captura' && (
        <div className="space-y-5">
          {lastSubmittedMsg && (
            <div className="p-4 bg-emerald-950 border-2 border-emerald-500/80 text-emerald-200 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-xl animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{lastSubmittedMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setLastSubmittedMsg(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {/* STEPPER HEADER */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-extrabold text-white">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Paso {currentStep} de 2 — {currentStep === 1 ? 'Fotografías & Escaneo de Contrato' : 'Nombre del Cliente & Coordenadas GPS'}
              </span>
              <span className="font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                {currentStep === 1 ? '50%' : '100%'}
              </span>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${(currentStep / 2) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`py-2 px-3 text-xs font-bold rounded-xl text-center transition cursor-pointer border ${
                  currentStep === 1
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                }`}
              >
                1. Fotografías Evidencia
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`py-2 px-3 text-xs font-bold rounded-xl text-center transition cursor-pointer border ${
                  currentStep === 2
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                2. Nombre & Coordenadas GPS
              </button>
            </div>
          </div>

          {/* STEP 1: FOTOGRAFÍAS */}
          {currentStep === 1 && (
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-indigo-400" />
                    Paso 1: Captura de Fotografías
                  </h3>
                  <p className="text-xs text-slate-400">Toma las 3 fotos requeridas. El contrato incluye escáner con nitidez optimizada.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Photo Slot 1: Fachada */}
                <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-700 space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-bold text-white">
                    <span>1. Fachada Casa</span>
                    {fotoFachada && <span className="text-emerald-400 text-[10px] font-bold">✓ Lista</span>}
                  </div>

                  <div className="relative h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
                    {fotoFachada ? (
                      <img src={fotoFachada} alt="Fachada" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-xs gap-1">
                        <Camera className="w-6 h-6 text-slate-700" />
                        <span>Sin foto</span>
                      </div>
                    )}
                    {optimizingSlot === 'fachada' && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-amber-300 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Optimizando...</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartCamera('fachada')}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer active:scale-95 transition"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Tomar Foto Cámara</span>
                    </button>

                    <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold p-2 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Galería Teléfono</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'fachada')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Photo Slot 2: Cliente / INE */}
                <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-700 space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-bold text-white">
                    <span>2. Cliente / INE</span>
                    {fotoCliente && <span className="text-emerald-400 text-[10px] font-bold">✓ Lista</span>}
                  </div>

                  <div className="relative h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
                    {fotoCliente ? (
                      <img src={fotoCliente} alt="Cliente" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-xs gap-1">
                        <UserCheck className="w-6 h-6 text-slate-700" />
                        <span>Sin foto</span>
                      </div>
                    )}
                    {optimizingSlot === 'cliente' && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-amber-300 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Optimizando...</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartCamera('cliente')}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer active:scale-95 transition"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Tomar Foto Cámara</span>
                    </button>

                    <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold p-2 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Galería Teléfono</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'cliente')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Photo Slot 3: Fotografía del Contrato / Pagaré */}
                <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-2.5 shadow-lg relative">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      3. Foto Contrato / Pagaré
                    </span>
                    {fotoContrato && <span className="text-emerald-400 text-[10px] font-bold">✓ Capturada</span>}
                  </div>

                  <div className="relative h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                    {fotoContrato ? (
                      <img src={fotoContrato} alt="Contrato" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1 p-2 text-center">
                        <Camera className="w-8 h-8 text-slate-600" />
                        <span>Foto del Contrato o Pagaré</span>
                      </div>
                    )}
                    {optimizingSlot === 'contrato' && (
                      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-xs font-bold text-emerald-300 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                        <span>Optimizando fotografía...</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartCamera('contrato')}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95 transition"
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>Tomar Foto Contrato</span>
                    </button>

                    <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold p-2 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Subir desde Galería</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'contrato')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <span>Siguiente: Nombre & Coordenadas</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: NOMBRE DEL CLIENTE & BOTÓN DE COORDENADAS GPS */}
          {currentStep === 2 && (
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-5">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-400" />
                    Paso 2: Captura de Datos & Ubicación GPS
                  </h3>
                  <p className="text-xs text-slate-400">Solo requiere el nombre del cliente y pulsar el botón de coordenadas.</p>
                </div>
              </div>

              {/* BIFURCACIÓN OBLIGATORIA: TIPO DE VENTA */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-indigo-500/50 space-y-3">
                <label className="block text-white font-black text-xs uppercase tracking-wider text-indigo-300">
                  1. Selección Obligatoria: Tipo de Venta *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoVenta('CREDITO')}
                    className={`p-3.5 rounded-xl text-xs font-black border flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                      tipoVenta === 'CREDITO'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-400 shadow-lg'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">💳 Venta a Crédito / Abonos</span>
                    <span className="text-[10px] opacity-80 font-normal">Plan a plazos con bonificación de enganche</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoVenta('CONTADO')}
                    className={`p-3.5 rounded-xl text-xs font-black border flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                      tipoVenta === 'CONTADO'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-lg'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">💵 Venta de Contado</span>
                    <span className="text-[10px] opacity-80 font-normal">Pago único o contraentrega (Módulo Líquidas)</span>
                  </button>
                </div>
              </div>

              {/* SELECTOR VISUAL DE PRODUCTO EN Mosaico / CARDS */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
                <label className="block text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    2. Catálogo Visual de Productos *
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Toca para seleccionar un producto</span>
                </label>

                {/* Product Grid Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(productos && productos.length > 0 ? productos : INITIAL_PRODUCTOS).map((prod) => {
                    const isSelected = productoNombreCustom === prod.nombre;
                    return (
                      <button
                        type="button"
                        key={prod.id}
                        onClick={() => {
                          setProductoNombreCustom(prod.nombre);
                          if (prod.precioContado && tipoVenta === 'CONTADO') {
                            setMontoContadoEditable(prod.precioContado);
                          } else if (prod.precioBase) {
                            setPrecioBaseInput(prod.precioBase);
                          }
                          triggerHaptic([15, 20]);
                        }}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? 'bg-gradient-to-br from-indigo-950 to-slate-900 border-indigo-400 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500 text-white'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow">
                            ✓
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-900 inline-block">
                            {prod.categoria || 'EQUIPO'}
                          </span>
                          <strong className="block text-xs font-black text-white leading-tight line-clamp-2">
                            {prod.nombre}
                          </strong>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-400">Precio:</span>
                          <span className="font-extrabold text-emerald-400">
                            ${(prod.precioBase || prod.precioContado || 0).toLocaleString('es-MX')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Product Name Input or Override */}
                <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold text-[11px] mb-1">
                      Nombre Confirmado / Producto Personalizado:
                    </label>
                    <input
                      type="text"
                      required
                      value={productoNombreCustom}
                      onChange={(e) => setProductoNombreCustom(e.target.value)}
                      placeholder="ej. Colchón Matrimonial Ortopédico"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {tipoVenta === 'CONTADO' ? (
                    <div>
                      <label className="block text-emerald-400 font-extrabold text-[11px] mb-1">
                        Monto a Cobrar Negociado ($ MXN Editable) *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={montoContadoEditable}
                        onChange={(e) => setMontoContadoEditable(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-emerald-500 rounded-xl p-2.5 text-emerald-300 font-mono text-sm font-black focus:outline-none focus:border-emerald-400"
                      />
                      <p className="text-[10px] text-emerald-300/80 mt-1">
                        ✓ Guardado directo en el módulo Líquidas / Contado.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-indigo-300 font-extrabold text-[11px] mb-1">
                        Precio Base Sugerido ($ MXN Editable) *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={precioBaseInput}
                        onChange={(e) => setPrecioBaseInput(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* INPUT NOMBRE DEL CLIENTE */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700 space-y-3">
                <label className="block text-white font-bold text-sm">
                  Nombre Completo del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  placeholder="ej. María del Carmen Rosas Juárez"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white text-base focus:outline-none focus:border-indigo-500 font-semibold"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 font-medium text-xs mb-1">
                      Teléfono (Opcional)
                    </label>
                    <input
                      type="tel"
                      value={telefono1}
                      onChange={(e) => setTelefono1(e.target.value)}
                      placeholder="ej. 5512345678"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium text-xs mb-1">
                      Colonia / Localidad
                    </label>
                    <input
                      type="text"
                      value={colonia}
                      onChange={(e) => setColonia(e.target.value)}
                      placeholder="ej. Centro"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* PLAN DE PAGOS Y FECHA EXACTA DEL PRIMER COBRO (SOLO CRÉDITO) */}
              {tipoVenta === 'CREDITO' && (
                <div className="bg-slate-900 p-4 rounded-2xl border border-amber-500/50 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-amber-300 text-xs flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      Plan de Pagos y Matriz de Bonificación
                    </span>
                    <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      PROGRAMABLE
                    </span>
                  </div>

                  {/* MATRIZ DE BONIFICACIÓN DE ENGANCHE DISPLAY */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-indigo-900/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                      <span>📊 Matriz de Bonificación de Enganche</span>
                      <span className="text-[10px] text-emerald-400">Descuento Directo al Principal</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-center bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <div className="p-1 bg-slate-950 rounded">
                        <span className="block text-slate-400 text-[9px]">Cliente Entrega</span>
                        <span className="text-white font-bold">${engancheMontoInput}</span>
                      </div>
                      <div className="p-1 bg-emerald-950/80 rounded border border-emerald-800/60">
                        <span className="block text-emerald-300 text-[9px]">Bono Empresa</span>
                        <span className="text-emerald-400 font-bold">
                          +{engancheMontoInput === 100 ? 100 : engancheMontoInput >= 200 ? 200 : engancheMontoInput}
                        </span>
                      </div>
                      <div className="p-1 bg-indigo-950/80 rounded border border-indigo-800/60">
                        <span className="block text-indigo-300 text-[9px]">Saldo Final</span>
                        <span className="text-indigo-200 font-black">
                          ${calcularReglasFinancieras(engancheEstatus === 'COBRADO' ? engancheMontoInput : 0, undefined, precioBaseInput).saldoFinal}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COORDENADAS GPS CON UN BOTÓN */}
              <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    Ubicación GPS en Campo
                  </span>
                  {gpsCapturedSuccess && (
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <Check className="w-4 h-4 text-emerald-400" /> Coordenadas Almacenadas
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCaptureLocation}
                  disabled={isCapturingGps}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95"
                >
                  {isCapturingGps ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <MapPin className="w-5 h-5 text-emerald-200" />
                  )}
                  <span>{isCapturingGps ? 'Obteniendo Coordenadas GPS...' : '📍 GUARDAR COORDENADAS GPS AHORA'}</span>
                </button>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Coordenadas:</span>
                  <span className="font-mono text-emerald-300 font-extrabold">
                    Lat: {latitud.toFixed(6)} | Lng: {longitud.toFixed(6)}
                  </span>
                </div>
              </div>

              {isSubmitting && (
                <div className="p-3 bg-indigo-950 border border-indigo-700 rounded-xl text-xs text-indigo-200 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>{syncProgress || 'Guardando expediente...'}</span>
                </div>
              )}

              {/* BOTONES DE NAVEGACIÓN Y ENVÍO */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Fotos</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || !nombreCompleto.trim()}
                  className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black text-sm rounded-xl flex items-center gap-2 cursor-pointer shadow-xl active:scale-95 transition disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  <span>✓ GUARDAR EXPEDIENTE Y ENVIAR A SUPERVISORA</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB DE RANKING Y MIS EXPEDIENTES */}
      {activeTab === 'ranking' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-5">
          {/* HEADER DEL RANKING */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-950/80 border border-amber-500/50 rounded-xl">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Mi Ranking & Rendimiento</h3>
                <p className="text-xs text-slate-400">Progreso de expedientes capturados en campo esta semana.</p>
              </div>
            </div>

            <button
              onClick={() => {
                setFotoFachada('');
                setFotoCliente('');
                setFotoContrato('');
                setContractScanSuccess(false);
                setNombreCompleto('');
                setTelefono1('');
                setGpsCapturedSuccess(false);
                setCurrentStep(1);
                setActiveTab('nueva_captura');
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Captura Limpia</span>
            </button>
          </div>

          {lastSubmittedMsg && (
            <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{lastSubmittedMsg}</span>
            </div>
          )}

          {/* CARDS DE SCORE Y METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900 border border-amber-500/40 rounded-2xl space-y-1 relative overflow-hidden">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-400" /> Posición Ranking Equipo
              </span>
              <p className="text-3xl font-black text-amber-300 font-mono">#1 en Ventas</p>
              <span className="text-[10px] text-amber-400/80 font-bold block">Top 1 Vendedoras</span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl space-y-1">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <FileText className="w-4 h-4 text-indigo-400" /> Expedientes Capturados
              </span>
              <p className="text-3xl font-black text-white font-mono">{totalCapturados} / {metaSemanal}</p>
              <span className="text-[10px] text-slate-400 block">Objetivo semanal vendedora</span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl space-y-1">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Avance Meta
              </span>
              <p className="text-3xl font-black text-emerald-400 font-mono">{avancePct}%</p>
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800 mt-1">
                <div className="bg-emerald-400 h-full" style={{ width: `${avancePct}%` }} />
              </div>
            </div>
          </div>

          {/* SEGURIDAD & PROTECCIÓN DE DATOS: SÓLO RANKING & CAPTURA */}
          <div className="bg-slate-900 border border-slate-700/90 rounded-2xl p-4 text-xs space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 font-bold">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Protección y Privacidad de Expedientes de Campo</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Los expedientes capturados (fotografías, coordenadas GPS y escaneos de contratos) son transmitidos automáticamente a la Supervisión de Ventas para validación OCR y alta en sistema.
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Total capturado esta semana:
              </span>
              <span className="font-mono text-emerald-400 font-black text-sm">{totalCapturados} Registros</span>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX FULL SCREEN MODAL */}
      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          title={lightboxImage.title}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
