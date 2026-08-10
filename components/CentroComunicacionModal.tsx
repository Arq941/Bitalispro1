'use client';

import React, { useState } from 'react';
import { Cliente, Venta } from '@/types';
import {
  MessageSquare,
  Send,
  Phone,
  Copy,
  Check,
  X,
  Zap,
  Calendar,
  Truck,
  AlertTriangle,
  Award,
  MapPin,
  Clock,
  Sparkles
} from 'lucide-react';

interface Props {
  cliente: Cliente;
  venta?: Venta;
  usuarioNombre?: string;
  onClose: () => void;
  onLogInteraction?: (detalles: string) => void;
}

export default function CentroComunicacionModal({
  cliente,
  venta,
  usuarioNombre = 'Cobrador / Supervisor',
  onClose,
  onLogInteraction
}: Props) {
  const saldoActual = venta ? venta.saldoActual : 0;
  const pagoSemanal = venta ? venta.pagoSemanal : 150;
  const folio = cliente.folio || 'S/N';
  const colonia = cliente.colonia || 'su domicilio';
  const telefonoLimpio = cliente.telefono ? cliente.telefono.replace(/\D/g, '') : '';

  // Plantillas Predefinidas de Comunicación de Cobranza
  const plantillas = [
    {
      id: 'recordatorio',
      titulo: '📅 Recordatorio de Pago Semanal',
      categoria: 'Cobranza Preventiva',
      icon: Calendar,
      color: 'indigo',
      texto: `Hola ${cliente.nombreCompleto}, le recordamos amablemente que su pago semanal de $${pagoSemanal} MXN de su cuenta BITALIS (Folio: ${folio}) vence pronto. Su saldo restante es de $${saldoActual} MXN. ¡Agradecemos su puntualidad!`
    },
    {
      id: 'ruta_proxima',
      titulo: '🚚 Aviso de Ruta y Cobrador Próximo',
      categoria: 'Visita en Campo',
      icon: Truck,
      color: 'emerald',
      texto: `Hola ${cliente.nombreCompleto}, nuestro cobrador de BITALIS visitará la colonia ${colonia} el día de hoy. Por favor tenga listo su abono de $${pagoSemanal} MXN. Si requiere un horario especial responda a este mensaje.`
    },
    {
      id: 'atraso_morosidad',
      titulo: '⚠️ Aviso de Cuenta Atrasada',
      categoria: 'Cobranza Correctiva',
      icon: AlertTriangle,
      color: 'amber',
      texto: `Estimado/a ${cliente.nombreCompleto}, le informamos que su cuenta BITALIS (Folio: ${folio}) presenta un saldo pendiente de $${saldoActual} MXN con días de atraso. Le pedimos comunicarse hoy mismo para acordar su abono y evitar cargos adicionales.`
    },
    {
      id: 'liquidado',
      titulo: '🎉 Felicitaciones por Liquidación',
      categoria: 'Fidelización',
      icon: Award,
      color: 'purple',
      texto: `¡Felicidades ${cliente.nombreCompleto}! Su contrato BITALIS (Folio: ${folio}) se encuentra totalmente LIQUIDADO ($0 MXN). Agradecemos su excelente historial crediticio y le otorgamos un 15% de descuento en su próxima compra.`
    },
    {
      id: 'solicitud_gps',
      titulo: '📍 Confirmación de Ubicación GPS',
      categoria: 'Logística',
      icon: MapPin,
      color: 'sky',
      texto: `Hola ${cliente.nombreCompleto}, para brindarle una atención más ágil en sus entregas o cobranza BITALIS, ¿podría compartirnos su ubicación actual por WhatsApp desde este chat? Muchas gracias.`
    }
  ];

  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(plantillas[0].id);
  const [mensajeEditable, setMensajeEditable] = useState(plantillas[0].texto);
  const [copied, setCopied] = useState(false);
  const [horarioVisita, setHorarioVisita] = useState('10:00 AM - 2:00 PM');

  const seleccionarPlantilla = (p: typeof plantillas[0]) => {
    setPlantillaSeleccionada(p.id);
    let txt = p.texto;
    if (p.id === 'ruta_proxima' && horarioVisita) {
      txt += ` Horario estimado de visita: ${horarioVisita}.`;
    }
    setMensajeEditable(txt);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(mensajeEditable);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const registrarYAbrirCanal = (tipo: 'WHATSAPP' | 'SMS' | 'LLAMADA') => {
    const textoEncoded = encodeURIComponent(mensajeEditable);

    if (onLogInteraction) {
      onLogInteraction(`Envío de mensaje [${tipo}] a cliente ${cliente.nombreCompleto} (${folio}). Mensaje: "${mensajeEditable.substring(0, 60)}..."`);
    }

    if (tipo === 'WHATSAPP') {
      window.open(`https://wa.me/52${telefonoLimpio}?text=${textoEncoded}`, '_blank');
    } else if (tipo === 'SMS') {
      window.open(`sms:${telefonoLimpio}?body=${textoEncoded}`, '_self');
    } else if (tipo === 'LLAMADA') {
      window.open(`tel:${telefonoLimpio}`, '_self');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Centro de Comunicación de Cobranza
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-slate-400">
                Cliente: <strong className="text-indigo-300">{cliente.nombreCompleto}</strong> • Folio: <span className="font-mono text-emerald-400">{folio}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* Quick Client Summary Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Teléfono Registrado:</span>
              <strong className="text-white text-sm font-mono">{cliente.telefono || 'Sin teléfono'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Saldo Pendiente:</span>
              <strong className={`text-sm font-black ${saldoActual > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                ${saldoActual} MXN
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Abono Semanal:</span>
              <strong className="text-indigo-300 text-sm font-bold">${pagoSemanal} MXN</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Ubicación:</span>
              <span className="text-slate-200 font-medium truncate max-w-[180px] block">
                {cliente.direccion} ({colonia})
              </span>
            </div>
          </div>

          {/* Selector de Plantillas */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Seleccionar Mensaje Predefinido de Gestión:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plantillas.map((p) => {
                const IconComp = p.icon;
                const isSelected = plantillaSeleccionada === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => seleccionarPlantilla(p)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-indigo-950/90 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                        : 'bg-slate-950/50 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-slate-900 shrink-0 text-indigo-400`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold tracking-wider text-indigo-400 uppercase block">
                        {p.categoria}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{p.titulo}</h4>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horario Adicional si la plantilla es de Ruta Próxima */}
          {plantillaSeleccionada === 'ruta_proxima' && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Especificar Rango Horario de Visita:
                </label>
                <div className="flex gap-2">
                  {['10:00 AM - 1:00 PM', '2:00 PM - 5:00 PM', '5:00 PM - 8:00 PM'].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setHorarioVisita(h);
                        const baseText = plantillas.find((p) => p.id === 'ruta_proxima')?.texto || '';
                        setMensajeEditable(`${baseText} Horario estimado de visita: ${h}.`);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                        horarioVisita === h
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Editor de Texto del Mensaje */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                Vista Previa y Edición Final del Mensaje:
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={mensajeEditable}
              onChange={(e) => setMensajeEditable(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-100 focus:border-indigo-500 focus:outline-none font-sans leading-relaxed"
            />
          </div>
        </div>

        {/* Footer Actions / Canales de Envío */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Envío directo al dispositivo del cliente
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => registrarYAbrirCanal('LLAMADA')}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-slate-700 shadow"
            >
              <Phone className="w-4 h-4 text-indigo-400" />
              <span>Llamar</span>
            </button>

            <button
              type="button"
              onClick={() => registrarYAbrirCanal('SMS')}
              className="px-3.5 py-2.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-indigo-800/80 shadow"
            >
              <Send className="w-4 h-4 text-indigo-400" />
              <span>SMS Directo</span>
            </button>

            <button
              type="button"
              onClick={() => registrarYAbrirCanal('WHATSAPP')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950"
            >
              <MessageSquare className="w-4 h-4 text-white" />
              <span>Enviar por WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
