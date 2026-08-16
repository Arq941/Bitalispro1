'use client';

import React from 'react';
import { Camera, DollarSign, Lock, MapPin, ShoppingBag } from 'lucide-react';
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
  const canSell = currentRol === 'vendedora' || currentRol === 'sup_vendedores' || currentRol === 'admin';
  const canCollect = currentRol === 'cobrador' || currentRol === 'admin';
  const quickIsCollection = activeTab === 'cobrador' || (!canSell && canCollect);

  const changeTab = (tab: 'vendedora' | 'cobrador') => {
    triggerHaptic(15);
    onChangeTab(tab);
  };

  const handleFabClick = () => {
    triggerHaptic([30, 50, 30]);
    if (onQuickAction) {
      onQuickAction();
      return;
    }
    onChangeTab(quickIsCollection ? 'cobrador' : 'vendedora');
  };

  const tabClass = (active: boolean) =>
    `min-h-12 min-w-16 flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-black transition active:scale-95 ${
      active
        ? 'border border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
        : 'border border-transparent text-slate-400 active:bg-slate-800 active:text-white'
    }`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-slate-950/95 px-3 pt-2 shadow-2xl backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      aria-label="Navegación principal móvil"
    >
      <div className="mx-auto flex max-w-lg items-end justify-around gap-2">
        {canSell && (
          <button
            type="button"
            onClick={() => changeTab('vendedora')}
            className={tabClass(activeTab === 'vendedora')}
            aria-current={activeTab === 'vendedora' ? 'page' : undefined}
            aria-label="Ir a Ventas"
          >
            <ShoppingBag className="h-5 w-5" />
            <span>Ventas</span>
          </button>
        )}

        {canCollect && (
          <button
            type="button"
            onClick={() => changeTab('cobrador')}
            className={tabClass(activeTab === 'cobrador')}
            aria-current={activeTab === 'cobrador' ? 'page' : undefined}
            aria-label="Ir a Cobranza"
          >
            <MapPin className="h-5 w-5" />
            <span>Cobranza</span>
          </button>
        )}

        <div className="-mt-7 flex min-w-16 justify-center">
          <button
            type="button"
            onClick={handleFabClick}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-950 bg-[#11A65A] text-white shadow-xl shadow-black/30 transition active:scale-90 active:bg-[#0D8B4C]"
            aria-label={quickIsCollection ? 'Acción rápida de cobranza' : 'Acción rápida de venta'}
            title={quickIsCollection ? 'Acción rápida de cobranza' : 'Acción rápida de venta'}
          >
            {quickIsCollection ? <DollarSign className="h-7 w-7" /> : <Camera className="h-7 w-7" />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic([20, 30]);
            onLockSession();
          }}
          className="min-h-12 min-w-16 flex flex-col items-center justify-center gap-1 rounded-2xl border border-transparent px-3 py-2 text-[10px] font-black text-slate-400 transition active:scale-95 active:bg-amber-500/10 active:text-amber-300"
          aria-label="Bloquear sesión con PIN"
          title="Bloquear sesión con PIN"
        >
          <Lock className="h-5 w-5 text-amber-400" />
          <span>Bloquear</span>
        </button>
      </div>
    </nav>
  );
}
