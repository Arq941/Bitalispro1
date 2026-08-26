import type {NextConfig} from 'next';

const noDocumentCache=[
  {key:'Cache-Control',value:'no-store, no-cache, max-age=0, must-revalidate'},
  {key:'Pragma',value:'no-cache'},
  {key:'Expires',value:'0'},
];

// Mantener aquí las entradas HTML/RSC de la aplicación. Los assets con hash de
// /_next/static conservan su caché inmutable; los documentos siempre se revalidan.
const freshEntryDocuments=[
  '/',
  '/login',
  '/dashboard',
  '/admin-menu',
  '/control-center',
  '/collections',
  '/route',
  '/route/close',
  '/route/map',
  '/route/navigate',
  '/sales',
  '/sales/new',
  '/sales/:path*',
  '/clients',
  '/clients/new',
  '/clients/:path*',
  '/cash',
  '/inventory',
  '/inventory/catalogs',
  '/inventory/counts',
  '/inventory/operations',
  '/products',
  '/orders',
  '/portfolio',
  '/reports',
  '/renewals',
  '/commissions',
  '/authorizations',
  '/audit',
  '/notifications',
  '/sync',
  '/settings',
  '/settings/users',
  '/settings/password',
  '/settings/password-links',
  '/set-password',
  '/supervision/down-payments',
  '/access-unavailable',
  '/diagnostics-transition',
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async redirects(){
    return [
      {source:'/reportes',destination:'/reports',permanent:true},
      {source:'/reportes/:path*',destination:'/reports/:path*',permanent:true},
      {source:'/cartera',destination:'/portfolio',permanent:true},
      {source:'/cartera/:path*',destination:'/portfolio/:path*',permanent:true},
    ];
  },
  async headers(){
    return [
      {
        source:'/:path*',
        headers:[
          {key:'X-Content-Type-Options',value:'nosniff'},
          {key:'X-Frame-Options',value:'DENY'},
          {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
          {key:'Permissions-Policy',value:'camera=(self), geolocation=(self), microphone=()'},
          {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
          {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
          {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},
          {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https://picsum.photos; style-src 'self' 'unsafe-inline' https://unpkg.com https://api.mapbox.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://router.project-osrm.org; worker-src 'self' blob:; manifest-src 'self'"},
        ],
      },
      ...freshEntryDocuments.map(source=>({source,headers:noDocumentCache})),
      {source:'/build-version.txt',headers:noDocumentCache},
      {source:'/sw.js',headers:noDocumentCache},
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
