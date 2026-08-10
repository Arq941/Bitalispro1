import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET() {
  try {
    const prisma = PrismaService.getInstance();
    const reversals = await prisma.commission.findMany({
      where: { commissionType: 'REVERSAL' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: reversals.length,
      reversals,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener reversiones' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const body = await req.json();

    const reversals = await CommissionService.processReversal({
      saleId: body.saleId,
      paymentId: body.paymentId,
      reason: body.reason || 'REVERSAL_REQUESTED',
      authorizedBy: userContext.userId || 'SUPERVISOR',
    });

    return NextResponse.json({
      success: true,
      count: reversals.length,
      reversals,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar reversión' },
      { status: 400 }
    );
  }
}
