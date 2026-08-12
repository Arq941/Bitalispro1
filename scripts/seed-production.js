const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const roles = [
  ['ADMIN', 'Acceso global al sistema'],
  ['SUPERVISORA', 'Supervisión operativa y autorizaciones'],
  ['VENDEDORA', 'Ventas, clientes y seguimiento comercial'],
  ['COBRADOR', 'Cobranza en ruta, visitas y caja']
];

const permissions = [
  ['dashboard.read', 'Ver dashboard'],
  ['clients.read', 'Ver clientes'],
  ['clients.write', 'Crear y actualizar clientes'],
  ['products.read', 'Ver productos'],
  ['products.write', 'Administrar productos'],
  ['inventory.read', 'Ver inventario'],
  ['inventory.write', 'Administrar inventario'],
  ['sales.read', 'Ver ventas'],
  ['sales.write', 'Crear y actualizar ventas'],
  ['credits.read', 'Ver créditos'],
  ['collections.read', 'Ver cobranza'],
  ['collections.write', 'Registrar cobranza'],
  ['cash.read', 'Ver caja'],
  ['cash.write', 'Operar caja'],
  ['commissions.read', 'Ver comisiones'],
  ['commissions.approve', 'Aprobar comisiones'],
  ['reports.read', 'Ver reportes'],
  ['audit.read', 'Ver auditoría'],
  ['authorizations.manage', 'Gestionar autorizaciones'],
  ['users.manage', 'Administrar usuarios y permisos']
];

const rolePermissionMap = {
  ADMIN: permissions.map(([code]) => code),
  SUPERVISORA: [
    'dashboard.read','clients.read','products.read','inventory.read','sales.read','credits.read',
    'collections.read','cash.read','commissions.read','commissions.approve','reports.read','audit.read',
    'authorizations.manage'
  ],
  VENDEDORA: [
    'dashboard.read','clients.read','clients.write','products.read','inventory.read','sales.read','sales.write','credits.read'
  ],
  COBRADOR: [
    'dashboard.read','clients.read','credits.read','collections.read','collections.write','cash.read','cash.write'
  ]
};

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Administrador';
  const adminLastName = process.env.ADMIN_LAST_NAME || 'BITALIS';

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }
  if (adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  }

  const roleRecords = {};
  for (const [name, description] of roles) {
    roleRecords[name] = await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description }
    });
  }

  const permissionRecords = {};
  for (const [code, description] of permissions) {
    permissionRecords[code] = await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description }
    });
  }

  for (const [roleName, codes] of Object.entries(rolePermissionMap)) {
    const role = roleRecords[roleName];
    for (const code of codes) {
      const permission = permissionRecords[code];
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      firstName: adminFirstName,
      lastName: adminLastName,
      passwordHash,
      accountStatus: 'ACTIVE',
      passwordChangedAt: new Date()
    },
    create: {
      email: adminEmail.toLowerCase(),
      firstName: adminFirstName,
      lastName: adminLastName,
      passwordHash,
      accountStatus: 'ACTIVE',
      passwordChangedAt: new Date()
    }
  });

  const adminRole = roleRecords.ADMIN;
  await prisma.userRoleMapping.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id
    }
  });

  console.log('Production seed completed successfully');
  console.log(`Roles: ${roles.length}`);
  console.log(`Permissions: ${permissions.length}`);
  console.log(`Admin: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
