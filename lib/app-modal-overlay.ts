/**
 * Einheitliche Modal-/Overlay-Schale über Seiten hinweg (Lager, Finanzen, KI-Coach).
 * Mobil: Panel von unten; ab `sm`: vertikal zentriert.
 * `z-[70]` liegt über dem KI-Floating-Button (`z-[60]`) und der mobilen Navigation (`z-40`).
 */
export const appModalBackdropClassName =
  'fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-4'

/** Kompakte Dialoge (Formulare, Bestätigungen). */
export const appModalPanelClassName =
  'w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50'

/** Breiteres, scrollbares Panel (z. B. manuelle Mahlzeit). */
export const appModalPanelWideScrollClassName =
  'max-h-[min(92vh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50'

/** KI-Coach: fester Rahmen, Inhalt scrollt innen (KI-erkennbar: Violett-Akzent). */
export const appModalPanelCoachClassName =
  'flex max-h-[min(92vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-violet-500/45 bg-gradient-to-b from-violet-950/45 to-slate-900 shadow-2xl shadow-violet-950/25 ring-1 ring-violet-400/15'
