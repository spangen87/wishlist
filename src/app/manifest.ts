import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Min önskelista',
    short_name: 'Önskelista',
    description: 'Barnets önskelista — koordinera inköp utan att förstöra överraskningen',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF9F5',
    theme_color: '#FFF9F5',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
