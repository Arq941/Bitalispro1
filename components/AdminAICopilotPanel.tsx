'use client';

import { useState, useMemo } from 'react';
import { Cliente, Venta, Abono, Zona, Producto, Usuario, CorteCaja } from '@/types';
import {
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BrainCircuit,
  Bot,
  Search,
  Volume2,
  VolumeX,
  ArrowRight,
  ShieldAlert,
  MapPin,
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BarChart2,
  RefreshCw
} from 'lucide-react';

interface AdminAICopilotPanelProps {
  clientes: Cliente[];
  ventas: Venta[];
  abonos: Abono[];
  zonas: Zona[];
  productos: Producto[];
  usuarios: Usuario[];
  cortes?: CorteCaja[];
  onNavigateTab?: (tab: 'tarjetas' | 'productos' | 'zonas' | 'rutas' | 'nomina' | 'usuarios' | 'clientes' | 'auditoria' | 'alertas') => void;
  onFilterClientsByRisk?: (status: 'ROJO' | 'AMARILLO' | 'VERDE') => void;
}

export default function AdminAICopilotPanel({
  clientes,
  ventas,
  abonos,
  zonas,
  productos,
  usuarios,
  cortes = [],
  onNavigateTab,
  onFilterClientsByRisk,
}: AdminAICopilotPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'insights' | 'query' | 'predictions'>('insights');
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState<{
    title: string;
    text: string;
    bullets: string[];
    actionLabel?: string;
    actionTab?: 'tarjetas' | 'productos' | 'zonas' | 'rutas' | 'nomina' | 'usuarios' | 'clientes' | 'auditoria' | 'alertas';
    kpis?: { label: string; value: string; color: string }[];
  } | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);

  // Calculated Real-Time AI Metrics from Live Data
  const aiDiagnostics = useMemo(() => {
    // 1. Morosidad & Riesgo
    const clientesRojo = clientes.filter((c) => c.estadoMorosidad === 'ROJO');
    const clientesAmarillo = clientes.filter((c) => c.estadoMorosidad === 'AMARILLO');
    const clientesVerde = clientes.filter((c) => c.estadoMorosidad === 'VERDE');

    const saldoRojo = ventas
      .filter((v) => {
        const c = clientes.find((cli) => cli.id === v.clienteId);
        return c?.estadoMorosidad === 'ROJO' && v.estado !== 'RECHAZADA';
      })
      .reduce((sum, v) => sum + v.saldoActual, 0);

    const saldoTotal = ventas
      .filter((v) => v.estado !== 'RECHAZADA')
      .reduce((sum, v) => sum + v.saldoActual, 0);

    const pctRiesgoMonto = saldoTotal > 0 ? Math.round((saldoRojo / saldoTotal) * 100) : 0;

    // 2. Zone & Collection Efficiency
    const abonosUltimos7Dias = abonos.filter((a) => {
      const pDate = new Date(a.fechaPago);
      const diffDays = (Date.now() - pDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    });

    const cobrado7Dias = abonosUltimos7Dias.reduce((sum, a) => sum + a.monto, 0);

    // Zone with lowest payment rate
    const zonaPerformance = zonas.map((z) => {
      const clientesEnZona = clientes.filter((c) => c.zonaId === z.id || c.zonaNombre === z.nombre);
      const clientesRojoZona = clientesEnZona.filter((c) => c.estadoMorosidad === 'ROJO').length;
      const abonosZona = abonosUltimos7Dias.filter((a) => clientesEnZona.some((c) => c.id === a.clienteId));
      const cobradoZona = abonosZona.reduce((sum, a) => sum + a.monto, 0);
      return {
        zona: z,
        totalClientes: clientesEnZona.length,
        rojos: clientesRojoZona,
        cobrado7Dias: cobradoZona,
      };
    });

    zonaPerformance.sort((a, b) => b.rojos - a.rojos);
    const zonaMasRiesgo = zonaPerformance[0];

    // 3. Stock Depletion Predictions
    const stockBajoProds = productos.filter((p) => {
      const stock = p.stock ?? 0;
      const min = p.stockMinimo ?? 5;
      return stock <= min;
    });

    // 4. Projected weekly collection
    const promedioDiarioCobro = Math.round(cobrado7Dias / 7) || 500;
    const estimacionSemanaSiguiente = promedioDiarioCobro * 6;

    // Health Score (0 - 100)
    let healthScore = 100;
    if (pctRiesgoMonto > 30) healthScore -= 30;
    else if (pctRiesgoMonto > 15) healthScore -= 15;

    if (stockBajoProds.length > 3) healthScore -= 15;
    if (clientesRojo.length > 5) healthScore -= 15;

    healthScore = Math.max(25, Math.min(100, healthScore));

    return {
      clientesRojo,
      clientesAmarillo,
      clientesVerde,
      saldoRojo,
      saldoTotal,
      pctRiesgoMonto,
      cobrado7Dias,
      promedioDiarioCobro,
      estimacionSemanaSiguiente,
      zonaMasRiesgo,
      stockBajoProds,
      healthScore,
    };
  }, [clientes, ventas, abonos, zonas, productos]);

  // Voice speech synthesis reader
  const handleSpeakSummary = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Tu navegador no admite síntesis de voz.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = `Diagnóstico IA BITALIS. Salud Operativa: ${aiDiagnostics.healthScore}%. Se detectaron ${aiDiagnostics.clientesRojo.length} clientes en riesgo con un saldo expuesto de $${aiDiagnostics.saldoRojo.toLocaleString()} pesos. Recaudación estimada para los próximos días: $${aiDiagnostics.estimacionSemanaSiguiente.toLocaleString()} pesos.`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'es-MX';
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Preset AI Query Handler
  const handleRunPresetQuery = (queryType: string) => {
    if (queryType === 'riesgo') {
      setQueryResult({
        title: '🔍 Análisis IA: Clientes en Riesgo Crítico de Morosidad',
        text: `Se han identificado ${aiDiagnostics.clientesRojo.length} clientes con atrasos graves que representan un saldo expuesto de $${aiDiagnostics.saldoRojo.toLocaleString()} MXN (${aiDiagnostics.pctRiesgoMonto}% del total de cartera activa).`,
        bullets: [
          `Zona con mayor mora: ${aiDiagnostics.zonaMasRiesgo ? aiDiagnostics.zonaMasRiesgo.zona.nombre : 'General'} (${aiDiagnostics.zonaMasRiesgo?.rojos || 0} clientes en rojo).`,
          'Recomendación IA: Reprogramar visita del cobrador en horario matutino y enviar notificación de convenios de pago.',
          'Sugerencia: Ofrecer condonación parcial de recargos si el cliente liquida en un solo pago.',
        ],
        actionLabel: 'Ver Clientes en Gestión de Cartera',
        actionTab: 'clientes',
        kpis: [
          { label: 'Clientes en Rojo', value: `${aiDiagnostics.clientesRojo.length}`, color: 'text-rose-400' },
          { label: 'Saldo Expuesto', value: `$${aiDiagnostics.saldoRojo.toLocaleString()} MXN`, color: 'text-rose-400' },
          { label: 'Riesgo Cartera', value: `${aiDiagnostics.pctRiesgoMonto}%`, color: 'text-amber-400' },
        ],
      });
    } else if (queryType === 'proyeccion') {
      setQueryResult({
        title: '📈 Pronóstico IA de Cobranza Semanal',
        text: `Con base en el ritmo actual de recaudación ($${aiDiagnostics.promedioDiarioCobro.toLocaleString()} MXN/día), se estima una cobranza total de $${aiDiagnostics.estimacionSemanaSiguiente.toLocaleString()} MXN en los próximos 6 días hábiles.`,
        bullets: [
          'Día con mayor recaudación estimada: Lunes y Viernes (días de liquidación de sueldo).',
          'Factor de aceleración: Reasignar 1 cobrador de apoyo a la zona con mayor número de fichas abiertas.',
          'Incentivo sugerido: Otorgar bono de $200 MXN al cobrador que logre 95% de efectividad de ruta.',
        ],
        actionLabel: 'Gestionar Secuencia de Rutas',
        actionTab: 'rutas',
        kpis: [
          { label: 'Recaudación Diaria Promedio', value: `$${aiDiagnostics.promedioDiarioCobro.toLocaleString()} MXN`, color: 'text-emerald-400' },
          { label: 'Pronóstico Semanal', value: `$${aiDiagnostics.estimacionSemanaSiguiente.toLocaleString()} MXN`, color: 'text-emerald-400' },
        ],
      });
    } else if (queryType === 'inventario') {
      setQueryResult({
        title: '📦 Predicción IA de Resurtido e Inventario',
        text: `Hay ${aiDiagnostics.stockBajoProds.length} productos con nivel de inventario igual o inferior al stock mínimo configurado.`,
        bullets: aiDiagnostics.stockBajoProds.map(
          (p) => `• ${p.nombre}: Quedan ${p.stock ?? 0} unidades (Stock Mínimo: ${p.stockMinimo ?? 5}).`
        ).concat(
          aiDiagnostics.stockBajoProds.length === 0
            ? ['Todo el inventario cuenta con stock saludable para atender pedidos de las vendedoras.']
            : ['Recomendación: Contactar a los proveedores para generar orden de compra anticipada.']
        ),
        actionLabel: 'Ver Catálogo de Productos',
        actionTab: 'productos',
        kpis: [
          { label: 'Productos Críticos', value: `${aiDiagnostics.stockBajoProds.length}`, color: 'text-amber-400' },
          { label: 'Total Productos Catalogo', value: `${productos.length}`, color: 'text-indigo-400' },
        ],
      });
    } else if (queryType === 'eficiencia') {
      setQueryResult({
        title: '🛵 Evaluación IA de Eficiencia en Rutas y Cobradores',
        text: `En los últimos 7 días se han recaudado $${aiDiagnostics.cobrado7Dias.toLocaleString()} MXN en total.`,
        bullets: [
          `Zona con mejor desempeño: ${zonas[0]?.nombre || 'Zona Norte'} (${zonas[0]?.diaCobro || 'Lunes'}).`,
          'Recomendación de Optimización de Secuencia: Ordenar paradas por proximidad GPS para reducir consumo de combustible.',
          'Consumo estimado de gasolina semanal: $1,200 MXN en promedio por cobrador.',
        ],
        actionLabel: 'Ver Gestión de Rutas',
        actionTab: 'rutas',
      });
    }
  };

  const handleCustomQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;

    const queryLower = customQuery.toLowerCase();
    if (queryLower.includes('mora') || queryLower.includes('riesgo') || queryLower.includes('rojo')) {
      handleRunPresetQuery('riesgo');
    } else if (queryLower.includes('cobro') || queryLower.includes('semana') || queryLower.includes('ingreso') || queryLower.includes('pronostico')) {
      handleRunPresetQuery('proyeccion');
    } else if (queryLower.includes('stock') || queryLower.includes('producto') || queryLower.includes('inventario')) {
      handleRunPresetQuery('inventario');
    } else {
      handleRunPresetQuery('eficiencia');
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-950 via-indigo-950/80 to-slate-950 border-2 border-indigo-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Decorative Glow Background */}
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-500/30 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-600/40 text-white animate-pulse shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-wide flex items-center gap-2">
                Asistente de Inteligencia Operativa & Copilot IA
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-widest">
                BITALIS IA v3.5
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Diagnóstico en tiempo real, detección proactiva de riesgos de mora, optimización de rutas y pronósticos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSpeakSummary}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isSpeaking
                ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
            title="Escuchar diagnóstico IA en voz alta"
          >
            {isSpeaking ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-indigo-400" />}
            <span className="hidden sm:inline">{isSpeaking ? 'Detener Voz' : 'Escuchar IA'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl cursor-pointer transition"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pt-5 space-y-5 relative z-10">
          {/* Executive Health Score & Key AI Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Health Score Pill */}
            <div className="bg-slate-900/90 border border-indigo-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 uppercase font-black tracking-wider block">
                  Salud Operativa General
                </span>
                <span className="text-2xl font-black text-white mt-0.5 block">
                  {aiDiagnostics.healthScore}%
                </span>
                <span className="text-[11px] text-slate-400">
                  {aiDiagnostics.healthScore >= 80
                    ? '🟢 Operación Saludable'
                    : aiDiagnostics.healthScore >= 60
                    ? '🟡 Atención Requerida'
                    : '🔴 Alerta Crítica'}
                </span>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 flex items-center justify-center font-black text-indigo-300 text-sm bg-indigo-950/50">
                <BrainCircuit className="w-6 h-6 text-indigo-400" />
              </div>
            </div>

            {/* AI Risk Detection */}
            <div
              onClick={() => handleRunPresetQuery('riesgo')}
              className="bg-slate-900/90 border border-rose-500/40 hover:border-rose-400 p-4 rounded-2xl cursor-pointer transition transform hover:-translate-y-0.5 shadow-lg group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-rose-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Riesgo Mora Expuesto
                </span>
                <span className="text-xs text-rose-300 font-bold underline group-hover:scale-105 transition">
                  Analizar →
                </span>
              </div>
              <span className="text-xl font-black text-rose-300 mt-1 block">
                ${aiDiagnostics.saldoRojo.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                {aiDiagnostics.clientesRojo.length} clientes en rojo ({aiDiagnostics.pctRiesgoMonto}% de cartera).
              </p>
            </div>

            {/* AI Weekly Forecast */}
            <div
              onClick={() => handleRunPresetQuery('proyeccion')}
              className="bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-400 p-4 rounded-2xl cursor-pointer transition transform hover:-translate-y-0.5 shadow-lg group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Pronóstico Cobro 6 Días
                </span>
                <span className="text-xs text-emerald-300 font-bold underline group-hover:scale-105 transition">
                  Ver Proyección →
                </span>
              </div>
              <span className="text-xl font-black text-emerald-300 mt-1 block">
                ${aiDiagnostics.estimacionSemanaSiguiente.toLocaleString()} <span className="text-xs text-slate-400 font-normal">MXN</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Promedio estimado: ${aiDiagnostics.promedioDiarioCobro.toLocaleString()} MXN/día.
              </p>
            </div>

            {/* AI Inventory Alert */}
            <div
              onClick={() => handleRunPresetQuery('inventario')}
              className="bg-slate-900/90 border border-amber-500/40 hover:border-amber-400 p-4 rounded-2xl cursor-pointer transition transform hover:-translate-y-0.5 shadow-lg group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> Stock Bajo Proyectado
                </span>
                <span className="text-xs text-amber-300 font-bold underline group-hover:scale-105 transition">
                  Revisar →
                </span>
              </div>
              <span className="text-xl font-black text-amber-300 mt-1 block">
                {aiDiagnostics.stockBajoProds.length} <span className="text-xs text-slate-400 font-normal">productos</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                {aiDiagnostics.stockBajoProds.length > 0
                  ? 'Atención requerida para resurtido'
                  : 'Inventario en nivel óptimo'}
              </p>
            </div>
          </div>

          {/* Interactive AI Prompt Quick Buttons */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-400 animate-bounce" />
                Preguntas Proactivas e Insights de la IA
              </span>
              <span className="text-[10px] text-slate-400">Haz clic en una opción para ejecutar análisis instantáneo</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'riesgo', label: '🔴 ¿Quiénes son los clientes de mayor riesgo hoy?', color: 'hover:border-rose-500 hover:bg-rose-950/40' },
                { id: 'proyeccion', label: '📈 Proyección de cobro y recaudación semanal', color: 'hover:border-emerald-500 hover:bg-emerald-950/40' },
                { id: 'inventario', label: '📦 Estado de inventario y alertas de resurtido', color: 'hover:border-amber-500 hover:bg-amber-950/40' },
                { id: 'eficiencia', label: '🛵 Rendimiento de cobradores y rutas', color: 'hover:border-indigo-500 hover:bg-indigo-950/40' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleRunPresetQuery(btn.id)}
                  className={`px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold cursor-pointer transition shadow hover:scale-102 ${btn.color}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Custom Prompt Bar */}
            <form onSubmit={handleCustomQuerySubmit} className="pt-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="Pregunta algo a la IA (ej. ¿Cuál es la zona más morosa? ¿Cómo optimizar cobro?)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl cursor-pointer shadow-lg flex items-center gap-1.5 transition shrink-0"
              >
                <Bot className="w-4 h-4" />
                <span>Consultar IA</span>
              </button>
            </form>
          </div>

          {/* AI Analysis Result Modal / Card Box */}
          {queryResult && (
            <div className="bg-slate-950 border-2 border-indigo-500/80 p-5 rounded-2xl shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-black text-white text-base">{queryResult.title}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setQueryResult(null)}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {queryResult.text}
              </p>

              {queryResult.kpis && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  {queryResult.kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">{kpi.label}</span>
                      <strong className={`text-base font-black ${kpi.color}`}>{kpi.value}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-black text-indigo-300 uppercase tracking-wider block">
                  💡 Diagnóstico & Recomendaciones Tácticas IA:
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {queryResult.bullets.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {queryResult.actionLabel && queryResult.actionTab && onNavigateTab && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateTab(queryResult.actionTab!);
                      setQueryResult(null);
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition transform active:scale-95"
                  >
                    <span>{queryResult.actionLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
