import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Apple Touch Icon / einige Verknüpfungen */
export default function AppleIcon() {
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
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 132,
            height: 132,
            borderRadius: 32,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '3px solid rgba(52, 211, 153, 0.5)',
          }}
        >
          <span
            style={{
              fontSize: 84,
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
