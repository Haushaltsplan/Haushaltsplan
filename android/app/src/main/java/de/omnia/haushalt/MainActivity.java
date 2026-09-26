package de.omnia.haushalt;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

/**
 * UI-Prozess. BLE-Keepalive läuft in :whoopble — überlebt App-Schließen.
 * Beim Verlassen der UI: nativer GATT übernehmen (bevor Capgo mitstirbt).
 */
public class MainActivity extends BridgeActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean armScheduled;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OmniaBleKeepalivePlugin.class);
        super.onCreate(savedInstanceState);
        sendBleAction(WhoopBleForegroundService.ACTION_APP_FOREGROUND);
    }

    @Override
    public void onResume() {
        super.onResume();
        armScheduled = false;
        handler.removeCallbacks(armNativeRunnable);
        // UI wieder da → nativen GATT freigeben, Capgo verbindet über JS neu
        sendBleAction(WhoopBleForegroundService.ACTION_RELEASE_NATIVE);
        sendBleAction(WhoopBleForegroundService.ACTION_APP_FOREGROUND);
    }

    @Override
    public void onPause() {
        // Sofort nativen Link anfordern — vor Recents-Kill
        if (WhoopBleForegroundService.isKeepaliveActive(this)) {
            scheduleArmNative();
        }
        super.onPause();
    }

    @Override
    public void onStop() {
        if (!isChangingConfigurations() && WhoopBleForegroundService.isKeepaliveActive(this)) {
            scheduleArmNative();
        }
        super.onStop();
    }

    private void scheduleArmNative() {
        if (armScheduled) {
            return;
        }
        armScheduled = true;
        // Kurz verzögern, damit JS Capgo disconnecten kann — dann sicher armieren
        handler.postDelayed(armNativeRunnable, 400);
    }

    private final Runnable armNativeRunnable = new Runnable() {
        @Override
        public void run() {
            sendBleAction(WhoopBleForegroundService.ACTION_ARM_NATIVE);
        }
    };

    private void sendBleAction(String action) {
        if (!WhoopBleForegroundService.isKeepaliveActive(this) &&
            !WhoopBleForegroundService.ACTION_APP_FOREGROUND.equals(action) &&
            !WhoopBleForegroundService.ACTION_RELEASE_NATIVE.equals(action)) {
            return;
        }
        if (!WhoopBleForegroundService.isKeepaliveActive(this)) {
            return;
        }
        Intent intent = new Intent(this, WhoopBleForegroundService.class);
        intent.putExtra("action", action);
        intent.putExtra("title", getString(R.string.whoop_fg_title));
        intent.putExtra("body", getString(R.string.whoop_fg_body));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }
}
