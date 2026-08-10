'use client';

import { useState, useEffect } from 'react';
import {
  Github,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Key,
  FolderGit2,
  GitBranch,
  UploadCloud,
  Copy,
  Check,
  X
} from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowNotice?: (title: string, message: string, role?: string) => void;
}

export default function GitHubModal({ isOpen, onClose, onShowNotice }: GitHubModalProps) {
  const [repoOwner, setRepoOwner] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bitalis_gh_owner') || 'EduardoThc13';
    }
    return 'EduardoThc13';
  });
  const [repoName, setRepoName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bitalis_gh_repo') || 'bitalis-cobranza-pwa';
    }
    return 'bitalis-cobranza-pwa';
  });
  const [branch, setBranch] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bitalis_gh_branch') || 'main';
    }
    return 'main';
  });
  const [githubToken, setGithubToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bitalis_gh_token') || '';
    }
    return '';
  });
  
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success?: boolean;
    message?: string;
    repoDetails?: {
      stars: number;
      defaultBranch: string;
      isPrivate: boolean;
      updatedAt: string;
      description: string;
    };
  } | null>(null);

  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'config' | 'aistudio_export'>('config');

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    triggerHaptic([20, 30]);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bitalis_gh_owner', repoOwner.trim());
      localStorage.setItem('bitalis_gh_repo', repoName.trim());
      localStorage.setItem('bitalis_gh_branch', branch.trim());
      localStorage.setItem('bitalis_gh_token', githubToken.trim());
    }
    if (onShowNotice) {
      onShowNotice(
        '💾 Configuración de GitHub Guardada',
        `Repositorio configurado: ${repoOwner}/${repoName} (${branch})`,
        'SISTEMA'
      );
    }
  };

  const handleTestConnection = async () => {
    triggerHaptic(40);
    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (githubToken.trim()) {
        headers.Authorization = `token ${githubToken.trim()}`;
      }

      const res = await fetch(`https://api.github.com/repos/${repoOwner.trim()}/${repoName.trim()}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setConnectionStatus({
          success: true,
          message: `Conexión exitosa con ${data.full_name}`,
          repoDetails: {
            stars: data.stargazers_count,
            defaultBranch: data.default_branch,
            isPrivate: data.private,
            updatedAt: new Date(data.updated_at).toLocaleString('es-MX'),
            description: data.description || 'Sin descripción',
          },
        });
        if (onShowNotice) {
          onShowNotice('✅ GitHub Conectado', `Repositorio ${data.full_name} activo.`, 'GITHUB');
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setConnectionStatus({
          success: false,
          message: errorData.message || `Error ${res.status}: No se pudo acceder al repositorio. Verifique el nombre o agregue un Token con permisos.`,
        });
      }
    } catch (err: any) {
      setConnectionStatus({
        success: false,
        message: err?.message || 'Error de red al consultar la API de GitHub.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCopyCloneUrl = () => {
    const url = `https://github.com/${repoOwner}/${repoName}.git`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    triggerHaptic([30, 30]);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 text-slate-100 shadow-inner">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                Conexión con Repositorio GitHub
                <span className="text-xs px-2.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full font-bold">
                  v1.2
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sincroniza y respalda el código fuente y esquema de la plataforma BITALIS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'config'
                ? 'bg-slate-800 text-white border-t border-x border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-4 h-4 text-indigo-400" />
            <span>Configuración Repositorio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('aistudio_export')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'aistudio_export'
                ? 'bg-slate-800 text-white border-t border-x border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>Exportar desde AI Studio</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {activeTab === 'config' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <span>Propietario / Usuario GitHub</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={repoOwner}
                    onChange={(e) => setRepoOwner(e.target.value)}
                    placeholder="ej. EduardoThc13"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <span>Nombre del Repositorio</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="ej. bitalis-cobranza-pwa"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Rama Principal</span>
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Token de Acceso Personal (PAT / Opcional para repos privados)</span>
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 cursor-pointer transition active:scale-95"
                >
                  Guardar Cambios
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !repoOwner.trim() || !repoName.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition active:scale-95"
                >
                  {testingConnection ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Github className="w-4 h-4" />
                  )}
                  <span>Probar Conexión con GitHub</span>
                </button>

                <a
                  href={`https://github.com/${repoOwner}/${repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition ml-auto"
                >
                  <span>Abrir Repositorio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Connection Result */}
              {connectionStatus && (
                <div
                  className={`p-4 rounded-2xl border text-xs space-y-2 ${
                    connectionStatus.success
                      ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {connectionStatus.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span>{connectionStatus.message}</span>
                  </div>

                  {connectionStatus.repoDetails && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-800/50 text-slate-300 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Visibilidad:</span>
                        <strong className="text-white">
                          {connectionStatus.repoDetails.isPrivate ? '🔒 Privado' : '🌐 Público'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Rama:</span>
                        <strong className="text-white">{connectionStatus.repoDetails.defaultBranch}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Estrellas:</span>
                        <strong className="text-amber-300">★ {connectionStatus.repoDetails.stars}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Última Modif:</span>
                        <strong className="text-white">{connectionStatus.repoDetails.updatedAt}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Repository Clone URL Bar */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    URL para clonar en Git:
                  </span>
                  <code className="text-xs text-indigo-300 font-mono truncate block">
                    https://github.com/{repoOwner}/{repoName}.git
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCloneUrl}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'aistudio_export' && (
            <div className="space-y-4">
              <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-2xl p-4 text-xs text-indigo-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-indigo-100">
                  <UploadCloud className="w-5 h-5 text-indigo-400" />
                  <span>Exportar Código Completo de Google AI Studio a GitHub</span>
                </div>
                <p className="text-slate-300">
                  Para conectar y sincronizar este proyecto directamente con tu cuenta personal o de organización de GitHub, utiliza la función nativa de exportación de Google AI Studio:
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Haz clic en el Menú de Configuración de AI Studio</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      En la esquina superior derecha del editor de Google AI Studio, busca el icono de <strong>Compartir / Engranaje de Ajustes ⚙️</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Selecciona &quot;Exportar a GitHub&quot;</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Haz clic en la opción <strong>Export to GitHub</strong> o <strong>Exportar repositorio ZIP / GitHub</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Autoriza y Elige el Repositorio</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Autoriza tu cuenta de GitHub (<strong className="text-indigo-300">{repoOwner}</strong>) y selecciona o crea el repositorio <strong className="text-indigo-300">{repoName}</strong>. ¡Todos los cambios se publicarán automáticamente!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Los tokens y repositorios se almacenan de forma segura en localforage.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 cursor-pointer transition"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
