import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'audit.view');

    const prisma = PrismaService.getInstance();
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            userRoles: { select: { role: { select: { name: true } } } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: logs.map((x: any) => ({
        ...x,
        user: x.user ? { ...x.user, role: x.user.userRoles?.[0]?.role?.name || null } : null,
      })),
    });
  } catch (err: any) {
    const message = err?.message || 'No pudimos cargar la auditoría.';
    const status = message.startsWith('FORBIDDEN:') ? 403 : message.includes('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json(
      { error: status === 403 ? 'No tienes autorización para consultar auditoría.' : status === 401 ? 'Tu sesión expiró.' : 'No pudimos cargar la auditoría.' },
      { status }
    );
  }
}
