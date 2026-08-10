'use client';

import React from 'react';
import { ShoppingBag, Users, MapPin, Lock, Plus, ShieldCheck, Camera, DollarSign } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

interface MobileBottomNavBarProps {
  activeTab: string;
  userRole?: string;
  userRol?: string;
  onChangeTab: (tab: any) => void;
  onLockSession: () => void;
  onQuickAction?: () => void;
}

export default function MobileBottomNavBar({
  activeTab,
  userRole,
  userRol,
  onChangeTab,
  onLockSession,
  onQuickAction,
}: MobileBottomNavBarProps) {
  const currentRol = userRol || userRole || 'vendedora';

  const handleFabClick = () => {
    triggerHaptic([30, 50, 30]);
    if (onQuickAction) {
      onQuickAction();
    } else {
      if (currentRol === 'cobrador') {
        onChangeTab('cobrador');
      } else {
        onChangeTab('vendedora');
      }
    }
  };
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-3 pt-1 pb-2 flex flex-col shadow-2xl">
      {/* Top Touch Gesture Indicator Handle */}
      <div className="w-10 h-1 rounded-full bg-slate-700/80 mx-auto mb-1 animate-pulse" title="Desliza horizontalmente la pantalla para cambiar de pestaña" />
      
      <div className="flex items-center justify-between">
      {/* Tab 1: Vendedora / Venta */}
      {(currentRol === 'vendedora' || currentRol === 'sup_vendedores' || currentRol === 'admin') && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(15);
            onChangeTab('vendedora');
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1 px-2.5 rounded-xl transition ${
            activeTab === 'vendedora'
              ? 'text-indigo-400 bg-indigo-950/80 border border-indigo-800/80'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Ventas</span>
        </button>
      )}

      {/* Tab 2: Cobrador / Ruta */}
      {(currentRol === 'cobrador' || currentRol === 'admin') && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(15);
            onChangeTab('cobrador');
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold py-1 px-2.5 rounded-xl transition ${
            activeTab === 'cobrador'
              ? 'text-indigo-400 bg-indigo-950/80 border border-indigo-800/80'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span>Cobranza</span>
        </button>
      )}

      {/* CENTER FLOATING ACTION BUTTON (FAB) FOR FAST THUMB REACH */}
      <div className="-mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleFabClick}
          className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-purple-600 active:from-indigo-500 active:to-purple-500 text-white rounded-full shadow-2xl shadow-indigo-600/50 flex items-center justify-center border-2 border-slate-900 transform active:scale-90 transition cursor-pointer"
          title="Acceso Rápido de Pulgar"
        >
          {currentRol === 'vendedora' ? (
            <Camera className="w-7 h-7 text-white" />
          ) : (
            <DollarSign className="w-7 h-7 text-white" />
          )}
        </button>
      </div>

      {/* Tab 3: Bloqueo de Seguridad PIN */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic([20, 30]);
          onLockSession();
        }}
        className="flex flex-col items-center gap-1 text-[10px] font-bold py-1 px-2.5 rounded-xl text-slate-400 hover:text-amber-400 transition"
        title="Bloquear pantalla con PIN"
      >
        <Lock className="w-5 h-5 text-amber-400" />
        <span>Bloquear</span>
      </button>
      </div>
    </div>
  );
}
