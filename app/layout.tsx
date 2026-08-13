import type {Metadata,Viewport} from 'next';
import './globals.css';
import { ImageLightboxProvider } from '@/components/ImageLightboxContext';
import PWAProvider from '@/components/phase15/PWAProvider';
import AdminBuildIndicator from '@/components/phase15/AdminBuildIndicator';

export const metadata: Metadata = {
  title: 'BITALIS • ERP CRM Cobranza en Ruta',
  description: 'Sistema integral BITALIS para ventas, cobranza en ruta, CRM, inventario, caja, comisiones y auditoría.',
  manifest: '/manifest.json',
  icons: { icon: '/bitalis-symbol.svg', apple: '/bitalis-symbol.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BITALIS' },
};
export const viewport: Viewport = { themeColor:'#12224A', width:'device-width', initialScale:1, viewportFit:'cover' };

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
        <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.css" />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-[#F3F4F6] text-[#2B2B2B] antialiased selection:bg-[#FF6A00] selection:text-white" suppressHydrationWarning>
        <PWAProvider><ImageLightboxProvider>{children}<AdminBuildIndicator/></ImageLightboxProvider></PWAProvider>
      </body>
    </html>
  );
}
