'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Award,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Play,
  Download,
  Calendar,
  UserCheck,
  Settings,
  Percent,
  RefreshCw,
  Plus,
  Lock,
  Layers,
} from 'lucide-react';

export default function CommissionsModule() {
  const [activeTab, setActiveTab] = useState<'my' | 'seller' | 'collector' | 'supervisor' | 'periods' | 'rules' | 'tests'>('my');
  const [loading, setLoading] = useState(false);
  const [mySummary, setMySummary] = useState<any>(null);
  const [myCommissions, setMyCommissions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<any>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New period state
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');

  // New rule state
  const [ruleRole, setRuleRole] = useState('VENDEDORA');
  const [ruleType, setRuleType] = useState('CASH_SALE');
  const [ruleRate, setRuleRate] = useState('0.05');

  useEffect(() => {
    fetchMyCommissions();
    fetchPeriods();
    fetchRules();
  }, []);

  const fetchMyCommissions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/commissions/my');
      const data = await res.json();
      if (data.success) {
        setMySummary(data.summary);
        setMyCommissions(data.commissions || []);
      }
    } catch (err) {
      console.error('Error fetching my commissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriods = async () => {
    try {
      const res = await fetch('/api/commissions/periods');
      const data = await res.json();
      if (data.success) {
        setPeriods(data.periods || []);
      }
    } catch (err) {
      console.error('Error fetching periods:', err);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/commissions/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
    }
  };

  const runPhase8TestSuite = async () => {
    try {
      setTestRunning(true);
      setTestResults(null);
      setStatusMessage('Ejecutando la suite de 30 pruebas + prueba de integridad financiera...');
      const res = await fetch('/api/commissions/run-phase8-tests');
      const data = await res.json();
      setTestResults(data);
      if (data.allPassed) {
        setStatusMessage('¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE (30/30)!');
      } else {
        setStatusMessage(`Pruebas completadas: ${data.passedCount}/${data.totalCount} pasadas.`);
      }
    } catch (err: any) {
      setStatusMessage(`Error ejecutando pruebas: ${err.message}`);
    } finally {
      setTestRunning(false);
    }
  };

  const handleCreatePeriod = async () => {
    if (!newPeriodStart || !newPeriodEnd) return;
    try {
      setLoading(true);
      const res = await fetch('/api/commissions/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: newPeriodStart, endDate: newPeriodEnd }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPeriods();
        setNewPeriodStart('');
        setNewPeriodEnd('');
      }
    } catch (err) {
      console.error('Error creando periodo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePeriod = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/commissions/periods/${id}/close`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchPeriods();
      }
    } catch (err) {
      console.error('Error cerrando periodo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePeriod = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/commissions/periods/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchPeriods();
      }
    } catch (err) {
      console.error('Error aprobando periodo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayPeriod = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/commissions/periods/${id}/pay`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchPeriods();
      }
    } catch (err) {
      console.error('Error pagando periodo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/commissions/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: ruleRole,
          ruleType,
          rate: ruleRate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRules();
      }
    } catch (err) {
      console.error('Error guardando regla:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    window.open('/api/commissions/export', '_blank');
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <Award className="w-4 h-4" /> Fase 8 — Sistema de Nómina Variable
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Motor Profesional de Comisiones
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Incentivos transparentes, reversiones inmutables, cierre semanal y auditoría 360.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-all border border-slate-700"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={runPhase8TestSuite}
            disabled={testRunning}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            {testRunning ? 'Ejecutando Pruebas...' : 'Ejecutar Pruebas (30/30)'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-slate-800 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-2 scrollbar-none">
        {[
          { id: 'my', label: 'Mis Comisiones', icon: DollarSign },
          { id: 'periods', label: 'Periodos Semanales', icon: Calendar },
          { id: 'rules', label: 'Reglas y Tasas', icon: Percent },
          { id: 'tests', label: 'Suite de Pruebas (30/30)', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Mis Comisiones */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {mySummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Comisión Neta Acumulada</span>
                <div className="text-2xl font-bold text-emerald-400 mt-2">${mySummary.netEarned || mySummary.totalCommissions || '0.00'}</div>
                <div className="text-xs text-slate-500 mt-1">{mySummary.commissionsCount || 0} registros calculados</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Base Comisionable</span>
                <div className="text-2xl font-bold text-white mt-2">${mySummary.totalSalesBase || mySummary.totalCollected || '0.00'}</div>
                <div className="text-xs text-slate-500 mt-1">Operaciones confirmadas</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Bonificaciones</span>
                <div className="text-2xl font-bold text-blue-400 mt-2">+${mySummary.totalBonuses || '0.00'}</div>
                <div className="text-xs text-slate-500 mt-1">Metas y categorías</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Penalizaciones / Reversos</span>
                <div className="text-2xl font-bold text-rose-400 mt-2">-${mySummary.totalPenalties || '0.00'}</div>
                <div className="text-xs text-slate-500 mt-1">Ajustes auditados</div>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              Histórico de Comisiones
            </h3>

            {myCommissions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No se han registrado comisiones aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Rol</th>
                      <th className="p-3">Base</th>
                      <th className="p-3">Tasa</th>
                      <th className="p-3">Comisión</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {myCommissions.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/50">
                        <td className="p-3 font-medium text-white">{c.commissionType}</td>
                        <td className="p-3 text-slate-400">{c.role}</td>
                        <td className="p-3">${c.baseAmount}</td>
                        <td className="p-3">{(Number(c.rate) * 100).toFixed(1)}%</td>
                        <td className={`p-3 font-semibold ${Number(c.commissionAmount) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ${c.commissionAmount}
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-xs">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Periodos Semanales */}
      {activeTab === 'periods' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Crear Nuevo Periodo Semanal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha Inicio</label>
                <input
                  type="date"
                  value={newPeriodStart}
                  onChange={(e) => setNewPeriodStart(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha Fin</label>
                <input
                  type="date"
                  value={newPeriodEnd}
                  onChange={(e) => setNewPeriodEnd(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCreatePeriod}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all"
                >
                  Abrir Periodo
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Periodos de Nómina Variable
            </h3>

            {periods.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No se han registrado periodos aún.</p>
            ) : (
              <div className="space-y-4">
                {periods.map((p) => (
                  <div key={p.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{p.periodName || 'Periodo Semanal'}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.status === 'OPEN' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          p.status === 'CLOSED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          p.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()}
                      </div>
                      {p.snapshotHash && (
                        <div className="text-[11px] text-slate-500 mt-1 font-mono">
                          Snapshot: {p.snapshotHash}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Total Neto</div>
                        <div className="text-lg font-bold text-emerald-400">${p.totalNet || '0.00'}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.status === 'OPEN' && (
                          <button
                            onClick={() => handleClosePeriod(p.id)}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                          >
                            Cerrar
                          </button>
                        )}
                        {p.status === 'CLOSED' && (
                          <button
                            onClick={() => handleApprovePeriod(p.id)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                          >
                            Aprobar
                          </button>
                        )}
                        {(p.status === 'CLOSED' || p.status === 'PENDING_APPROVAL') && (
                          <button
                            onClick={() => handlePayPeriod(p.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                          >
                            Pagar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Reglas y Tasas */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              Configurar Regla de Comisión
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Rol</label>
                <select
                  value={ruleRole}
                  onChange={(e) => setRuleRole(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="VENDEDORA">VENDEDORA</option>
                  <option value="COBRADOR">COBRADOR</option>
                  <option value="SUPERVISORA">SUPERVISORA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Regla</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="CASH_SALE">Venta Contado</option>
                  <option value="CREDIT_HIGH_DOWN">Crédito Enganche &gt;= 10%</option>
                  <option value="CREDIT_LOW_DOWN">Crédito Enganche &lt; 10%</option>
                  <option value="COLLECTION">Cobranza Efectiva</option>
                  <option value="SUPERVISOR_SALE">Sobrecomisión Venta Grupo</option>
                  <option value="SUPERVISOR_COLLECTION">Sobrecomisión Cobranza Zona</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tasa Porcentual (Decimal)</label>
                <input
                  type="number"
                  step="0.005"
                  value={ruleRate}
                  onChange={(e) => setRuleRate(e.target.value)}
                  placeholder="0.05 (5%)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleSaveRule}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all"
                >
                  Guardar Regla
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4">Reglas Activas en Base de Datos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map((r) => (
                <div key={r.id || r.ruleType} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{r.role}</span>
                    <span className="text-lg font-bold text-white">{(Number(r.rate) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="text-sm font-medium text-slate-200">{r.ruleType}</div>
                  <div className="text-xs text-slate-400 mt-1">{r.description || 'Configuración activa de comisión'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Suite de Pruebas */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Suite de Pruebas Automatizadas Fase 8
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Verifica idempotencia, reversiones, ABAC, sobrecomisión y la regla financiera ($1490 - $200 - $200 = $1090).
              </p>
            </div>
            <button
              onClick={runPhase8TestSuite}
              disabled={testRunning}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            >
              {testRunning ? 'Ejecutando...' : 'Lanzar Suite de Pruebas'}
            </button>
          </div>

          {testResults && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <span className="text-2xl font-bold text-white">
                    {testResults.passedCount} / {testResults.totalCount}
                  </span>
                  <span className="text-sm text-slate-400 ml-2">pruebas superadas</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  testResults.allPassed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {testResults.allPassed ? '30/30 PASSED' : 'FALLOS DETECTADOS'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2">
                {testResults.testResults?.map((t: any) => (
                  <div
                    key={t.id || t.name}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                      t.status === 'PASSED'
                        ? 'bg-slate-800/40 border-slate-800 text-slate-200'
                        : 'bg-rose-950/20 border-rose-800/50 text-rose-200'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{t.name}</div>
                      {t.details && <div className="text-[11px] text-rose-400 mt-1">{t.details}</div>}
                    </div>
                    {t.status === 'PASSED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
