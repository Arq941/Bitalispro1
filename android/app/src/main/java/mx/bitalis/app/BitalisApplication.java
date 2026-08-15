package mx.bitalis.app;

import android.app.Application;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.webkit.WebView;

/**
 * Mantiene la sesión/datos WebView entre actualizaciones, pero evita mezclar
 * HTML/chunks de Next.js pertenecientes a compilaciones distintas.
 */
public class BitalisApplication extends Application {
    private static final String PREFS = "bitalis_web_delivery";
    private static final String PREPARED_VERSION_CODE = "prepared_version_code";

    @Override
    public void onCreate() {
        super.onCreate();
        refreshWebDeliveryCacheOncePerVersion();
    }

    private void refreshWebDeliveryCacheOncePerVersion() {
        long currentVersionCode = getVersionCode();
        SharedPreferences preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        long preparedVersionCode = preferences.getLong(PREPARED_VERSION_CODE, -1L);
        if (preparedVersionCode == currentVersionCode) return;

        try {
            // clearCache(true) elimina únicamente recursos HTTP/WebView.
            // No borra cookies, localStorage, tokens, permisos ni datos de negocio.
            WebView deliveryCleaner = new WebView(this);
            deliveryCleaner.clearCache(true);
            deliveryCleaner.destroy();
            preferences.edit().putLong(PREPARED_VERSION_CODE, currentVersionCode).apply();
        } catch (Throwable ignored) {
            // No bloquear el arranque si el proveedor WebView del dispositivo falla.
        }
    }

    private long getVersionCode() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return info.getLongVersionCode();
        } catch (PackageManager.NameNotFoundException ignored) {
            return 1L;
        }
    }
}
