'use client'

/** Whoop-Cloud-Panel entfernt — Abo/API deaktiviert. */
export function FitnessWhoopCloudPanel(_props: {
  onSyncComplete?: () => void
  embedded?: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 text-[13px] text-[var(--app-text-muted)]">
      <p className="font-semibold text-[var(--app-text)]">Whoop-Cloud deaktiviert</p>
      <p className="mt-1.5 leading-relaxed">
        Ohne Whoop-Abo gibt es keinen Cloud-Sync. Verbinde das Band per Bluetooth — Scores und History
        laufen lokal und über deinen Omnia-Login.
      </p>
    </div>
  )
}
