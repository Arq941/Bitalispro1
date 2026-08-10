# OFFLINE ARCHITECTURE — BITALIS PWA FASE 9

## Arquitectura General Offline-First

El sistema de BITALIS utiliza una arquitectura Offline-First resiliente para garantizar que los cobradores y vendedoras en campo puedan ejecutar todas sus operaciones diarias (cobros, enganches, visitas, reprogramaciones, promesas de pago, gastos y traza GPS) sin necesidad de conectividad a Internet continua.

```
┌─────────────────────────────────────────────────────────┐
│                     PWA / MOBILE                        │
│  React 18 / Next.js / PWA Service Worker                │
│                                                         │
│  IndexedDB (localforage)                                │
│  ├── offline_operations (Queue de operaciones local)    │
│  ├── cached_clients (Clientes asignados a la ruta)     │
│  ├── cached_routes (Ruta del día / GeoJSON)             │
│  ├── cached_credits (Créditos activos y saldos)         │
│  └── sync_metadata (Marcas de tiempo e idempotencia)    │
└────────────────────────────┬────────────────────────────┘
                             │
                  Sincronización HTTPS / REST
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    NODE.JS API SERVER                   │
│  NestJS / Next.js API Routes                            │
│                                                         │
│  OfflineSyncService (Procesador atómico de lotes)       │
│  IdempotencyService (Garantía de unicidad)              │
│  ConflictResolverService (Motor de resolución)          │
│  ABAC / RBAC / Security Guard                           │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                PostgreSQL / SUPABASE                    │
│                                                         │
│  payments (Abonos reales)                               │
│  cash_movements (Caja de cobrador en tiempo real)       │
│  credits (Saldos y amortizaciones)                      │
│  payment_reschedules (Reprogramaciones)                 │
│  client_visits (Visitas y geofencing)                   │
│  sync_operations (Bitácora de sincronización)           │
│  sync_conflicts (Mesa de control de supervisión)        │
│  audit_logs (Auditoría 360° inmutable)                  │
└─────────────────────────────────────────────────────────┘
```

## Principios Fundamentales
1. **CERO DOBLE COBRO / CERO DOBLE ENGANCHE**: Garantizado por `idempotencyKey` única UUID v4 con restricción `UNIQUE` a nivel de base de datos PostgreSQL.
2. **PostgreSQL / Supabase como Fuente de Verdad**: La base de datos central valida reglas financieras y asigna la autoridad temporal oficial (`serverReceivedAt`).
3. **Timestamps Duales**: Se preserva `clientCapturedAt` para reconstrucción histórica de ruta y `serverReceivedAt` para contabilidad oficial.
4. **Resiliencia Operativa**: Las operaciones permanecen en IndexedDB hasta recibir confirmación HTTP 200/201 del servidor.
