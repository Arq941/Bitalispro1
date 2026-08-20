import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { SalesService } from '@/src/sales/sales.service';
import { PermissionService } from '@/src/server/auth/permission.service';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userContext = await extractUserContext(req);
    await PermissionService.requirePermission(userContext.userId, 'collections.view');
    const credit = await SalesService.getCreditById(id);
    if (!credit) {
      return NextResponse.json({ success: false, error: 'Crédito no encontrado' }, { status: 404 });
    }
    if (userContext.role === 'COBRADOR' && credit.client?.assignedCollectorId !== userContext.userId) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: El crédito no pertenece a tu cartera.' }, { status: 403 });
    }
    const paymentsCount = await PrismaService.getInstance().payment.count({
      where: { creditId: id, verificationStatus: 'VERIFIED' },
    });
    return NextResponse.json({
      success: true,
      creditId: id,
      principalAmount: credit.principalAmount,
      saldoActual: credit.saldoActual,
      status: credit.status,
      proximaVisita: credit.proximaVisita,
      paymentsCount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener saldo del crédito' }, { status: 400 });
  }
}
