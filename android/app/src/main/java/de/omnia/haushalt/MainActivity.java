package de.omnia.haushalt;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
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

        handleNotificationDeepLink(getIntent());
        ensureFgAlive(false);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationDeepLink(intent);
    }

    private void handleNotificationDeepLink(Intent intent) {
        if (intent == null) {
            return;
        }
        String path = intent.getStringExtra("omnia_path");
        if (path == null || path.isEmpty()) {
            if (intent.getBooleanExtra("omnia_open_fitness", false)) {
                path = "/fitnessdaten";
            }
        }
        if (path == null || path.isEmpty()) {
            return;
        }
        final String target = path.startsWith("/") ? path : "/" + path;
        handler.postDelayed(
            () -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        String js =
                            "(function(){try{if(window.location.pathname!=='" +
                            target +
                            "'){window.location.href='" +
                            target +
                            "';}}catch(e){}})();";
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                } catch (Exception ignored) {}
            },
            600
        );
    }

    @Override
    public void onResume() {
        super.onResume();
        ensureFgAlive(true);
    }

    @Override
    public void onPause() {
        ensureFgAlive(false);
        super.onPause();
    }

    @Override
    public void onStop() {
        if (!isChangingConfigurations()) {
            ensureFgAlive(false);
        }
        super.onStop();
    }

    private void ensureFgAlive(boolean armNative) {
        if (!WhoopBleForegroundService.isKeepaliveActive(this)) {
            return;
        }
        handler.postDelayed(
            () -> {
                Intent intent = new Intent(this, WhoopBleForegroundService.class);
                intent.putExtra(
                    "action",
                    armNative
                        ? WhoopBleForegroundService.ACTION_ARM_NATIVE
                        : WhoopBleForegroundService.ACTION_KEEP_PROCESS
                );
                String id = WhoopBleForegroundService.loadDeviceId(this);
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
                } catch (Exception ignored) {}
            },
            armNative ? 400 : 80
        );
    }
}
