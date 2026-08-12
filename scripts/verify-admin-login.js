const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      userRoles: {
        include: { role: true }
      }
    }
  });

  if (!user) throw new Error('Admin user not found');
  if (user.accountStatus !== 'ACTIVE') throw new Error(`Admin status is ${user.accountStatus}`);

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) throw new Error('Admin password hash verification failed');

  const roles = user.userRoles.map((r) => r.role.name);
  if (!roles.includes('ADMIN')) throw new Error('Admin user does not have ADMIN role');

  const roleCount = await prisma.role.count();
  const permissionCount = await prisma.permission.count();

  console.log('Admin authentication data verified');
  console.log({ email: user.email, roles, roleCount, permissionCount });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
