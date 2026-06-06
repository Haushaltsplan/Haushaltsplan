/** Minimale Web-Bluetooth-Typen für Fitnessdaten (WHOOP Standard-HR). */

interface BluetoothDevice extends EventTarget {
  readonly name?: string
  readonly gatt?: BluetoothRemoteGATTServer
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: number | string): Promise<BluetoothRemoteGATTService>
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>
}

interface BluetoothRemoteGATTService {
  readonly uuid: string
  getCharacteristic(characteristic: number | string): Promise<BluetoothRemoteGATTCharacteristic>
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>
}

interface BluetoothCharacteristicProperties {
  read: boolean
  write: boolean
  writeWithoutResponse: boolean
  notify: boolean
  indicate: boolean
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly uuid: string
  readonly value?: DataView | null
  readonly properties: BluetoothCharacteristicProperties
  readValue(): Promise<DataView>
  writeValue(data: BufferSource): Promise<void>
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  addEventListener(type: 'characteristicvaluechanged', listener: (ev: Event) => void): void
  removeEventListener(type: 'characteristicvaluechanged', listener: (ev: Event) => void): void
}

interface BluetoothRequestDeviceFilter {
  namePrefix?: string
  services?: Array<number | string>
}

interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[]
  optionalServices?: Array<number | string>
  acceptAllDevices?: boolean
}

interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>
  getDevices?(): Promise<BluetoothDevice[]>
}

interface Navigator {
  bluetooth?: Bluetooth
}
