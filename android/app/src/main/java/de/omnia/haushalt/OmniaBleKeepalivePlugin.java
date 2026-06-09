package de.omnia.haushalt;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSObject;
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
        String deviceId = call.getString("deviceId");
        if (deviceId != null && !deviceId.isEmpty()) {
            WhoopBleForegroundService.saveDeviceId(getContext(), deviceId);
        }
        WhoopBleForegroundService.setKeepaliveActive(getContext(), true);

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
        WhoopBleForegroundService.setKeepaliveActive(getContext(), false);
        WhoopBleLinkHolder holder = WhoopBleForegroundService.linkHolder();
        holder.release();
        holder.setAppForeground(true);
        Intent intent = new Intent(getContext(), WhoopBleForegroundService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void armNativeLink(PluginCall call) {
        String deviceId = call.getString("deviceId");
        if (deviceId == null || deviceId.isEmpty()) {
            deviceId = WhoopBleForegroundService.loadDeviceId(getContext());
        }
        if (deviceId == null || deviceId.isEmpty()) {
            call.reject("Kein WHOOP-Gerät gespeichert.");
            return;
        }
        WhoopBleForegroundService.saveDeviceId(getContext(), deviceId);
        WhoopBleForegroundService.setKeepaliveActive(getContext(), true);
        sendServiceAction(WhoopBleForegroundService.ACTION_ARM_NATIVE);
        call.resolve();
    }

    @PluginMethod
    public void releaseNativeLink(PluginCall call) {
        sendServiceAction(WhoopBleForegroundService.ACTION_APP_FOREGROUND);
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Akku-Einstellungen konnten nicht geöffnet werden.");
        }
    }

    @PluginMethod
    public void isBatteryOptimized(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
            boolean ignored =
                pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            ret.put("ignored", ignored);
        } else {
            ret.put("ignored", true);
        }
        call.resolve(ret);
    }

    private void sendServiceAction(String action) {
        Intent intent = new Intent(getContext(), WhoopBleForegroundService.class);
        intent.putExtra("action", action);
        intent.putExtra("title", "Omnia");
        intent.putExtra("body", "WHOOP verbunden — Hintergrund aktiv");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
    }
}
