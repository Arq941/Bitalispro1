import { PrismaService } from '@/src/database/prisma.service';

export type PermissionEffect = 'ALLOW' | 'DENY';

type OverrideRow = {
  user_id: string;
  permission_code: string;
  effect: PermissionEffect;
};

export class PermissionService {
  private static prisma = PrismaService.getInstance();
  private static initialized = false;

  private static async ensureOverrideTable() {
    if (this.initialized) return;
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_permission_overrides (
        user_id TEXT NOT NULL,
        permission_code TEXT NOT NULL,
        effect TEXT NOT NULL CHECK (effect IN ('ALLOW','DENY')),
        updated_by TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, permission_code)
      )
    `);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id)`);
    this.initialized = true;
  }

  public static async getUserOverrides(userId: string) {
    await this.ensureOverrideTable();
    return this.prisma.$queryRawUnsafe<OverrideRow[]>(
      `SELECT user_id, permission_code, effect FROM user_permission_overrides WHERE user_id = $1 ORDER BY permission_code`,
      userId
    );
  }

  public static async setUserOverride(input: { userId: string; permissionCode: string; effect: PermissionEffect | 'INHERIT'; updatedBy?: string }) {
    await this.ensureOverrideTable();
    const code = String(input.permissionCode || '').trim();
    if (!code) throw new Error('Permiso inválido.');

    if (input.effect === 'INHERIT') {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM user_permission_overrides WHERE user_id = $1 AND permission_code = $2`,
        input.userId,
        code
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO user_permission_overrides (user_id, permission_code, effect, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, permission_code)
         DO UPDATE SET effect = EXCLUDED.effect, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
        input.userId,
        code,
        input.effect,
        input.updatedBy || null
      );
    }

    await this.prisma.user.update({
      where: { id: input.userId },
      data: { permissionVersion: { increment: 1 } },
    });
  }

  public static async getEffectivePermissionCodes(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!user) return [] as string[];

    const inherited = new Set<string>();
    for (const mapping of user.userRoles) {
      for (const rp of mapping.role.rolePermissions) inherited.add(rp.permission.code);
    }

    const overrides = await this.getUserOverrides(userId);
    for (const override of overrides) {
      if (override.effect === 'DENY') inherited.delete(override.permission_code);
      if (override.effect === 'ALLOW') inherited.add(override.permission_code);
    }
    return Array.from(inherited).sort();
  }

  public static async hasPermission(userId: string, permissionCode: string) {
    const effective = await this.getEffectivePermissionCodes(userId);
    return effective.includes(permissionCode);
  }

  public static async requirePermission(userId: string, permissionCode: string) {
    const allowed = await this.hasPermission(userId, permissionCode);
    if (!allowed) throw new Error(`FORBIDDEN: Permiso requerido ${permissionCode}.`);
  }
}
