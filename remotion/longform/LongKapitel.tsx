/** Who owns it, Valuation, Risiken, Scorecard, Would I buy. Eine Zahl pro Satz, Besitz als Torte. */
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion'
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
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
      <div style={{ textAlign: 'center', opacity: ein(frame, 0, 10) }}>
        <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_MUTED }}>{label.toUpperCase()}</div>
        <div style={{ marginTop: 18, fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 140, lineHeight: 0.95, color: LONG_TEXT }}>
          <FarbeZahl text={text} wert={wert} />
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

function Scorecard({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const spalten = sp.p.scorecard ?? []
  const satz = sp.p.saetze[lauf.saetze[0]!]
  const fokus = (satz?.visual.fokus ?? satz?.faktIds.find((id) => id.startsWith('sc.'))?.slice(3) ?? '').toLowerCase()
  const titelZuId: Record<string, string> = {
    'dividend yield': 'dividendenertrag',
    'dividend growth': 'dividendenwachstum',
    'earnings growth': 'gewinnwachstum',
    moat: 'burggraben',
  }
  if (!spalten.length) return <Risiko text={satz?.text ?? ''} />
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 80, paddingRight: 80 }}>
      <div style={{ display: 'flex', gap: 28 }}>
        {spalten.map((s, i) => {
          const aktiv = Boolean(fokus) && (titelZuId[s.titel.toLowerCase()] === fokus || s.titel.toLowerCase() === fokus)
          return (
            <div
              key={s.titel}
              style={{
                flex: 1,
                padding: 28,
                borderRadius: 24,
                background: 'rgba(243,241,236,0.04)',
                outline: aktiv ? `2px solid ${sp.p.varianten.akzent}` : '2px solid transparent',
                opacity: ein(frame, i * 3, 12),
              }}
            >
              <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>{s.titel.toUpperCase()}</div>
              <div style={{ marginTop: 12, fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 84, color: LONG_TEXT }}>{s.score ?? '–'}</div>
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

function Fazit({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const satz = sp.p.saetze[lauf.saetze[lauf.saetze.length - 1]!]
  const urteil = satz?.faktIds.includes('fazit.urteil') ? satz.text : (sp.p.fakten['fazit.urteil']?.text ?? satz?.text ?? '')
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: 140, paddingRight: 140 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 36, color: LONG_MUTED, opacity: ein(frame, 0, 10) }}>{sp.p.leitfrage}</div>
        <div style={{ marginTop: 36, fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 84, lineHeight: 1.05, color: LONG_TEXT, opacity: ein(frame, 8, 14) }}>{urteil}</div>
      </div>
    </AbsoluteFill>
  )
}

function Karte({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const szene = lauf.szene
  const fakt = faktDesSatzes(sp, lauf.saetze[0]!)
  if (szene === 'scorecard_spalten') return <Scorecard sp={sp} lauf={lauf} />
  if (szene === 'fazit_antwort') return <Fazit sp={sp} lauf={lauf} />
  if (szene === 'risiko_karte') return <Risiko text={fakt?.text ?? sp.p.saetze[lauf.saetze[0]!]?.text ?? ''} />
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
