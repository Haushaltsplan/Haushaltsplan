'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { PaAktienSucheInput, type AktienSucheAuswahl } from '@/components/portfolio-analyse/pa-aktien-suche-input'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'

/** Globale Aktiensuche in der App-Kopfzeile → Fundamentaldaten. */
export function PaGlobalAktienSuche({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [fehler, setFehler] = useState<string | null>(null)
  const [laden, setLaden] = useState(false)

  const onAuswahl = useCallback(
    async (auswahl: AktienSucheAuswahl) => {
      setLaden(true)
      setFehler(null)
      try {
        const symbol = auswahl.meta.symbolYahoo?.trim() || null
        const isin = auswahl.isin
        if (!isin && !symbol) {
          setFehler('Kein Ticker für diesen Treffer.')
          return
        }
        router.push(
          fundamentaldatenHref({
            isin,
            symbol,
            name: auswahl.meta.name,
          }),
        )
      } finally {
        setLaden(false)
      }
    },
    [router],
  )

  return (
    <div className={`min-w-0 flex-1 ${className}`}>
      <PaAktienSucheInput
        kompakt
        nurSuche
        laden={laden}
        fehler={fehler}
        onFehler={setFehler}
        onAuswahl={onAuswahl}
        placeholder="Aktie suchen…"
      />
    </div>
  )
}
