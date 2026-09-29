package de.omnia.haushalt;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Omnia-Haushalt — ohne WHOOP-BLE / Foreground-Service.
 * Fitness läuft in der App „Omnia Whoop“ (de.omnia.whoop).
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Plugin bleibt registriert, damit Web-Code stop() aufrufen kann (Aufräumen alter Keepalive).
        registerPlugin(OmniaBleKeepalivePlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        WindowInsetsControllerCompat bars =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (bars != null) {
            bars.setAppearanceLightStatusBars(false);
            bars.setAppearanceLightNavigationBars(false);
        }

        // Alte WHOOP-Benachrichtigung / FGS sofort beenden
        stopLegacyWhoopKeepalive();
    }

    private void stopLegacyWhoopKeepalive() {
        try {
            WhoopBleForegroundService.setKeepaliveActive(this, false);
            Intent intent = new Intent(this, WhoopBleForegroundService.class);
            intent.putExtra("action", WhoopBleForegroundService.ACTION_RELEASE_NATIVE);
            stopService(intent);
        } catch (Exception e) {
            Log.w("OmniaMain", "Whoop-Keepalive stop fehlgeschlagen", e);
        }
    }
}
