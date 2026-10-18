'use client'

import { useEffect, useState } from 'react'

function proxiedBild(url: string): string {
  if (url.startsWith('/api/angebote/bild')) return url
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  return `/api/angebote/bild?u=${encodeURIComponent(url)}`
}

/**
 * Lädt Produktbilder über den Proxy (öffentlich für <img>) und als Fallback
 * per authentifiziertem fetch → Object-URL.
 */
export function ProduktBild({
  src,
  alt,
  className,
}: {
  src: string | null | undefined
  alt: string
  className?: string
}) {
  const [display, setDisplay] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    setDisplay(null)
    if (!src?.trim()) {
      setFailed(true)
      return
    }

    const proxyUrl = proxiedBild(src.trim())
    let objectUrl: string | null = null
    let cancelled = false

    // Sofort Proxy versuchen (nach Auth-Fix für /api/angebote/bild)
    setDisplay(proxyUrl)

    // Zusätzlich: authentifizierter fetch als Fallback, falls Proxy 401/403
    void (async () => {
      try {
        const res = await fetch(proxyUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (!blob.type.startsWith('image/') && blob.size < 100) throw new Error('kein Bild')
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setDisplay(objectUrl)
      } catch {
        // Proxy-URL bleibt; onError am img setzt failed
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (failed || !display) {
    return (
      <div
        className={[
          'flex h-full w-full items-center justify-center bg-[var(--app-surface-muted)] text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        Kein Foto
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={display}
      alt={alt}
      className={['h-full w-full object-contain p-1.5', className].filter(Boolean).join(' ')}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
