# BITALIS Android APK

BITALIS incluye un contenedor Android nativo en `android/` que abre la aplicación web de producción:

`https://gold-skunk-480372.hostingersite.com/`

## Compilación automática

El workflow `.github/workflows/android-apk.yml` se ejecuta después de que `MySQL Prisma Schema Check` termina correctamente en `main`.

Cada compilación aprobada de `main`:

1. genera un APK Android instalable;
2. verifica criptográficamente la firma del APK;
3. publica un artifact de GitHub Actions;
4. reemplaza `BITALIS-latest.apk` del release `bitalis-android-latest`;
5. publica `BITALIS-latest.sha256` y `BITALIS-signature.txt` para verificar integridad y certificado.

URL estable del APK:

`https://github.com/Arq941/Bitalispro1/releases/download/bitalis-android-latest/BITALIS-latest.apk`

## Firma permanente Android

Para instalar una versión nueva encima de la anterior y conservar los datos locales, todas las versiones publicadas deben estar firmadas con la misma llave.

El workflow usa exclusivamente estos GitHub Actions Secrets para los APK publicados desde `main`:

- `BITALIS_ANDROID_KEYSTORE_BASE64`
- `BITALIS_ANDROID_STORE_PASSWORD`
- `BITALIS_ANDROID_KEY_ALIAS`
- `BITALIS_ANDROID_KEY_PASSWORD`

Los PR pueden compilar un APK temporal con firma debug para validación, pero **nunca se publica como Latest**.

Si falta cualquiera de los cuatro secretos en una compilación de `main`, el workflow falla de forma segura y conserva el último APK correctamente firmado; no publica una versión con firma temporal.

La llave `.jks`, su base64 y sus contraseñas nunca deben subirse al repositorio. Deben existir solamente como respaldo privado y como GitHub Actions Secrets.

### Primera transición desde el APK debug

El primer APK generado antes de configurar la firma permanente fue firmado con una llave debug temporal. Android no permite actualizar directamente una app cuando cambia el certificado.

Por eso, al pasar a la primera versión firmada permanentemente se debe hacer **una sola vez**:

1. confirmar que no hay operaciones locales pendientes de sincronizar;
2. desinstalar el APK debug;
3. instalar el primer `BITALIS-latest.apk` firmado permanentemente;
4. iniciar sesión de nuevo.

A partir de esa instalación, las siguientes versiones se podrán instalar encima de la anterior siempre que se conserve la misma llave de producción.

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
