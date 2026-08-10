# Guía de Seguridad y Permisos (SECURITY_GUIDE.md)

Principios y controles de seguridad implementados en **BITALIS ERP**.

---

## 1. Autenticación y JWT
- Autenticación mediante JSON Web Tokens (JWT) firmados en servidor con algoritmo HS256.
- Rotación de Refresh Tokens.
- Expiración de tokens de acceso a las 8 horas.

## 2. Control de Acceso (RBAC & ABAC)
Roles definidos:
- **ADMIN:** Acceso completo, configuración global, corte de caja, auditoría.
- **SUPERVISORA:** Asignación de rutas, verificación de transferencias, autorizaciones.
- **VENDEDORA:** Registro de ventas, captura de enganches, consulta de productos.
- **COBRADOR:** Registro de abonos en ruta, bitácora de visitas, promesas de pago.

Toda identidad se extrae estrictamente del JWT validado. Queda prohibido confiar en `userId` o `role` enviados desde el cuerpo de la petición.

## 3. Sanitización y Protección Finanzas
- Encabezados de seguridad con Helmet y restricción CORS por dominio (`CORS_ORIGIN`).
- Todas las operaciones financieras de aportes de empresa y enganches se procesan con precisión Decimal (12,2) para evitar pérdida de redondeo en flotantes.
