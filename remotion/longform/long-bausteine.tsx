/** Gemeinsame Bausteine: Hintergrund mit Korn, Medienquellen, Zähl-Animation, Satz-Läufe. */
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { logoPlaySrc } from '../../lib/youtube/moat-short-media-src'
import type { LongformSzenenTyp } from '../../lib/youtube/longform/longform-types'
import { LONG_BG, LONG_DISPLAY, LONG_TEXT, mitAlpha } from './long-look'
import type { LongBlock, LongTimeline } from './long-timeline'
import type { AktienAnalyseProps } from './long-types'

export type SzeneProps = { p: AktienAnalyseProps; t: LongTimeline; block: LongBlock }

/** Dunkler Grund mit leichtem Akzent-Schimmer, Vignette und Filmkorn gegen den glatten KI-Look. */
export function Hintergrund({ akzent, seed }: { akzent: string; seed: number }) {
  const frame = useCurrentFrame()
  const x = 30 + ((seed * 37) % 40)
  const drift = Math.sin(frame / 240) * 4
  return (
    <AbsoluteFill style={{ background: LONG_BG }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at ${x + drift}% ${28 + drift}%, ${mitAlpha(akzent, 0.09)} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  )
}

export function Korn() {
  const frame = useCurrentFrame()
  const versatz = (frame % 6) * 17
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.07, mixBlendMode: 'overlay' }}>
      <svg width="100%" height="100%" style={{ transform: `translate(${-versatz % 40}px, ${-(versatz * 3) % 40}px) scale(1.05)` }}>
        <filter id="lf-korn">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 6} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#lf-korn)" />
      </svg>
    </AbsoluteFill>
  )
}

export function oeffentlichSrc(rel: string): string {
  if (/^(https?:|blob:|data:)/i.test(rel)) return rel
  if (typeof window !== 'undefined' && !('remotion_staticBase' in window && window.remotion_staticBase)) {
    return `${window.location.origin}/${rel.replace(/^\/+/, '')}`
  }
  return staticFile(rel.replace(/^\/+/, ''))
}

export function logoSrc(url: string): string {
  if (/^(data:|blob:)/i.test(url)) return url
  const play = logoPlaySrc(url)
  if (play && (/^(data:|blob:|https?:)/i.test(play) || play.startsWith('/api/'))) return play
  return oeffentlichSrc(play ?? url)
}

export function Logo({ url, groesse, ticker }: { url: string | null; groesse: number; ticker: string }) {
  if (!url) {
    return (
      <div
        style={{
          width: groesse,
          height: groesse,
          borderRadius: groesse * 0.22,
          background: 'rgba(243,241,236,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: LONG_DISPLAY,
          fontWeight: 800,
          fontSize: groesse * 0.34,
          color: LONG_TEXT,
        }}
      >
        {ticker.slice(0, 4)}
      </div>
    )
  }
  return (
    <div
      style={{
        width: groesse,
        height: groesse,
        borderRadius: groesse * 0.22,
        background: '#F3F1EC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Img src={logoSrc(url)} style={{ width: '74%', height: '74%', objectFit: 'contain' }} />
    </div>
  )
}

/** Zählt die erste Zahl im Text hoch und behält Format (Komma, Dezimalen, $, %, x). */
export function zaehleText(text: string, fortschritt: number): string {
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(text)
  if (!m) return text
  const roh = m[0]
  const ziel = Number(roh.replace(/,/g, ''))
  if (!Number.isFinite(ziel)) return text
  const dezimalen = roh.includes('.') ? roh.split('.')[1]!.length : 0
  const wert = ziel * Math.max(0, Math.min(1, fortschritt))
  const formatiert = wert.toLocaleString('en-US', {
    minimumFractionDigits: dezimalen,
    maximumFractionDigits: dezimalen,
    useGrouping: roh.includes(','),
  })
  return text.slice(0, m.index) + formatiert + text.slice(m.index + roh.length)
}

export function easeOut(x: number): number {
  const c = Math.max(0, Math.min(1, x))
  return 1 - Math.pow(1 - c, 3)
}

export function ein(frame: number, start: number, dauer = 14): number {
  return easeOut((frame - start) / dauer)
}

/** Aufeinanderfolgende Sätze mit gleicher Szene, relativ zum Blockstart. */
export type SatzLauf = { szene: LongformSzenenTyp; from: number; bis: number; saetze: number[] }

export function satzLaeufe({ p, t, block }: SzeneProps): SatzLauf[] {
  const laeufe: SatzLauf[] = []
  for (const i of block.saetze) {
    const s = p.saetze[i]!
    const z = t.saetze[i]!
    const rel = z.from - block.from
    const letzter = laeufe[laeufe.length - 1]
    const einzeln = s.visual.szene === 'moat_pfeiler' || s.visual.szene === 'zahl_reihe'
    const gleicherFokus =
      letzter != null &&
      (p.saetze[letzter.saetze[letzter.saetze.length - 1]!]!.visual.fokus ?? '') === (s.visual.fokus ?? '')
    const eigenerSchnitt = s.visual.szene === 'hook_bild'
    if (letzter && letzter.szene === s.visual.szene && !eigenerSchnitt && (!einzeln || gleicherFokus)) letzter.saetze.push(i)
    else laeufe.push({ szene: s.visual.szene, from: laeufe.length ? rel : 0, bis: block.dauer, saetze: [i] })
  }
  laeufe.forEach((l, k) => {
    l.bis = laeufe[k + 1]?.from ?? block.dauer
  })
  return laeufe
}

/** Index des Satzes, der gerade läuft (oder zuletzt lief). */
export function aktiverSatz({ t, block }: SzeneProps, relFrame: number): number {
  let aktiv = block.saetze[0]!
  for (const i of block.saetze) if (t.saetze[i]!.from - block.from <= relFrame) aktiv = i
  return aktiv
}

/**
 * Kurzer Soft-Cut statt Fade-to-Black.
 * Lange Ausblendungen + Satzlücken wirkten wie „hängende“ Pausen und schwarze Frames.
 */
export function Blende({ von, bis, children }: { von: number; bis: number; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  if (frame < von || frame > bis) return null
  const span = Math.max(1, bis - von)
  const fade = Math.min(4, Math.max(1, Math.floor(span / 5)))
  const o = interpolate(frame, [von, von + fade, Math.max(von + fade + 1, bis - fade), bis], [von <= 1 ? 1 : 0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}
