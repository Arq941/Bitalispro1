'use client';

import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  UserCheck,
  Wallet,
  ShieldCheck,
  Compass,
  ArrowRight,
  Power,
  RotateCcw,
  Check,
  Smartphone,
  Eye,
  FileText,
  MapPin,
  BellRing,
  Award
} from 'lucide-react';
import { Usuario } from '@/types';

interface InteractiveRoleTourModalProps {
  isOpen: boolean;
  currentUser: Usuario | null;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface StepInfo {
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  actionHint: string;
  targetTab?: string;
  proTip: string;
  icon: any;
}

interface RoleWorkflow {
  roleId: string;
  roleName: string;
  roleSubtitle: string;
  roleColor: string;
  roleIcon: any;
  summary: string;
  steps: StepInfo[];
}

const ROLE_WORKFLOWS: Record<string, RoleWorkflow> = {
  vendedora: {
    roleId: 'vendedora',
    roleName: 'Vendedora de Campo',
    roleSubtitle: 'Captación de clientes, solicitud de crédito y venta directa',
    roleColor: 'from-pink-600 to-rose-700',
    roleIcon: ShoppingBag,
    summary: 'Proceso acelerado desde la primera visita hasta la autorización de venta semanal.',
    steps: [
      {
        title: '1. Captura del Cliente en Campo',
        badge: 'PASO 1 • REGISTRO',
        badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
        description: 'Ingresa al formulario de "Alta de Cliente". Registra nombre completo, folio asignado, teléfono, colonia y referencias de domicilio.',
        actionHint: 'Haz clic en el botón "+ Nuevo Cliente / Venta" en la pestaña Vendedora.',
        targetTab: 'vendedora',
        proTip: 'Asegúrate de marcar las coordenadas GPS si cuentas con señal móvil.',
        icon: UserCheck
      },
      {
        title: '2. Selección de Productos y Plazo',
        badge: 'PASO 2 • COTIZACIÓN',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        description: 'Selecciona los artículos requeridos por la clienta. El sistema calcula automáticamente el pago semanal y la comisión estimada.',
        actionHint: 'Revisa que la cuota semanal se adapte a la capacidad de pago del cliente.',
        targetTab: 'vendedora',
        proTip: 'Puedes incluir múltiples productos en una misma solicitud de crédito.',
        icon: ShoppingBag
      },
      {
        title: '3. Evidencia Fotográfica y Firma',
        badge: 'PASO 3 • COMPROBANTES',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        description: 'Captura la foto del comprobante de domicilio, INE y firma digital en pantalla touch.',
        actionHint: 'La firma del cliente valida los términos del pagaré semanal.',
        targetTab: 'vendedora',
        proTip: 'Si no hay conexión a internet, los datos se guardan offline y se sincronizarán solos.',
        icon: FileText
      },
      {
        title: '4. Envío a Supervisión y Seguimiento',
        badge: 'PASO 4 • APROBACIÓN',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        description: 'Envía la solicitud a la mesa de validación. Recibirás una notificación Push instantánea en cuanto el Supervisor apruebe o rechace.',
        actionHint: 'Consulta el estado de tus solicitudes en la pestaña "Estado de Solicitudes".',
        targetTab: 'vendedora',
        proTip: 'Las solicitudes aprobadas generan la tarjeta de cobro para la ruta.',
        icon: BellRing
      }
    ]
  },
  sup_vendedores: {
    roleId: 'sup_vendedores',
    roleName: 'Supervisora de Ventas',
    roleSubtitle: 'Mesa de validación de crédito y análisis de riesgo',
    roleColor: 'from-purple-600 to-indigo-700',
    roleIcon: UserCheck,
    summary: 'Revisión rápida de expedientes de crédito para autorizar entregas en campo.',
    steps: [
      {
        title: '1. Bandeja de Solicitudes Pendientes',
        badge: 'PASO 1 • MESA DE TRABAJO',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        description: 'Revisa las solicitudes entrantes enviadas por las vendedoras de campo en tiempo real.',
        actionHint: 'Ve a la pestaña "Supervisión Ventas" para ver las tarjetas pendientes.',
        targetTab: 'sup_vendedores',
        proTip: 'Filtra por colonia o vendedora para acelerar el dictamen.',
        icon: Eye
      },
      {
        title: '2. Evaluación de Expediente y Firma',
        badge: 'PASO 2 • DICTAMEN',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        description: 'Verifica la INE, foto de fachada, firma digital y capacidad de pago del cliente.',
        actionHint: 'Haz clic en "Ver Expediente" en la tarjeta del cliente.',
        targetTab: 'sup_vendedores',
        proTip: 'Un dictamen rápido reduce la cancelación de clientes en campo.',
        icon: ShieldCheck
      },
      {
        title: '3. Aprobación / Rechazo con Motivo',
        badge: 'PASO 3 • RESOLUCIÓN',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        description: 'Aprueba el crédito con 1 clic o indica el motivo en caso de rechazo. El sistema dispara la notificación Push a la vendedora.',
        actionHint: 'Utiliza el botón "Aprobar Crédito" para autorizar la tarjeta de cobro.',
        targetTab: 'sup_vendedores',
        proTip: 'Las ventas aprobadas pasan automáticamente a la cartera del cobrador.',
        icon: CheckCircle2
      }
    ]
  },
  cobrador: {
    roleId: 'cobrador',
    roleName: 'Cobrador de Ruta',
    roleSubtitle: 'Cobranza en campo, registro de abonos y re-agendado',
    roleColor: 'from-amber-600 to-orange-700',
    roleIcon: Wallet,
    summary: 'Optimización de ruta diaria, gestión de mora y emisión de comprobantes digitales.',
    steps: [
      {
        title: '1. Vista de Tarjetas de Cobranza',
        badge: 'PASO 1 • RUTA DEL DÍA',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        description: 'Consulta tus clientes ordenados por colonia o urgencia. Identifica rápidamente atrasos mayores.',
        actionHint: 'Abre la pestaña "Ruta Cobrador" para ver el carrusel de tarjetas.',
        targetTab: 'cobrador',
        proTip: 'Utiliza el botón de ubicación para abrir Google Maps hacia el domicilio.',
        icon: MapPin
      },
      {
        title: '2. Alerta Urgente y Apertura de Expediente',
        badge: 'PASO 2 • ATENCIÓN A MORA',
        badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
        description: 'En el panel superior "Alertas de Cobranza Urgente", haz clic en cualquier tarjeta para abrir el expediente completo del cliente.',
        actionHint: 'Haz clic en la tarjeta de urgencia para revisar historial de pagos.',
        targetTab: 'cobrador',
        proTip: 'Puedes consultar los abonos anteriores y notas del supervisor.',
        icon: BellRing
      },
      {
        title: '3. Registro de Abono y Ticket WhatsApp',
        badge: 'PASO 3 • REGISTRO RÁPIDO',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        description: 'Registra el monto recibido en efectivo. El sistema actualiza el saldo al instante y permite enviar comprobante vía WhatsApp.',
        actionHint: 'Presiona el botón "$ Abono" e ingresa la cantidad recibida.',
        targetTab: 'cobrador',
        proTip: 'También puedes reagendar la visita si el cliente acordó pagar otro día.',
        icon: Wallet
      }
    ]
  },
  sup_cobradores: {
    roleId: 'sup_cobradores',
    roleName: 'Supervisor de Cobranza',
    roleSubtitle: 'Arqueo de caja, auditoría de ruta y métricas de captación',
    roleColor: 'from-emerald-600 to-teal-700',
    roleIcon: ShieldCheck,
    summary: 'Supervisión en tiempo real del efectivo recolectado y balance de caja.',
    steps: [
      {
        title: '1. Monitoreo de Captación de Efectivo',
        badge: 'PASO 1 • MÉTRICAS CLAVE',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        description: 'Revisa la barra de captación diaria respecto al promedio histórico esperado.',
        actionHint: 'Ingresa a "Supervisión Cobranza" para ver los totales acumulados.',
        targetTab: 'sup_cobradores',
        proTip: 'Si la captación cae por debajo del objetivo, el sistema envía una alerta Push.',
        icon: BellRing
      },
      {
        title: '2. Cierre y Arqueo de Corte de Caja',
        badge: 'PASO 2 • CORTE DE CAJA',
        badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
        description: 'Valida los cierres de caja entregados por cada cobrador de ruta. Revisa sobrantes o faltantes.',
        actionHint: 'Haz clic en "Registrar Corte de Caja" para formalizar el depósito.',
        targetTab: 'sup_cobradores',
        proTip: 'Puedes exportar el reporte consolidado a PDF para contabilidad.',
        icon: FileText
      }
    ]
  },
  admin: {
    roleId: 'admin',
    roleName: 'Administrador General',
    roleSubtitle: 'Control total de cartera, usuarios, zonas y configuraciones cloud',
    roleColor: 'from-blue-600 to-cyan-700',
    roleIcon: Compass,
    summary: 'Administración ejecutiva de toda la plataforma BITALIS.',
    steps: [
      {
        title: '1. Dashboard Multirrol y Cartera Completa',
        badge: 'PASO 1 • PANORAMA GENERAL',
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        description: 'Acceso a todas las pestañas de operación, reportes consolidados y métricas globales.',
        actionHint: 'Navega libremente entre las pestañas del menú superior.',
        targetTab: 'cartera',
        proTip: 'Utiliza el buscador global para localizar cualquier folio o cliente.',
        icon: Compass
      },
      {
        title: '2. Configuración de Sincronización y Push',
        badge: 'PASO 2 • HERRAMIENTAS CLOUD',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        description: 'Administra la base de datos Supabase, reglas de Notificaciones Push y copias de seguridad.',
        actionHint: 'Usa el botón "Push Activas" en la barra superior para ajustar alertas.',
        targetTab: 'cartera',
        proTip: 'Todas las notificaciones Push cuentan con alertas auditivas sintetizadas.',
        icon: BellRing
      }
    ]
  }
};

export const InteractiveRoleTourModal: React.FC<InteractiveRoleTourModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onNavigateTab
}) => {
  const initialRole = currentUser?.rol && ROLE_WORKFLOWS[currentUser.rol] ? currentUser.rol : 'vendedora';
  const [selectedRole, setSelectedRole] = useState<string>(initialRole);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPermanentlyDisabled, setIsPermanentlyDisabled] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser?.rol && ROLE_WORKFLOWS[currentUser.rol]) {
      setSelectedRole(currentUser.rol);
    }
  }, [currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const disabled = localStorage.getItem('bitalis_guide_disabled') === 'true';
      setIsPermanentlyDisabled(disabled);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentWorkflow = ROLE_WORKFLOWS[selectedRole] || ROLE_WORKFLOWS.vendedora;
  const totalSteps = currentWorkflow.steps.length;
  const currentStep = currentWorkflow.steps[currentStepIndex] || currentWorkflow.steps[0];
  const StepIcon = currentStep.icon;

  const handleTogglePermanentDisable = () => {
    const newValue = !isPermanentlyDisabled;
    setIsPermanentlyDisabled(newValue);
    if (typeof window !== 'undefined') {
      if (newValue) {
        localStorage.setItem('bitalis_guide_disabled', 'true');
      } else {
        localStorage.removeItem('bitalis_guide_disabled');
      }
    }
  };

  const handleDisableAndClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bitalis_guide_disabled', 'true');
    }
    setIsPermanentlyDisabled(true);
    onClose();
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Si completó, cerrar
      onClose();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleRoleChange = (roleKey: string) => {
    setSelectedRole(roleKey);
    setCurrentStepIndex(0);
  };

  const handleExecuteStepTab = () => {
    if (currentStep.targetTab && onNavigateTab) {
      onNavigateTab(currentStep.targetTab);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-750 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header Modal */}
        <div className={`p-4 sm:p-5 bg-gradient-to-r ${currentWorkflow.roleColor} flex items-center justify-between relative`}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-black/30 text-white border border-white/20">
                  Guía Interactiva BITALIS
                </span>
                <span className="text-xs text-white/80 font-medium">
                  {currentStepIndex + 1} de {totalSteps} Pasos
                </span>
              </div>
              <h3 className="text-xl font-black text-white mt-0.5 flex items-center gap-2">
                Flujo para {currentWorkflow.roleName}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition cursor-pointer"
            title="Cerrar Guía"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="bg-slate-950/90 border-b border-slate-800 p-2 overflow-x-auto flex items-center gap-1.5 scrollbar-thin">
          {Object.entries(ROLE_WORKFLOWS).map(([key, wf]) => {
            const isSelected = key === selectedRole;
            const IconComp = wf.roleIcon;
            return (
              <button
                key={key}
                onClick={() => handleRoleChange(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{wf.roleName}</span>
                {currentUser?.rol === key && (
                  <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded-full font-extrabold border border-amber-500/40">
                    Tu Rol
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-1.5 flex">
          {currentWorkflow.steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-full transition-all duration-300 flex-1 ${
                idx <= currentStepIndex ? 'bg-indigo-500 shadow-sm' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Modal Body - Step Contents */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Step Header Badge & Title */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-sm ${currentStep.badgeColor}`}>
              {currentStep.badge}
            </span>

            {currentStep.targetTab && (
              <button
                onClick={handleExecuteStepTab}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 bg-indigo-950/60 hover:bg-indigo-900/80 px-2.5 py-1 rounded-lg border border-indigo-800/80 transition cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ir a la Pestaña de este Paso</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
            <div className="p-3.5 bg-indigo-950/80 border border-indigo-700/80 rounded-2xl text-indigo-300 shrink-0 shadow-md">
              <StepIcon className="w-8 h-8" />
            </div>

            <div className="space-y-2 flex-1">
              <h4 className="text-lg font-black text-white">{currentStep.title}</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{currentStep.description}</p>
            </div>
          </div>

          {/* Action Hint & ProTip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-amber-950/30 border border-amber-800/50 p-3.5 rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                <Smartphone className="w-4 h-4" />
                <span>Acción Recomendada en Pantalla</span>
              </div>
              <p className="text-xs text-amber-200/90 leading-normal">{currentStep.actionHint}</p>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-800/50 p-3.5 rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                <Award className="w-4 h-4" />
                <span>Consejo Práctico (Pro-Tip)</span>
              </div>
              <p className="text-xs text-emerald-200/90 leading-normal">{currentStep.proTip}</p>
            </div>
          </div>

          {/* Quick Step Selector Pills */}
          <div className="pt-2 border-t border-slate-800/80">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Pasos del flujo ({currentWorkflow.roleName}):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentWorkflow.steps.map((st, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isDone = idx < currentStepIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs font-bold transition cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-950/90 border-indigo-500 text-indigo-200 shadow-md'
                        : isDone
                        ? 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        : 'bg-slate-900/50 border-slate-800/60 text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isDone
                            ? 'bg-emerald-500 text-slate-950'
                            : isCurrent
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                      </span>
                      <span className="truncate">{st.title}</span>
                    </div>
                    {isCurrent && <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer - Single Action Permanent Disable & Step Nav Controls */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Single-Click Permanent Disable Option */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDisableAndClose}
              className="px-3 py-2 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80 hover:border-red-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Desactivar la guía automática para que no vuelva a abrirse al iniciar sesión"
            >
              <Power className="w-3.5 h-3.5 text-red-400" />
              <span>Desactivar Guía Definitivamente (1 Clic)</span>
            </button>

            <label className="hidden md:flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPermanentlyDisabled}
                onChange={handleTogglePermanentDisable}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>No abrir al iniciar</span>
            </label>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                currentStepIndex === 0
                  ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              onClick={handleNextStep}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-600/30"
            >
              <span>{currentStepIndex === totalSteps - 1 ? '¡Entendido, Comenzar!' : 'Siguiente Paso'}</span>
              {currentStepIndex === totalSteps - 1 ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
