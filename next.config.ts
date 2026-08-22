import type {NextConfig} from 'next';

const noDocumentCache=[
  {key:'Cache-Control',value:'no-store, no-cache, max-age=0, must-revalidate'},
  {key:'Pragma',value:'no-cache'},
  {key:'Expires',value:'0'},
];
const freshEntryDocuments=[
  '/',
  '/dashboard',
  '/control-center',
  '/collections',
  '/route',
  '/sales',
  '/sales/new',
  '/clients',
  '/clients/new',
  '/cash',
  '/inventory',
  '/products',
  '/renewals',
  '/commissions',
  '/authorizations',
  '/audit',
  '/settings',
  '/settings/users',
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
      // El marcador de versión es la autoridad para comprobar coherencia del bundle.
      {source:'/build-version.txt',headers:noDocumentCache},
    ];
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
