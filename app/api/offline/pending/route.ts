import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/database/prisma.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';

export async function GET(req: NextRequest) {
  try {
    const user = await extractUserContext(req);
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');

    const where: any = {
      status: { in: ['QUEUED', 'PROCESSING', 'FAILED', 'CONFLICT'] },
    };

    where.userId = user.userId;
    if (deviceId) where.deviceId = deviceId;

    const pendingOps = await prisma.syncOperation.findMany({
      where,
      orderBy: { clientCapturedAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      count: pendingOps.length,
      pendingOperations: pendingOps,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: String(error?.message||'').includes('UNAUTHORIZED') ? 401 : String(error?.message||'').startsWith('FORBIDDEN:') ? 403 : 500 }
    );
  }
}
