/** Who owns it: eine Torte, der gerade gesprochene Anteil rückt heraus. */
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion'
import { pct } from '../../lib/youtube/longform/longform-format'
import { aktiverSatz, ein, logoSrc, type SzeneProps } from './long-bausteine'
import { LONG_DISPLAY, LONG_MONO, LONG_MUTED, LONG_SANS, LONG_SERIF, LONG_TEXT } from './long-look'

type Scheibe = {
  id: string
  label: string
  anteil: number
  text: string
  logoUrl: string | null
  gruppe: 'halter' | 'institutionen' | 'insider' | 'rest'
  farbe: string
}

const FARBE: Record<string, string> = {
  'own.inst1': '#E8C36A',
  'own.inst2': '#8EB6F2',
  'own.inst3': '#D7B4F5',
  'own.institutionen.andere': '#7DDCB0',
  'own.insider': '#F0A48A',
  'own.rest': '#4A4A52',
}

function rund(n: number): number {
  return Math.round(n * 10) / 10
}

function scheibenAus(sp: SzeneProps): Scheibe[] {
  const f = sp.p.fakten
  const halter = ['own.inst1', 'own.inst2', 'own.inst3']
    .map((id) => ({ id, fakt: f[id] }))
    .filter((x): x is { id: string; fakt: NonNullable<(typeof f)[string]> } => x.fakt != null && x.fakt.wert != null && x.fakt.wert > 0)
  const summeHalter = halter.reduce((a, x) => a + (x.fakt.wert ?? 0), 0)
  const inst = f['own.institutionen']?.wert
  const insider = f['own.insider']?.wert
  const andere = inst != null ? rund(Math.max(0, inst - summeHalter)) : 0
  const insiderWert = insider != null && insider > 0 ? rund(insider) : 0
  const basis = inst != null ? inst + insiderWert : summeHalter + insiderWert
  const rest = rund(Math.max(0, 100 - basis))
  const out: Scheibe[] = halter.map((x) => ({
    id: x.id,
    label: x.fakt.label,
    anteil: rund(x.fakt.wert ?? 0),
    text: x.fakt.text,
    logoUrl: x.fakt.logoUrl ?? null,
    gruppe: 'halter',
    farbe: FARBE[x.id] ?? '#E8C36A',
  }))
  if (andere >= 0.3) {
    out.push({
      id: 'own.institutionen.andere',
      label: 'Other institutions',
      anteil: andere,
      text: pct(andere),
      logoUrl: null,
      gruppe: 'institutionen',
      farbe: FARBE['own.institutionen.andere']!,
    })
  }
  if (insiderWert > 0) {
    out.push({
      id: 'own.insider',
      label: f['own.insider']?.label ?? 'Insiders',
      anteil: insiderWert,
      text: f['own.insider']?.text ?? pct(insiderWert),
      logoUrl: null,
      gruppe: 'insider',
      farbe: FARBE['own.insider']!,
    })
  }
  if (rest >= 0.3) {
    out.push({
      id: 'own.rest',
      label: 'Everyone else',
      anteil: rest,
      text: pct(rest),
      logoUrl: null,
      gruppe: 'rest',
      farbe: FARBE['own.rest']!,
    })
  }
  return out
}

function nameTrifft(label: string, text: string): boolean {
  const wort = label
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .find((w) => w.length > 3 && !['group', 'inc', 'corp', 'company', 'holdings', 'llc', 'the', 'trust'].includes(w))
  return wort ? text.toLowerCase().includes(wort) : false
}

function hervorgehoben(sp: SzeneProps, index: number, liste: Scheibe[]): Set<string> {
  const satz = sp.p.saetze[index]
  const ids = new Set<string>()
  if (!satz) return ids
  for (const id of satz.faktIds) ids.add(id)
  if (satz.visual.fokus) ids.add(satz.visual.fokus)
  const text = satz.text
  if (ids.has('own.institutionen')) {
    for (const s of liste) if (s.gruppe === 'halter' || s.gruppe === 'institutionen') ids.add(s.id)
  }
  if (ids.has('own.insider') || ids.has('own.insider_netto')) {
    ids.add('own.insider')
  }
  for (const s of liste) if (s.gruppe === 'halter' && nameTrifft(s.label, text)) ids.add(s.id)
  return ids
}

function punkt(cx: number, cy: number, r: number, winkel: number) {
  return { x: cx + Math.cos(winkel) * r, y: cy + Math.sin(winkel) * r }
}

function ring(cx: number, cy: number, aussen: number, innen: number, a0: number, a1: number): string {
  const g = punkt(cx, cy, aussen, a0)
  const h = punkt(cx, cy, aussen, a1)
  const i = punkt(cx, cy, innen, a1)
  const j = punkt(cx, cy, innen, a0)
  const gross = a1 - a0 > Math.PI ? 1 : 0
  return `M ${g.x} ${g.y} A ${aussen} ${aussen} 0 ${gross} 1 ${h.x} ${h.y} L ${i.x} ${i.y} A ${innen} ${innen} 0 ${gross} 0 ${j.x} ${j.y} Z`
}

function kuerzel(name: string): string {
  const teile = name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['inc', 'corp', 'llc', 'the', 'group', 'co'].includes(w.toLowerCase()))
  const buchstaben = teile.slice(0, 2).map((w) => w[0]!.toUpperCase())
  return buchstaben.join('') || name.slice(0, 2).toUpperCase()
}

function Marke({ url, farbe, name, groesse }: { url: string | null; farbe: string; name: string; groesse: number }) {
  if (url) {
    return (
      <div
        style={{
          width: groesse,
          height: groesse,
          borderRadius: groesse * 0.24,
          background: '#F3F1EC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <Img src={logoSrc(url)} style={{ width: '76%', height: '76%', objectFit: 'contain' }} />
      </div>
    )
  }
  return (
    <div
      style={{
        width: groesse,
        height: groesse,
        borderRadius: groesse * 0.24,
        background: farbe,
        color: '#141417',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: LONG_DISPLAY,
        fontWeight: 800,
        fontSize: groesse * 0.34,
        flexShrink: 0,
      }}
    >
      {kuerzel(name)}
    </div>
  )
}

export function besitzBereit(sp: SzeneProps): boolean {
  return scheibenAus(sp).length >= 2
}

export function LongBesitz(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const liste = scheibenAus(sp)
  const index = aktiverSatz(sp, frame)
  const satz = sp.p.saetze[index]
  const aktiv = hervorgehoben(sp, index, liste)
  const lokal = frame - (sp.t.saetze[index]!.from - sp.block.from)
  const heraus = ein(lokal, 0, 12)
  const rein = ein(frame, 0, 16)
  const einzeln = liste.filter((s) => aktiv.has(s.id))
  const eine = einzeln.length === 1 ? einzeln[0]! : null
  const institutionen = !eine && (satz?.faktIds.includes('own.institutionen') || satz?.visual.fokus === 'own.institutionen')
  const netto = satz?.faktIds.includes('own.insider_netto') || satz?.visual.fokus === 'own.insider_netto'
  const mitteLabel = eine?.label ?? (institutionen ? (sp.p.fakten['own.institutionen']?.label ?? 'Institutions') : 'Who owns it')
  const mitteZahl = eine?.text ?? (institutionen ? (sp.p.fakten['own.institutionen']?.text ?? '') : '')
  const mitteLogo = eine?.logoUrl ?? null

  if (liste.length < 2) return null

  const summe = liste.reduce((a, s) => a + s.anteil, 0) || 1
  const cx = 320
  const cy = 320
  const aussen = 268
  const innen = 168
  let winkel = -Math.PI / 2

  return (
    <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 96, paddingRight: 96, opacity: rein, transform: `scale(${0.96 + rein * 0.04})` }}>
      <div style={{ position: 'relative', width: 640, height: 640, flexShrink: 0 }}>
        <svg width={640} height={640} viewBox="0 0 640 640">
          {liste.map((s) => {
            const breite = (s.anteil / summe) * Math.PI * 2
            const spalt = breite > 0.09 ? 0.015 : 0
            const a0 = winkel + spalt
            const a1 = winkel + breite - spalt
            winkel += breite
            const an = aktiv.has(s.id)
            const mitte = (a0 + a1) / 2
            const schub = an && eine ? 28 * heraus : 0
            const ox = Math.cos(mitte) * schub
            const oy = Math.sin(mitte) * schub
            const gedimmt = aktiv.size > 0 && !an
            return (
              <path
                key={s.id}
                d={ring(cx + ox, cy + oy, aussen, innen, a0, Math.max(a0 + 0.001, a1))}
                fill={s.farbe}
                opacity={gedimmt ? 0.28 : 1}
                stroke={an ? 'rgba(243,241,236,0.9)' : 'transparent'}
                strokeWidth={an ? 3 : 0}
              />
            )
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: cx - innen + 16,
            top: cy - innen + 16,
            width: (innen - 16) * 2,
            height: (innen - 16) * 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            opacity: ein(lokal, 0, 10),
          }}
        >
          {mitteLogo ? <Marke url={mitteLogo} farbe={eine?.farbe ?? '#E8C36A'} name={mitteLabel} groesse={78} /> : null}
          {mitteZahl ? (
            <div style={{ marginTop: mitteLogo ? 10 : 0, fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: 64, lineHeight: 0.95, color: LONG_TEXT }}>{mitteZahl}</div>
          ) : null}
          <div style={{ marginTop: 8, maxWidth: 240, fontFamily: LONG_SANS, fontWeight: 600, fontSize: 18, lineHeight: 1.25, color: LONG_MUTED }}>{mitteLabel}</div>
        </div>
      </div>
      <div style={{ flex: 1, paddingLeft: 36 }}>
        <div style={{ fontFamily: LONG_MONO, fontSize: 18, letterSpacing: 4, color: LONG_MUTED, opacity: ein(frame, 0, 8) }}>WHO OWNS IT</div>
        <div style={{ marginTop: 8, fontFamily: LONG_SERIF, fontSize: 42, color: LONG_TEXT }}>{sp.p.firmenname}</div>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {liste.map((s, i) => {
            const an = aktiv.has(s.id)
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '10px 16px',
                  borderRadius: 18,
                  background: an ? 'rgba(243,241,236,0.06)' : 'transparent',
                  outline: an ? `2px solid ${s.farbe}` : '2px solid transparent',
                  opacity: ein(frame, 4 + i * 2, 12) * (aktiv.size > 0 && !an ? 0.4 : 1),
                  transform: `translateX(${an ? 10 * heraus : 0}px)`,
                }}
              >
                <Marke url={s.logoUrl} farbe={s.farbe} name={s.label} groesse={48} />
                <div style={{ flex: 1, fontFamily: LONG_SANS, fontWeight: 600, fontSize: 26, color: LONG_TEXT }}>{s.label}</div>
                <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: an ? 36 : 28, color: an ? s.farbe : LONG_TEXT }}>{s.text}</div>
              </div>
            )
          })}
        </div>
        {netto && sp.p.fakten['own.insider_netto'] ? (
          <div style={{ marginTop: 22, fontFamily: LONG_SERIF, fontSize: 28, lineHeight: 1.3, color: LONG_TEXT, opacity: ein(lokal, 2, 12) }}>
            {sp.p.fakten['own.insider_netto'].text}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}
