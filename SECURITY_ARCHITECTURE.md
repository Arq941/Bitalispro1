# ARCHITECTURE OF SECURITY & DEFENSE IN DEPTH
## BITALIS ERP + CRM

### Principios Fundamentales
1. **Zero Trust Frontend:** El cliente web/móvil es tratado como un ambiente no confiable.
2. **Control de Versión de Permisos (`permissionVersion`):**
   - Cuando un administrador revoca un permiso o cambia la contraseña del usuario, el atributo `permissionVersion` del usuario en BD se incrementa.
   - Cualquier JWT presentado con una versión previa es rechazado automáticamente por el servidor.
3. **Storage Seguro de Refresh Tokens:**
   - Los refresh tokens nunca se almacenan en texto claro. Se guardan con hash criptográfico SHA-256.
4. **Respuesta Criptográfica Hashing de Contraseñas:**
   - Algoritmo `bcryptjs` con costo de 12 rondas (`BCRYPT_ROUNDS=12`).
