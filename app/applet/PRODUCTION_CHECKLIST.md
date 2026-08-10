# Checklist de Entrada a Producción (PRODUCTION_CHECKLIST.md)

Verificación previa al pase a producción en Hostinger + Supabase.

---

## Batería de Validación Pre-GoLive

- [x] **BUILD:** `npm run build` ejecutado exitosamente sin errores de TypeScript ni sintaxis.
- [x] **DATABASE:** PostgreSQL Supabase conectado con `DATABASE_URL` (Pooler) y `DIRECT_URL` (Direct).
- [x] **MIGRATIONS:** `prisma migrate deploy` ejecutado y esquemas sincronizados.
- [x] **SECURITY:** Variables de entorno sensibles (`JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) aisladas.
- [x] **FINANCIAL INTEGRITY:** Invariante comprobada ($1,490 precio lista - $200 enganche - $200 aporte empresa = $1,090 financiado).
- [x] **CASH REGISTER:** Aporte de empresa marcado exclusivamente como descuento comercial, $0 impacto en caja física.
- [x] **INVENTORY & KARDEX:** Kardex inmutable registrando movimientos de entrada/salida y reservas de productos.
- [x] **OFFLINE & SYNC:** IndexedDB activo para registro local offline con idempotencia `idempotencyKey`.
- [x] **AUDIT LOG:** Eventos críticos (cobros, cancelaciones, cambios de usuario) registrados en `AuditLog`.
- [x] **PWA:** Manifest PWA y Service Worker listos para instalación en teléfonos Android.
- [x] **HOSTINGER:** Configuración Node.js Web App en producción lista con HTTPS.
- [x] **HEALTH CHECKS:** Endpoints `/api/system/health`, `/api/system/version` y `/api/deployment/status` respondiendo OK.
