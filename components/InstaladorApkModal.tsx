'use client';

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  Share2,
  Compass,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  Info,
  Sparkles,
  Layers,
  Copy,
  Check
} from 'lucide-react';

interface Props {
  onClose: () => void;
  deferredPrompt?: any;
  onInstallSuccess?: () => void;
}

export default function InstaladorApkModal({
  onClose,
  deferredPrompt,
  onInstallSuccess
}: Props) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'instalar_pwa' | 'descargar_apk' | 'ios'>('instalar_pwa');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  const currentAppUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA/APK Install] Resultado de instalación: ${outcome}`);
      setIsInstalling(false);
      if (outcome === 'accepted') {
        setInstalled(true);
        if (onInstallSuccess) onInstallSuccess();
      }
    } else {
      alert('Abre el menú de opciones de tu navegador (⋮) y selecciona "Instalar aplicación" o "Agregar a pantalla principal" para crear la app nativa en tu teléfono.');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Instalador Móvil Android / PWA
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </h2>
              <p className="text-xs text-slate-400">
                Instala <strong className="text-emerald-300">BITALIS</strong> en tu teléfono inteligente sin tienda de aplicaciones
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('instalar_pwa')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'instalar_pwa'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Instalación Directa Android</span>
          </button>

          <button
            onClick={() => setActiveTab('descargar_apk')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'descargar_apk'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Generar Archivo .APK</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>iPhone / iOS</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'instalar_pwa' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-emerald-950/80 to-slate-900 p-4 rounded-xl border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    WebAPK para Teléfonos Android
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Al instalar la aplicación WebAPK, Android crea un paquete ejecutable independiente en tu teléfono con soporte para sincronización offline y notificaciones.
                  </p>
                </div>

                <button
                  onClick={handleInstallClick}
                  disabled={isInstalling || installed}
                  className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition shrink-0 cursor-pointer"
                >
                  {installed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-slate-950" />
                      <span>¡App Instalada!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-slate-950" />
                      <span>{deferredPrompt ? 'Instalar App Ahora' : 'Instalar en Pantalla Inicio'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Visual Step-by-Step Guide */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pasos para instalar manualmente en cualquier teléfono Android:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-indigo-900/60 text-indigo-400 font-black flex items-center justify-center mb-2">
                      1
                    </div>
                    <h5 className="text-xs font-bold text-white mb-1">Abre el Menú</h5>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Toca los 3 puntos <strong className="text-white">(⋮)</strong> en la esquina superior derecha de Chrome o tu navegador.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-900/60 text-emerald-400 font-black flex items-center justify-center mb-2">
                      2
                    </div>
                    <h5 className="text-xs font-bold text-white mb-1">Selecciona Instalar</h5>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Presiona <strong className="text-emerald-300">&quot;Instalar aplicación&quot;</strong> o &quot;Agregar a pantalla principal&quot;.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-amber-900/60 text-amber-400 font-black flex items-center justify-center mb-2">
                      3
                    </div>
                    <h5 className="text-xs font-bold text-white mb-1">Listo para Campo</h5>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      El icono de <strong className="text-white">BITALIS</strong> aparecerá entre las aplicaciones de tu móvil.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'descargar_apk' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Convertir a Paquete de Instalación .APK
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  Si deseas empaquetar este sistema en un archivo ejecutable <strong className="text-emerald-300">.APK binario</strong> para compartirlo por WhatsApp o instalarlo en teléfonos sin conexión a internet inicial:
                </p>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                  <span className="text-[11px] text-slate-400 block font-bold">1. Copia la URL de tu aplicación publicada:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={currentAppUrl}
                      className="bg-slate-950 border border-slate-700 text-xs text-indigo-300 p-2 rounded-lg font-mono flex-1 truncate"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 transition cursor-pointer shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copiada' : 'Copiar'}</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400 block font-bold mt-2">2. Genera el APK en 1 clic desde PWABuilder (Herramienta Oficial Microsoft):</span>
                  <a
                    href={`https://www.pwabuilder.com/?url=${encodeURIComponent(currentAppUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg transition shadow cursor-pointer mt-1"
                  >
                    <span>Abrir Generador PWABuilder (.APK)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-300 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-400" /> ¿Por qué se recomienda la PWA / WebAPK directa?
                </p>
                <p className="text-[11px] leading-relaxed">
                  Las PWAs WebAPK instaladas desde el navegador se actualizan de forma automática en los teléfonos de los cobradores sin requerir reinstalar archivos `.apk` manualmente cada vez que agregas una mejora.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2 mb-2">
                  <Compass className="w-4 h-4 text-sky-400" />
                  Instalación en iPhone / iPad (iOS)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  Apple requiere utilizar el navegador <strong className="text-white">Safari</strong> para agregar la aplicación a la pantalla de inicio:
                </p>

                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 pl-1">
                  <li>Abre la aplicación en el navegador <strong>Safari</strong> de tu iPhone.</li>
                  <li>Toca el botón de <strong>Compartir</strong> <Share2 className="w-3.5 h-3.5 inline text-sky-400 mx-0.5" /> en el menú inferior.</li>
                  <li>Desplázate hacia abajo y selecciona <strong>&quot;Agregar a inicio&quot;</strong>.</li>
                  <li>Toca <strong>&quot;Agregar&quot;</strong> en la esquina superior derecha.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Compatible con Android, Samsung, Xiaomi, Motorola, iOS
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
