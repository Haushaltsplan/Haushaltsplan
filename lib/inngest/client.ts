import { Inngest } from 'inngest'

/** App-ID für Inngest Cloud / Dev-Server. */
export const inngest = new Inngest({ id: 'mein-haushalt' })

export function inngestConfigured(): boolean {
  return Boolean(
    process.env.INNGEST_EVENT_KEY ||
      process.env.INNGEST_DEV === '1' ||
      process.env.INNGEST_DEV === 'true',
  )
}
