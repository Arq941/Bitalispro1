import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/database/prisma.service';
import { getTrustedRequestContext } from '@/src/server/auth/request-context';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const user=getTrustedRequestContext(req);
    const resolvedParams = await params;
    const deviceId = resolvedParams.deviceId;

    const operations = await prisma.syncOperation.findMany({
      where: user.role==='ADMIN'||user.role==='SUPERVISORA'?{deviceId}:{deviceId,userId:user.userId},
      orderBy: { clientCapturedAt: 'desc' },
      take: 50,
    });

    const statusCounts = {
      total: operations.length,
      synced: operations.filter((o: any) => o.status === 'SYNCED').length,
      queued: operations.filter((o: any) => o.status === 'QUEUED').length,
      conflict: operations.filter((o: any) => o.status === 'CONFLICT').length,
      rejected: operations.filter((o: any) => o.status === 'REJECTED').length,
      failed: operations.filter((o: any) => o.status === 'FAILED').length,
    };

    const lastSyncOp = operations.find((o: any) => o.status === 'SYNCED');


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
      { status: String(error?.message||'').startsWith('UNAUTHORIZED')?401:500 }
    );
  }
}
