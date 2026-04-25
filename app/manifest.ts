import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Haushaltsplan',
    short_name: 'Haushaltsplan',
    description: 'Finanzen, Speisekammer, Investments',
    start_url: '/finanzen',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#0f172a',
    lang: 'de',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }
}
