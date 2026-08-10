# FASE 2 — ARQUITECTURA DE SEGURIDAD Y AUTENTICACIÓN
## BITALIS ERP + CRM + COBRANZA EN RUTA

### Resumen Ejecutivo
La Fase 2 implementa una infraestructura de seguridad server-side de grado bancario, garantizando que el **frontend nunca sea autoridad de seguridad**. Toda la autorización y validación de permisos se ejecuta y audita en el servidor.

---

### Componentes Principales
1. **Autenticación JWT & Refresh Tokens:**
   - Access Token firmado en servidor con vigencia de 15 minutos (`JWT_EXPIRES_IN=15m`).
   - Refresh Token hasheado mediante SHA-256 en base de datos (`user_sessions`) con vigencia de 7 días (`REFRESH_TOKEN_EXPIRES_IN=7d`).
   - Rotación estricta de Refresh Token en cada renovación.
   - Detección de reuso (Reuse Detection): Si se presenta un token revocado, se revocan **todas** las sesiones activas del usuario y se registra evento de auditoría de seguridad.

2. **Protección contra Fuerza Bruta & Bloqueo:**
   - Límite configurable de 5 intentos fallidos (`AUTH_MAX_FAILED_ATTEMPTS=5`).
   - Bloqueo temporal por 15 minutos (`AUTH_LOCKOUT_MINUTES=15`, estado `LOCKED`).
   - Mensajes genéricos en login para evitar la enumeración de usuarios.

3. **Matriz RBAC & ABAC:**
   - **ADMIN:** Acceso global.
   - **SUPERVISORA:** Aprobación de excepciones, revisión de caja, supervisoría de rutas y evidencias.
   - **VENDEDORA:** Creación de prospección y ventas, bloqueada para aplicar precios inferiores al mínimo o modificar evidencias APROBADAS sin solicitud de autorización (`PRICE_OVERRIDE`, `TWO_PRODUCT_SALE`).
   - **COBRADOR:** Gestión de rutas asignadas, bloqueado para registrar cobros fuera de su ruta asignada sin `CREDIT_EXCEPTION`.

4. **Protección IDOR (Insecure Direct Object Reference):**
   - El servidor ignora el `userId` enviado en el cuerpo de la petición o parámetros de URL por el cliente.
   - La identidad autorizada proviene exclusivamente del `sub` dentro del JWT firmado por el servidor (`req.user.sub`).

5. **Invariante Financiera de la Fase 1 (No-Regresión):**
   ```
   PRECIO LISTA         $1,490.00
   ENGANCHE CLIENTE       -$200.00
   APORTE EMPRESA         -$200.00
   -------------------------------
   SALDO FINANCIADO      $1,090.00
   ```
