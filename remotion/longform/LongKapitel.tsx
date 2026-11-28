/** Who owns it, Valuation, Risiken, Scorecard, Would I buy. Eine Zahl pro Satz, Besitz als Torte. */
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion'
import { dollarImText } from '../../lib/youtube/longform/longform-format'
import { Blende, ein, satzLaeufe, type SatzLauf, type SzeneProps } from './long-bausteine'
import { besitzBereit, LongBesitz } from './LongBesitz'
import { LONG_DISPLAY, LONG_GRUEN, LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_ROT, LONG_SERIF, LONG_TEXT } from './long-look'

function faktDesSatzes(sp: SzeneProps, index: number) {
  const id = sp.p.saetze[index]?.faktIds.find((x) => sp.p.fakten[x])
  return id ? { id, ...sp.p.fakten[id]! } : null
}

function FarbeZahl({ text, wert }: { text: string; wert: number | null }) {
  const farbe = wert != null && wert < 0 ? LONG_ROT : text.includes('%') || text.includes('x') ? (wert != null && wert < 0 ? LONG_ROT : LONG_GRUEN) : LONG_TEXT
  const gruen = wert == null || wert >= 0
  return <span style={{ color: text.trim().startsWith('-') || !gruen ? LONG_ROT : farbe }}>{text}</span>
}

function GrosseZahl({ label, text, wert }: { label: string; text: string; wert: number | null }) {
  const frame = useCurrentFrame()
  const anzeige = dollarImText(text, wert)
  const schrift = anzeige.length > 18 ? 72 : anzeige.length > 12 ? 96 : 128
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
      <div style={{ textAlign: 'center', opacity: ein(frame, 0, 10), maxWidth: 1500 }}>
        <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_MUTED }}>{label.toUpperCase()}</div>
        <div style={{ marginTop: 18, fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: schrift, lineHeight: 0.95, color: LONG_TEXT }}>
          <FarbeZahl text={anzeige} wert={wert} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

function Risiko({ text }: { text: string }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 160, paddingRight: 160 }}>
      <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_ROT, opacity: ein(frame, 0, 8) }}>WHAT COULD GO WRONG</div>
      <div style={{ marginTop: 28, maxWidth: 1500, fontFamily: LONG_SERIF, fontSize: 64, lineHeight: 1.2, color: LONG_TEXT, opacity: ein(frame, 4, 12) }}>{text}</div>
    </AbsoluteFill>
  )
}

function risikoIstZahl(text: string, wert: number | null): boolean {
  const woerter = text.trim().split(/\s+/).filter(Boolean)
  return wert != null && Number.isFinite(wert) && woerter.length > 0 && woerter.length <= 4
}

function RisikoTafel({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const jetzt = sp.block.from + lauf.from + frame
  const gesehen = new Set<string>()
  const karten: { id: string; label: string; text: string; wert: number | null; zahl: boolean; ab: number }[] = []
  let aktiv = ''
  for (let i = 0; i < sp.p.saetze.length; i++) {
    const s = sp.p.saetze[i]
    const z = sp.t.saetze[i]
    if (!s || !z || s.abschnittId !== sp.block.abschnittId || s.visual.szene !== 'risiko_karte') continue
    const id = s.faktIds.find((x) => sp.p.fakten[x])
    const fakt = id ? sp.p.fakten[id] : null
    if (!id || !fakt || gesehen.has(id)) continue
    gesehen.add(id)
    const text = dollarImText(fakt.text, fakt.wert)
    karten.push({ id, label: fakt.label, text, wert: fakt.wert, zahl: risikoIstZahl(fakt.text, fakt.wert), ab: z.from })
    if (z.from <= jetzt + 1) aktiv = id
  }
  if (!karten.length) return <Risiko text={sp.p.saetze[lauf.saetze[0]!]?.text ?? ''} />
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 80, paddingRight: 80 }}>
      <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_ROT, marginBottom: 36 }}>WHAT COULD GO WRONG</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'stretch', justifyContent: 'center', maxWidth: 1680 }}>
        {karten.map((k) => {
          const gesprochen = k.ab <= jetzt + 1
          const istAktiv = k.id === aktiv
          return (
            <div
              key={k.id}
              style={{
                flex: k.zahl ? '0 0 360px' : '1 1 460px',
                maxWidth: k.zahl ? 420 : 760,
                padding: '28px 32px',
                borderRadius: 24,
                background: 'rgba(243,241,236,0.04)',
                border: istAktiv ? `2px solid ${sp.p.varianten.akzent}` : '2px solid transparent',
                opacity: gesprochen ? 1 : 0.28,
                boxSizing: 'border-box',
              }}
            >
              {k.zahl ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 92, lineHeight: 0.95, color: LONG_TEXT }}>{k.text}</div>
                  <div style={{ marginTop: 16, fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 1.4, color: LONG_MUTED }}>{k.label.toUpperCase()}</div>
                </div>
              ) : (
                <div style={{ fontFamily: LONG_SERIF, fontSize: 36, lineHeight: 1.3, color: LONG_TEXT }}>{k.text}</div>
              )}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

const SCORE_TITEL: Record<string, string> = {
  'dividend yield': 'dividendenertrag',
  'dividend growth': 'dividendenwachstum',
  'earnings growth': 'gewinnwachstum',
  moat: 'burggraben',
}

const SCORE_REIHE = 1760
const SCORE_LUECKE = 28

function scoreFokus(satz: { visual: { fokus?: string | null }; faktIds: string[] } | undefined): string {
  return (satz?.visual.fokus ?? satz?.faktIds.find((id) => id.startsWith('sc.'))?.slice(3) ?? '').toLowerCase()
}

function scorePasst(titel: string, fokus: string): boolean {
  const t = titel.toLowerCase()
  return Boolean(fokus) && (SCORE_TITEL[t] === fokus || t === fokus)
}

/** Halt in der Reihe, dann heran, am Ende zurück. Kurze Spalten stauchen die Zeiten. */
function scoreTakt(start: number, ende: number) {
  const laenge = Math.max(1, ende - start)
  let halt = Math.min(15, Math.floor(laenge * 0.34))
  let rein = Math.min(12, Math.floor(laenge * 0.28))
  let raus = Math.min(12, Math.floor(laenge * 0.22))
  if (halt + rein + raus > laenge - 4) {
    const frei = Math.max(0, laenge - 4)
    halt = Math.min(15, Math.floor(frei * 0.45))
    rein = Math.min(12, Math.floor(frei * 0.3))
    raus = Math.max(0, frei - halt - rein)
  }
  return { auf: start + halt, reinEnde: start + halt + rein, rausStart: ende - raus, ende }
}

function scoreZoom(frame: number, takt: { auf: number; reinEnde: number; rausStart: number; ende: number }): number {
  if (frame < takt.auf) return 0
  if (frame < takt.reinEnde) return (frame - takt.auf) / Math.max(1, takt.reinEnde - takt.auf)
  if (frame < takt.rausStart) return 1
  if (frame < takt.ende) return 1 - (frame - takt.rausStart) / Math.max(1, takt.ende - takt.rausStart)
  return 0
}

function Scorecard({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const spalten = sp.p.scorecard ?? []
  const satz = sp.p.saetze[lauf.saetze[0]!]
  if (!spalten.length) return <Risiko text={satz?.text ?? ''} />
  const basis = sp.block.from + lauf.from
  const gruppen: { id: string; index: number; start: number; ende: number }[] = []
  for (let i = 0; i < sp.p.saetze.length; i++) {
    const s = sp.p.saetze[i]
    const z = sp.t.saetze[i]
    if (!s || !z || s.abschnittId !== sp.block.abschnittId || s.visual.szene !== 'scorecard_spalten') continue
    const fokus = scoreFokus(s)
    const index = spalten.findIndex((col) => scorePasst(col.titel, fokus))
    if (index < 0) continue
    const id = SCORE_TITEL[spalten[index]!.titel.toLowerCase()] ?? spalten[index]!.titel.toLowerCase()
    const start = z.from - basis
    const ende = start + z.dauer
    const letzte = gruppen[gruppen.length - 1]
    if (letzte && letzte.id === id) letzte.ende = ende
    else gruppen.push({ id, index, start, ende })
  }
  let zoom = 0
  let ziel = -1
  const offen = new Set<string>()
  for (const g of gruppen) {
    const takt = scoreTakt(g.start, g.ende)
    if (frame >= takt.auf) offen.add(g.id)
    const stand = scoreZoom(frame, takt)
    if (stand >= zoom) {
      zoom = stand
      ziel = g.index
    }
  }
  const n = spalten.length
  const breite = (SCORE_REIHE - SCORE_LUECKE * (n - 1)) / n
  const mitte = ziel < 0 ? SCORE_REIHE / 2 : ziel * (breite + SCORE_LUECKE) + breite / 2
  const schub = (SCORE_REIHE / 2 - mitte) * zoom
  const skala = 1 + zoom * 1.12
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          gap: SCORE_LUECKE,
          width: SCORE_REIHE,
          transform: `translateX(${schub}px) scale(${skala})`,
          transformOrigin: `${mitte}px 50%`,
        }}
      >
        {spalten.map((s, i) => {
          const id = SCORE_TITEL[s.titel.toLowerCase()] ?? s.titel.toLowerCase()
          const erste = gruppen.find((g) => g.id === id)
          const zahlAuf = erste && offen.has(id) ? ein(frame, scoreTakt(erste.start, erste.ende).auf, 10) : 0
          const weg = i === ziel ? 1 : 1 - zoom
          return (
            <div
              key={s.titel}
              style={{
                width: breite,
                flexShrink: 0,
                padding: 28,
                borderRadius: 24,
                background: 'rgba(243,241,236,0.04)',
                outline: i === ziel && zoom > 0.35 ? `2px solid ${sp.p.varianten.akzent}` : '2px solid transparent',
                opacity: ein(frame, i * 3, 12) * weg,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>{s.titel.toUpperCase()}</div>
              <div style={{ marginTop: 12, height: 96, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 84, lineHeight: 1, color: LONG_TEXT, opacity: 1 - zahlAuf }}>?</div>
                <div style={{ position: 'absolute', inset: 0, fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 84, lineHeight: 1, color: LONG_TEXT, opacity: zahlAuf }}>
                  {s.score ?? '–'}
                </div>
              </div>
              {s.balken.slice(0, 4).map((b) => (
                <div key={b.label} style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LONG_MONO, fontSize: 14, color: LONG_MUTED }}>
                    <span>{b.label}</span>
                    <span>{b.wertText}</span>
                  </div>
                  <div style={{ marginTop: 6, height: 8, borderRadius: 4, background: 'rgba(243,241,236,0.08)' }}>
                    <div style={{ width: `${Math.max(0, Math.min(1, b.position ?? 0)) * 100}%`, height: '100%', borderRadius: 4, background: sp.p.varianten.akzent }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

const FAZIT_LABEL: Record<string, string> = {
  'sc.dividendenertrag': 'Dividend yield',
  'sc.dividendenwachstum': 'Dividend growth',
  'sc.gewinnwachstum': 'Earnings growth',
  'sc.burggraben': 'Moat',
  'val.ev_ebitda_abstand': 'vs 5-year middle',
}

function fazitLabel(id: string, label: string): string {
  return FAZIT_LABEL[id] ?? label.replace(/^Scorecard:\s*/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

type FazitPunkt = { key: string; label: string; zahl: string; wert: number | null; ab: number }
type FazitGross = { art: 'zahl'; label: string; zahl: string; wert: number | null; ab: number } | { art: 'urteil'; text: string; ab: number }

/** Scorecard-Punktzahl bleibt in der Reihe. Andere kurze Kennzahlen und das Urteil füllen die Fläche. */
function fazitBeitrag(
  id: string,
  fakt: { text: string; label: string; wert: number | null },
): { art: 'score'; label: string; zahl: string; wert: number | null } | { art: 'zahl'; label: string; zahl: string; wert: number | null } | { art: 'urteil'; text: string } | null {
  if (id === 'fazit.urteil') {
    const text = fakt.text.trim()
    return text ? { art: 'urteil', text } : null
  }
  if (id.startsWith('sc.') && fakt.wert != null && Number.isFinite(fakt.wert)) {
    return { art: 'score', label: fazitLabel(id, fakt.label), zahl: String(Math.round(fakt.wert)), wert: fakt.wert }
  }
  const woerter = fakt.text.trim().split(/\s+/).filter(Boolean)
  if (woerter.length > 4) return null
  const zahl = dollarImText(fakt.text.trim(), fakt.wert)
  if (!zahl) return null
  return { art: 'zahl', label: fazitLabel(id, fakt.label), zahl, wert: fakt.wert }
}

function FazitGrossBild({ gross, frame }: { gross: FazitGross; frame: number }) {
  const o = ein(frame, gross.ab, 16)
  if (gross.art === 'urteil') {
    const schrift = gross.text.length > 42 ? 64 : gross.text.length > 28 ? 80 : 96
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
        <div style={{ maxWidth: 1500, textAlign: 'center', fontFamily: LONG_SERIF, fontSize: schrift, lineHeight: 1.15, color: LONG_TEXT, opacity: o }}>
          {gross.text}
        </div>
      </AbsoluteFill>
    )
  }
  const anzeige = gross.zahl
  const schrift = anzeige.length > 18 ? 72 : anzeige.length > 12 ? 96 : 128
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
      <div style={{ textAlign: 'center', opacity: o, maxWidth: 1500 }}>
        <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_MUTED }}>{gross.label.toUpperCase()}</div>
        <div style={{ marginTop: 18, fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: schrift, lineHeight: 0.95, color: LONG_TEXT }}>
          <FarbeZahl text={anzeige} wert={gross.wert} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

function Fazit({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const jetzt = sp.block.from + lauf.from + frame
  const start = sp.block.from + lauf.from
  const gesehen = new Set<string>()
  const punkte: FazitPunkt[] = []
  let gross: FazitGross | null = null
  for (let i = 0; i < sp.p.saetze.length; i++) {
    const s = sp.p.saetze[i]
    const z = sp.t.saetze[i]
    if (!s || !z || s.visual.szene !== 'fazit_antwort' || z.from > jetzt + 1) continue
    const ab = z.from - start
    for (const id of s.faktIds) {
      if (gesehen.has(id)) continue
      const fakt = sp.p.fakten[id]
      const beitrag = fakt ? fazitBeitrag(id, fakt) : null
      if (!beitrag) continue
      gesehen.add(id)
      if (beitrag.art === 'urteil') {
        gross = { art: 'urteil', text: beitrag.text, ab }
        continue
      }
      if (beitrag.art === 'zahl') {
        gross = { art: 'zahl', label: beitrag.label, zahl: beitrag.zahl, wert: beitrag.wert, ab }
        continue
      }
      if (!gross) punkte.push({ key: id, label: beitrag.label, zahl: beitrag.zahl, wert: beitrag.wert, ab })
    }
  }
  if (gross) return <FazitGrossBild gross={gross} frame={frame} />
  if (!punkte.length) return null
  const laengste = punkte.reduce((n, k) => Math.max(n, k.zahl.length), 0)
  const schrift = laengste >= 12 ? 56 : laengste >= 9 ? 68 : laengste >= 7 ? 80 : 92
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: 80, paddingRight: 80 }}>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 1680 }}>
        {punkte.map((k, i) => (
          <div
            key={k.key}
            style={{
              flex: '0 0 auto',
              width: 'max-content',
              textAlign: 'center',
              opacity: ein(frame, k.ab, 16),
              transform: `translateY(${(1 - ein(frame, k.ab, 16)) * 18}px)`,
              padding: '28px 56px 26px',
              borderRadius: 28,
              boxSizing: 'border-box',
              border: i === punkte.length - 1 ? `2px solid ${sp.p.varianten.akzent}` : '2px solid transparent',
            }}
          >
            <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 1.4, color: LONG_MUTED, whiteSpace: 'nowrap' }}>{k.label.toUpperCase()}</div>
            <div style={{ marginTop: 14, fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: schrift, lineHeight: 1, color: LONG_TEXT, whiteSpace: 'nowrap' }}>
              <FarbeZahl text={k.zahl} wert={k.wert} />
            </div>
            <div style={{ marginTop: 8, fontFamily: LONG_MONO, fontSize: 16, color: LONG_MUTED }}>/10</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

function Karte({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const szene = lauf.szene
  const fakt = faktDesSatzes(sp, lauf.saetze[0]!)
  if (szene === 'scorecard_spalten') return <Scorecard sp={sp} lauf={lauf} />
  if (szene === 'fazit_antwort') return <Fazit sp={sp} lauf={lauf} />
  if (szene === 'risiko_karte') return <RisikoTafel sp={sp} lauf={lauf} />
  if (!fakt) return null
  return <GrosseZahl label={fakt.label} text={fakt.text} wert={fakt.wert} />
}

export function LongKapitel(sp: SzeneProps) {
  const besitz = sp.block.saetze.length > 0 && sp.block.saetze.every((i) => sp.p.saetze[i]?.visual.szene === 'inhaber_anteile')
  if (besitz && besitzBereit(sp)) return <LongBesitz {...sp} />
  const laeufe = satzLaeufe(sp)
  return (
    <AbsoluteFill>
      {laeufe.map((l, k) => (
        <Blende key={k} von={l.from} bis={l.bis + (k < laeufe.length - 1 ? 0 : 0)}>
          <Sequence from={l.from} layout="none" durationInFrames={Math.max(1, l.bis - l.from)}>
            <Karte sp={sp} lauf={l} />
          </Sequence>
        </Blende>
      ))}
    </AbsoluteFill>
  )
}
