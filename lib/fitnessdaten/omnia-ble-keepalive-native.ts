import { registerPlugin } from '@capacitor/core'

export type OmniaBleKeepalivePlugin = {
  start(options?: { title?: string; body?: string }): Promise<void>
  stop(): Promise<void>
}

const OmniaBleKeepalive = registerPlugin<OmniaBleKeepalivePlugin>('OmniaBleKeepalive', {
  web: () =>
    Promise.resolve({
      start: async () => {},
      stop: async () => {},
    }),
})

export async function starteOmniaBleKeepalive(): Promise<void> {
  await OmniaBleKeepalive.start({
    title: 'Omnia',
    body: 'WHOOP verbunden — Live-Daten aktiv',
  })
}

export async function stoppeOmniaBleKeepalive(): Promise<void> {
  await OmniaBleKeepalive.stop()
}
