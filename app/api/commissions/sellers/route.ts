import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { CommissionService } from '@/src/commissions/commission.service';

export async function GET(req: NextRequest) {
  try {
    const userContext = await extractUserContext(req);
    const sellerId = req.nextUrl.searchParams.get('sellerId') || userContext.userId || 'DEFAULT_SELLER';

    const dashboard = await CommissionService.getSellerDashboard(sellerId);

    return NextResponse.json({
      success: true,
      sellerId,
      dashboard,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener comisiones de vendedora' },
      { status: 400 }
    );
  }
}
