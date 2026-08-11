# BITALIS — Despliegue en Hostinger Node.js

## Arquitectura objetivo

- Next.js / React PWA
- Node.js en Hostinger
- Prisma ORM
- MySQL Hostinger
- Base: `u490535922_bitalis`
- Host MySQL: `srv1356.hstgr.io`
- Puerto: `3306`

## Variables de entorno

Configurar en Hostinger, nunca en Git:

```env
NODE_ENV=production
DATABASE_URL=mysql://u490535922_bitalis:CONTRASEÑA@srv1356.hstgr.io:3306/u490535922_bitalis
NEXTAUTH_URL=https://TU-DOMINIO
JWT_SECRET=SECRETO_LARGO_Y_ALEATORIO
```

## Build

```bash
npm ci
npx prisma generate
npm run build
```

## Start

```bash
npm start
```

La aplicación debe escuchar el puerto proporcionado por `PORT`.

## Importante

Antes de ejecutar `prisma migrate deploy` en producción, `prisma/schema.prisma` debe estar validado para el proveedor MySQL. No ejecutar una migración automática mientras el datasource siga en PostgreSQL.

## Seguridad

- No subir `.env` ni contraseñas.
- No exponer `JWT_SECRET`.
- No usar credenciales de base de datos en código frontend.
- Ejecutar migraciones desde un entorno controlado.
- Hacer backup de MySQL antes de cada migración estructural.
