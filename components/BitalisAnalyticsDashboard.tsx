'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Venta, Abono, Zona, Cliente, MorosidadStatus, DiaSemana } from '@/types';
import MetasVentasVsCobrosRutaPanel from './MetasVentasVsCobrosRutaPanel';
import ResumenAbonosEnganchesPanel from './ResumenAbonosEnganchesPanel';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieIcon,
  ShieldAlert,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Award,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  DollarSign,
  Filter,
  Bell,
  BellRing,
  BellOff,
  Volume2,
  Sparkles,
  FileText,
  CreditCard,
  Wallet,
  Building,
  Receipt,
} from 'lucide-react';

export interface TipoCobroBreakdownItem {
  nombre: string;
  efectivo: number;
  transferencia: number;
  otros: number;
  totalRecaudado: number;
  metaProyectada: number;
  cumplimientoPct: number;
  diaCobro?: string;
}

interface BitalisAnalyticsDashboardProps {
  ventas: Venta[];
  abonos: Abono[];
  zonas: Zona[];
  clientes: Cliente[];
}

export default function BitalisAnalyticsDashboard({
  ventas,
  abonos,
  zonas,
  clientes,
}: BitalisAnalyticsDashboardProps) {
  // Time range state for daily sales chart
  const [timeRangeDays, setTimeRangeDays] = useState<number>(10);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('TODAS');
  const [stackedChartView, setStackedChartView] = useState<'dia' | 'zona'>('dia');

  // Push Notification State
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [isPushEnabled, setIsPushEnabled] = useState<boolean>(true);
  const [pushToastMessage, setPushToastMessage] = useState<string | null>(null);
  const lastAlertTimeRef = useRef<number>(0);

  // Today's Date String (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // 0. Monitor Captación del Día vs Ventas Aprobadas y Promedio Histórico Semanal
  const monitorCaptacionHoy = useMemo(() => {
    // Today's Approved Sales
    const ventasHoyAprobadas = ventas.filter((v) => {
      const vDate = (v.fechaVenta || '').split('T')[0];
      return vDate === todayStr && v.estado === 'APROBADA';
    });

    const montoVentasAprobadasHoy = ventasHoyAprobadas.reduce((sum, v) => {
      return sum + (v.tipo === 'CONTADO' ? v.precioBase : v.saldoInicial);
    }, 0);
    const countVentasAprobadasHoy = ventasHoyAprobadas.length;

    // Today's Cash Collection (Abonos Recibidos hoy)
    const abonosHoy = abonos.filter((a) => {
      const aDate = (a.fechaPago || '').split('T')[0];
      return aDate === todayStr;
    });

    const montoAbonosHoy = abonosHoy.reduce((sum, a) => sum + a.monto, 0);
    const countAbonosHoy = abonosHoy.length;

    // Historical Weekly Cash Collection Average (Past 28 Days)
    const past28DaysAgo = new Date();
    past28DaysAgo.setDate(past28DaysAgo.getDate() - 28);
    const past28Str = past28DaysAgo.toISOString().split('T')[0];

    const abonosPast28 = abonos.filter((a) => {
      const aDate = (a.fechaPago || '').split('T')[0];
      return aDate >= past28Str;
    });

    const totalAbonosPast28 = abonosPast28.reduce((sum, a) => sum + a.monto, 0);
    const promedioSemanalHistorico = Math.round(totalAbonosPast28 / 4) || 1000;
    const promedioDiarioHistorico = Math.round(promedioSemanalHistorico / 7) || 200;

    // Comparison
    const estaPorDebajo = montoAbonosHoy < promedioDiarioHistorico;
    const diferenciaMonto = Math.abs(montoAbonosHoy - promedioDiarioHistorico);
    const porcentajeRelativo = promedioDiarioHistorico > 0
      ? Math.round((montoAbonosHoy / promedioDiarioHistorico) * 100)
      : 100;

    return {
      montoVentasAprobadasHoy,
      countVentasAprobadasHoy,
      montoAbonosHoy,
      countAbonosHoy,
      promedioSemanalHistorico,
      promedioDiarioHistorico,
      estaPorDebajo,
      diferenciaMonto,
      porcentajeRelativo,
    };
  }, [ventas, abonos, todayStr]);

  // Automatic Push Alert Trigger if collection drops below average
  useEffect(() => {
    if (monitorCaptacionHoy.estaPorDebajo && isPushEnabled && pushPermission === 'granted') {
      const now = Date.now();
      if (now - lastAlertTimeRef.current > 15 * 60 * 1000) {
        lastAlertTimeRef.current = now;
        try {
          new Notification('⚠️ ALERTA PUSH BITALIS: Captación de Efectivo Baja', {
            body: `Captación de hoy ($${monitorCaptacionHoy.montoAbonosHoy.toLocaleString()} MXN) está por debajo del promedio histórico ($${monitorCaptacionHoy.promedioDiarioHistorico.toLocaleString()} MXN/día).`,
            icon: '/favicon.ico',
          });
        } catch (e) {
          console.error('Error firing Push notification:', e);
        }
      }
    }
  }, [monitorCaptacionHoy, isPushEnabled, pushPermission]);

  // Handlers for push button
  const handleTogglePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Tu navegador no admite notificaciones Web Push.');
      return;
    }

    if (Notification.permission === 'default') {
      const res = await Notification.requestPermission();
      setPushPermission(res);
      if (res === 'granted') {
        setIsPushEnabled(true);
        new Notification('🔔 Alertas Push BITALIS Activadas', {
          body: 'Notificaciones activas para monitorear ventas aprobadas vs abonos del día en tiempo real.',
          icon: '/favicon.ico',
        });
        setPushToastMessage('¡Notificaciones Push Web activadas exitosamente!');
        setTimeout(() => setPushToastMessage(null), 4000);
      } else {
        setIsPushEnabled(false);
        alert('Permiso para notificaciones push no otorgado en el navegador.');
      }
    } else if (Notification.permission === 'granted') {
      setIsPushEnabled(!isPushEnabled);
      setPushToastMessage(!isPushEnabled ? 'Alertas Push Reactivadas.' : 'Alertas Push Pausadas.');
      setTimeout(() => setPushToastMessage(null), 3000);
    } else {
      alert('Las notificaciones están bloqueadas en tu navegador. Puedes desbloquearlas desde los permisos del sitio.');
    }
  };

  const handleTestPushAlert = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && isPushEnabled) {
      new Notification('🔔 Prueba de Alerta Push BITALIS', {
        body: `[MONITOREO] Ventas Aprobadas Hoy: $${monitorCaptacionHoy.montoVentasAprobadasHoy.toLocaleString()} MXN | Abonos Hoy: $${monitorCaptacionHoy.montoAbonosHoy.toLocaleString()} MXN vs Promedio: $${monitorCaptacionHoy.promedioDiarioHistorico.toLocaleString()} MXN`,
        icon: '/favicon.ico',
      });
    }
    setPushToastMessage(`🔔 Alerta Push Enviada: Ventas aprobadas $${monitorCaptacionHoy.montoVentasAprobadasHoy.toLocaleString()} vs Abonos $${monitorCaptacionHoy.montoAbonosHoy.toLocaleString()}`);
    setTimeout(() => setPushToastMessage(null), 5000);
  };

  // 1. Process Daily Sales Volume Data
  const dailyData = useMemo(() => {
    // Generate dates for the selected range
    const dates: string[] = [];
    const today = new Date();

    for (let i = timeRangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    return dates.map((dateStr) => {
      // Filter sales on this date
      const salesOnDate = ventas.filter((v) => {
        if (v.estado === 'RECHAZADA') return false;
        const vDate = (v.fechaVenta || '').split('T')[0];
        if (vDate !== dateStr) return false;
        if (selectedZoneFilter !== 'TODAS') {
          const cli = clientes.find((c) => c.id === v.clienteId);
          if (!cli || String(cli.zonaId) !== selectedZoneFilter) return false;
        }
        return true;
      });

      const creditoSales = salesOnDate.filter((v) => v.tipo === 'CREDITO');
      const contadoSales = salesOnDate.filter((v) => v.tipo === 'CONTADO');

      const montoCredito = creditoSales.reduce((sum, v) => sum + v.saldoInicial, 0);
      const montoContado = contadoSales.reduce((sum, v) => sum + v.precioBase, 0);
      const montoTotal = montoCredito + montoContado;

      // Abonos (Collection) on this date
      const abonosOnDate = abonos.filter((a) => {
        const aDate = (a.fechaPago || '').split('T')[0];
        if (aDate !== dateStr) return false;
        if (selectedZoneFilter !== 'TODAS') {
          const cli = clientes.find((c) => c.id === a.clienteId);
          if (!cli || String(cli.zonaId) !== selectedZoneFilter) return false;
        }
        return true;
      });

      const montoCobrado = abonosOnDate.reduce((sum, a) => sum + a.monto, 0);

      // Short label format (e.g., "28 Jul")
      const [year, month, day] = dateStr.split('-');
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const shortLabel = `${parseInt(day, 10)} ${monthNames[parseInt(month, 10) - 1]}`;

      return {
        fechaFull: dateStr,
        fechaLabel: shortLabel,
        totalVentasMonto: montoTotal,
        creditoMonto: montoCredito,
        contadoMonto: montoContado,
        ventasCount: salesOnDate.length,
        creditoCount: creditoSales.length,
        contadoCount: contadoSales.length,
        cobradoMonto: montoCobrado,
        flujoNeto: montoCobrado - montoTotal,
      };
    });
  }, [ventas, abonos, clientes, timeRangeDays, selectedZoneFilter]);

  // Summary Metrics for Sales Volume
  const salesSummary = useMemo(() => {
    const totalMontoRange = dailyData.reduce((s, d) => s + d.totalVentasMonto, 0);
    const totalContratosRange = dailyData.reduce((s, d) => s + d.ventasCount, 0);
    const totalCobradoRange = dailyData.reduce((s, d) => s + d.cobradoMonto, 0);
    const promedioDiarioMonto = Math.round(totalMontoRange / (dailyData.length || 1));

    // Best sales day
    let maxDay = dailyData[0];
    dailyData.forEach((d) => {
      if (d.totalVentasMonto > (maxDay?.totalVentasMonto || 0)) {
        maxDay = d;
      }
    });

    return {
      totalMontoRange,
      totalContratosRange,
      totalCobradoRange,
      promedioDiarioMonto,
      maxDayLabel: maxDay?.fechaLabel || 'N/A',
      maxDayMonto: maxDay?.totalVentasMonto || 0,
    };
  }, [dailyData]);

  // 2. Process Collection Progress by Zone (Progreso de Cobranza por Zona)
  const zoneCollectionData = useMemo(() => {
    return zonas.map((zona) => {
      // Find clients in this zone
      const clientsInZone = clientes.filter((c) => c.zonaId === zona.id);
      const clientIds = new Set(clientsInZone.map((c) => c.id));

      // Active sales in this zone
      const salesInZone = ventas.filter((v) => clientIds.has(v.clienteId) && v.estado !== 'RECHAZADA');
      const saldoTotalCartera = salesInZone.reduce((sum, v) => sum + v.saldoActual, 0);

      // Total Expected Weekly Collection Target (Sum of active weekly payments)
      const metaCobroSemanal = salesInZone.reduce((sum, v) => sum + (v.saldoActual > 0 ? v.pagoSemanal : 0), 0);

      // Abonos collected in this zone (all-time or recent)
      const abonosInZone = abonos.filter((a) => clientIds.has(a.clienteId));
      const totalRecaudadoZona = abonosInZone.reduce((sum, a) => sum + a.monto, 0);

      // Abonos collected this week (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

      const abonosSemanaZona = abonosInZone.filter((a) => (a.fechaPago || '').split('T')[0] >= sevenDaysStr);
      const cobradoSemanaActual = abonosSemanaZona.reduce((sum, a) => sum + a.monto, 0);

      // Calculate progress percentage vs weekly target (capped at 150% for display)
      const porcentajeProgresoSemanal = metaCobroSemanal > 0
        ? Math.min(100, Math.round((cobradoSemanaActual / metaCobroSemanal) * 100))
        : 0;

      // Morosity counts in zone
      const clientesVerde = clientsInZone.filter((c) => c.estadoMorosidad === 'VERDE').length;
      const clientesAmarillo = clientsInZone.filter((c) => c.estadoMorosidad === 'AMARILLO').length;
      const clientesRojo = clientsInZone.filter((c) => c.estadoMorosidad === 'ROJO').length;

      return {
        zonaId: zona.id,
        nombreZona: zona.nombre,
        diaCobro: zona.diaCobro,
        totalClientes: clientsInZone.length,
        saldoTotalCartera,
        metaCobroSemanal,
        cobradoSemanaActual,
        porcentajeProgresoSemanal,
        totalRecaudadoZona,
        clientesVerde,
        clientesAmarillo,
        clientesRojo,
      };
    });
  }, [zonas, clientes, ventas, abonos]);

  // 3. Process Client Morosity Health (Pie Chart)
  const morosityDistribution = useMemo(() => {
    let verde = 0;
    let amarillo = 0;
    let rojo = 0;

    clientes.forEach((c) => {
      if (c.estadoMorosidad === 'VERDE') verde++;
      else if (c.estadoMorosidad === 'AMARILLO') amarillo++;
      else if (c.estadoMorosidad === 'ROJO') rojo++;
    });

    const total = clientes.length || 1;

    return [
      { name: 'Excelente (Verde)', value: verde, percent: Math.round((verde / total) * 100), color: '#10b981' },
      { name: 'Atraso Moderado (Amarillo)', value: amarillo, percent: Math.round((amarillo / total) * 100), color: '#f59e0b' },
      { name: 'Moroso Crítico (Rojo)', value: rojo, percent: Math.round((rojo / total) * 100), color: '#ef4444' },
    ];
  }, [clientes]);

  // 4. Decision Insights
  const decisionInsights = useMemo(() => {
    if (!zoneCollectionData.length) return null;

    // Sort zones by collection progress %
    const sortedByProgress = [...zoneCollectionData].sort((a, b) => b.porcentajeProgresoSemanal - a.porcentajeProgresoSemanal);
    const topZone = sortedByProgress[0];
    const riskZone = sortedByProgress[sortedByProgress.length - 1];

    // Calculate total collection efficiency across all zones
    const totalMetaGlobal = zoneCollectionData.reduce((sum, z) => sum + z.metaCobroSemanal, 0);
    const totalCobradoGlobal = zoneCollectionData.reduce((sum, z) => sum + z.cobradoSemanaActual, 0);
    const globalProgressPct = totalMetaGlobal > 0 ? Math.round((totalCobradoGlobal / totalMetaGlobal) * 100) : 0;

    return {
      topZone,
      riskZone,
      totalMetaGlobal,
      totalCobradoGlobal,
      globalProgressPct,
    };
  }, [zoneCollectionData]);

  // 5. PROCESS DESGLOSE DE ABONOS POR TIPO DE COBRO Y COMPARATIVA CON META SEMANAL PROYECTADA
  const tipoCobroData = useMemo(() => {
    let totalEfectivo = 0;
    let countEfectivo = 0;

    let totalTransferencia = 0;
    let countTransferencia = 0;

    let totalOtros = 0;
    let countOtros = 0;

    abonos.forEach((a) => {
      const tipo = (a.tipoPago || 'EFECTIVO').toUpperCase();
      if (tipo.includes('EFECTIVO')) {
        totalEfectivo += a.monto;
        countEfectivo++;
      } else if (tipo.includes('TRANSFERENCIA') || tipo.includes('TRANS')) {
        totalTransferencia += a.monto;
        countTransferencia++;
      } else {
        totalOtros += a.monto;
        countOtros++;
      }
    });

    const totalAbonosMonto = totalEfectivo + totalTransferencia + totalOtros;
    const denominator = totalAbonosMonto || 1;

    const pctEfectivo = Math.round((totalEfectivo / denominator) * 100);
    const pctTransferencia = Math.round((totalTransferencia / denominator) * 100);
    const pctOtros = Math.round((totalOtros / denominator) * 100);

    // Projected Global Weekly Target from active sales commitments
    const metaSemanalGlobal = ventas
      .filter((v) => v.estado !== 'RECHAZADA' && v.saldoActual > 0)
      .reduce((sum, v) => sum + v.pagoSemanal, 0) || 5000;

    // Breakdown by Day of the Week
    const diasSemana: DiaSemana[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    const breakdownPorDia: TipoCobroBreakdownItem[] = diasSemana.map((dia) => {
      const ventasDia = ventas.filter((v) => {
        if (v.estado === 'RECHAZADA' || v.saldoActual <= 0) return false;
        const cli = clientes.find((c) => c.id === v.clienteId);
        if (!cli) return false;
        const z = zonas.find((zona) => zona.id === cli.zonaId);
        return z ? z.diaCobro === dia : false;
      });

      const metaProyectadaDia = ventasDia.reduce((sum, v) => sum + v.pagoSemanal, 0) || Math.round(metaSemanalGlobal / 5);

      const abonosDia = abonos.filter((a) => {
        const cli = clientes.find((c) => c.id === a.clienteId);
        if (!cli) return false;
        const z = zonas.find((zona) => zona.id === cli.zonaId);
        return z ? z.diaCobro === dia : false;
      });

      let efec = 0;
      let trans = 0;
      let otros = 0;

      abonosDia.forEach((a) => {
        const t = (a.tipoPago || 'EFECTIVO').toUpperCase();
        if (t.includes('EFECTIVO')) efec += a.monto;
        else if (t.includes('TRANSFERENCIA') || t.includes('TRANS')) trans += a.monto;
        else otros += a.monto;
      });

      if (efec === 0 && trans === 0 && abonos.length > 0) {
        abonos.forEach((a) => {
          const dt = new Date(a.fechaPago || '');
          const dayNameMap: Record<number, DiaSemana> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };
          const dayName = dayNameMap[dt.getDay()];
          if (dayName === dia) {
            const t = (a.tipoPago || 'EFECTIVO').toUpperCase();
            if (t.includes('EFECTIVO')) efec += a.monto;
            else if (t.includes('TRANSFERENCIA') || t.includes('TRANS')) trans += a.monto;
            else otros += a.monto;
          }
        });
      }

      const totalDia = efec + trans + otros;

      return {
        nombre: dia,
        efectivo: efec,
        transferencia: trans,
        otros: otros,
        totalRecaudado: totalDia,
        metaProyectada: metaProyectadaDia,
        cumplimientoPct: metaProyectadaDia > 0 ? Math.round((totalDia / metaProyectadaDia) * 100) : 0,
      };
    });

    // Breakdown by Zone
    const breakdownPorZona: TipoCobroBreakdownItem[] = zonas.map((z) => {
      const clientsInZone = clientes.filter((c) => c.zonaId === z.id);
      const clientIds = new Set(clientsInZone.map((c) => c.id));

      const salesInZone = ventas.filter((v) => clientIds.has(v.clienteId) && v.estado !== 'RECHAZADA');
      const metaProyectadaZona = salesInZone.reduce((sum, v) => sum + (v.saldoActual > 0 ? v.pagoSemanal : 0), 0) || 1000;

      const abonosInZone = abonos.filter((a) => clientIds.has(a.clienteId));

      let efec = 0;
      let trans = 0;
      let otros = 0;

      abonosInZone.forEach((a) => {
        const t = (a.tipoPago || 'EFECTIVO').toUpperCase();
        if (t.includes('EFECTIVO')) efec += a.monto;
        else if (t.includes('TRANSFERENCIA') || t.includes('TRANS')) trans += a.monto;
        else otros += a.monto;
      });

      const totalZona = efec + trans + otros;

      return {
        nombre: z.nombre,
        diaCobro: z.diaCobro,
        efectivo: efec,
        transferencia: trans,
        otros: otros,
        totalRecaudado: totalZona,
        metaProyectada: metaProyectadaZona,
        cumplimientoPct: metaProyectadaZona > 0 ? Math.round((totalZona / metaProyectadaZona) * 100) : 0,
      };
    });

    return {
      totalEfectivo,
      countEfectivo,
      pctEfectivo,
      totalTransferencia,
      countTransferencia,
      pctTransferencia,
      totalOtros,
      countOtros,
      pctOtros,
      totalAbonosMonto,
      metaSemanalGlobal,
      breakdownPorDia,
      breakdownPorZona,
    };
  }, [abonos, ventas, clientes, zonas]);

  return (
    <div className="space-y-6">
      {/* HEADER & CONTROLS */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/60 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-500/50 text-indigo-300">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
              </div>
              Dashboard Analítico BITALIS
            </h2>
            <p className="text-xs text-slate-300">
              Visualización interactiva de ventas diarias, progreso de cobranza por zona e inteligencia para toma de decisiones.
            </p>
          </div>

          {/* Time & Zone Filters */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Zone Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400 font-medium">Zona:</span>
              <select
                value={selectedZoneFilter}
                onChange={(e) => setSelectedZoneFilter(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="TODAS" className="bg-slate-900 text-white">Todas las Zonas</option>
                {zonas.map((z) => (
                  <option key={z.id} value={String(z.id)} className="bg-slate-900 text-white">
                    {z.nombre} ({z.diaCobro})
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 gap-1">
              {[
                { days: 7, label: '7 Días' },
                { days: 10, label: '10 Días' },
                { days: 14, label: '14 Días' },
                { days: 30, label: '30 Días' },
              ].map((item) => (
                <button
                  key={item.days}
                  onClick={() => setTimeRangeDays(item.days)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                    timeRangeDays === item.days
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SUMMARY HIGHLIGHT BADGES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 text-[11px] block font-medium">Ventas en el Periodo ({timeRangeDays}d):</span>
            <span className="text-lg font-black text-indigo-300">
              ${salesSummary.totalMontoRange.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {salesSummary.totalContratosRange} contratos colocados
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 text-[11px] block font-medium">Promedio Venta Diaria:</span>
            <span className="text-lg font-black text-purple-300">
              ${salesSummary.promedioDiarioMonto.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN/día</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Día pico: {salesSummary.maxDayLabel} (${salesSummary.maxDayMonto.toLocaleString()})
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 text-[11px] block font-medium">Cobrado en Periodo:</span>
            <span className="text-lg font-black text-emerald-400">
              ${salesSummary.totalCobradoRange.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">
              Recaudado por abonadores
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 text-[11px] block font-medium">Cumplimiento Global Cobranza:</span>
            <span className="text-lg font-black text-amber-300">
              {decisionInsights?.globalProgressPct || 0}%
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Meta semanal meta vs real
            </span>
          </div>
        </div>
      </div>

      {/* MÓDULO EXECUTIVO DE RESUMEN & FILTRO DE ABONOS Y ENGANCHES POR VENDEDORA, COBRADOR Y TOTAL */}
      <ResumenAbonosEnganchesPanel abonos={abonos} ventas={ventas} />

      {/* PUSH NOTIFICATION TOAST FEEDBACK */}
      {pushToastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border-2 border-indigo-500 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce max-w-md">
          <div className="p-2 bg-indigo-600 rounded-xl text-white">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-indigo-300">Notificación Push BITALIS</p>
            <p className="text-slate-200">{pushToastMessage}</p>
          </div>
          <button
            onClick={() => setPushToastMessage(null)}
            className="ml-auto text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* DEDICATED RECHARTS PANEL: METAS DE VENTAS SEMANALES VS COBROS REALES POR RUTA */}
      <MetasVentasVsCobrosRutaPanel
        ventas={ventas}
        abonos={abonos}
        zonas={zonas}
        clientes={clientes}
      />

      {/* SECTION: DESGLOSE DE ABONOS POR TIPO DE COBRO Y META SEMANAL PROYECTADA (STACKED BAR CHART RECHARTS) */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-5">
        {/* HEADER & TOGGLE SWITCH */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white flex items-center gap-2.5">
              <div className="p-2 bg-emerald-600/30 rounded-xl border border-emerald-500/50 text-emerald-300">
                <Receipt className="w-5 h-5 text-emerald-400" />
              </div>
              Desglose de Abonos por Tipo de Cobro vs. Meta Semanal Proyectada
            </h3>
            <p className="text-xs text-slate-300">
              Análisis comparativo de abonos recibidos (Efectivo, Transferencia, Depósito) con la meta semanal proyectada mediante un gráfico de barras apiladas.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStackedChartView('dia')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                stackedChartView === 'dia' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Por Día de Cobro</span>
            </button>
            <button
              onClick={() => setStackedChartView('zona')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                stackedChartView === 'zona' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Por Zona Operativa</span>
            </button>
          </div>
        </div>

        {/* 4 SUMMARY METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* CARD 1: EFECTIVO */}
          <div className="bg-slate-900/90 p-4 rounded-xl border border-emerald-500/40 space-y-1.5 shadow">
            <div className="flex items-center justify-between text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Wallet className="w-4 h-4" />
                Efectivo Recaudado
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-800">
                {tipoCobroData.pctEfectivo}% del total
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-400">
              ${tipoCobroData.totalEfectivo.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800">
              <span>{tipoCobroData.countEfectivo} cobro(s) registrados</span>
              <span className="text-emerald-300 font-bold">Abonos en Ruta</span>
            </div>
          </div>

          {/* CARD 2: TRANSFERENCIA */}
          <div className="bg-slate-900/90 p-4 rounded-xl border border-indigo-500/40 space-y-1.5 shadow">
            <div className="flex items-center justify-between text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-indigo-300">
                <CreditCard className="w-4 h-4" />
                Transferencias SPEI
              </span>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-800">
                {tipoCobroData.pctTransferencia}% del total
              </span>
            </div>
            <div className="text-2xl font-black text-indigo-300">
              ${tipoCobroData.totalTransferencia.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800">
              <span>{tipoCobroData.countTransferencia} pago(s) recibidos</span>
              <span className="text-indigo-300 font-bold">SPEI / Banco</span>
            </div>
          </div>

          {/* CARD 3: META SEMANAL GLOBAL */}
          <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/40 space-y-1.5 shadow">
            <div className="flex items-center justify-between text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Target className="w-4 h-4 text-amber-400" />
                Meta Semanal Proyectada
              </span>
              <span className="text-[10px] bg-amber-950 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-800">
                {tipoCobroData.metaSemanalGlobal > 0 ? Math.round((tipoCobroData.totalAbonosMonto / tipoCobroData.metaSemanalGlobal) * 100) : 0}% avance
              </span>
            </div>
            <div className="text-2xl font-black text-amber-300">
              ${tipoCobroData.totalAbonosMonto.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ ${tipoCobroData.metaSemanalGlobal.toLocaleString()} MXN</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800">
              <span>Abonos totales: ${tipoCobroData.totalAbonosMonto.toLocaleString()}</span>
              <span className="text-amber-400 font-bold">Meta Proyectada</span>
            </div>
          </div>
        </div>

        {/* STACKED BAR CHART CONTAINER (RECHARTS) */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Gráfico de Barras Apiladas: Comparativo por Método de Pago vs. Meta Proyectada ({stackedChartView === 'dia' ? 'Por Día' : 'Por Zona'})
            </span>

            {/* Custom Legend Badges */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-3 h-3 bg-emerald-500 rounded-sm inline-block" /> 💵 Efectivo
              </span>
              <span className="flex items-center gap-1 text-indigo-300">
                <span className="w-3 h-3 bg-indigo-500 rounded-sm inline-block" /> 🏦 Transferencia
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-3 h-3 bg-amber-500/80 rounded-sm inline-block" /> 🎯 Meta Proyectada
              </span>
            </div>
          </div>

          <div className="w-full h-80 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackedChartView === 'dia' ? tipoCobroData.breakdownPorDia : tipoCobroData.breakdownPorZona}
                margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                <XAxis dataKey="nombre" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => [
                    `$${Number(value).toLocaleString('en-US')} MXN`,
                    name === 'efectivo'
                      ? 'Efectivo'
                      : name === 'transferencia'
                      ? 'Transferencia'
                      : name === 'metaProyectada'
                      ? 'Meta Semanal Proyectada'
                      : name,
                  ]}
                  labelFormatter={(lbl) => `Abonos: ${lbl}`}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '10px' }} />

                {/* STACKED BARS FOR PAYMENT TYPES */}
                <Bar dataKey="efectivo" name="Efectivo ($)" stackId="cobros" fill="#10b981" barSize={26} radius={[0, 0, 0, 0]} />
                <Bar dataKey="transferencia" name="Transferencia ($)" stackId="cobros" fill="#6366f1" barSize={26} radius={[4, 4, 0, 0]} />

                {/* COMPARISON BAR FOR META PROYECTADA */}
                <Bar dataKey="metaProyectada" name="Meta Proyectada ($)" fill="#f59e0b" opacity={0.75} barSize={26} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DETAILED DATA TABLE / GRID FOR TYPE BREAKDOWN */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-1">
          {(stackedChartView === 'dia' ? tipoCobroData.breakdownPorDia : tipoCobroData.breakdownPorZona).map((item) => (
            <div key={item.nombre} className="bg-slate-900 p-3.5 rounded-xl border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  {item.nombre}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    item.cumplimientoPct >= 100
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : item.cumplimientoPct >= 60
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {item.cumplimientoPct}% Meta
                </span>
              </div>

              {/* Progress Bar vs Meta */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 flex">
                <div
                  className="bg-emerald-500 h-full rounded-l"
                  style={{
                    width: `${item.totalRecaudado > 0 ? (item.efectivo / item.totalRecaudado) * Math.min(100, item.cumplimientoPct) : 0}%`,
                  }}
                  title={`Efectivo: $${item.efectivo}`}
                />
                <div
                  className="bg-indigo-500 h-full rounded-r"
                  style={{
                    width: `${item.totalRecaudado > 0 ? (item.transferencia / item.totalRecaudado) * Math.min(100, item.cumplimientoPct) : 0}%`,
                  }}
                  title={`Transferencia: $${item.transferencia}`}
                />
              </div>

              {/* Breakdown stats */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 text-slate-300">
                <div className="bg-slate-950/60 p-1.5 rounded-lg border border-emerald-500/20 text-center">
                  <span className="text-[10px] text-slate-400 block">Efectivo</span>
                  <span className="font-bold text-emerald-400">${item.efectivo.toLocaleString()}</span>
                </div>
                <div className="bg-slate-950/60 p-1.5 rounded-lg border border-indigo-500/20 text-center">
                  <span className="text-[10px] text-slate-400 block">Transferencia</span>
                  <span className="font-bold text-indigo-300">${item.transferencia.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>Total Recaudado: <strong className="text-white">${item.totalRecaudado.toLocaleString()} MXN</strong></span>
                <span>Meta: <strong className="text-amber-400">${item.metaProyectada.toLocaleString()} MXN</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* INDICADOR VISUAL EN PANEL BITALIS: MONITOR DE CAPTACIÓN HOY VS VENTAS APROBADAS Y PROMEDIO HISTÓRICO SEMANAL */}
      <div
        className={`border-2 rounded-2xl p-5 shadow-2xl space-y-4 transition-all ${
          monitorCaptacionHoy.estaPorDebajo
            ? 'bg-gradient-to-br from-slate-900 via-rose-950/70 to-slate-900 border-rose-500/80 shadow-rose-950/40'
            : 'bg-gradient-to-br from-slate-900 via-emerald-950/70 to-slate-900 border-emerald-500/80 shadow-emerald-950/40'
        }`}
      >
        {/* WIDGET HEADER & PUSH ALERT CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span
                className={`p-2 rounded-xl text-white font-bold ${
                  monitorCaptacionHoy.estaPorDebajo ? 'bg-rose-600/40 text-rose-300 border border-rose-500/60' : 'bg-emerald-600/40 text-emerald-300 border border-emerald-500/60'
                }`}
              >
                {monitorCaptacionHoy.estaPorDebajo ? <AlertTriangle className="w-5 h-5 animate-bounce" /> : <CheckCircle2 className="w-5 h-5" />}
              </span>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Monitor de Captación Diaria BITALIS
                  {monitorCaptacionHoy.estaPorDebajo && (
                    <span className="text-[10px] bg-rose-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      ¡Alerta de Captación Baja!
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-300">
                  Monitoreo en tiempo real de ventas aprobadas hoy vs abonos cobrados y promedio histórico semanal.
                </p>
              </div>
            </div>
          </div>

          {/* PUSH ALERT BUTTONS */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePush}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition shadow cursor-pointer ${
                isPushEnabled && pushPermission === 'granted'
                  ? 'bg-indigo-600 text-white border-indigo-400 hover:bg-indigo-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Activar/Desactivar notificaciones push del navegador"
            >
              {isPushEnabled && pushPermission === 'granted' ? (
                <>
                  <BellRing className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Push Activas</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Activar Alertas Push</span>
                </>
              )}
            </button>

            <button
              onClick={handleTestPushAlert}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-600 flex items-center gap-1.5 transition cursor-pointer"
              title="Enviar una notificación push de prueba en tu navegador"
            >
              <Bell className="w-3.5 h-3.5 text-purple-300" />
              <span>Probar Alerta Push</span>
            </button>
          </div>
        </div>

        {/* 4 KPI CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Card 1: Ventas Aprobadas Hoy */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-indigo-500/30 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-[11px]">Ventas Aprobadas Hoy</span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-black text-indigo-300">
              ${monitorCaptacionHoy.montoVentasAprobadasHoy.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {monitorCaptacionHoy.countVentasAprobadasHoy} contrato(s) aprobados hoy
            </p>
          </div>

          {/* Card 2: Abonos / Efectivo Captado Hoy */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-emerald-500/30 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-[11px]">Abonos Recibidos Hoy</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">
              ${monitorCaptacionHoy.montoAbonosHoy.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {monitorCaptacionHoy.countAbonosHoy} pago(s) de abonos ingresados hoy
            </p>
          </div>

          {/* Card 3: Promedio Histórico Diario */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-purple-500/30 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-[11px]">Promedio Histórico Diario</span>
              <Calendar className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-black text-purple-300">
              ${monitorCaptacionHoy.promedioDiarioHistorico.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN/día</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Promedio semanal: ${monitorCaptacionHoy.promedioSemanalHistorico.toLocaleString()} MXN
            </p>
          </div>

          {/* Card 4: Desviación de Captación */}
          <div
            className={`p-3.5 rounded-xl border space-y-1 ${
              monitorCaptacionHoy.estaPorDebajo
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-semibold text-[11px]">Diferencia vs Promedio</span>
              {monitorCaptacionHoy.estaPorDebajo ? (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              ) : (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <div
              className={`text-xl font-black ${
                monitorCaptacionHoy.estaPorDebajo ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {monitorCaptacionHoy.estaPorDebajo ? '-' : '+'}
              ${monitorCaptacionHoy.diferenciaMonto.toLocaleString()} <span className="text-xs font-normal">MXN</span>
            </div>
            <p className="text-[11px] font-bold">
              {monitorCaptacionHoy.porcentajeRelativo}% alcanzado de la meta diaria
            </p>
          </div>
        </div>

        {/* COMPARATIVE VISUAL PROGRESS BAR */}
        <div className="bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Nivel de Captación Hoy vs Promedio Histórico Diario
            </span>
            <span
              className={`font-black ${
                monitorCaptacionHoy.estaPorDebajo ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              ${monitorCaptacionHoy.montoAbonosHoy.toLocaleString()} / ${monitorCaptacionHoy.promedioDiarioHistorico.toLocaleString()} MXN
            </span>
          </div>

          <div className="w-full bg-slate-800 h-3.5 rounded-full overflow-hidden p-0.5 relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                monitorCaptacionHoy.estaPorDebajo ? 'bg-gradient-to-r from-rose-600 to-amber-500' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
              }`}
              style={{ width: `${Math.min(100, monitorCaptacionHoy.porcentajeRelativo)}%` }}
            />
          </div>

          {/* ALERT RECOMMENDATION FOOTER */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              monitorCaptacionHoy.estaPorDebajo
                ? 'bg-rose-950/80 border-rose-700/80 text-rose-200'
                : 'bg-emerald-950/80 border-emerald-700/80 text-emerald-200'
            }`}
          >
            {monitorCaptacionHoy.estaPorDebajo ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-rose-300">
                    ⚠️ ALERTA BITALIS: Captación de efectivo en riesgo
                  </p>
                  <p className="text-[11px] text-slate-200">
                    Los abonos recaudados hoy (${monitorCaptacionHoy.montoAbonosHoy.toLocaleString()} MXN) están{' '}
                    <strong className="text-rose-300">${monitorCaptacionHoy.diferenciaMonto.toLocaleString()} MXN por debajo</strong> del promedio histórico diario (${monitorCaptacionHoy.promedioDiarioHistorico.toLocaleString()} MXN/día).
                    Se han activado alertas Push para enviar recordatorios a los cobradores de ruta.
                  </p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-emerald-300">
                    ✅ Captación de efectivo en rango óptimo
                  </p>
                  <p className="text-[11px] text-slate-200">
                    Los abonos recaudados hoy (${monitorCaptacionHoy.montoAbonosHoy.toLocaleString()} MXN) superan la meta del promedio histórico diario (${monitorCaptacionHoy.promedioDiarioHistorico.toLocaleString()} MXN/día) con un excedente positivo de +${monitorCaptacionHoy.diferenciaMonto.toLocaleString()} MXN.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CHART SECTION 1: VOLUMEN DE VENTAS DIARIAS (RECHARTS COMPOSED CHART) */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Volumen de Ventas Diarias ($ MXN y Contratos)
            </h3>
            <p className="text-xs text-slate-400">
              Compara la colocación a Crédito vs Contado y monitorea la tendencia de ventas por día.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <span className="w-3 h-3 bg-indigo-500 rounded-sm inline-block" /> Ventas Crédito
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 bg-emerald-400 rounded-sm inline-block" /> Ventas Contado
            </span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Tendencia Total
            </span>
          </div>
        </div>

        {/* Recharts Component: Daily Sales */}
        <div className="w-full h-72 sm:h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCredito" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorContado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
              <XAxis dataKey="fechaLabel" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value: any, name: any) => [
                  `$${Number(value).toLocaleString('en-US')} MXN`,
                  name === 'creditoMonto' ? 'Crédito' : name === 'contadoMonto' ? 'Contado' : name === 'totalVentasMonto' ? 'Total' : name,
                ]}
                labelFormatter={(label) => `Fecha: ${label}`}
              />
              <Bar dataKey="creditoMonto" name="creditoMonto" fill="url(#colorCredito)" radius={[6, 6, 0, 0]} barSize={20} />
              <Bar dataKey="contadoMonto" name="contadoMonto" fill="url(#colorContado)" radius={[6, 6, 0, 0]} barSize={20} />
              <Line type="monotone" dataKey="totalVentasMonto" name="totalVentasMonto" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHART SECTION 2 & 3: PROGRESO DE COBRANZA POR ZONA & MOROSIDAD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 7 COLS: PROGRESO DE COBRANZA POR ZONA (BAR CHART) */}
        <div className="lg:col-span-7 bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                Progreso de Cobranza por Zona
              </h3>
              <p className="text-xs text-slate-400">
                Comparativa entre Meta Semanal Esperada vs Recaudación Real.
              </p>
            </div>

            <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-full font-semibold">
              Efectividad Semanal
            </span>
          </div>

          {/* Recharts Component: Zone Collection Progress */}
          <div className="w-full h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneCollectionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                <XAxis dataKey="nombreZona" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [
                    `$${Number(val).toLocaleString()} MXN`,
                    name === 'metaCobroSemanal' ? 'Meta Esperada' : 'Recaudado Real',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Bar dataKey="metaCobroSemanal" name="Meta Esperada ($)" fill="#475569" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="cobradoSemanaActual" name="Recaudado Real ($)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Zone Detail Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
            {zoneCollectionData.map((z) => (
              <div key={z.zonaId} className="bg-slate-900 p-3 rounded-xl border border-slate-700/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{z.nombreZona}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      z.porcentajeProgresoSemanal >= 80
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : z.porcentajeProgresoSemanal >= 50
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {z.porcentajeProgresoSemanal}% Meta
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all ${
                      z.porcentajeProgresoSemanal >= 80
                        ? 'bg-emerald-500'
                        : z.porcentajeProgresoSemanal >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${z.porcentajeProgresoSemanal}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Recaudado: <strong className="text-white">${z.cobradoSemanaActual.toLocaleString()}</strong></span>
                  <span>Meta: <strong className="text-slate-300">${z.metaCobroSemanal.toLocaleString()}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT 5 COLS: SALUD DE CARTERA (DONUT PIE CHART) & INSIGHTS */}
        <div className="lg:col-span-5 space-y-6">
          {/* MOROSIDAD DONUT CHART */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-purple-400" />
                Salud & Morosidad de Cartera
              </h3>
              <span className="text-xs text-slate-400 font-bold">{clientes.length} Clientes</span>
            </div>

            <div className="w-full h-52 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={morosityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {morosityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val} clientes`, 'Cantidad']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-white">{clientes.length}</span>
                <span className="text-[10px] text-slate-400 font-semibold">Total Expedientes</span>
              </div>
            </div>

            {/* Legend breakdown */}
            <div className="space-y-2 text-xs">
              {morosityDistribution.map((item) => (
                <div
                  key={item.name}
                  className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300 font-medium">{item.name}</span>
                  </div>
                  <div className="font-bold text-white">
                    {item.value} <span className="text-slate-400 text-[11px]">({item.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: TOMA DE DECISIONES BASADA EN DATOS (INSIGHTS INTELLIGENCE PANEL) */}
      {decisionInsights && (
        <div className="bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-purple-800/40 pb-3">
            <h3 className="text-lg font-black text-white flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-amber-400" />
              Recomendaciones & Decisiones Operativas (Inteligencia BITALIS)
            </h3>
            <span className="text-xs bg-purple-900/60 text-purple-200 border border-purple-700/60 px-3 py-1 rounded-full font-bold">
              Basado en Datos en Tiempo Real
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* INSIGHT 1: TOP PERFORMANCE ZONE */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/40 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-sm">
                <Award className="w-5 h-5" />
                <span>Zona Destacada en Cobranza</span>
              </div>
              <p className="text-slate-300">
                La <strong className="text-white font-bold">{decisionInsights.topZone.nombreZona}</strong> lidera el nivel de cumplimiento con{' '}
                <strong className="text-emerald-400">{decisionInsights.topZone.porcentajeProgresoSemanal}%</strong> de la meta semanal recaudada (
                ${decisionInsights.topZone.cobradoSemanaActual.toLocaleString()} MXN).
              </p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-emerald-300 font-semibold">
                ✓ Acción sugerida: Mantener estrategia y otorgar bonificación de productividad al cobrador asignado.
              </div>
            </div>

            {/* INSIGHT 2: RISK ZONE ATTENTION */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-rose-500/40 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-extrabold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Atención Requerida</span>
              </div>
              <p className="text-slate-300">
                La <strong className="text-white font-bold">{decisionInsights.riskZone.nombreZona}</strong> presenta un avance del{' '}
                <strong className="text-rose-400">{decisionInsights.riskZone.porcentajeProgresoSemanal}%</strong> de su meta de cobro semanal.
              </p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-rose-300 font-semibold">
                ⚠ Acción sugerida: Asignar supervisión presencial el día {decisionInsights.riskZone.diaCobro} para recuperar cartera atrasada.
              </div>
            </div>

            {/* INSIGHT 3: CASH FLOW & EFFICIENCY */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-500/40 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <span>Eficiencia Global de Flujo de Caja</span>
              </div>
              <p className="text-slate-300">
                El avance promedio en las {zonas.length} zonas operativas es del{' '}
                <strong className="text-indigo-300">{decisionInsights.globalProgressPct}%</strong> con un ingreso semanal recaudado de{' '}
                <strong className="text-white">${decisionInsights.totalCobradoGlobal.toLocaleString()} MXN</strong>.
              </p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-indigo-300 font-semibold">
                ⚡ Acción sugerida: Reforzar el cierre de ventas a contado en vendedoras para acelerar la recuperación de inversión inicial.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
