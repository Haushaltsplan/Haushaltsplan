package de.omnia.haushalt;

import android.app.Application;
import android.content.Intent;
import android.util.Log;

/**
 * Omnia-Haushalt: kein WHOOP-BLE mehr.
 * Beim Start alten Foreground-Service / Keepalive beenden.
 */
public class OmniaApplication extends Application {

    private static final String TAG = "OmniaApp";

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            WhoopBleForegroundService.setKeepaliveActive(this, false);
            Intent intent = new Intent(this, WhoopBleForegroundService.class);
            intent.putExtra("action", WhoopBleForegroundService.ACTION_RELEASE_NATIVE);
            stopService(intent);
            Log.i(TAG, "WHOOP-Keepalive beendet (Omnia-Haushalt)");
        } catch (Exception e) {
            Log.w(TAG, "WHOOP-Keepalive stop", e);
        }
    }
}
