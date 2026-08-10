import { NextRequest, NextResponse } from 'next/server';
import { ClientService } from '@/src/crm/client.service';
import { getClientUserContext } from '@/src/crm/auth-helper';
import { RiskLevel } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userContext = getClientUserContext(req);
    const body = await req.json();

    const { newLevel, reason } = body;
    if (!newLevel || !reason) {
      return NextResponse.json(
        { success: false, error: 'newLevel y reason son obligatorios.' },
        { status: 400 }
      );
    }

    const result = await ClientService.updateRisk(id, newLevel as RiskLevel, reason, userContext);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    const isForbidden = err.message?.includes('FORBIDDEN');
    return NextResponse.json(
      { success: false, error: err.message },
      { status: isForbidden ? 403 : 400 }
    );
  }
}
