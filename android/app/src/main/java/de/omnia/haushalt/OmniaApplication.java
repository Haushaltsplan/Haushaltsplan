package de.omnia.haushalt;

import android.app.Application;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * Startet den BLE-FGS neu, wenn der Prozess nach Kill wieder hochkommt
 * und Keepalive zuvor aktiv war.
 */
public class OmniaApplication extends Application {

    private static final String TAG = "OmniaApp";

    @Override
    public void onCreate() {
        super.onCreate();
        if (!WhoopBleForegroundService.isKeepaliveActive(this)) {
            return;
        }
        String id = WhoopBleForegroundService.loadDeviceId(this);
        Log.i(TAG, "keepalive aktiv — FGS starten id=" + id);
        Intent intent = new Intent(this, WhoopBleForegroundService.class);
        intent.putExtra("action", WhoopBleForegroundService.ACTION_ARM_NATIVE);
        if (id != null) {
            intent.putExtra("deviceId", id);
        }
        intent.putExtra("title", getString(R.string.whoop_fg_title));
        intent.putExtra("body", getString(R.string.whoop_fg_body));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "FGS start failed", e);
        }
    }
}
