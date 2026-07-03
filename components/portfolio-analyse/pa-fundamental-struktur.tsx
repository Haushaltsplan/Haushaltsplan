'use client'

import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

function Kennzahl({
  label,
  wert,
  hinweis,
}: {
  label: string
  wert: string | number | null | undefined
  hinweis?: string
}) {
  if (wert == null || wert === '') return null
  return (
    <div className="rounded-xl border border-[var(--app-border-strong)]/50 bg-[var(--app-surface-muted)]/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--app-text)]">{wert}</p>
      {hinweis ? <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">{hinweis}</p> : null}
    </div>
  )
}

function pct(v: number | null | undefined, digits = 1): string | null {
  if (v == null || !Number.isFinite(v)) return null
  return `${v.toFixed(digits)} %`
}

function usdKompakt(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)} Mrd.`
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)} Mio.`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toFixed(0)}`
}

export function PaFundamentalStruktur({ erweitert }: { erweitert: FundamentaldatenErweitert | null | undefined }) {
  if (!erweitert) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Erweiterte Strukturdaten werden geladen …
      </PaCard>
    )
  }

  const hatInhalt =
    erweitert.dividenden ||
    erweitert.holders ||
    erweitert.finviz ||
    erweitert.insiderNetto ||
    erweitert.beatMiss ||
    erweitert.secStruktur ||
    erweitert.euFundamental ||
    erweitert.optionsIv ||
    (erweitert.arbeitgeber &&
      (erweitert.arbeitgeber.kununu ||
        erweitert.arbeitgeber.glassdoor ||
        erweitert.arbeitgeber.glassdoorCeo))

  if (!hatInhalt) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Für diesen Titel konnten keine zusätzlichen Strukturdaten geladen werden.
      </PaCard>
    )
  }

  const d = erweitert.dividenden
  const h = erweitert.holders
  const f = erweitert.finviz
  const ins = erweitert.insiderNetto
  const bm = erweitert.beatMiss
  const sec = erweitert.secStruktur
  const eu = erweitert.euFundamental
  const iv = erweitert.optionsIv
  const ag = erweitert.arbeitgeber

  return (
    <div className="space-y-4">
      {(h || f) && (
        <PaCard className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-white">Eigentümerstruktur & Short Interest</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kennzahl label="Insider (Yahoo)" wert={pct(h?.insiderPct != null ? h.insiderPct * 100 : null)} />
            <Kennzahl label="Institutionen (Yahoo)" wert={pct(h?.institutionenPct != null ? h.institutionenPct * 100 : null)} />
            <Kennzahl label="Short Float (Finviz)" wert={pct(f?.shortFloatPct)} />
            <Kennzahl label="Short Ratio / Days to Cover" wert={f?.shortRatio != null ? `${f.shortRatio} Tage` : null} />
            <Kennzahl label="Float (Yahoo)" wert={h?.floatShares != null ? `${(h.floatShares / 1e6).toFixed(1)} Mio.` : null} />
            <Kennzahl label="PEG (Finviz)" wert={f?.peg?.toFixed(2) ?? null} />
          </div>
        </PaCard>
      )}

      {d && (
        <PaCard className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-white">Dividenden-Historie (DivvyDiary)</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kennzahl label="CAGR 5J" wert={pct(d.cagr5yPct)} />
            <Kennzahl label="CAGR 10J" wert={pct(d.cagr10yPct)} />
            <Kennzahl label="Ø Wachstum 3J" wert={pct(d.durchschnittWachstum3yPct)} />
            <Kennzahl label="Jahre ohne Senkung" wert={d.jahreOhneSenkung} />
            <Kennzahl label="Letzte Senkung" wert={d.letzteSenkungJahr ?? 'keine erkannt'} />
            <Kennzahl label="Letzte Dividende" wert={d.letzteDividendeUsd != null ? `$${d.letzteDividendeUsd.toFixed(4)}` : null} />
            <Kennzahl label="Frequenz" wert={d.frequenz} />
            <Kennzahl label="Zahlungen / Jahre" wert={`${d.anzahlZahlungen} / ${d.jahreMitDaten}`} />
          </div>
        </PaCard>
      )}

      {(ins || bm) && (
        <PaCard className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-white">Insider-Netto & Earnings-Trefferquote</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kennzahl label="Insider-Käufe 90T" wert={ins?.kaeufe90d} />
            <Kennzahl label="Insider-Verkäufe 90T" wert={ins?.verkaeufe90d} />
            <Kennzahl label="Netto 90T" wert={usdKompakt(ins?.nettoWertUsd90d ?? null)} />
            <Kennzahl
              label="Netto-Richtung"
              wert={
                ins?.nettoRichtung === 'kauf'
                  ? 'Netto-Kauf'
                  : ins?.nettoRichtung === 'verkauf'
                    ? 'Netto-Verkauf'
                    : ins?.nettoRichtung === 'neutral'
                      ? 'Neutral'
                      : null
              }
            />
            <Kennzahl label="EPS Beat 8Q" wert={pct(bm?.epsBeatRatePct, 0)} />
            <Kennzahl label="EPS Beat 12Q" wert={pct(bm?.agg12?.epsBeatRatePct, 0)} />
            <Kennzahl label="EPS Beat 20Q" wert={pct(bm?.agg20?.epsBeatRatePct, 0)} />
            <Kennzahl
              label="EPS-Streak"
              wert={
                bm?.streak?.eps && bm.streak.epsLaenge > 0
                  ? `${bm.streak.epsLaenge}× ${bm.streak.eps}`
                  : null
              }
            />
            <Kennzahl label="Umsatz Beat 12Q" wert={pct(bm?.agg12?.umsatzBeatRatePct, 0)} />
            <Kennzahl
              label="Umsatz-Streak"
              wert={
                bm?.streak?.umsatz && bm.streak.umsatzLaenge > 0
                  ? `${bm.streak.umsatzLaenge}× ${bm.streak.umsatz}`
                  : null
              }
            />
          </div>
        </PaCard>
      )}

      {sec && (
        <PaCard className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-white">
            SEC-Struktur {sec.berichtJahr ? `(10-K ${sec.berichtJahr})` : ''}
          </h3>
          {sec.segmentHinweis ? (
            <p className="text-xs text-[var(--app-text-muted)]">{sec.segmentHinweis}</p>
          ) : null}
          {sec.segmente.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead>
                  <tr className="text-[var(--app-text-muted)]">
                    <th className="pb-2 pr-3 font-medium">Segment</th>
                    <th className="pb-2 pr-3 font-medium">Umsatz (Mio.)</th>
                    <th className="pb-2 font-medium">Anteil</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.segmente.map((s) => (
                    <tr key={s.name} className="border-t border-[var(--app-border-strong)]/30">
                      <td className="py-1.5 pr-3 text-[var(--app-text)]">{s.name}</td>
                      <td className="py-1.5 pr-3 text-[var(--app-text-muted)]">
                        {s.umsatzMio != null ? s.umsatzMio.toLocaleString('de-DE') : '–'}
                      </td>
                      <td className="py-1.5 text-[var(--app-text-muted)]">
                        {s.anteilPct != null ? `${s.anteilPct} %` : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Kennzahl label="Pensionsverpflichtung" wert={sec.pensionVerpflichtungMio != null ? `$${sec.pensionVerpflichtungMio.toLocaleString('de-DE')} Mio.` : null} />
            <Kennzahl label="Lease-Verpflichtungen" wert={sec.leaseVerpflichtungMio != null ? `$${sec.leaseVerpflichtungMio.toLocaleString('de-DE')} Mio.` : null} />
            <Kennzahl
              label="CEO-Vergütung (Proxy)"
              wert={sec.ceoVerguetungUsd != null ? usdKompakt(sec.ceoVerguetungUsd) : null}
              hinweis={sec.proxyJahr ? `DEF 14A ${sec.proxyJahr}` : undefined}
            />
          </div>
        </PaCard>
      )}

      {eu && eu.kennzahlen.length > 0 && (
        <PaCard className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-white">EU-Kennzahlen (Marketscreener)</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {eu.kennzahlen.map((k) => (
              <Kennzahl key={k.label} label={k.label} wert={k.wert} />
            ))}
          </div>
        </PaCard>
      )}

      {(iv || ag) && (
        <PaCard className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-white">Markt-Stimmung & Kultur</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kennzahl
              label="Implizite Volatilität (ATM)"
              wert={pct(iv?.impliziteVolatilitaetPct)}
              hinweis={iv?.expiration ? `Expiry ${iv.expiration}` : undefined}
            />
            {ag?.glassdoor?.score != null ? (
              <Kennzahl
                label="Glassdoor (Unternehmen)"
                wert={`${ag.glassdoor.score} / 5`}
                hinweis={
                  ag.glassdoor.anzahlBewertungen != null
                    ? `${ag.glassdoor.anzahlBewertungen} Bewertungen`
                    : undefined
                }
              />
            ) : null}
            {ag?.glassdoorCeo?.zustimmungPct != null ? (
              <Kennzahl
                label={ag.glassdoorCeo.name ? `CEO: ${ag.glassdoorCeo.name}` : 'CEO-Zustimmung (Glassdoor)'}
                wert={`${ag.glassdoorCeo.zustimmungPct} %`}
                hinweis="befürworten den CEO"
              />
            ) : null}
            {ag?.kununu?.score != null ? (
              <Kennzahl
                label="Kununu-Score"
                wert={`${ag.kununu.score} / 5`}
                hinweis={
                  ag.kununu.anzahlBewertungen != null
                    ? `${ag.kununu.anzahlBewertungen} Bewertungen`
                    : undefined
                }
              />
            ) : null}
          </div>
          {(ag?.glassdoor?.url || ag?.kununu?.url) && (
            <div className="flex flex-wrap gap-3">
              {ag.glassdoor?.url ? (
                <a
                  href={ag.glassdoor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400/90 hover:underline"
                >
                  Glassdoor öffnen →
                </a>
              ) : null}
              {ag.kununu?.url ? (
                <a
                  href={ag.kununu.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400/90 hover:underline"
                >
                  Kununu öffnen →
                </a>
              ) : null}
            </div>
          )}
          {ag?.hinweis ? (
            <p className="text-[10px] text-[var(--app-text-muted)]">{ag.hinweis}</p>
          ) : null}
        </PaCard>
      )}

      <p className="text-[10px] text-[var(--app-text-muted)]">
        Quellen: Macrotrends Bilanz · DivvyDiary · Yahoo · Finviz · OpenInsider · SEC EDGAR · Marketscreener ·
        Options · Kununu/Glassdoor · Stand {new Date(erweitert.geladenAm).toLocaleString('de-DE')}
      </p>
    </div>
  )
}
