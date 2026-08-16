package mx.bitalis.app;

import android.app.Application;
import android.webkit.WebView;

/**
 * Mantiene cookies, localStorage, tokens y datos WebView, pero descarta en cada
 * arranque en frío los recursos HTTP que pueden pertenecer a un deploy anterior
 * de Next.js. Los deploys web ocurren con más frecuencia que las versiones APK,
 * por lo que limpiar solo al cambiar versionCode deja HTML/chunks obsoletos.
 */
public class BitalisApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        refreshWebDeliveryCacheOnProcessStart();
    }

    private void refreshWebDeliveryCacheOnProcessStart() {
        try {
            // clearCache(true) elimina únicamente recursos HTTP/WebView.
            // No borra cookies, localStorage, tokens, permisos ni datos de negocio.
            WebView deliveryCleaner = new WebView(this);
            deliveryCleaner.clearCache(true);
            deliveryCleaner.destroy();
        } catch (Throwable ignored) {
            // No bloquear el arranque si el proveedor WebView del dispositivo falla.
        }
    }
}
