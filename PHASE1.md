# PHASE 1 — FOUNDATION ARCHITECTURE DOCUMENTATION
## BITALIS ERP + CRM + COBRANZA EN RUTA

### Stack Tecnológico
- **Backend:** Node.js LTS, TypeScript, Next.js / NestJS architecture, REST API, JWT
- **ORM:** Prisma ORM v5+
- **Base de Datos:** PostgreSQL administrado en Supabase (Transaction Pooler + Direct Migration)
- **Cálculos Financieros:** `decimal.js` con precisión `Decimal(12,2)`
- **Idempotencia:** `IdempotencyService` con claves únicas `idempotencyKey`
- **Auditoría:** `AuditLogService` inmutable
- **Hosting Objetivo:** Hostinger Web App Node.js (Sin dependencia obligatoria de Docker)

---

### Regla Financiera Fundamental
```
PRECIO LISTA         $1,490.00
ENGANCHE CLIENTE       -$200.00
APORTE EMPRESA         -$200.00
-------------------------------
SALDO FINANCIADO      $1,090.00
```
- **Aporte de Empresa:** Clasificado estrictamente como **DESCUENTO COMERCIAL**.
- **Regla Inviolable:** Jamás incrementa la caja física ni genera `CashMovement`.

---

### Endpoints de Infraestructura y Verificación
1. `GET /api/system/health` - Estado general del sistema.
2. `GET /api/system/version` - Versión y fase activa (Phase 1).
3. `GET /api/system/ready` - Verificación de conexión a PostgreSQL.
4. `GET /api/deployment/status` - Métricas de despliegue en producción.
5. `GET /api/phase1/run-tests` - Batería automatizada de las **30 pruebas de la Fase 1**.

---

### Pauta de Pruebas Automatizadas (30/30)
- Conexión PostgreSQL / Prisma Service
- DTOs y Schemas de Usuario y Roles (ADMIN, SUPERVISORA, VENDEDORA, COBRADOR)
- Modelo de Cliente CRM y Productos con SKU único
- Precisión Decimal(12,2)
- Inventario, Almacenes y Fórmula `quantityAvailable = quantityOnHand - quantityReserved`
- Kardex Inmutable
- Restricción de Máximo 2 Productos por Venta
- Frecuencias de Pago (Semanal min $100, Quincenal min $200, Mensual min $400)
- Invariante Financiera: $1,490 - $200 - $200 = $1,090
- Idempotencia en Pagos
- Audit Logs Inmutables
