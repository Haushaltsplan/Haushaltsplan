/** Zentrale SFX-Pegel. dB sind relativ zur Stimme auf Pegel 1. */

function pegelAusDb(db: number): number {
  return Math.pow(10, db / 20)
}

export const SFX_CONFIG = {
  /** Bestehender Anschlag auf Frame 0. */
  hookImpact: { datei: 'sfx/hook-impact.mp3', pegel: 0.5 },
  /** Whoosh beim Schnitt in die Moat-Ansicht und beim Crack. −18 bis −22 dB. */
  uebergang: { pegel: pegelAusDb(-20) },
  /** Klick auf jedem neuen Bewertungsbalken. */
  balken: { pegel: pegelAusDb(-22) },
  /** Tick, wenn die Hero-Zahl zu Satz 2 eingeblendet wird. */
  heroTick: { pegel: pegelAusDb(-20) },
  /** Aufschlag des Verdict-Stempels. */
  stempel: { pegel: pegelAusDb(-12) },
  /** Stille nach dem letzten Wort, bevor der Short wieder vorne einsetzt. */
  loopLuftSekunden: 0.22,
  /** Ausklang des letzten Wortes, eine Frame-Länge bei 30 fps. */
  wortFadeMs: 30,
} as const
