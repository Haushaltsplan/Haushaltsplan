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
import androidx.annotation.RequiresPermission;

/**
 * Hält die WHOOP-BLE-Verbindung nativ aufrecht, wenn die Omnia-UI geschlossen ist.
 */
public class WhoopBleLinkHolder {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private BluetoothGatt gatt;
    private String deviceId;
    private boolean armed;
    private boolean appForeground = true;
    private Context appContext;

    public void setAppForeground(boolean foreground) {
        appForeground = foreground;
        if (foreground) {
            release();
        }
    }

    @RequiresPermission(allOf = { android.Manifest.permission.BLUETOOTH_CONNECT })
    public void arm(Context context, String address) {
        appContext = context.getApplicationContext();
        deviceId = address;
        armed = true;
        connectIfNeeded();
    }

    @RequiresPermission(android.Manifest.permission.BLUETOOTH_CONNECT)
    public void release() {
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
        if (!armed || appForeground || deviceId == null || appContext == null) {
            return;
        }
        BluetoothManager manager = (BluetoothManager) appContext.getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager == null) {
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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                gatt = device.connectGatt(appContext, true, gattCallback, BluetoothDevice.TRANSPORT_LE);
            } else {
                gatt = device.connectGatt(appContext, true, gattCallback);
            }
        } catch (Exception ignored) {
            scheduleReconnect();
        }
    }

    private void scheduleReconnect() {
        if (!armed || appForeground) {
            return;
        }
        handler.removeCallbacks(reconnectRunnable);
        handler.postDelayed(reconnectRunnable, 3000);
    }

    private final Runnable reconnectRunnable = new Runnable() {
        @Override
        public void run() {
            connectIfNeeded();
        }
    };

    private final BluetoothGattCallback gattCallback =
        new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        try {
                            g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH);
                        } catch (Exception ignored) {}
                    }
                    return;
                }
                if (newState == BluetoothProfile.STATE_DISCONNECTED && armed && !appForeground) {
                    gatt = null;
                    scheduleReconnect();
                }
            }
        };
}
