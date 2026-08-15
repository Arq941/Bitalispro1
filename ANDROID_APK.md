# BITALIS Android APK

BITALIS incluye un contenedor Android nativo en `android/` que abre la aplicación web de producción:

`https://gold-skunk-480372.hostingersite.com/`

## Compilación automática

El workflow `.github/workflows/android-apk.yml` se ejecuta después de que `MySQL Prisma Schema Check` termina correctamente en `main`.

Cada compilación:

1. genera un APK Android instalable;
2. publica un artifact de GitHub Actions;
3. reemplaza el archivo `BITALIS-latest.apk` del release `bitalis-android-latest`;
4. publica `BITALIS-latest.sha256` para verificar integridad.

URL estable del APK:

`https://github.com/Arq941/Bitalispro1/releases/download/bitalis-android-latest/BITALIS-latest.apk`

## Firma Android

Para que una versión futura se pueda instalar encima de una versión anterior, ambas deben usar la misma firma.

El workflow soporta firma de producción mediante estos GitHub Actions Secrets:

- `BITALIS_ANDROID_KEYSTORE_BASE64`
- `BITALIS_ANDROID_STORE_PASSWORD`
- `BITALIS_ANDROID_KEY_ALIAS`
- `BITALIS_ANDROID_KEY_PASSWORD`

Si los cuatro secretos no existen, el workflow genera un APK firmado con la clave `debug` temporal del runner. Ese APK es instalable, pero una compilación posterior podría requerir desinstalar la versión anterior porque la firma debug del runner puede cambiar.

Nunca se debe subir el archivo `.jks` o sus contraseñas al repositorio.

## Capacidades Android

El contenedor incluye:

- sesión persistente de WebView;
- JavaScript y almacenamiento local;
- geolocalización con permiso Android;
- cámara/selector de imágenes para formularios;
- apertura externa de Maps, teléfono, correo y otros enlaces;
- botón Atrás integrado con el historial de BITALIS;
- pantalla de reintento cuando no hay conexión.

El backend, permisos, ventas, cobranza y reglas financieras siguen viviendo en la aplicación web oficial. El APK no duplica ni modifica lógica financiera.
