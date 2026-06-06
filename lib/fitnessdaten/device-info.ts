import type { WhoopDeviceInfo } from '@/lib/fitnessdaten/types'

const DEVICE_INFO_CHARS: { uuid: string; key: keyof WhoopDeviceInfo }[] = [
  { uuid: 'manufacturer_name_string', key: 'manufacturer' },
  { uuid: 'model_number_string', key: 'model' },
  { uuid: 'hardware_revision_string', key: 'hardwareRevision' },
  { uuid: 'firmware_revision_string', key: 'firmwareRevision' },
  { uuid: 'serial_number_string', key: 'serialHint' },
]

function decodeUtf8(data: DataView): string {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim()
}

export async function leseWhoopDeviceInfo(gatt: BluetoothRemoteGATTServer): Promise<WhoopDeviceInfo> {
  const info: WhoopDeviceInfo = {}
  try {
    const svc = await gatt.getPrimaryService('device_information')
    for (const { uuid, key } of DEVICE_INFO_CHARS) {
      try {
        const chr = await svc.getCharacteristic(uuid)
        const val = await chr.readValue()
        if (val.byteLength > 0) {
          ;(info as Record<string, string | null | undefined>)[key] = decodeUtf8(val)
        }
      } catch {
        /* optional char */
      }
    }
  } catch {
    /* no device info service */
  }
  return info
}

export async function abonniereBatteryUpdates(
  gatt: BluetoothRemoteGATTServer,
  onPercent: (pct: number) => void,
): Promise<(() => void) | null> {
  try {
    const svc = await gatt.getPrimaryService('battery_service')
    const chr = await svc.getCharacteristic('battery_level')
    const val = await chr.readValue()
    if (val.byteLength >= 1) onPercent(val.getUint8(0))

    if (!chr.properties.notify) return null

    const handler = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      const v = target.value
      if (v && v.byteLength >= 1) onPercent(v.getUint8(0))
    }
    chr.addEventListener('characteristicvaluechanged', handler)
    await chr.startNotifications()
    return () => {
      try {
        chr.removeEventListener('characteristicvaluechanged', handler)
        void chr.stopNotifications()
      } catch {
        /* ignore */
      }
    }
  } catch {
    return null
  }
}
