import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET(req: NextRequest) {
  try {
    const prisma = PrismaService.getInstance();
    const commissions = await prisma.commission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const headers = ['ID', 'Empleado', 'Rol', 'Tipo', 'Base', 'Tasa', 'Monto Comisión', 'Estado', 'IdempotencyKey', 'Fecha'];
    const rows = commissions.map((c: any) => [
      c.id,
      c.employeeId,
      c.role,
      c.commissionType,
      c.baseAmount.toString(),
      c.rate.toString(),
      c.commissionAmount.toString(),
      c.status,
      c.idempotencyKey || '',
      c.createdAt.toISOString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.map((val: any) => `"${val}"`).join(','))].join('\n');


    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="reporte_comisiones.csv"',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al exportar comisiones' },
      { status: 400 }
    );
  }
}
