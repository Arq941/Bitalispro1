import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  sessionId: string;
  permissionVersion: number;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface PasswordSetupPayload extends JwtPayload {
  purpose?: 'password-setup';
}

export class SecurityService {
  private static getJwtSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret || secret.length < 32) {
      throw new Error('SECURITY_CONFIGURATION_ERROR: JWT_SECRET debe existir y tener al menos 32 caracteres.');
    }
    return secret;
  }

  private static getBcryptRounds(): number {
    return parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  }

  /**
   * Hashea una contraseña usando bcrypt
   */
  public static async hashPassword(password: string): Promise<string> {
    const rounds = this.getBcryptRounds();
    return bcrypt.hash(password, rounds);
  }

  /**
   * Compara una contraseña en texto plano contra su hash
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Valida la fuerza de una contraseña (Mínimo 8 caracteres, mayúscula, minúscula, número)
   */
  public static validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
    if (!password || password.length < 8) {
      return { valid: false, reason: 'La contraseña debe tener al menos 8 caracteres.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, reason: 'La contraseña debe incluir al menos una letra mayúscula.' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, reason: 'La contraseña debe incluir al menos una letra minúscula.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, reason: 'La contraseña debe incluir al menos un número.' };
    }
    return { valid: true };
  }

  /**
   * Genera hash SHA-256 para el Refresh Token antes de guardarlo en BD
   */
  public static hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Genera un Access Token JWT firmado
   */
  public static generateAccessToken(payload: { sub: string; sessionId: string; permissionVersion: number; email?: string; role?: string }): string {
    const secret = this.getJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  }

  /**
   * Verifica un Access Token JWT
   */
  public static verifyAccessToken(token: string): JwtPayload | null {
    try {
      const secret = this.getJwtSecret();
      return jwt.verify(token, secret) as JwtPayload;
    } catch {
      return null;
    }
  }

  public static generatePasswordSetupToken(payload: {sub:string;permissionVersion:number;email:string}) {
    return jwt.sign({...payload,sessionId:'password-setup',purpose:'password-setup'},this.getJwtSecret(),{expiresIn:'30m'});
  }

  public static verifyPasswordSetupToken(token:string): PasswordSetupPayload|null {
    try {
      const payload=jwt.verify(token,this.getJwtSecret()) as PasswordSetupPayload;
      return payload.purpose==='password-setup'&&payload.sessionId==='password-setup'?payload:null;
    } catch { return null; }
  }

  /**
   * Genera una cadena aleatoria de Refresh Token
   */
  public static generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }
}
