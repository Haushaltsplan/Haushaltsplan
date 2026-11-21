/** 16:9-Look der Aktienanalyse: gleiche Farbwelt wie die Moat-Shorts, plus Serifen für Überschriften. */
import { loadFont as loadSerif } from '@remotion/google-fonts/InstrumentSerif'
import { SHORT_BG, SHORT_DISPLAY, SHORT_GRUEN, SHORT_MONO, SHORT_MUTED, SHORT_ROT, SHORT_SANS, SHORT_TEXT } from '../short-look'

export const { fontFamily: LONG_SERIF } = loadSerif('normal', { weights: ['400'], subsets: ['latin'] })
export const { fontFamily: LONG_SERIF_KURSIV } = loadSerif('italic', { weights: ['400'], subsets: ['latin'] })

export const LONG_DISPLAY = SHORT_DISPLAY
export const LONG_SANS = SHORT_SANS
export const LONG_MONO = SHORT_MONO

export const LONG_BG = SHORT_BG
export const LONG_PANEL = '#141417'
export const LONG_LINIE = 'rgba(243, 241, 236, 0.09)'
export const LONG_TEXT = SHORT_TEXT
export const LONG_MUTED = SHORT_MUTED
export const LONG_GRUEN = SHORT_GRUEN
export const LONG_ROT = SHORT_ROT
export const LONG_SPY = 'rgba(243, 241, 236, 0.38)'

export const LONG_RAND_X = 120
export const LONG_RAND_Y = 96

export const LONG_STIMME_PEGEL = 1
export const LONG_MUSIK_UNTER_STIMME = 0.07
export const LONG_MUSIK_FREI = 0.2
export const LONG_SFX_PEGEL = 0.22

export function mitAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
