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
 * Dauerhafter WHOOP-GATT im Hauptprozess (Foreground Service hält den Prozess).
 */
public class WhoopBleLinkHolder {

    private static final String TAG = "OmniaWhoopBle";
    private static final long RECONNECT_MS = 2500L;
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
    private boolean connected;
    private boolean connecting;
    private Context appContext;
    private int lastBpm;

    public void setAppForeground(boolean foreground) {
        /* no-op */
    }

    public void arm(Context context, String address) {
        appContext = context.getApplicationContext();
        if (address != null && !address.isEmpty()) {
            deviceId = normalizeAddress(address);
        }
        armed = true;
        Log.i(TAG, "arm id=" + deviceId + " connected=" + connected);
        if (connected && gatt != null) {
            broadcastState(true, "verbunden");
            return;
        }
        connectOrScan();
        handler.removeCallbacks(watchdog);
        handler.postDelayed(watchdog, RECONNECT_MS);
    }

    public void release() {
        Log.i(TAG, "release");
        armed = false;
        connected = false;
        connecting = false;
        stopScan();
        handler.removeCallbacksAndMessages(null);
        closeGatt();
        broadcastState(false, "getrennt");
    }

    public boolean isArmed() {
        return armed;
    }

    public boolean isConnected() {
        return connected;
    }

    public int getLastBpm() {
        return lastBpm;
    }

    private static String normalizeAddress(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        // Manche Shims liefern MAC ohne Doppelpunkte
        if (t.matches("(?i)[0-9A-F]{12}")) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 12; i += 2) {
                if (i > 0) {
                    sb.append(':');
                }
                sb.append(t.substring(i, i + 2));
            }
            return sb.toString().toUpperCase();
        }
        return t.toUpperCase();
    }

    private boolean looksLikeMac(String id) {
        return id != null && id.matches("(?i)([0-9A-F]{2}:){5}[0-9A-F]{2}");
    }

    private void connectOrScan() {
        if (!armed || appContext == null || connecting) {
            return;
        }
        if (looksLikeMac(deviceId)) {
            connectAddress(deviceId, true);
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
            if (state == BluetoothProfile.STATE_CONNECTED && gatt != null && connected) {
                broadcastState(true, "verbunden");
                return;
            }

            closeGatt();
            connecting = true;
            connected = false;
            broadcastState(false, "verbinde…");

            // autoConnect=true: Android reconnectet auch nach App-Schließen zuverlässiger
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
            Log.i(TAG, "connectGatt auto=" + autoConnect + " addr=" + address);
        } catch (SecurityException se) {
            connecting = false;
            Log.e(TAG, "permission", se);
            scheduleReconnect();
        } catch (Exception e) {
            connecting = false;
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
            handler.postDelayed(
                () -> {
                    stopScan();
                    if (armed && !connected) {
                        scheduleReconnect();
                    }
                },
                15_000
            );
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
                if (!armed || connected) {
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
                String addr = normalizeAddress(device.getAddress());
                deviceId = addr;
                WhoopBleStore.setDeviceId(appContext, addr);
                stopScan();
                connectAddress(addr, true);
            }

            @Override
            public void onScanFailed(int errorCode) {
                scanning = false;
                Log.w(TAG, "scan failed " + errorCode);
                scheduleReconnect();
            }
        };

    private void closeGatt() {
        connecting = false;
        connected = false;
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

    private final Runnable reconnectRunnable =
        () -> {
            connecting = false;
            connectOrScan();
        };

    private final Runnable watchdog =
        new Runnable() {
            @Override
            public void run() {
                if (!armed) {
                    return;
                }
                if (!connected || gatt == null) {
                    Log.i(TAG, "watchdog reconnect");
                    connecting = false;
                    connectOrScan();
                } else {
                    // Zusätzlich OS-State prüfen
                    try {
                        BluetoothManager manager =
                            (BluetoothManager) appContext.getSystemService(Context.BLUETOOTH_SERVICE);
                        if (manager != null && looksLikeMac(deviceId)) {
                            BluetoothDevice device = manager.getAdapter().getRemoteDevice(deviceId);
                            int state = manager.getConnectionState(device, BluetoothProfile.GATT);
                            if (state != BluetoothProfile.STATE_CONNECTED) {
                                connected = false;
                                closeGatt();
                                connectOrScan();
                            }
                        }
                    } catch (Exception ignored) {}
                }
                handler.postDelayed(this, 10_000L);
            }
        };

    private void enableHrNotify(BluetoothGatt g) {
        BluetoothGattService service = g.getService(HR_SERVICE);
        if (service == null) {
            Log.w(TAG, "kein HR-Service — Scan/Reconnect");
            scheduleReconnect();
            return;
        }
        BluetoothGattCharacteristic hr = service.getCharacteristic(HR_MEASUREMENT);
        if (hr == null) {
            Log.w(TAG, "keine HR-Characteristic");
            return;
        }
        boolean ok = g.setCharacteristicNotification(hr, true);
        Log.i(TAG, "HR notify enable=" + ok);
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

        Intent svc = new Intent(appContext, WhoopBleForegroundService.class);
        svc.putExtra("action", WhoopBleForegroundService.ACTION_UPDATE_NOTIFY);
        svc.putExtra("title", appContext.getString(R.string.whoop_fg_title));
        svc.putExtra("body", "WHOOP · " + bpm + " bpm · verbunden");
        String id = deviceId;
        if (id != null) {
            svc.putExtra("deviceId", id);
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appContext.startForegroundService(svc);
            } else {
                appContext.startService(svc);
            }
        } catch (Exception e) {
            Log.e(TAG, "notify update failed", e);
        }
    }

    private void broadcastState(boolean isConnected, String label) {
        if (appContext == null) {
            return;
        }
        Intent i = new Intent(ACTION_STATE);
        i.setPackage(appContext.getPackageName());
        i.putExtra("connected", isConnected);
        i.putExtra("label", label);
        appContext.sendBroadcast(i);
    }

    private final BluetoothGattCallback gattCallback =
        new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
                connecting = false;
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    Log.i(TAG, "CONNECTED status=" + status);
                    gatt = g;
                    connected = true;
                    broadcastState(true, "verbunden");
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_BALANCED);
                        }
                    } catch (Exception ignored) {}
                    boolean disc = g.discoverServices();
                    Log.i(TAG, "discoverServices=" + disc);
                    return;
                }
                if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    Log.w(TAG, "DISCONNECTED status=" + status);
                    connected = false;
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
                Log.i(TAG, "services status=" + status);
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    enableHrNotify(g);
                } else if (armed) {
                    scheduleReconnect();
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
