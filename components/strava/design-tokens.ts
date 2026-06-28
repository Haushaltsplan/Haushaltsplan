/** Strava Dashboard — Design-Tokens (Athletic Dark Mode). */

export const STRAVA_COLORS = {
  orange: '#FC4C02',
  orangeHover: '#e04400',
  orangeMuted: 'rgba(252, 76, 2, 0.15)',
  cyan: '#22d3ee',
  cyanMuted: 'rgba(34, 211, 238, 0.12)',
  green: '#84cc16',
  yellow: '#eab308',
  slate: '#1e293b',
  slateLight: '#334155',
  card: '#0c0d0f',
  cardElevated: '#141618',
  black: '#050506',
  border: 'rgba(148, 163, 184, 0.12)',
  borderHover: 'rgba(148, 163, 184, 0.22)',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  positive: '#4ade80',
  negative: '#f87171',
} as const

export const STRAVA_CARD_CLASS =
  'rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[var(--app-surface)] to-[var(--app-surface)]/95 shadow-[0_4px_24px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-all duration-300'

export const STRAVA_CARD_HOVER =
  'hover:border-orange-500/15 hover:shadow-[0_8px_32px_rgba(0,0,0,0.22)]'

export const STRAVA_INTERACTIVE =
  'transition-all duration-200 ease-out active:scale-[0.98]'
