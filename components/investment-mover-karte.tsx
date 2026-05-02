/** Minimales Datenmodell für S&P-500- und Nasdaq-Movers-Karten (gemeinsame Darstellung). */
export type InvestmentMoverKarteDaten = {
  symbol: string
  name: string
  /** Branche/Sektor aus den Konstituenten-Daten (Anzeige). */
  brancheAnzeige: string | null
  aenderungProzent: number | null
  kurs: number | null
  /** Optional z. B. Portfolio: Währung für die Kurszeile (Standard USD bei Movers). */
  notierung?: string
  /** Portfolio: YTD % (Yahoo Chart, adjusted close). */
  ytdProzent?: number | null
  /** Portfolio: ca. 5 Jahre % (Yahoo Chart, adjusted, wöchentlich). */
  fuenfJahreProzent?: number | null
  /** Portfolio: ca. 10 Jahre % (Yahoo Chart, adjusted, wöchentlich). */
  zehnJahreProzent?: number | null
  /**
   * Portfolio: Abstand zum ATH der Yahoo-Serie in %: ((Kurs − ATH) / ATH) × 100.
   * Negativ = unter Höchststand; ATH = Maximum der bereinigten Wochenschlüsse (`range=max`).
   */
  athAbstandProzent?: number | null
  /** Portfolio: Freitext unter dem Namen. */
  notiz?: string | null
}

/** Finnhub-Logos: Kürzel ohne Börsensuffix (`RMS.PA` → `RMS`). */
function logoTickerFuerSymbol(symbol: string): string {
  const t = symbol.trim()
  const dot = t.indexOf('.')
  const basis = dot > 0 ? t.slice(0, dot) : t
  const normalized = basis.replace(/-/g, '')
  return normalized.toUpperCase() === 'META' ? 'FB' : normalized
}

function logoUrlFuerSymbol(symbol: string): string {
  return `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${encodeURIComponent(logoTickerFuerSymbol(symbol))}.png`
}

function farbeUndStringProzent(p: number | null | undefined): { cls: string; s: string } {
  const ok = p != null && Number.isFinite(p)
  if (!ok) return { cls: 'text-zinc-500', s: '—' }
  const v = p as number
  return {
    cls: v >= 0 ? 'text-teal-400' : 'text-red-400/90',
    s: `${v >= 0 ? '+' : ''}${v}%`,
  }
}

export function InvestmentMoverKarte({ z }: { z: InvestmentMoverKarteDaten }) {
  const zeigeLangfrist =
    z.ytdProzent !== undefined ||
    z.fuenfJahreProzent !== undefined ||
    z.zehnJahreProzent !== undefined ||
    z.athAbstandProzent !== undefined
  const tag = farbeUndStringProzent(z.aenderungProzent)
  const ytd = farbeUndStringProzent(z.ytdProzent)
  const z5 = farbeUndStringProzent(z.fuenfJahreProzent)
  const z10 = farbeUndStringProzent(z.zehnJahreProzent)
  const ath = farbeUndStringProzent(z.athAbstandProzent)

  return (
    <li className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src={logoUrlFuerSymbol(z.symbol)}
            alt={z.symbol}
            className="h-8 w-8 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 p-0.5 object-contain"
            loading="lazy"
            decoding="async"
          />
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-white">{z.symbol}</p>
            <p className="truncate text-xs leading-snug text-zinc-400">{z.name}</p>
            {z.notiz?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-zinc-500">{z.notiz.trim()}</p>
            ) : null}
            {z.brancheAnzeige ? (
              <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                <span className="text-zinc-500">Branche: </span>
                <span className="text-zinc-400">{z.brancheAnzeige}</span>
              </p>
            ) : null}
          </div>
        </div>
        {zeigeLangfrist ? (
          <dl className="shrink-0 space-y-1 text-right">
            <div className="flex items-baseline justify-end gap-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Tag</dt>
              <dd className={`text-sm font-semibold tabular-nums ${tag.cls}`}>{tag.s}</dd>
            </div>
            <div className="flex items-baseline justify-end gap-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">YTD</dt>
              <dd className={`text-sm font-semibold tabular-nums ${ytd.cls}`}>{ytd.s}</dd>
            </div>
            <div className="flex items-baseline justify-end gap-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">5 J.</dt>
              <dd className={`text-sm font-semibold tabular-nums ${z5.cls}`}>{z5.s}</dd>
            </div>
            <div className="flex items-baseline justify-end gap-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">10 J.</dt>
              <dd className={`text-sm font-semibold tabular-nums ${z10.cls}`}>{z10.s}</dd>
            </div>
            <div className="flex items-baseline justify-end gap-3">
              <dt
                className="max-w-[5.5rem] text-right text-[11px] font-medium uppercase leading-snug tracking-wide text-zinc-500"
                title="Abstand zum Höchststand der Yahoo-Historie (bereinigte Wochenschlüsse, range=max); Kurs lt. Spark wo verfügbar."
              >
                zu ATH
              </dt>
              <dd className={`text-sm font-semibold tabular-nums ${ath.cls}`}>{ath.s}</dd>
            </div>
          </dl>
        ) : (
          <p className={`text-base font-semibold tabular-nums ${tag.cls}`}>{tag.s}</p>
        )}
      </div>
      {z.kurs != null ? (
        <p className="mt-2 text-xs tabular-nums text-zinc-400">
          Kurs ca. {z.kurs.toFixed(2)} {z.notierung ?? 'USD'}
        </p>
      ) : null}
    </li>
  )
}
