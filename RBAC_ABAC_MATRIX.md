# MATRIZ DE PERMISOS RBAC & ABAC

| Rol | Permiso RBAC | Restricción ABAC Contextual |
| :--- | :--- | :--- |
| **ADMIN** | `*` (Acceso Global) | Ninguna. |
| **SUPERVISORA** | `sales.approve`, `evidences.update`, `audit.read` | Puede aprobar solicitudes de autorización (`PRICE_OVERRIDE`, `CREDIT_EXCEPTION`). Puede modificar evidencias en estado `APPROVED`. |
| **VENDEDORA** | `sales.create`, `clients.read` | Bloqueada de establecer precios por debajo de `minimumAuthorizedPrice` salvo autorización previa. Bloqueada de modificar evidencias `APPROVED`. |
| **COBRADOR** | `payments.create`, `cash.open`, `cash.close` | Bloqueado de registrar cobros a clientes fuera de su ruta asignada (`assignedRouteId`) salvo excepción autorizada. |
