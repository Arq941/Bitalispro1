'use client';

import { Cliente, Venta, Abono } from '@/types';
import { Printer, X, Download, AlertCircle } from 'lucide-react';

interface CardPrintViewProps {
  clientes: Cliente[];
  ventas: Venta[];
  abonos: Abono[];
  onClose: () => void;
  onMarkAsPrinted?: (clienteIds: number[]) => void;
  titleMode: string; // e.g. "Impresión Masiva (Altas Recientes)" or "Reimpresión Individual por Pérdida"
}

export default function CardPrintView({
  clientes,
  ventas,
  abonos,
  onClose,
  onMarkAsPrinted,
  titleMode,
}: CardPrintViewProps) {
  const handlePrint = () => {
    window.print();
    if (onMarkAsPrinted && clientes.length > 0) {
      onMarkAsPrinted(clientes.map((c) => c.id));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 overflow-y-auto p-4 sm:p-6 flex flex-col items-center">
      {/* Top Bar - Hidden when printing */}
      <div className="no-print bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-5xl mb-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Printer className="w-6 h-6 text-indigo-400" />
            Módulo de Impresión: {titleMode}
          </h2>
          <p className="text-sm text-slate-400">
            Formato exacto optimizado para 1/4 de hoja carta ({clientes.length} tarjeta(s) lista(s))
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg hover:shadow-emerald-900/40 transition flex items-center gap-2 text-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Mandar a Imprimir ({clientes.length})
          </button>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-2 text-sm cursor-pointer border border-slate-700"
          >
            <X className="w-4 h-4" />
            Cerrar
          </button>
        </div>
      </div>

      {clientes.length === 0 ? (
        <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-md my-auto">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">No hay tarjetas pendientes</h3>
          <p className="text-slate-400 text-sm">
            Todos los clientes recientes ya cuentan con su tarjeta impresa.
          </p>
        </div>
      ) : (
        /* Printable Container - 4 cards per page grid */
        <div className="print-grid-container grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl bg-slate-950 md:bg-white p-4 md:p-6 rounded-2xl text-slate-900 shadow-2xl">
          {clientes.map((cliente) => {
            const venta = ventas.find((v) => v.clienteId === cliente.id) || {
              precioBase: 1490,
              engancheMonto: 100,
              saldoInicial: 1290,
              saldoActual: 1290,
              pagoSemanal: 100,
              fechaPrimerPago: '2026-08-03',
              diaCobroZona: 'Lunes',
            };

            const clientAbonos = abonos.filter((a) => a.clienteId === cliente.id);

            // Generate 15 weeks rows
            const totalWeeks = 15;
            const weekRows = Array.from({ length: totalWeeks }, (_, idx) => {
              const semNum = idx + 1;
              const abonoHecho = clientAbonos.find((a) => a.semanaNumero === semNum);
              return {
                semana: semNum,
                fecha: abonoHecho ? abonoHecho.fechaPago : '',
                monto: abonoHecho ? `$${abonoHecho.monto}` : '',
                saldo: abonoHecho
                  ? `$${Math.max(0, venta.saldoInicial - semNum * venta.pagoSemanal)}`
                  : '',
                firmado: abonoHecho ? '✓ OK' : '',
              };
            });

            return (
              <div
                key={cliente.id}
                className="card-quarter-letter border-2 border-dashed border-slate-800 p-3.5 bg-white text-slate-900 font-sans flex flex-col justify-between rounded-lg shadow-sm"
              >
                {/* Header */}
                <div className="border-b-2 border-emerald-800 pb-2 mb-1">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-emerald-900 flex items-center justify-center text-white text-[10px] font-black">
                        🌿
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs tracking-wider uppercase text-emerald-900 font-sans">
                          BITALIS • PRODUCTOS NATURISTAS
                        </h4>
                        <p className="text-[9px] font-bold text-slate-700">
                          TARJETA DE CONTROL DE ABONOS SEMANALES
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-xs bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded text-emerald-950">
                        FOLIO: {cliente.folio}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Client Info Grid */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] bg-slate-50 p-2 rounded border border-slate-200 mb-1">
                  <div className="col-span-2">
                    <span className="font-bold text-slate-700">Cliente: </span>
                    <span className="font-semibold text-slate-900">{cliente.nombreCompleto}</span>
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="font-bold text-slate-700">Domicilio: </span>
                    <span className="text-slate-800">{cliente.direccion}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Zona / Día: </span>
                    <span className="font-semibold text-indigo-800">{cliente.zonaNombre || 'Zapata'} ({venta.diaCobroZona || 'Lunes'})</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Tel: </span>
                    <span>{cliente.telefono}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Enganche: </span>
                    <span>${venta.engancheMonto}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Abono Semanal: </span>
                    <span className="font-bold text-emerald-800">${venta.pagoSemanal}</span>
                  </div>
                </div>

                {/* Weekly Payment Table */}
                <div className="flex-1 my-1 overflow-hidden">
                  <table className="w-full text-[9px] border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-slate-200 text-slate-900 font-bold">
                        <th className="border border-slate-400 px-1 py-0.5 w-6 text-center">Sem</th>
                        <th className="border border-slate-400 px-1 py-0.5 text-left">Fecha</th>
                        <th className="border border-slate-400 px-1 py-0.5 text-right w-12">Abono</th>
                        <th className="border border-slate-400 px-1 py-0.5 text-right w-12">Saldo</th>
                        <th className="border border-slate-400 px-1 py-0.5 text-center w-12">Firma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekRows.map((row) => (
                        <tr key={row.semana} className="border-b border-slate-300">
                          <td className="border border-slate-300 text-center font-bold px-1 py-0.5 bg-slate-100">
                            {row.semana}
                          </td>
                          <td className="border border-slate-300 px-1 py-0.5 text-slate-700">
                            {row.fecha}
                          </td>
                          <td className="border border-slate-300 px-1 py-0.5 text-right font-medium text-slate-900">
                            {row.monto}
                          </td>
                          <td className="border border-slate-300 px-1 py-0.5 text-right font-bold text-slate-900">
                            {row.saldo}
                          </td>
                          <td className="border border-slate-300 px-1 py-0.5 text-center text-emerald-700 font-bold">
                            {row.firmado}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Bar */}
                <div className="border-t border-slate-300 pt-1 mt-1 flex justify-between items-center text-[9px] text-slate-600">
                  <span>Conservar esta tarjeta para cada abono</span>
                  <span className="font-mono font-semibold text-slate-900">★ SALDO INICIAL: ${venta.saldoInicial}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
