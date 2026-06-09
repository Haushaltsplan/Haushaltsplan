package de.omnia.haushalt;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

/**
 * Foreground Service: hält Omnia + native WHOOP-BLE auch nach Schließen der App-Oberfläche aktiv.
 */
public class WhoopBleForegroundService extends Service {

    public static final String CHANNEL_ID = "omnia_whoop_ble";
    public static final String ACTION_ARM_NATIVE = "de.omnia.haushalt.ARM_NATIVE";
    public static final String ACTION_RELEASE_NATIVE = "de.omnia.haushalt.RELEASE_NATIVE";
    public static final String ACTION_APP_FOREGROUND = "de.omnia.haushalt.APP_FOREGROUND";
    public static final String ACTION_APP_BACKGROUND = "de.omnia.haushalt.APP_BACKGROUND";
    public static final String PREFS = "omnia_ble_keepalive";
    public static final String PREF_DEVICE_ID = "whoop_device_id";
    public static final String PREF_KEEPALIVE = "keepalive_active";

    private static final int NOTIFICATION_ID = 10042;

    private static WhoopBleLinkHolder linkHolder;
    private PowerManager.WakeLock wakeLock;

    static WhoopBleLinkHolder linkHolder() {
        if (linkHolder == null) {
            linkHolder = new WhoopBleLinkHolder();
        }
        return linkHolder;
    }

    public static void saveDeviceId(Context ctx, String deviceId) {
        ctx.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREF_DEVICE_ID, deviceId).apply();
    }

    public static String loadDeviceId(Context ctx) {
        return ctx.getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_DEVICE_ID, null);
    }

    public static void setKeepaliveActive(Context ctx, boolean active) {
        ctx.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREF_KEEPALIVE, active).apply();
    }

    public static boolean isKeepaliveActive(Context ctx) {
        return ctx.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(PREF_KEEPALIVE, false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getStringExtra("action") : null;
        if (action == null && intent != null) {
            action = intent.getAction();
        }

        if (ACTION_RELEASE_NATIVE.equals(action)) {
            linkHolder().release();
            return START_STICKY;
        }

        if (ACTION_APP_FOREGROUND.equals(action)) {
            linkHolder().setAppForeground(true);
            return START_STICKY;
        }

        if (ACTION_APP_BACKGROUND.equals(action) || ACTION_ARM_NATIVE.equals(action)) {
            linkHolder().setAppForeground(false);
            String deviceId = loadDeviceId(this);
            if (deviceId != null && !deviceId.isEmpty()) {
                linkHolder().arm(this, deviceId);
            }
        }

        startForegroundWithNotification(intent);
        acquireWakeLock();

        if (isKeepaliveActive(this)) {
            String deviceId = loadDeviceId(this);
            if (deviceId != null && !deviceId.isEmpty() && !linkHolder().isArmed()) {
                linkHolder().setAppForeground(false);
                linkHolder().arm(this, deviceId);
            }
        }

        return START_STICKY;
    }

    private void startForegroundWithNotification(Intent intent) {
        String title = intent != null ? intent.getStringExtra("title") : null;
        String body = intent != null ? intent.getStringExtra("body") : null;
        if (title == null || title.isEmpty()) {
            title = getString(R.string.whoop_fg_title);
        }
        if (body == null || body.isEmpty()) {
            body = getString(R.string.whoop_fg_body);
        }

        ensureChannel();

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
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
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            );
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
        wakeLock.acquire();
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
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
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(getString(R.string.whoop_fg_channel_desc));
        channel.setShowBadge(false);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (isKeepaliveActive(this)) {
            String deviceId = loadDeviceId(this);
            if (deviceId != null && !deviceId.isEmpty()) {
                Intent restart = new Intent(getApplicationContext(), WhoopBleForegroundService.class);
                restart.putExtra("action", ACTION_ARM_NATIVE);
                restart.putExtra("title", getString(R.string.whoop_fg_title));
                restart.putExtra("body", getString(R.string.whoop_fg_body));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getApplicationContext().startForegroundService(restart);
                } else {
                    getApplicationContext().startService(restart);
                }
            }
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
