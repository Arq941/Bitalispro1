import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { PrismaService } from '@/src/database/prisma.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);

    const hasAccess = await ClientService.checkClientAccess(id, userContext);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Sin acceso al historial de riesgo de este cliente.' },
        { status: 403 }
      );
    }

    const prisma = PrismaService.getInstance();
    const riskHistory = await prisma.clientRiskHistory.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, riskHistory });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
