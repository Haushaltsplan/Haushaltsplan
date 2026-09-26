package de.omnia.haushalt;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Startet den WHOOP-BLE-Keepalive nach Geräte-Neustart neu, wenn zuvor aktiv.
 */
public class WhoopBleBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }
        if (
            !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) &&
            !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(intent.getAction()) &&
            !"android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())
        ) {
            return;
        }
        if (!WhoopBleForegroundService.isKeepaliveActive(context)) {
            return;
        }
        String deviceId = WhoopBleForegroundService.loadDeviceId(context);
        if (deviceId == null || deviceId.isEmpty()) {
            return;
        }

        Intent svc = new Intent(context, WhoopBleForegroundService.class);
        svc.putExtra("action", WhoopBleForegroundService.ACTION_ARM_NATIVE);
        svc.putExtra("deviceId", deviceId);
        svc.putExtra("title", context.getString(R.string.whoop_fg_title));
        svc.putExtra("body", context.getString(R.string.whoop_fg_body));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svc);
        } else {
            context.startService(svc);
        }
    }
}
