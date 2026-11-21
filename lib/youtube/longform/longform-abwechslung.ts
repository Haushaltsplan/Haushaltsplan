/**
 * Gleicher Aufbau, aber kein Fließband: Hook-Typen, Darstellungsvarianten und Abo-Hinweis
 * wechseln und schließen aus, was in den letzten Videos schon lief.
 */
import {
  LONGFORM_HOOK_TYPEN,
  type LongformHookTyp,
  type LongformVarianten,
} from '@/lib/youtube/longform/longform-types'

export const LONGFORM_VERLAUF_SPERRE = 5

export const HOOK_KATALOG: Record<LongformHookTyp, string> = {
  zahl_schock: 'Open on one surprising number from the fact sheet and make the viewer ask why.',
  gegen_konsens: 'State a sharp, data-backed claim that cuts against what most investors believe about this company.',
  produkt_alltag: 'Start with a product or service the viewer probably used today, then reveal the economics behind it.',
  gruender_story: 'Open with a short, verifiable moment from the company story (only if the sources contain it).',
  schlechtester_tag: 'Ask what would have happened if you bought at the worst possible moment, using the drawdown facts.',
  mythos_fakt: 'Name a common belief about the company and test it against one hard number.',
  rivalen_vergleich: 'Compare the stock with the S&P 500 or the obvious alternative investment, using real facts only.',
  offene_frage: 'Pose the guiding question of the video as a genuine dilemma that the ending will resolve.',
}

const ABO_TEXTE = [
  'Analyses like this, every week',
  'More deep dives? Subscribe',
  'Numbers first. Hype never.',
  'One stock. Every angle.',
  'If this helped, you know what to do',
  'Built from real data, not hot takes',
]

/** Edle Akzente, alle auf dunklem Grund lesbar. Gold bleibt die Hausfarbe der Shorts. */
const AKZENTE = ['#E9B44C', '#7FB7FF', '#6FD39A', '#C9A7FF', '#FF9F7A', '#5FD4D0']

export type LongformVerlaufEintrag = {
  hookTyp: string | null
  leitfrage: string | null
  varianten: Partial<LongformVarianten>
  kernphrasen: string[]
}

export function gesperrteHookTypen(verlauf: LongformVerlaufEintrag[]): LongformHookTyp[] {
  const zuletzt = verlauf.slice(0, LONGFORM_VERLAUF_SPERRE).map((v) => v.hookTyp)
  const gesperrt = LONGFORM_HOOK_TYPEN.filter((t) => zuletzt.includes(t))
  // Mindestens drei Typen bleiben frei, sonst gibt es keine echte Auswahl.
  return gesperrt.length > LONGFORM_HOOK_TYPEN.length - 3 ? gesperrt.slice(0, LONGFORM_HOOK_TYPEN.length - 3) : gesperrt
}

function zufall(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10_000) / 10_000
  }
}

function waehle<T>(optionen: readonly T[], vermeiden: (T | undefined)[], r: () => number): T {
  const frei = optionen.filter((o) => !vermeiden.includes(o))
  const pool = frei.length ? frei : optionen
  return pool[Math.floor(r() * pool.length)]!
}

export function waehleVarianten(verlauf: LongformVerlaufEintrag[], seed = Date.now()): LongformVarianten {
  const r = zufall(seed)
  const letzte = verlauf.slice(0, 3).map((v) => v.varianten)
  return {
    hookSzene: waehle(['hook_zahl', 'hook_frage', 'hook_bild'] as const, letzte.slice(0, 1).map((v) => v.hookSzene), r),
    chartStil: waehle(['linie_flaeche', 'linie_schlank'] as const, letzte.slice(0, 1).map((v) => v.chartStil), r),
    moatLayout: waehle(['karten', 'balken'] as const, letzte.slice(0, 1).map((v) => v.moatLayout), r),
    aboPosition: Math.round((0.35 + r() * 0.4) * 100) / 100,
    aboText: waehle(ABO_TEXTE, letzte.map((v) => v.aboText), r),
    akzent: waehle(AKZENTE, letzte.slice(0, 2).map((v) => v.akzent), r),
    kameraSeed: Math.floor(r() * 1_000_000),
  }
}

export function hookKatalogFuerPrompt(gesperrt: LongformHookTyp[]): string {
  return LONGFORM_HOOK_TYPEN.filter((t) => !gesperrt.includes(t))
    .map((t) => `- ${t}: ${HOOK_KATALOG[t]}`)
    .join('\n')
}
