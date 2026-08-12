# UX_PHASE15_REPORT

## Arquitectura adaptada
BITALIS continúa sobre la arquitectura productiva existente **Next.js 15 + React + TypeScript + Prisma + MySQL + JWT** desplegada en Hostinger. La especificación original mencionaba Vite/React Router/PostgreSQL, pero no se fuerza esa migración porque sustituir la base productiva violaría la regla de no reemplazar backend ni introducir regresiones. Los objetivos UX/PWA se implementan con equivalentes nativos de Next.js App Router.

## Design System
- Primario: `#12224A`
- Acción: `#FF6A00`
- Dorado: `#C79A3B`
- Fondo: `#F3F4F6`
- Texto: `#2B2B2B`
- Estados semánticos: verde, rojo, ámbar sin depender exclusivamente del color.
- Focus visible, reducción de movimiento, touch targets y safe-area móvil.

## Pantallas y rutas Phase 15
- `/login` y `/` — login productivo.
- `/dashboard` — dashboard adaptativo por rol.
- `/route`, `/route/map`, `/route/navigate`, `/route/close` — operación de cobranza y navegación.
- `/collections` — cobranza rápida con saldo real y modo offline QUEUED.
- `/clients`, `/clients/:id` — CRM y Cliente 360.
- `/sales`, `/sales/new` — venta productiva existente expuesta como ruta dedicada.
- `/products`, `/inventory`, `/cash`, `/commissions`, `/renewals`, `/orders`, `/notifications` — módulos productivos existentes.
- `/authorizations` — bandeja de supervisión con aprobar/rechazar.
- `/control-center` — KPIs empresariales desde endpoints reales.
- `/reports` — reportes responsive.
- `/audit` — auditoría 360 read-only.
- `/settings` — PWA, seguridad y configuración visible.

## Componentes y frontend transversal
- `components/phase15/AppShell.tsx` — navegación mobile-first por rol.
- `components/phase15/PWAProvider.tsx` — registro SW, estado online y aviso de nueva versión.
- `components/phase15/SyncManager.tsx` — sincronización de operaciones IndexedDB.
- `lib/phase15/apiClient.ts` — capa central con JWT legado, timeout, retry controlado, errores normalizados e idempotencia.
- `lib/phase15/offlineQueue.ts` — cola IndexedDB `QUEUED/SYNCING/SYNCED/FAILED`.

## PWA
- Manifest productivo sin imágenes ficticias.
- Service worker controlado; no cachea APIs financieras.
- Offline shell `/offline.html`.
- Actualización controlada mediante `SKIP_WAITING` solicitado por usuario.
- Web Push compatible mediante SW cuando backend/navegador lo habiliten.

## Cobranza offline
La UI permite guardar cobros sin conexión en IndexedDB con `idempotencyKey`. El estado se presenta como **Guardado en dispositivo / Pendiente de sincronización**. Nunca se muestra como pago confirmado ni se calcula un saldo financiero definitivo localmente. La sincronización usa el endpoint productivo de pagos y el servidor sigue siendo autoridad.

## Integridad financiera
No se modificaron fórmulas, Kardex, caja, crédito ni RBAC/ABAC. La regla crítica permanece: lista 1490 - enganche 200 - aporte empresa 200 = saldo financiado 1090; un pago posterior de 300 debe dejar saldo real 790 según respuesta/persistencia del servidor. El aporte empresa no se representa como efectivo recibido.

## UX por rol
- COBRADOR: Inicio, Ruta, Cobrar, Clientes, Más.
- VENDEDOR: Inicio, Venta, Clientes, Productos, Más.
- SUPERVISOR: Inicio, Autorizar, Ruta, Alertas, Más.
- ADMIN: Inicio, Centro de control, Caja, Inventario, Más.
La autorización server-side se mantiene; ocultar opciones en UI no sustituye permisos backend.

## Responsive y accesibilidad
Diseño mobile-first sin tablas obligatorias en pantallas nuevas; cards adaptativas para 360–1440 px. Focus visible, labels, botones de al menos ~44–48 px y compatibilidad con `prefers-reduced-motion`.

## Errores
La nueva capa `apiClient` normaliza 401/403/409/5xx y evita mostrar mensajes Prisma/SQL al usuario.

## Performance
Se conservan App Router/code splitting por ruta, carga dinámica de mapas y caché controlada del SW. Las APIs financieras se mantienen `no-store`.

## Problemas encontrados y corregidos
- Interfaz legacy y service worker anterior podían dejar UI cacheada: reemplazado por SW Phase 15.
- Manifest usaba iconos aleatorios externos: eliminados.
- `/collections` era un placeholder genérico: reemplazado por flujo de cobranza móvil.
- Faltaban rutas explícitas `/login`, `/sales/new`, `/clients/:id`, `/authorizations`, `/control-center`, `/reports`, `/audit`, `/settings`: agregadas.
- Fetch disperso: nueva capa central disponible para migración gradual de pantallas existentes.

## Pendiente antes de marcar Fase 15 al 100%
- Migrar todos los fetch heredados restantes a `apiClient`.
- Migrar token histórico de localStorage a cookie HttpOnly/SameSite sin romper producción.
- Validar build/deploy Hostinger de todos los nuevos módulos.
- Pruebas visuales automatizadas Chrome/Android/Tablet/Desktop.
- Pruebas completas de regresión Fases 1–14.
- Completar Web Push backend si se requiere push real.
- Homologar al Design System las pantallas heredadas que todavía conservan tema oscuro anterior.

La Fase 15 queda **consolidada funcionalmente pero aún no marcada como cerrada** hasta completar QA y regresión en producción.
