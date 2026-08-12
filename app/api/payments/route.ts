import { NextRequest, NextResponse } from 'next/server';
import { SecurityService } from '@/src/server/auth/security.service';
import { PaymentService } from '@/src/payments/payment.service';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Bearer token requerido.' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const verified = SecurityService.verifyAccessToken(token);
    if (!verified || !verified.sub || !verified.role) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Token inválido o expirado.' }, { status: 401 });
    }

    if (!['ADMIN', 'SUPERVISORA', 'COBRADOR'].includes(verified.role)) {
      return NextResponse.json({ error: 'FORBIDDEN: Rol no autorizado para registrar cobros.' }, { status: 403 });
    }

    const body = await req.json();
    const payment = await PaymentService.registerPayment({
      creditId: body.creditId,
      collectorId: verified.sub,
      amount: body.amount,
      paymentMethod: body.paymentMethod || 'CASH',
      cashSessionId: body.cashSessionId,
      clientCapturedAt: body.clientCapturedAt,
      gpsLatitude: body.gpsLatitude,
      gpsLongitude: body.gpsLongitude,
      notes: body.notes,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (err: any) {
    const message = err?.message || 'Error al registrar el abono';
    const status = message.includes('no encontrado') ? 404 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
