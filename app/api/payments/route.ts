import { NextRequest, NextResponse } from 'next/server';
import { SecurityService } from '@/src/server/auth/security.service';
import { PermissionService } from '@/src/server/auth/permission.service';
import { PrismaService } from '@/src/database/prisma.service';
import { PaymentService } from '@/src/payments/payment.service';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Bearer token requerido.' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const verified = SecurityService.verifyAccessToken(token);
    const role = String(verified?.role || '').toUpperCase();
    if (!verified?.sub || !role) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Token inválido o expirado.' }, { status: 401 });
    }

    if (!['ADMIN', 'SUPERVISORA', 'COBRADOR'].includes(role)) {
      return NextResponse.json({ error: 'FORBIDDEN: Rol no autorizado para registrar cobros.' }, { status: 403 });
    }

    await PermissionService.requirePermission(verified.sub, 'collections.collect');

    const body = await req.json();
    const creditId = String(body?.creditId || '').trim();
    if (!creditId) {
      return NextResponse.json({ error: 'El crédito es obligatorio.' }, { status: 400 });
    }

    const prisma = PrismaService.getInstance();
    const credit = await prisma.credit.findUnique({
      where: { id: creditId },
      select: {
        id: true,
        status: true,
        client: { select: { assignedCollectorId: true } },
      },
    });
    if (!credit) {
      return NextResponse.json({ error: 'Crédito no encontrado.' }, { status: 404 });
    }
    if (credit.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'FORBIDDEN: El crédito no está activo.' }, { status: 403 });
    }
    if (role === 'COBRADOR' && credit.client.assignedCollectorId !== verified.sub) {
      return NextResponse.json({
        error: 'FORBIDDEN: El cliente no pertenece a la cartera asignada del cobrador.',
      }, { status: 403 });
    }

    const payment = await PaymentService.registerPayment({
      creditId,
      collectorId: verified.sub,
      amount: body.amount,
      paymentMethod: body.paymentMethod || 'CASH',
      cashSessionId: body.cashSessionId,
      clientCapturedAt: body.clientCapturedAt,
      gpsLatitude: body.gpsLatitude,
      gpsLongitude: body.gpsLongitude,
      notes: body.notes,
      paymentType: body.paymentType === 'DOWN_PAYMENT' ? 'DOWN_PAYMENT' : 'REGULAR',
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (err: any) {
    const message = err?.message || 'Error al registrar el abono';
    const status = message.includes('UNAUTHORIZED') ? 401
      : message.includes('FORBIDDEN') ? 403
      : message.includes('no encontrado') ? 404
      : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
