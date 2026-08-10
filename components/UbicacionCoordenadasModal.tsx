'use client';

import { useState } from 'react';
import { Cliente } from '@/types';
import { MapPin, Navigation, ExternalLink, Save, X, CheckCircle2, AlertCircle, Sparkles, Copy } from 'lucide-react';

interface UbicacionCoordenadasModalProps {
  cliente: Cliente;
  onSave: (clienteActualizado: Cliente) => void;
  onClose: () => void;
}

export default function UbicacionCoordenadasModal({
  cliente,
  onSave,
  onClose,
}: UbicacionCoordenadasModalProps) {
  // Input states
  const [coordenadasTexto, setCoordenadasTexto] = useState<string>(
    cliente.latitud && cliente.longitud ? `${cliente.latitud}, ${cliente.longitud}` : ''
  );
  const [latitud, setLatitud] = useState<number>(cliente.latitud || 19.4326);
  const [longitud, setLongitud] = useState<number>(cliente.longitud || -99.1332);
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [copiedStatus, setCopiedStatus] = useState<boolean>(false);

  // Parse glued coordinate string (e.g. "19.432608, -99.133209" or "https://maps.google.com/?q=19.4326,-99.1332")
  const parseCoordinatesInput = (input: string) => {
    setCoordenadasTexto(input);
    setGpsError(null);

    if (!input.trim()) return;

    // Check if input has Google Maps URL
    let textToParse = input;
    if (input.includes('@')) {
      const match = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          setLatitud(lat);
          setLongitud(lng);
          return;
        }
      }
    } else if (input.includes('q=')) {
      const match = input.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          setLatitud(lat);
          setLongitud(lng);
          return;
        }
      }
    }

    // Standard comma or space separated numbers
    const parts = textToParse.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const parsedLat = parseFloat(parts[0]);
      const parsedLng = parseFloat(parts[1]);

      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        if (parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180) {
          setLatitud(parsedLat);
          setLongitud(parsedLng);
        } else {
          setGpsError('Las coordenadas ingresadas están fuera de rango (-90 a 90 para latitud, -180 a 180 para longitud).');
        }
      }
    }
  };

  // Get GPS current position
  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Este dispositivo no soporta geolocalización GPS automática.');
      return;
    }

    setIsCapturingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitud(lat);
        setLongitud(lng);
        setCoordenadasTexto(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        setIsCapturingGps(false);
      },
      (err) => {
        setIsCapturingGps(false);
        setGpsError(`No se pudo obtener la ubicación GPS: ${err.message}. Puedes ingresar las coordenadas manualmente.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCopyCoordinates = () => {
    const text = `${latitud}, ${longitud}`;
    navigator.clipboard.writeText(text);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(latitud) || isNaN(longitud)) {
      setGpsError('Debes ingresar coordenadas latitud y longitud válidas.');
      return;
    }

    if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
      setGpsError('Las coordenadas son inválidas.');
      return;
    }

    const clienteActualizado: Cliente = {
      ...cliente,
      latitud,
      longitud,
    };

    onSave(clienteActualizado);
    onClose();
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl text-white shadow-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Alta / Registro de Ubicación GPS</h3>
              <p className="text-xs text-slate-400">
                Cliente: <span className="text-indigo-300 font-bold">{cliente.nombreCompleto}</span> ({cliente.folio})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Quick Glued Input Option */}
          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-200 font-bold flex items-center gap-1.5 text-xs">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Ingreso Rápido por Texto o Google Maps Link:</span>
              </label>
              <span className="text-[10px] text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-800 font-medium">
                Pega latitud, longitud o link
              </span>
            </div>

            <input
              type="text"
              placeholder="Ej: 19.432608, -99.133209 o pega enlace de Google Maps"
              value={coordenadasTexto}
              onChange={(e) => parseCoordinatesInput(e.target.value)}
              className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">
              Copia directamente las coordenadas desde Google Maps (ejemplo: <span className="text-indigo-300 font-mono">19.432608, -99.133209</span>) y se extraerán automáticamente.
            </p>
          </div>

          {/* Separated Lat / Lng inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Latitud (Lat) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitud}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setLatitud(val);
                  setCoordenadasTexto(`${val}, ${longitud}`);
                }}
                placeholder="19.432608"
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Longitud (Lng) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={longitud}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setLongitud(val);
                  setCoordenadasTexto(`${latitud}, ${val}`);
                }}
                placeholder="-99.133209"
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* GPS Auto capture button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleGetCurrentGps}
              disabled={isCapturingGps}
              className="flex-1 min-h-[42px] bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold px-3 py-2 rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Navigation className={`w-4 h-4 text-indigo-400 ${isCapturingGps ? 'animate-spin' : ''}`} />
              <span>{isCapturingGps ? 'Obteniendo GPS...' : '📍 Capturar GPS de mi Dispositivo'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="min-h-[42px] px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Copiar Coordenadas"
            >
              {copiedStatus ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          {/* Error notice if any */}
          {gpsError && (
            <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-3 rounded-xl flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Google Maps Preview Card */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-slate-400 font-semibold block text-[11px]">Ubicación Resultante:</span>
              <span className="text-white font-mono font-bold text-xs">
                Lat: {latitud}, Lng: {longitud}
              </span>
            </div>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[38px] px-3 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver en Maps</span>
            </a>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-black shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Ubicación</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
