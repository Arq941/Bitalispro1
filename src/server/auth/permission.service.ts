import { PrismaService } from '@/src/database/prisma.service';

export type PermissionEffect = 'ALLOW' | 'DENY';

type OverrideRow = {
  user_id: string;
  permission_code: string;
  effect: PermissionEffect;
};

const LEGACY_PERMISSION_CODES = [
  'dashboard.view',
  'clients.view',
  'clients.create',
  'clients.edit',
  'clients.delete',
  'sales.view',
  'sales.create',
  'sales.approve',
  'collections.view',
  'collections.collect',
  'route.view',
  'route.manage',
  'cash.view',
  'cash.operate',
  'cash.close',
  'inventory.view',
  'inventory.manage',
  'renewals.view',
  'renewals.manage',
  'commissions.view',
  'reports.view',
  'audit.view',
  'users.manage',
  'settings.manage',
] as const;

// A role matrix is only usable as an explicit RBAC configuration when it can
// actually land the user on at least one current BITALIS screen. Older installs
// can contain obsolete permission codes or only action permissions without the
// matching screen permission. Treating those matrices as fully configured made
// the effective-permissions endpoint return a non-navigable set and locked valid
// users out of every module.
const NAVIGABLE_PERMISSION_CODES = new Set<string>([
  'dashboard.view',
  'clients.view',
  'clients.create',
  'sales.view',
  'sales.create',
  'sales.approve',
  'collections.view',
  'route.view',
  'cash.view',
  'inventory.view',
  'renewals.view',
  'commissions.view',
  'reports.view',
  'audit.view',
  'users.manage',
  'settings.manage',
]);

const SECURE_ROLE_DEFAULTS: Record<string, readonly string[]> = {
  ADMIN: LEGACY_PERMISSION_CODES,
  SUPERVISORA: [
    'dashboard.view', 'clients.view', 'clients.create', 'clients.edit',
    'sales.view', 'sales.create', 'sales.approve',
    'collections.view', 'route.view', 'route.manage',
    'cash.view', 'cash.operate', 'cash.close',
    'inventory.view', 'renewals.view', 'renewals.manage',
    'commissions.view', 'reports.view', 'audit.view',
  ],
  VENDEDORA: [
    'clients.create',
  ],
  VENDEDOR: [
    'clients.create',
  ],
  COBRADOR: [
    'dashboard.view', 'clients.view', 'clients.create',
    'collections.view', 'collections.collect',
    'route.view', 'route.manage',
    'cash.view', 'cash.operate', 'cash.close',
    'commissions.view',
  ],
};

export class PermissionService {
  private static prisma = PrismaService.getInstance();
  private static initialized = false;

  private static isMySql() {
    return String(process.env.DATABASE_URL || '').toLowerCase().startsWith('mysql');
  }

  private static async ensureOverrideTable() {
    if (this.initialized) return;

    if (this.isMySql()) {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_permission_overrides (
          user_id VARCHAR(191) NOT NULL,
          permission_code VARCHAR(191) NOT NULL,
          effect VARCHAR(16) NOT NULL,
          updated_by VARCHAR(191) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, permission_code),
          INDEX idx_user_permission_overrides_user (user_id)
        ) ENGINE=InnoDB
      `);
    } else {
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
    }

    this.initialized = true;
  }

  public static async getUserOverrides(userId: string) {
    await this.ensureOverrideTable();
    if (this.isMySql()) {
      return this.prisma.$queryRawUnsafe<OverrideRow[]>(
        `SELECT user_id, permission_code, effect FROM user_permission_overrides WHERE user_id = ? ORDER BY permission_code`,
        userId
      );
    }
    return this.prisma.$queryRawUnsafe<OverrideRow[]>(
      `SELECT user_id, permission_code, effect FROM user_permission_overrides WHERE user_id = $1 ORDER BY permission_code`,
      userId
    );
  }

  public static async setUserOverride(input: { userId: string; permissionCode: string; effect: PermissionEffect | 'INHERIT'; updatedBy?: string }) {
    await this.ensureOverrideTable();
    const code = String(input.permissionCode || '').trim();
    if (!code) throw new Error('Permiso inválido.');

    if (this.isMySql()) {
      if (input.effect === 'INHERIT') {
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM user_permission_overrides WHERE user_id = ? AND permission_code = ?`,
          input.userId,
          code
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO user_permission_overrides (user_id, permission_code, effect, updated_by, updated_at)
           VALUES (?,?,?,?,CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE effect = VALUES(effect), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
          input.userId,
          code,
          input.effect,
          input.updatedBy || null
        );
      }
    } else if (input.effect === 'INHERIT') {
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

  public static async clearUserOverrides(userId: string) {
    await this.ensureOverrideTable();
    if (this.isMySql()) {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM user_permission_overrides WHERE user_id = ?`,
        userId
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM user_permission_overrides WHERE user_id = $1`,
        userId
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { permissionVersion: { increment: 1 } },
    });
  }

  private static async getPermissionContext(userId: string) {
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
    if (!user) return { inherited: new Set<string>(), configured: false, roleNames: [] as string[] };

    const inherited = new Set<string>();
    const roleNames: string[] = [];
    let configured = false;
    for (const mapping of user.userRoles) {
      roleNames.push(String(mapping.role.name || '').toUpperCase());
      for (const rp of mapping.role.rolePermissions) {
        const code = rp.permission.code;
        inherited.add(code);
        if (NAVIGABLE_PERMISSION_CODES.has(code)) configured = true;
      }
    }
    return { inherited, configured, roleNames };
  }

  private static applySecureRoleFallback(inherited: Set<string>, roleNames: string[]) {
    for (const roleName of roleNames) {
      for (const code of SECURE_ROLE_DEFAULTS[roleName] || []) inherited.add(code);
    }
  }

  private static isFieldSeller(roleNames: string[]) {
    return roleNames.some((roleName) => roleName === 'VENDEDORA' || roleName === 'VENDEDOR');
  }

  public static async getEffectivePermissionCodes(userId: string) {
    const { inherited, configured, roleNames } = await this.getPermissionContext(userId);

    // Secure fallback for legacy installations: use the least-privilege
    // built-in matrix for the user's actual role. Missing or malformed role
    // configuration must never become global access.
    if (!configured) this.applySecureRoleFallback(inherited, roleNames);

    if (roleNames.includes('ADMIN')) return Array.from(LEGACY_PERMISSION_CODES).sort();
    const overrides = await this.getUserOverrides(userId);
    for (const override of overrides) {
      if (override.effect === 'DENY') inherited.delete(override.permission_code);
      if (override.effect === 'ALLOW') inherited.add(override.permission_code);
    }
    if (this.isFieldSeller(roleNames)) {
      const intakeDenied = overrides.some((override) => override.permission_code === 'clients.create' && override.effect === 'DENY');
      return intakeDenied ? [] : ['clients.create'];
    }
    return Array.from(inherited).sort();
  }

  public static async hasPermission(userId: string, permissionCode: string) {
    const code = String(permissionCode || '').trim();
    if (!code) return false;

    const context = await this.getPermissionContext(userId);
    if (context.roleNames.includes('ADMIN')) return (LEGACY_PERMISSION_CODES as readonly string[]).includes(code);
    if (this.isFieldSeller(context.roleNames) && code !== 'clients.create') return false;

    const overrides = await this.getUserOverrides(userId);
    const override = overrides.find((item) => item.permission_code === code);
    if (override?.effect === 'DENY') return false;
    if (this.isFieldSeller(context.roleNames) && code === 'clients.create') return true;
    if (override?.effect === 'ALLOW') return true;

    const { inherited, configured, roleNames } = context;
    if (!configured) this.applySecureRoleFallback(inherited, roleNames);
    return inherited.has(code);
  }

  public static async requirePermission(userId: string, permissionCode: string) {
    const allowed = await this.hasPermission(userId, permissionCode);
    if (!allowed) throw new Error(`FORBIDDEN: Permiso requerido ${permissionCode}.`);
  }
}
