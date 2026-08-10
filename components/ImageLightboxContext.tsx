'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ImageLightboxModal from './ImageLightboxModal';

interface LightboxState {
  isOpen: boolean;
  imageUrl: string;
  title?: string;
  description?: string;
  alt?: string;
}

interface ImageLightboxContextType {
  openLightbox: (imageUrl: string, title?: string, description?: string, alt?: string) => void;
  closeLightbox: () => void;
  lightboxState: LightboxState;
}

const ImageLightboxContext = createContext<ImageLightboxContextType>({
  openLightbox: () => {},
  closeLightbox: () => {},
  lightboxState: { isOpen: false, imageUrl: '' },
});

export function ImageLightboxProvider({ children }: { children: ReactNode }) {
  const [lightboxState, setLightboxState] = useState<LightboxState>({
    isOpen: false,
    imageUrl: '',
    title: '',
    description: '',
    alt: '',
  });

  const openLightbox = (imageUrl: string, title?: string, description?: string, alt?: string) => {
    if (!imageUrl) return;
    setLightboxState({
      isOpen: true,
      imageUrl,
      title: title || 'Fotografía',
      description: description || '',
      alt: alt || title || 'Fotografía en pantalla completa',
    });
  };

  const closeLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  };

  // Global document click listener for any <img> element
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.tagName !== 'IMG') return;

      const img = target as HTMLImageElement;

      // Ignore images marked as no-lightbox
      if (
        img.getAttribute('data-no-lightbox') === 'true' ||
        img.classList.contains('no-lightbox') ||
        img.closest('[data-no-lightbox="true"]') ||
        img.closest('.no-lightbox')
      ) {
        return;
      }

      // Check if image has a valid src and is readable
      if (img.src && !img.src.endsWith('#') && !img.src.includes('data:image/svg+xml')) {
        const title =
          img.getAttribute('data-title') ||
          img.alt ||
          img.title ||
          img.closest('[data-photo-label]')?.getAttribute('data-photo-label') ||
          'Fotografía del Expediente';

        const description =
          img.getAttribute('data-description') ||
          'Toca o usa los controles para acercar, alejarse o rotar la fotografía.';

        openLightbox(img.src, title, description, img.alt);
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, []);

  return (
    <ImageLightboxContext.Provider value={{ openLightbox, closeLightbox, lightboxState }}>
      {children}
      <ImageLightboxModal
        isOpen={lightboxState.isOpen}
        imageUrl={lightboxState.imageUrl}
        title={lightboxState.title}
        description={lightboxState.description}
        alt={lightboxState.alt}
        onClose={closeLightbox}
      />
    </ImageLightboxContext.Provider>
  );
}

export function useImageLightbox() {
  return useContext(ImageLightboxContext);
}
