'use client'

import { omniaHapticLight } from '@/lib/fitnessdaten/omnia-native-ux'

export type WhoopTab = 'home' | 'sleep' | 'recovery' | 'strain' | 'health' | 'connect'

const TABS: { id: WhoopTab; label: string; short: string; color: string }[] = [
  { id: 'home', label: 'Home', short: 'Home', color: '#ffffff' },
  { id: 'sleep', label: 'Schlaf', short: 'Schlaf', color: '#00E5FF' },
  { id: 'recovery', label: 'Erholung', short: 'Erhol.', color: '#00E676' },
  { id: 'strain', label: 'Belastung', short: 'Belast.', color: '#009dff' },
  { id: 'health', label: 'Gesundheit', short: 'Health', color: '#a78bfa' },
  { id: 'connect', label: 'Gerät', short: 'Gerät', color: '#94a3b8' },
]

type Props = {
  tab: WhoopTab
  onTabChange: (tab: WhoopTab) => void
  /** Mobile: horizontale Pills oben (keine zweite Bottom-Nav). Desktop: klassische Bottom-Nav. */
  variant?: 'pills' | 'bottom'
}

export function WhoopBottomNav({ tab, onTabChange, variant = 'bottom' }: Props) {
  const change = (id: WhoopTab) => {
    void omniaHapticLight()
    onTabChange(id)
  }

  if (variant === 'pills') {
    return (
      <nav
        className="sticky top-0 z-20 -mx-1 mb-3 overflow-x-auto overscroll-contain px-1 pb-1 pt-1"
        aria-label="WHOOP Bereiche"
        data-no-swipe-nav
      >
        <ul className="flex min-w-min gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => change(t.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`app-touch-target app-press rounded-full px-3.5 text-[12px] font-semibold transition ${
                    active
                      ? 'bg-white/[0.14] text-white ring-1 ring-white/20'
                      : 'bg-white/[0.04] text-white/55 ring-1 ring-white/[0.06]'
                  }`}
                  style={active ? { color: t.color } : undefined}
                >
                  {t.short}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }

  return (
    <nav
      className="hidden shrink-0 border-t border-white/10 bg-[#080808] px-1 pb-3 pt-2 md:block"
      aria-label="WHOOP Navigation"
    >
      <ul className="grid grid-cols-6 gap-1">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => change(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`app-touch-target flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2 transition active:scale-[0.96] ${
                  active ? 'bg-white/[0.09]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <span
                  className={`text-[11px] leading-none ${active ? 'font-bold' : 'font-medium'}`}
                  style={{ color: active ? t.color : '#9ca3af' }}
                >
                  {t.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
