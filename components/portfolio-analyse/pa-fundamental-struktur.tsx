'use client'

import type { ReactNode } from 'react'
import { appTableScrollClassName } from '@/components/page-shell'
import { PaFundamentalCapitalAllocation } from '@/components/portfolio-analyse/pa-fundamental-capital-allocation'
import { PaFundamentalPeerVergleich } from '@/components/portfolio-analyse/pa-fundamental-peer-vergleich'
import { PaFundamentalInsider } from '@/components/portfolio-analyse/pa-fundamental-insider'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  PaStrukturHorizontalBars,
  PaStrukturKennzahl,
  PaStrukturOwnershipDonut,
  PaStrukturSectionHeader,
} from '@/components/portfolio-analyse/struktur/pa-struktur-visuals'
import { PaMsSegmentHistorieLoader } from '@/components/portfolio-analyse/struktur/pa-ms-segment-historie-loader'
import {
  baueBeatBalken,
  baueOwnershipSegmente,
  baueStrukturBilanzKennzahlen,
  pctFmt,
  strukturKmText,
  usdKompakt,
} from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'
import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function trendHinweis(delta: number | null, einheit: string): string | undefined {
  if (delta == null || Math.abs(delta) < 0.05) return undefined
  const pfeil = delta > 0 ? '↑' : '↓'
  return `${pfeil} ${Math.abs(delta).toLocaleString('de-DE')} ${einheit} vs. Vorjahr`
}

export function PaFundamentalStruktur({
  paket,
  ticker,
  symbolYahoo,
  isin,
  selectionKey,
}: {
  paket: FundamentaldatenPaket | null
  ticker: string
  symbolYahoo?: string | null
  isin?: string | null
  selectionKey?: string
}) {
  const erweitert = paket?.erweitert

  if (!paket?.ok) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Strukturdaten werden geladen …
      </PaCard>
    )
  }

  if (!erweitert) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Erweiterte Strukturdaten werden geladen …
      </PaCard>
    )
  }

  const ownership = baueOwnershipSegmente(erweitert)
  const beatBalken = baueBeatBalken(erweitert)
  const bilanz = baueStrukturBilanzKennzahlen(paket)

  const hatInhalt =
    ownership.length > 0 ||
    beatBalken.length > 0 ||
    erweitert.dividenden ||
    erweitert.holders ||
    erweitert.finviz ||
    erweitert.insiderNetto ||
    erweitert.beatMiss ||
    erweitert.secStruktur ||
    erweitert.secSegmentHistorie ||
    erweitert.euFundamental ||
    erweitert.optionsIv

  if (!hatInhalt) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Für diesen Titel konnten keine Strukturdaten geladen werden.
      </PaCard>
    )
  }

  const d = erweitert.dividenden
  const f = erweitert.finviz
  const ins = erweitert.insiderNetto
  const bm = erweitert.beatMiss
  const sec = erweitert.secStruktur
  const secHist = erweitert.secSegmentHistorie
  const eu = erweitert.euFundamental
  const iv = erweitert.optionsIv
  const ag = erweitert.arbeitgeber

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 ring-1 ring-white/[0.03] sm:p-5">
      <div className="grid gap-8 lg:grid-cols-2">
        <Sektion titel="Marktdaten" untertitel="Beta, Volatilität, Short Interest, Momentum">
          <div className="grid gap-2 sm:grid-cols-2">
            <PaStrukturKennzahl label="5-Jahres-Beta" wert={strukturKmText(paket, 'beta')} />
            <PaStrukturKennzahl label="Drawdown vs. 52W-Hoch" wert={pctFmt(bilanz.drawdown52wPct)} />
            <PaStrukturKennzahl
              label="Impl. Volatilität (ATM)"
              wert={pctFmt(iv?.impliziteVolatilitaetPct)}
              hinweis={iv?.expiration ? `Expiry ${iv.expiration}` : undefined}
            />
            <PaStrukturKennzahl label="Short Float" wert={pctFmt(f?.shortFloatPct)} />
            <PaStrukturKennzahl label="Days to Cover" wert={f?.shortRatio != null ? `${f.shortRatio} Tage` : null} />
            <PaStrukturKennzahl label="RSI (14)" wert={f?.rsi14?.toFixed(1) ?? null} />
            <PaStrukturKennzahl label="Rel. Volumen" wert={f?.relVolume != null ? `${f.relVolume.toFixed(2)}×` : null} />
            <PaStrukturKennzahl label="PEG (Finviz)" wert={f?.peg?.toFixed(2) ?? null} />
          </div>
        </Sektion>

        <Sektion titel="Eigentümerstruktur" untertitel="Yahoo Holders · Finviz Short Interest">
          <PaStrukturOwnershipDonut segmente={ownership} />
          <div className="grid gap-2 sm:grid-cols-2">
            <PaStrukturKennzahl
              label="Float"
              wert={
                erweitert.holders?.floatShares != null
                  ? `${(erweitert.holders.floatShares / 1e6).toFixed(1)} Mio. Aktien`
                  : strukturKmText(paket, 'float')
              }
            />
            <PaStrukturKennzahl label="Ausstehende Aktien" wert={strukturKmText(paket, 'shares_out')} />
          </div>
        </Sektion>
      </div>

      <Sektion
        titel="Kapitalstruktur & Bilanz"
        untertitel="Verschuldung, Working Capital, SBC — aus Macrotrends GuV/Bilanz/CF"
        klasse="mt-8"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <PaStrukturKennzahl label="Market Cap" wert={strukturKmText(paket, 'market_cap')} />
          <PaStrukturKennzahl label="Enterprise Value" wert={strukturKmText(paket, 'enterprise_value')} />
          <PaStrukturKennzahl label="Net Debt" wert={strukturKmText(paket, 'net_debt')} />
          <PaStrukturKennzahl
            label="Net Debt / EBITDA"
            wert={strukturKmText(paket, 'net_debt_ebitda')}
          />
          <PaStrukturKennzahl
            label="Netto-Cash (Bilanz)"
            wert={
              bilanz.nettoCashMio != null
                ? `${bilanz.nettoCashMio.toLocaleString('de-DE')} Mio. USD`
                : null
            }
          />
          <PaStrukturKennzahl
            label="Goodwill / Assets"
            wert={pctFmt(bilanz.goodwillAnteilPct)}
          />
          <PaStrukturKennzahl
            label="CapEx / D&A"
            wert={bilanz.capexDaRatio != null ? `${bilanz.capexDaRatio.toFixed(2)}×` : null}
          />
          <PaStrukturKennzahl
            label="SBC / |FCF|"
            wert={pctFmt(bilanz.sbcVsFcfPct)}
          />
          <PaStrukturKennzahl
            label="Zinsdeckung (EBIT/Zins)"
            wert={strukturKmText(paket, 'interest_coverage')}
          />
          <PaStrukturKennzahl
            label="DSO (Tage)"
            wert={bilanz.dsoAktuell?.toLocaleString('de-DE') ?? null}
            hinweis={trendHinweis(bilanz.dsoTrendDelta, 'Tage')}
          />
          <PaStrukturKennzahl
            label="DIO-Trend"
            wert={bilanz.dioTrendDelta != null ? `${bilanz.dioTrendDelta > 0 ? '+' : ''}${bilanz.dioTrendDelta} Tage` : null}
          />
          <PaStrukturKennzahl
            label="DPO-Trend"
            wert={bilanz.dpoTrendDelta != null ? `${bilanz.dpoTrendDelta > 0 ? '+' : ''}${bilanz.dpoTrendDelta} Tage` : null}
            hinweis={trendHinweis(bilanz.dpoTrendDelta, 'Tage')}
          />
          <PaStrukturKennzahl
            label="Aktienrückkäufe (FY)"
            wert={
              bilanz.aktienrueckkaufMio != null
                ? `${bilanz.aktienrueckkaufMio.toLocaleString('de-DE')} Mio. USD`
                : null
            }
          />
        </div>
      </Sektion>

      <Sektion titel="Geschäftsstruktur" klasse="mt-8">
        <PaMsSegmentHistorieLoader
          isin={isin}
          name={paket.firmenname}
          symbolYahoo={symbolYahoo ?? paket.symbolYahoo}
          ticker={ticker}
          initial={secHist}
          umsatzZeile={paket.zeilen.find((z) => z.id === 'umsatz') ?? null}
        />
      </Sektion>

      {sec &&
      (sec.pensionVerpflichtungMio != null || sec.leaseVerpflichtungMio != null || sec.ceoVerguetungUsd != null) ? (
        <Sektion
          titel={`SEC 10-K Zusatzdaten${sec.berichtJahr ? ` ${sec.berichtJahr}` : ''}`}
          untertitel="Pensionsverpflichtungen, Leases, CEO-Vergütung"
          klasse="mt-8"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <PaStrukturKennzahl
              label="Pensionsverpflichtung"
              wert={sec.pensionVerpflichtungMio != null ? `$${sec.pensionVerpflichtungMio.toLocaleString('de-DE')} Mio.` : null}
            />
            <PaStrukturKennzahl
              label="Lease-Verpflichtungen"
              wert={sec.leaseVerpflichtungMio != null ? `$${sec.leaseVerpflichtungMio.toLocaleString('de-DE')} Mio.` : null}
            />
            <PaStrukturKennzahl
              label="CEO-Vergütung (Proxy)"
              wert={usdKompakt(sec.ceoVerguetungUsd)}
              hinweis={sec.proxyJahr ? `DEF 14A ${sec.proxyJahr}` : undefined}
            />
          </div>
        </Sektion>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {(bm || ins) && (
          <Sektion titel="Earnings-Qualität & Insider" untertitel="Beat-Raten · Streaks · SEC/OpenInsider 90 Tage">
            {beatBalken.length > 0 ? (
              <div>
                <p className="mb-3 text-[11px] font-medium text-[var(--app-text-muted)]">Trefferquote (% Beat)</p>
                <PaStrukturHorizontalBars eintraege={beatBalken} />
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <PaStrukturKennzahl
                label="EPS-Streak"
                wert={
                  bm?.streak?.eps && bm.streak.epsLaenge > 0
                    ? `${bm.streak.epsLaenge}× ${bm.streak.eps}`
                    : null
                }
              />
              <PaStrukturKennzahl
                label="Umsatz-Streak"
                wert={
                  bm?.streak?.umsatz && bm.streak.umsatzLaenge > 0
                    ? `${bm.streak.umsatzLaenge}× ${bm.streak.umsatz}`
                    : null
                }
              />
              <PaStrukturKennzahl label="Insider-Käufe 90T" wert={ins?.kaeufe90d} />
              <PaStrukturKennzahl label="Insider-Verkäufe 90T" wert={ins?.verkaeufe90d} />
              <PaStrukturKennzahl label="Netto 90T" wert={usdKompakt(ins?.nettoWertUsd90d ?? null)} />
              <PaStrukturKennzahl
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
            </div>
          </Sektion>
        )}

        {d && (
          <Sektion titel="Dividenden-Stabilität" untertitel="DivvyDiary — Wachstum, Kontinuität, Ausschüttungsmuster">
            <div className="grid gap-2 sm:grid-cols-2">
              <PaStrukturKennzahl label="CAGR 5J" wert={pctFmt(d.cagr5yPct)} />
              <PaStrukturKennzahl label="CAGR 10J" wert={pctFmt(d.cagr10yPct)} />
              <PaStrukturKennzahl label="Ø Wachstum 3J" wert={pctFmt(d.durchschnittWachstum3yPct)} />
              <PaStrukturKennzahl
                label="Jahre ohne Senkung"
                wert={d.jahreOhneSenkung}
              />
              <PaStrukturKennzahl label="Letzte Senkung" wert={d.letzteSenkungJahr ?? 'keine erkannt'} />
              <PaStrukturKennzahl
                label="Letzte Dividende"
                wert={d.letzteDividendeUsd != null ? `$${d.letzteDividendeUsd.toFixed(4)}` : null}
              />
              <PaStrukturKennzahl label="Frequenz" wert={d.frequenz} />
              <PaStrukturKennzahl label="Zahlungen / Jahre" wert={`${d.anzahlZahlungen} / ${d.jahreMitDaten}`} />
              <PaStrukturKennzahl label="Ausschüttungsquote" wert={strukturKmText(paket, 'payout')} />
              <PaStrukturKennzahl label="Div-Rendite (LTM)" wert={strukturKmText(paket, 'div_yield')} />
            </div>
          </Sektion>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <PaFundamentalCapitalAllocation
          ticker={ticker}
          symbolYahoo={symbolYahoo}
          selectionKey={selectionKey}
          ohneRahmen
        />
        <PaFundamentalPeerVergleich ticker={ticker} isin={isin} ohneRahmen />
      </div>

      <Sektion titel="Insider-Transaktionen" untertitel="US: SEC Form 4 · EU: Directors Dealings" klasse="mt-8">
        <PaFundamentalInsider
          ticker={ticker}
          symbolYahoo={symbolYahoo}
          firmenname={paket.firmenname}
          isin={isin}
          selectionKey={selectionKey}
          ohneRahmen
        />
      </Sektion>

      {(eu?.kennzahlen.length || ag || iv) ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {eu && eu.kennzahlen.length > 0 ? (
            <Sektion titel="EU-Kennzahlen" untertitel="Marketscreener — Bewertung & Rentabilität">
              <div className={appTableScrollClassName}>
                <table className="app-data-table min-w-full text-left text-xs">
                  <tbody>
                    {eu.kennzahlen.map((k) => (
                      <tr key={k.label} className="border-t border-[var(--app-border)]/40 first:border-0">
                        <td className="py-2 pr-4 text-[var(--app-text-muted)]">{k.label}</td>
                        <td className="py-2 text-right font-medium tabular-nums text-[var(--app-text)]">{k.wert}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Sektion>
          ) : null}

          {(ag || iv) && (
            <Sektion titel="Unternehmenskultur & Stimmung" untertitel="Glassdoor · Kununu · Options-IV">
              <div className="grid gap-2 sm:grid-cols-2">
                {ag?.glassdoor?.score != null ? (
                  <PaStrukturKennzahl
                    label="Glassdoor"
                    wert={`${ag.glassdoor.score} / 5`}
                    hinweis={
                      ag.glassdoor.anzahlBewertungen != null
                        ? `${ag.glassdoor.anzahlBewertungen} Bewertungen`
                        : undefined
                    }
                  />
                ) : null}
                {ag?.glassdoorCeo?.zustimmungPct != null ? (
                  <PaStrukturKennzahl
                    label={ag.glassdoorCeo.name ? `CEO: ${ag.glassdoorCeo.name}` : 'CEO-Zustimmung'}
                    wert={`${ag.glassdoorCeo.zustimmungPct} %`}
                  />
                ) : null}
                {ag?.kununu?.score != null ? (
                  <PaStrukturKennzahl
                    label="Kununu"
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
                    <a href={ag.glassdoor.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:underline">
                      Glassdoor →
                    </a>
                  ) : null}
                  {ag.kununu?.url ? (
                    <a href={ag.kununu.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:underline">
                      Kununu →
                    </a>
                  ) : null}
                </div>
              )}
              {ag?.hinweis ? <p className="text-[10px] text-[var(--app-text-muted)]">{ag.hinweis}</p> : null}
            </Sektion>
          )}
        </div>
      ) : null}

      <QuellenFusszeile erweitert={erweitert} />
    </div>
  )
}

function Sektion({
  titel,
  untertitel,
  children,
  klasse = '',
}: {
  titel: string
  untertitel?: string
  children: ReactNode
  klasse?: string
}) {
  return (
    <section className={`space-y-3 ${klasse}`}>
      <PaStrukturSectionHeader titel={titel} untertitel={untertitel} />
      {children}
    </section>
  )
}

function QuellenFusszeile({ erweitert }: { erweitert: FundamentaldatenErweitert }) {
  return (
    <p className="text-[10px] leading-relaxed text-[var(--app-text-muted)]">
      Quellen: Macrotrends · Yahoo Finance · Finviz · SEC EDGAR · DivvyDiary · OpenInsider · Marketscreener ·
      Yahoo Options · Glassdoor/Kununu · Stand {new Date(erweitert.geladenAm).toLocaleString('de-DE')}
    </p>
  )
}
