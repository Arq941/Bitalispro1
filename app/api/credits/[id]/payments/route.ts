import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PaymentService } from '@/src/payments/payment.service';
import { PermissionService } from '@/src/server/auth/permission.service';
import { PrismaService } from '@/src/database/prisma.service';

async function assertCreditAccess(id: string, user: { userId: string; role: string }) {
  const credit = await PrismaService.getInstance().credit.findUnique({
    where: { id },
    select: { id: true, client: { select: { assignedCollectorId: true } } },
  });
  if (!credit) throw new Error('Crédito no encontrado.');
  if (user.role === 'COBRADOR' && credit.client.assignedCollectorId !== user.userId) {
    throw new Error('FORBIDDEN: El crédito no pertenece a tu cartera.');
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'collections.collect');
    await assertCreditAccess(id, userContext);
    const body = await req.json();
    const result = await PaymentService.registerPayment({
      creditId: id,
      collectorId: userContext.userId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      cashSessionId: body.cashSessionId,
      clientCapturedAt: body.clientCapturedAt,
      gpsLatitude: body.gpsLatitude,
      gpsLongitude: body.gpsLongitude,
      notes: body.notes,
      paymentType: body.paymentType === 'DOWN_PAYMENT' ? 'DOWN_PAYMENT' : 'REGULAR',
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json({ success: true, payment: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al registrar abono' }, { status: 400 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'collections.view');
    await assertCreditAccess(id, userContext);
    const payments = await PrismaService.getInstance().payment.findMany({
      where: { creditId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, creditId: id, count: payments.length, payments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener pagos' }, { status: 400 });
  }
}
