# INDEXEDDB SCHEMA — BITALIS PWA FASE 9

## Estructura de Tiendas Locales (`localforage` / IndexedDB)

Database Name: `bitalis_offline_db`

### 1. Store: `offline_operations`
Almacena la cola FIFO de operaciones registradas sin conexión.
- `id` (string): Clave primaria local UUID.
- `idempotencyKey` (string, INDEXED): Clave UUID v4 de idempotencia única.
- `operationType` (string): `PAYMENT` | `DOWN_PAYMENT` | `VISIT` | `RESCHEDULE` | `PAYMENT_PROMISE` | `EXPENSE` | `GPS_TRACE`.
- `payload` (object): Objeto estructurado con los parámetros operacionales.
- `clientCapturedAt` (string ISO-8601): Timestamp de la captura local.
- `deviceId` (string): Identificador único del dispositivo móvil.
- `status` (string): `QUEUED` | `SYNCING` | `SYNCED` | `CONFLICT` | `FAILED` | `REJECTED`.
- `retryCount` (number): Conteo de reintentos acumulados.
- `lastAttemptAt` (string ISO-8601 | null): Fecha del último intento de envío.

### 2. Store: `cached_clients`
Contiene la lista de clientes asignados al cobrador/vendedora para navegación rápida offline.

### 3. Store: `cached_credits`
Almacena el estado actual de los créditos activos, saldos y fechas de vencimiento.

### 4. Store: `sync_metadata`
Registra marcas de última sincronización exitosa (`lastServerSync`), versión de base de datos y estado de conexión.
