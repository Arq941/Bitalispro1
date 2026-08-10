'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Bell,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Calendar,
  UserCheck,
  TrendingUp,
  ShoppingCart,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  Check,
  Plus
} from 'lucide-react';

export default function Phase10Center({ currentUser }: { currentUser?: any }) {
  const [activeTab, setActiveTab] = useState<'renewals' | 'procurement' | 'notifications'>('renewals');

  // Renewals state
  const [renewals, setRenewals] = useState<any[]>([]);
  const [loadingRenewals, setLoadingRenewals] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState<any | null>(null);

  // Procurement state
  const [orders, setOrders] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingProcurement, setLoadingProcurement] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Fetch renewals
  const fetchRenewals = async () => {
    setLoadingRenewals(true);
    try {
      const res = await fetch('/api/renewals');
      const data = await res.json();
      if (data.success) {
        setRenewals(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching renewals', e);
    } finally {
      setLoadingRenewals(false);
    }
  };

  // Fetch procurement
  const fetchProcurement = async () => {
    setLoadingProcurement(true);
    try {
      const resOrders = await fetch('/api/procurement/orders');
      const dataOrders = await resOrders.json();
      if (dataOrders.success) {
        setOrders(dataOrders.data || []);
      }

      const resSugg = await fetch('/api/procurement/reorder-suggestions');
      const dataSugg = await resSugg.json();
      if (dataSugg.success) {
        setSuggestions(dataSugg.data || []);
      }
    } catch (e) {
      console.error('Error fetching procurement', e);
    } finally {
      setLoadingProcurement(false);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching notifications', e);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'renewals') fetchRenewals();
    if (activeTab === 'procurement') fetchProcurement();
    if (activeTab === 'notifications') fetchNotifications();
  }, [activeTab]);

  // Actions
  const handleContactRenewal = async (id: string) => {
    try {
      await fetch(`/api/renewals/${id}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Contacto vía PWA Móvil BITALIS' }),
      });
      fetchRenewals();
    } catch (e) {
      console.error(e);
    }
  };

  const handleScheduleVisit = async (id: string) => {
    try {
      const visitDate = new Date(Date.now() + 86400000).toISOString();
      await fetch(`/api/renewals/${id}/schedule-visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitDate, notes: 'Visita programada' }),
      });
      fetchRenewals();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveOrder = async (id: string) => {
    try {
      await fetch(`/api/procurement/orders/${id}/approve`, { method: 'POST' });
      fetchProcurement();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-950 p-6 rounded-3xl border border-indigo-500/20 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <RefreshCw className="w-48 h-48 text-indigo-400 animate-spin-slow" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Fase 10 — Renovaciones & Abastecimiento BITALIS</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Motor de Renovaciones, Pedidos y Notificaciones Multi-Rol
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Gestión inteligente de clientes aptos para renovación, abastecimiento automático de almacenes y sistema centralizado de alertas ABAC.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('renewals')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'renewals'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Centro de Renovaciones ({renewals.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('procurement')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'procurement'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Abastecimiento & Pedidos ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notificaciones Multi-Rol ({notifications.filter((n) => n.status === 'UNREAD').length})</span>
          </button>
        </div>
      </div>

      {/* RENEWALS TAB */}
      {activeTab === 'renewals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-black text-white">Candidatos a Renovación Detectados</h2>
              <p className="text-xs text-slate-400">Clientes con créditos en etapa avanzada o liquidados sin mora</p>
            </div>
            <button
              onClick={fetchRenewals}
              disabled={loadingRenewals}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRenewals ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {renewals.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
              <CheckCircle className="w-8 h-8 text-indigo-400 mx-auto opacity-60" />
              <p className="text-sm font-bold text-slate-300">No hay renovaciones pendientes activas</p>
              <p className="text-xs text-slate-500">El motor analiza automáticamente créditos con pago &gt;= 70%</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renewals.map((r) => (
                <div key={r.id} className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-indigo-500/40 transition space-y-4 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                        {r.status}
                      </span>
                      <h3 className="text-base font-bold text-white">Cliente ID: {r.clientId}</h3>
                      <p className="text-xs text-slate-400">Crédito Origen: {r.sourceCreditId || r.creditId || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-400">
                        {Number(r.progressPercentage || 75).toFixed(0)}%
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Avance de Pago</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Number(r.progressPercentage || 75))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-500">Saldo Restante</span>
                      <span className="font-bold text-slate-200">${Number(r.remainingBalance || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-500">Motivo Detección</span>
                      <span className="font-bold text-indigo-300">{r.reason || 'Auto Detección'}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => handleContactRenewal(r.id)}
                      className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Contactar</span>
                    </button>
                    <button
                      onClick={() => handleScheduleVisit(r.id)}
                      className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Agendar Visita</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROCUREMENT TAB */}
      {activeTab === 'procurement' && (
        <div className="space-y-6">
          {/* Inventory Suggestions Alert Box */}
          {suggestions.length > 0 && (
            <div className="p-5 bg-amber-950/40 border border-amber-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Sugerencias del Motor de Reorden ({suggestions.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-white">
                      <span>{s.productName || s.productId}</span>
                      <span className={s.status === 'STOCKOUT' ? 'text-red-400 font-black' : 'text-amber-400'}>
                        {s.status}
                      </span>
                    </div>
                    <div className="text-slate-400 flex justify-between">
                      <span>Disponible: {s.quantityAvailable}</span>
                      <span className="text-emerald-400 font-bold">Sugerido Comprar: +{s.suggestedQuantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-black text-white">Órdenes de Compra & Abastecimiento</h2>
              <p className="text-xs text-slate-400">Gestión de abastecimiento a almacenes centrales y móviles</p>
            </div>
            <button
              onClick={fetchProcurement}
              disabled={loadingProcurement}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingProcurement ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
              <ShoppingCart className="w-8 h-8 text-emerald-400 mx-auto opacity-60" />
              <p className="text-sm font-bold text-slate-300">No hay órdenes de compra registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition space-y-3 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                          {o.status}
                        </span>
                        <h3 className="text-base font-bold text-white">{o.orderNumber}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Proveedor: {o.supplier || 'General'} | Almacén: {o.warehouseId}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-400">${Number(o.totalAmount || 0).toFixed(2)}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Monto Estimado</div>
                    </div>
                  </div>

                  {o.status === 'PENDING_APPROVAL' && (
                    <div className="flex gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => handleApproveOrder(o.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aprobar Orden (Supervisora/Admin)</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-black text-white">Notificaciones & Alertas Multi-Rol</h2>
              <p className="text-xs text-slate-400">Filtradas automáticamente por ABAC de acuerdo a tu rol y asignación</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 font-bold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Marcar todas leídas</span>
              </button>
              <button
                onClick={fetchNotifications}
                disabled={loadingNotifications}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingNotifications ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
              <Bell className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
              <p className="text-sm font-bold text-slate-300">No tienes notificaciones pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition flex items-start justify-between gap-4 ${
                    n.status === 'UNREAD'
                      ? 'bg-slate-900 border-indigo-500/40 shadow-xl'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-70'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          n.priority === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : n.priority === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {n.priority || 'MEDIUM'}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">{n.type}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{n.title}</h3>
                    <p className="text-xs text-slate-300">{n.message}</p>
                    <p className="text-[10px] text-slate-500 pt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {n.status === 'UNREAD' && (
                    <button
                      onClick={() => handleMarkNotificationRead(n.id)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold shrink-0 transition"
                    >
                      Leída
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
