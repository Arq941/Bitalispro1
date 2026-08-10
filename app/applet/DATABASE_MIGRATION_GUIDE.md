# Guía de Migraciones de Base de Datos (DATABASE_MIGRATION_GUIDE.md)

Instrucciones para gestionar las migraciones del esquema PostgreSQL utilizando Prisma ORM.

---

## 1. Generar Artefactos de Prisma
Cada vez que se modifica el archivo `prisma/schema.prisma` o los modelos de datos:

```bash
npm run prisma:generate
```

---

## 2. Aplicar Migraciones en Desarrollo
Para crear y aplicar una nueva migración en ambiente local/desarrollo:

```bash
npx prisma migrate dev --name <nombre_migracion>
```

---

## 3. Aplicar Migraciones en Producción (Hostinger / Supabase)
En producción, nunca uses `prisma migrate dev`. Ejecuta la migración de forma idempotente y segura usando la variable `DIRECT_URL`:

```bash
npm run prisma:migrate
```

El script `prisma:migrate` ejecuta internamente:
`npx prisma migrate deploy`

---

## 4. Inspección de Base de Datos
Para visualizar e interactuar con la base de datos de manera gráfica:

```bash
npm run prisma:studio
```
