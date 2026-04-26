import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Apple Touch: gleiche Marke wie /icon, skaliert. */
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
          background:
            'radial-gradient(ellipse 100% 85% at 50% 0%, #1a2035 0%, #0a0c12 50%, #030508 100%)',
          borderRadius: 42,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 145,
            height: 145,
            borderRadius: 36,
            background: 'linear-gradient(155deg, #161d2e 0%, #0c101c 100%)',
            boxShadow:
              'inset 0 0 0 1px rgba(99, 102, 241, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.06), 0 8px 16px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: 90,
              width: 104,
            }}
          >
            <div
              style={{
                width: 16,
                height: 84,
                borderRadius: 8,
                background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 40%, #64748b 100%)',
                boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.22), 1px 3px 7px rgba(0, 0, 0, 0.45)',
              }}
            />
            <div
              style={{
                display: 'flex',
                flex: 1,
                height: 84,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 3,
                marginRight: 3,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 14,
                  borderRadius: 7,
                  background: 'linear-gradient(90deg, #e2e8f0 0%, #a8b2bd 50%, #e2e8f0 100%)',
                  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.2), 0 1px 3px rgba(0, 0, 0, 0.35)',
                }}
              />
            </div>
            <div
              style={{
                width: 16,
                height: 84,
                borderRadius: 8,
                background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 40%, #64748b 100%)',
                boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.22), 1px 3px 7px rgba(0, 0, 0, 0.45)',
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
