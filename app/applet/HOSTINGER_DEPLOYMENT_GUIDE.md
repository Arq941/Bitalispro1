# Guía de Despliegue en Hostinger Node.js Web App

Esta guía detalla paso a paso el despliegue del sistema **BITALIS ERP + CRM + Cobranza en Ruta** en el servicio de **Hostinger Web App Node.js**.

---

## Requisitos Previos

1. Cuenta de Hostinger con plan que soporte **Node.js Web App** (o VPS Node.js).
2. Proyecto de **Supabase** configurado con PostgreSQL y Supabase Storage.
3. Dominio o subdominio apuntado a Hostinger (`app.midominio.com` o `api.midominio.com`).
4. Repositorio Git del proyecto subido a GitHub / GitLab.

---

## Pasos de Despliegue en Hostinger

### 1. Crear la Web App de Node.js en hPanel
1. Inicia sesión en **hPanel** de Hostinger.
2. Dirígete a **Avanzado > Node.js Web App** o **Sitios Web > Administrar**.
3. Selecciona la versión de Node.js: **Node.js 20 LTS**.
4. Modode Aplicación: **Production**.
5. Directorio de la aplicación: `/public_html` o la carpeta raíz asignada a tu subdominio.

### 2. Conectar el Repositorio Git
1. En la sección Git de hPanel, añade el repositorio con la rama `main`.
2. Habilita el despliegue automático o ejecuta el desplegado inicial.

### 3. Configurar el comando de Build y Start
En la configuración de la Web App en Hostinger:
- **Build Command:** `npm run build`
- **Start Command:** `npm run start`

### 4. Configurar Variables de Entorno en Hostinger
Ingresa a la sección de **Variables de Entorno** e incluye lo siguiente:

```env
NODE_ENV=production
PORT=3000

DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbooster=true"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

JWT_SECRET="bitalis_super_secret_jwt_key_360_prod_998234"
JWT_REFRESH_SECRET="bitalis_super_secret_refresh_key_360_prod_998234"
JWT_EXPIRES_IN="8h"
JWT_REFRESH_EXPIRES_IN="7d"

SUPABASE_URL="https://[REF].supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

STORAGE_BUCKET="bitalis-media"

CORS_ORIGIN="https://app.midominio.com,https://api.midominio.com"
```

### 5. Certificado SSL / HTTPS
1. En hPanel, activa **SSL Gratuito (Let's Encrypt)** para el dominio y subdominios.
2. Fuerza el tráfico HTTPS en la configuración de la Web App.

### 6. Ejecutar Generación de Prisma y Migraciones
En la consola/terminal SSH de Hostinger:
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 7. Verificación del Health Check
Accede en tu navegador a:
- `https://api.midominio.com/api/system/health`
- `https://api.midominio.com/api/system/version`
- `https://api.midominio.com/api/deployment/status`

Respuesta esperada:
```json
{
  "environment": "production",
  "version": "1.0.0",
  "database": "connected",
  "storage": "available"
}
```

### 8. PWA e Instalación en Android
1. Abre el dominio en Chrome en teléfonos Android.
2. Aparecerá la opción **"Instalar aplicación BITALIS ERP"**.
3. Verifica la operación offline apagando los datos/WiFi: el cobrador podrá seguir registrando abonos, visitas y promesas de pago localmente en IndexedDB.
