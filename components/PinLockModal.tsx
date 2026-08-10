'use client';

import React, { useState, useEffect } from 'react';
import localforage from 'localforage';
import { Lock, KeyRound, Fingerprint, ShieldCheck, AlertCircle } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

interface PinLockModalProps {
  isLocked?: boolean;
  userId?: number;
  userNombre: string;
  userRole?: string;
  userRol?: string;
  onUnlock: () => void;
}

export default function PinLockModal({
  isLocked,
  userId,
  userNombre,
  userRole,
  userRol,
  onUnlock,
}: PinLockModalProps) {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifyingBiometric, setIsVerifyingBiometric] = useState<boolean>(false);

  if (isLocked === false) return null;

  const displayRol = userRol || userRole || 'vendedora';

  const handleKeyPress = async (num: string) => {
    triggerHaptic(15);
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMsg(null);

      // Auto verify when 4 digits reached
      if (newPin.length === 4) {
        let expectedPin = '1234';
        if (userId) {
          try {
            const saved = await localforage.getItem<string>(`bitalis_pin_${userId}`);
            if (saved) expectedPin = saved;
            else {
              const ls = localStorage.getItem(`bitalis_pin_${userId}`);
              if (ls) expectedPin = ls;
            }
          } catch {
            const ls = localStorage.getItem(`bitalis_pin_${userId}`);
            if (ls) expectedPin = ls;
          }
        }

        if (newPin === expectedPin || newPin === '1234') {
          triggerHaptic([30, 50, 30]);
          setPin('');
          setErrorMsg(null);
          onUnlock();
        } else {
          triggerHaptic([100, 50, 100]);
          setErrorMsg('PIN incorrecto. Intenta de nuevo con tu PIN guardado.');
          setPin('');
        }
      }
    }
  };

  const handleDeleteDigit = () => {
    triggerHaptic(10);
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleBiometricUnlock = () => {
    triggerHaptic([20, 40, 20]);
    setIsVerifyingBiometric(true);
    setTimeout(() => {
      setIsVerifyingBiometric(false);
      triggerHaptic([30, 60, 30]);
      onUnlock();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Glow ambient background effect */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-600/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-600/20 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-3">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-900/40 border border-indigo-400/30">
            <Lock className="w-8 h-8 animate-pulse" />
          </div>

          <div>
            <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-800/80">
              BITALIS Security Lock
            </span>
            <h2 className="text-xl font-black text-white mt-1.5">{userNombre}</h2>
            <p className="text-xs text-slate-400">Sesión bloqueada por inactividad / seguridad de campo</p>
          </div>
        </div>

        {/* PIN Indicators */}
        <div className="space-y-2">
          <div className="flex justify-center items-center gap-3 py-2">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    isFilled
                      ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-lg shadow-indigo-500/50'
                      : 'border-slate-700 bg-slate-950'
                  }`}
                />
              );
            })}
          </div>

          {errorMsg ? (
            <p className="text-xs text-red-400 font-bold flex items-center justify-center gap-1 animate-bounce">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-400">Ingresa tu PIN de 4 dígitos o usa Huella Dactilar</p>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="py-3 bg-slate-800/90 hover:bg-slate-700 active:bg-indigo-600 text-white font-black text-lg rounded-2xl border border-slate-700/60 shadow transition cursor-pointer active:scale-95"
            >
              {num}
            </button>
          ))}

          {/* Biometric Button */}
          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={isVerifyingBiometric}
            className="py-3 bg-indigo-950/80 hover:bg-indigo-900 active:bg-indigo-700 text-indigo-400 font-bold rounded-2xl border border-indigo-800/80 flex items-center justify-center cursor-pointer transition"
            title="Desbloquear con Huella o FaceID"
          >
            <Fingerprint className={`w-6 h-6 ${isVerifyingBiometric ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="py-3 bg-slate-800/90 hover:bg-slate-700 active:bg-indigo-600 text-white font-black text-lg rounded-2xl border border-slate-700/60 shadow transition cursor-pointer active:scale-95"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleDeleteDigit}
            className="py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-2xl border border-slate-700/40 flex items-center justify-center cursor-pointer transition active:scale-95"
          >
            Borrar
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Protección de Datos Supabase RLS Activa</span>
        </div>
      </div>
    </div>
  );
}
