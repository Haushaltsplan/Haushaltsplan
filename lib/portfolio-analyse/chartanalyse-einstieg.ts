/** Konkreter Langfrist-Einstiegsplan mit Kurslevels. */

import type { BodenMuster } from '@/lib/portfolio-analyse/chartanalyse-boden'
import type { ChartanalyseErgebnis, FibLevel } from '@/lib/portfolio-analyse/chartanalyse-engine'

export type EinstiegsTranche = {
  anteil: string
  kurs: number
  typ: 'market' | 'limit'
  begruendung: string
}

export type LangfristEinstiegsplan = {
  strategie: 'sofort_tranchen' | 'limit_only' | 'abwarten'
  strategieLabel: string
  tranchen: EinstiegsTranche[]
  stopLoss: number | null
  stopBegruendung: string
  bestaetigung: string
  fließtext: string
}

function letzterWert(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i]!
  }
  return null
}

function rundeKurs(k: number): number {
  if (k >= 500) return Math.round(k)
  if (k >= 100) return Math.round(k * 10) / 10
  if (k >= 10) return Math.round(k * 100) / 100
  return Math.round(k * 1000) / 1000
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function fibBei(fibs: FibLevel[], pct: number): number | null {
  return fibs.find((f) => f.pct === pct)?.preis ?? null
}

function naechsteUnterstuetzung(preis: number, levels: number[]): number | null {
  const unter = levels.filter((l) => l < preis * 0.995).sort((a, b) => b - a)
  return unter[0] ?? null
}

function uniqueSorted(levels: number[]): number[] {
  return [...new Set(levels.map(rundeKurs))].sort((a, b) => b - a)
}

export function berechneLangfristEinstiegsplan(
  analyse: ChartanalyseErgebnis,
  bodenMuster: BodenMuster[],
): LangfristEinstiegsplan {
  const preis = analyse.aktuellerKurs
  const l = analyse.langfristig
  const ema50 = letzterWert(analyse.ema50)
  const ema200 = letzterWert(analyse.ema200)
  const fib382 = fibBei(analyse.fibonacci, 38.2)
  const fib50 = fibBei(analyse.fibonacci, 50)
  const fib618 = fibBei(analyse.fibonacci, 61.8)
  const pivotSupport = naechsteUnterstuetzung(preis, analyse.unterstuetzungen)
  const boden = bodenMuster[0]
  const bodenUnten = boden?.zonenUnter != null ? rundeKurs(boden.zonenUnter) : null
  const swingTief = rundeKurs(analyse.swingTief)

  const stopLoss = rundeKurs(
    bodenUnten != null ? bodenUnten * 0.96 : swingTief * 0.97,
  )
  const stopBegruendung =
    bodenUnten != null
      ? `ca. 4 % unter der Boden-Unterkante (${fmt(bodenUnten)})`
      : `ca. 3 % unter dem relevanten Schwungtief (${fmt(swingTief)})`

  const bestaetigung =
    ema200 != null
      ? `Langfristige Bestätigung: Wochenschluss über ${fmt(rundeKurs(ema200))} (EMA 200) und erneut höheres Tief.`
      : boden?.zonenOber != null
        ? `Bestätigung: Ausbruch über ${fmt(rundeKurs(boden.zonenOber))} (Muster-Nackenlinie / Zwischenhoch).`
        : `Bestätigung: Schluss über dem letzten relevanten Hoch bei ${fmt(rundeKurs(analyse.swingHoch))}.`

  const tranchen: EinstiegsTranche[] = []
  let strategie: LangfristEinstiegsplan['strategie'] = 'sofort_tranchen'
  let strategieLabel = 'Gestaffelter Einstieg (Trend intakt)'

  const bullisch = l.trend === 'aufwaerts' && l.preisVsEma200 === 'darueber'
  const schwach = l.preisVsEma200 === 'darunter' || l.trend === 'abwaerts'
  const bodenStark = analyse.bodenUrteil.status === 'wahrscheinlich'

  if (bullisch && !schwach) {
    tranchen.push({
      anteil: '40 %',
      kurs: rundeKurs(preis),
      typ: 'market',
      begruendung: 'Trend und EMA 200 intakt — Kernposition zum aktuellen Kurs.',
    })
    if (ema50 != null && ema50 < preis * 0.995) {
      tranchen.push({
        anteil: '35 %',
        kurs: rundeKurs(ema50),
        typ: 'limit',
        begruendung: 'Limit an der 50-Tage-EMA — typischer Rücksetzer im Aufwärtstrend.',
      })
    } else if (fib382 != null && fib382 < preis) {
      tranchen.push({
        anteil: '35 %',
        kurs: rundeKurs(fib382),
        typ: 'limit',
        begruendung: 'Limit am Fibonacci 38,2 %-Retracement des aktuellen Schwungs.',
      })
    }
    const dritte =
      fib50 != null && fib50 < preis
        ? rundeKurs(fib50)
        : ema200 != null
          ? rundeKurs(ema200)
          : pivotSupport != null
            ? rundeKurs(pivotSupport)
            : rundeKurs(preis * 0.92)
    tranchen.push({
      anteil: '25 %',
      kurs: dritte,
      typ: 'limit',
      begruendung:
        dritte === rundeKurs(fib50 ?? 0)
          ? 'Tieferes Limit an Fib 50 % — für stärkere Korrektur.'
          : ema200 != null && dritte === rundeKurs(ema200)
            ? 'Tieferes Limit an der 200-Tage-EMA — langfristiger dynamischer Support.'
            : 'Tieferes Limit an der nächsten Pivot-Unterstützung.',
    })
  } else if (bodenStark || boden != null) {
    strategie = 'limit_only'
    strategieLabel = 'Antizyklisch an der Bodenzone (Limit-Orders)'

    const zoneMitte =
      bodenUnten != null && boden.zonenOber != null
        ? rundeKurs((bodenUnten + boden.zonenOber) / 2)
        : rundeKurs(preis)

    if (preis <= (boden?.zonenOber ?? preis * 1.02)) {
      tranchen.push({
        anteil: '35 %',
        kurs: rundeKurs(preis),
        typ: 'market',
        begruendung: 'Kurs bereits in der Bodenzone — erste Tranche jetzt.',
      })
    }
    tranchen.push({
      anteil: tranchen.length ? '35 %' : '40 %',
      kurs: bodenUnten ?? swingTief,
      typ: 'limit',
      begruendung: `Limit an der Boden-Unterkante / Muster-Support (${boden?.titel ?? 'Schwungtief'}).`,
    })
    tranchen.push({
      anteil: '30 %',
      kurs:
        ema200 != null && ema200 < preis
          ? rundeKurs(ema200)
          : fib618 != null
            ? rundeKurs(fib618)
            : rundeKurs((bodenUnten ?? swingTief) * 0.97),
      typ: 'limit',
      begruendung: 'Reserve-Limit für tieferen Rücklauf (EMA 200 oder Fib 61,8 %).',
    })
  } else if (schwach) {
    strategie = 'abwarten'
    strategieLabel = 'Abwarten — erst bei klaren Support-Levels einsteigen'

    const erste =
      ema200 != null ? rundeKurs(ema200) : pivotSupport != null ? rundeKurs(pivotSupport) : swingTief
    tranchen.push({
      anteil: '30 %',
      kurs: erste,
      typ: 'limit',
      begruendung: 'Erste Tranche nur an der 200-Tage-EMA bzw. stärkster Pivot-Unterstützung — nicht am aktuellen Kurs kaufen.',
    })
    const zweite =
      fib618 != null ? rundeKurs(fib618) : fib50 != null ? rundeKurs(fib50) : rundeKurs(erste * 0.95)
    tranchen.push({
      anteil: '40 %',
      kurs: zweite,
      typ: 'limit',
      begruendung: 'Haupt-Limit an Fib 61,8 % / 50 % — klassische antizyklische Zone nach Korrektur.',
    })
    tranchen.push({
      anteil: '30 %',
      kurs: swingTief,
      typ: 'limit',
      begruendung: `Notfall-Limit am Schwungtief ${fmt(swingTief)} falls die Korrektur weitergeht.`,
    })
  } else {
    strategie = 'sofort_tranchen'
    strategieLabel = 'Vorsichtig gestaffelt (seitwärts / unklar)'

    tranchen.push({
      anteil: '30 %',
      kurs: rundeKurs(preis),
      typ: 'market',
      begruendung: 'Kleine Starter-Position — Markt ist nicht eindeutig trendstark.',
    })
    const limit1 =
      pivotSupport != null
        ? rundeKurs(pivotSupport)
        : fib382 != null
          ? rundeKurs(fib382)
          : ema50 != null
            ? rundeKurs(ema50)
            : rundeKurs(preis * 0.95)
    tranchen.push({
      anteil: '40 %',
      kurs: limit1,
      typ: 'limit',
      begruendung: 'Haupt-Limit an nächster technischer Unterstützung unter dem Kurs.',
    })
    tranchen.push({
      anteil: '30 %',
      kurs: fib50 != null ? rundeKurs(fib50) : swingTief,
      typ: 'limit',
      begruendung: 'Tieferes Limit für breitere Korrektur.',
    })
  }

  const levels = uniqueSorted(tranchen.map((t) => t.kurs))
  const tranchenText = tranchen
    .map(
      (t, i) =>
        `**Tranche ${i + 1} (${t.anteil}):** ${t.typ === 'market' ? 'Kauf zum aktuellen Kurs' : 'Limit-Order bei'} **${fmt(t.kurs)}** — ${t.begruendung}`,
    )
    .join('\n')

  const fließtext = [
    `**Mein Vorgehen bei einer langfristigen Investition (${strategieLabel}):**`,
    '',
    `Aktueller Kurs: **${fmt(preis)}**. Ich würde ${strategie === 'abwarten' ? 'am aktuellen Kurs nicht einsteigen' : 'nicht alles auf einmal kaufen'}, sondern in ${tranchen.length} Tranchen aufteilen:`,
    '',
    tranchenText,
    '',
    `**Stop-Loss / Invalidierung:** ${fmt(stopLoss)} (${stopBegruendung}). Unter diesem Level wäre das technische Bild gebrochen.`,
    '',
    `**${bestaetigung}**`,
    '',
    levels.length > 1
      ? `Gewichteter Durchschnittskurs bei vollständiger Ausführung aller Limits: ca. **${fmt(levels.reduce((a, b) => a + b, 0) / levels.length)}** (vereinfachte Schätzung).`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    strategie,
    strategieLabel,
    tranchen,
    stopLoss,
    stopBegruendung,
    bestaetigung,
    fließtext,
  }
}
