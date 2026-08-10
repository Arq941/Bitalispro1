'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Download,
  Camera,
  Maximize2,
  Minimize2,
  ExternalLink,
  Move,
  Info
} from 'lucide-react';

export interface ImageLightboxModalProps {
  isOpen?: boolean;
  imageUrl: string;
  title?: string;
  description?: string;
  onClose: () => void;
  alt?: string;
}

export default function ImageLightboxModal({
  isOpen = true,
  imageUrl,
  title = 'Fotografía del Expediente',
  description,
  onClose,
  alt = 'Fotografía'
}: ImageLightboxModalProps) {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [touchPinchDist, setTouchPinchDist] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [prevImageUrl, setPrevImageUrl] = useState<string>(imageUrl);

  // Sync state when imageUrl changes during render (recommended React pattern)
  if (prevImageUrl !== imageUrl) {
    setPrevImageUrl(imageUrl);
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for arrow keys when zoomed
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', '+', '-'].includes(e.key)) {
        if (scale > 1) {
          e.preventDefault();
        }
      }

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          setScale((s) => Math.min(s + 0.25, 5));
          break;
        case '-':
        case '_':
          setScale((s) => Math.max(s - 0.25, 0.5));
          break;
        case 'r':
        case 'R':
          setRotation((r) => (r + 90) % 360);
          break;
        case '0':
        case ' ':
          setScale(1);
          setRotation(0);
          setPosition({ x: 0, y: 0 });
          break;
        case 'ArrowLeft':
          setPosition((p) => ({ ...p, x: p.x + 40 }));
          break;
        case 'ArrowRight':
          setPosition((p) => ({ ...p, x: p.x - 40 }));
          break;
        case 'ArrowUp':
          setPosition((p) => ({ ...p, y: p.y + 40 }));
          break;
        case 'ArrowDown':
          setPosition((p) => ({ ...p, y: p.y - 40 }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, scale]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(Number((s + 0.25).toFixed(2)), 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(Number((s - 0.25).toFixed(2)), 0.5));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  // Mouse wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((s) => Math.min(Number((s + 0.15).toFixed(2)), 5));
    } else {
      setScale((s) => Math.max(Number((s - 0.15).toFixed(2)), 0.5));
    }
  };

  // Double click / double tap zoom
  const handleDoubleClick = () => {
    if (scale > 1 || position.x !== 0 || position.y !== 0) {
      handleReset();
    } else {
      setScale(2.5);
    }
  };

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary click
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch event handlers for touchscreens (drag & pinch zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      // Pinch to zoom start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchPinchDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && touchPinchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchPinchDist;
      setScale((s) => Math.min(Math.max(Number((s * factor).toFixed(2)), 0.5), 5));
      setTouchPinchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchPinchDist(null);
  };

  // Fullscreen mode toggle
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen API error:', err);
    }
  };

  if (!isOpen || !imageUrl) return null;

  const percentage = Math.round(scale * 100);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-between p-2 sm:p-5 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* HEADER BAR */}
      <div
        className="w-full max-w-5xl flex items-center justify-between bg-slate-900/90 border border-slate-800/90 px-3.5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md z-20 gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-indigo-950/80 border border-indigo-800/80 rounded-xl shrink-0">
            <Camera className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-white text-sm sm:text-base truncate">{title}</h3>
            {description && <p className="text-xs text-slate-400 truncate hidden sm:block">{description}</p>}
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <a
            href={imageUrl}
            download="fotografia_expediente.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-700/60"
            title="Descargar o guardar imagen original"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Guardar</span>
          </a>

          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer hidden sm:flex items-center gap-1.5 text-xs font-bold border border-slate-700/60"
            title="Abrir imagen en pestaña nueva"
          >
            <ExternalLink className="w-4 h-4 text-sky-400" />
            <span>Abrir</span>
          </a>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer hidden sm:block border border-slate-700/60"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:px-3.5 sm:py-2 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-200 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-xs"
            title="Cerrar vista (Tecla ESC)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT / IMAGE CANVAS */}
      <div
        className="relative my-auto w-full max-w-5xl h-[68vh] sm:h-[73vh] flex items-center justify-center overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-2xl p-2 cursor-crosshair touch-none"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt={alt}
          onDoubleClick={handleDoubleClick}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className={`max-h-[64vh] sm:max-h-[69vh] w-auto max-w-full object-contain rounded-xl select-none ${
            scale > 1 || rotation !== 0
              ? isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : 'cursor-zoom-in'
          }`}
          draggable={false}
        />

        {/* Quick Drag Hint Banner when zoomed */}
        {(scale > 1 || position.x !== 0 || position.y !== 0) && (
          <div className="absolute top-3 left-3 bg-slate-900/80 border border-slate-700/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] sm:text-xs text-indigo-300 flex items-center gap-1.5 pointer-events-none shadow-md">
            <Move className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Arrastra para mover la imagen</span>
          </div>
        )}
      </div>

      {/* FLOATING INTERACTIVE CONTROLS BAR */}
      <div
        className="w-full max-w-md flex items-center justify-between bg-slate-900/95 border border-slate-800/90 px-4 py-2 rounded-full shadow-2xl backdrop-blur-lg z-20 gap-1 sm:gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zoom Out */}
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={scale <= 0.5}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-full transition cursor-pointer"
          title="Alejar imagen (-)"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        {/* Zoom Percentage Badge / Reset Trigger */}
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-full text-xs font-mono font-bold text-indigo-300 transition cursor-pointer flex items-center gap-1"
          title="Haz clic para restablecer zoom y posición (100%)"
        >
          <span>{percentage}%</span>
          {(scale !== 1 || rotation !== 0 || position.x !== 0 || position.y !== 0) && (
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          )}
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={scale >= 5}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-full transition cursor-pointer"
          title="Acercar imagen (+)"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-0.5 sm:mx-1" />

        {/* Rotate Clockwise */}
        <button
          type="button"
          onClick={handleRotate}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition cursor-pointer relative"
          title="Girar 90° a la derecha (Tecla R)"
        >
          <RotateCw className="w-5 h-5" />
          {rotation > 0 && (
            <span className="absolute -top-1 -right-1 text-[9px] font-mono bg-indigo-600 text-white px-1 rounded-full font-extrabold">
              {rotation}°
            </span>
          )}
        </button>

        {/* Reset Transform */}
        <button
          type="button"
          onClick={handleReset}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition cursor-pointer"
          title="Restablecer tamaño y orientación original"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-0.5 sm:mx-1" />

        {/* Keyboard / Gesture info tooltip button */}
        <div className="relative group">
          <button
            type="button"
            className="p-2 text-slate-400 hover:text-slate-200 rounded-full transition cursor-pointer"
            title="Ayuda de controles"
          >
            <Info className="w-5 h-5" />
          </button>
          <div className="absolute bottom-full mb-3 right-1/2 translate-x-1/2 w-64 p-3 bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded-xl shadow-2xl hidden group-hover:block z-30 pointer-events-none">
            <p className="font-bold text-white mb-1 border-b border-slate-800 pb-1">💡 Controles de la imagen:</p>
            <ul className="space-y-1 text-slate-300">
              <li>• <b>Rueda del mouse:</b> Acercar / Alejar</li>
              <li>• <b>Doble clic / toque:</b> Alternar Zoom 2.5x</li>
              <li>• <b>Arrastrar:</b> Mover si hay Zoom</li>
              <li>• <b>Teclas + / -:</b> Cambiar Zoom</li>
              <li>• <b>Tecla R:</b> Girar imagen 90°</li>
              <li>• <b>Tecla ESC:</b> Cerrar visor</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
