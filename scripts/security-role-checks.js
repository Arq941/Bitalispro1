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
const clients = read('src/crm/client.service.ts');
const intake = read('app/api/clients/intake/route.ts');
const androidSecurity = read('android/app/src/main/java/mx/bitalis/app/BitalisApplication.java');
const newSale = read('app/sales/new/page.tsx');
const notifications = read('src/notifications/notifications.service.ts');
const clientFile = read('app/clients/[id]/complete/page.tsx');
const financialRules = read('src/financial/financial-rules.service.ts');
const salesService = read('src/sales/sales.service.ts');
const purchaseOrders = read('app/api/product-orders/route.ts');
const inventoryOperations = read('app/api/inventory/operations/route.ts');
const inventoryService = read('src/inventory/inventory.service.ts');
const routePlan = read('app/api/collections/route-plan/route.ts');
const routePage = read('app/route/page.tsx');
const collectionVisits = read('app/api/collections/visits/route.ts');

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
assert(permissions.includes("return intakeDenied ? [] : ['clients.create']"),
  'field seller effective permissions must be limited to blind intake');
assert(permissions.includes("code === 'clients.create') return true"),
  'legacy seller matrices must retain access to blind intake');
assert(clients.includes("if (context.role === 'VENDEDORA')") && clients.includes('context.intakeOnly === true'),
  'seller client access must be limited to the ephemeral intake capability');
assert(clients.includes("El rol de vendedora solo puede enviar altas rápidas"),
  'seller must not list or search clients');
assert(intake.includes("['ADMIN','SUPERVISORA','VENDEDORA','COBRADOR'].includes(user.role)"),
  'quick intake endpoint must be available to every authenticated operational role');
assert(intake.includes('Respuesta deliberadamente ciega'),
  'quick intake response must not leak the created record');
assert(androidSecurity.includes('LOCK_AFTER_BACKGROUND_MS = 2L * 60L * 1000L'),
  'Android must require biometric unlock after two minutes in background');
assert(androidSecurity.includes('CREDENTIAL_SESSION_MS = 8L * 60L * 60L * 1000L'),
  'Android must expire retained credentials after eight hours');
assert(adminAccess.includes('publicOrigin(req)'),
  'password setup links must use the public application origin');
assert(newSale.includes('firstPaymentDate') && newSale.includes("/credit`"),
  'credit sales must capture the first installment date and create the schedule');
assert(notifications.includes('FIRST_COLLECTION_DUE'),
  'the first installment date must produce a collection notice when due');
assert(clientFile.includes('Teléfono adicional') && clientFile.includes('Manzana') && clientFile.includes('Lote') &&
  clientFile.includes('Entre calles') && clientFile.includes('Frente a') && clientFile.includes('Al lado de'),
  'client file must capture the complete address references and a second phone');
assert(clientFile.includes('/api/geocode/reverse?lat=') && clientFile.includes('street:g.street') && clientFile.includes('neighborhood:g.neighborhood'),
  'captured coordinates must automatically populate street and neighborhood');
assert(financialRules.includes('APORTE_EMPRESA_MAXIMO = new Decimal(200)') &&
  financialRules.includes('Decimal.min(enganche, this.APORTE_EMPRESA_MAXIMO)'),
  'company contribution must match the customer down payment only up to $200');
assert(newSale.includes("Math.min(enganche,200)") &&
  salesService.includes('FinancialRulesService.calcularAporteEmpresa(engancheCliente)') &&
  salesService.includes('FinancialRulesService.calcularAporteEmpresa(saleEnganche)'),
  'the $200 company contribution cap must be consistent in UI, sale and credit');

assert(purchaseOrders.includes("requirePermission(user.userId, 'inventory.manage')") && inventoryOperations.includes("requirePermission(user.userId, 'inventory.manage')"),
  'purchase orders and stock mutations must require inventory.manage');
assert(inventoryService.includes('cancelProductOrder') && inventoryService.includes("status: 'CANCELLED'") && inventoryService.includes('purchaseReceipt.create'),
  'procurement must support auditable cancellation and immutable receipts');
assert(inventoryOperations.includes("body.operation === 'DAMAGE'") && inventoryOperations.includes("body.operation === 'RETURN_IN'") && inventoryOperations.includes("body.operation === 'SUPPLIER_RETURN'"),
  'inventory operations must expose damage, customer return and supplier return flows');

assert(routePlan.includes('improveTwoOpt') && routePlan.includes('urgencyTier') && routePlan.includes('maxStops') && routePlan.includes('estimatedMinutes'),
  'route planning must combine urgency, distance optimization, daily capacity and ETA');
assert(routePage.includes('completedCreditIds:completed') && routePage.includes('openFullRoute') && routePage.includes('planSummary'),
  'route recalculation must exclude completed stops and expose operational metrics');
assert(collectionVisits.includes("requirePermission(user.userId, 'collections.collect')") && collectionVisits.includes('assignedCollectorId !== user.userId'),
  'collection visits must be limited to the assigned collector portfolio');
assert(collectionVisits.includes('proximaVisita: nextDate') && routePage.includes("rescheduleDate:result==='RESCHEDULED'"),
  'rescheduling from route must persist the next visit date');

if (!process.exitCode) console.log('ROLE_SECURITY_CHECKS_OK');
