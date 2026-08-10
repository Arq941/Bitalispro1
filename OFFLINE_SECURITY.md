# OFFLINE SECURITY — BITALIS PWA FASE 9

## Políticas de Seguridad PWA & Offline

### 1. Manejo de Secretos en Cliente
- **Prohibición Total**: NUNCA se almacenan contraseñas en texto plano, tokens JWT completos ni refresh tokens en IndexedDB o localStorage.
- Solamente se guardan datos operacionales necesarios (clientes asignados, saldo de ruta, productos del catálogo).

### 2. Control de Acceso ABAC Servidor
- Toda operación procesada mediante `POST /api/offline/sync` extrae la identidad del usuario directamente del token JWT validado en el encabezado `Authorization: Bearer <token>`.
- Se ignoran campos manipulables de `userId` enviados en el cuerpo JSON de la petición.
- Se valida que el cobrador tenga una sesión de caja activa (`OPEN`) y asignación explícita al cliente/crédito.

### 3. Protección contra Replay y Tampering
- La firma SHA-256 del payload (`payloadHash`) asociada al `idempotencyKey` evita que operaciones reenviadas por interceptadores sufran alteraciones de monto o destino.
