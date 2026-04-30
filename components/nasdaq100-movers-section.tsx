import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import type { Nasdaq100MoversBericht, Nasdaq100MoverEintrag } from '@/lib/nasdaq100-tagesmovers'

function logoUrlFuerSymbol(symbol: string): string {
  const alias = symbol.trim().toUpperCase() === 'META' ? 'FB' : symbol
  return `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${encodeURIComponent(alias)}.png`
}

function MoverKarte({ z, gut }: { z: Nasdaq100MoverEintrag; gut: boolean }) {
  const farbe = gut ? 'text-emerald-300' : 'text-rose-300'
  const rand = gut ? 'border-emerald-800/40' : 'border-rose-800/40'
  return (
    <li className={`rounded-xl border ${rand} bg-slate-950/40 p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <img
            src={logoUrlFuerSymbol(z.symbol)}
            alt={`Logo ${z.name}`}
            className="mt-0.5 h-6 w-6 shrink-0 rounded-sm border border-slate-700/60 bg-slate-950/80 p-0.5 object-contain"
            loading="lazy"
            decoding="async"
          />
          <div>
            <p className="font-mono text-sm font-black text-violet-200">{z.symbol}</p>
            <p className="text-xs text-slate-400">{z.name}</p>
            {(z.sektor || z.branche) ? (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {z.sektor ?? '—'}{z.branche ? ` · ${z.branche}` : ''}
              </p>
            ) : null}
          </div>
        </div>
        <p className={`text-lg font-black tabular-nums ${farbe}`}>
          {z.aenderungProzent >= 0 ? '+' : ''}
          {z.aenderungProzent}%
        </p>
      </div>
      {z.kurs != null ? <p className="mt-1 text-xs tabular-nums text-slate-500">Kurs ca. {z.kurs.toFixed(2)} USD</p> : null}
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{z.artikelZusammenfassung}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-400">Begründung anzeigen</summary>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{z.begruendung}</p>
      </details>
      {z.schlagzeilen.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-400">Quellen anzeigen</summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-500">
            {z.schlagzeilen.map((s, i) => (
              <li key={`${s.href}-${i}`}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-slate-700 underline-offset-2 hover:text-slate-300"
                >
                  {s.titel}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  )
}

export function Nasdaq100MoversSection({ bericht }: { bericht: Nasdaq100MoversBericht }) {
  if (bericht.fehler) {
    return (
      <section className="rounded-[2.5rem] border border-amber-800/45 bg-amber-950/25 p-8 text-sm text-amber-100">
        <p className="font-bold text-amber-200">Nasdaq 100 Tages-Movers</p>
        <p className="mt-2">{bericht.fehler}</p>
      </section>
    )
  }

  return (
    <section className="rounded-[2.5rem] border border-violet-800/35 bg-slate-900/90 p-8 shadow-xl shadow-black/30">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400/90">Marktoverview</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-100">Nasdaq 100 — Top &amp; Flop (ein Handelstag)</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{bericht.sessionLabel}</p>
          </div>
          <DetailsDisclosureTriggerEnd tone="violet" />
        </summary>
        <div className="mt-4 grid gap-2 rounded-xl border border-slate-800/70 bg-slate-950/35 p-3 text-xs sm:grid-cols-3">
          <p className="font-semibold text-emerald-300">Positiv: {bericht.anzahlPositiv}</p>
          <p className="font-semibold text-rose-300">Negativ: {bericht.anzahlNegativ}</p>
          <p className="font-semibold text-slate-300">Unverändert: {bericht.anzahlUnveraendert}</p>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-emerald-300/90">Stärkste 10</h3>
            <ul className="space-y-3">
              {bericht.top10.map((z) => (
                <MoverKarte key={z.symbol} z={z} gut />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-rose-300/90">Schwächste 10</h3>
            <ul className="space-y-3">
              {bericht.flop10.map((z) => (
                <MoverKarte key={z.symbol} z={z} gut={false} />
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  )
}
