import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CollectionService } from '@/src/collections/collection.service';
import { PermissionService } from '@/src/server/auth/permission.service';
import { PrismaService } from '@/src/database/prisma.service';

export async function POST(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    await PermissionService.requirePermission(user.userId, 'collections.collect');
    const body = await req.json();
    const prisma = PrismaService.getInstance();
    const client = await prisma.client.findUnique({ where: { id: String(body.clientId || '') }, select: { id: true, assignedCollectorId: true } });
    if (!client) return NextResponse.json({ success: false, error: 'Cliente no encontrado.' }, { status: 404 });
    if (user.role === 'COBRADOR' && client.assignedCollectorId !== user.userId) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: Este cliente no pertenece a tu cartera asignada.' }, { status: 403 });
    }
    if (body.creditId) {
      const credit = await prisma.credit.findUnique({ where: { id: String(body.creditId) }, select: { id: true, clientId: true, status: true } });
      if (!credit || credit.clientId !== client.id || credit.status !== 'ACTIVE') return NextResponse.json({ success: false, error: 'El crédito no corresponde al cliente o ya no está activo.' }, { status: 409 });
    }
    if (body.result === 'RESCHEDULED') {
      const nextDate = new Date(String(body.rescheduleDate || ''));
      if (!body.creditId || Number.isNaN(nextDate.getTime()) || nextDate <= new Date()) return NextResponse.json({ success: false, error: 'Selecciona una fecha futura válida para reagendar.' }, { status: 400 });
      await prisma.credit.update({ where: { id: String(body.creditId) }, data: { proximaVisita: nextDate } });
    }
    const result = await CollectionService.recordVisit(body, user);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    const message = String(error?.message || 'Error al registrar visita de cobranza');
    return NextResponse.json({ success: false, error: message }, { status: message.includes('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 400 });
  }
}
