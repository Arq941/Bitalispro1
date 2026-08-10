# Guía de Respaldos y Restauración (BACKUP_RESTORE_GUIDE.md)

Estrategia integral de copias de seguridad y recuperación ante desastres para **BITALIS ERP**.

---

## 1. Copias de Seguridad Automáticas (Supabase)
Supabase ejecuta backups automáticos diarios de PostgreSQL.

---

## 2. Respaldo Manual Pre-Despliegue (`pg_dump`)
Antes de desplegar cualquier cambio crítico o actualización de producción:

```bash
pg_dump "postgresql://postgres.[REF]:[PASS]@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  --clean --if-exists --no-owner --no-privileges \
  --file=bitalis_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 3. Guía de Restauración (`psql` / Restore Test)
Para validar y restaurar una copia de seguridad en una base de datos de contingencia:

1. Crear base de datos de pruebas o producción.
2. Ejecutar restauración:

```bash
psql "postgresql://postgres.[REF]:[PASS]@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  --file=bitalis_backup_YYYYMMDD_HHMMSS.sql
```

3. Ejecutar verificación de integridad financiera y prueba de congruencia:
   - Verificar cliente saldo $1,090.
   - Verificar inmutabilidad de movimientos de caja y pagos.
