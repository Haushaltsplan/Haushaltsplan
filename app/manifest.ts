import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Omnia',
    short_name: 'Omnia',
    description: 'Finanzen, Speisekammer, Kalender, Natur & mehr',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#0f172a',
    lang: 'de',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
