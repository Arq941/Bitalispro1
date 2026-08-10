# SYNC PROTOCOL — BITALIS PWA FASE 9

## Flujo de Sincronización en Lote (`POST /api/offline/sync`)

### 1. Captura Local en Dispositivo PWA
- La aplicación genera un `idempotencyKey` mediante UUID v4 seguro para cada operación.
- La operación se guarda con estado `QUEUED` en el store `offline_operations` de IndexedDB.
- Se incluye `clientCapturedAt` con la fecha e hora exacta ISO-8601 del dispositivo.

### 2. Disparo de Sincronización
La sincronización se activa automáticamente cuando:
- Se detecta restablecimiento de conexión mediante eventos `online` del navegador.
- El usuario presiona manualmente el botón **Sincronizar Ahora** en el Dashboard.
- Transcurre el intervalo periódico configurado del Service Worker.

### 3. Payload de Sincronización Lote
```json
{
  "deviceId": "DEV-MOB-8821",
  "operations": [
    {
      "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
      "operationType": "PAYMENT",
      "payload": {
        "creditId": "CRED-1029",
        "amount": 300,
        "paymentMethod": "CASH",
        "gpsLatitude": 19.4326,
        "gpsLongitude": -99.1332
      },
      "clientCapturedAt": "2026-08-09T14:30:00.000Z",
      "deviceId": "DEV-MOB-8821"
    }
  ]
}
```

### 4. Respuesta del Servidor
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
      "status": "SYNCED",
      "duplicate": false,
      "serverReceivedAt": "2026-08-09T14:31:05.120Z",
      "data": {
        "paymentId": "PAY-9912",
        "newSaldo": 790
      }
    }
  ]
}
```

### 5. Orden de Prioridad de Sincronización
1. `CLIENT` (Creación de clientes prospecto)
2. `VISIT` (Registro de visita sin pago / con pago)
3. `SALE` / `DOWN_PAYMENT` (Ventas y enganches)
4. `PAYMENT` (Abonos a cartera)
5. `EXPENSE` (Gastos operativos en ruta)
6. `RESCHEDULE` (Reprogramación de cuotas)
7. `GPS_TRACE` (Mapeo de ubicación)
