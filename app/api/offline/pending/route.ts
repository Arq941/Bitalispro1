import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/database/prisma.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const deviceId = searchParams.get('deviceId');

    const where: any = {
      status: { in: ['QUEUED', 'PROCESSING', 'FAILED', 'CONFLICT'] },
    };

    if (userId) where.userId = userId;
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
      { status: 500 }
    );
  }
}
