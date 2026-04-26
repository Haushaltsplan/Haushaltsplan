import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

/**
 * Favicon & PWA: Monogramm „H“ (Haushaltsplan) — tiefdunkel, kühle Metall-Balken, dezenter Indigo-Schimmer.
 */
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
          background:
            'radial-gradient(ellipse 100% 85% at 50% 0%, #1a2035 0%, #0a0c12 50%, #030508 100%)',
          borderRadius: 120,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 412,
            height: 412,
            borderRadius: 100,
            background: 'linear-gradient(155deg, #161d2e 0%, #0c101c 100%)',
            boxShadow:
              'inset 0 0 0 1px rgba(99, 102, 241, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.06), 0 24px 48px rgba(0, 0, 0, 0.55)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: 256,
              width: 300,
            }}
          >
            <div
              style={{
                width: 44,
                height: 240,
                borderRadius: 22,
                background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 40%, #64748b 100%)',
                boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.22), 4px 8px 20px rgba(0, 0, 0, 0.45)',
              }}
            />
            <div
              style={{
                display: 'flex',
                flex: 1,
                height: 240,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 8,
                marginRight: 8,
              }}
            >
              <div
                style={{
                  width: 116,
                  height: 40,
                  borderRadius: 20,
                  background: 'linear-gradient(90deg, #e2e8f0 0%, #a8b2bd 50%, #e2e8f0 100%)',
                  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.2), 0 2px 8px rgba(0, 0, 0, 0.35)',
                }}
              />
            </div>
            <div
              style={{
                width: 44,
                height: 240,
                borderRadius: 22,
                background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 40%, #64748b 100%)',
                boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.22), 4px 8px 20px rgba(0, 0, 0, 0.45)',
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
