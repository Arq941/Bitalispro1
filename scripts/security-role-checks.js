const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error('SECURITY CHECK FAILED: ' + message);
    process.exitCode = 1;
  }
};

const payments = read('app/api/payments/route.ts');
const permissions = read('src/server/auth/permission.service.ts');
const adminAccess = read('app/api/admin/access/route.ts');
const shell = read('components/phase15/AppShell.tsx');

assert(payments.includes("requirePermission(verified.sub, 'collections.collect')"),
  'payment writes must require collections.collect');
assert(payments.includes("role === 'COBRADOR' && credit.client.assignedCollectorId !== verified.sub"),
  'collector payments must be limited to the assigned portfolio');
assert(payments.includes("credit.status !== 'ACTIVE'"),
  'payments must reject inactive credits');
assert(!permissions.includes('if (!configured) return true'),
  'missing role configuration must never grant global access');
assert(permissions.includes('SECURE_ROLE_DEFAULTS'),
  'legacy roles must use a least-privilege fallback');
for (const role of ['ADMIN', 'SUPERVISORA', 'VENDEDORA', 'COBRADOR']) {
  assert(adminAccess.includes(role), 'admin access matrix must include ' + role);
  assert(shell.includes(role), 'application shell must include ' + role);
}
for (const permission of ['collections.collect', 'sales.create', 'sales.approve', 'users.manage']) {
  assert(permissions.includes(permission), 'permission catalog must include ' + permission);
}

if (!process.exitCode) console.log('ROLE_SECURITY_CHECKS_OK');
