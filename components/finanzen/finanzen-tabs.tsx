'use client'

export type FinanzenTab = 'uebersicht' | 'buchen' | 'planen' | 'vermoegen'

const TABS: { id: FinanzenTab; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'buchen', label: 'Buchen' },
  { id: 'planen', label: 'Planen' },
  { id: 'vermoegen', label: 'Gesamtvermögen' },
]

export function FinanzenTabs({
  active,
  onChange,
}: {
  active: FinanzenTab
  onChange: (tab: FinanzenTab) => void
}) {
  return (
    <div
      className="mb-4 flex rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1 shadow-inner"
      role="tablist"
      aria-label="Finanzen-Bereiche"
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold leading-tight transition-all sm:text-sm ${
            active === t.id
              ? 'bg-sky-600/90 text-white shadow-sm'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
