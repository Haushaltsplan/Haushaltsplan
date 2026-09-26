package de.omnia.haushalt;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * Foreground Service im Hauptprozess: hält Prozess + natives WHOOP-GATT,
 * auch wenn die Activity geschlossen wurde (stopWithTask=false).
 */
public class WhoopBleForegroundService extends Service {

    private static final String TAG = "OmniaWhoopFg";

    public static final String CHANNEL_ID = "omnia_whoop_ble";
    public static final String ACTION_ARM_NATIVE = "de.omnia.haushalt.ARM_NATIVE";
    public static final String ACTION_RELEASE_NATIVE = "de.omnia.haushalt.RELEASE_NATIVE";
    public static final String ACTION_KEEP_PROCESS = "de.omnia.haushalt.KEEP_PROCESS";
    public static final String ACTION_UPDATE_NOTIFY = "de.omnia.haushalt.UPDATE_NOTIFY";

    private static final int NOTIFICATION_ID = 10042;

    private static WhoopBleLinkHolder linkHolder;
    private PowerManager.WakeLock wakeLock;

    static WhoopBleLinkHolder linkHolder() {
        if (linkHolder == null) {
            linkHolder = new WhoopBleLinkHolder();
        }
        return linkHolder;
    }

    public static void saveDeviceId(android.content.Context ctx, String deviceId) {
        WhoopBleStore.setDeviceId(ctx, deviceId);
    }

    public static String loadDeviceId(android.content.Context ctx) {
        return WhoopBleStore.loadDeviceId(ctx);
    }

    public static void setKeepaliveActive(android.content.Context ctx, boolean active) {
        WhoopBleStore.setKeepalive(ctx, active);
    }

    public static boolean isKeepaliveActive(android.content.Context ctx) {
        return WhoopBleStore.isKeepaliveActive(ctx);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String id = intent.getStringExtra("deviceId");
            if (id != null && !id.isEmpty()) {
                WhoopBleStore.setDeviceId(this, id);
            }
        }

        startForegroundWithNotification(intent);
        acquireWakeLock();

        String action = intent != null ? intent.getStringExtra("action") : null;
        if (action == null && intent != null) {
            action = intent.getAction();
        }
        // Sticky-Restart ohne Intent → erneut armen
        if (action == null && intent == null) {
            action = ACTION_ARM_NATIVE;
        }

        Log.i(TAG, "onStartCommand action=" + action + " id=" + loadDeviceId(this));

        if (ACTION_RELEASE_NATIVE.equals(action)) {
            linkHolder().release();
            return START_STICKY;
        }

        if (ACTION_UPDATE_NOTIFY.equals(action) || ACTION_KEEP_PROCESS.equals(action)) {
            // Nur Notification / Prozess halten — noch kein GATT (Capgo kann noch halten)
            return START_STICKY;
        }

        // ARM_NATIVE oder unbekannt → verbinden
        armIfPossible();
        return START_STICKY;
    }

    private void armIfPossible() {
        if (!isKeepaliveActive(this)) {
            Log.w(TAG, "keepalive inaktiv");
            return;
        }
        String deviceId = loadDeviceId(this);
        Log.i(TAG, "arm deviceId=" + deviceId);
        linkHolder().arm(this, deviceId);
    }

    private void startForegroundWithNotification(Intent intent) {
        String title = intent != null ? intent.getStringExtra("title") : null;
        String body = intent != null ? intent.getStringExtra("body") : null;
        if (title == null || title.isEmpty()) {
            title = getString(R.string.whoop_fg_title);
        }
        if (body == null || body.isEmpty()) {
            int bpm = linkHolder().getLastBpm();
            body = bpm > 0
                ? ("WHOOP · " + bpm + " bpm")
                : getString(R.string.whoop_fg_body);
        }

        ensureChannel();

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pending)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE;
            if (Build.VERSION.SDK_INT >= 34) {
                type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
            }
            try {
                startForeground(NOTIFICATION_ID, notification, type);
            } catch (Exception e) {
                Log.e(TAG, "startForeground typed failed", e);
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            return;
        }
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm == null) {
            return;
        }
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Omnia:WhoopBle");
        wakeLock.setReferenceCounted(false);
        try {
            wakeLock.acquire(4 * 60 * 60 * 1000L); // 4h max, Watchdog hält neu
        } catch (Exception e) {
            Log.e(TAG, "wakelock", e);
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
        wakeLock = null;
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.whoop_fg_channel),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.whoop_fg_channel_desc));
        channel.setShowBadge(false);
        channel.setSound(null, null);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(TAG, "onTaskRemoved — FGS bleibt, re-arm");
        if (isKeepaliveActive(this)) {
            armIfPossible();
            Intent restart = new Intent(getApplicationContext(), WhoopBleForegroundService.class);
            restart.putExtra("action", ACTION_ARM_NATIVE);
            String id = loadDeviceId(this);
            if (id != null) {
                restart.putExtra("deviceId", id);
            }
            restart.putExtra("title", getString(R.string.whoop_fg_title));
            restart.putExtra("body", getString(R.string.whoop_fg_body));
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getApplicationContext().startForegroundService(restart);
                } else {
                    getApplicationContext().startService(restart);
                }
            } catch (Exception e) {
                Log.e(TAG, "re-arm after task remove failed", e);
            }
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "onDestroy");
        if (isKeepaliveActive(this)) {
            Intent restart = new Intent(getApplicationContext(), WhoopBleForegroundService.class);
            restart.putExtra("action", ACTION_ARM_NATIVE);
            String id = loadDeviceId(this);
            if (id != null) {
                restart.putExtra("deviceId", id);
            }
            restart.putExtra("title", getString(R.string.whoop_fg_title));
            restart.putExtra("body", getString(R.string.whoop_fg_body));
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getApplicationContext().startForegroundService(restart);
                } else {
                    getApplicationContext().startService(restart);
                }
            } catch (Exception e) {
                Log.e(TAG, "restart onDestroy failed", e);
            }
        } else {
            linkHolder().release();
            releaseWakeLock();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
