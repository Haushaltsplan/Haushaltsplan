/** Technische Chartanalyse — Indikatoren & Signale (Kurz- / Langfrist). */

export type KursBar = { datum: string; close: number }

export type FibLevel = {
  pct: number
  label: string
  preis: number
}

export type HandelsSignal = {
  typ: 'einstieg' | 'beobachten' | 'gewinnmitnahme' | 'risiko' | 'neutral'
  titel: string
  detail: string
  staerke: 'hoch' | 'mittel' | 'niedrig'
}

export type ChartanalyseHorizont = {
  zeitraumLabel: string
  trend: 'aufwaerts' | 'abwaerts' | 'seitwaerts'
  trendLabel: string
  rsi: number | null
  macd: 'bullish' | 'bearish' | 'neutral'
  preisVsEma200: 'darueber' | 'darunter' | 'n/a'
  goldenCross: boolean | null
  deathCross: boolean | null
  fibNaechsteUnterstuetzung: number | null
  fibNaechsterWiderstand: number | null
  bodenbildung: string | null
  signale: HandelsSignal[]
}

export type ChartanalyseErgebnis = {
  aktuellerKurs: number
  swingHoch: number
  swingTief: number
  fibonacci: FibLevel[]
  ema20: (number | null)[]
  ema50: (number | null)[]
  ema200: (number | null)[]
  bollinger: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] }
  rsi: (number | null)[]
  macdLinie: (number | null)[]
  macdSignal: (number | null)[]
  macdHist: (number | null)[]
  unterstuetzungen: number[]
  widerstaende: number[]
  kurzfristig: ChartanalyseHorizont
  langfristig: ChartanalyseHorizont
}

export function sma(werte: number[], periode: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < werte.length; i++) {
    if (i < periode - 1) {
      out.push(null)
      continue
    }
    let sum = 0
    for (let j = i - periode + 1; j <= i; j++) sum += werte[j]!
    out.push(sum / periode)
  }
  return out
}

export function ema(werte: number[], periode: number): (number | null)[] {
  const out: (number | null)[] = []
  const k = 2 / (periode + 1)
  let prev: number | null = null
  for (let i = 0; i < werte.length; i++) {
    const v = werte[i]!
    if (prev == null) {
      if (i < periode - 1) {
        out.push(null)
        continue
      }
      const start = werte.slice(0, periode)
      prev = start.reduce((a, b) => a + b, 0) / periode
      out.push(prev)
      continue
    }
    prev = v * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

export function rsi(werte: number[], periode = 14): (number | null)[] {
  const out: (number | null)[] = new Array(werte.length).fill(null)
  if (werte.length < periode + 1) return out

  let gain = 0
  let loss = 0
  for (let i = 1; i <= periode; i++) {
    const d = werte[i]! - werte[i - 1]!
    if (d >= 0) gain += d
    else loss -= d
  }
  let avgGain = gain / periode
  let avgLoss = loss / periode

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss
  out[periode] = 100 - 100 / (1 + rs0)

  for (let i = periode + 1; i < werte.length; i++) {
    const d = werte[i]! - werte[i - 1]!
    const g = d > 0 ? d : 0
    const l = d < 0 ? -d : 0
    avgGain = (avgGain * (periode - 1) + g) / periode
    avgLoss = (avgLoss * (periode - 1) + l) / periode
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    out[i] = 100 - 100 / (1 + rs)
  }
  return out
}

export function macd(
  werte: number[],
  fast = 12,
  slow = 26,
  signalPeriode = 9,
): { linie: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  const emaFast = ema(werte, fast)
  const emaSlow = ema(werte, slow)
  const linie: (number | null)[] = werte.map((_, i) => {
    const f = emaFast[i]
    const s = emaSlow[i]
    if (f == null || s == null) return null
    return f - s
  })
  const linieZahlen = linie.map((v) => v ?? 0)
  const signal = ema(linieZahlen, signalPeriode).map((v, i) => (linie[i] == null ? null : v))
  const hist = linie.map((m, i) => {
    const s = signal[i]
    if (m == null || s == null) return null
    return m - s
  })
  return { linie, signal, hist }
}

export function bollinger(
  werte: number[],
  periode = 20,
  mult = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(werte, periode)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  for (let i = 0; i < werte.length; i++) {
    const mid = middle[i]
    if (mid == null || i < periode - 1) {
      upper.push(null)
      lower.push(null)
      continue
    }
    let sumSq = 0
    for (let j = i - periode + 1; j <= i; j++) {
      const d = werte[j]! - mid
      sumSq += d * d
    }
    const std = Math.sqrt(sumSq / periode)
    upper.push(mid + mult * std)
    lower.push(mid - mult * std)
  }
  return { upper, middle, lower }
}

const FIB_RATIOS = [
  { pct: 0, label: '0 %' },
  { pct: 23.6, label: '23,6 %' },
  { pct: 38.2, label: '38,2 %' },
  { pct: 50, label: '50 %' },
  { pct: 61.8, label: '61,8 %' },
  { pct: 78.6, label: '78,6 %' },
  { pct: 100, label: '100 %' },
] as const

export function fibonacciVomSchwung(hoch: number, tief: number, aufwaerts: boolean): FibLevel[] {
  const span = hoch - tief
  return FIB_RATIOS.map(({ pct, label }) => {
    const preis = aufwaerts ? hoch - (span * pct) / 100 : tief + (span * pct) / 100
    return { pct, label, preis }
  })
}

function letzterWert<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i]!
  }
  return null
}

function findeSchwungInFenster(werte: number[], lookback = 3): { hoch: number; tief: number; hochIdx: number; tiefIdx: number } {
  let hoch = -Infinity
  let tief = Infinity
  let hochIdx = 0
  let tiefIdx = 0
  for (let i = lookback; i < werte.length - lookback; i++) {
    const v = werte[i]!
    let istHoch = true
    let istTief = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue
      if (werte[j]! >= v) istHoch = false
      if (werte[j]! <= v) istTief = false
    }
    if (istHoch && v > hoch) {
      hoch = v
      hochIdx = i
    }
    if (istTief && v < tief) {
      tief = v
      tiefIdx = i
    }
  }
  if (!Number.isFinite(hoch)) hoch = Math.max(...werte)
  if (!Number.isFinite(tief)) tief = Math.min(...werte)
  return { hoch, tief, hochIdx, tiefIdx }
}

function pivotLevels(werte: number[], fenster = 12): { unterstuetzungen: number[]; widerstaende: number[] } {
  const lows: number[] = []
  const highs: number[] = []
  for (let i = fenster; i < werte.length - fenster; i++) {
    const v = werte[i]!
    let minL = true
    let maxH = true
    for (let j = i - fenster; j <= i + fenster; j++) {
      if (j === i) continue
      if (werte[j]! <= v) minL = false
      if (werte[j]! >= v) maxH = false
    }
    if (minL) lows.push(v)
    if (maxH) highs.push(v)
  }
  const cluster = (arr: number[], tol = 0.015): number[] => {
    if (arr.length === 0) return []
    const sorted = [...arr].sort((a, b) => a - b)
    const groups: number[][] = [[sorted[0]!]]
    for (let i = 1; i < sorted.length; i++) {
      const g = groups[groups.length - 1]!
      const avg = g.reduce((a, b) => a + b, 0) / g.length
      if (Math.abs(sorted[i]! - avg) / avg <= tol) g.push(sorted[i]!)
      else groups.push([sorted[i]!])
    }
    return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length).slice(-4)
  }
  return { unterstuetzungen: cluster(lows), widerstaende: cluster(highs) }
}

function erkenneTrend(werte: number[]): 'aufwaerts' | 'abwaerts' | 'seitwaerts' {
  if (werte.length < 20) return 'seitwaerts'
  const drittel = Math.floor(werte.length / 3)
  const start = werte.slice(0, drittel)
  const end = werte.slice(-drittel)
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const diff = (avg(end) - avg(start)) / avg(start)
  if (diff > 0.04) return 'aufwaerts'
  if (diff < -0.04) return 'abwaerts'
  return 'seitwaerts'
}

function erkenneDoppelboden(werte: number[], toleranz = 0.025): string | null {
  if (werte.length < 40) return null
  const tail = werte.slice(-60)
  const min = Math.min(...tail)
  const tiefpunkte: number[] = []
  for (let i = 2; i < tail.length - 2; i++) {
    const v = tail[i]!
    if (v <= tail[i - 1]! && v <= tail[i - 2]! && v <= tail[i + 1]! && v <= tail[i + 2]!) {
      if (Math.abs(v - min) / min <= toleranz * 2) tiefpunkte.push(i)
    }
  }
  if (tiefpunkte.length >= 2) {
    const a = tiefpunkte[tiefpunkte.length - 2]!
    const b = tiefpunkte[tiefpunkte.length - 1]!
    if (b - a >= 8 && Math.abs(tail[a]! - tail[b]!) / tail[a]! <= toleranz) {
      return 'Mögliche Doppelboden-Formation im Verlauf der letzten Monate.'
    }
  }
  return null
}

function naechstesFibUnter(preis: number, levels: FibLevel[]): number | null {
  const unter = levels.filter((l) => l.preis < preis).sort((a, b) => b.preis - a.preis)
  return unter[0]?.preis ?? null
}

function naechstesFibUeber(preis: number, levels: FibLevel[]): number | null {
  const ueber = levels.filter((l) => l.preis > preis).sort((a, b) => a.preis - b.preis)
  return ueber[0]?.preis ?? null
}

function kreuzungVorher(
  schnell: (number | null)[],
  langsam: (number | null)[],
  lookback = 5,
): 'golden' | 'death' | null {
  const n = schnell.length
  for (let i = n - 1; i >= Math.max(1, n - lookback); i--) {
    const a0 = schnell[i - 1]
    const b0 = langsam[i - 1]
    const a1 = schnell[i]
    const b1 = langsam[i]
    if (a0 == null || b0 == null || a1 == null || b1 == null) continue
    if (a0 <= b0 && a1 > b1) return 'golden'
    if (a0 >= b0 && a1 < b1) return 'death'
  }
  return null
}

function baueSignale(opts: {
  preis: number
  rsiVal: number | null
  macdHist: number | null
  macdHistPrev: number | null
  trend: 'aufwaerts' | 'abwaerts' | 'seitwaerts'
  bbUpper: number | null
  bbLower: number | null
  ema200: number | null
  ema50: number | null
  fibSupport: number | null
  fibResist: number | null
  boden: string | null
  golden: boolean | null
  death: boolean | null
  kurz: boolean
}): HandelsSignal[] {
  const s: HandelsSignal[] = []
  const { preis, rsiVal, trend, kurz } = opts

  if (opts.boden) {
    s.push({ typ: 'einstieg', titel: 'Bodenbildung', detail: opts.boden, staerke: 'mittel' })
  }

  if (rsiVal != null) {
    if (rsiVal < 32) {
      s.push({
        typ: 'einstieg',
        titel: 'RSI überverkauft',
        detail: `RSI ${rsiVal.toFixed(0)} — kurzfristige Erholung möglich, wenn Trend intakt bleibt.`,
        staerke: kurz ? 'hoch' : 'mittel',
      })
    } else if (rsiVal > 72) {
      s.push({
        typ: 'gewinnmitnahme',
        titel: 'RSI überkauft',
        detail: `RSI ${rsiVal.toFixed(0)} — erhöhtes Risiko für Korrektur oder Seitwärtsphase.`,
        staerke: kurz ? 'hoch' : 'mittel',
      })
    }
  }

  if (opts.macdHist != null && opts.macdHistPrev != null) {
    if (opts.macdHistPrev < 0 && opts.macdHist > 0) {
      s.push({
        typ: 'einstieg',
        titel: 'MACD bullish',
        detail: 'MACD-Histogramm kreuzt nach oben — kurzfristiges Momentum dreht positiv.',
        staerke: 'mittel',
      })
    } else if (opts.macdHistPrev > 0 && opts.macdHist < 0) {
      s.push({
        typ: 'gewinnmitnahme',
        titel: 'MACD bearish',
        detail: 'MACD-Histogramm kreuzt nach unten — Momentum schwächt ab.',
        staerke: 'mittel',
      })
    }
  }

  if (opts.bbLower != null && preis <= opts.bbLower * 1.01) {
    s.push({
      typ: 'einstieg',
      titel: 'Unteres Bollinger-Band',
      detail: 'Kurs nahe/unter unterem Bollinger-Band — statistische Überverkauft-Zone.',
      staerke: 'niedrig',
    })
  }
  if (opts.bbUpper != null && preis >= opts.bbUpper * 0.99) {
    s.push({
      typ: 'gewinnmitnahme',
      titel: 'Oberes Bollinger-Band',
      detail: 'Kurs nahe/oben oberem Bollinger-Band — Take-Profit-Zone denkbar.',
      staerke: 'niedrig',
    })
  }

  if (!kurz && opts.ema200 != null) {
    if (preis > opts.ema200 && trend === 'aufwaerts') {
      s.push({
        typ: 'einstieg',
        titel: 'Langfrist-Trend intakt',
        detail: 'Kurs über EMA 200 bei Aufwärtstrend — klassisches Quality-Compounding-Setup.',
        staerke: 'hoch',
      })
    } else if (preis < opts.ema200 && trend === 'abwaerts') {
      s.push({
        typ: 'risiko',
        titel: 'Unter EMA 200',
        detail: 'Kurs unter 200-Tage-Linie bei Abwärtstrend — langfristige Schwäche.',
        staerke: 'hoch',
      })
    }
  }

  if (opts.golden) {
    s.push({
      typ: 'einstieg',
      titel: 'Golden Cross',
      detail: 'EMA 50 kreuzte kürzlich über EMA 200 — langfristiges Kaufsignal.',
      staerke: 'hoch',
    })
  }
  if (opts.death) {
    s.push({
      typ: 'risiko',
      titel: 'Death Cross',
      detail: 'EMA 50 kreuzte unter EMA 200 — langfristiges Verkaufssignal.',
      staerke: 'hoch',
    })
  }

  if (opts.fibSupport != null && Math.abs(preis - opts.fibSupport) / preis < 0.02) {
    s.push({
      typ: 'einstieg',
      titel: 'Fibonacci-Unterstützung',
      detail: `Kurs nahe Fib-Retracement bei ${opts.fibSupport.toFixed(2)} — potenzielle Kaufzone.`,
      staerke: 'mittel',
    })
  }
  if (opts.fibResist != null && Math.abs(preis - opts.fibResist) / preis < 0.02) {
    s.push({
      typ: 'gewinnmitnahme',
      titel: 'Fibonacci-Widerstand',
      detail: `Kurs nahe Fib-Level bei ${opts.fibResist.toFixed(2)} — Widerstand / Gewinnmitnahme.`,
      staerke: 'mittel',
    })
  }

  if (s.length === 0) {
    s.push({
      typ: 'beobachten',
      titel: 'Kein klares Signal',
      detail: 'Indikatoren weder eindeutig überkauft noch überverkauft — abwarten oder Positionsgröße halten.',
      staerke: 'niedrig',
    })
  }

  return s.slice(0, 6)
}

function horizontAusTeil(
  bars: KursBar[],
  zeitraumLabel: string,
  kurz: boolean,
  globalFib: FibLevel[],
): ChartanalyseHorizont {
  const closes = bars.map((b) => b.close)
  const preis = closes[closes.length - 1] ?? 0
  const rsiSerie = rsi(closes)
  const { hist, linie, signal } = macd(closes)
  const bb = bollinger(closes)
  const e50 = ema(closes, 50)
  const e200 = ema(closes, 200)
  const trend = erkenneTrend(closes)
  const rsiVal = letzterWert(rsiSerie)
  const histVal = letzterWert(hist)
  const histPrev = hist.length > 2 ? hist[hist.length - 2] : null
  const ema200Val = letzterWert(e200)
  const ema50Val = letzterWert(e50)
  const bbU = letzterWert(bb.upper)
  const bbL = letzterWert(bb.lower)
  const kreuz = kurz ? null : kreuzungVorher(e50, e200, 8)

  const macdState: 'bullish' | 'bearish' | 'neutral' =
    histVal == null ? 'neutral' : histVal > 0 ? 'bullish' : histVal < 0 ? 'bearish' : 'neutral'

  const trendLabel =
    trend === 'aufwaerts' ? 'Aufwärtstrend' : trend === 'abwaerts' ? 'Abwärtstrend' : 'Seitwärts / Übergang'

  return {
    zeitraumLabel,
    trend,
    trendLabel,
    rsi: rsiVal,
    macd: macdState,
    preisVsEma200: ema200Val == null ? 'n/a' : preis >= ema200Val ? 'darueber' : 'darunter',
    goldenCross: kreuz === 'golden',
    deathCross: kreuz === 'death',
    fibNaechsteUnterstuetzung: naechstesFibUnter(preis, globalFib),
    fibNaechsterWiderstand: naechstesFibUeber(preis, globalFib),
    bodenbildung: erkenneDoppelboden(closes),
    signale: baueSignale({
      preis,
      rsiVal,
      macdHist: histVal,
      macdHistPrev: histPrev,
      trend,
      bbUpper: bbU,
      bbLower: bbL,
      ema200: ema200Val,
      ema50: ema50Val,
      fibSupport: naechstesFibUnter(preis, globalFib),
      fibResist: naechstesFibUeber(preis, globalFib),
      boden: erkenneDoppelboden(closes),
      golden: kreuz === 'golden',
      death: kreuz === 'death',
      kurz,
    }),
  }
}

export function berechneChartanalyse(bars: KursBar[]): ChartanalyseErgebnis | null {
  if (bars.length < 30) return null

  const closes = bars.map((b) => b.close)
  const preis = closes[closes.length - 1]!
  const schwung = findeSchwungInFenster(closes, 4)
  const aufwaerts = schwung.hochIdx > schwung.tiefIdx
  const fib = fibonacciVomSchwung(schwung.hoch, schwung.tief, aufwaerts)
  const pivots = pivotLevels(closes)

  const kurzBars = bars.slice(-66)
  const langBars = bars
  const macdRes = macd(closes)

  return {
    aktuellerKurs: preis,
    swingHoch: schwung.hoch,
    swingTief: schwung.tief,
    fibonacci: fib,
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    ema200: ema(closes, 200),
    bollinger: bollinger(closes),
    rsi: rsi(closes),
    macdLinie: macdRes.linie,
    macdSignal: macdRes.signal,
    macdHist: macdRes.hist,
    unterstuetzungen: pivots.unterstuetzungen,
    widerstaende: pivots.widerstaende,
    kurzfristig: horizontAusTeil(kurzBars, '~3 Monate', true, fib),
    langfristig: horizontAusTeil(langBars, 'Gesamter Zeitraum', false, fib),
  }
}
