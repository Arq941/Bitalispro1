# FLUJO DE AUTENTICACIÓN Y SESIONES
## BITALIS ERP + CRM

1. **Login (`POST /api/auth/login`):**
   - Entrada: `{ email, password }`
   - Salida: Access Token (15m) + Refresh Token (7d) + User Profile.
2. **Refresh (`POST /api/auth/refresh`):**
   - Entrada: `{ refreshToken }`
   - Salida: Nuevo Access Token + Nuevo Refresh Token (Rotación).
   - Reuso detectado -> Revocación de **todas** las sesiones activas del usuario + Auditoría de seguridad.
3. **Logout (`POST /api/auth/logout`):**
   - Invalida únicamente la sesión activa asociada al token.
4. **Logout Global (`POST /api/auth/logout-all`):**
   - Invalida todas las sesiones del usuario en todos sus dispositivos.
5. **Cambio de Contraseña (`POST /api/auth/change-password`):**
   - Requiere contraseña actual + contraseña nueva (política de fuerza).
   - Invalida sesiones previas e incrementa `permissionVersion`.
