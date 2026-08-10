'use client';

import { useState, useMemo, useEffect } from 'react';
import { Cliente, Zona, Venta, Abono, DiaSemana, calcularDistanciaKm } from '@/types';
import InteractiveMap from './InteractiveMap';
import {
  Navigation,
  MapPin,
  Compass,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Save,
  Printer,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Layers,
  FileText,
  Search,
  Filter,
  DollarSign,
  User,
  ShieldAlert,
  Sliders,
  ChevronRight,
  Route,
  Zap,
  Building,
  Edit3
} from 'lucide-react';

interface GestionRutasViewProps {
  clientes: Cliente[];
  zonas: Zona[];
  ventas: Venta[];
  abonos: Abono[];
  onUpdateCliente?: (cliente: Cliente) => void;
  onSaveZona?: (zona: Zona) => void;
}

export default function GestionRutasView({
  clientes,
  zonas,
  ventas,
  abonos,
  onUpdateCliente,
  onSaveZona,
}: GestionRutasViewProps) {
  // Selected zone
  const [selectedZonaId, setSelectedZonaId] = useState<number>(zonas[0]?.id || 1);
  const selectedZona = useMemo(() => {
    return zonas.find((z) => z.id === selectedZonaId) || zonas[0];
  }, [zonas, selectedZonaId]);

  // Clients in the selected zone sorted by ordenRuta
  const defaultSortedClientsForZone = useMemo(() => {
    const targetZonaClients = clientes.filter((c) => c.zonaId === selectedZonaId);
    return [...targetZonaClients].sort((a, b) => {
      const orderA = a.ordenRuta ?? 999;
      const orderB = b.ordenRuta ?? 999;
      return orderA - orderB;
    });
  }, [clientes, selectedZonaId]);

  // Local sequence state for ordering clients
  const [customOrderedClients, setCustomOrderedClients] = useState<Cliente[] | null>(null);

  // Active ordered clients list
  const orderedClients = customOrderedClients || defaultSortedClientsForZone;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColoniaFilter, setSelectedColoniaFilter] = useState<string>('TODAS');
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState<{ [clienteId: number]: string }>({});
  const [activeStepHoverId, setActiveStepHoverId] = useState<number | null>(null);

  // Master Street Sequence for the Zone
  const [secuenciaCallesInput, setSecuenciaCallesInput] = useState<string>('');
  const [isEditingStreetSequence, setIsEditingStreetSequence] = useState(false);

  // Handle Zone Selection change
  const handleSelectZona = (newZonaId: number) => {
    setSelectedZonaId(newZonaId);
    setCustomOrderedClients(null);

    const targetZona = zonas.find((z) => z.id === newZonaId);
    const targetZonaClients = clientes.filter((c) => c.zonaId === newZonaId);

    if (targetZona?.secuenciaCalles) {
      setSecuenciaCallesInput(targetZona.secuenciaCalles.join(', '));
    } else {
      const streets = Array.from(
        new Set(
          targetZonaClients
            .map((c) => c.direccion.split('#')[0].split(',')[0].trim())
            .filter((s) => s.length > 2)
        )
      );
      setSecuenciaCallesInput(streets.join(', '));
    }
  };

  // Filtered clients list
  const filteredOrderedClients = useMemo(() => {
    return orderedClients.filter((c) => {
      const matchesSearch =
        c.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.direccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.folio.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesColonia =
        selectedColoniaFilter === 'TODAS' ||
        (c.colonia && c.colonia.toLowerCase() === selectedColoniaFilter.toLowerCase());

      return matchesSearch && matchesColonia;
    });
  }, [orderedClients, searchTerm, selectedColoniaFilter]);

  // Distinct colonias in this zone
  const coloniasEnZona = useMemo(() => {
    const list = Array.from(new Set(orderedClients.map((c) => c.colonia).filter(Boolean))) as string[];
    return ['TODAS', ...list];
  }, [orderedClients]);

  // Calculate total route distance in KM
  const totalKmRuta = useMemo(() => {
    if (orderedClients.length < 2) return 0;
    let distTotal = 0;
    for (let i = 1; i < orderedClients.length; i++) {
      const c1 = orderedClients[i - 1];
      const c2 = orderedClients[i];
      if (c1.latitud && c1.longitud && c2.latitud && c2.longitud) {
        distTotal += calcularDistanciaKm(c1.latitud, c1.longitud, c2.latitud, c2.longitud);
      }
    }
    return Math.round(distTotal * 10) / 10;
  }, [orderedClients]);

  // Estimated route time (10 min per client + 3 min per KM travel)
  const estimacionTiempoHoras = useMemo(() => {
    const totalMinutos = orderedClients.length * 10 + totalKmRuta * 3;
    const horas = Math.floor(totalMinutos / 60);
    const mins = Math.round(totalMinutos % 60);
    return `${horas}h ${mins}m`;
  }, [orderedClients.length, totalKmRuta]);

  // Total debt balance in this route
  const totalSaldoEnRuta = useMemo(() => {
    return orderedClients.reduce((sum, c) => {
      const v = ventas.find((v) => v.clienteId === c.id);
      return sum + (v ? v.saldoActual : 0);
    }, 0);
  }, [orderedClients, ventas]);

  // Move client up in order
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newArr = [...orderedClients];
    const temp = newArr[index - 1];
    newArr[index - 1] = newArr[index];
    newArr[index] = temp;
    setCustomOrderedClients(newArr);
  };

  // Move client down in order
  const handleMoveDown = (index: number) => {
    if (index === orderedClients.length - 1) return;
    const newArr = [...orderedClients];
    const temp = newArr[index + 1];
    newArr[index + 1] = newArr[index];
    newArr[index] = temp;
    setCustomOrderedClients(newArr);
  };

  // AUTOMATIC GEOGRAPHIC OPTIMIZATION ALGORITHM (Nearest-Neighbor TSP)
  const handleOptimizarRutaAutomaticamente = () => {
    if (orderedClients.length <= 2) {
      alert('Se requieren al menos 3 clientes en la zona para ejecutar la optimización de ruta.');
      return;
    }

    const unvisited = [...orderedClients];
    const optimized: Cliente[] = [];

    // Start with the first client or highest priority/debt client
    let current = unvisited.shift()!;
    optimized.push(current);

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const candidate = unvisited[i];
        const dist = calcularDistanciaKm(
          current.latitud,
          current.longitud,
          candidate.latitud,
          candidate.longitud
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }

      current = unvisited.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }

    setCustomOrderedClients(optimized);
    alert('¡Ruta optimizada geográficamente con éxito! La secuencia ha sido reordenada minimizando la distancia en kilómetros.');
  };

  // Sort by Street Name
  const handleOrdenarPorCalle = () => {
    const sorted = [...orderedClients].sort((a, b) => {
      const calleA = a.direccion.toLowerCase();
      const calleB = b.direccion.toLowerCase();
      return calleA.localeCompare(calleB);
    });
    setCustomOrderedClients(sorted);
  };

  // Sort by Colonia
  const handleOrdenarPorColonia = () => {
    const sorted = [...orderedClients].sort((a, b) => {
      const colA = (a.colonia || '').toLowerCase();
      const colB = (b.colonia || '').toLowerCase();
      return colA.localeCompare(colB);
    });
    setCustomOrderedClients(sorted);
  };

  // Save changes to database / state
  const handleGuardarSecuencia = () => {
    if (!onUpdateCliente) return;

    // Update each client with their new sequence number
    orderedClients.forEach((cliente, idx) => {
      const updated: Cliente = {
        ...cliente,
        ordenRuta: idx + 1,
        instruccionRuta: editingInstructions[cliente.id] || cliente.instruccionRuta || '',
      };
      onUpdateCliente(updated);
    });

    // Save master street sequence to Zona if handler provided
    if (onSaveZona && selectedZona) {
      const streetsArr = secuenciaCallesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      onSaveZona({
        ...selectedZona,
        secuenciaCalles: streetsArr,
      });
    }

    setIsSavedSuccess(true);
    setTimeout(() => setIsSavedSuccess(false), 3500);
  };

  // Map markers generated from ordered sequence
  const mapPoints = useMemo(() => {
    return orderedClients.map((c, index) => {
      const v = ventas.find((v) => v.clienteId === c.id);
      return {
        orden: index + 1,
        cliente: c,
        distanciaAnteriorKm:
          index === 0
            ? 0
            : Math.round(
                calcularDistanciaKm(
                  orderedClients[index - 1].latitud,
                  orderedClients[index - 1].longitud,
                  c.latitud,
                  c.longitud
                ) * 10
              ) / 10,
      };
    });
  }, [orderedClients, ventas]);

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="bg-slate-900 border border-slate-700/80 p-5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/40">
            <Route className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Gestión & Secuencia Óptima de Rutas
            </h2>
            <p className="text-xs text-slate-400">
              Define el orden secuencial exacto de calles y visitas para que el cobrador minimice traslados en campo.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOptimizarRutaAutomaticamente}
            className="px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer transition transform active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin-slow" />
            <span>Optimizar Ruta por GPS</span>
          </button>

          <button
            type="button"
            onClick={handleGuardarSecuencia}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition transform active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Guardar & Asignar Secuencia</span>
          </button>
        </div>
      </div>

      {/* SUCCESS CONFIRMATION TOAST */}
      {isSavedSuccess && (
        <div className="bg-emerald-950 border-2 border-emerald-500 p-4 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-between shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>
              ¡Secuencia de cobro para <strong>{selectedZona.nombre}</strong> guardada exitosamente! El orden de visita ya fue actualizado para el cobrador.
            </span>
          </div>
        </div>
      )}

      {/* ZONE SELECTOR & ROUTE METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT 4 COLS: ZONE CONFIG & STREET SEQUENCE MASTER */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Seleccionar Zona Operativa:</span>
              <span className="text-[10px] text-indigo-400 font-bold uppercase">
                Día: {selectedZona.diaCobro}
              </span>
            </label>

            <select
              value={selectedZonaId}
              onChange={(e) => handleSelectZona(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:border-indigo-500 outline-none cursor-pointer"
            >
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre} (Día: {z.diaCobro}) - {clientes.filter((c) => c.zonaId === z.id).length} clientes
                </option>
              ))}
            </select>
          </div>

          {/* KPI CARDS SUMMARY FOR THIS ROUTE */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] block font-semibold">Paradas en Ruta:</span>
              <span className="text-lg font-black text-white">{orderedClients.length} clientes</span>
              <span className="text-[10px] text-emerald-400 font-semibold block">Día {selectedZona.diaCobro}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] block font-semibold">Distancia Recorrido:</span>
              <span className="text-lg font-black text-indigo-300">{totalKmRuta} KM</span>
              <span className="text-[10px] text-slate-400 block">Est. {estimacionTiempoHoras}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 col-span-2">
              <span className="text-slate-400 text-[10px] block font-semibold">Monto Total a Cobrar en la Ruta:</span>
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-amber-300">${totalSaldoEnRuta.toLocaleString()} MXN</span>
                <span className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-300 font-bold">
                  {selectedZona.cuadrante}
                </span>
              </div>
            </div>
          </div>

          {/* MASTER STREET SEQUENCE DEFINITION EDITOR */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-400" />
                Secuencia Maestra de Calles
              </h4>
              <button
                type="button"
                onClick={() => setIsEditingStreetSequence(!isEditingStreetSequence)}
                className="text-[10px] text-indigo-400 hover:underline font-bold flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditingStreetSequence ? 'Ver' : 'Editar'}</span>
              </button>
            </div>

            {isEditingStreetSequence ? (
              <div className="space-y-2 text-xs">
                <p className="text-[10px] text-slate-400">
                  Ingresa las calles principales separadas por comas en el orden deseado para la ruta:
                </p>
                <textarea
                  rows={3}
                  value={secuenciaCallesInput}
                  onChange={(e) => setSecuenciaCallesInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                  placeholder="Ej. Av. Hidalgo, Calle 16 de Septiembre, Calle Morelos, Col. Centro"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-300 font-mono leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                  {secuenciaCallesInput || 'Sin secuencia previa definida. Se derivará automáticamente de los domicilios.'}
                </p>
              </div>
            )}
          </div>

          {/* SORTING HELPERS */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 block">Ordenar Rápidamente por:</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={handleOrdenarPorCalle}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 p-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Por Nombre de Calle</span>
              </button>
              <button
                type="button"
                onClick={handleOrdenarPorColonia}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 p-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Por Colonia / Sector</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT 8 COLS: INTERACTIVE SEQUENCE MAP & CLIENT LIST */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-5">
          {/* MAP PREVIEW */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-400" />
                Vista Geográfica de la Ruta Numérica ({mapPoints.length} Paradas)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Las líneas conectan el orden secuencial de visita (#1 ➔ #{mapPoints.length})
              </span>
            </div>

            <InteractiveMap puntos={mapPoints} height="320px" />
          </div>

          {/* SEARCH & COLONIA FILTER */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar cliente, calle o folio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400 text-[11px] font-bold">Colonia:</span>
              <select
                value={selectedColoniaFilter}
                onChange={(e) => setSelectedColoniaFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none cursor-pointer"
              >
                {coloniasEnZona.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SEQUENTIAL CLIENT LIST REORDERING */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
              <span>Secuencia Numérica de Visita</span>
              <span>Acciones de Reordenamiento</span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredOrderedClients.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                  No se encontraron clientes registrados en esta zona o filtro.
                </div>
              ) : (
                filteredOrderedClients.map((cliente, index) => {
                  const venta = ventas.find((v) => v.clienteId === cliente.id);
                  const realIndex = orderedClients.findIndex((c) => c.id === cliente.id);

                  // Distance from previous step
                  let distFromPrev = 0;
                  if (realIndex > 0) {
                    const prev = orderedClients[realIndex - 1];
                    distFromPrev =
                      Math.round(
                        calcularDistanciaKm(prev.latitud, prev.longitud, cliente.latitud, cliente.longitud) * 10
                      ) / 10;
                  }

                  let colorBadge = 'bg-emerald-950 text-emerald-400 border-emerald-800';
                  if (cliente.estadoMorosidad === 'AMARILLO')
                    colorBadge = 'bg-amber-950 text-amber-400 border-amber-800';
                  if (cliente.estadoMorosidad === 'ROJO')
                    colorBadge = 'bg-red-950 text-red-400 border-red-800';

                  return (
                    <div
                      key={cliente.id}
                      onMouseEnter={() => setActiveStepHoverId(cliente.id)}
                      onMouseLeave={() => setActiveStepHoverId(null)}
                      className={`bg-slate-950 border transition-all p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        activeStepHoverId === cliente.id
                          ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* STEP NUMBER & DETAILS */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow">
                          #{realIndex + 1}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm truncate">
                              {cliente.nombreCompleto}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {cliente.folio}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${colorBadge}`}>
                              {cliente.estadoMorosidad}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-300 font-medium truncate text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate">
                              <strong>{cliente.direccion}</strong> ({cliente.colonia || 'S/C'})
                            </span>
                          </div>

                          {/* Distance indicator from previous stop */}
                          {realIndex > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              ↳ Tramo desde parada #{realIndex}: <strong>{distFromPrev} KM</strong>
                            </span>
                          )}

                          {/* Custom Collector Instruction Field */}
                          <div className="pt-1">
                            <input
                              type="text"
                              placeholder="Escribir nota/instrucción de cobro para esta parada..."
                              value={editingInstructions[cliente.id] || ''}
                              onChange={(e) =>
                                setEditingInstructions({
                                  ...editingInstructions,
                                  [cliente.id]: e.target.value,
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-amber-200 placeholder-slate-600 outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* DEBT INFO & REORDER BUTTONS */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-semibold">Saldo:</span>
                          <span className="font-bold text-amber-300 text-xs">
                            ${venta ? venta.saldoActual.toLocaleString() : 0} MXN
                          </span>
                        </div>

                        {/* UP / DOWN ARROWS */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(realIndex)}
                            disabled={realIndex === 0}
                            className={`p-2 rounded-lg border transition ${
                              realIndex === 0
                                ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                : 'bg-slate-800 hover:bg-indigo-600 text-white border-slate-700 cursor-pointer'
                            }`}
                            title="Mover arriba en la ruta"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveDown(realIndex)}
                            disabled={realIndex === orderedClients.length - 1}
                            className={`p-2 rounded-lg border transition ${
                              realIndex === orderedClients.length - 1
                                ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                : 'bg-slate-800 hover:bg-indigo-600 text-white border-slate-700 cursor-pointer'
                            }`}
                            title="Mover abajo en la ruta"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
