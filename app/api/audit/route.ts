import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

const validDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'audit.view');

    const params = req.nextUrl.searchParams;
    const from = validDate(params.get('from'));
    const to = validDate(params.get('to'));
    if (to && params.get('to')?.length === 10) to.setHours(23, 59, 59, 999);

    const requestedLimit = Number(params.get('limit') || 300);
    const take = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 300, 1), 500);
    const action = params.get('action')?.trim();
    const entity = params.get('entity')?.trim();
    const userId = params.get('userId')?.trim();

    const where: any = {};
    if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const prisma = PrismaService.getInstance();
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
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

    const data = logs.map((x: any) => ({
      ...x,
      user: x.user ? { ...x.user, role: x.user.userRoles?.[0]?.role?.name || null } : null,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: {
        count: data.length,
        limit: take,
        filters: { from: from?.toISOString() || null, to: to?.toISOString() || null, action: action || null, entity: entity || null, userId: userId || null },
      },
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
