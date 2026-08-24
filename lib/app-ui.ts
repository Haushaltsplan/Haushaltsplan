/**
 * App-weite, theme-konforme UI-Klassen — für Finanzen, Lager, Modeberater, Kalender, Auth, …
 * Nutzt CSS-Variablen + Premium-Oberflächen aus globals.css (Light + Dark).
 */

export const appKpiCardClass = 'app-kpi-tile p-4'

export const appKpiCardCompactClass = 'app-kpi-tile p-3'

export const appListItemClass =
  'flex items-center gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 transition hover:border-[var(--app-border-strong)]'

export const appEmptyClass =
  'rounded-[var(--app-radius-lg)] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-8 text-center text-sm italic text-[var(--app-text-muted)]'

export const appInputClass =
  'app-input-premium w-full px-3 py-2.5 text-sm text-[var(--app-text)]'

export const appInputLgClass =
  'app-input-premium w-full px-4 py-3 text-[15px] text-[var(--app-text)]'

export const appInputAmberClass =
  'app-input-premium w-full px-4 py-3 text-[var(--app-text)] focus:border-amber-600/50 focus:shadow-[0_0_0_3px_rgb(245_158_11/0.15)]'

export const appSecondaryBtnClass =
  'rounded-[0.875rem] border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm font-semibold text-[var(--app-text-muted)] shadow-sm transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'

export const appGhostBtnClass =
  'rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm font-bold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'

export const appCardClass = 'app-surface-card min-w-0'

export const appCardHeaderClass = 'app-surface-card-header px-3 py-3 sm:px-4'

export const appSectionCardClass = 'app-section-shell p-4 sm:p-5'

export const appLabelClass = 'app-eyebrow text-[10px]'

export const appLabelSmClass = 'app-eyebrow text-[9px]'

export const appTitleClass = 'truncate text-[14px] font-semibold tracking-tight text-[var(--app-text)]'

export const appMonatPickerClass =
  'flex w-full min-w-0 flex-wrap items-stretch gap-1 rounded-[0.875rem] border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1 shadow-inner sm:inline-flex sm:w-auto sm:flex-nowrap'

export const appLoadingClass =
  'app-surface-card flex min-h-[14rem] items-center justify-center px-4 text-sm text-[var(--app-text-muted)]'

/** Premium-Datentabelle (siehe globals.css `.app-data-table`). */
export const appDataTableClass = 'app-data-table w-full text-left text-sm'

export const appDataTableCompactClass = 'app-data-table app-data-table-compact w-full text-left text-xs'

export const appTableFrameClass = 'app-table-frame'

export const appChartFrameClass = 'app-chart-frame'
