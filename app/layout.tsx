import type {Metadata,Viewport} from 'next';
import './globals.css';
import { ImageLightboxProvider } from '@/components/ImageLightboxContext';
import PWAProvider from '@/components/phase15/PWAProvider';
import AppShell from '@/components/phase15/AppShell';

export const metadata: Metadata = {
  title: 'BITALIS • ERP CRM Cobranza en Ruta',
  description: 'Sistema integral BITALIS para ventas, cobranza en ruta, CRM, inventario, caja, comisiones y auditoría.',
  manifest: '/manifest.json',
  icons: { icon: '/bitalis-symbol.svg', apple: '/bitalis-symbol.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'BITALIS' },
  formatDetection: { telephone: true, email: false, address: false },
};
export const viewport: Viewport = { themeColor:'#062B24', width:'device-width', initialScale:1, viewportFit:'cover' };

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
        <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.css" />
      </head>
      <body className="bitalis-app-shell min-h-screen overflow-x-hidden antialiased" suppressHydrationWarning>
        <PWAProvider><ImageLightboxProvider><AppShell>{children}</AppShell></ImageLightboxProvider></PWAProvider>
      </body>
    </html>
  );
}