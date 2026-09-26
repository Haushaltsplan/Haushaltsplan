package de.omnia.haushalt;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Log;
import java.util.UUID;

/**
 * Dauerhafter WHOOP-GATT im :whoopble-Prozess (wie die echte WHOOP-App):
 * verbindet, subscribed Heart-Rate, reconnectet aggressiv — unabhängig von der UI.
 */
public class WhoopBleLinkHolder {

    private static final String TAG = "OmniaWhoopBle";
    private static final long RECONNECT_MS = 2000L;
    private static final UUID HR_SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");
    private static final UUID HR_MEASUREMENT = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    public static final String ACTION_HR = "de.omnia.haushalt.WHOOP_HR";
    public static final String ACTION_STATE = "de.omnia.haushalt.WHOOP_STATE";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private BluetoothGatt gatt;
    private String deviceId;
    private boolean armed;
    private boolean scanning;
    private Context appContext;
    private int lastBpm;

    public void setAppForeground(boolean foreground) {
        /* no-op */
    }

    public void arm(Context context, String address) {
        appContext = context.getApplicationContext();
        if (address != null && !address.isEmpty()) {
            deviceId = address;
        }
        armed = true;
        Log.i(TAG, "arm " + deviceId);
        connectOrScan();
        handler.removeCallbacks(watchdog);
        handler.postDelayed(watchdog, RECONNECT_MS);
    }

    public void release() {
        Log.i(TAG, "release");
        armed = false;
        stopScan();
        handler.removeCallbacksAndMessages(null);
        closeGatt();
        broadcastState(false, "getrennt");
    }

    public boolean isArmed() {
        return armed;
    }

    public boolean isConnected() {
        return gatt != null;
    }

    public int getLastBpm() {
        return lastBpm;
    }

    private void connectOrScan() {
        if (!armed || appContext == null) {
            return;
        }
        if (deviceId != null && deviceId.contains(":")) {
            connectAddress(deviceId, false);
            return;
        }
        startWhoopScan();
    }

    private void connectAddress(String address, boolean autoConnect) {
        if (!armed || appContext == null) {
            return;
        }
        BluetoothManager manager =
            (BluetoothManager) appContext.getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager == null) {
            scheduleReconnect();
            return;
        }
        BluetoothAdapter adapter = manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            scheduleReconnect();
            return;
        }
        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            int state = manager.getConnectionState(device, BluetoothProfile.GATT);
            if (state == BluetoothProfile.STATE_CONNECTED && gatt != null) {
                broadcastState(true, "verbunden");
                return;
            }
            closeGatt();
            try {
                if (device.getBondState() == BluetoothDevice.BOND_NONE) {
                    device.createBond();
                }
            } catch (Exception ignored) {}

            broadcastState(false, "verbinde…");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                gatt = device.connectGatt(
                    appContext,
                    autoConnect,
                    gattCallback,
                    BluetoothDevice.TRANSPORT_LE
                );
            } else {
                gatt = device.connectGatt(appContext, autoConnect, gattCallback);
            }
            // Falls Direktconnect scheitert: später autoConnect + Scan
            handler.postDelayed(
                () -> {
                    if (armed && gatt == null) {
                        connectAddress(address, true);
                    }
                },
                8000
            );
        } catch (SecurityException se) {
            Log.e(TAG, "permission", se);
            scheduleReconnect();
        } catch (Exception e) {
            Log.e(TAG, "connect failed", e);
            startWhoopScan();
        }
    }

    private void startWhoopScan() {
        if (!armed || appContext == null || scanning) {
            return;
        }
        BluetoothManager manager =
            (BluetoothManager) appContext.getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager == null) {
            scheduleReconnect();
            return;
        }
        BluetoothAdapter adapter = manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            scheduleReconnect();
            return;
        }
        BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            scheduleReconnect();
            return;
        }
        scanning = true;
        broadcastState(false, "suche WHOOP…");
        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build();
        try {
            scanner.startScan(null, settings, scanCallback);
            handler.postDelayed(this::stopScan, 12_000);
        } catch (SecurityException se) {
            scanning = false;
            scheduleReconnect();
        }
    }

    private void stopScan() {
        if (!scanning || appContext == null) {
            scanning = false;
            return;
        }
        try {
            BluetoothManager manager =
                (BluetoothManager) appContext.getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
            BluetoothLeScanner scanner = adapter != null ? adapter.getBluetoothLeScanner() : null;
            if (scanner != null) {
                scanner.stopScan(scanCallback);
            }
        } catch (Exception ignored) {}
        scanning = false;
    }

    private final ScanCallback scanCallback =
        new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                if (!armed) {
                    return;
                }
                BluetoothDevice device = result.getDevice();
                String name = null;
                try {
                    name = device.getName();
                } catch (SecurityException ignored) {}
                if (name == null && result.getScanRecord() != null) {
                    name = result.getScanRecord().getDeviceName();
                }
                boolean isWhoop = name != null && name.toUpperCase().contains("WHOOP");
                boolean hasHr = false;
                if (result.getScanRecord() != null && result.getScanRecord().getServiceUuids() != null) {
                    for (ParcelUuid u : result.getScanRecord().getServiceUuids()) {
                        if (HR_SERVICE.equals(u.getUuid())) {
                            hasHr = true;
                            break;
                        }
                    }
                }
                if (!isWhoop && !hasHr) {
                    return;
                }
                String addr = device.getAddress();
                deviceId = addr;
                WhoopBleForegroundService.saveDeviceId(appContext, addr);
                stopScan();
                connectAddress(addr, false);
            }

            @Override
            public void onScanFailed(int errorCode) {
                scanning = false;
                scheduleReconnect();
            }
        };

    private void closeGatt() {
        if (gatt != null) {
            try {
                gatt.disconnect();
            } catch (Exception ignored) {}
            try {
                gatt.close();
            } catch (Exception ignored) {}
            gatt = null;
        }
    }

    private void scheduleReconnect() {
        if (!armed) {
            return;
        }
        handler.removeCallbacks(reconnectRunnable);
        handler.postDelayed(reconnectRunnable, RECONNECT_MS);
    }

    private final Runnable reconnectRunnable = () -> connectOrScan();

    private final Runnable watchdog = new Runnable() {
        @Override
        public void run() {
            if (!armed) {
                return;
            }
            if (gatt == null) {
                connectOrScan();
            }
            handler.postDelayed(this, 12_000L);
        }
    };

    private void enableHrNotify(BluetoothGatt g) {
        BluetoothGattService service = g.getService(HR_SERVICE);
        if (service == null) {
            Log.w(TAG, "kein HR-Service");
            return;
        }
        BluetoothGattCharacteristic hr = service.getCharacteristic(HR_MEASUREMENT);
        if (hr == null) {
            Log.w(TAG, "keine HR-Characteristic");
            return;
        }
        g.setCharacteristicNotification(hr, true);
        BluetoothGattDescriptor cccd = hr.getDescriptor(CCCD);
        if (cccd != null) {
            cccd.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            g.writeDescriptor(cccd);
        }
    }

    private void broadcastHr(int bpm) {
        lastBpm = bpm;
        if (appContext == null) {
            return;
        }
        Intent i = new Intent(ACTION_HR);
        i.setPackage(appContext.getPackageName());
        i.putExtra("bpm", bpm);
        i.putExtra("connected", true);
        appContext.sendBroadcast(i);
        // Notification aktualisieren
        Intent svc = new Intent(appContext, WhoopBleForegroundService.class);
        svc.putExtra("action", WhoopBleForegroundService.ACTION_UPDATE_NOTIFY);
        svc.putExtra("title", appContext.getString(R.string.whoop_fg_title));
        svc.putExtra("body", "WHOOP · " + bpm + " bpm · verbunden");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            appContext.startForegroundService(svc);
        } else {
            appContext.startService(svc);
        }
    }

    private void broadcastState(boolean connected, String label) {
        if (appContext == null) {
            return;
        }
        Intent i = new Intent(ACTION_STATE);
        i.setPackage(appContext.getPackageName());
        i.putExtra("connected", connected);
        i.putExtra("label", label);
        appContext.sendBroadcast(i);
    }

    private final BluetoothGattCallback gattCallback =
        new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    Log.i(TAG, "CONNECTED status=" + status);
                    broadcastState(true, "verbunden");
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_BALANCED);
                        }
                    } catch (Exception ignored) {}
                    g.discoverServices();
                    return;
                }
                if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    Log.w(TAG, "DISCONNECTED status=" + status);
                    if (gatt == g) {
                        gatt = null;
                    }
                    try {
                        g.close();
                    } catch (Exception ignored) {}
                    broadcastState(false, "reconnect…");
                    if (armed) {
                        scheduleReconnect();
                    }
                }
            }

            @Override
            public void onServicesDiscovered(BluetoothGatt g, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    enableHrNotify(g);
                }
            }

            @Override
            public void onCharacteristicChanged(
                BluetoothGatt g,
                BluetoothGattCharacteristic characteristic
            ) {
                if (!HR_MEASUREMENT.equals(characteristic.getUuid())) {
                    return;
                }
                byte[] v = characteristic.getValue();
                if (v == null || v.length < 2) {
                    return;
                }
                int flags = v[0] & 0xFF;
                int bpm;
                if ((flags & 0x01) != 0 && v.length >= 3) {
                    bpm = (v[1] & 0xFF) | ((v[2] & 0xFF) << 8);
                } else {
                    bpm = v[1] & 0xFF;
                }
                if (bpm > 0 && bpm < 250) {
                    broadcastHr(bpm);
                }
            }
        };
}
