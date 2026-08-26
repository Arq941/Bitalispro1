import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

function statusFromError(error: unknown) {
  const message = String((error as any)?.message || '');
  if (message.includes('UNAUTHORIZED')) return 401;
  if (message.includes('FORBIDDEN')) return 403;
  return 400;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await extractUserContext(req);
    if (ctx.role !== 'SUPERVISORA' && ctx.role !== 'ADMIN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    await PermissionService.requirePermission(ctx.userId, 'sales.view');

    const fromParam = req.nextUrl.searchParams.get('from');
    const toParam = req.nextUrl.searchParams.get('to');
    const now = new Date();
    const start = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = toParam ? new Date(toParam) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const prisma = PrismaService.getInstance();

    const rows = await prisma.saleDownPayment.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        sale: ctx.role === 'SUPERVISORA' ? { supervisorId: ctx.userId } : undefined,
      },
      include: {
        sale: {
          include: {
            seller: { select: { id: true, firstName: true, lastName: true, email: true } },
            client: { select: { id: true, clientNumber: true, firstName: true, lastName: true } },
            commissions: {
              where: { role: 'VENDEDORA', commissionType: 'SALE_COMMISSION', status: { in: ['CALCULATED', 'APPROVED', 'PAID'] } },
              select: { commissionAmount: true, rate: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = rows.map((row) => {
      const sellerCommission = row.sale.commissions.reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
      const amount = Number(row.amount || 0);
      return {
        id: row.id,
        saleId: row.saleId,
        saleNumber: row.sale.saleNumber,
        amount,
        paymentMethod: row.paymentMethod,
        status: row.status,
        createdAt: row.createdAt,
        seller: row.sale.seller,
        client: row.sale.client,
        sellerCommission,
        sellerRate: row.sale.commissions[0] ? Number(row.sale.commissions[0].rate || 0) : 0,
        adminHandoffEstimate: Math.max(0, amount - sellerCommission),
      };
    });

    return NextResponse.json({
      data: items,
      totals: {
        downPayments: items.reduce((s, x) => s + x.amount, 0),
        sellerCommissions: items.reduce((s, x) => s + x.sellerCommission, 0),
        adminHandoffEstimate: items.reduce((s, x) => s + x.adminHandoffEstimate, 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No fue posible consultar enganches.' }, { status: statusFromError(error) });
  }
}
