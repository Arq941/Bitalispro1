# Guía de Operación Offline-First (OFFLINE_OPERATION_GUIDE.md)

Documentación del funcionamiento sin conexión de internet para cobradores y vendedoras en ruta.

---

## 1. Mapeo de Datos Local (IndexedDB)
La aplicación utiliza `localforage` (IndexedDB) para almacenar en el teléfono del cobrador:
- Catálogo de clientes y saldos.
- Ruta de cobranza del día.
- Abonos realizados en modo sin conexión (`QUEUED`).
- Visitas, promesas de pago y geolocalización GPS.

---

## 2. Flujo de Sincronización e Idempotencia
1. Cuando el teléfono no tiene datos ni WiFi:
   - Los cobros se registran en IndexedDB con estado `QUEUED`.
   - Cada cobro genera un `idempotencyKey` único (UUID + Timestamp).
2. Al detectar conexión a Internet:
   - La cola local pasa a estado `SYNCING`.
   - Cada cobro se envía a la API backend.
   - El backend valida el `idempotencyKey`: si ya fue procesado, ignora la duplicación y retorna la transacción guardada.
   - Estado pasa a `SYNCED`.
3. Si existe inconsistencia o saldo discrepante, pasa a `CONFLICT` para revisión por supervisión.
