import type { ReactNode } from 'react'

/** Außenrahmen: Abstand wie Investments (`pb-14 pt-6`, Einblend-Animation). */
export const pageChromeClass =
  'relative w-full min-w-0 space-y-6 pb-14 pt-6 animate-in fade-in duration-300 motion-reduce:animate-none'

/** Obere Titelzeile / Hero (gläserner Zinc-Kasten). */
export const pageHeroClass =
  'flex flex-col gap-4 rounded-2xl border border-zinc-700/35 bg-zinc-950/55 px-5 py-4 shadow-xl shadow-black/20 ring-1 ring-white/[0.04] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-8'

/** Sektionskarte mit optionalem Kopf-Streifen (Investments „Markt“ / „Research“). */
export const pageSectionShellClass =
  'overflow-hidden rounded-2xl border border-zinc-700/35 bg-zinc-950/50 shadow-xl shadow-black/25 ring-1 ring-white/[0.04] backdrop-blur-xl'

export const pageSectionHeaderClass = 'border-b border-zinc-800/70 px-5 py-4 sm:px-6'

export const pageSectionTitleClass = 'text-lg font-semibold tracking-tight text-white'

export const pageSectionPanelClass = 'px-5 py-5 sm:px-6'

export const pageEyebrowClass = 'text-xs font-medium uppercase tracking-wide text-zinc-400'

export const pageTitleClass = 'text-xl font-semibold tracking-tight text-white sm:text-2xl'

export function PageChrome({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[pageChromeClass, className].filter(Boolean).join(' ')}>{children}</div>
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className={pageHeroClass}>
      <div className="min-w-0">
        <p className={pageEyebrowClass}>{eyebrow}</p>
        <div className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</div>
        {description ? <div className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  )
}

export function PageSection({
  titleId,
  title,
  children,
}: {
  titleId: string
  title: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={titleId} className={pageSectionShellClass}>
      <div className={pageSectionHeaderClass}>
        <h2 id={titleId} className={pageSectionTitleClass}>
          {title}
        </h2>
      </div>
      <div className="divide-y divide-zinc-800/70">{children}</div>
    </section>
  )
}

export function PageSectionPanel({ children }: { children: ReactNode }) {
  return <div className={pageSectionPanelClass}>{children}</div>
}
