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
const middleware = read('middleware.ts');
const securityService = read('src/server/auth/security.service.ts');
const refundRoute = read('app/api/cash-sessions/[id]/refunds/route.ts');
const conflictResolution = read('app/api/offline/conflicts/[id]/resolve/route.ts');
const nextConfig = read('next.config.ts');

assert(!securityService.includes('bitalis_super_secret_jwt_key'),
  'JWT signing must never fall back to a repository secret');
assert(securityService.includes('JWT_SECRET debe existir'),
  'missing JWT_SECRET must fail closed');
assert(middleware.includes("matcher:['/api/:path*']") && middleware.includes("crypto.subtle.verify('HMAC'"),
  'every API route must pass the central cryptographic authentication gate');
assert(middleware.includes('SUPERVISION_PREFIXES') && middleware.includes('ADMIN_ONLY_PREFIXES'),
  'legacy APIs must be protected centrally by role');
assert(refundRoute.includes("requireTrustedRole(req,['ADMIN','SUPERVISORA'])") && refundRoute.includes('authorizedBy: supervisor.userId'),
  'refunds must use the authenticated supervisor identity');
assert(conflictResolution.includes("requireTrustedRole(req,['ADMIN','SUPERVISORA'])") && conflictResolution.includes('supervisorId: supervisor.userId'),
  'offline conflicts must not trust client-supplied supervisor identifiers');
for(const header of ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options']){
  assert(nextConfig.includes(header),'global security headers must include '+header);
}

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

const offlineStorage = read('lib/offline-storage.ts');
const offlineClient = read('lib/offline-sync-client.ts');
const offlineRoute = read('app/api/offline/sync/route.ts');
const offlineIndicator = read('components/offline/OfflineSyncIndicator.tsx');
const offlineService = read('src/offline/offline-sync.service.ts');
assert(offlineStorage.includes("const DB_VERSION=2") && offlineStorage.includes("recoverStuck") && offlineStorage.includes("applyServerResult"),
  'offline queue must recover interrupted sync and reconcile each server result');
assert(offlineStorage.includes("userId") && offlineStorage.includes("deviceId") && offlineStorage.includes("__ownerUserId"),
  'offline operations and cached records must remain scoped to their owner and device');
assert(offlineClient.includes("apiClient<SyncReply>") && !offlineClient.includes("'COBRADOR-01'") && !offlineClient.includes("'PWA-DEVICE-01'"),
  'offline sync must use authenticated API access and never fallback to fabricated identities');
assert(offlineRoute.includes("MAX_BATCH=25") && offlineRoute.includes("userId:undefined") && offlineRoute.includes("extractUserContext"),
  'offline batches must be bounded and bound exclusively to the verified session');
assert(offlineIndicator.includes("applyServerResult") === false && offlineIndicator.includes("syncOfflineQueue"),
  'offline UI must delegate per-operation reconciliation to the single sync coordinator');
assert(offlineService.includes("OFFLINE_HANDLER_NOT_IMPLEMENTED") && !offlineService.includes("Generic fallback for custom synced entity"),
  'offline sync must never confirm a domain operation without executing its handler');

if (!process.exitCode) console.log('ROLE_SECURITY_CHECKS_OK');
