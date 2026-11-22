/** Burggraben: Geschäft, Pfeiler (Karten oder Balken), Scorecard-Spalte, Umsatzmix. Nur Zahlen und Labels, kein KI-Fließtext. */
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion'
import { englischOderLeer } from '../../lib/youtube/longform/longform-en'
import { pct } from '../../lib/youtube/longform/longform-format'
import { Blende, Logo, aktiverSatz, ein, satzLaeufe, zaehleText, type SatzLauf, type SzeneProps } from './long-bausteine'
import {
  LONG_DISPLAY,
  LONG_GRUEN,
  LONG_LINIE,
  LONG_MONO,
  LONG_MUTED,
  LONG_PANEL,
  LONG_RAND_X,
  LONG_ROT,
  LONG_SANS,
  LONG_SERIF,
  LONG_SERIF_KURSIV,
  LONG_TEXT,
  mitAlpha,
} from './long-look'

function stichpunkte(begruendung: string, risiko: string): string[] {
  const teile = [begruendung, risiko]
    .map((t) => englischOderLeer(t))
    .filter((t): t is string => Boolean(t))
    .flatMap((t) => t.split(/(?<=[,.;])\s+/))
    .map((t) => t.replace(/[.,;]+$/g, '').trim())
    .filter((t) => t.length > 8)
  return teile.slice(0, 3).map((t) => kuerzeAufWort(t, 72))
}

function kuerzeAufWort(t: string, max: number): string {
  if (t.length <= max) return t
  const schnitt = t.lastIndexOf(' ', max)
  const basis = (schnitt > 24 ? t.slice(0, schnitt) : t.slice(0, max)).trim()
  return `${basis}…`
}

function istKuerzel(name: string): boolean {
  return /^[A-Z][A-Z0-9]{1,7}$/.test(name.trim())
}

function beifuegung(name: string, satz: string): string | null {
  if (!istKuerzel(name)) return null
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*,\\s*([^.]{8,90})`, 'i')
  const m = satz.match(re)
  const g = m?.[1]?.trim().replace(/[.,;]+$/g, '')
  if (!g || /\d/.test(g)) return null
  return g.length > 64 ? `${g.slice(0, 61).trim()}…` : g
}

function glossAusSkript(sp: SzeneProps, name: string): string | null {
  for (const s of sp.p.saetze) {
    const g = beifuegung(name, s.text)
    if (g) return g
  }
  return null
}

function farbeFuerScore(score: number, akzent: string): string {
  if (score >= 7) return LONG_GRUEN
  if (score <= 4) return LONG_ROT
  return akzent
}

function Ueberschrift({ titel, unter, frame }: { titel: string; unter?: string | null; frame: number }) {
  return (
    <div style={{ position: 'absolute', left: LONG_RAND_X, top: 92 }}>
      <div style={{ fontFamily: LONG_SERIF, fontSize: 76, color: LONG_TEXT, opacity: ein(frame, 0, 16) }}>{titel}</div>
      {unter ? <div style={{ fontFamily: LONG_MONO, fontSize: 24, letterSpacing: 1, color: LONG_MUTED, marginTop: 10, opacity: ein(frame, 6, 16) }}>{unter}</div> : null}
    </div>
  )
}

function Geschaeft({ sp }: { sp: SzeneProps }) {
  const frame = useCurrentFrame()
  const { p } = sp
  const seg = p.segmente?.eintraege.slice(0, 4) ?? []
  const en = englischOderLeer(p.moat?.geschaeftsmodell)
  const business = en && en.length > 140 ? `${en.slice(0, 137).trim()}…` : en
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 44, opacity: ein(frame, 0, 18), transform: `translateY(${(1 - ein(frame, 0, 18)) * 20}px)` }}>
        <Logo url={p.logoUrl} groesse={168} ticker={p.ticker} />
        <div style={{ maxWidth: 1280 }}>
          <div style={{ fontFamily: LONG_SERIF, fontSize: 96, color: LONG_TEXT, lineHeight: 1 }}>{p.firmenname}</div>
          {p.branche ? (
            <div style={{ fontFamily: LONG_MONO, fontSize: 24, letterSpacing: 2, color: LONG_MUTED, marginTop: 14 }}>
              {p.branche.toUpperCase()}
            </div>
          ) : null}
          {business ? (
            <div
              style={{
                fontFamily: LONG_SERIF_KURSIV,
                fontSize: 36,
                color: LONG_TEXT,
                marginTop: 28,
                lineHeight: 1.35,
                maxWidth: 1100,
                opacity: ein(frame, 14, 16),
              }}
            >
              {business}
            </div>
          ) : null}
        </div>
      </div>
      {seg.length ? (
        <div style={{ display: 'flex', gap: 28, marginTop: business ? 64 : 90 }}>
          {seg.map((s, k) => (
            <div key={s.name} style={{ flex: 1, borderTop: `3px solid ${k === 0 ? p.varianten.akzent : LONG_LINIE}`, paddingTop: 22, opacity: ein(frame, 24 + k * 8, 14) }}>
              <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: 64, color: LONG_TEXT }}>{pct(s.anteilPct)}</div>
              <div style={{ fontFamily: LONG_SANS, fontWeight: 600, fontSize: 28, color: LONG_MUTED, marginTop: 6 }}>{s.name}</div>
              {glossAusSkript(sp, s.name) ? (
                <div style={{ fontFamily: LONG_SERIF_KURSIV, fontSize: 22, color: LONG_MUTED, marginTop: 8, lineHeight: 1.3 }}>{glossAusSkript(sp, s.name)}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

function Pfeiler({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const m = sp.p.moat
  if (!m) return null
  const akzent = sp.p.varianten.akzent
  const fokus = sp.p.saetze[aktiverSatz(sp, frame + lauf.from)]!.visual.fokus ?? null
  const nur = fokus != null ? m.pfeiler.find((x) => x.id === fokus) : null
  if (nur) {
    const farbe = farbeFuerScore(nur.score, akzent)
    const f = ein(frame, 8, 18)
    const punkte = stichpunkte(nur.begruendung, nur.risiko)
    return (
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 80 }}>
          <div style={{ flex: '0 0 820px' }}>
            <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_MUTED, opacity: ein(frame, 0, 12) }}>THE MOAT</div>
            <div style={{ fontFamily: LONG_SERIF, fontSize: 84, color: LONG_TEXT, marginTop: 12, opacity: ein(frame, 4, 14) }}>{nur.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 24 }}>
              <span style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 160, color: LONG_TEXT, lineHeight: 0.9 }}>{nur.score}</span>
              <span style={{ fontFamily: LONG_MONO, fontSize: 36, color: LONG_MUTED }}>/ 10</span>
            </div>
            <div style={{ marginTop: 32, height: 10, width: 640, borderRadius: 5, background: 'rgba(243,241,236,0.08)' }}>
              <div style={{ width: `${nur.score * 10 * f}%`, height: '100%', borderRadius: 5, background: farbe }} />
            </div>
          </div>
          {punkte.length ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 28, opacity: ein(frame, 14, 16) }}>
              {punkte.map((zeile) => (
                <div key={zeile} style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: farbe, marginTop: 14, flexShrink: 0 }} />
                  <div style={{ fontFamily: LONG_SERIF, fontSize: 36, lineHeight: 1.25, color: LONG_TEXT }}>{zeile}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    )
  }
  const hatFokus = fokus != null && m.pfeiler.some((x) => x.id === fokus)

  if (sp.p.varianten.moatLayout === 'balken') {
    return (
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: LONG_SERIF, fontSize: 72, color: LONG_TEXT, opacity: ein(frame, 0, 16) }}>The moat, pillar by pillar</div>
          <div style={{ fontFamily: LONG_MONO, fontSize: 24, letterSpacing: 1, color: LONG_MUTED, marginTop: 10, opacity: ein(frame, 6, 16) }}>
            {`OVERALL ${m.score} / 10${englischOderLeer(m.urteil) ? ` · ${englischOderLeer(m.urteil)!.toUpperCase()}` : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
          {m.pfeiler.map((x, k) => {
            const f = ein(frame, 14 + k * 9, 22)
            const dim = hatFokus && x.id !== fokus ? 0.35 : 1
            return (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 36, opacity: ein(frame, 10 + k * 9, 12) * dim }}>
                <div style={{ width: 420, fontFamily: LONG_SANS, fontWeight: 700, fontSize: 34, color: LONG_TEXT }}>{x.label}</div>
                <div style={{ flex: 1, height: 22, borderRadius: 11, background: 'rgba(243,241,236,0.07)', overflow: 'hidden' }}>
                  <div style={{ width: `${(x.score / 10) * 100 * f}%`, height: '100%', borderRadius: 11, background: farbeFuerScore(x.score, akzent) }} />
                </div>
                <div style={{ width: 110, textAlign: 'right', fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: 46, color: LONG_TEXT }}>{x.score}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    )
  }

  const spalten = m.pfeiler.length > 4 ? 3 : 2
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 72, color: LONG_TEXT, opacity: ein(frame, 0, 16) }}>Where the moat comes from</div>
        <div style={{ fontFamily: LONG_MONO, fontSize: 24, letterSpacing: 1, color: LONG_MUTED, marginTop: 10, opacity: ein(frame, 6, 16) }}>
          {`OVERALL ${m.score} / 10${englischOderLeer(m.urteil) ? ` · ${englischOderLeer(m.urteil)!.toUpperCase()}` : ''}`}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${spalten}, 1fr)`, gap: 28 }}>
        {m.pfeiler.map((x, k) => {
          const o = ein(frame, 12 + k * 7, 14)
          const aktiv = hatFokus && x.id === fokus
          const dim = hatFokus && !aktiv ? 0.38 : 1
          const farbe = farbeFuerScore(x.score, akzent)
          return (
            <div
              key={x.id}
              style={{
                background: LONG_PANEL,
                borderRadius: 18,
                padding: '28px 32px',
                border: `2px solid ${aktiv ? farbe : LONG_LINIE}`,
                opacity: o * dim,
                transform: `translateY(${(1 - o) * 18}px)`,
                boxShadow: aktiv ? `0 0 0 1px ${farbe}, 0 18px 40px rgba(0,0,0,0.35)` : 'none',
              }}
            >
              <div style={{ fontFamily: LONG_SANS, fontWeight: 700, fontSize: 30, color: LONG_MUTED }}>{x.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
                <span style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 92, color: LONG_TEXT, lineHeight: 1 }}>{x.score}</span>
                <span style={{ fontFamily: LONG_MONO, fontSize: 28, color: LONG_MUTED }}>/ 10</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(243,241,236,0.07)', marginTop: 20 }}>
                <div style={{ width: `${x.score * 10 * ein(frame, 20 + k * 7, 20)}%`, height: '100%', borderRadius: 4, background: farbe }} />
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

/** Dieselben vier Pfeiler wie die Einzelkarte, Note von 10. Keine Rohkennzahl daneben. */
function Scorecard({ sp }: { sp: SzeneProps }) {
  const frame = useCurrentFrame()
  const m = sp.p.moat
  if (!m?.pfeiler.length) return null
  const akzent = sp.p.varianten.akzent
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1080, background: LONG_PANEL, borderRadius: 28, padding: '44px 56px', border: `1px solid ${LONG_LINIE}`, opacity: ein(frame, 0, 16), transform: `scale(${0.96 + 0.04 * ein(frame, 0, 18)})` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div>
            <div style={{ fontFamily: LONG_SERIF, fontSize: 64, color: LONG_TEXT }}>Moat</div>
            <div style={{ fontFamily: LONG_MONO, fontSize: 22, color: LONG_MUTED, letterSpacing: 1 }}>PILLARS OUT OF 10</div>
          </div>
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 66,
              border: `5px solid ${farbeFuerScore(m.score, akzent)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: LONG_DISPLAY,
              fontWeight: 900,
              fontSize: 64,
              color: LONG_TEXT,
            }}
          >
            {m.score}
          </div>
        </div>
        {m.pfeiler.map((p, k) => {
          const f = ein(frame, 8 + k * 6, 18)
          return (
            <div key={p.id} style={{ marginBottom: 26, opacity: ein(frame, 6 + k * 6, 10) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LONG_SANS, fontWeight: 600, fontSize: 28, color: LONG_TEXT, marginBottom: 10 }}>
                <span>{p.label}</span>
                <span style={{ fontFamily: LONG_MONO, color: LONG_MUTED }}>{p.score} / 10</span>
              </div>
              <div style={{ height: 12, borderRadius: 6, background: 'rgba(243,241,236,0.08)' }}>
                <div style={{ width: `${p.score * 10 * f}%`, height: '100%', borderRadius: 6, background: farbeFuerScore(p.score, akzent) }} />
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function Finanzen({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const local = useCurrentFrame()
  const frame = local + lauf.from
  const i = aktiverSatz(sp, frame)
  const satz = sp.p.saetze[i]!
  const id = satz.faktIds.find((x) => x.startsWith('km.'))
  const fakt = id ? sp.p.fakten[id] : null
  const z = sp.t.saetze[i]!
  const start = z.from - sp.block.from
  const fort = ein(frame, start, 14)
  const bisher = lauf.saetze
    .filter((k) => sp.t.saetze[k]!.from - sp.block.from <= frame)
    .flatMap((k) => {
      const fid = sp.p.saetze[k]!.faktIds.find((x) => x.startsWith('km.'))
      const f = fid ? sp.p.fakten[fid] : null
      return fid && f && fid !== id ? [{ id: fid, ...f }] : []
    })
  if (!fakt) return null
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
      <div style={{ width: 1200, textAlign: 'center' }}>
        <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_MUTED }}>{fakt.label.toUpperCase()}</div>
        <div style={{ marginTop: 18, fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 168, lineHeight: 0.9, color: LONG_TEXT, fontVariantNumeric: 'tabular-nums' }}>
          {zaehleText(fakt.text, fort)}
        </div>
        {bisher.length ? (
          <div style={{ marginTop: 64, display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
            {bisher.map((f) => (
              <div key={f.id} style={{ minWidth: 180 }}>
                <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>{f.label.toUpperCase()}</div>
                <div style={{ marginTop: 8, fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: 36, color: LONG_TEXT }}>{f.text}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

function SegmentKarte({
  eintrag,
  gloss,
  menge,
  modus,
  fort,
  akzent,
}: {
  eintrag: { name: string; anteilPct: number; margePct: number | null; wachstumPct: number | null }
  gloss: string | null
  menge: number
  modus: 'share' | 'marge' | 'wachstum'
  fort: number
  akzent: string
}) {
  if (menge <= 0.02) return null
  return (
    <div
      style={{
        position: 'absolute',
        right: LONG_RAND_X,
        top: 260,
        width: 560,
        padding: '32px 36px',
        borderRadius: 24,
        background: 'rgba(20,20,23,0.94)',
        border: `1px solid ${mitAlpha(akzent, 0.35)}`,
        opacity: menge,
        transform: `translateX(${(1 - menge) * -340}px) scale(${0.62 + 0.38 * menge})`,
        transformOrigin: 'left center',
      }}
    >
      <div style={{ fontFamily: LONG_MONO, fontSize: 18, letterSpacing: 3, color: LONG_MUTED }}>{eintrag.name.toUpperCase()}</div>
      {gloss ? <div style={{ marginTop: 8, fontFamily: LONG_SERIF_KURSIV, fontSize: 26, lineHeight: 1.3, color: LONG_TEXT }}>{gloss}</div> : null}
      <SegmentZeile label="Share" text={pct(eintrag.anteilPct)} breite={eintrag.anteilPct} laut={modus === 'share'} fort={fort} akzent={akzent} />
      {eintrag.margePct != null ? (
        <SegmentZeile
          label="Operating margin"
          text={pct(eintrag.margePct)}
          breite={Math.min(100, (eintrag.margePct / Math.max(40, eintrag.margePct)) * 100)}
          laut={modus === 'marge'}
          fort={fort}
          akzent={eintrag.margePct >= 15 ? LONG_GRUEN : akzent}
        />
      ) : null}
      {eintrag.wachstumPct != null ? (
        <div style={{ marginTop: 22, opacity: modus === 'wachstum' ? 1 : 0.55 }}>
          <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>REVENUE VS LAST YEAR</div>
          <div
            style={{
              marginTop: 6,
              fontFamily: LONG_DISPLAY,
              fontWeight: 800,
              fontSize: modus === 'wachstum' ? 64 : 28,
              color: eintrag.wachstumPct >= 0 ? LONG_GRUEN : LONG_ROT,
            }}
          >
            {eintrag.wachstumPct >= 0 ? '▲ ' : '▼ '}
            {modus === 'wachstum' ? zaehleText(pct(eintrag.wachstumPct, { vorzeichen: true }), fort) : pct(eintrag.wachstumPct, { vorzeichen: true })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function segmentIndex(sp: SzeneProps, satzIndex: number, namen: string[]): number | null {
  const s = sp.p.saetze[satzIndex]!
  for (const id of s.faktIds) {
    if (id === 'seg.other' || id.startsWith('seg.other.')) {
      const o = namen.findIndex((n) => n.toLowerCase() === 'other')
      if (o >= 0) return o
    }
    const m = /^seg\.(\d+)/.exec(id)
    if (m) return Number(m[1])
  }
  const fokus = s.visual.fokus?.trim().toLowerCase()
  if (!fokus) return null
  const alsId = /^seg\.(\d+)/.exec(fokus)
  if (alsId) return Number(alsId[1])
  if (/^\d+$/.test(fokus)) return Number(fokus)
  const name = namen.findIndex((n) => n.toLowerCase() === fokus)
  return name >= 0 ? name : null
}

function Segmente({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const local = useCurrentFrame()
  const frame = local + lauf.from
  const seg = sp.p.segmente
  if (!seg) return null
  const akzent = sp.p.varianten.akzent
  const stufen = [1, 0.7, 0.5, 0.36, 0.26, 0.18, 0.12]
  const i = aktiverSatz(sp, frame)
  const idx = segmentIndex(sp, i, seg.eintraege.map((e) => e.name))
  const aktiv = idx != null ? seg.eintraege[idx] : null
  const z = sp.t.saetze[i]!
  const beton = (z.betonungFrame ?? z.from + 8) - sp.block.from
  const fokusId = sp.p.saetze[i]!.visual.fokus ?? ''
  const gesprochen = sp.p.saetze[i]!.faktIds.find((id) => id.startsWith('seg.')) ?? (fokusId.startsWith('seg.') ? fokusId : '')
  const modus: 'share' | 'marge' | 'wachstum' | null = gesprochen.endsWith('.marge')
    ? 'marge'
    : gesprochen.endsWith('.wachstum')
      ? 'wachstum'
      : aktiv
        ? 'share'
        : null
  const fort = frame >= beton ? ein(frame, beton, 16) : 0
  const satzStart = z.from - sp.block.from
  const flug = ein(frame - satzStart, 0, 16)
  const namen = seg.eintraege.map((e) => e.name)
  const vorgaenger = (() => {
    const pos = sp.block.saetze.indexOf(i)
    if (pos <= 0) return null
    const vor = sp.block.saetze[pos - 1]!
    if (sp.p.saetze[vor]!.visual.szene !== 'moat_segmente') return null
    const alt = segmentIndex(sp, vor, namen)
    return alt != null && alt !== idx ? alt : null
  })()
  const gewachsen = ein(local, 8, 20)
  return (
    <AbsoluteFill>
      <Ueberschrift
        titel={seg.art === 'geo' ? 'Where the revenue comes from' : 'What they actually sell'}
        unter={`REVENUE MIX${seg.jahr ? ` · FISCAL ${seg.jahr}` : ''}`}
        frame={frame}
      />
      <div style={{ position: 'absolute', left: LONG_RAND_X, right: aktiv ? 760 : LONG_RAND_X, top: 300, height: 72, borderRadius: 16, overflow: 'hidden', display: 'flex', background: 'rgba(243,241,236,0.05)' }}>
        {seg.eintraege.map((s, k) => {
          const w = s.anteilPct * gewachsen
          const draus = k === idx ? flug : k === vorgaenger ? 1 - flug : 0
          const hell = !aktiv || k === idx ? 1 - draus * 0.45 : 0.4
          return (
            <div
              key={s.name}
              style={{
                width: `${w}%`,
                height: '100%',
                background: mitAlpha(akzent, (stufen[k] ?? 0.1) * hell),
                borderRight: '2px solid #0C0C0E',
              }}
            />
          )
        })}
      </div>
      <div style={{ position: 'absolute', left: LONG_RAND_X, right: aktiv ? 780 : LONG_RAND_X, top: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {seg.eintraege.map((s, k) => {
          const an = aktiv != null && k === idx
          return (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: aktiv && !an ? 0.35 : ein(frame, 12 + k * 4, 10) }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: mitAlpha(akzent, stufen[k] ?? 0.1), boxShadow: an ? `0 0 0 2px ${akzent}` : undefined }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: LONG_SANS, fontWeight: 600, fontSize: an ? 32 : 24, color: LONG_TEXT }}>{s.name}</div>
                {glossAusSkript(sp, s.name) ? (
                  <div style={{ fontFamily: LONG_SERIF_KURSIV, fontSize: an ? 22 : 18, color: LONG_MUTED, marginTop: 2 }}>{glossAusSkript(sp, s.name)}</div>
                ) : null}
              </div>
              <div style={{ fontFamily: LONG_MONO, fontSize: an ? 28 : 22, color: LONG_TEXT }}>{pct(s.anteilPct)}</div>
            </div>
          )
        })}
      </div>
      {vorgaenger != null && seg.eintraege[vorgaenger] ? (
        <SegmentKarte eintrag={seg.eintraege[vorgaenger]!} gloss={glossAusSkript(sp, seg.eintraege[vorgaenger]!.name)} menge={1 - flug} modus="share" fort={1} akzent={akzent} />
      ) : null}
      {aktiv && modus ? (
        <SegmentKarte eintrag={aktiv} gloss={glossAusSkript(sp, aktiv.name)} menge={flug} modus={modus} fort={fort} akzent={akzent} />
      ) : null}
    </AbsoluteFill>
  )
}

function SegmentZeile({
  label,
  text,
  breite,
  laut,
  fort,
  akzent,
}: {
  label: string
  text: string
  breite: number
  laut: boolean
  fort: number
  akzent: string
}) {
  return (
    <div style={{ marginTop: 18, opacity: laut ? 1 : 0.55 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>
        <span>{label.toUpperCase()}</span>
        <span style={{ fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: laut ? 64 : 28, color: LONG_TEXT, letterSpacing: 0 }}>
          {laut ? zaehleText(text, fort) : text}
        </span>
      </div>
      <div style={{ marginTop: 8, height: laut ? 12 : 6, borderRadius: 6, background: 'rgba(243,241,236,0.08)' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, breite)) * (laut ? fort : 1)}%`, height: '100%', borderRadius: 6, background: akzent }} />
      </div>
    </div>
  )
}

export function LongMoat(sp: SzeneProps) {
  const laeufe = satzLaeufe(sp)
  return (
    <AbsoluteFill>
      {laeufe.map((l, k) => (
        <Blende key={k} von={l.from} bis={l.bis + (k < laeufe.length - 1 ? 3 : 0)}>
          <Sequence from={l.from} layout="none" durationInFrames={Math.max(1, l.bis - l.from + 4)}>
            {l.szene === 'moat_pfeiler' ? (
              <Pfeiler sp={sp} lauf={l} />
            ) : l.szene === 'moat_scorecard' ? (
              <Scorecard sp={sp} />
            ) : l.szene === 'moat_finanzen' ? (
              <Finanzen sp={sp} lauf={l} />
            ) : l.szene === 'moat_segmente' ? (
              <Segmente sp={sp} lauf={l} />
            ) : (
              <Geschaeft sp={sp} />
            )}
          </Sequence>
        </Blende>
      ))}
    </AbsoluteFill>
  )
}
