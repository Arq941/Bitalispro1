# IDEMPOTENCY GUIDE — BITALIS PWA FASE 9

## Garantía de Idempotencia Avanzada

En el sistema BITALIS, la idempotencia es un pilar crítico para prevenir la duplicación de transacciones financieras bajo condiciones de red deficiente o desconexión física en ruta.

### Regla de Oro
Si el dispositivo reenvía una solicitud con un `idempotencyKey` ya procesado:
- El servidor **NO** vuelve a restar el saldo del crédito.
- El servidor **NO** crea otro registro de pago en `payments`.
- El servidor **NO** genera un nuevo movimiento de caja en `cash_movements`.
- El servidor **NO** recalcula comisiones adicionales.
- El servidor responde con el resultado original y los flags `"duplicate": true`, `"originalOperation": true`.

### Validaciones de Hash de Payload (`payloadHash`)
Cada `idempotencyKey` se asocia con un hash SHA-256 de su payload original. Si un cliente intenta enviar una misma clave de idempotencia con un payload distinto:
- La solicitud es rechazada inmediatamente con error `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`.
- Se genera un evento de auditoría de seguridad `AUDIT_IDEMPOTENCY_MISMATCH`.

### Protección a Nivel PostgreSQL
- Índice `UNIQUE` en la columna `idempotencyKey` de las tablas `payments`, `cash_movements`, `commissions` y `sync_operations`.
- Procesamiento encapsulado dentro de `prisma.$transaction()` aisladas con bloqueo explícito del crédito mediante `LOCK credit FOR UPDATE`.
