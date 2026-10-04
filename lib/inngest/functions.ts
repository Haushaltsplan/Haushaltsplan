import { inngest } from '@/lib/inngest/client'
import { runWithPrimaeremOwner } from '@/lib/request-owner'
import { laufeScan } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-scan-server'

/**
 * Durable Nachkauf-Cron-Scan: mehrere Steps à max. 3 Titel,
 * statt alles in einem Vercel-Timeout.
 */
export const nachkaufCronScanFn = inngest.createFunction(
  {
    id: 'nachkauf-cron-scan',
    retries: 2,
    triggers: [{ event: 'nachkauf/cron.scan' }],
  },
  async ({ step }) => {
    return runWithPrimaeremOwner(async () => {
      let offset = 0
      let gescanntGesamt = 0
      let gesamtAnzahl = 0
      const MAX_RUNDEN = 16

      for (let runde = 0; runde < MAX_RUNDEN; runde++) {
        const ergebnis = await step.run(`scan-runde-${runde}`, async () =>
          laufeScan({
            erzwingen: false,
            offset,
            maxProAufruf: 3,
            zeitBudgetMs: 50_000,
          }),
        )

        gesamtAnzahl = ergebnis.gesamtAnzahl
        if (ergebnis.gescannt === 0) break
        gescanntGesamt += ergebnis.gescannt
        offset += ergebnis.gescannt
        if ((ergebnis.verbleibend ?? 0) === 0) break
      }

      return {
        ok: true as const,
        gescannt: gescanntGesamt,
        gesamtAnzahl,
        zeitstempel: new Date().toISOString(),
      }
    })
  },
)

export const inngestFunctions = [nachkaufCronScanFn]
