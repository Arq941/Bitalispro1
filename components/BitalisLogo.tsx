'use client';

import React from 'react';

interface BitalisLogoProps {
  variant?: 'light' | 'dark' | 'auto';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  iconOnly?: boolean;
}

export default function BitalisLogo({
  size = 'md',
  className = '',
  iconOnly = false
}: BitalisLogoProps) {
  const heightClass = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  }[size];

  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  if (iconOnly) {
    return (
      <div className={`inline-flex shrink-0 items-center justify-center ${className}`}>
        <img
          src="/vitalis-symbol.svg"
          alt="Símbolo Vitalis"
          className={`${iconDimensions} object-contain drop-shadow-sm transition-transform active:scale-95`}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex select-none items-center ${className}`}>
      <img
        src="/vitalis-logo.svg"
        alt="VITALIS - Productos Naturistas"
        className={`${heightClass} w-auto object-contain drop-shadow-sm transition-transform duration-200 active:scale-[.98]`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
