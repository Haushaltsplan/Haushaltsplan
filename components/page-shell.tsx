import type { ReactNode } from 'react'

/** Außenrahmen: Abstand wie Investments (`pb-14 pt-6`, Einblend-Animation). */
export const pageChromeClass =
  'relative w-full min-w-0 space-y-6 pb-14 pt-6 animate-in fade-in duration-300 motion-reduce:animate-none'

/** Engerer Außenrahmen (z. B. Finanzen — weniger Scroll). */
export const pageChromeCompactClass =
  'relative w-full min-w-0 space-y-3 pb-10 pt-3 animate-in fade-in duration-300 motion-reduce:animate-none'

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
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
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
}: {
  children: ReactNode
  density?: 'default' | 'compact'
}) {
  const panel = density === 'compact' ? pageSectionPanelCompactClass : pageSectionPanelClass
  return <div className={panel}>{children}</div>
}
