/** Minimales Datenmodell für S&P-500- und Nasdaq-Movers-Karten (gemeinsame Darstellung). */
export type InvestmentMoverKarteDaten = {
  symbol: string
  name: string
  /** Branche/Sektor aus den Konstituenten-Daten (Anzeige). */
  brancheAnzeige: string | null
  aenderungProzent: number
  kurs: number | null
}

function logoUrlFuerSymbol(symbol: string): string {
  const alias = symbol.trim().toUpperCase() === 'META' ? 'FB' : symbol
  return `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${encodeURIComponent(alias)}.png`
}

export function InvestmentMoverKarte({ z }: { z: InvestmentMoverKarteDaten }) {
  const farbe = z.aenderungProzent >= 0 ? 'text-teal-400' : 'text-red-400/90'
  const pctStr = `${z.aenderungProzent >= 0 ? '+' : ''}${z.aenderungProzent}%`

  return (
    <li className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
            {z.brancheAnzeige ? (
              <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                <span className="text-zinc-500">Branche: </span>
                <span className="text-zinc-400">{z.brancheAnzeige}</span>
              </p>
            ) : null}
          </div>
        </div>
        <p className={`text-base font-semibold tabular-nums ${farbe}`}>{pctStr}</p>
      </div>
      {z.kurs != null ? (
        <p className="mt-2 text-xs tabular-nums text-zinc-400">Kurs ca. {z.kurs.toFixed(2)} USD</p>
      ) : null}
    </li>
  )
}
