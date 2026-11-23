/** Long-Form-Aktienanalyse 16:9: Szenenblöcke, satzweise Stimme, Musik mit Ducking, Abo-Einblendung. */
import { Audio } from '@remotion/media'
import { useMemo } from 'react'
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { Hintergrund, Korn, easeOut, oeffentlichSrc, type SzeneProps } from './long-bausteine'
import { LONG_MUSIK_FREI, LONG_MUSIK_UNTER_STIMME } from './long-look'
import { berechneLongTimeline, LONG_KAPITEL_REIHE, type LongBlock, type LongTimeline } from './long-timeline'
import type { AktienAnalyseProps } from './long-types'
import { LongAbo } from './LongAbo'
import { LongBild, LongBumper, LongTitelKarte } from './LongBild'
import { LongKapitel } from './LongKapitel'
import { LongChart } from './LongChart'
import { LongEnde } from './LongEnde'
import { LongHook } from './LongHook'
import { LongJahresChart } from './LongJahresChart'
import { LongMoat } from './LongMoat'

function KornAbSekunde() {
  const frame = useCurrentFrame()
  if (frame < 90) return null
  return <Korn />
}

function Szene(sp: SzeneProps) {
  switch (sp.block.familie) {
    case 'hook':
      return <LongHook {...sp} />
    case 'chart':
      return <LongChart {...sp} />
    case 'moat':
      return <LongMoat {...sp} />
    case 'reihe':
      return <LongJahresChart {...sp} />
    case 'kapitel':
      return <LongKapitel {...sp} />
    case 'titel':
      return <LongTitelKarte {...sp} />
    case 'karte':
      return <LongEnde {...sp} />
    default:
      return <LongBild {...sp} />
  }
}

/** Langsame Drift plus kurzer Zoom-Impuls auf dem betonten Wort. Richtung hängt vom Kamera-Seed ab. */
function Kamera({ p, t, block, children }: SzeneProps & { children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const impulse = block.saetze.map((i) => t.saetze[i]!.betonungFrame).filter((f): f is number => f != null).map((f) => f - block.from)
  let punch = 0
  for (const f of impulse) {
    const d = frame - f
    if (d >= -4 && d < 40) punch = Math.max(punch, interpolate(d, [-4, 6, 40], [0, 1, 0.55], { extrapolateRight: 'clamp' }))
  }
  // Chart/B-Roll: kaum Punch — sonst „zucken“ die Linien und Fotos.
  if (block.familie === 'chart' || block.familie === 'reihe') punch = 0
  if (block.familie === 'bild' || block.familie === 'moat' || block.familie === 'kapitel') punch *= 0.25
  if (block.familie === 'hook' && frame + block.from < 90) {
    return <AbsoluteFill>{children}</AbsoluteFill>
  }
  const drift = interpolate(frame, [0, Math.max(1, block.dauer)], [1, block.familie === 'chart' ? 1.008 : 1.018], {
    extrapolateRight: 'clamp',
  })
  const seed = p.varianten.kameraSeed + block.from
  const ox = 40 + (seed % 3) * 10
  const oy = 42 + ((seed >> 2) % 3) * 8
  return <AbsoluteFill style={{ transform: `scale(${drift + punch * 0.02})`, transformOrigin: `${ox}% ${oy}%` }}>{children}</AbsoluteFill>
}

function musikVolumen(f: number, t: LongTimeline, basis: number, von: number, bis: number): number {
  let abstand = Infinity
  for (const [a, b] of t.sprechen) {
    if (f >= a && f <= b) {
      abstand = 0
      break
    }
    abstand = Math.min(abstand, f < a ? a - f : f - b)
  }
  const frei = Math.min(1, abstand / 6)
  const pegel = LONG_MUSIK_UNTER_STIMME + (LONG_MUSIK_FREI - LONG_MUSIK_UNTER_STIMME) * frei
  const kante = Math.min(1, (f - von) / 20, (bis - f) / 30)
  return Math.max(0, pegel * basis * Math.max(0, kante))
}

/** Satz beginnt, wenn der vorige zu Ende ist. Volle Lautstärke, kein Überlapp. */
function satzFenster(t: LongTimeline, i: number) {
  const z = t.saetze[i]!
  return { start: z.from, laenge: Math.max(1, z.dauer) }
}

function Ton({ p, t }: { p: AktienAnalyseProps; t: LongTimeline }) {
  const basis = Math.max(0, p.musik.pegel) / 50
  const musikTeile = useMemo(() => {
    if (!p.musik.aktiv) return []
    const teile: { src: string; von: number; bis: number; start: number }[] = []
    for (const a of t.abschnitte) {
      const track = p.musik.tracks.find((x) => x.abschnittId === a.id)
      if (!track) continue
      const letzter = teile[teile.length - 1]
      if (letzter && letzter.src === track.src && letzter.bis >= a.from - 2) letzter.bis = a.bis
      else teile.push({ src: track.src, von: Math.max(0, a.from - 10), bis: a.bis, start: track.startSek ?? 0 })
    }
    if (teile.length) teile[teile.length - 1]!.bis = t.durationInFrames
    return teile
  }, [p.musik, t])

  return (
    <>
      {p.saetze.map((s, i) => {
        const z = t.saetze[i]!
        if (!s.audioUrl) return null
        const fenster = satzFenster(t, i)
        return (
          <Sequence key={s.id} from={fenster.start} durationInFrames={fenster.laenge} layout="none">
            <Audio src={s.audioUrl} volume={1} />
          </Sequence>
        )
      })}
      {musikTeile.map((m, k) => (
        <Sequence key={k} from={m.von} durationInFrames={Math.max(1, m.bis - m.von)} layout="none">
          <Audio
            src={oeffentlichSrc(m.src)}
            loop
            trimBefore={m.start > 0 ? Math.round(m.start * 30) : undefined}
            volume={(f) => musikVolumen(f + m.von, t, basis, m.von, m.bis)}
          />
        </Sequence>
      ))}
    </>
  )
}

function wortKern(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Spanne nur über die Wörter, die den Namen wirklich sagen. Sonst kein Logo. */
function namensSpanne(woerter: { text: string; from: number; bis: number }[], name: string): { von: number; bis: number } | null {
  const teile = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
  const such = teile.length ? teile : [wortKern(name)].filter((t) => t.length > 1)
  if (!such.length) return null
  let von = -1
  let bis = -1
  let naechstes = 0
  for (const w of woerter) {
    const text = wortKern(w.text)
    if (!text) continue
    const ziel = such[naechstes]!
    if (text.includes(ziel) || (ziel.includes(text) && text.length > 2)) {
      if (von < 0) von = w.from
      bis = w.bis
      naechstes += 1
      if (naechstes >= such.length) return { von, bis: Math.max(bis, von + 1) }
    }
  }
  return null
}

/** Jedes Logo nur, solange sein Name gesprochen wird. Davor und danach ist es weg. */
function KonkurrentenWurf({ p, t }: { p: AktienAnalyseProps; t: LongTimeline }) {
  const frame = useCurrentFrame()
  const sichtbar = t.saetze.flatMap((z) => {
    const logos = p.saetze[z.index]?.visual.konkurrentLogos ?? []
    return logos.flatMap((logo) => {
      const spanne = namensSpanne(z.woerter, logo.name)
      if (!spanne || frame < spanne.von || frame >= spanne.bis) return []
      const dauer = spanne.bis - spanne.von
      const kante = Math.min(16, Math.max(8, Math.floor(dauer * 0.32)))
      const lokal = frame - spanne.von
      const rein = easeOut(lokal / kante)
      const rausStart = Math.max(kante, dauer - kante)
      const raus = lokal <= rausStart ? 0 : easeOut((lokal - rausStart) / Math.max(1, dauer - rausStart))
      return [{ url: logo.url, name: logo.name, alpha: rein * (1 - raus), x: (1 - rein) * 48 - raus * 20, scale: 0.96 + 0.04 * rein }]
    })
  })
  if (!sichtbar.length) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        zIndex: 6,
        display: 'flex',
        justifyContent: 'center',
        gap: 36,
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
      }}
    >
      {sichtbar.map((l) => (
        <div
          key={`${l.name}-${l.url}`}
          style={{
            height: 118,
            maxWidth: 460,
            borderRadius: 24,
            background: '#F3F1EC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 32px',
            boxSizing: 'border-box',
            opacity: l.alpha,
            transform: `translateX(${l.x}px) scale(${l.scale})`,
          }}
        >
          <Img src={oeffentlichSrc(l.url)} style={{ height: 72, width: 'auto', maxWidth: 380, objectFit: 'contain' }} />
        </div>
      ))}
    </div>
  )
}

export function AktienAnalyse(p: AktienAnalyseProps) {
  const t = useMemo(() => berechneLongTimeline(p), [p])
  return (
    <AbsoluteFill style={{ background: '#0C0C0E' }}>
      <Hintergrund akzent={p.varianten.akzent} seed={p.varianten.kameraSeed} />
      {t.bloecke.map((b: LongBlock, k) => (
        <Sequence key={k} from={b.from} durationInFrames={b.dauer}>
          <Kamera p={p} t={t} block={b}>
            <Szene p={p} t={t} block={b} />
          </Kamera>
        </Sequence>
      ))}
      {t.bumper.map((b) => (
        <Sequence key={b.from} from={b.from} durationInFrames={b.dauer}>
          <LongBumper
            nummer={b.nummer}
            titel={p.abschnittTitel[b.abschnittId] ?? ''}
            akzent={p.varianten.akzent}
            gesamt={LONG_KAPITEL_REIHE.length}
            dauer={b.dauer}
          />
        </Sequence>
      ))}
      <KornAbSekunde />
      <KonkurrentenWurf p={p} t={t} />
      {t.abo ? (
        <Sequence from={t.abo.from} durationInFrames={t.abo.dauer}>
          <LongAbo dauer={t.abo.dauer} text={p.varianten.aboText} akzent={p.varianten.akzent} kanalName={p.kanalName} kanalLogoUrl={p.kanalLogoUrl} />
        </Sequence>
      ) : null}
      <Ton p={p} t={t} />
    </AbsoluteFill>
  )
}
