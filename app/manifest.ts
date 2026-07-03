import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Omnia',
    short_name: 'Omnia',
    description: 'Finanzen, Speisekammer, Kalender & mehr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#0f172a',
    lang: 'de',
    orientation: 'portrait-primary',
    prefer_related_applications: false,
    categories: ['health', 'fitness', 'lifestyle'],
    // Pixel-Icons: Chrome/Edge fordern 192+512 (bitmap) für „App installieren“; SVG reicht allein oft nicht
    icons: [
      { src: '/omnia-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/omnia-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/omnia-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
