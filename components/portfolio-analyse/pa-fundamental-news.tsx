'use client'

import { PaCard, PA_SCROLL_ELEGANT } from '@/components/portfolio-analyse/pa-ui'
import type { FundamentalNewsArtikel } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function formatNewsDatum(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function PaFundamentalNews({ artikel }: { artikel: FundamentalNewsArtikel[] }) {
  if (artikel.length === 0) {
    return (
      <PaCard className="p-8 text-center text-sm text-zinc-500">
        Keine aktuellen Meldungen von Yahoo Finance gefunden.
      </PaCard>
    )
  }

  return (
    <PaCard variant="glass" className="overflow-hidden">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-100">Aktuelle Meldungen</h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">Quelle: Yahoo Finance</p>
      </div>
      <ul className={`divide-y divide-zinc-800/60 ${PA_SCROLL_ELEGANT} max-h-[min(70vh,42rem)]`}>
        {artikel.map((a) => (
          <li key={a.link}>
            <a
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3.5 transition hover:bg-zinc-900/60"
            >
              <p className="text-sm font-medium leading-snug text-zinc-100">{a.titel}</p>
              <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-zinc-500">
                {a.quelle ? <span>{a.quelle}</span> : null}
                {a.veroeffentlicht ? <span>{formatNewsDatum(a.veroeffentlicht)}</span> : null}
              </p>
              {a.zusammenfassung ? (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">{a.zusammenfassung}</p>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </PaCard>
  )
}
