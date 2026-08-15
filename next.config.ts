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
