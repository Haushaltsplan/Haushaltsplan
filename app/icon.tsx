import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

/** Favicon & Lesezeichen: Haushaltsplan „H“ auf dunklem Smaragd-Hintergrund */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0f172a 0%, #020617 45%, #115e59 100%)',
          borderRadius: 112,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 380,
            height: 380,
            borderRadius: 88,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '6px solid rgba(52, 211, 153, 0.5)',
          }}
        >
          <span
            style={{
              fontSize: 240,
              fontWeight: 900,
              color: '#34d399',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              letterSpacing: '-0.05em',
            }}
          >
            H
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
