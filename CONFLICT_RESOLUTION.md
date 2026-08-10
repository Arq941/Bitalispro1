# CONFLICT RESOLUTION — BITALIS PWA FASE 9

## Clasificación de Conflictos

Cuando una operación offline viola alguna restricción de estado o desvío de reloj, la sincronización la clasifica como `CONFLICT` en lugar de aplicarla a ciegas a la base de datos.

### Tipos de Conflicto
1. **`CLOCK_SKEW`**: La diferencia entre `clientCapturedAt` y `serverReceivedAt` excede el umbral tolerado (`CLOCK_SKEW_THRESHOLD_MINUTES`, por defecto 120 min).
2. **`DUPLICATE_OPERATION`**: Inconsistencia grave en hash de payload para un mismo `idempotencyKey`.
3. **`CREDIT_CLOSED`**: El crédito al que se intentó abonar ya fue liquidado completamente por otro canal.
4. **`STALE_DATA`**: Intento de modificación sobre datos obsoletos resueltos previamente.
5. **`USER_NOT_AUTHORIZED`**: El cobrador no tiene asignación activa de la ruta o cliente según las reglas ABAC en el momento de la recepción.

## Mesa de Control de Supervisión

Los conflictos se registran en la tabla `sync_conflicts` y aparecen en tiempo real en la pantalla **Supervisora — Conflictos Offline**.

### Resoluciones Disponibles
- **`FORCE_SYNC`**: Forzar la aplicación atómica de la operación por orden y responsabilidad documentada de la supervisora.
- **`REJECT`**: Rechazar formalmente la operación offline.
- **`REVIEW`**: Marcar para inspección detallada de auditoría en campo.

Endpoint de resolución: `POST /api/offline/conflicts/:id/resolve` (requiere rol `SUPERVISORA` o `ADMIN`).
