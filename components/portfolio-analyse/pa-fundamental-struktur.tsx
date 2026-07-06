'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { PaFundamentalCapitalAllocation } from '@/components/portfolio-analyse/pa-fundamental-capital-allocation'
import { PaFundamentalPeerVergleich } from '@/components/portfolio-analyse/pa-fundamental-peer-vergleich'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  PaStrukturHorizontalBars,
  PaStrukturKennzahl,
  PaStrukturOwnershipDonut,
  PaStrukturRisikoGauge,
  PaStrukturSectionHeader,
  PaStrukturSegmentDonut,
  PaStrukturSignalChips,
} from '@/components/portfolio-analyse/struktur/pa-struktur-visuals'
import { PaSecSegmentHistorie } from '@/components/portfolio-analyse/struktur/pa-sec-segment-historie'
import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import {
  baueBeatBalken,
  baueOwnershipSegmente,
  baueStrukturRisikoUebersicht,
  pctFmt,
  segmentFarben,
  strukturKmText,
  usdKompakt,
} from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function trendHinweis(delta: number | null, einheit: string, invertiert = false): string | undefined {
  if (delta == null || Math.abs(delta) < 0.05) return undefined
  const schlechter = invertiert ? delta < 0 : delta > 0
  const pfeil = delta > 0 ? '↑' : '↓'
  return `${pfeil} ${Math.abs(delta).toLocaleString('de-DE')} ${einheit} vs. Vorjahr${schlechter ? ' (Achtung)' : ''}`
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
        Struktur- & Risikodaten werden geladen …
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

  const uebersicht = baueStrukturRisikoUebersicht(paket)
  const ownership = baueOwnershipSegmente(erweitert)
  const beatBalken = baueBeatBalken(erweitert)
  const bilanz = uebersicht.bilanz

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
    erweitert.optionsIv ||
    uebersicht.signale.length > 0

  if (!hatInhalt) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Für diesen Titel konnten keine Struktur- & Risikodaten geladen werden.
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

  const segmentFarbenListe = segmentFarben(sec?.segmente.length ?? 0)
  const segmentDonut = (sec?.segmente ?? []).map((s, i) => ({
    name: s.name,
    anteilPct: s.anteilPct,
    farbe: segmentFarbenListe[i]!,
  }))

  const produktSeg = sec?.segmenteProdukt ?? []
  const geoSeg = sec?.segmenteGeo ?? []
  const produktFarben = segmentFarben(produktSeg.length)
  const geoFarben = segmentFarben(geoSeg.length)
  const produktDonut = produktSeg.map((s, i) => ({
    name: s.name,
    anteilPct: s.anteilPct,
    farbe: produktFarben[i]!,
  }))
  const geoDonut = geoSeg.map((s, i) => ({
    name: s.name,
    anteilPct: s.anteilPct,
    farbe: geoFarben[i]!,
  }))
  const hatBeideSegmente = produktSeg.length >= 2 && geoSeg.length >= 2

  const segmentTitel =
    sec?.segmentArt === 'geo'
      ? 'Geo'
      : sec?.segmentArt === 'produkt'
        ? 'Produkt'
        : 'Mix'

  return (
    <div className="space-y-5">
      {/* Risiko-Übersicht */}
      <PaCard variant="elevated" className="space-y-4 p-5 sm:p-6">
        <PaStrukturSectionHeader
          titel="Struktur- & Risiko-Score"
          untertitel={`${paket.firmenname} (${paket.ticker}) · Bilanz, Markt, Konzentration & Insider`}
        />
        <PaStrukturRisikoGauge
          score={uebersicht.score}
          label={uebersicht.scoreLabel}
          hinweis={uebersicht.scoreHinweis}
        />
        {uebersicht.signale.length > 0 ? (
          <div className="border-t border-[var(--app-border)]/60 pt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
              Risiko-Signale
            </p>
            <PaStrukturSignalChips signale={uebersicht.signale} />
          </div>
        ) : null}
      </PaCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Marktrisiko */}
        <PaCard variant="elevated" className="space-y-4 p-5">
          <PaStrukturSectionHeader
            titel="Marktrisiko & Liquidität"
            untertitel="Beta, Volatilität, Short Interest, Momentum"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <PaStrukturKennzahl label="5-Jahres-Beta" wert={strukturKmText(paket, 'beta')} />
            <PaStrukturKennzahl
              label="Drawdown vs. 52W-Hoch"
              wert={pctFmt(uebersicht.drawdown52wPct)}
              accent={uebersicht.drawdown52wPct != null && uebersicht.drawdown52wPct >= 25 ? 'amber' : undefined}
            />
            <PaStrukturKennzahl
              label="Impl. Volatilität (ATM)"
              wert={pctFmt(iv?.impliziteVolatilitaetPct)}
              hinweis={iv?.expiration ? `Expiry ${iv.expiration}` : undefined}
            />
            <PaStrukturKennzahl
              label="Short Float"
              wert={pctFmt(f?.shortFloatPct)}
              accent={f?.shortFloatPct != null && f.shortFloatPct >= 10 ? 'amber' : undefined}
            />
            <PaStrukturKennzahl
              label="Days to Cover"
              wert={f?.shortRatio != null ? `${f.shortRatio} Tage` : null}
            />
            <PaStrukturKennzahl label="RSI (14)" wert={f?.rsi14?.toFixed(1) ?? null} />
            <PaStrukturKennzahl
              label="Rel. Volumen"
              wert={f?.relVolume != null ? `${f.relVolume.toFixed(2)}×` : null}
            />
            <PaStrukturKennzahl label="PEG (Finviz)" wert={f?.peg?.toFixed(2) ?? null} />
          </div>
        </PaCard>

        {/* Eigentümerstruktur */}
        <PaCard variant="elevated" className="space-y-4 p-5">
          <PaStrukturSectionHeader
            titel="Eigentümerstruktur"
            untertitel="Yahoo Holders · Finviz Short Interest"
          />
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
        </PaCard>
      </div>

      {/* Kapitalstruktur & Bilanz */}
      <PaCard variant="elevated" className="space-y-4 p-5 sm:p-6">
        <PaStrukturSectionHeader
          titel="Kapitalstruktur & Bilanzqualität"
          untertitel="Verschuldung, Working Capital, SBC — aus Macrotrends GuV/Bilanz/CF"
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <PaStrukturKennzahl label="Market Cap" wert={strukturKmText(paket, 'market_cap')} />
          <PaStrukturKennzahl label="Enterprise Value" wert={strukturKmText(paket, 'enterprise_value')} />
          <PaStrukturKennzahl label="Net Debt" wert={strukturKmText(paket, 'net_debt')} />
          <PaStrukturKennzahl
            label="Net Debt / EBITDA"
            wert={strukturKmText(paket, 'net_debt_ebitda')}
            accent={bilanz.netDebtEbitda != null && bilanz.netDebtEbitda > 2.5 ? 'amber' : undefined}
          />
          <PaStrukturKennzahl
            label="Netto-Cash (Bilanz)"
            wert={
              bilanz.nettoCashMio != null
                ? `${bilanz.nettoCashMio.toLocaleString('de-DE')} Mio. USD`
                : null
            }
            accent={bilanz.nettoCashMio != null && bilanz.nettoCashMio < 0 ? 'amber' : 'emerald'}
          />
          <PaStrukturKennzahl
            label="Goodwill / Assets"
            wert={pctFmt(bilanz.goodwillAnteilPct)}
            accent={bilanz.goodwillAnteilPct != null && bilanz.goodwillAnteilPct >= 35 ? 'amber' : undefined}
          />
          <PaStrukturKennzahl
            label="CapEx / D&A"
            wert={bilanz.capexDaRatio != null ? `${bilanz.capexDaRatio.toFixed(2)}×` : null}
          />
          <PaStrukturKennzahl
            label="SBC / |FCF|"
            wert={pctFmt(bilanz.sbcVsFcfPct)}
            accent={bilanz.sbcVsFcfPct != null && bilanz.sbcVsFcfPct >= 20 ? 'amber' : undefined}
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
            accent={bilanz.dioTrendDelta != null && bilanz.dioTrendDelta >= 12 ? 'amber' : undefined}
          />
          <PaStrukturKennzahl
            label="DPO-Trend"
            wert={bilanz.dpoTrendDelta != null ? `${bilanz.dpoTrendDelta > 0 ? '+' : ''}${bilanz.dpoTrendDelta} Tage` : null}
            hinweis={trendHinweis(bilanz.dpoTrendDelta, 'Tage', true)}
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
      </PaCard>

      {/* SEC Segment-Historie (Geo + Produkt über Jahre) */}
      {secHist ? <PaSecSegmentHistorie paket={secHist} /> : null}

      {/* SEC Segmente (aktuellstes FY) */}
      {sec && (sec.segmente.length > 0 || sec.segmenteProdukt.length > 0 || sec.segmenteGeo.length > 0 || sec.pensionVerpflichtungMio != null) ? (
        <PaCard variant="elevated" className="space-y-4 p-5 sm:p-6">
          <PaStrukturSectionHeader
            titel={`Geschäftsstruktur (SEC 10-K${sec.berichtJahr ? ` ${sec.berichtJahr}` : ''})`}
            untertitel={sec.segmentHinweis ?? 'Segmente, Verbindlichkeiten & Vergütung aus SEC EDGAR'}
          />
          {uebersicht.segmentKonzentrationPct != null ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
              Größtes Segment: <strong>{uebersicht.segmentKonzentrationPct.toFixed(0)} %</strong> des Umsatzes
              {uebersicht.segmentKonzentrationPct >= 55 ? ' — erhöhtes Klumpenrisiko' : ''}
            </div>
          ) : null}

          {hatBeideSegmente ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
                  Geografie {sec.berichtJahr ?? ''}
                </p>
                <PaStrukturSegmentDonut segmente={geoDonut} titel="Geo" />
              </div>
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
                  Produkt {sec.berichtJahr ?? ''}
                </p>
                <PaStrukturSegmentDonut segmente={produktDonut} titel="Produkt" />
              </div>
            </div>
          ) : sec.segmente.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <PaStrukturSegmentDonut segmente={segmentDonut} titel={segmentTitel} />
              <div className={appTableScrollClassName}>
                <table className="app-data-table min-w-full text-left text-xs">
                  <thead className="text-[var(--app-text-muted)]">
                    <tr>
                      <th className="pb-2 pr-3 font-medium">Segment</th>
                      <th className="pb-2 pr-3 text-right font-medium">Umsatz (Mio.)</th>
                      <th className="pb-2 text-right font-medium">Anteil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.segmente.map((s, i) => (
                      <tr key={s.name} className="border-t border-[var(--app-border)]/40">
                        <td className="py-2 pr-3">
                          <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: segmentFarbenListe[i] }} />
                          <span className="text-[var(--app-text)]">{s.name}</span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[var(--app-text-muted)]">
                          {s.umsatzMio != null ? s.umsatzMio.toLocaleString('de-DE') : '–'}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium text-[var(--app-text)]">
                          {s.anteilPct != null ? `${s.anteilPct.toFixed(1)} %` : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {hatBeideSegmente ? (
            <div className={appTableScrollClassName}>
              <table className="app-data-table min-w-full text-left text-xs">
                <thead className="text-[var(--app-text-muted)]">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Segment</th>
                    <th className="pb-2 pr-3 text-right font-medium">Typ</th>
                    <th className="pb-2 pr-3 text-right font-medium">Umsatz (Mio.)</th>
                    <th className="pb-2 text-right font-medium">Anteil</th>
                  </tr>
                </thead>
                <tbody>
                  {geoSeg.map((s, i) => (
                    <tr key={`geo-${s.name}`} className="border-t border-[var(--app-border)]/40">
                      <td className="py-2 pr-3">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: geoFarben[i] }} />
                        {s.name}
                      </td>
                      <td className="py-2 pr-3 text-right text-[var(--app-text-muted)]">Geo</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.umsatzMio?.toLocaleString('de-DE') ?? '–'}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{s.anteilPct != null ? `${s.anteilPct.toFixed(1)} %` : '–'}</td>
                    </tr>
                  ))}
                  {produktSeg.map((s, i) => (
                    <tr key={`prod-${s.name}`} className="border-t border-[var(--app-border)]/40">
                      <td className="py-2 pr-3">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: produktFarben[i] }} />
                        {s.name}
                      </td>
                      <td className="py-2 pr-3 text-right text-[var(--app-text-muted)]">Produkt</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.umsatzMio?.toLocaleString('de-DE') ?? '–'}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{s.anteilPct != null ? `${s.anteilPct.toFixed(1)} %` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

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
        </PaCard>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Earnings & Insider */}
        {(bm || ins) && (
          <PaCard variant="elevated" className="space-y-4 p-5">
            <PaStrukturSectionHeader
              titel="Earnings-Qualität & Insider"
              untertitel="Beat-Raten · Streaks · SEC/OpenInsider 90 Tage"
            />
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
                accent={ins?.nettoRichtung === 'kauf' ? 'emerald' : ins?.nettoRichtung === 'verkauf' ? 'amber' : undefined}
              />
            </div>
          </PaCard>
        )}

        {/* Dividenden-Stabilität */}
        {d && (
          <PaCard variant="elevated" className="space-y-4 p-5">
            <PaStrukturSectionHeader
              titel="Dividenden-Stabilität"
              untertitel="DivvyDiary — Wachstum, Kontinuität, Ausschüttungsmuster"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <PaStrukturKennzahl label="CAGR 5J" wert={pctFmt(d.cagr5yPct)} accent="emerald" />
              <PaStrukturKennzahl label="CAGR 10J" wert={pctFmt(d.cagr10yPct)} />
              <PaStrukturKennzahl label="Ø Wachstum 3J" wert={pctFmt(d.durchschnittWachstum3yPct)} />
              <PaStrukturKennzahl
                label="Jahre ohne Senkung"
                wert={d.jahreOhneSenkung}
                accent={d.jahreOhneSenkung != null && d.jahreOhneSenkung >= 10 ? 'emerald' : undefined}
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
          </PaCard>
        )}
      </div>

      {/* Capital Allocation + Peer */}
      <div className="grid gap-5 lg:grid-cols-2">
        <PaFundamentalCapitalAllocation
          ticker={ticker}
          symbolYahoo={symbolYahoo}
          selectionKey={selectionKey}
        />
        <PaFundamentalPeerVergleich ticker={ticker} isin={isin} />
      </div>

      {/* EU + Kultur */}
      {(eu?.kennzahlen.length || ag || iv) ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {eu && eu.kennzahlen.length > 0 ? (
            <PaCard variant="elevated" className="space-y-4 p-5">
              <PaStrukturSectionHeader titel="EU-Kennzahlen" untertitel="Marketscreener — Bewertung & Rentabilität" />
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
            </PaCard>
          ) : null}

          {(ag || iv) && (
            <PaCard variant="elevated" className="space-y-4 p-5">
              <PaStrukturSectionHeader titel="Unternehmenskultur & Stimmung" untertitel="Glassdoor · Kununu · Options-IV" />
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
            </PaCard>
          )}
        </div>
      ) : null}

      <QuellenFusszeile erweitert={erweitert} />
    </div>
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
