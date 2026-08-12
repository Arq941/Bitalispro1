import { PrismaClient } from '@prisma/client';
import { SecurityService } from './security.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

const prisma = new PrismaClient();

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
  private static users = new Map<string, UserAccountState>();
  private static authorizationRequests = new Map<string, any>();

  public static registerUserInMemory(user: UserAccountState): void {
    this.users.set(user.id, { ...user });
  }

  public static getUserByEmail(email: string): UserAccountState | undefined {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return undefined;
  }

  public static getUserById(userId: string): UserAccountState | undefined {
    return this.users.get(userId);
  }

  private static async hydrateUserFromDatabase(email: string): Promise<UserAccountState | undefined> {
    const dbUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    if (!dbUser) return undefined;

    const roleRecord = dbUser.userRoles[0]?.role;
    if (!roleRecord) return undefined;

    const role = roleRecord.name as UserAccountState['role'];
    const permissions = roleRecord.rolePermissions.map((rp) => rp.permission.code);

    const user: UserAccountState = {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      role,
      passwordHash: dbUser.passwordHash,
      accountStatus: dbUser.accountStatus as UserAccountState['accountStatus'],
      failedLoginAttempts: dbUser.failedLoginAttempts,
      lockoutUntil: dbUser.lockoutUntil,
      passwordChangedAt: dbUser.passwordChangedAt,
      permissionVersion: dbUser.permissionVersion,
      lastLoginAt: null,
      lastLoginIp: null,
      permissions,
    };

    this.registerUserInMemory(user);
    return user;
  }

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
    let user = this.getUserByEmail(params.email);
    if (!user) user = await this.hydrateUserFromDatabase(params.email);

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

    if (user.accountStatus === 'INACTIVE' || user.accountStatus === 'SUSPENDED') {
      return { success: false, message: `Cuenta de usuario en estado ${user.accountStatus}.`, code: 'ACCOUNT_DISABLED' };
    }

    const now = new Date();
    if (user.accountStatus === 'LOCKED' && user.lockoutUntil) {
      if (user.lockoutUntil > now) {
        return {
          success: false,
          message: `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente nuevamente después de ${user.lockoutUntil.toLocaleTimeString()}.`,
          code: 'ACCOUNT_LOCKED',
        };
      }
      user.accountStatus = 'ACTIVE';
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
    }

    const passwordMatch = await SecurityService.verifyPassword(params.password, user.passwordHash);

    if (!passwordMatch) {
      user.failedLoginAttempts += 1;
      const maxAttempts = parseInt(process.env.AUTH_MAX_FAILED_ATTEMPTS || '5', 10);
      const lockoutMins = parseInt(process.env.AUTH_LOCKOUT_MINUTES || '15', 10);

      if (user.failedLoginAttempts >= maxAttempts) {
        user.accountStatus = 'LOCKED';
        user.lockoutUntil = new Date(Date.now() + lockoutMins * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: user.failedLoginAttempts,
          accountStatus: user.accountStatus,
          lockoutUntil: user.lockoutUntil,
        }
      });

      return { success: false, message: GENERIC_INVALID_MSG, code: 'INVALID_CREDENTIALS' };
    }

    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    user.lastLoginAt = now;
    user.lastLoginIp = params.ipAddress || '127.0.0.1';

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        accountStatus: 'ACTIVE',
        lockoutUntil: null,
      }
    });

    const refreshToken = SecurityService.generateRefreshToken();
    const session = RefreshTokenService.createSession({
      userId: user.id,
      refreshToken,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

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
        permissions: user.permissions,
      },
    };
  }

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
    if (!res.valid || !res.session || !res.newRefreshToken) return { success: false, message: 'Refresh token inválido o expirado.' };
    const user = this.getUserById(res.session.userId);
    if (!user || user.accountStatus !== 'ACTIVE') return { success: false, message: 'Usuario no activo.' };
    return {
      success: true,
      accessToken: SecurityService.generateAccessToken({
        sub: user.id,
        sessionId: res.session.id,
        permissionVersion: user.permissionVersion,
        email: user.email,
        role: user.role,
      }),
      refreshToken: res.newRefreshToken,
    };
  }

  public static logout(sessionId: string, userId: string): boolean {
    return RefreshTokenService.revokeSession(sessionId);
  }

  public static logoutAll(userId: string): number {
    return RefreshTokenService.revokeAllUserSessions(userId);
  }

  public static async changePassword(params: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message?: string }> {
    const user = this.getUserById(params.userId);
    if (!user) return { success: false, message: 'Usuario no encontrado.' };
    const match = await SecurityService.verifyPassword(params.currentPassword, user.passwordHash);
    if (!match) return { success: false, message: 'La contraseña actual es incorrecta.' };
    const strength = SecurityService.validatePasswordStrength(params.newPassword);
    if (!strength.valid) return { success: false, message: strength.reason };
    user.passwordHash = await SecurityService.hashPassword(params.newPassword);
    user.passwordChangedAt = new Date();
    user.permissionVersion += 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: user.passwordHash,
        passwordChangedAt: user.passwordChangedAt,
        permissionVersion: user.permissionVersion,
      }
    });
    RefreshTokenService.revokeAllUserSessions(user.id);
    return { success: true, message: 'Contraseña actualizada correctamente. Inicie sesión de nuevo.' };
  }

  public static createAuthorizationRequest(params: {
    type: 'PRICE_OVERRIDE' | 'DISCOUNT_OVERRIDE' | 'TWO_PRODUCT_SALE' | 'CREDIT_EXCEPTION';
    requestedById: string;
    entity: string;
    entityId: string;
    reason: string;
  }): any {
    const id = `auth_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const req = { id, ...params, status: 'PENDING', createdAt: new Date() };
    this.authorizationRequests.set(id, req);
    return req;
  }

  public static approveAuthorizationRequest(requestId: string, approvedById: string): boolean {
    const req = this.authorizationRequests.get(requestId);
    if (!req || req.status !== 'PENDING') return false;
    req.status = 'APPROVED';
    req.approvedById = approvedById;
    req.approvedAt = new Date();
    return true;
  }

  public static getAuthorizationRequest(requestId: string): any {
    return this.authorizationRequests.get(requestId);
  }

  public static clear(): void {
    this.users.clear();
    this.authorizationRequests.clear();
  }
}
