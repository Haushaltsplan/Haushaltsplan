import type { ReactNode } from 'react'

/** Standard-Breiten für Seiteninhalte. */
export const pageContainerNarrowClass = 'mx-auto w-full min-w-0 max-w-2xl'
export const pageContainerWideClass = 'mx-auto w-full min-w-0 max-w-6xl'
export const pageContainerFullClass = 'mx-auto w-full min-w-0 max-w-full'

/** Horizontal scrollbare Tabellen — verhindert Layout-Overflow auf schmalen Viewports. */
export const appTableScrollClassName =
  'app-table-scroll -mx-1 max-w-[calc(100%+0.5rem)] overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:max-w-full sm:px-0'

/** Wie oben, ohne negative Außenränder (für verschachtelte Scroll-Container). */
export const appTableScrollInlineClassName =
  'app-table-scroll w-full min-w-0 overflow-x-auto overscroll-x-contain'

/** Standard-Sektionskarte (Finanzen, Lager, …). */
export const pageCardClass =
  'min-w-0 overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-xl shadow-[var(--app-shadow)] ring-1 ring-[var(--app-ring)]'

export const pageCardHeaderClass =
  'border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 sm:p-4'

/** Aktionsleiste in Hero/Sektionen — Buttons stapeln sich auf Mobilgeräten. */
export const pageActionBarClass =
  'flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:w-auto sm:items-center sm:justify-end sm:gap-3'

/** Außenrahmen: Abstand wie Investments (`pb-14 pt-6`, Einblend-Animation). */
export const pageChromeClass =
  'relative w-full min-w-0 max-w-full space-y-6 pb-14 pt-6 animate-in fade-in duration-300 motion-reduce:animate-none'

/** Engerer Außenrahmen (z. B. Finanzen — weniger Scroll). */
export const pageChromeCompactClass =
  'relative w-full min-w-0 max-w-full space-y-3 pb-10 pt-3 animate-in fade-in duration-300 motion-reduce:animate-none'

/** Obere Titelzeile / Hero (gläserner Zinc-Kasten). */
export const pageHeroClass =
  'flex flex-col gap-4 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-5 py-4 shadow-xl shadow-[var(--app-shadow)] ring-1 ring-[var(--app-ring)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-8'

export const pageHeroCompactClass =
  'flex flex-col gap-2 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-4 py-3 shadow-xl shadow-[var(--app-shadow)] ring-1 ring-[var(--app-ring)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-4'

/** Sektionskarte mit optionalem Kopf-Streifen (Investments „Markt“ / „Research“). */
export const pageSectionShellClass =
  'overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-xl shadow-[var(--app-shadow)] ring-1 ring-[var(--app-ring)] backdrop-blur-xl'

export const pageSectionHeaderClass = 'border-b border-[var(--app-border)] px-5 py-4 sm:px-6'

export const pageSectionHeaderCompactClass = 'border-b border-[var(--app-border)] px-4 py-2 sm:px-5'

export const pageSectionTitleClass = 'text-lg font-semibold tracking-tight text-[var(--app-text)]'

export const pageSectionTitleCompactClass = 'text-base font-semibold tracking-tight text-[var(--app-text)]'

export const pageSectionPanelClass = 'px-5 py-5 sm:px-6'

export const pageSectionPanelCompactClass = 'px-4 py-3 sm:px-5 sm:py-4'

export const pageEyebrowClass = 'text-xs font-medium uppercase tracking-wide text-[var(--app-text-muted)]'

export const pageTitleClass = 'text-xl font-semibold tracking-tight text-[var(--app-text)] sm:text-2xl'

export function PageChrome({
  children,
  className,
  density = 'default',
}: {
  children: ReactNode
  className?: string
  /** `compact`: weniger vertikaler Abstand zwischen Blöcken (z. B. Finanzen). */
  density?: 'default' | 'compact'
}) {
  const shell = density === 'compact' ? pageChromeCompactClass : pageChromeClass
  return <div className={[shell, className].filter(Boolean).join(' ')}>{children}</div>
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  density = 'default',
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  density?: 'default' | 'compact'
}) {
  const hero = density === 'compact' ? pageHeroCompactClass : pageHeroClass
  const titleClass =
    density === 'compact'
      ? 'mt-0.5 text-lg font-semibold tracking-tight text-[var(--app-text)] sm:text-xl'
      : 'mt-1 text-xl font-semibold tracking-tight text-[var(--app-text)] sm:text-2xl'
  const descClass =
    density === 'compact'
      ? 'mt-1 text-xs leading-snug text-[var(--app-text-muted)]'
      : 'mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]'
  return (
    <header className={hero}>
      <div className="min-w-0">
        <p
          className={
            density === 'compact'
              ? 'text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]'
              : pageEyebrowClass
          }
        >
          {eyebrow}
        </p>
        <div className={titleClass}>{title}</div>
        {description ? <div className={descClass}>{description}</div> : null}
      </div>
      {actions ? <div className={pageActionBarClass}>{actions}</div> : null}
    </header>
  )
}

export function PageSection({
  titleId,
  title,
  children,
  density = 'default',
}: {
  titleId: string
  title: string
  children: ReactNode
  density?: 'default' | 'compact'
}) {
  const head = density === 'compact' ? pageSectionHeaderCompactClass : pageSectionHeaderClass
  const tit = density === 'compact' ? pageSectionTitleCompactClass : pageSectionTitleClass
  return (
    <section aria-labelledby={titleId} className={pageSectionShellClass}>
      <div className={head}>
        <h2 id={titleId} className={tit}>
          {title}
        </h2>
      </div>
      <div className="divide-y divide-[var(--app-border)]">{children}</div>
    </section>
  )
}

export function PageSectionPanel({
  children,
  density = 'default',
  className,
}: {
  children: ReactNode
  density?: 'default' | 'compact'
  className?: string
}) {
  const panel = density === 'compact' ? pageSectionPanelCompactClass : pageSectionPanelClass
  return <div className={className ? `${panel} ${className}` : panel}>{children}</div>
}

export function ResponsiveTableWrap({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={[appTableScrollClassName, className].filter(Boolean).join(' ')}>{children}</div>
  )
}

type PageSubTabAccent = 'teal' | 'emerald' | 'violet' | 'sky'

const SUB_TAB_ACCENT: Record<PageSubTabAccent, string> = {
  teal: 'bg-teal-600 text-white shadow-sm',
  emerald: 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/30',
  violet: 'bg-violet-600 text-white shadow-sm shadow-violet-950/30',
  sky: 'bg-sky-600 text-white shadow-sm shadow-sky-950/30',
}

/** Sticky Unter-Tabs: Select auf Mobil, Button-Leiste ab sm. */
export function PageSubTabs<T extends string>({
  selectId,
  tabs,
  active,
  onChange,
  ariaLabel,
  className = '',
  sticky = true,
}: {
  selectId: string
  tabs: readonly { id: T; label: string; shortLabel?: string; accent?: PageSubTabAccent }[]
  active: T
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
  sticky?: boolean
}) {
  return (
    <div className={className}>
      <div className="sm:hidden">
        <label htmlFor={selectId} className="sr-only">
          {ariaLabel}
        </label>
        <select
          id={selectId}
          value={active}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] py-3 pl-4 pr-10 text-sm font-medium text-[var(--app-text)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
        >
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`${sticky ? 'sticky top-[var(--app-nav-offset)] z-20 sm:top-2' : ''} hidden min-w-0 gap-1 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)]/95 p-1 shadow-md ring-1 ring-[var(--app-ring)] backdrop-blur-md sm:flex`}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((t) => {
          const on = t.id === active
          const accent = SUB_TAB_ACCENT[t.accent ?? 'teal']
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.id)}
              className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-xs font-bold transition sm:flex-none sm:px-4 sm:text-sm ${
                on
                  ? accent
                  : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'
              }`}
            >
              <span className="sm:hidden">{t.shortLabel ?? t.label}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
