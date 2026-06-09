import { registerPlugin } from '@capacitor/core'

export type OmniaBleKeepalivePlugin = {
  start(options?: { title?: string; body?: string; deviceId?: string }): Promise<void>
  stop(): Promise<void>
  armNativeLink(options?: { deviceId?: string }): Promise<void>
  releaseNativeLink(): Promise<void>
  openBatterySettings(): Promise<void>
  isBatteryOptimized(): Promise<{ ignored: boolean }>
}

const OmniaBleKeepalive = registerPlugin<OmniaBleKeepalivePlugin>('OmniaBleKeepalive', {
  web: () =>
    Promise.resolve({
      start: async () => {},
      stop: async () => {},
      armNativeLink: async () => {},
      releaseNativeLink: async () => {},
      openBatterySettings: async () => {},
      isBatteryOptimized: async () => ({ ignored: true }),
    }),
})

export async function starteOmniaBleKeepalive(deviceId?: string): Promise<void> {
  await OmniaBleKeepalive.start({
    title: 'Omnia',
    body: 'WHOOP verbunden — Hintergrund aktiv',
    deviceId,
  })
}

export async function stoppeOmniaBleKeepalive(): Promise<void> {
  await OmniaBleKeepalive.stop()
}

export async function armeNativeWhoopLink(deviceId?: string): Promise<void> {
  await OmniaBleKeepalive.armNativeLink(deviceId ? { deviceId } : {})
}

export async function gebeNativeWhoopLinkFrei(): Promise<void> {
  await OmniaBleKeepalive.releaseNativeLink()
}

export async function oeffneAkkuEinstellungen(): Promise<void> {
  await OmniaBleKeepalive.openBatterySettings()
}
