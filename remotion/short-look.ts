/** Gemeinsames Short-Look — Moat Check und Earnings Check. */
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadInterTight } from '@remotion/google-fonts/InterTight'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'

export const { fontFamily: SHORT_DISPLAY } = loadInterTight('normal', { weights: ['600', '800', '900'], subsets: ['latin'] })
export const { fontFamily: SHORT_SANS } = loadInter('normal', { weights: ['600', '700'], subsets: ['latin'] })
export const { fontFamily: SHORT_MONO } = loadMono('normal', { weights: ['500', '700'], subsets: ['latin'] })

export const SHORT_BG = '#0C0C0E'
export const SHORT_BG_CRACK = '#1D0E0C'
export const SHORT_TEXT = '#F3F1EC'
export const SHORT_MUTED = 'rgba(243, 241, 236, 0.52)'
export const SHORT_BRAND = '#E9B44C'
export const SHORT_GRUEN = '#6FD39A'
export const SHORT_ROT = '#EF6A5A'
export const SHORT_CAPTION_YELLOW = '#FFC700'

export const SHORT_SAFE_TOP = 300
export const SHORT_SAFE_LEFT = 72
export const SHORT_SAFE_RIGHT = 200
export const SHORT_SAFE_BOTTOM = 360
/** Unter der Bildzeile, über der YouTube-Leiste. Nicht auf der großen Zahl. */
export const SHORT_CAPTION_TOP = 1340
export const SHORT_SCENE_PAD_BOTTOM = 1920 - SHORT_CAPTION_TOP + 28
export const SHORT_CONTENT_SIDE = 88
export const SHORT_CAPTION_SIDE = 88
export const SHORT_CAPTION_SIZE = 58
export const SHORT_CAPTION_LINE = 1.25
export const SHORT_HOOK_ZAHL_AB = 2
export const SHORT_HOOK_ZAHL_FRAME = 12
export const SHORT_STEMPEL_AUFPRALL = 9

export const SHORT_SFX_PEGEL = 0.21
export const SHORT_MUSIK_MIT_STIMME = 0.063
export const SHORT_MUSIK_OHNE_STIMME = 0.126
export const SHORT_CRACK_DUCK = 0.7
