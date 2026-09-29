package de.omnia.haushalt;

import android.app.Application;

/**
 * Omnia-Haushalt: kein WHOOP-BLE.
 * Keepalive-Flag löschen, ohne Service zu starten/stoppen.
 */
public class OmniaApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            WhoopBleStore.setKeepalive(this, false);
        } catch (Exception ignored) {}
    }
}
