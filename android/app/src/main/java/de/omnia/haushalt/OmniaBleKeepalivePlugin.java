package de.omnia.haushalt;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "OmniaBleKeepalive",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class OmniaBleKeepalivePlugin extends Plugin {

    private PluginCall pendingStartCall;

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (
                ActivityCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                pendingStartCall = call;
                requestPermissionForAlias("notifications", call, "notificationStartCallback");
                return;
            }
        }
        launchService(call);
    }

    @PermissionCallback
    private void notificationStartCallback(PluginCall call) {
        PluginCall next = pendingStartCall != null ? pendingStartCall : call;
        pendingStartCall = null;
        if (next == null) {
            return;
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            next.reject("Benachrichtigungs-Berechtigung nötig für Hintergrund-BLE.");
            return;
        }
        launchService(next);
    }

    private void launchService(PluginCall call) {
        String title = call.getString("title", "Omnia");
        String body = call.getString("body", "WHOOP verbunden — Live-Daten aktiv");
        Intent intent = new Intent(getContext(), WhoopBleForegroundService.class);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), WhoopBleForegroundService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
