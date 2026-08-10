import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/database/prisma.service';
import { OfflineSyncService } from '@/src/offline/offline-sync.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const syncOp = await prisma.syncOperation.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!syncOp) {
      return NextResponse.json(
        { success: false, error: 'Operación de sincronización no encontrada' },
        { status: 404 }
      );
    }

    let payloadObj = {};
    try {
      payloadObj = syncOp.payload ? JSON.parse(syncOp.payload) : {};
    } catch {
      payloadObj = {};
    }

    const result = await OfflineSyncService.processSingleOperation(
      syncOp.deviceId,
      syncOp.userId,
      {
        idempotencyKey: syncOp.idempotencyKey,
        operationType: syncOp.operationType as any,
        payload: payloadObj,
        clientCapturedAt: syncOp.clientCapturedAt,
        deviceId: syncOp.deviceId,
        userId: syncOp.userId,
      }
    );

    await prisma.syncOperation.update({
      where: { id: syncOp.id },
      data: {
        retryCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: result.status === 'SYNCED' || result.status === 'DUPLICATE',
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
