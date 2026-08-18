# Matriz operativa RBAC y ABAC

Esta matriz describe el comportamiento activo de BITALIS. La autorización del backend es la fuente de verdad; ocultar una opción en la interfaz no sustituye la validación de permisos.

| Rol | Flujo principal | Permisos operativos predeterminados | Alcance |
| --- | --- | --- | --- |
| ADMIN | Control, usuarios, caja, inventario y reportes | Catálogo completo | Global |
| SUPERVISORA | Autorizar, supervisar ventas/cobranza, renovaciones y caja | Gestión operativa sin administración de usuarios | Equipo o zona configurada |
| VENDEDORA | Alta, venta, clientes, catálogo, renovaciones y comisión | Lectura comercial y creación de clientes/ventas | Operación propia |
| COBRADOR | Ruta, cobro, clientes asignados, caja y comisión | Cobranza, ruta y caja | Cartera asignada |

## Reglas obligatorias

- Un COBRADOR solo puede registrar pagos de clientes cuyo assignedCollectorId coincida con su usuario autenticado.
- Registrar un pago requiere collections.collect, además de un rol autorizado.
- Solo se aceptan pagos de créditos activos.
- VENDEDORA no aprueba sus propias excepciones.
- SUPERVISORA y ADMIN atienden autorizaciones comerciales según sus permisos efectivos.
- Los identificadores de usuario procedentes del cliente nunca sustituyen la identidad del token.
- Una matriz de rol ausente o incompleta usa valores seguros por rol; nunca concede acceso global.
- Los overrides DENY tienen precedencia sobre los permisos heredados.
- Las operaciones sensibles deben quedar en auditoría y usar idempotencia cuando impliquen dinero.

## Verificación

Ejecutar npm run test:security, npm run prisma:mysql:validate, npm run lint y npm run build:mysql.

El workflow Production Build Readiness ejecuta estas comprobaciones en cada pull request dirigido a main.
