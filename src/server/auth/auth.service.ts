import { SecurityService } from './security.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

export interface UserAccountState {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'SUPERVISORA' | 'VENDEDORA' | 'COBRADOR';
  passwordHash: string;
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'SUSPENDED';
  failedLoginAttempts: number;
  lockoutUntil: Date | null;
  passwordChangedAt: Date | null;
  permissionVersion: number;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  assignedRouteId?: string;
  permissions: string[];
}

export class AuthService {
  // In-memory persistent user repository simulation for Auth engine
  private static users = new Map<string, UserAccountState>();
  private static authorizationRequests = new Map<string, any>();

  /**
   * Inicializa o actualiza un usuario en la memoria del motor Auth
   */
  public static registerUserInMemory(user: UserAccountState): void {
    this.users.set(user.id, { ...user });
  }

  public static getUserByEmail(email: string): UserAccountState | undefined {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return u;
      }
    }
    return undefined;
  }

  public static getUserById(userId: string): UserAccountState | undefined {
    return this.users.get(userId);
  }

  /**
   * POST /api/auth/login
   */
  public static async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    user?: any;
    message?: string;
    code?: string;
  }> {
    const user = this.getUserByEmail(params.email);

    // Mensaje genérico de seguridad para evitar enumeración de usuarios
    const GENERIC_INVALID_MSG = 'Credenciales inválidas o cuenta inaccesible.';

    if (!user) {
      AuditLogService.log({
        action: 'LOGIN_FAILED',
        entity: 'USER',
        entityId: 'UNKNOWN',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        oldValues: JSON.stringify({ email: params.email, reason: 'USER_NOT_FOUND' }),
      });
      return { success: false, message: GENERIC_INVALID_MSG, code: 'INVALID_CREDENTIALS' };
    }

    // 1. Verificar estado de la cuenta
    if (user.accountStatus === 'INACTIVE' || user.accountStatus === 'SUSPENDED') {
      AuditLogService.log({
        action: 'LOGIN_FAILED',
        entity: 'USER',
        entityId: user.id,
        userId: user.id,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        oldValues: JSON.stringify({ status: user.accountStatus }),
      });
      return { success: false, message: `Cuenta de usuario en estado ${user.accountStatus}.`, code: 'ACCOUNT_DISABLED' };
    }

    // 2. Verificar bloqueo temporal por fuerza bruta
    const now = new Date();
    if (user.accountStatus === 'LOCKED' && user.lockoutUntil) {
      if (user.lockoutUntil > now) {
        AuditLogService.log({
          action: 'LOGIN_BLOCKED_LOCKOUT',
          entity: 'USER',
          entityId: user.id,
          userId: user.id,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        });
        return {
          success: false,
          message: `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente nuevamente después de ${user.lockoutUntil.toLocaleTimeString()}.`,
          code: 'ACCOUNT_LOCKED',
        };
      } else {
        // Desbloqueo automático al expirar lockoutUntil
        user.accountStatus = 'ACTIVE';
        user.failedLoginAttempts = 0;
        user.lockoutUntil = null;
      }
    }

    // 3. Comparar contraseña con bcrypt
    const passwordMatch = await SecurityService.verifyPassword(params.password, user.passwordHash);

    if (!passwordMatch) {
      user.failedLoginAttempts += 1;
      const maxAttempts = parseInt(process.env.AUTH_MAX_FAILED_ATTEMPTS || '5', 10);
      const lockoutMins = parseInt(process.env.AUTH_LOCKOUT_MINUTES || '15', 10);

      if (user.failedLoginAttempts >= maxAttempts) {
        user.accountStatus = 'LOCKED';
        user.lockoutUntil = new Date(Date.now() + lockoutMins * 60 * 1000);

        AuditLogService.log({
          action: 'ACCOUNT_LOCKED',
          entity: 'USER',
          entityId: user.id,
          userId: user.id,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          newValues: JSON.stringify({ failedAttempts: user.failedLoginAttempts, lockoutUntil: user.lockoutUntil }),
        });
      } else {
        AuditLogService.log({
          action: 'LOGIN_FAILED',
          entity: 'USER',
          entityId: user.id,
          userId: user.id,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          newValues: JSON.stringify({ failedAttempts: user.failedLoginAttempts }),
        });
      }

      return { success: false, message: GENERIC_INVALID_MSG, code: 'INVALID_CREDENTIALS' };
    }

    // 4. Login exitoso: Resetear contador de fallos y actualizar timestamp/IP
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    user.lastLoginAt = now;
    user.lastLoginIp = params.ipAddress || '127.0.0.1';

    // 5. Crear Refresh Token y Sesión en Servidor
    const refreshToken = SecurityService.generateRefreshToken();
    const session = RefreshTokenService.createSession({
      userId: user.id,
      refreshToken,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // 6. Generar Access Token
    const accessToken = SecurityService.generateAccessToken({
      sub: user.id,
      sessionId: session.id,
      permissionVersion: user.permissionVersion,
      email: user.email,
      role: user.role,
    });

    AuditLogService.log({
      action: 'LOGIN_SUCCESS',
      entity: 'USER',
      entityId: user.id,
      userId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      newValues: JSON.stringify({ sessionId: session.id }),
    });

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissionVersion: user.permissionVersion,
      },
    };
  }

  /**
   * POST /api/auth/refresh
   */
  public static refresh(params: {
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    message?: string;
  } {
    const res = RefreshTokenService.validateAndRotate(params);

    if (res.reuseDetected) {
      AuditLogService.log({
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        entity: 'USER_SESSION',
        entityId: res.userId || 'UNKNOWN',
        userId: res.userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        newValues: JSON.stringify({ alert: 'REUSE DETECTED - ALL SESSIONS REVOKED' }),
      });
      return { success: false, message: 'Alerta de seguridad: Sesión invalidada por posible reutilización de token.' };
    }

    if (!res.valid || !res.session || !res.newRefreshToken) {
      return { success: false, message: 'Refresh token inválido o expirado.' };
    }

    const user = this.getUserById(res.session.userId);
    if (!user || user.accountStatus !== 'ACTIVE') {
      return { success: false, message: 'Usuario no activo.' };
    }

    const accessToken = SecurityService.generateAccessToken({
      sub: user.id,
      sessionId: res.session.id,
      permissionVersion: user.permissionVersion,
      email: user.email,
      role: user.role,
    });

    AuditLogService.log({
      action: 'REFRESH_TOKEN_ROTATED',
      entity: 'USER_SESSION',
      entityId: res.session.id,
      userId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      success: true,
      accessToken,
      refreshToken: res.newRefreshToken,
    };
  }

  /**
   * POST /api/auth/logout
   */
  public static logout(sessionId: string, userId: string): boolean {
    const revoked = RefreshTokenService.revokeSession(sessionId);
    if (revoked) {
      AuditLogService.log({
        action: 'LOGOUT',
        entity: 'USER_SESSION',
        entityId: sessionId,
        userId,
      });
    }
    return revoked;
  }

  /**
   * POST /api/auth/logout-all
   */
  public static logoutAll(userId: string): number {
    const count = RefreshTokenService.revokeAllUserSessions(userId);
    AuditLogService.log({
      action: 'LOGOUT_ALL',
      entity: 'USER',
      entityId: userId,
      userId,
      newValues: JSON.stringify({ revokedSessionsCount: count }),
    });
    return count;
  }

  /**
   * POST /api/auth/change-password
   */
  public static async changePassword(params: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message?: string }> {
    const user = this.getUserById(params.userId);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    const match = await SecurityService.verifyPassword(params.currentPassword, user.passwordHash);
    if (!match) {
      return { success: false, message: 'La contraseña actual es incorrecta.' };
    }

    const strength = SecurityService.validatePasswordStrength(params.newPassword);
    if (!strength.valid) {
      return { success: false, message: strength.reason };
    }

    user.passwordHash = await SecurityService.hashPassword(params.newPassword);
    user.passwordChangedAt = new Date();
    user.permissionVersion += 1; // Invalida tokens antiguos con versión previa

    // Revocar sesiones existentes tras cambio de contraseña
    RefreshTokenService.revokeAllUserSessions(user.id);

    AuditLogService.log({
      action: 'PASSWORD_CHANGED',
      entity: 'USER',
      entityId: user.id,
      userId: user.id,
      newValues: JSON.stringify({ permissionVersion: user.permissionVersion }),
    });

    return { success: true, message: 'Contraseña actualizada correctamente. Inicie sesión de nuevo.' };
  }

  /**
   * Crea solicitud de autorización (AUTHORIZATION REQUEST)
   */
  public static createAuthorizationRequest(params: {
    type: 'PRICE_OVERRIDE' | 'DISCOUNT_OVERRIDE' | 'TWO_PRODUCT_SALE' | 'CREDIT_EXCEPTION';
    requestedById: string;
    entity: string;
    entityId: string;
    reason: string;
  }): any {
    const id = `auth_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const req = {
      id,
      type: params.type,
      requestedById: params.requestedById,
      approvedById: null,
      entity: params.entity,
      entityId: params.entityId,
      reason: params.reason,
      status: 'PENDING',
      createdAt: new Date(),
    };
    this.authorizationRequests.set(id, req);

    AuditLogService.log({
      action: 'AUTHORIZATION_CREATED',
      entity: 'AUTHORIZATION_REQUEST',
      entityId: id,
      userId: params.requestedById,
      newValues: JSON.stringify(req),
    });

    return req;
  }

  /**
   * Aprueba solicitud de autorización (ADMIN / SUPERVISORA)
   */
  public static approveAuthorizationRequest(requestId: string, approvedById: string): boolean {
    const req = this.authorizationRequests.get(requestId);
    if (req && req.status === 'PENDING') {
      req.status = 'APPROVED';
      req.approvedById = approvedById;
      req.approvedAt = new Date();

      AuditLogService.log({
        action: 'AUTHORIZATION_APPROVED',
        entity: 'AUTHORIZATION_REQUEST',
        entityId: requestId,
        userId: approvedById,
      });
      return true;
    }
    return false;
  }

  public static getAuthorizationRequest(requestId: string): any {
    return this.authorizationRequests.get(requestId);
  }

  public static clear(): void {
    this.users.clear();
    this.authorizationRequests.clear();
  }
}
