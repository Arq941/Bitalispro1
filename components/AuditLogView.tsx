'use client';

import { useState } from 'react';
import { LogAuditoria } from '@/types';
import {
  ShieldCheck,
  Search,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Layers,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface AuditLogViewProps {
  logs: LogAuditoria[];
  filterClienteId?: number;
  filterClienteNombre?: string;
  onCloseClientFilter?: () => void;
}

export default function AuditLogView({
  logs = [],
  filterClienteId,
  filterClienteNombre,
  onCloseClientFilter,
}: AuditLogViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'TODOS' | 'CLIENTE' | 'VENTA'>('TODOS');
  const [accionFilter, setAccionFilter] = useState<'TODAS' | 'EDICION' | 'CREACION' | 'APROBACION' | 'RECHAZO' | 'ELIMINACION'>('TODAS');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(logs.length > 0 ? logs[0].id : null);

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    // Specific client filter if passed
    if (filterClienteId && log.entidadId !== filterClienteId && log.entidadFolio !== `CLI-${filterClienteId}`) {
      const matchesClient = log.clienteNombre?.toLowerCase().includes((filterClienteNombre || '').toLowerCase());
      if (!matchesClient) return false;
    }

    // Search query
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      log.usuarioNombre.toLowerCase().includes(searchLower) ||
      (log.clienteNombre && log.clienteNombre.toLowerCase().includes(searchLower)) ||
      (log.entidadFolio && log.entidadFolio.toLowerCase().includes(searchLower)) ||
      log.resumenCambio.toLowerCase().includes(searchLower) ||
      log.cambios.some((c) =>
        c.campo.toLowerCase().includes(searchLower) ||
        c.valorAnterior.toLowerCase().includes(searchLower) ||
        c.valorNuevo.toLowerCase().includes(searchLower)
      );

    // Entity type filter
    const matchesTipo = tipoFilter === 'TODOS' || log.tipoEntidad === tipoFilter;

    // Action filter
    const matchesAccion = accionFilter === 'TODAS' || log.accion === accionFilter;

    return matchesSearch && matchesTipo && matchesAccion;
  });

  // Role badges colors
  const getRoleBadge = (rol: string) => {
    switch (rol) {
      case 'admin':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'sup_vendedores':
      case 'sup_cobradores':
        return 'bg-indigo-950 text-indigo-300 border-indigo-800';
      case 'vendedora':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'cobrador':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getActionBadge = (accion: string) => {
    switch (accion) {
      case 'CREACION':
        return 'bg-emerald-950 text-emerald-400 border-emerald-700/80';
      case 'EDICION':
        return 'bg-amber-950 text-amber-400 border-amber-700/80';
      case 'APROBACION':
        return 'bg-indigo-950 text-indigo-300 border-indigo-700/80';
      case 'RECHAZO':
        return 'bg-rose-950 text-rose-400 border-rose-800/80';
      case 'ELIMINACION':
        return 'bg-red-950 text-red-400 border-red-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-slate-800/95 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl text-white shadow-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Log de Auditoría y Control de Seguridad
                {filterClienteNombre && (
                  <span className="text-xs bg-indigo-900 text-indigo-200 border border-indigo-700 px-2.5 py-0.5 rounded-full">
                    Cliente: {filterClienteNombre}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Registro inmutable de quién hizo cada cambio, qué dato se modificó y fecha/hora exacta.
              </p>
            </div>
          </div>

          {filterClienteId && onCloseClientFilter && (
            <button
              onClick={onCloseClientFilter}
              className="text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-600 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ver Auditoría General ({logs.length})</span>
            </button>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/80 border border-slate-700/80 p-3 rounded-xl space-y-1">
            <span className="text-slate-400 font-medium block">Total Registros Auditados</span>
            <span className="text-lg font-black text-white">{filteredLogs.length} eventos</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-700/80 p-3 rounded-xl space-y-1">
            <span className="text-slate-400 font-medium block">Ediciones de Cliente</span>
            <span className="text-lg font-black text-amber-400">
              {filteredLogs.filter((l) => l.tipoEntidad === 'CLIENTE' && l.accion === 'EDICION').length} cambios
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-700/80 p-3 rounded-xl space-y-1">
            <span className="text-slate-400 font-medium block">Cambios en Contratos</span>
            <span className="text-lg font-black text-indigo-400">
              {filteredLogs.filter((l) => l.tipoEntidad === 'VENTA').length} movimientos
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-700/80 p-3 rounded-xl space-y-1">
            <span className="text-slate-400 font-medium block">Usuarios Registrados</span>
            <span className="text-lg font-black text-emerald-400">
              {new Set(filteredLogs.map((l) => l.usuarioNombre)).size} usuarios
            </span>
          </div>
        </div>

        {/* Search & Filters Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por usuario, cliente, folio o dato..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="TODOS">Todas las Entidades (Clientes y Ventas)</option>
              <option value="CLIENTE">Solo Clientes</option>
              <option value="VENTA">Solo Ventas / Contratos</option>
            </select>
          </div>

          <div>
            <select
              value={accionFilter}
              onChange={(e) => setAccionFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="TODAS">Todas las Acciones</option>
              <option value="EDICION">✏️ Edición de Datos</option>
              <option value="CREACION">✨ Alta / Creación</option>
              <option value="APROBACION">✓ Aprobaciones</option>
              <option value="RECHAZO">✕ Rechazos</option>
              <option value="ELIMINACION">🗑️ Eliminaciones</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Entries List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 text-center text-slate-400 text-sm space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="font-semibold text-slate-300">No hay registros de auditoría que coincidan con la búsqueda.</p>
            <p className="text-xs text-slate-500">Realiza cambios en algún cliente o contrato para generar nuevos registros de seguridad.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                className="bg-slate-800/90 border border-slate-700 hover:border-slate-600 rounded-2xl p-4 shadow-md transition space-y-3"
              >
                {/* Header Line */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Timestamp */}
                    <span className="font-mono text-[11px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700/80 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      {log.fechaHora}
                    </span>

                    {/* Action Badge */}
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${getActionBadge(log.accion)}`}>
                      {log.accion === 'EDICION' && '✏️ Modificación'}
                      {log.accion === 'CREACION' && '✨ Registro'}
                      {log.accion === 'APROBACION' && '✓ Aprobado'}
                      {log.accion === 'RECHAZO' && '✕ Rechazado'}
                      {log.accion === 'ELIMINACION' && '🗑️ Eliminado'}
                    </span>

                    {/* Entity Type Badge */}
                    <span className="text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">
                      {log.tipoEntidad === 'CLIENTE' ? '👤 CLIENTE' : '📄 CONTRATO VENTA'}
                    </span>
                  </div>

                  {/* User info who made change */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Modificado por:</span>
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      {log.usuarioNombre}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getRoleBadge(log.usuarioRol)}`}>
                      {log.usuarioRol}
                    </span>
                  </div>
                </div>

                {/* Main Content Info */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-black text-white flex items-center gap-2">
                      <span className="text-indigo-400 font-mono">{log.entidadFolio || `#${log.entidadId}`}</span>
                      <span>—</span>
                      <span>{log.clienteNombre || 'Sin nombre'}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">{log.resumenCambio}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <span>{isExpanded ? 'Ocultar Comparativa' : `Ver Detalles (${log.cambios.length})`}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Expanded Comparison Table (Diff) */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-700/80 space-y-2 animate-fadeIn">
                    <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5 pb-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Comparativa de Datos Modificados (Valor Anterior ➔ Valor Nuevo):</span>
                    </div>

                    <div className="bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden text-xs">
                      <div className="grid grid-cols-12 bg-slate-950 p-2 text-[11px] font-bold text-slate-400 border-b border-slate-800">
                        <div className="col-span-4">Campo Modificado</div>
                        <div className="col-span-4">Valor Anterior</div>
                        <div className="col-span-4">Valor Nuevo</div>
                      </div>

                      <div className="divide-y divide-slate-800/80">
                        {log.cambios.map((c, idx) => (
                          <div key={idx} className="grid grid-cols-12 p-2.5 items-center gap-2">
                            <div className="col-span-4 font-bold text-slate-200 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              {c.campo}
                            </div>
                            <div className="col-span-4 bg-slate-950/90 text-rose-300 border border-rose-900/40 px-2 py-1 rounded-lg font-mono text-[11px] truncate">
                              {c.valorAnterior || '(Vacío)'}
                            </div>
                            <div className="col-span-4 bg-emerald-950/90 text-emerald-300 border border-emerald-800/60 px-2 py-1 rounded-lg font-mono text-[11px] truncate flex items-center justify-between">
                              <span>{c.valorNuevo || '(Vacío)'}</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
