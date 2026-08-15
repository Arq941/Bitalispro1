import type {NextConfig} from 'next';

const noDocumentCache=[
  {key:'Cache-Control',value:'no-store, no-cache, max-age=0, must-revalidate'},
  {key:'Pragma',value:'no-cache'},
  {key:'Expires',value:'0'},
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
      // El acceso es también el start_url de la PWA. Debe pedir HTML fresco para no
      // reactivar chunks de una versión anterior después de un despliegue.
      {source:'/',headers:noDocumentCache},
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
