package mx.bitalis.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Parcelable;
import android.provider.MediaStore;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebStorage;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final String START_URL = "https://gold-skunk-480372.hostingersite.com/";
    private static final String APP_HOST = "gold-skunk-480372.hostingersite.com";
    private static final String UPDATE_MANIFEST_URL = "https://github.com/Arq941/Bitalispro1/releases/download/bitalis-android-latest/BITALIS-android-update.json";
    private static final long UPDATE_CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L;
    private static final int REQ_LOCATION = 2101;
    private static final int REQ_CAMERA = 2102;
    private static final int REQ_FILE_CHOOSER = 3101;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private WebChromeClient.FileChooserParams pendingFileChooserParams;
    private PermissionRequest pendingWebPermission;
    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private boolean updateCheckRunning = false;
    private boolean updateDialogVisible = false;
    private boolean offlineCacheRecoveryAttempted = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(6, 43, 36));
        window.setNavigationBarColor(Color.WHITE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        setContentView(webView);
        configureWebView();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " BITALIS-Android/" + getVersionName());

        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUri(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUri(Uri.parse(url));
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                Uri uri = Uri.parse(url == null ? "" : url);
                if (APP_HOST.equalsIgnoreCase(uri.getHost())) {
                    offlineCacheRecoveryAttempted = false;
                    view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (!request.isForMainFrame()) return;

                Uri failingUri = request.getUrl();
                String failingUrl = failingUri == null ? START_URL : failingUri.toString();
                boolean isBitalisUrl = failingUri != null && APP_HOST.equalsIgnoreCase(failingUri.getHost());

                if (isBitalisUrl && !offlineCacheRecoveryAttempted) {
                    offlineCacheRecoveryAttempted = true;
                    view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
                    view.post(() -> view.loadUrl(failingUrl));
                    return;
                }

                showOfflinePage(view);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;

                if (acceptsImage(params) && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    pendingFileChooserParams = params;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                } else {
                    launchFileChooser(params, true);
                }
                return true;
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> openExternal(Uri.parse(url)));
    }

    private void checkForAppUpdate() {
        if (updateCheckRunning || updateDialogVisible) return;
        SharedPreferences preferences = getSharedPreferences("bitalis_android_updates", MODE_PRIVATE);
        long lastSuccessfulCheck = preferences.getLong("last_successful_check", 0L);
        if (System.currentTimeMillis() - lastSuccessfulCheck < UPDATE_CHECK_INTERVAL_MS) return;

        updateCheckRunning = true;
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL endpoint = new URL(UPDATE_MANIFEST_URL);
                connection = (HttpURLConnection) endpoint.openConnection();
                connection.setConnectTimeout(7000);
                connection.setReadTimeout(7000);
                connection.setInstanceFollowRedirects(true);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "BITALIS-Android/" + getVersionName());
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) return;

                StringBuilder content = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) content.append(line);
                }

                JSONObject manifest = new JSONObject(content.toString());
                long latestVersionCode = manifest.optLong("versionCode", 0L);
                String latestVersionName = manifest.optString("versionName", "");
                String apkUrl = manifest.optString("apkUrl", "");
                preferences.edit().putLong("last_successful_check", System.currentTimeMillis()).apply();

                if (latestVersionCode > getVersionCode() && !apkUrl.isEmpty()) {
                    runOnUiThread(() -> showUpdateDialog(latestVersionName, apkUrl));
                }
            } catch (Exception ignored) {
                // La app sigue operando normalmente si no hay internet o GitHub no responde.
            } finally {
                if (connection != null) connection.disconnect();
                updateCheckRunning = false;
            }
        }, "bitalis-update-check").start();
    }

    private void showUpdateDialog(String latestVersionName, String apkUrl) {
        if (isFinishing() || isDestroyed() || updateDialogVisible) return;
        updateDialogVisible = true;
        String current = getVersionName();
        String latest = latestVersionName == null || latestVersionName.isEmpty() ? "nueva" : latestVersionName;
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Actualización de BITALIS")
                .setMessage("Hay una actualización disponible (" + latest + "). Tu versión actual es " + current + ". Puedes instalarla ahora sobre esta aplicación.")
                .setPositiveButton("ACTUALIZAR AHORA", (d, which) -> openExternal(Uri.parse(apkUrl)))
                .setNegativeButton("MÁS TARDE", null)
                .create();
        dialog.setOnDismissListener(d -> updateDialogVisible = false);
        dialog.show();
    }

    private boolean handleUri(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null) return false;

        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            if (APP_HOST.equalsIgnoreCase(uri.getHost())) return false;
            return openExternal(uri);
        }

        if ("intent".equalsIgnoreCase(scheme)) {
            try {
                Intent intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException | URISyntaxException ignored) {
                return true;
            }
        }

        if ("tel".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme) || "geo".equalsIgnoreCase(scheme) || "market".equalsIgnoreCase(scheme)) {
            return openExternal(uri);
        }

        return false;
    }

    private boolean openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No hay una aplicación disponible para abrir este enlace.", Toast.LENGTH_SHORT).show();
            return true;
        }
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        List<String> grantedResources = new ArrayList<>();
        boolean needsCamera = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    grantedResources.add(resource);
                } else {
                    needsCamera = true;
                }
            }
        }

        if (needsCamera) {
            pendingWebPermission = request;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
            return;
        }

        if (grantedResources.isEmpty()) request.deny();
        else request.grant(grantedResources.toArray(new String[0]));
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean acceptsImage(WebChromeClient.FileChooserParams params) {
        String[] types = params.getAcceptTypes();
        if (types == null || types.length == 0) return true;
        for (String type : types) {
            if (type == null || type.isEmpty() || type.startsWith("image/") || "*/*".equals(type)) return true;
        }
        return false;
    }

    private void launchFileChooser(WebChromeClient.FileChooserParams params, boolean allowCamera) {
        Intent picker;
        try {
            picker = params.createIntent();
        } catch (Exception error) {
            picker = new Intent(Intent.ACTION_GET_CONTENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);
            picker.setType("*/*");
        }

        ArrayList<Intent> initialIntents = new ArrayList<>();
        if (allowCamera && acceptsImage(params) && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            cameraUri = createCameraUri();
            if (cameraUri != null) {
                Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (camera.resolveActivity(getPackageManager()) != null) initialIntents.add(camera);
            }
        }

        Intent chooser = Intent.createChooser(picker, "Seleccionar archivo");
        if (!initialIntents.isEmpty()) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, initialIntents.toArray(new Parcelable[0]));
        }

        try {
            startActivityForResult(chooser, REQ_FILE_CHOOSER);
        } catch (ActivityNotFoundException error) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = null;
            cleanupCameraUri();
            Toast.makeText(this, "No hay una aplicación para seleccionar archivos.", Toast.LENGTH_SHORT).show();
        }
    }

    private Uri createCameraUri() {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "BITALIS_" + System.currentTimeMillis() + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/BITALIS");
        return getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
    }

    private void cleanupCameraUri() {
        if (cameraUri != null) {
            try {
                getContentResolver().delete(cameraUri, null, null);
            } catch (Exception ignored) {
            }
            cameraUri = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE_CHOOSER || fileCallback == null) return;

        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        }

        if (resultCode == RESULT_OK && (result == null || result.length == 0) && cameraUri != null) {
            result = new Uri[]{cameraUri};
            cameraUri = null;
        } else {
            cleanupCameraUri();
        }

        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == REQ_LOCATION && pendingGeoCallback != null) {
            boolean granted = hasLocationPermission();
            pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
            return;
        }

        if (requestCode == REQ_CAMERA) {
            boolean granted = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;

            if (pendingWebPermission != null) {
                if (granted) pendingWebPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                else pendingWebPermission.deny();
                pendingWebPermission = null;
            }

            if (pendingFileChooserParams != null) {
                WebChromeClient.FileChooserParams params = pendingFileChooserParams;
                pendingFileChooserParams = null;
                launchFileChooser(params, granted);
            }
        }
    }

    private void showOfflinePage(WebView view) {
        view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                "<style>body{font-family:sans-serif;background:#f5f8f7;color:#062b24;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}" +
                ".c{padding:28px;text-align:center;max-width:360px}h1{font-size:24px}p{color:#64748b;line-height:1.5}" +
                "button{min-height:52px;border:0;border-radius:16px;background:#11a65a;color:white;font-weight:800;padding:16px 24px;font-size:15px}</style></head>" +
                "<body><div class='c'><h1>BITALIS sin conexión</h1><p>No encontramos una copia local utilizable para esta pantalla. Si ya preparaste tu jornada, vuelve a intentar: BITALIS buscará primero el contenido guardado en el dispositivo.</p>" +
                "<button onclick=\"location.replace('" + START_URL + "')\">REINTENTAR COPIA LOCAL</button></div></body></html>";
        view.loadDataWithBaseURL(START_URL, html, "text/html", "UTF-8", null);
    }

    private long getVersionCode() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return info.getLongVersionCode();
        } catch (PackageManager.NameNotFoundException ignored) {
            return 1L;
        }
    }

    private String getVersionName() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return info.versionName == null ? "1" : info.versionName;
        } catch (PackageManager.NameNotFoundException ignored) {
            return "1";
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (((BitalisApplication) getApplication()).consumeSessionResetRequired()) {
            clearExpiredCredentialSession();
        }
        checkForAppUpdate();
    }

    private void clearExpiredCredentialSession() {
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.removeAllCookies(null);
        cookieManager.flush();
        WebStorage.getInstance().deleteAllData();
        if (webView != null) {
            webView.clearHistory();
            webView.clearFormData();
            webView.clearCache(true);
            webView.loadUrl(START_URL);
        }
        Toast.makeText(this, "Sesión vencida por seguridad. Ingresa nuevamente.", Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
