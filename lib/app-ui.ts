/**
 * App-weite, theme-konforme UI-Klassen — für Finanzen, Lager, Besitz, Kalender, Auth, …
 * Nutzt CSS-Variablen aus globals.css (Light + Dark).
 */

export const appKpiCardClass =
  'rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-4'

export const appKpiCardCompactClass =
  'rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3'

export const appListItemClass =
  'flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3'

export const appEmptyClass =
  'rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-8 text-center text-sm italic text-[var(--app-text-muted)]'

export const appInputClass =
  'w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-teal-500/30'

export const appInputLgClass =
  'w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-3 text-[15px] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-teal-500/30'

export const appInputAmberClass =
  'w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-3 text-[var(--app-text)] outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25'

export const appSecondaryBtnClass =
  'rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)]'

export const appGhostBtnClass =
  'rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm font-bold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)]'

export const appCardClass =
  'overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-xl shadow-[var(--app-shadow)] ring-1 ring-[var(--app-ring)]'

export const appCardHeaderClass = 'border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-3 sm:px-4'

export const appSectionCardClass =
  'rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-4 shadow-lg shadow-[var(--app-shadow)] sm:p-5'

export const appLabelClass =
  'text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]'

export const appLabelSmClass =
  'text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]'

export const appTitleClass = 'truncate text-[14px] font-semibold text-[var(--app-text)]'

export const appMonatPickerClass =
  'flex w-full min-w-0 flex-wrap items-stretch gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1 shadow-inner sm:inline-flex sm:w-auto sm:flex-nowrap'

export const appLoadingClass =
  'flex min-h-[14rem] items-center justify-center rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 text-sm text-[var(--app-text-muted)] shadow-lg shadow-[var(--app-shadow)]'
