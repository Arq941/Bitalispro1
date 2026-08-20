import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PaymentService } from '@/src/payments/payment.service';
import { PermissionService } from '@/src/server/auth/permission.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'collections.view');
    const body = await req.json();
    if (!['ADMIN', 'SUPERVISORA'].includes(userContext.role)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Sólo supervisión puede verificar transferencias.' },
        { status: 403 },
      );
    }
    const result = await PaymentService.verifyPayment(
      id,
      body.action === 'REJECT' ? 'REJECT' : 'VERIFY',
      userContext.userId,
      body.notes,
    );
    return NextResponse.json(result);
  } catch (error: any) {
    const message = error.message || 'Error al verificar transferencia';
    const status = message.includes('UNAUTHORIZED') ? 401 : message.includes('FORBIDDEN') ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
