'use client'

export type WhoopTab = 'home' | 'sleep' | 'recovery' | 'strain' | 'health' | 'connect'

const TABS: { id: WhoopTab; label: string; color: string }[] = [
  { id: 'home', label: 'Home', color: '#ffffff' },
  { id: 'sleep', label: 'Schlaf', color: '#00E5FF' },
  { id: 'recovery', label: 'Erholung', color: '#00E676' },
  { id: 'strain', label: 'Belastung', color: '#009dff' },
  { id: 'health', label: 'Gesundheit', color: '#a78bfa' },
  { id: 'connect', label: 'Gerät', color: '#94a3b8' },
]

function TabIcon({ id, color }: { id: WhoopTab; color: string }) {
  const props = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (id) {
    case 'home':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
        </svg>
      )
    case 'sleep':
      return (
        <svg {...props}>
          <path d="M14.5 4.5a7.5 7.5 0 1 0 5 12.8A6.5 6.5 0 1 1 14.5 4.5z" />
        </svg>
      )
    case 'recovery':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5v17" />
          <path d="M12 12a8.5 8.5 0 0 1 8.5 8.5" fill={color} stroke="none" />
        </svg>
      )
    case 'strain':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5.5" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      )
    case 'health':
      return (
        <svg {...props}>
          <path d="M12 20.5s-6.5-4.2-8.5-8.2C1.8 8.8 4.2 5.5 7.8 5.5c2 0 3.4 1.1 4.2 2.3.8-1.2 2.2-2.3 4.2-2.3 3.6 0 6 3.3 4.3 6.8-2 4-8.5 8.2-8.5 8.2z" />
        </svg>
      )
    case 'connect':
      return (
        <svg {...props}>
          <path d="M8.2 6.8 12 3l3.8 3.8" />
          <path d="M12 3v7.5" />
          <rect x="5" y="12" width="14" height="9" rx="2.5" />
          <path d="M9.5 16h5" />
        </svg>
      )
  }
}

type Props = {
  tab: WhoopTab
  onTabChange: (tab: WhoopTab) => void
}

export function WhoopBottomNav({ tab, onTabChange }: Props) {
  return (
    <nav
      className="shrink-0 border-t border-white/10 bg-[#080808] px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      aria-label="WHOOP Navigation"
    >
      <ul className="grid grid-cols-6 gap-1">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onTabChange(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-2xl px-0.5 py-2 transition active:scale-[0.96] ${
                  active ? 'bg-white/[0.09]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <TabIcon id={t.id} color={active ? t.color : '#9ca3af'} />
                <span
                  className={`max-w-full truncate text-center text-[11px] leading-none ${
                    active ? 'font-bold' : 'font-medium'
                  }`}
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
