/** Finanz-spezifische Aliase — gemeinsame Basis in lib/app-ui.ts */
export {
  appCardClass as finanzCardClass,
  appDataTableClass as finanzTableClass,
  appTableFrameClass as finanzTableFrameClass,
  appEmptyClass as finanzEmptyClass,
  appInputClass as finanzInputClass,
  appKpiCardClass as finanzKpiCardClass,
  appKpiCardCompactClass as finanzKpiCardCompactClass,
  appLabelSmClass as finanzLabelMutedClass,
  appListItemClass as finanzListItemClass,
  appMonatPickerClass as finanzMonatPickerClass,
  appSecondaryBtnClass as finanzSecondaryBtnClass,
  appSectionCardClass,
  appTitleClass as finanzTitleClass,
} from '@/lib/app-ui'

export const finanzMonatSliderClass =
  'mt-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5 sm:px-4 sm:py-3'

export const finanzToggleGroupClass =
  'inline-flex rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-0.5 text-[11px] font-semibold'

export const finanzTypeToggleClass =
  'flex w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1 shadow-inner'

export const finanzToggleInactiveClass =
  'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'

export const finanzListeFilterGroupClass =
  'grid min-w-0 w-full max-w-full grid-cols-3 overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-0.5 shadow-inner lg:inline-flex lg:w-auto lg:max-w-none lg:flex-none lg:shrink-0 lg:justify-start'

export const finanzEinnahmenAusgabenBoxClass =
  'flex min-w-0 shrink-0 items-stretch justify-center gap-0 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1 shadow-inner sm:rounded-2xl'

export const finanzEinnahmenAusgabenCellClass =
  'flex min-w-0 flex-1 flex-col justify-center rounded-lg bg-[var(--app-surface)] px-3 py-2.5 text-left sm:rounded-xl sm:px-4 sm:py-3'
