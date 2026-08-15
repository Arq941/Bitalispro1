const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();
const REQUIRED_CONFIRMATION = 'BORRAR_DATOS_PRUEBA_BITALIS';
const RESET_MARKER = 'initial-real-data-2026-08-15';
const ROOT_MODELS = ['Payment', 'Sale', 'Client', 'Product'];

function delegateName(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function deriveTargetModels() {
  const models = Prisma.dmmf.datamodel.models;
  const existing = new Set(models.map((model) => model.name));
  const targets = new Set(ROOT_MODELS.filter((name) => existing.has(name)));

  let changed = true;
  while (changed) {
    changed = false;
    for (const model of models) {
      if (targets.has(model.name)) continue;
      const referencesTarget = model.fields.some(
        (field) => field.kind === 'object'
          && Array.isArray(field.relationFromFields)
          && field.relationFromFields.length > 0
          && targets.has(field.type)
      );
      if (referencesTarget) {
        targets.add(model.name);
        changed = true;
      }
    }
  }
  return { models, targets };
}

function deletionOrder(models, targets) {
  const edges = new Map();
  const indegree = new Map();
  for (const name of targets) {
    edges.set(name, new Set());
    indegree.set(name, 0);
  }

  for (const model of models) {
    if (!targets.has(model.name)) continue;
    for (const field of model.fields) {
      if (field.kind !== 'object' || !Array.isArray(field.relationFromFields) || field.relationFromFields.length === 0) continue;
      if (!targets.has(field.type) || field.type === model.name) continue;
      if (!edges.get(model.name).has(field.type)) {
        edges.get(model.name).add(field.type);
        indegree.set(field.type, (indegree.get(field.type) || 0) + 1);
      }
    }
  }

  const queue = [...targets].filter((name) => indegree.get(name) === 0).sort();
  const ordered = [];
  while (queue.length) {
    const current = queue.shift();
    ordered.push(current);
    for (const parent of edges.get(current) || []) {
      const next = (indegree.get(parent) || 0) - 1;
      indegree.set(parent, next);
      if (next === 0) {
        queue.push(parent);
        queue.sort();
      }
    }
  }

  if (ordered.length !== targets.size) {
    const unresolved = [...targets].filter((name) => !ordered.includes(name));
    throw new Error(`No se pudo determinar un orden seguro de borrado: ${unresolved.join(', ')}`);
  }
  return ordered;
}

async function main() {
  if (process.env.BITALIS_RESET_CONFIRMATION !== REQUIRED_CONFIRMATION) {
    throw new Error('Confirmación de borrado inválida.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');

  const previousReset = await prisma.auditLog.findFirst({
    where: { action: 'PRODUCTION_DATA_RESET_COMPLETED', entity: 'System', entityId: RESET_MARKER },
    select: { id: true, createdAt: true },
  });
  if (previousReset) {
    throw new Error(`El borrado inicial ya fue ejecutado (${previousReset.createdAt.toISOString()}). No se permite repetirlo.`);
  }

  const { models, targets } = deriveTargetModels();
  const order = deletionOrder(models, targets);
  const before = {};

  for (const modelName of order) {
    const delegate = prisma[delegateName(modelName)];
    if (!delegate || typeof delegate.count !== 'function') throw new Error(`Delegate Prisma no disponible: ${modelName}`);
    before[modelName] = await delegate.count();
  }

  console.log('BITALIS production reset: modelos dependientes detectados');
  console.log(order.map((name) => `${name}:${before[name]}`).join(' | '));

  const deleted = await prisma.$transaction(async (tx) => {
    const totals = {};
    for (const modelName of order) {
      const delegate = tx[delegateName(modelName)];
      const result = await delegate.deleteMany({});
      totals[modelName] = result.count;
    }

    for (const root of ROOT_MODELS) {
      const delegate = tx[delegateName(root)];
      if (!delegate) continue;
      const remaining = await delegate.count();
      if (remaining !== 0) throw new Error(`${root} conserva ${remaining} registros después del borrado.`);
    }

    await tx.auditLog.create({
      data: {
        action: 'PRODUCTION_DATA_RESET_COMPLETED',
        entity: 'System',
        entityId: RESET_MARKER,
        newValues: JSON.stringify({
          roots: ROOT_MODELS,
          deleted: totals,
          purpose: 'Inicio de captura de datos reales',
        }),
      },
    });
    return totals;
  }, { timeout: 120000 });

  console.log('BITALIS production reset COMPLETADO');
  console.log(JSON.stringify(deleted));
}

main()
  .catch((error) => {
    console.error('BITALIS production reset FAILED:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
