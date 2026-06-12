/** Fließtext-Bericht aus Chartanalyse-Ergebnissen. */

import type { BodenMuster } from '@/lib/portfolio-analyse/chartanalyse-boden'
import type { ChartanalyseErgebnis } from '@/lib/portfolio-analyse/chartanalyse-engine'

export type ChartanalyseBericht = {
  zusammenfassung: string
  abschnitte: { titel: string; text: string }[]
}

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} %`
}

export function generiereChartanalyseBericht(
  analyse: ChartanalyseErgebnis,
  opts: {
    firmenname: string
    zeitraumLabel: string
    bodenMuster: BodenMuster[]
    bodenUrteil: { status: string; label: string; kurz: string }
  },
): ChartanalyseBericht {
  const { firmenname, zeitraumLabel, bodenMuster, bodenUrteil } = opts
  const k = analyse.kurzfristig
  const l = analyse.langfristig
  const preis = analyse.aktuellerKurs

  const rendite =
    analyse.renditeZeitraum != null ? pct(analyse.renditeZeitraum) : '—'
  const dd = analyse.maxDrawdown != null ? pct(analyse.maxDrawdown) : '—'
  const ddAkt = analyse.drawdownAktuell != null ? pct(analyse.drawdownAktuell) : '—'

  const zusammenfassung = [
    `${firmenname} notiert bei ${fmt(preis)} (${zeitraumLabel}: ${rendite}).`,
    `Langfristig dominiert ein ${l.trendLabel.toLowerCase()}; kurzfristig ${k.trendLabel.toLowerCase()}.`,
    bodenUrteil.status !== 'unwahrscheinlich'
      ? `Bodenbewertung: ${bodenUrteil.label}.`
      : `Eine ausgeprägte Bodenbildung ist derzeit nicht klar erkennbar.`,
  ].join(' ')

  const abschnitte: { titel: string; text: string }[] = []

  // Boden — prominent
  if (bodenMuster.length > 0) {
    const liste = bodenMuster
      .map((m) => `• ${m.titel} (${m.konfidenz}): ${m.beschreibung}`)
      .join('\n\n')
    abschnitte.push({
      titel: 'Bodenbildung & Umkehrmuster',
      text: `${bodenUrteil.kurz}\n\n${liste}${
        bodenMuster[0]?.zonenUnter != null
          ? `\n\nRelevante Kaufzone (technisch): ca. ${fmt(bodenMuster[0].zonenUnter!)}${
              bodenMuster[0].zonenOber != null ? ` – ${fmt(bodenMuster[0].zonenOber)}` : ''
            }. Ein nachhaltiger Boden gilt meist erst als bestätigt, wenn der Kurs über die Nackenlinie / das Zwischenhoch schließt.`
          : ''
      }`,
    })
  } else {
    abschnitte.push({
      titel: 'Bodenbildung',
      text: `${bodenUrteil.kurz} Beobachte RSI-Divergenzen, Doppel-Tiefs und höhere Tiefs, um einen Boden früh zu erkennen. Aktuell fehlen diese Signale in ausgeprägter Form.`,
    })
  }

  abschnitte.push({
    titel: 'Trend & Marktstruktur',
    text: [
      `Im gewählten Zeitraum bewegt sich der Titel in einem ${l.trendLabel.toLowerCase()}.`,
      l.preisVsEma200 === 'darueber'
        ? 'Der Kurs liegt über der 200-Tage-EMA — strukturell langfristig bullisch, sofern die Linie als Support hält.'
        : l.preisVsEma200 === 'darunter'
          ? 'Unter der 200-Tage-EMA bleibt das Bild langfristig schwach; Rückeroberung der Linie wäre ein erstes Stärkezeichen.'
          : 'Die 200-Tage-EMA ist für den gewählten Zeitraum noch nicht aussagekräftig.',
      l.goldenCross
        ? 'Kürzlich bildete sich ein Golden Cross (EMA 50 über EMA 200) — klassisches langfristiges Kaufsignal.'
        : l.deathCross
          ? 'Ein Death Cross (EMA 50 unter EMA 200) warnt vor anhaltender Schwäche.'
          : '',
      analyse.hoehereHochs && analyse.hoehereTiefs
        ? 'Marktstruktur: höhere Hochs und höhere Tiefs — gesunder Aufwärtstrend (Stage 2).'
        : analyse.tiefereHochs && analyse.tiefereTiefs
          ? 'Marktstruktur: tiefere Hochs und tiefere Tiefs — Abwärtstrend intakt.'
          : 'Die Marktstruktur ist gemischt oder seitwärts.',
    ]
      .filter(Boolean)
      .join(' '),
  })

  abschnitte.push({
    titel: 'Oszillatoren & Momentum',
    text: [
      k.rsi != null
        ? `RSI (14) steht bei ${k.rsi.toFixed(0)}${
            k.rsi < 30
              ? ' — überverkauft, kurzfristige Gegenbewegung möglich.'
              : k.rsi > 70
                ? ' — überkauft, Korrekturrisiko erhöht.'
                : ' — neutraler Bereich.'
          }`
        : '',
      `MACD-Histogramm ist ${k.macd === 'bullish' ? 'positiv (bullish)' : k.macd === 'bearish' ? 'negativ (bearish)' : 'neutral'}.`,
      analyse.macdKreuzung === 'bullish'
        ? 'Kürzlich kreuzte die MACD-Linie nach oben — Momentum-Wende.'
        : analyse.macdKreuzung === 'bearish'
          ? 'MACD bearish Cross — Momentum schwächt ab.'
          : '',
    ]
      .filter(Boolean)
      .join(' '),
  })

  const fibText = analyse.fibonacci
    .filter((f) => [38.2, 50, 61.8].includes(f.pct))
    .map((f) => `${f.label}: ${fmt(f.preis)}`)
    .join(', ')
  abschnitte.push({
    titel: 'Fibonacci & Levels',
    text: [
      `Aktueller Schwung: Hoch ${fmt(analyse.swingHoch)}, Tief ${fmt(analyse.swingTief)}.`,
      fibText ? `Wichtige Retracements: ${fibText}.` : '',
      k.fibNaechsteUnterstuetzung != null
        ? `Nächste Fib-Unterstützung unter dem Kurs: ${fmt(k.fibNaechsteUnterstuetzung)}.`
        : '',
      k.fibNaechsterWiderstand != null
        ? `Nächster Fib-Widerstand: ${fmt(k.fibNaechsterWiderstand)}.`
        : '',
      analyse.unterstuetzungen.length
        ? `Pivot-Unterstützungen: ${analyse.unterstuetzungen.map(fmt).join(', ')}.`
        : '',
      analyse.widerstaende.length
        ? `Pivot-Widerstände: ${analyse.widerstaende.map(fmt).join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  })

  abschnitte.push({
    titel: 'Risiko & Drawdown',
    text: `Maximaler Drawdown im Zeitraum: ${dd}. Aktuell ${ddAkt} unter dem Hoch. ${
      analyse.maxDrawdown != null && analyse.maxDrawdown < -25
        ? 'Deutliche Korrektur im Rückblick — für langfristige Investoren oft interessante Einstiegszonen, sofern Fundamentaldaten stimmen.'
        : 'Drawdown im normalen Korrekturbereich.'
    }`,
  })

  const einstieg: string[] = []
  const verkauf: string[] = []
  for (const s of [...k.signale, ...l.signale]) {
    if (s.typ === 'einstieg' && !einstieg.includes(s.titel)) einstieg.push(s.titel)
    if (s.typ === 'gewinnmitnahme' && !verkauf.includes(s.titel)) verkauf.push(s.titel)
  }

  abschnitte.push({
    titel: 'Handlungshinweise (technisch)',
    text: [
      '**Kurzfristig (Trading):**',
      einstieg.length
        ? `Beobachtete Einstiegshinweise: ${einstieg.slice(0, 4).join(', ')}.`
        : 'Keine starken kurzfristigen Einstiegssignale.',
      k.rsi != null && k.rsi < 35
        ? 'Überverkaufter RSI kann für antizyklische Trades genutzt werden — Stop unter letztem Tief.'
        : '',
      '',
      '**Langfristig (Investieren):**',
      l.trend === 'aufwaerts' && l.preisVsEma200 === 'darueber'
        ? 'Trendfolge-Setup intakt: Rücksetzer in Richtung EMA 50/200 oder Fib 38–61 % als Einstiegszonen.'
        : 'Erst Rückeroberung der EMA 200 und höhere Tiefs abwarten, bevor langfristig aufgestockt wird.',
      bodenUrteil.status === 'wahrscheinlich'
        ? 'Bodenmuster unterstützen einen antizyklischen Einstieg — Positionsaufbau in Tranchen empfohlen.'
        : '',
      verkauf.length
        ? `\n**Gewinnmitnahme / Risiko:** ${verkauf.slice(0, 3).join(', ')}.`
        : '',
    ]
      .filter((x) => x !== '')
      .join('\n'),
  })

  return { zusammenfassung, abschnitte }
}
