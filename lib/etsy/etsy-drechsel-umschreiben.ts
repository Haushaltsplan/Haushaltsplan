/** Batch: handgedreht → handgedrechselt in Titel, Beschreibung, Tags (Etsy live). */

import 'server-only'

import {
  baueDrechselUmschreibung,
  enthaeltVeraltetesHandgedreht,
} from '@/lib/etsy/etsy-drechsel-sprache'
import {
  ladeEtsyListingDetail,
  ladeEtsyShopListings,
  updateEtsyListing,
} from '@/lib/etsy/etsy-listings-server'
import { protokolliereEtsyAenderung } from '@/lib/etsy/etsy-statistik-server'

export type DrechselUmschreibZeile = {
  listingId: number
  title: string
  ok: boolean
  geaendert: boolean
  felder: string[]
  fehler?: string
  neuerTitel?: string
}

export type DrechselUmschreibErgebnis = {
  geprueft: number
  betroffen: number
  umgeschrieben: number
  fehlgeschlagen: number
  unveraendert: number
  ergebnisse: DrechselUmschreibZeile[]
}

async function pause(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function zaehleHandgedrehtListings(ownerUserId: string): Promise<{
  betroffen: number
  geprueft: number
  listings: Array<{ listingId: number; title: string }>
}> {
  const { listings } = await ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100 })
  const betroffen: Array<{ listingId: number; title: string }> = []

  for (const kurz of listings) {
    // Titel/Tags reichen oft — Detail nur wenn dort noch nichts gefunden
    if (enthaeltVeraltetesHandgedreht(`${kurz.title}\n${kurz.tags.join(' ')}`)) {
      betroffen.push({ listingId: kurz.listingId, title: kurz.title })
      continue
    }
    try {
      const { listing } = await ladeEtsyListingDetail(ownerUserId, kurz.listingId)
      if (enthaeltVeraltetesHandgedreht(listing.description)) {
        betroffen.push({ listingId: listing.listingId, title: listing.title })
      }
      await pause(60)
    } catch {
      /* Detail optional für Zähler */
    }
  }

  return { betroffen: betroffen.length, geprueft: listings.length, listings: betroffen }
}

export async function schreibeHandgedrehtUm(
  ownerUserId: string,
  opts?: { dryRun?: boolean; listingIds?: number[]; state?: string },
): Promise<DrechselUmschreibErgebnis> {
  const state = opts?.state || 'active'
  const { listings: alle } = await ladeEtsyShopListings(ownerUserId, { state, limit: 100 })
  const ziel = opts?.listingIds?.length
    ? alle.filter((l) => opts.listingIds!.includes(l.listingId))
    : alle

  const ergebnisse: DrechselUmschreibZeile[] = []
  let umgeschrieben = 0
  let fehlgeschlagen = 0
  let unveraendert = 0
  let betroffen = 0

  for (const kurz of ziel) {
    try {
      const { listing } = await ladeEtsyListingDetail(ownerUserId, kurz.listingId)
      const plan = baueDrechselUmschreibung({
        title: listing.title,
        description: listing.description,
        tags: listing.tags,
      })

      if (!plan.needsUpdate) {
        unveraendert++
        ergebnisse.push({
          listingId: listing.listingId,
          title: listing.title,
          ok: true,
          geaendert: false,
          felder: [],
        })
        await pause(80)
        continue
      }

      betroffen++
      const felder = [
        plan.aenderungen.title ? 'Titel' : '',
        plan.aenderungen.description ? 'Beschreibung' : '',
        plan.aenderungen.tags ? 'Tags' : '',
      ].filter(Boolean)

      if (opts?.dryRun) {
        umgeschrieben++
        ergebnisse.push({
          listingId: listing.listingId,
          title: listing.title,
          ok: true,
          geaendert: true,
          felder,
          neuerTitel: plan.aenderungen.title ? plan.title : undefined,
        })
        continue
      }

      const updated = await updateEtsyListing(ownerUserId, listing.listingId, {
        ...(plan.aenderungen.title ? { title: plan.title } : {}),
        ...(plan.aenderungen.description ? { description: plan.description } : {}),
        ...(plan.aenderungen.tags ? { tags: plan.tags } : {}),
      })

      await protokolliereEtsyAenderung({
        ownerUserId,
        listingId: listing.listingId,
        listingTitle: listing.title,
        quelle: 'aufgabe',
        beschreibung: `Handwerk-Sprache: handgedreht → handgedrechselt (${felder.join(', ')})`,
        before: {
          title: listing.title,
          tags: listing.tags,
          description: listing.description,
        },
        after: {
          title: updated.title,
          tags: updated.tags,
          description: updated.description,
        },
      })

      umgeschrieben++
      ergebnisse.push({
        listingId: listing.listingId,
        title: listing.title,
        ok: true,
        geaendert: true,
        felder,
        neuerTitel: plan.aenderungen.title ? plan.title : undefined,
      })
      await pause(280)
    } catch (e) {
      fehlgeschlagen++
      betroffen++
      ergebnisse.push({
        listingId: kurz.listingId,
        title: kurz.title,
        ok: false,
        geaendert: false,
        felder: [],
        fehler: e instanceof Error ? e.message.slice(0, 200) : 'Fehler',
      })
    }
  }

  return {
    geprueft: ziel.length,
    betroffen,
    umgeschrieben,
    fehlgeschlagen,
    unveraendert,
    ergebnisse,
  }
}
