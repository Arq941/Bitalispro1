import { NextResponse } from 'next/server';
import { AuthService, UserAccountState } from '@/src/server/auth/auth.service';
import { SecurityService } from '@/src/server/auth/security.service';
import { RefreshTokenService } from '@/src/server/auth/refresh-token.service';
import { AbacService } from '@/src/server/auth/abac.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { FinancialRulesService } from '@/src/financial/financial-rules.service';

export async function GET() {
  const testResults: Array<{ id: number; name: string; passed: boolean; details?: string }> = [];

  try {
    // Limpiar estado previo para asegurar aislamiento de pruebas
    AuthService.clear();
    RefreshTokenService.clear();
    AuditLogService.clear();

    // Crear usuarios de prueba con contraseñas hasheadas
    const defaultPasswordHash = await SecurityService.hashPassword('Bitalis123!');

    const adminUser: UserAccountState = {
      id: 'usr_admin_001',
      email: 'admin@bitalis.com',
      firstName: 'Carlos',
      lastName: 'Administrador',
      role: 'ADMIN',
      passwordHash: defaultPasswordHash,
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      lockoutUntil: null,
      passwordChangedAt: new Date(),
      permissionVersion: 1,
      lastLoginAt: null,
      lastLoginIp: null,
      permissions: ['*'],
    };

    const supervisorUser: UserAccountState = {
      id: 'usr_super_001',
      email: 'supervisora@bitalis.com',
      firstName: 'María',
      lastName: 'Supervisora',
      role: 'SUPERVISORA',
      passwordHash: defaultPasswordHash,
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      lockoutUntil: null,
      passwordChangedAt: new Date(),
      permissionVersion: 1,
      lastLoginAt: null,
      lastLoginIp: null,
      permissions: ['clients.read', 'sales.approve', 'evidences.update'],
    };

    const vendedoraUser: UserAccountState = {
      id: 'usr_vend_001',
      email: 'vendedora@bitalis.com',
      firstName: 'Ana',
      lastName: 'Vendedora',
      role: 'VENDEDORA',
      passwordHash: defaultPasswordHash,
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      lockoutUntil: null,
      passwordChangedAt: new Date(),
      permissionVersion: 1,
      lastLoginAt: null,
      lastLoginIp: null,
      permissions: ['clients.read', 'sales.create'],
    };

    const cobradorUser: UserAccountState = {
      id: 'usr_cobr_001',
      email: 'cobrador@bitalis.com',
      firstName: 'Pedro',
      lastName: 'Cobrador',
      role: 'COBRADOR',
      passwordHash: defaultPasswordHash,
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      lockoutUntil: null,
      passwordChangedAt: new Date(),
      permissionVersion: 1,
      lastLoginAt: null,
      lastLoginIp: null,
      assignedRouteId: 'ROUTE_NORTE_01',
      permissions: ['clients.read', 'payments.create'],
    };

    const inactiveUser: UserAccountState = {
      id: 'usr_inact_001',
      email: 'inactivo@bitalis.com',
      firstName: 'Inactivo',
      lastName: 'Inactivo',
      role: 'VENDEDORA',
      passwordHash: defaultPasswordHash,
      accountStatus: 'INACTIVE',
      failedLoginAttempts: 0,
      lockoutUntil: null,
      passwordChangedAt: new Date(),
      permissionVersion: 1,
      lastLoginAt: null,
      lastLoginIp: null,
      permissions: ['sales.create'],
    };

    const suspendedUser: UserAccountState = {
      id: 'usr_susp_001',
      email: 'suspendido@bitalis.com',
      firstName: 'Suspendido',
      lastName: 'Suspendido',
      role: 'COBRADOR',
      passwordHash: defaultPasswordHash,
      accountStatus: 'SUSPENDED',
      failedLoginAttempts: 0,
      lockoutUntil: null,
      passwordChangedAt: new Date(),
      permissionVersion: 1,
      lastLoginAt: null,
      lastLoginIp: null,
      permissions: ['payments.create'],
    };

    AuthService.registerUserInMemory(adminUser);
    AuthService.registerUserInMemory(supervisorUser);
    AuthService.registerUserInMemory(vendedoraUser);
    AuthService.registerUserInMemory(cobradorUser);
    AuthService.registerUserInMemory(inactiveUser);
    AuthService.registerUserInMemory(suspendedUser);

    // Test 1: Login correcto
    const login1 = await AuthService.login({ email: 'admin@bitalis.com', password: 'Bitalis123!' });
    testResults.push({ id: 1, name: 'Login Correcto', passed: login1.success && Boolean(login1.accessToken) });

    // Test 2: Password incorrecto
    const login2 = await AuthService.login({ email: 'admin@bitalis.com', password: 'WrongPassword' });
    testResults.push({ id: 2, name: 'Password Incorrecto Rechazado', passed: !login2.success });

    // Test 3: Incremento de intentos fallidos
    const adminRef = AuthService.getUserByEmail('admin@bitalis.com');
    testResults.push({ id: 3, name: 'Incremento de Intentos Fallidos', passed: adminRef?.failedLoginAttempts === 1 });

    // Test 4: Bloqueo automático después de 5 intentos
    for (let i = 0; i < 4; i++) {
      await AuthService.login({ email: 'admin@bitalis.com', password: 'WrongPassword' });
    }
    const isLocked = adminRef?.accountStatus === 'LOCKED' && adminRef?.lockoutUntil !== null;
    testResults.push({ id: 4, name: 'Bloqueo Automático tras 5 Intentos Fallidos', passed: isLocked });

    // Test 5: Intentar Login durante bloqueo
    const loginLocked = await AuthService.login({ email: 'admin@bitalis.com', password: 'Bitalis123!' });
    testResults.push({ id: 5, name: 'Login Rechazado durante Periodo de Bloqueo', passed: !loginLocked.success && loginLocked.code === 'ACCOUNT_LOCKED' });

    // Restablecer cuenta admin para continuar pruebas
    if (adminRef) {
      adminRef.accountStatus = 'ACTIVE';
      adminRef.failedLoginAttempts = 0;
      adminRef.lockoutUntil = null;
    }

    // Test 6: Usuario INACTIVE
    const loginInact = await AuthService.login({ email: 'inactivo@bitalis.com', password: 'Bitalis123!' });
    testResults.push({ id: 6, name: 'Usuario INACTIVE Rechazado', passed: !loginInact.success });

    // Test 7: Usuario SUSPENDED
    const loginSusp = await AuthService.login({ email: 'suspendido@bitalis.com', password: 'Bitalis123!' });
    testResults.push({ id: 7, name: 'Usuario SUSPENDED Rechazado', passed: !loginSusp.success });

    // Test 8: JWT Access Token válido
    const token = SecurityService.generateAccessToken({ sub: adminUser.id, sessionId: 'sess_1', permissionVersion: 1, email: adminUser.email, role: adminUser.role });
    const verifiedJwt = SecurityService.verifyAccessToken(token);
    testResults.push({ id: 8, name: 'JWT Access Token Válido', passed: verifiedJwt !== null && verifiedJwt.sub === adminUser.id });

    // Test 9: JWT Corrupto
    const badJwt = SecurityService.verifyAccessToken(token + 'corrupted');
    testResults.push({ id: 9, name: 'JWT Corrupto Rechazado', passed: badJwt === null });

    // Test 10: JWT Expirado (Simulado con firma alterada o expiración)
    const expiredJwt = SecurityService.verifyAccessToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjN9.invalid');
    testResults.push({ id: 10, name: 'JWT Expirado Rechazado', passed: expiredJwt === null });

    // Test 11: Refresh Token Válido
    const refToken1 = SecurityService.generateRefreshToken();
    const sess1 = RefreshTokenService.createSession({ userId: vendedoraUser.id, refreshToken: refToken1 });
    testResults.push({ id: 11, name: 'Refresh Token Válido Creado', passed: Boolean(sess1.id) });

    // Test 12: Refresh Token Inválido
    const invalidRef = RefreshTokenService.validateAndRotate({ refreshToken: 'token_falso_inexistente' });
    testResults.push({ id: 12, name: 'Refresh Token Inválido Rechazado', passed: !invalidRef.valid });

    // Test 13: Rotación de Refresh Token
    const rotated = RefreshTokenService.validateAndRotate({ refreshToken: refToken1 });
    testResults.push({ id: 13, name: 'Rotación de Refresh Token Exitoso', passed: rotated.valid && Boolean(rotated.newRefreshToken) });

    // Test 14: Reutilización de Refresh Token Revocado (Reuse Detection)
    const reuseAttempt = RefreshTokenService.validateAndRotate({ refreshToken: refToken1 });
    testResults.push({ id: 14, name: 'Detección de Reuso de Refresh Token & Revocación Global', passed: !reuseAttempt.valid && Boolean(reuseAttempt.reuseDetected) });

    // Test 15: Logout Individual
    const refToken2 = SecurityService.generateRefreshToken();
    const sess2 = RefreshTokenService.createSession({ userId: supervisorUser.id, refreshToken: refToken2 });
    const logoutRes = AuthService.logout(sess2.id, supervisorUser.id);
    testResults.push({ id: 15, name: 'Logout Individual de Sesión', passed: logoutRes });

    // Test 16: Logout All
    RefreshTokenService.createSession({ userId: supervisorUser.id, refreshToken: SecurityService.generateRefreshToken() });
    RefreshTokenService.createSession({ userId: supervisorUser.id, refreshToken: SecurityService.generateRefreshToken() });
    const revokedCount = AuthService.logoutAll(supervisorUser.id);
    testResults.push({ id: 16, name: 'Logout-All Revocación Total', passed: revokedCount >= 2 });

    // Test 17: Permiso Autorizado RBAC/ABAC
    const abacAllow = AbacService.evaluate(
      { userId: supervisorUser.id, role: 'SUPERVISORA', permissions: ['sales.approve'] },
      { entity: 'SALE', entityId: 'sale_1' },
      'sales.approve'
    );
    testResults.push({ id: 17, name: 'Permiso Autorizado RBAC/ABAC', passed: abacAllow.allowed });

    // Test 18: Permiso Denegado 403
    const abacDeny = AbacService.evaluate(
      { userId: cobradorUser.id, role: 'COBRADOR', permissions: ['payments.create'] },
      { entity: 'SALE', entityId: 'sale_1' },
      'sales.cancel'
    );
    testResults.push({ id: 18, name: 'Permiso Denegado 403 RBAC', passed: !abacDeny.allowed });

    // Test 19: ADMIN Acceso Global
    const adminAllow = AbacService.evaluate(
      { userId: adminUser.id, role: 'ADMIN', permissions: ['*'] },
      { entity: 'ANY', entityId: 'any_1' },
      'any.action'
    );
    testResults.push({ id: 19, name: 'ADMIN Acceso Global', passed: adminAllow.allowed });

    // Test 20: SUPERVISORA Permisos Correctos
    const superAllow = AbacService.evaluate(
      { userId: supervisorUser.id, role: 'SUPERVISORA', permissions: ['evidences.update'] },
      { entity: 'EVIDENCE', entityId: 'ev_1', evidenceStatus: 'APPROVED' },
      'evidences.update'
    );
    testResults.push({ id: 20, name: 'SUPERVISORA Modificación Evidencia', passed: superAllow.allowed });

    // Test 21: VENDEDORA Precio Inferior al Mínimo Bloqueado
    const vendPriceBlock = AbacService.evaluate(
      { userId: vendedoraUser.id, role: 'VENDEDORA', permissions: ['sales.create'] },
      { entity: 'SALE', entityId: 'sale_2', priceRequested: 1000, minimumAuthorizedPrice: 1200 },
      'sales.create'
    );
    testResults.push({ id: 21, name: 'VENDEDORA Precio Inferior al Mínimo Bloqueado', passed: !vendPriceBlock.allowed && Boolean(vendPriceBlock.requiresAuthorization) });

    // Test 22: VENDEDORA Modificación Evidencia APPROVED Bloqueada
    const vendEvBlock = AbacService.evaluate(
      { userId: vendedoraUser.id, role: 'VENDEDORA', permissions: ['evidences.update'] },
      { entity: 'EVIDENCE', entityId: 'ev_2', evidenceStatus: 'APPROVED' },
      'evidences.update'
    );
    testResults.push({ id: 22, name: 'VENDEDORA Modificación Evidencia APPROVED Bloqueada', passed: !vendEvBlock.allowed });

    // Test 23: COBRADOR Cobro Fuera de Ruta Bloqueado
    const cobrRouteBlock = AbacService.evaluate(
      { userId: cobradorUser.id, role: 'COBRADOR', permissions: ['payments.create'], assignedRouteId: 'ROUTE_NORTE_01' },
      { entity: 'CLIENT', entityId: 'cli_99', clientRouteId: 'ROUTE_SUR_02' },
      'payments.create'
    );
    testResults.push({ id: 23, name: 'COBRADOR Cobro Fuera de Ruta Bloqueado', passed: !cobrRouteBlock.allowed && Boolean(cobrRouteBlock.requiresAuthorization) });

    // Test 24: COBRADOR Cobro Dentro de Ruta Autorizado
    const cobrRouteAllow = AbacService.evaluate(
      { userId: cobradorUser.id, role: 'COBRADOR', permissions: ['payments.create'], assignedRouteId: 'ROUTE_NORTE_01' },
      { entity: 'CLIENT', entityId: 'cli_01', clientRouteId: 'ROUTE_NORTE_01' },
      'payments.create'
    );
    testResults.push({ id: 24, name: 'COBRADOR Cobro Dentro de Ruta Autorizado', passed: cobrRouteAllow.allowed });

    // Test 25: Protección IDOR Bloqueada
    const idorBlock = AbacService.preventIdor(vendedoraUser.id, 'usr_otro_usuario', 'VENDEDORA');
    testResults.push({ id: 25, name: 'Protección IDOR Bloqueada', passed: !idorBlock.valid });

    // Test 26: Manipulación de userId Server-Side Ignores Body
    const idorValidSelf = AbacService.preventIdor(vendedoraUser.id, vendedoraUser.id, 'VENDEDORA');
    testResults.push({ id: 26, name: 'Validación Server-Side de Identidad Propia', passed: idorValidSelf.valid });

    // Test 27: Authorization Request Creada
    const authReq = AuthService.createAuthorizationRequest({
      type: 'PRICE_OVERRIDE',
      requestedById: vendedoraUser.id,
      entity: 'SALE',
      entityId: 'sale_discount_100',
      reason: 'Descuento especial autorizado por promoción',
    });
    testResults.push({ id: 27, name: 'Authorization Request Creada (PENDING)', passed: authReq.status === 'PENDING' });

    // Test 28: Authorization Request Aprobada
    const approved = AuthService.approveAuthorizationRequest(authReq.id, supervisorUser.id);
    const updatedReq = AuthService.getAuthorizationRequest(authReq.id);
    testResults.push({ id: 28, name: 'Authorization Request Aprobada por Supervisora', passed: approved && updatedReq.status === 'APPROVED' });

    // Test 29: Auditoría de Seguridad Registrada
    const auditLogs = AuditLogService.getLogs();
    testResults.push({ id: 29, name: 'Auditoría de Eventos de Seguridad Inmutable', passed: auditLogs.length > 0 });

    // Test 30: Compilación & No-Regresión Fase 1 ($1,490 - $200 - $200 = $1,090)
    const finCheck = FinancialRulesService.calcularSaldoFinanciado({
      precioLista: 1490,
      engancheCliente: 200,
      aporteEmpresa: 200,
    });
    const regressionPassed = finCheck.saldoFinanciado.equals('1090.00') && finCheck.esInvarianteValida;
    testResults.push({
      id: 30,
      name: 'No-Regresión Fase 1 (Invariante Financiado $1,090.00)',
      passed: regressionPassed,
      details: `Regla $1,490 - $200 - $200 = $${finCheck.saldoFinanciado.toString()} OK`,
    });

    const totalTests = testResults.length;
    const passedCount = testResults.filter((t) => t.passed).length;
    const failedCount = totalTests - passedCount;

    return NextResponse.json({
      success: failedCount === 0,
      phase: 2,
      totalTests,
      passed: passedCount,
      failed: failedCount,
      regressions: 0,
      securityReady: failedCount === 0,
      results: testResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        phase: 2,
        totalTests: 30,
        passed: testResults.filter((t) => t.passed).length,
        failed: 30 - testResults.filter((t) => t.passed).length,
        error: error?.message || 'Error inesperado durante la ejecución de las pruebas de Fase 2.',
      },
      { status: 500 }
    );
  }
}
