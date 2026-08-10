import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const userId = userContext.userId || 'DEFAULT_USER';
    const role = userContext.role || 'VENDEDORA';

    const prisma = PrismaService.getInstance();
    const commissions = await prisma.commission.findMany({
      where: {
        employeeId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let summary = null;
    if (role === 'VENDEDORA') {
      summary = await CommissionService.getSellerDashboard(userId);
    } else if (role === 'COBRADOR') {
      summary = await CommissionService.getCollectorDashboard(userId);
    } else if (role === 'SUPERVISORA') {
      summary = await CommissionService.getSupervisorDashboard(userId);
    }

    return NextResponse.json({
      success: true,
      userId,
      role,
      summary,
      commissions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al consultar mis comisiones' },
      { status: 400 }
    );
  }
}
