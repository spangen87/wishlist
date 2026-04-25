import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Önskestjärnan',
    short_name: 'Önskestjärnan',
    description: 'Där drömmar tänds — barnens önskelista',
    id: '/',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F1330',
    theme_color: '#0F1330',
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
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
