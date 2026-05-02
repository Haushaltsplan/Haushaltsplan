import { InvestmentMoverKarte, type InvestmentMoverKarteDaten } from '@/components/investment-mover-karte'
import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import type { PortfolioKurseBericht } from '@/lib/portfolio-kurse'

function nachTagSplitten(positionen: InvestmentMoverKarteDaten[]) {
  const positiv = positionen
    .filter((z) => z.aenderungProzent != null && z.aenderungProzent > 0)
    .sort((a, b) => (b.aenderungProzent ?? 0) - (a.aenderungProzent ?? 0))
  const negativ = positionen
    .filter((z) => z.aenderungProzent != null && z.aenderungProzent < 0)
    .sort((a, b) => (a.aenderungProzent ?? 0) - (b.aenderungProzent ?? 0))
  const neutral = positionen
    .filter((z) => z.aenderungProzent == null || z.aenderungProzent === 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return { positiv, negativ, neutral }
}

export function PortfolioHoldingsSection({
  bericht,
  embedded = false,
}: {
  bericht: PortfolioKurseBericht
  embedded?: boolean
}) {
  const { positiv, negativ, neutral } = nachTagSplitten(bericht.positionen)
  const shell = embedded ? 'space-y-2' : 'rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4'

  return (
    <section className={shell}>
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg py-1 outline-none hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 pr-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Portfolio</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-white">Meine Unternehmen</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{bericht.sessionLabel}</p>
          </div>
          <DetailsDisclosureTriggerEnd size="sm" />
        </summary>

        {bericht.fehler ? (
          <p className="mt-3 rounded-lg border border-orange-900/35 bg-orange-950/15 px-3 py-2 text-xs leading-relaxed text-orange-100/95">
            {bericht.fehler}
          </p>
        ) : null}

        <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="min-w-0">
            <h3 className="mb-3 border-b border-teal-900/40 pb-2 text-[11px] font-semibold uppercase tracking-wide text-teal-400/95">
              Im Plus · Tagessession
            </h3>
            {positiv.length === 0 ? (
              <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-6 text-center text-xs leading-relaxed text-zinc-500">
                Keine Position mit positivem Tagesergebnis — oder noch keine Kursdaten.
              </p>
            ) : (
              <ul className="grid gap-2">
                {positiv.map((z) => (
                  <InvestmentMoverKarte key={z.symbol} z={z} />
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="mb-3 border-b border-red-950/50 pb-2 text-[11px] font-semibold uppercase tracking-wide text-red-400/85">
              Im Minus · Tagessession
            </h3>
            {negativ.length === 0 ? (
              <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-6 text-center text-xs leading-relaxed text-zinc-500">
                Keine Position mit negativem Tagesergebnis — oder noch keine Kursdaten.
              </p>
            ) : (
              <ul className="grid gap-2">
                {negativ.map((z) => (
                  <InvestmentMoverKarte key={z.symbol} z={z} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {neutral.length > 0 ? (
          <div className="mt-8 border-t border-zinc-800/80 pt-6">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Unverändert oder keine Tagesdaten
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {neutral.map((z) => (
                <InvestmentMoverKarte key={z.symbol} z={z} />
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 text-[11px] leading-relaxed text-zinc-500">
          YTD, „5 J.“ und „10 J.“ beziehen sich auf die Performance vom ersten bis zum letzten gelieferten Kurs der Serie
          (Yahoo Finance Chart, bereinigte Schlusskurse). „5 J.“ und „10 J.“ nutzen etwa wöchentliche Kerzen über das
          gewählte Zurückblicksfenster — kein exakter Kalenderzeitraum.
        </p>
      </details>
    </section>
  )
}
