'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Calculator,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Calendar,
  Clock,
  UserCheck,
  Building,
  FileText,
  MapPin,
  Check,
  X,
  Play
} from 'lucide-react';

interface CajaControlViewProps {
  currentUser: any;
  onShowNotice?: (title: string, message: string, role?: string) => void;
}

export default function CajaControlView({ currentUser, onShowNotice }: CajaControlViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'cobrador' | 'supervisor' | 'tests'>('cobrador');
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [supervisorData, setSupervisorData] = useState<any>(null);

  // Modals state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Form states
  const [openingFund, setOpeningFund] = useState('500.00');
  const [openingNotes, setOpeningNotes] = useState('');

  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState('GASOLINE');
  const [expenseDesc, setExpenseDesc] = useState('');

  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');

  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const [closingNotes, setClosingNotes] = useState('');

  // Denominaciones Arqueo
  const [bills, setBills] = useState({
    b1000: 0,
    b500: 0,
    b200: 0,
    b100: 0,
    b50: 0,
    b20: 0,
    b10: 0,
    b5: 0,
    b2: 0,
    b1: 0,
    c20: 0,
    c10: 0,
    c5: 0,
    c2: 0,
    c1: 0,
  });

  // Tests runner state
  const [testResults, setTestResults] = useState<any>(null);
  const [runningTests, setRunningTests] = useState(false);

  useEffect(() => {
    fetchCurrentSession();
    fetchSupervisorDashboard();
  }, [currentUser]);

  const fetchCurrentSession = async () => {
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/cash-sessions/current?userId=${currentUser.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setCurrentSession(data.data);
        fetchReconciliation(data.data.id);
      } else {
        setCurrentSession(null);
        setReconciliation(null);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReconciliation = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/cash-sessions/${sessionId}/reconciliation`);
      const data = await res.json();
      if (data.success) {
        setReconciliation(data.data);
      }
    } catch (err) {
      console.error('Error fetching reconciliation:', err);
    }
  };

  const fetchSupervisorDashboard = async () => {
    try {
      const res = await fetch('/api/cash/supervisor/dashboard');
      const data = await res.json();
      if (data.success) {
        setSupervisorData(data.data);
      }
    } catch (err) {
      console.error('Error fetching supervisor dashboard:', err);
    }
  };

  // Actions
  const handleOpenCash = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cash-sessions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          collectorId: currentUser.id,
          openingFund: parseFloat(openingFund) || 0,
          latitude: 19.4326,
          longitude: -99.1332,
          deviceId: 'PWA-DEVICE-01',
          notes: openingNotes,
          idempotencyKey: `idem_open_pwa_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowOpenModal(false);
        onShowNotice?.('Caja Abierta', 'Sesión de caja abierta correctamente');
        fetchCurrentSession();
        fetchSupervisorDashboard();
      } else {
        alert(data.error || 'Error al abrir caja');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async () => {
    if (!currentSession) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/cash-sessions/${currentSession.id}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          collectorId: currentUser.id,
          amount: parseFloat(expenseAmount) || 0,
          expenseType: expenseType,
          description: expenseDesc,
          latitude: 19.4326,
          longitude: -99.1332,
          idempotencyKey: `idem_exp_pwa_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowExpenseModal(false);
        setExpenseAmount('');
        setExpenseDesc('');
        onShowNotice?.('Gasto Registrado', 'Gasto enviado a revisión de supervisión');
        fetchCurrentSession();
        fetchSupervisorDashboard();
      } else {
        alert(data.error || 'Error al registrar gasto');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async () => {
    if (!currentSession) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/cash-sessions/${currentSession.id}/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          amount: parseFloat(withdrawalAmount) || 0,
          reason: withdrawalReason,
          latitude: 19.4326,
          longitude: -99.1332,
          deviceId: 'PWA-DEVICE-01',
          idempotencyKey: `idem_with_pwa_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowWithdrawalModal(false);
        setWithdrawalAmount('');
        setWithdrawalReason('');
        onShowNotice?.('Retiro Registrado', 'Retiro de efectivo registrado correctamente');
        fetchCurrentSession();
      } else {
        alert(data.error || 'Error al registrar retiro');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!currentSession) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/cash-sessions/${currentSession.id}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          paymentId: refundPaymentId,
          refundAmount: parseFloat(refundAmount) || 0,
          reason: refundReason,
          idempotencyKey: `idem_ref_pwa_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowRefundModal(false);
        setRefundAmount('');
        setRefundReason('');
        setRefundPaymentId('');
        onShowNotice?.('Devolución Registrada', 'Devolución aplicada correctamente');
        fetchCurrentSession();
      } else {
        alert(data.error || 'Error al procesar devolución');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCountCash = async () => {
    if (!currentSession) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/cash-sessions/${currentSession.id}/count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedBy: currentUser.id,
          denominations: {
            bills1000: bills.b1000,
            bills500: bills.b500,
            bills200: bills.b200,
            bills100: bills.b100,
            bills50: bills.b50,
            bills20: bills.b20,
            bills10: bills.b10,
            bills5: bills.b5,
            bills2: bills.b2,
            bills1: bills.b1,
            coins20: bills.c20,
            coins10: bills.c10,
            coins5: bills.c5,
            coins2: bills.c2,
            coins1: bills.c1,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCountModal(false);
        onShowNotice?.('Arqueo Registrado', 'Conteo por denominaciones guardado');
        fetchCurrentSession();
      } else {
        alert(data.error || 'Error al guardar conteo');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCash = async () => {
    if (!currentSession) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/cash-sessions/${currentSession.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closedBy: currentUser.id,
          notes: closingNotes,
          latitude: 19.4326,
          longitude: -99.1332,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCloseModal(false);
        onShowNotice?.('Cierre de Caja', 'Cierre de caja procesado exitosamente');
        fetchCurrentSession();
        fetchSupervisorDashboard();
      } else {
        alert(data.error || 'Error al cerrar caja');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveExpense = async (id: string) => {
    try {
      const res = await fetch(`/api/cash-sessions/${currentSession?.id || 'sys'}/expenses/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', reviewerId: currentUser.id }),
      });
      fetchSupervisorDashboard();
      fetchCurrentSession();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveVariance = async (id: string) => {
    try {
      await fetch(`/api/cash-variances/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: currentUser.id }),
      });
      fetchSupervisorDashboard();
      fetchCurrentSession();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunTests = async () => {
    try {
      setRunningTests(true);
      const res = await fetch('/api/cash/run-phase7-tests');
      const data = await res.json();
      setTestResults(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRunningTests(false);
    }
  };

  // Calculations for Arqueo Modal
  const calculatedTotal =
    bills.b1000 * 1000 +
    bills.b500 * 500 +
    bills.b200 * 200 +
    bills.b100 * 100 +
    bills.b50 * 50 +
    bills.b20 * 20 +
    bills.b10 * 10 +
    bills.b5 * 5 +
    bills.b2 * 2 +
    bills.b1 * 1 +
    bills.c20 * 20 +
    bills.c10 * 10 +
    bills.c5 * 5 +
    bills.c2 * 2 +
    bills.c1 * 1;

  return (
    <div className="space-y-6 pb-20">
      {/* Sub-Header Tabs */}
      <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('cobrador')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'cobrador'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Caja Cobrador</span>
          </button>
          <button
            onClick={() => setActiveSubTab('supervisor')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'supervisor'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Supervisión</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('tests');
              if (!testResults) handleRunTests();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'tests'
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Suite 30 Tests (Fase 7)</span>
          </button>
        </div>

        <button
          onClick={() => {
            fetchCurrentSession();
            fetchSupervisorDashboard();
          }}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* SUBTAB 1: COBRADOR DASHBOARD */}
      {activeSubTab === 'cobrador' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">CAJA DEL DÍA EN RUTA</h2>
                  <p className="text-xs text-slate-400">
                    Cobrador: <span className="text-emerald-400 font-semibold">{currentUser?.nombre || currentUser?.email}</span>
                  </p>
                </div>
              </div>

              <span
                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                  currentSession?.status === 'OPEN' || currentSession?.status === 'OPERATING'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : currentSession?.status === 'COUNTING'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : currentSession?.status === 'PENDING_REVIEW'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {currentSession?.status || 'SIN CAJA ABIERTA'}
              </span>
            </div>

            {/* Financial Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fondo Inicial</p>
                <p className="text-xl font-black text-white mt-1">
                  ${parseFloat(currentSession?.openingFund || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Efectivo Esperado</p>
                <p className="text-xl font-black text-emerald-400 mt-1">
                  ${parseFloat(reconciliation?.expectedCash || currentSession?.expectedCash || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Efectivo Contado</p>
                <p className="text-xl font-black text-cyan-400 mt-1">
                  ${parseFloat(reconciliation?.countedCash || currentSession?.countedCash || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Diferencia / Variancia</p>
                <p
                  className={`text-xl font-black mt-1 ${
                    parseFloat(reconciliation?.varianceAmount || 0) < 0
                      ? 'text-rose-400'
                      : parseFloat(reconciliation?.varianceAmount || 0) > 0
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }`}
                >
                  ${parseFloat(reconciliation?.varianceAmount || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Large Interactive Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mt-6">
              {!currentSession ? (
                <button
                  onClick={() => setShowOpenModal(true)}
                  className="col-span-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Wallet className="w-5 h-5" />
                  <span>[ ABRIR CAJA ]</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowExpenseModal(true)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-2xl flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Receipt className="w-5 h-5" />
                    <span>GASTO</span>
                  </button>

                  <button
                    onClick={() => setShowWithdrawalModal(true)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-2xl flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                    <span>RETIRO</span>
                  </button>

                  <button
                    onClick={() => setShowRefundModal(true)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-2xl flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <ArrowDownLeft className="w-5 h-5" />
                    <span>DEVOLUCIÓN</span>
                  </button>

                  <button
                    onClick={() => setShowCountModal(true)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs rounded-2xl flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Calculator className="w-5 h-5" />
                    <span>ARQUEO</span>
                  </button>

                  <button
                    onClick={() => setShowCloseModal(true)}
                    className="col-span-2 p-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition active:scale-95 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>[ CERRAR CAJA ]</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Breakdown Table */}
          {reconciliation && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>DESGLOSE FINANCIERO DE CONCILIACIÓN</span>
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400">Cobrado Efectivo:</span>
                  <p className="text-sm font-bold text-emerald-400 mt-1">${parseFloat(reconciliation.cashPayments || 0).toFixed(2)}</p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400">Enganches Efectivo:</span>
                  <p className="text-sm font-bold text-emerald-400 mt-1">${parseFloat(reconciliation.downPayments || 0).toFixed(2)}</p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400">Gastos Aprobados:</span>
                  <p className="text-sm font-bold text-rose-400 mt-1">-${parseFloat(reconciliation.expensesTotal || 0).toFixed(2)}</p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400">Retiros Bóveda:</span>
                  <p className="text-sm font-bold text-indigo-400 mt-1">-${parseFloat(reconciliation.withdrawalsTotal || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: SUPERVISOR DASHBOARD */}
      {activeSubTab === 'supervisor' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-400" />
              <span>PANEL DE CONTROL DE SUPERVISIÓN Y ARQUEOS</span>
            </h2>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                  supervisorData?.trafficLight === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : supervisorData?.trafficLight === 'REVIEW'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                Semáforo: {supervisorData?.trafficLight || 'OK'}
              </span>
            </div>
          </div>

          {/* Pending Expenses Review List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-4">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>GASTOS PENDIENTES DE REVISIÓN ({supervisorData?.pendingExpenses?.length || 0})</span>
            </h3>

            {supervisorData?.pendingExpenses?.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No hay gastos pendientes de aprobación.</p>
            ) : (
              <div className="space-y-2">
                {supervisorData?.pendingExpenses?.map((exp: any) => (
                  <div key={exp.id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">${parseFloat(exp.amount).toFixed(2)} - {exp.description}</p>
                      <p className="text-xs text-slate-400">Cobrador: {exp.cashSession?.user?.firstName || 'Cobrador'}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveExpense(exp.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        [ APROBAR ]
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Variances Review List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-4">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>DIFERENCIAS DE CAJA PENDIENTES ({supervisorData?.pendingVariances?.length || 0})</span>
            </h3>

            {supervisorData?.pendingVariances?.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No hay diferencias de caja por resolver.</p>
            ) : (
              <div className="space-y-2">
                {supervisorData?.pendingVariances?.map((v: any) => (
                  <div key={v.id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        Diferencia: ${parseFloat(v.varianceAmount).toFixed(2)} ({v.varianceType})
                      </p>
                      <p className="text-xs text-slate-400">
                        Esperado: ${parseFloat(v.expectedAmount).toFixed(2)} | Contado: ${parseFloat(v.countedAmount).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveVariance(v.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        [ AUTORIZAR Y CERRAR ]
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: TESTS RUNNER */}
      {activeSubTab === 'tests' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-teal-400" />
                <span>SUITE DE 30 PRUEBAS FINANCIERAS DE FASE 7</span>
              </h2>
              <p className="text-xs text-slate-400">Verificación de reglas de inmutabilidad, fórmulas y concurrencia</p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={runningTests}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>{runningTests ? 'Ejecutando Pruebas...' : 'Ejecutar Suite 30/30'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white">RESULTADO PRUEBAS: {testResults.tests}</p>
                  <p className="text-xs text-slate-400">Integridad Financiera: {testResults.financialIntegrity}</p>
                </div>
                <span
                  className={`px-4 py-2 rounded-xl text-xs font-black ${
                    testResults.status === 'COMPLETE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {testResults.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2">
                {testResults.results?.map((t: any) => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${
                      t.passed
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                    }`}
                  >
                    {t.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-bold">Test #{t.id}: {t.name}</p>
                      <p className="text-[11px] opacity-80 mt-0.5">{t.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ABRIR CAJA */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <span>Apertura de Caja</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Fondo Inicial ($):</label>
                <input
                  type="number"
                  value={openingFund}
                  onChange={(e) => setOpeningFund(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Notas:</label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"
                  placeholder="Ej. Billetes chicos para cambio"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowOpenModal(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenCash}
                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs"
              >
                Confirmar Apertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR GASTO */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              <span>Registrar Gasto Operativo</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Monto ($):</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Tipo de Gasto:</label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"
                >
                  <option value="GASOLINE">GASOLINA</option>
                  <option value="TOLL">PEAJE / CASETA</option>
                  <option value="TRANSPORT">TRANSPORTE</option>
                  <option value="PARKING">ESTACIONAMIENTO</option>
                  <option value="FOOD">ALIMENTOS</option>
                  <option value="MAINTENANCE">MANTENIMIENTO</option>
                  <option value="OTHER">OTRO</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Descripción:</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"
                  placeholder="Motivo del gasto"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowExpenseModal(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs">
                Cancelar
              </button>
              <button onClick={handleCreateExpense} className="flex-1 py-3 bg-amber-600 text-white font-bold rounded-xl text-xs">
                Enviar a Revisión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RETIRO */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-indigo-400" />
              <span>Retiro de Efectivo</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Monto a Retirar ($):</label>
                <input
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Motivo / Destino:</label>
                <input
                  type="text"
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"
                  placeholder="Ej. Depósito en bóveda sucursal"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowWithdrawalModal(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs">
                Cancelar
              </button>
              <button onClick={handleWithdrawal} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-xs">
                Confirmar Retiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ARQUEO DE CAJA DENOMINACIONES */}
      {showCountModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-cyan-400" />
                <span>Arqueo por Denominaciones</span>
              </h3>
              <p className="text-sm font-black text-cyan-400">Total: ${calculatedTotal.toFixed(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { key: 'b1000', label: 'Billetes $1000' },
                { key: 'b500', label: 'Billetes $500' },
                { key: 'b200', label: 'Billetes $200' },
                { key: 'b100', label: 'Billetes $100' },
                { key: 'b50', label: 'Billetes $50' },
                { key: 'b20', label: 'Billetes $20' },
                { key: 'c20', label: 'Monedas $20' },
                { key: 'c10', label: 'Monedas $10' },
                { key: 'c5', label: 'Monedas $5' },
                { key: 'c2', label: 'Monedas $2' },
                { key: 'c1', label: 'Monedas $1' },
              ].map((item) => (
                <div key={item.key} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 font-bold block">{item.label}</span>
                  <input
                    type="number"
                    min="0"
                    value={(bills as any)[item.key]}
                    onChange={(e) => setBills({ ...bills, [item.key]: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent text-white font-bold text-sm mt-1 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCountModal(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs">
                Cancelar
              </button>
              <button onClick={handleCountCash} className="flex-1 py-3 bg-cyan-600 text-white font-bold rounded-xl text-xs">
                Guardar Arqueo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CERRAR CAJA */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-400" />
              <span>Confirmar Cierre de Caja</span>
            </h3>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Al cerrar la caja se bloqueará la edición post-cierre y se enviará la conciliación final a supervisión.
              </p>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Notas de Cierre:</label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs"
                  placeholder="Observaciones de entrega de efectivo"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCloseModal(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs">
                Cancelar
              </button>
              <button onClick={handleCloseCash} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl text-xs">
                Procesar Cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
