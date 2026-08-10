# Guía de Variables de Entorno (ENVIRONMENT_GUIDE.md)

Este documento detalla todas las variables de entorno utilizadas por el sistema **BITALIS ERP + CRM**.

---

| Variable | Descripción | Ejemplo / Valor Recomendado |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución (`development`, `production`) | `production` |
| `PORT` | Puerto de escucha de la aplicación | `3000` |
| `DATABASE_URL` | URL de conexión con Connection Pooling (Prisma runtime) | `postgresql://postgres.[REF]:[PASS]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbooster=true` |
| `DIRECT_URL` | URL de conexión directa para migraciones DDL | `postgresql://postgres.[REF]:[PASS]@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | Clave secreta para firmar tokens de acceso JWT | Secret aleatorio de 256 bits |
| `JWT_REFRESH_SECRET` | Clave secreta para firmar refresh tokens JWT | Secret aleatorio de 256 bits |
| `JWT_EXPIRES_IN` | Tiempo de expiración del token de acceso | `8h` |
| `JWT_REFRESH_EXPIRES_IN` | Tiempo de expiración del token de actualización | `7d` |
| `SUPABASE_URL` | URL base del proyecto Supabase | `https://[REF].supabase.co` |
| `SUPABASE_ANON_KEY` | Llave anónima pública de Supabase | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave privada privilegiada para almacenamiento backend | `eyJhbGci...` |
| `STORAGE_BUCKET` | Nombre del bucket de Supabase Storage | `bitalis-media` |
| `CORS_ORIGIN` | Dominios permitidos para solicitudes cross-origin | `https://app.midominio.com,https://api.midominio.com` |

---

> **Regla de Seguridad Estricta:** NUNCA imprimir o incluir en logs las variables `DATABASE_URL`, `JWT_SECRET`, ni `SUPABASE_SERVICE_ROLE_KEY`.
