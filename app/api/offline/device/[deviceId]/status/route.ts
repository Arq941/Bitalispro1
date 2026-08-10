import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/database/prisma.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const resolvedParams = await params;
    const deviceId = resolvedParams.deviceId;

    const operations = await prisma.syncOperation.findMany({
      where: { deviceId },
      orderBy: { clientCapturedAt: 'desc' },
      take: 50,
    });

    const statusCounts = {
      total: operations.length,
      synced: operations.filter((o) => o.status === 'SYNCED').length,
      queued: operations.filter((o) => o.status === 'QUEUED').length,
      conflict: operations.filter((o) => o.status === 'CONFLICT').length,
      rejected: operations.filter((o) => o.status === 'REJECTED').length,
      failed: operations.filter((o) => o.status === 'FAILED').length,
    };

    const lastSyncOp = operations.find((o) => o.status === 'SYNCED');

    return NextResponse.json({
      success: true,
      deviceId,
      lastSyncAt: lastSyncOp ? lastSyncOp.serverReceivedAt : null,
      counts: statusCounts,
      recentOperations: operations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
