'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Camera,
  Upload,
  LocateFixed,
  CheckCircle2,
  X,
  Loader2,
  Home,
  Navigation,
  FileText,
  Building,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Cliente } from '@/types';
import { triggerHaptic } from '@/lib/utils';
import { compressAndOptimizeImage } from './VendedoraView';
import { useTouchGestures } from '@/lib/useTouchGestures';

interface EditarUbicacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
  onSave: (clienteActualizado: Cliente) => void;
}

export default function EditarUbicacionModal({
  isOpen,
  onClose,
  cliente,
  onSave,
}: EditarUbicacionModalProps) {
  const [direccion, setDireccion] = useState<string>('');
  const [colonia, setColonia] = useState<string>('');
  const [entreCalles, setEntreCalles] = useState<string>('');
  const [referencias, setReferencias] = useState<string>('');
  const [latitud, setLatitud] = useState<number>(0);
  const [longitud, setLongitud] = useState<number>(0);
  const [fotoFachada, setFotoFachada] = useState<string>('');

  // GPS loading state
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [prevClienteId, setPrevClienteId] = useState<number | null>(null);

  const touchRef = useTouchGestures({
    onSwipeRight: () => onClose(),
    onSwipeDown: () => onClose(),
    enabled: isOpen && !!cliente,
  });

  if (isOpen && cliente && cliente.id !== prevClienteId) {
    setPrevClienteId(cliente.id);
    setDireccion(cliente.direccion || '');
    setColonia(cliente.colonia || '');
    setEntreCalles(cliente.entreCalles || '');
    setReferencias(cliente.referencias || '');
    setLatitud(cliente.latitud || 0);
    setLongitud(cliente.longitud || 0);
    setFotoFachada(cliente.fotoFachada || '');
    setGpsMessage(null);
    setSaveSuccess(false);
  }

  if (!isOpen || !cliente) return null;

  // Pull exact GPS coordinates from browser Geolocation API
  const handleJalarCoordenadasGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage('Geolocalización no soportada en este navegador.');
      return;
    }

    setIsGettingGps(true);
    setGpsMessage('Capturando coordenadas GPS actuales del dispositivo...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = Number(pos.coords.latitude.toFixed(6));
        const newLng = Number(pos.coords.longitude.toFixed(6));
        setLatitud(newLat);
        setLongitud(newLng);
        setIsGettingGps(false);
        setGpsMessage(`📍 Coordenadas capturadas con exito: ${newLat}, ${newLng}`);
        triggerHaptic();
      },
      (err) => {
        console.error('Error al obtener GPS:', err);
        setIsGettingGps(false);
        setGpsMessage('No se pudo obtener el GPS. Asegúrate de otorgar permisos de ubicación.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Upload or capture new Fachada photo
  const handleFotoFachadaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressed = await compressAndOptimizeImage(file, 1280, 0.72);
      setFotoFachada(compressed);
      triggerHaptic();
    } catch (err) {
      console.error('Error al procesar la fotografía:', err);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) return;

    const fechaActual = new Date().toISOString();
    const clienteActualizado: Cliente = {
      ...cliente,
      direccion: direccion.trim(),
      colonia: colonia.trim(),
      entreCalles: entreCalles.trim(),
      referencias: referencias.trim(),
      latitud: Number(latitud) || cliente.latitud,
      longitud: Number(longitud) || cliente.longitud,
      fotoFachada: fotoFachada.trim() || cliente.fotoFachada,
      fotosEditadasPorNombre: 'Cobrador en Campo',
      fotosEditadasFecha: fechaActual,
    };

    onSave(clienteActualizado);
    setSaveSuccess(true);
    triggerHaptic();
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div ref={touchRef} className="relative w-full max-w-2xl bg-slate-900 border border-indigo-500/60 rounded-3xl shadow-2xl overflow-hidden my-6 select-none">
        {/* MOBILE TOUCH DRAG HANDLE */}
        <div className="w-12 h-1.5 bg-slate-600/80 hover:bg-slate-500 rounded-full mx-auto my-1.5 shrink-0 cursor-pointer transition" onClick={onClose} title="Desliza o toca para cerrar" />

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 p-4 sm:p-5 border-b border-indigo-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/50 rounded-2xl text-indigo-300 shadow-md">
              <MapPin className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {cliente.folio}
                </span>
                <span className="text-xs text-slate-400 font-medium">Actualización en Campo</span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                Editar Ubicación, Entre Calles y Fachada
              </h3>
              <p className="text-xs text-slate-300 truncate max-w-sm sm:max-w-md">
                {cliente.nombreCompleto}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          
          {/* Section 1: GPS Auto Pull Button & Coordinates */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-indigo-400" />
                  <span>Geolocalización GPS Actual</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Presiona el botón estando afuera del domicilio para jalar automáticamente la ubicación exacta.
                </p>
              </div>

              <button
                type="button"
                onClick={handleJalarCoordenadasGps}
                disabled={isGettingGps}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-indigo-400/40 disabled:opacity-50 active:scale-95"
              >
                {isGettingGps ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <LocateFixed className="w-4 h-4 text-emerald-300" />
                )}
                <span>{isGettingGps ? 'Capturando GPS...' : '📍 Jalar Coordenadas GPS'}</span>
              </button>
            </div>

            {gpsMessage && (
              <div className="p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-xs font-semibold text-indigo-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{gpsMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Latitud GPS</label>
                <input
                  type="number"
                  step="any"
                  value={latitud}
                  onChange={(e) => setLatitud(Number(e.target.value))}
                  placeholder="ej. 19.4326"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Longitud GPS</label>
                <input
                  type="number"
                  step="any"
                  value={longitud}
                  onChange={(e) => setLongitud(Number(e.target.value))}
                  placeholder="ej. -99.1332"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Address, Colony & Entre Calles */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Home className="w-4 h-4 text-emerald-400" />
              <span>Dirección y Referencias del Domicilio</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dirección (Calle y Número) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="ej. Calle Hidalgo #245"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Colonia</span>
                  </label>
                  <input
                    type="text"
                    value={colonia}
                    onChange={(e) => setColonia(e.target.value)}
                    placeholder="ej. Centro"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-indigo-300 font-bold mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Entre Calles (Cruzamientos)</span>
                  </label>
                  <input
                    type="text"
                    value={entreCalles}
                    onChange={(e) => setEntreCalles(e.target.value)}
                    placeholder="ej. Entre Av. Juárez y Calle Morelos"
                    className="w-full bg-slate-900 border border-indigo-500/70 rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Referencias Específicas del Domicilio
                </label>
                <input
                  type="text"
                  value={referencias}
                  onChange={(e) => setReferencias(e.target.value)}
                  placeholder="ej. Casa de 2 pisos, portón blanco, junto a la tienda Abarrotes Lupita"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Fachada Photo Camera/Upload */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Fotografía de la Fachada (Cambio de Apariencia)</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">Por si pintaron o modificaron la vivienda</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* Photo Preview */}
              <div className="sm:col-span-5 relative h-36 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
                {fotoFachada ? (
                  <img
                    src={fotoFachada}
                    alt="Nueva Fachada"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center space-y-1 p-3">
                    <Home className="w-8 h-8 text-slate-600 mx-auto" />
                    <span className="text-[11px] text-slate-500 block">Sin fotografía de fachada registrada</span>
                  </div>
                )}

                {isCompressingPhoto && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center text-xs text-indigo-200">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-1" />
                    <span>Optimizando foto...</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="sm:col-span-7 space-y-2">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Si la fachada de la casa cambió de color, portón o estructura, toma una foto actualizada desde la cámara de tu teléfono.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <label className="flex-1 min-h-[40px] px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow transition flex items-center justify-center gap-1.5 active:scale-95">
                    <Camera className="w-4 h-4" />
                    <span>Tomar Foto Cámara</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFotoFachadaUpload}
                      className="hidden"
                    />
                  </label>

                  <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    <span>Subir Archivo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFotoFachadaUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saveSuccess}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveSuccess ? '¡Guardado con Éxito!' : 'Guardar Nueva Ubicación y Fachada'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
