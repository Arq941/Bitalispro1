import type {Metadata} from 'next';
import './globals.css';
import { ImageLightboxProvider } from '@/components/ImageLightboxContext';

export const metadata: Metadata = {
  title: 'BITALIS • Productos Naturistas - Sistema de Gestión de Campo',
  description: 'Plataforma PWA BITALIS para cobranza semanal en ruta, ventas de productos naturistas, OCR Gemini y mapas GPS.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://api.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.css"
        />
        <meta name="theme-color" content="#047857" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/bitalis-symbol.svg" type="image/svg+xml" />
      </head>
      <body className="bg-[#0b0f19] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white min-h-screen" suppressHydrationWarning>
        <ImageLightboxProvider>
          {children}
        </ImageLightboxProvider>
      </body>
    </html>
  );
}
