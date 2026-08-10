# Guía de Configuración de Supabase (PostgreSQL + Storage)

Esta guía documenta la infraestructura en Supabase para el sistema **BITALIS ERP + CRM + Cobranza**.

---

## 1. Crear Proyecto en Supabase
1. Ingresa a [supabase.com](https://supabase.com) y crea un nuevo proyecto.
2. Asigna un nombre (ejemplo: `bitalis-erp-production`) y una contraseña fuerte para PostgreSQL.
3. Selecciona la región más cercana a tus usuarios (ej. `us-east-1` o `sa-east-1`).

---

## 2. Configurar la Base de Datos PostgreSQL
Supabase provee dos URLs de conexión:

1. **Transaction Pooler (Puerto 6543):** Para uso en runtime con NestJS/Prisma en serverless/webapps.
   `postgresql://postgres.[REF]:[PASS]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbooster=true`
2. **Direct Connection (Puerto 5432):** Para ejecutar migraciones DDL con Prisma Migrate.
   `postgresql://postgres.[REF]:[PASS]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`

---

## 3. Configurar Supabase Storage
El sistema BITALIS utiliza **Supabase Storage** para almacenar fotos de clientes, fachadas, comprobantes y contratos (impidiendo guardar binarios pesados en la BD relacional).

1. En el panel de Supabase, entra a **Storage > Buckets**.
2. Crea un bucket llamado: `bitalis-media`.
3. Configura el bucket como **Private** o **Public** (según requerimiento de URLs firmadas).
4. Configura políticas RLS para acceso mediante Service Role Key desde el backend NestJS.

---

## 4. Estructura de Metadata guardada en PostgreSQL
PostgreSQL almacena únicamente la referencia de los archivos:
- `mediaId`
- `bucket`
- `path`
- `mimeType`
- `size`
- `status`
- `metadata`

---

## 5. Respaldos Automáticos
Supabase realiza backups diarios automáticos con PITR (Point-in-Time Recovery) en planes de producción.
