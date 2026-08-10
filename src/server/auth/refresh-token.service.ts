import { SecurityService } from './security.service';

export interface ActiveSession {
  id: string;
  userId: string;
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  lastUsedAt: Date;
  createdAt: Date;
}

export class RefreshTokenService {
  private static sessions = new Map<string, ActiveSession>(); // Map key: sessionId

  /**
   * Registra una nueva sesión con un Refresh Token hasheado
   */
  public static createSession(params: {
    userId: string;
    refreshToken: string;
    deviceId?: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
    expiresInDays?: number;
  }): ActiveSession {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const hash = SecurityService.hashRefreshToken(params.refreshToken);
    const expiresDays = params.expiresInDays || 7;
    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

    const session: ActiveSession = {
      id: sessionId,
      userId: params.userId,
      deviceId: params.deviceId || 'default_device',
      deviceName: params.deviceName || 'Web App',
      ipAddress: params.ipAddress || '127.0.0.1',
      userAgent: params.userAgent || 'BITALIS_CLIENT',
      refreshTokenHash: hash,
      expiresAt,
      revokedAt: null,
      lastUsedAt: new Date(),
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Busca y valida un Refresh Token contra las sesiones activas.
   * Si detecta un token revocado o reutilizado, revoca TODAS las sesiones del usuario (Reuse Detection).
   */
  public static validateAndRotate(params: {
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): { valid: boolean; session?: ActiveSession; newRefreshToken?: string; reuseDetected?: boolean; userId?: string } {
    const hash = SecurityService.hashRefreshToken(params.refreshToken);

    // Buscar sesión correspondiente al hash
    let foundSession: ActiveSession | undefined;
    for (const sess of this.sessions.values()) {
      if (sess.refreshTokenHash === hash) {
        foundSession = sess;
        break;
      }
    }

    if (!foundSession) {
      return { valid: false };
    }

    // Reuso de Refresh Token Revocado (Reuse Detection)
    if (foundSession.revokedAt) {
      const targetUserId = foundSession.userId;
      // Revocar TODAS las sesiones activas de este usuario por brecha de seguridad
      this.revokeAllUserSessions(targetUserId);
      return { valid: false, reuseDetected: true, userId: targetUserId };
    }

    // Expirado
    if (foundSession.expiresAt < new Date()) {
      foundSession.revokedAt = new Date();
      return { valid: false };
    }

    // Rotación: Revocar el token anterior y emitir un nuevo refresh token
    foundSession.revokedAt = new Date();
    foundSession.lastUsedAt = new Date();

    const newRefreshToken = SecurityService.generateRefreshToken();
    const newSession = this.createSession({
      userId: foundSession.userId,
      refreshToken: newRefreshToken,
      deviceId: foundSession.deviceId,
      deviceName: foundSession.deviceName,
      ipAddress: params.ipAddress || foundSession.ipAddress,
      userAgent: params.userAgent || foundSession.userAgent,
    });

    return {
      valid: true,
      session: newSession,
      newRefreshToken,
    };
  }

  /**
   * Revoca una sesión específica por ID
   */
  public static revokeSession(sessionId: string): boolean {
    const sess = this.sessions.get(sessionId);
    if (sess) {
      sess.revokedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Revoca TODAS las sesiones activas de un usuario (Logout Global)
   */
  public static revokeAllUserSessions(userId: string): number {
    let count = 0;
    for (const sess of this.sessions.values()) {
      if (sess.userId === userId && !sess.revokedAt) {
        sess.revokedAt = new Date();
        count++;
      }
    }
    return count;
  }

  /**
   * Obtiene todas las sesiones activas de un usuario
   */
  public static getUserActiveSessions(userId: string): ActiveSession[] {
    const list: ActiveSession[] = [];
    for (const sess of this.sessions.values()) {
      if (sess.userId === userId && !sess.revokedAt && sess.expiresAt > new Date()) {
        list.push({ ...sess });
      }
    }
    return list;
  }

  public static clear(): void {
    this.sessions.clear();
  }
}
