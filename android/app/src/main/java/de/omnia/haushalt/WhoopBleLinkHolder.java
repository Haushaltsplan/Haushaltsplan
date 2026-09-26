package de.omnia.haushalt;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.RequiresPermission;

/**
 * Nativer WHOOP-GATT, wenn Capgo/WebView tot ist (App aus Recents, Neustart).
 * Solange die App nur minimiert / Display aus ist, hält Capgo den Link — dieser
 * Holder darf dann NICHT disconnecten.
 */
public class WhoopBleLinkHolder {

    private static final String TAG = "OmniaWhoopBle";
    private static final long RECONNECT_MS = 2500L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private BluetoothGatt gatt;
    private String deviceId;
    private boolean armed;
    private Context appContext;

    /** Nur Flag — kein Disconnect (sonst killt Resume den Hintergrund-Link). */
    public void setAppForeground(boolean foreground) {
        /* no-op for disconnect; kept for API compat */
    }

    @RequiresPermission(allOf = { android.Manifest.permission.BLUETOOTH_CONNECT })
    public void arm(Context context, String address) {
        appContext = context.getApplicationContext();
        deviceId = address;
        armed = true;
        Log.i(TAG, "arm native GATT " + address);
        connectIfNeeded();
        handler.removeCallbacks(watchdog);
        handler.postDelayed(watchdog, RECONNECT_MS);
    }

    @RequiresPermission(android.Manifest.permission.BLUETOOTH_CONNECT)
    public void release() {
        Log.i(TAG, "release native GATT");
        armed = false;
        handler.removeCallbacksAndMessages(null);
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

    public boolean isArmed() {
        return armed;
    }

    @RequiresPermission(allOf = { android.Manifest.permission.BLUETOOTH_CONNECT })
    private void connectIfNeeded() {
        if (!armed || deviceId == null || appContext == null) {
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
            BluetoothDevice device = adapter.getRemoteDevice(deviceId);
            int state = manager.getConnectionState(device, BluetoothProfile.GATT);
            if (state == BluetoothProfile.STATE_CONNECTED && gatt != null) {
                return;
            }
            if (gatt != null) {
                try {
                    gatt.close();
                } catch (Exception ignored) {}
                gatt = null;
            }
            // autoConnect=true → Android hält/reconnectet aggressiver im Hintergrund
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                gatt = device.connectGatt(
                    appContext,
                    true,
                    gattCallback,
                    BluetoothDevice.TRANSPORT_LE
                );
            } else {
                gatt = device.connectGatt(appContext, true, gattCallback);
            }
        } catch (SecurityException se) {
            Log.e(TAG, "BLUETOOTH_CONNECT fehlt", se);
            scheduleReconnect();
        } catch (Exception e) {
            Log.e(TAG, "connectGatt failed", e);
            scheduleReconnect();
        }
    }

    private void scheduleReconnect() {
        if (!armed) {
            return;
        }
        handler.removeCallbacks(reconnectRunnable);
        handler.postDelayed(reconnectRunnable, RECONNECT_MS);
    }

    private final Runnable reconnectRunnable = new Runnable() {
        @Override
        public void run() {
            connectIfNeeded();
        }
    };

    /** Periodischer Check, falls Disconnect-Callback ausbleibt. */
    private final Runnable watchdog = new Runnable() {
        @Override
        public void run() {
            if (!armed) {
                return;
            }
            connectIfNeeded();
            handler.postDelayed(this, 15_000L);
        }
    };

    private final BluetoothGattCallback gattCallback =
        new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    Log.i(TAG, "native GATT connected status=" + status);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        try {
                            // Balanced hält besser im Doze als HIGH
                            g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_BALANCED);
                        } catch (Exception ignored) {}
                    }
                    try {
                        g.discoverServices();
                    } catch (Exception ignored) {}
                    return;
                }
                if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    Log.w(TAG, "native GATT disconnected status=" + status);
                    if (gatt == g) {
                        gatt = null;
                    }
                    try {
                        g.close();
                    } catch (Exception ignored) {}
                    if (armed) {
                        scheduleReconnect();
                    }
                }
            }
        };
}
